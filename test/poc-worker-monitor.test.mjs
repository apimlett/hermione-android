import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
test('root monitor coalesces foreground nudges and stops observation/timers on unmount', async () => {
  const effects = []; const timers = new Map(); let nextTimer = 0, listener, disposed = false, finish;
  const pending = new Promise(r => { finish = r; });
  const code = ts.transpileModule(readFileSync(new URL('../src/worker-monitor.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: { createContext: () => ({ Provider: 'Provider' }), useEffect: f => effects.push(f), useRef: value => ({ current: value }), useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx },
    'react-native': { AppState: { addEventListener: (_, f) => { listener = f; return { remove() {} }; } } },
    './app-state': { useApp: () => ({ backend: { kind: 'live', listWorkers() {} }, bots: [{ id: 'p', profile: 'default', name: 'Parent' }], config: { baseUrl: 'https://example.ts.net' } }) },
    './worker-observer': { WorkerObserver: class { refresh() { return pending; } dispose() { disposed = true; } } },
    './notify': {}, './secure': {}, './workers': {},
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => mocks[id], module, module.exports);
  const set = globalThis.setTimeout, clear = globalThis.clearTimeout;
  globalThis.setTimeout = f => { const id = ++nextTimer; timers.set(id, f); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  try {
    module.exports.WorkerProvider({ children: null });
    const cleanup = effects[0]();
    listener('active'); listener('active'); finish();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    assert.equal(timers.size, 1, 'foreground nudges must not multiply polling loops');
    cleanup(); assert.equal(timers.size, 0); assert.equal(disposed, true);
  } finally { globalThis.setTimeout = set; globalThis.clearTimeout = clear; }
});
