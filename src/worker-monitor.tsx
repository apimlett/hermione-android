import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useApp } from './app-state';
import { notifyWorker } from './notify';
import * as Store from './secure';
import { WorkerObserver } from './worker-observer';
import { NO_WORKERS } from './workers';

const Context = createContext<WorkerObserver | null>(null);
const noopSubscribe = () => () => {};

/** Network/transport bound for a single worker refresh; longer means the bridge call is
 *  presumed stalled. The poll loop races this against the actual request so a stalled
 *  read never blocks subsequent timers or sibling profiles. */
const WORKER_REFRESH_TIMEOUT_MS = 15000;

/** Root-level observation continues after a parent turn ends, while app JS is alive. */
export function WorkerProvider({ children }: { children: ReactNode }) {
  const { backend, bots, config } = useApp();
  const roster = useRef(bots); roster.current = bots;
  const [observer, setObserver] = useState<WorkerObserver | null>(null);
  const scope = config?.baseUrl ?? '';
  useEffect(() => {
    if (!backend?.listWorkers || backend.kind !== 'live') { setObserver(null); return; }
    const current = new WorkerObserver({ scope, store: Store, read: (b) => backend.listWorkers!(b as typeof bots[number]), notify: notifyWorker });
    setObserver(current);
    let stopped = false;
    let polling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stopped || polling) return;
      polling = true;
      if (timer) clearTimeout(timer);
      const work = current.refresh(roster.current).catch(() => undefined);
      const guard = new Promise<void>((resolve) => { timer = setTimeout(resolve, WORKER_REFRESH_TIMEOUT_MS); });
      try { await Promise.race([work, guard]); }
      finally { polling = false; if (timer) { clearTimeout(timer); timer = undefined; } }
      if (stopped) return;
      timer = setTimeout(() => { void poll(); }, 10000);
    };
    void poll();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void poll(); });
    return () => { stopped = true; if (timer) clearTimeout(timer); sub.remove(); current.dispose(); };
  }, [backend, scope]);
  useEffect(() => { if (observer) void observer.refresh(bots).catch(() => {}); }, [observer, bots]);
  return <Context.Provider value={observer}>{children}</Context.Provider>;
}

export function useWorkers(profile: string) {
  const observer = useContext(Context);
  return useSyncExternalStore(observer?.subscribe ?? noopSubscribe, () => observer?.get(profile) ?? NO_WORKERS, () => NO_WORKERS);
}
