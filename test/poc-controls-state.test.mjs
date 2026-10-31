import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
export function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}
const model = load('src/chat-model.ts');
export function app(client, background = false) {
  const notifications = [];
  let stateIndex = 0, aborted = 0, callback;
  let chats = {};
  const backend = { chat: () => client, botChatSession: async () => 's1' };
  const noop = () => {};
  const handle = () => aborted++;
  client.streamTurn = (sid, input, cb) => { callback = cb; return handle; };
  const hooks = { live: { get: () => ({ chats }) }, EMPTY: { turns: [], busy: false },
    setChats: f => { chats = f(chats); }, setPreview: noop, setUnread: noop, setHappy: noop,
    touch: noop, nextId: (() => { let i = 0; return () => `t${++i}`; })(), raf: f => f(),
    retryReason: () => null, plain: s => s, AppCtx: { Provider: 'Provider' } };
  const jsx = (type, props) => ({ type, props });
  const module = load('src/app-state.tsx', {
    react: { useState: initial => [stateIndex++ === 1 ? {} : initial, noop], useRef: v => ({ current: v === true && background ? false : v }), useCallback: f => f, useMemo: f => f(), useEffect: noop },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { AppState: {} },
    './backend': {}, './chat-tools': { buildInput: x => x }, './notify': { notifyApproval: (...args) => notifications.push(args) }, './chat-model': model,
    './run-stream': { newRunKey: () => 'key' }, './ui/haptics': {}, './config': {},
    './demo-backend': { DemoBackend: class {} }, './live-backend': { LiveBackend: class { constructor() { return backend; } } },
    './secure': {}, './notices': {}, './history-turns': {}, './files': {}, './slash': {}, './app-state-hooks': hooks,
  });
  const ctx = module.AppProvider({ children: null }).props.value;
  return { ctx, emit: a => callback(a), chats: () => chats, aborted: () => aborted, notifications };
}
const bot = { id: 'b1' };
test('background clarification never offers Allow/Deny approval notification actions', async () => {
  const a = app({}, true);
  await a.ctx.send(bot, 'hi');
  for (const action of model.toAction('clarify.request', JSON.stringify({ run_id: 'r1', prompt_id: 'q1', question: 'Which folder?', choices: ['A', 'B'] }))) a.emit(action);
  assert.equal(a.notifications.length, 0);
});
test('clarify.request reaches the answer state and answers the canonical clarify endpoint without granting approval', async () => {
  const calls = [];
  const a = app({ clarify: async (...args) => calls.push(args), approve: async () => assert.fail('not an approval') });
  await a.ctx.send(bot, 'hello');
  for (const action of model.toAction('clarify.request', JSON.stringify({ run_id: 'r1', prompt_id: 'q1', execution_generation: 9, question: 'Which folder?', choices: ['A', 'B'], multi_select: false }))) a.emit(action);
  const turn = a.chats().b1.turns.at(-1);
  assert.equal(turn.approval?.kind, 'clarify');
  assert.equal(turn.approval.title, 'Which folder?');
  assert.deepEqual(turn.approval.choices, ['A', 'B']);
  await a.ctx.approve(bot, turn.id, 'A');
  assert.deepEqual(calls, [['r1', 'q1', 9, 'A']]);
  assert.equal(a.chats().b1.turns.at(-1).approval, undefined);
  assert.equal(a.chats().b1.turns.at(-1).status, 'streaming');
});
for (const kind of ['clarify', undefined]) {
  const label = kind === 'clarify' ? 'clarification' : 'approval';
  for (const [field, value] of [['requestId', 'q2'], ['runId', 'r2'], ['generation', 10], ['kind', kind === 'clarify' ? undefined : 'clarify']]) {
    test(`${label} response preserves a streamed replacement with a different ${field}`, async () => {
      let release;
      const pending = new Promise(resolve => { release = resolve; });
      const calls = [];
      const submit = (...args) => { calls.push(args); return pending; };
      const a = app({ clarify: submit, approve: submit });
      await a.ctx.send(bot, 'hello');
      const q1 = { runId: 'r1', requestId: 'q1', generation: 9, kind, title: 'First control' };
      a.emit({ type: 'approval', approval: q1 });
      const turnId = a.chats().b1.turns.at(-1).id;
      const choice = kind === 'clarify' ? 'A' : 'once';
      const submission = a.ctx.approve(bot, turnId, choice);
      assert.deepEqual(calls, [['r1', 'q1', 9, choice]]);
      assert.deepEqual(a.chats().b1.turns.at(-1).approval, q1);
      const q2 = { ...q1, [field]: value, title: 'Replacement control' };
      a.emit({ type: 'approval', approval: q2 });
      assert.equal(a.chats().b1.turns.at(-1).id, turnId);
      assert.deepEqual(a.chats().b1.turns.at(-1).approval, q2);
      release();
      await submission;
      assert.deepEqual(a.chats().b1.turns.at(-1).approval, q2);
    });
  }
  test(`${label} response clears a matching current control after HTTP resolves`, async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const a = app({ clarify: () => pending, approve: () => pending });
    await a.ctx.send(bot, 'hello');
    const q1 = { runId: 'r1', requestId: 'q1', generation: 9, kind, title: 'First control' };
    a.emit({ type: 'approval', approval: q1 });
    const turnId = a.chats().b1.turns.at(-1).id;
    const submission = a.ctx.approve(bot, turnId, kind === 'clarify' ? 'A' : 'once');
    // The same identity may be reprojected as a new object while HTTP is pending.
    a.emit({ type: 'approval', approval: { ...q1 } });
    assert.deepEqual(a.chats().b1.turns.at(-1).approval, q1);
    release();
    await submission;
    assert.equal(a.chats().b1.turns.at(-1).approval, undefined);
  });
}

