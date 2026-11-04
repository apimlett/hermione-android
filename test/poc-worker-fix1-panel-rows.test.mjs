import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');

test('worker panel breaks clipped detail fields into separate short rows so timing/review/delivery are visible', () => {
  // Before the fix, all of worker id, parent session, elapsed, last update, review
  // and delivery were joined into a single `detail` string that the shared Row
  // capped at two lines and clipped. After the fix, each worker is split into
  // three short rows (identity, timing, status).
  const code = ts.transpileModule(readFileSync(new URL('../src/ui/worker-panel.tsx', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  const jsx = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
  new Function('require', 'module', 'exports', code)(
    id => ({ 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View' }, './kit': { Section: 'Section', Row: 'Row' } }[id] ?? {}),
    module, module.exports);
  const panel = module.exports.WorkerPanel({
    bot: { id: 'p', name: 'Parent', profile: 'default' },
    now: 30000,
    snapshot: {
      capability: 'ledger-v1', hasMore: false, push: 'blocked',
      workers: [{
        id: 'd:0', taskIndex: 0, state: 'running', recordedState: 'running',
        startedAt: 10, updatedAt: 20, completedAt: null,
        parentSessionId: 's', review: 'unknown', delivery: 'pending',
        summary: 'SECRET', activity: 'SECRET', label: 'SECRET'
      }]
    }
  });
  const text = JSON.stringify(panel);
  // Identity row still identifies the worker.
  assert.match(text, /Child 1 · running/);
  assert.match(text, /d:0 · parent session s/);
  // Timing row keeps the previously clipped duration/last-update fields.
  assert.match(text, /20s since dispatch/);
  assert.match(text, /last ledger update 10s ago/);
  // Status row keeps live-activity, parent-review and delivery visible.
  assert.match(text, /live activity unknown · parent review unknown · result delivery pending/);
  // No secret content ever escapes; clipping regression was never about secrets.
  assert.doesNotMatch(text, /SECRET/);
});
