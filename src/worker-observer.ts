import { NO_WORKERS, type Worker, type WorkerSnapshot } from './workers';
type Bot = { id: string; profile: string; name: string };
type Options = {
  scope: string;
  store: { getItem(k: string): Promise<string | null>; setItem(k: string, value: string): Promise<void> };
  /** Reads one profile's worker snapshot. The signal is aborted at the read deadline. */
  read(bot: Bot, signal: AbortSignal): Promise<WorkerSnapshot>;
  /** true means the local notification provider accepted scheduling, not device delivery. */
  notify(bot: Bot, worker: Worker): Promise<boolean>;
  /** Override for the per-read deadline (tests). */
  readTimeoutMs?: number;
};
const ACK_KEY = 'hermione.worker.notifications.v1';

/** Bound on one profile's worker read. The read is abandoned at the deadline and the
 *  request is aborted, so a stalled transport can neither wedge this observer nor
 *  delay a sibling profile's read, alerts or next poll. */
export const WORKER_READ_TIMEOUT_MS = 15000;

/** Every observer instance writes the same SecureStore key. Writes are serialised and
 *  each one merges with what is already stored, so a late write from a replaced
 *  observer can add its own keys but never erase a newer observer's keys. */
let writeQueue: Promise<unknown> = Promise.resolve();
function serializeAckWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(() => fn(), () => fn());
  writeQueue = next.then(() => undefined, () => undefined);
  return next;
}

/** Observes durable children independently of chat/run lifetime. No assistant prose inference. */
export class WorkerObserver {
  private snapshots = new Map<string, WorkerSnapshot>();
  private listeners = new Set<() => void>();
  private acknowledged?: Set<string>;
  private disposed = false;
  private pending?: Promise<void>;
  private readonly readTimeoutMs: number;
  constructor(private options: Options) {
    this.readTimeoutMs = options.readTimeoutMs ?? WORKER_READ_TIMEOUT_MS;
  }
  get = (profile: string): WorkerSnapshot => this.snapshots.get(profile) ?? NO_WORKERS;
  subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
  dispose() { this.disposed = true; this.listeners.clear(); }
  refresh(bots: Bot[]): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.pending) return this.pending;
    // A settled run always clears `pending`, so a bounded read can never leave the
    // observer permanently coalesced onto one stale promise.
    const run = this.run(bots)
      .catch(() => undefined)
      .finally(() => { if (this.pending === run) this.pending = undefined; });
    this.pending = run;
    return run;
  }
  private async run(bots: Bot[]): Promise<void> {
    await this.ensureLoaded();
    if (this.disposed) return;
    // Each profile runs its own bounded pipeline. A stalled transport delays only
    // itself: a healthy profile still publishes and still notifies, and the run
    // always settles so the next poll starts a fresh read.
    await Promise.all(bots.map((bot) => this.observe(bot)));
  }
  /** One profile: bounded read, publish, then notify its terminal workers. */
  private async observe(bot: Bot): Promise<void> {
    const data = await this.readBounded(bot);
    if (this.disposed) return;
    this.snapshots.set(bot.profile, data);
    this.listeners.forEach((f) => f());
    if (data.capability !== 'ledger-v1') return;
    for (const worker of data.workers) {
      if (this.disposed) return;
      if (!worker.eventId || worker.state === 'running') continue;
      const key = JSON.stringify([this.options.scope, bot.profile, worker.eventId]);
      if (this.acknowledged!.has(key)) continue;
      try {
        if (await this.options.notify(bot, worker)) {
          this.acknowledged!.add(key);
          await serializeAckWrite(() => this.persistAcks());
        }
      } catch { /* A provider/storage failure is not evidence of device delivery. */ }
    }
  }
  /** One profile's read, bounded and cancellable. A timeout keeps the last known
   *  records but marks the observation unavailable — never idle, never success. */
  private async readBounded(bot: Bot): Promise<WorkerSnapshot> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('worker read timed out')); }, this.readTimeoutMs);
    });
    try {
      return await Promise.race([this.options.read(bot, controller.signal), deadline]);
    } catch {
      return { ...this.get(bot.profile), capability: 'unavailable' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  /** Merge with what is already stored, then write. A late write from a replaced
   *  observer adds its own keys but cannot drop a newer observer's keys. */
  private async persistAcks(): Promise<void> {
    const merged = new Set<string>();
    let stored: unknown;
    try { stored = JSON.parse(await this.options.store.getItem(ACK_KEY) ?? '[]'); } catch { stored = []; }
    if (Array.isArray(stored)) for (const key of stored) if (typeof key === 'string') merged.add(key);
    for (const key of this.acknowledged!) merged.add(key);
    this.acknowledged = merged;
    await this.options.store.setItem(ACK_KEY, JSON.stringify([...merged]));
  }
  private async ensureLoaded(): Promise<void> {
    if (this.acknowledged) return;
    // Drain any pending write from a replaced observer so the load sees the newest
    // persisted state rather than a half-written one.
    await writeQueue.catch(() => undefined);
    let stored: unknown;
    try { stored = JSON.parse(await this.options.store.getItem(ACK_KEY) ?? '[]'); } catch { stored = []; }
    this.acknowledged = new Set(Array.isArray(stored) ? stored.filter((s): s is string => typeof s === 'string') : []);
  }
}
