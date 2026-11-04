import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
execSync('./node_modules/.bin/esbuild src/worker-observer.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/worker-observer.mjs --log-level=error');
const { WorkerObserver } = await import('../node_modules/.cache/worker-observer.mjs');
const bot = { id: 'parent', profile: 'default', name: 'Parent' };
const worker = (state = 'running') => ({ id: 'deleg_test:0', delegationId: 'deleg_test', taskIndex: 0, profile: 'default', parentSessionId: 'session', parentRunId: null, parentJobId: null, label: 'Delegated task 1', state, recordedState: state, activity: 'Recorded', startedAt: 10, updatedAt: 20, completedAt: state === 'running' ? null : 20, liveness: 'unknown', review: 'unknown', delivery: 'pending', eventId: state === 'running' ? null : `deleg_test:0:${state}:20` });
const snapshot = (state) => ({ capability: 'ledger-v1', workers: [worker(state)], hasMore: false, push: 'blocked' });

test('independent observer survives parent finish and persists notification acknowledgement across reopen', async () => {
  let data = snapshot('running'); let saved = null; const posts = [];
  const store = { getItem: async () => saved, setItem: async (_, value) => { saved = value; } };
  const options = { scope: 'test-origin', store, read: async () => data, notify: async (_, w) => { posts.push(w.eventId); return true; } };
  const observer = new WorkerObserver(options);
  await observer.refresh([bot]);
  assert.equal(observer.get(bot.profile).workers.length, 1, 'running child must remain independently visible');
  assert.equal(observer.get(bot.profile).workers[0].state, 'running');
  assert.equal(posts.length, 0);
  // No parent reducer/action is involved in the child lifetime.
  data = snapshot('completed');
  await observer.refresh([bot]);
  await observer.refresh([bot]);
  const reopened = new WorkerObserver(options);
  await reopened.refresh([bot]);
  assert.equal(posts.length, 1);
  assert.equal(reopened.get(bot.profile).workers[0].review, 'unknown');
});

test('unreachable snapshot preserves last record but labels observation unavailable, never idle/success', async () => {
  let fail = false;
  const observer = new WorkerObserver({ scope: 'server', store: { getItem: async () => null, setItem: async () => {} }, read: async () => { if (fail) throw Error('PRIVATE TRANSPORT'); return snapshot('running'); }, notify: async () => true });
  await observer.refresh([bot]); fail = true;
  await observer.refresh([bot]);
  assert.equal(observer.get(bot.profile).capability, 'unavailable');
  assert.equal(observer.get(bot.profile).workers[0].recordedState, 'running');
  assert.doesNotMatch(JSON.stringify(observer.get(bot.profile)), /PRIVATE/);
});

test('concurrent refreshes coalesce and failed notification scheduling is retried; each terminal kind is distinct', async () => {
  let accepted = false; let posts = 0; let data = snapshot('failed');
  const observer = new WorkerObserver({ scope: 'server', store: { getItem: async () => null, setItem: async () => {} }, read: async () => data, notify: async () => { posts++; return accepted; } });
  await observer.refresh([bot]); accepted = true;
  await Promise.all([observer.refresh([bot]), observer.refresh([bot])]);
  assert.equal(posts, 2, 'one unsuccessful attempt then one successful scheduling');
  for (const state of ['cancelled', 'interrupted', 'unknown']) { data = snapshot(state); await observer.refresh([bot]); await observer.refresh([bot]); }
  assert.equal(posts, 5);
});

test('retained notification acknowledgements are not evicted into repeated replay alerts', async () => {
  let stored = null; let posts = 0;
  const data = { ...snapshot('completed'), workers: Array.from({ length: 1001 }, (_, i) => ({ ...worker('completed'), id: `d:${i}`, eventId: `d:${i}:completed` })) };
  const options = { scope: 'server', store: { getItem: async () => stored, setItem: async (_, value) => { stored = value; } }, read: async () => data, notify: async () => { posts++; return true; } };
  await new WorkerObserver(options).refresh([bot]);
  await new WorkerObserver(options).refresh([bot]);
  assert.equal(posts, 1001);
});

test('disposal fences a late response from an old connection', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  let posts = 0;
  const observer = new WorkerObserver({ scope: 'old-server', store: { getItem: async () => null, setItem: async () => {} }, read: async () => pending, notify: async () => { posts++; return true; } });
  const refresh = observer.refresh([bot]); await Promise.resolve(); await Promise.resolve();
  observer.dispose(); finish(snapshot('completed')); await refresh;
  assert.equal(posts, 0);
  assert.equal(observer.get(bot.profile).capability, 'unavailable');
});
