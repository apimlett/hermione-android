import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Activity worker panel shows parent/children, recorded state, timing and unknown review without raw output', () => {
  assert.ok(existsSync(new URL('../src/ui/worker-panel.tsx', import.meta.url)), 'worker UI is missing');
  const code = ts.transpileModule(read('src/ui/worker-panel.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  const jsx = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
  new Function('require', 'module', 'exports', code)(id => ({ 'react/jsx-runtime': { jsx, jsxs: jsx }, './kit': { Section: 'Section', Row: 'Row' } }[id] ?? {}), module, module.exports);
  const panel = module.exports.WorkerPanel({ bot: { id: 'p', name: 'Parent', profile: 'default' }, now: 30000, snapshot: { capability: 'ledger-v1', hasMore: true, push: 'blocked', workers: [{ id: 'd:0', taskIndex: 0, state: 'running', recordedState: 'running', startedAt: 10, updatedAt: 20, completedAt: null, parentSessionId: 's', review: 'unknown', delivery: 'pending', summary: 'SECRET', activity: 'SECRET', label: 'SECRET' }] } });
  const text = JSON.stringify(panel);
  assert.match(text, /parent bot/); assert.match(text, /Child/); assert.match(text, /running/);
  assert.match(text, /review unknown/); assert.match(text, /20s/); assert.match(text, /blocked/i);
  assert.match(text, /truncated/i); assert.doesNotMatch(text, /SECRET|%/);
  const terminal = module.exports.WorkerPanel({ bot: { name: 'Parent', profile: 'default' }, now: 30000, snapshot: { capability: 'ledger-v1', workers: [{ id: 'd:0', taskIndex: 0, recordedState: 'completed', startedAt: 10, completedAt: null, updatedAt: 20 }] } });
  assert.match(JSON.stringify(terminal), /duration unknown/);
});
test('worker observation is rooted outside chat turns, Activity is wired, and worker taps open its safe result-status page', () => {
  const layout = read('app/_layout.tsx');
  assert.match(layout, /<WorkerProvider>/);
  assert.match(layout, /t\.workerId/);
  assert.match(layout, /\/activity\//);
  assert.match(read('app/activity/[botId].tsx'), /WorkerPanel/);
  assert.match(read('app/activity/[botId].tsx'), /useWorkers/);
});
