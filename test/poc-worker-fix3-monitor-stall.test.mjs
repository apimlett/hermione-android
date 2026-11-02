import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');

test('worker monitor races the bridge read against a bounded timeout so a stalled request does not block polling', async () => {
  // The poll loop must always schedule the next timer, even when the
  // transport stalls. Before the fix, a never-resolving listWorkers would
  // hang the polling loop and prevent recovery. The fix races the refresh
  // promise against a setTimeout guard; the guard firing must advance the
  // loop and re-arm the next timer.
  const effects = []; const timers = new Map(); let nextTimer = 0; let listener;
  const code = ts.transpileModule(readFileSync(new URL('../src/worker-monitor.tsx', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: { createContext: () => ({ Provider: 'Provider' }), useEffect: f => effects.push(f), useRef: value => ({ current: value }), useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { AppState: { addEventListener: (_, f) => { listener = f; return { remove() {} }; } } },
    './app-state': { useApp: () => ({ backend: { kind: 'live', listWorkers: () => new Promise(() => {}) }, bots: [{ id: 'p', profile: 'default', name: 'Parent' }], config: { baseUrl: 'https://example.ts.net' } }) },
    './worker-observer': { WorkerObserver: class { refresh() { return new Promise(() => {}); } dispose() {} } },
    './notify': {}, './secure': {}, './workers': {},
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => mocks[id], module, module.exports);
  const set = globalThis.setTimeout, clear = globalThis.clearTimeout;
  globalThis.setTimeout = f => { const id = ++nextTimer; timers.set(id, f); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  try {
    module.exports.WorkerProvider({ children: null });
    // Invoke the mount effect synchronously; this starts the poll and
    // captures the guard timeout.
    effects[0]();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    // Exactly one timer is captured: the guard. The 10s poll timer has
    // not been scheduled yet because the poll function awaits Promise.race
    // and has not completed.
    assert.equal(timers.size, 1, 'before the guard fires only the guard timer should exist');
    const guardId = [...timers.keys()][0];
    const beforeFire = new Set(timers.keys());
    // Fire the guard timer to simulate the timeout elapsing. The poll
    // function's finally block then schedules the next 10s poll timer.
    timers.get(guardId)();
    timers.delete(guardId);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const afterFire = new Set(timers.keys());
    const hasNewTimer = [...afterFire].some(id => !beforeFire.has(id));
    assert.ok(hasNewTimer, 'after the guard timeout fires the poll loop must schedule a new timer');
  } finally { globalThis.setTimeout = set; globalThis.clearTimeout = clear; }
});

test('worker monitor source uses a bounded guard timeout for the refresh promise', () => {
  // Static regression: the poll loop must race the refresh against a timeout
  // so a stalled bridge call cannot block the next timer. Greptile flagged
  // this as P1; the guard is the contract.
  const src = readFileSync(new URL('../src/worker-monitor.tsx', import.meta.url), 'utf8');
  assert.match(src, /WORKER_REFRESH_TIMEOUT_MS\s*=\s*\d+/, 'a bounded worker refresh timeout constant must be declared');
  assert.match(src, /Promise\.race\(/, 'the poll loop must race the refresh against the guard');
});
