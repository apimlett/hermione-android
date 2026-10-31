import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
execSync('./node_modules/.bin/esbuild src/run-stream.ts --bundle --format=esm --platform=node --outfile=node_modules/.cache/poc-controls/run-stream.mjs --log-level=error');
const { followRun } = await import('../node_modules/.cache/poc-controls/run-stream.mjs');
const pause = (ms = 20) => new Promise(r => setTimeout(r, ms));
const json = body => new Response(JSON.stringify(body));
const approval = { kind: 'approval', prompt_id: 'prompt-7', execution_generation: 7, command: 'example command', choices: ['once', 'deny'] };
function observer(mode, snapshot) {
  const actions = [], requests = [];
  let connects = 0;
  const handle = followRun({ url: p => p, headers: x => x ?? {}, fetch: async (url, init) => {
    requests.push({ url, init });
    if (init.method === 'POST') {
      if (mode === 'conflict') return new Response(JSON.stringify({ error: { code: 'unknown_execution', message: 'Execution owner lost' } }), { status: 409 });
      return json({ run_id: 'r1', ...(mode === 'admission' ? snapshot : {}) });
    }
    if (!url.endsWith('/events')) return json(snapshot);
    connects++;
    if (mode === 'poll') return new Response('', { status: 404 });
    return new Response(new ReadableStream({ start(c) {
      init.signal.addEventListener('abort', () => c.error(new Error('aborted')));
      if (mode === 'reconnect' && connects === 1) queueMicrotask(() => c.error(new Error('dropped')));
    } }));
  } }, { sessionId: 's1', input: 'hi', key: 'key1', backoff: [1], pollMs: 5, stallMs: 10000,
    onAction: a => actions.push(a), onNoRunsApi() { assert.fail('must not replay via legacy'); } });
  return { actions, requests, handle };
}
const clarify = { kind: 'clarify', prompt_id: 'question-8', execution_generation: 8, question: 'Which folder?', choices: ['A', 'B'] };
for (const mode of ['admission', 'conflict', 'poll', 'reconnect', 'foreground']) {
  test(`unknown execution on ${mode} is non-running and never replayed`, async () => {
    const o = observer(mode, { status: 'unknown', admission_id: 'admission-8', execution_generation: 8 });
    try {
      await pause();
      if (mode === 'foreground') { o.handle.nudge(); await pause(); }
      const done = o.actions.find(a => a.type === 'done');
      assert.equal(done?.status, 'unknown');
      assert.equal(done.code, 'unknown_execution');
      assert.match(done.error, /recovery required/i);
      assert.equal(o.requests.filter(r => r.init.method === 'POST').length, 1);
      const count = o.actions.length;
      o.handle.nudge(); await pause();
      assert.equal(o.actions.length, count);
    } finally { o.handle(); }
  });
}
for (const mode of ['poll', 'reconnect', 'foreground']) {
  test(`canonical clarification is recovered on ${mode} while status remains running`, async () => {
    const o = observer(mode, { status: 'running', pending_controls: [clarify] });
    try {
      await pause();
      if (mode === 'foreground') { o.handle.nudge(); await pause(); }
      const prompt = o.actions.find(a => a.type === 'approval')?.approval;
      assert.equal(prompt?.kind, 'clarify');
      assert.equal(prompt.requestId, 'question-8');
      assert.equal(prompt.generation, 8);
      assert.equal(prompt.title, 'Which folder?');
      assert.deepEqual(prompt.choices, ['A', 'B']);
    } finally { o.handle(); }
  });
}
for (const mode of ['poll', 'reconnect', 'foreground']) {
  test(`canonical pending approval is recovered on ${mode}`, async () => {
    const o = observer(mode, { status: 'waiting_for_approval', pending_controls: [approval] });
    try {
      await pause();
      if (mode === 'foreground') { o.handle.quiet(true); o.handle.quiet(false); o.handle.nudge(); await pause(); }
      const prompts = o.actions.filter(a => a.type === 'approval');
      assert.equal(prompts.length, 1);
      assert.deepEqual(prompts[0].approval, { runId: 'r1', requestId: 'prompt-7', generation: 7, title: 'approval', detail: 'example command' });
      assert.equal(o.actions.some(a => a.type === 'done'), false);
    } finally { o.handle(); }
  });
}
