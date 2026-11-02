import { NO_WORKERS, type Worker, type WorkerSnapshot } from './workers';
type Bot = { id: string; profile: string; name: string };
type Options = {
  scope: string;
  store: { getItem(k: string): Promise<string | null>; setItem(k: string, value: string): Promise<void> };
  read(bot: Bot): Promise<WorkerSnapshot>;
  /** true means the local notification provider accepted scheduling, not device delivery. */
  notify(bot: Bot, worker: Worker): Promise<boolean>;
};
const ACK_KEY = 'hermione.worker.notifications.v1';

/** All observer instances write to the same SecureStore key. If a connection save
 *  replaces this observer while a previous instance's notification acknowledgement is
 *  still in flight, the late write would otherwise erase the new instance's state.
 *  Serialising writes and forcing each instance to drain the queue before its own
 *  read keeps the latest persisted set the winner. */
let writeQueue: Promise<unknown> = Promise.resolve();
function serializeAckWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(() => fn(), () => fn());
  writeQueue = next.catch(() => undefined);
  return next;
}
async function awaitAckWrites(): Promise<void> {
  await writeQueue;
}

/** Observes durable children independently of chat/run lifetime. No assistant prose inference. */
export class WorkerObserver {
  private snapshots = new Map<string, WorkerSnapshot>();
  private listeners = new Set<() => void>();
  private acknowledged?: Set<string>;
  constructor(private options: Options) {}
  get = (profile: string): WorkerSnapshot => this.snapshots.get(profile) ?? NO_WORKERS;
  subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
  private disposed = false;
  private pending?: Promise<void>;
  dispose() { this.disposed = true; this.listeners.clear(); }
  refresh(bots: Bot[]): Promise<void> {
    if (this.disposed) return Promise.resolve();
    return this.pending ??= this.run(bots).finally(() => { this.pending = undefined; });
  }
  private async run(bots: Bot[]): Promise<void> {
    await this.ensureLoaded();
    if (this.disposed) return;
    for (const bot of bots) {
      if (this.disposed) return;
      let data: WorkerSnapshot;
      try { data = await this.options.read(bot); }
      catch { data = { ...this.get(bot.profile), capability: 'unavailable' }; }
      if (this.disposed) return;
      this.snapshots.set(bot.profile, data);
      this.listeners.forEach((f) => f());
      if (data.capability !== 'ledger-v1') continue;
      for (const worker of data.workers) {
        if (this.disposed) return;
        if (!worker.eventId || worker.state === 'running') continue;
        const key = JSON.stringify([this.options.scope, bot.profile, worker.eventId]);
        if (this.acknowledged!.has(key)) continue;
        try {
          if (await this.options.notify(bot, worker)) {
            this.acknowledged!.add(key);
            await serializeAckWrite(() => this.options.store.setItem(ACK_KEY, JSON.stringify([...this.acknowledged!])));
          }
        } catch { /* A provider/storage failure is not evidence of device delivery. */ }
      }
    }
  }
  private async ensureLoaded(): Promise<void> {
    if (this.acknowledged) return;
    // Drain any pending writes from previous observers so the load reads the
    // latest persisted state, not whatever another instance is still writing.
    await awaitAckWrites();
    let stored: unknown;
    try { stored = JSON.parse(await this.options.store.getItem(ACK_KEY) ?? '[]'); } catch { stored = []; }
    this.acknowledged = new Set(Array.isArray(stored) ? stored.filter((s): s is string => typeof s === 'string') : []);
  }
}