test('clarification card offers choices and a typed answer without approval buttons', async () => {
  const values = [], calls = [];
  let index = 0;
  const jsx = (type, props) => ({ type, props });
  const { ApprovalCard } = load('src/ui/approval-card.tsx', {
    react: { useState: initial => { const i = index++; if (!(i in values)) values[i] = initial; return [values[i], v => { values[i] = v; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react-native': { ShieldQuestion: 'Icon' },
    'react-native': Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'View'].map(x => [x, x])),
    './haptics': { tapHaptic() {} }, './theme': { colors: {}, font: {}, radii: {}, type: {} },
  });
  const props = { approval: { kind: 'clarify', title: 'Which folder?', choices: ['A', 'B'] }, respond: async answer => calls.push(answer) };
  function render() {
    index = 0;
    const nodes = [];
    function visit(n) {
      if (!n || typeof n !== 'object') return;
      if (typeof n.type === 'function') return visit(n.type(n.props));
      nodes.push(n);
      for (const c of [n.props?.children].flat(Infinity)) visit(c);
    }
    visit(ApprovalCard(props));
    return nodes;
  }
  let nodes = render();
  assert.ok(nodes.some(n => n.props?.accessibilityLabel === 'A'));
  assert.ok(!nodes.some(n => ['Allow', 'Deny', 'Always allow'].includes(n.props?.accessibilityLabel)));
  await nodes.find(n => n.props?.accessibilityLabel === 'A').props.onPress();
  assert.deepEqual(calls, ['A']);
  nodes = render();
  nodes.find(n => n.type === 'TextInput').props.onChangeText('custom folder');
  nodes = render();
  await nodes.find(n => n.props?.accessibilityLabel === 'Send answer').props.onPress();
  assert.deepEqual(calls, ['A', 'custom folder']);
});

test('clarify answers use only canonical request identity, generation and answer', async () => {
  const { execSync } = await import('node:child_process');
  execSync('./node_modules/.bin/esbuild src/hermes.ts --bundle --platform=node --format=esm --alias:expo/fetch=./test/fetch-shim.mjs --outfile=node_modules/.cache/poc-controls/hermes.mjs --log-level=error');
  const { HermesClient } = await import('../node_modules/.cache/poc-controls/hermes.mjs');
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, method: init.method, body: JSON.parse(init.body) }); return new Response('{}'); };
  try {
    await new HermesClient({ baseUrl: 'https://synthetic.invalid', apiKey: 'fixture' }).clarify('run/a', 'q7', 7, 'A');
    assert.deepEqual(calls, [{ url: 'https://synthetic.invalid/v1/runs/run%2Fa/clarify', method: 'POST', body: { request_id: 'q7', execution_generation: 7, answer: 'A' } }]);
  } finally { globalThis.fetch = oldFetch; }
});

test('unknown execution renders recovery required, not working or Retry', () => {
  const jsx = (type, props) => ({ type, props });
  const mocks = Object.fromEntries(['expo-router', 'lucide-react-native', '../../src/slash', '../../src/ui/face-state', '../../src/text-safety', '../../src/ui/approval-card', '../../src/ui/kit', '../../src/ui/activity-row', '../../src/ui/motion', '../../src/ui/notice-chip', 'react-native-reanimated', '../../src/ui/markdown', '../../src/ui/reactions', '../../src/ui/steps-row'].map(x => [x, {}]));
  const { TurnRow } = load('app/bot/bits.tsx', { ...mocks,
    react: { Component: class {}, memo: f => f }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Text: 'Text', View: 'View' },
    '../../src/app-state': { useApp: () => ({}), useReaction() {} }, '../../src/ui/activity': { activityLine: () => undefined },
    '../../src/prefs': { usePrefs: () => true }, '../../src/ui/theme': { colors: {}, type: {} },
  });
  const tree = TurnRow({ turn: { ...model.initialTurn('t1'), status: 'unknown', prompt: 'hi', error: 'Recovery required: resolve on Hermes', runId: 'r1' }, bot });
  const strings = [];
  function visit(n) { if (typeof n === 'string') strings.push(n); if (n && typeof n === 'object') for (const c of [n.props?.children].flat(Infinity)) visit(c); }
  visit(tree);
  assert.match(strings.join(' '), /recovery required/i);
  assert.ok(!strings.some(s => /Working|Retry/.test(s)));
  strings.length = 0;
  visit(TurnRow({ turn: { ...model.initialTurn('t2'), controlError: 'Stop not confirmed: try Stop again.' }, bot }));
  assert.match(strings.join(' '), /Stop not confirmed: try Stop again/);
});

test('unknown execution cannot be retried through app state', async () => {
  const a = app({});
  await a.ctx.send(bot, 'hello');
  a.emit({ type: 'done', status: 'unknown', code: 'unknown_execution', error: 'Recovery required' });
  const turn = a.chats().b1.turns.at(-1);
  assert.equal(a.chats().b1.busy, false);
  await a.ctx.retry(bot, turn.id);
  assert.equal(a.chats().b1.turns.at(-1).status, 'unknown');
});

test('run.unknown SSE preserves an unknown outcome instead of running indefinitely', () => {
  const actions = model.toAction('run.unknown', JSON.stringify({ run_id: 'r1' }));
  const turn = actions.reduce(model.reduce, model.initialTurn('t1'));
  assert.equal(turn.status, 'unknown');
  assert.equal(turn.errorCode, 'unknown_execution');
});

test('accepted stopping acknowledgement keeps observing until the actual server terminal event', async () => {
  const calls = [];
  const a = app({ stop: async id => { calls.push(id); return { status: 'stopping' }; } });
  await a.ctx.send(bot, 'hello');
  a.emit({ type: 'run', runId: 'r1' });
  await a.ctx.stop(bot);
  assert.deepEqual(calls, ['r1']);
  assert.equal(a.aborted(), 0);
  assert.equal(a.chats().b1.busy, true);
  assert.equal(a.chats().b1.turns.at(-1).status, 'streaming');
  a.emit({ type: 'done', status: 'cancelled' });
  assert.equal(a.chats().b1.busy, false);
  assert.equal(a.chats().b1.turns.at(-1).status, 'cancelled');
});

test('a clarification rejected by the server stays answerable with its original identity', async () => {
  const a = app({ clarify: async () => { throw new Error('stale generation'); } });
  await a.ctx.send(bot, 'hello');
  for (const action of model.toAction('clarify.request', JSON.stringify({ run_id: 'r1', prompt_id: 'q1', execution_generation: 9, question: 'Which folder?' }))) a.emit(action);
  const turn = a.chats().b1.turns.at(-1);
  await assert.rejects(a.ctx.approve(bot, turn.id, 'A'), /stale generation/);
  assert.deepEqual(a.chats().b1.turns.at(-1).approval, turn.approval);
  assert.equal(a.chats().b1.turns.at(-1).status, 'streaming');
});

test('rejected stop preserves observation, streaming status and busy state with actionable error', async () => {
  const a = app({ stop: async () => { throw new Error('server unavailable'); } });
  await a.ctx.send(bot, 'hello');
  a.emit({ type: 'run', runId: 'r1' });
  await a.ctx.stop(bot);
  await Promise.resolve();
  assert.equal(a.aborted(), 0);
  assert.equal(a.chats().b1.turns.at(-1).status, 'streaming');
  assert.equal(a.chats().b1.busy, true);
  assert.match(a.chats().b1.error, /stop.*not.*confirmed.*server unavailable.*try.*stop/i);
  assert.match(a.chats().b1.turns.at(-1).controlError, /stop.*not.*confirmed.*server unavailable.*try.*stop/i);
});
