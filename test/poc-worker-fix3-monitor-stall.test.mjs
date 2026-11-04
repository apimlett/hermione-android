import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

execSync('./node_modules/.bin/esbuild src/worker-observer.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/worker-observer-fix3.mjs --log-level=error');
const { WorkerObserver, WORKER_READ_TIMEOUT_MS } = await import('../node_modules/.cache/worker-observer-fix3.mjs');

const bot = (profile) => ({ id: 'parent', profile, name: 'Parent' });
const worker = (state) => ({
  id: 'deleg_test:0', delegationId: 'deleg_test', taskIndex: 0, profile: 'default',
  parentSessionId: 'session', parentRunId: null, parentJobId: null,
  label: 'Delegated task 1', state, recordedState: state, activity: 'Recorded',
  startedAt: 10, updatedAt: 20, completedAt: state === 'running' ? null : 20,
  liveness: 'unknown', review: 'unknown', delivery: 'pending',
  eventId: state === 'running' ? null : 'deleg_test:0:completed:20'
});
const snapshot = (state, profile = 'default') => ({ capability: 'ledger-v1', workers: [worker(state)], hasMore: false, push: 'blocked' });

test('a stalled worker read is bounded and the profile reports unavailable rather than idle', async () => {
  // Greptile P1: the bridge request had no timeout, so a never-settling read
  // wedged the observer on its pending promise and no further worker state or
  // completion alert could ever arrive. The read must be abandoned at a deadline.
  let aborted = false;
  const observer = new WorkerObserver({
    scope: 'stall', store: { getItem: async () => null, setItem: async () => {} },
    read: async (_bot, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
    }),
    notify: async () => true, readTimeoutMs: 20
  });
  const started = Date.now();
  await observer.refresh([bot('default')]);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 2000, `the stalled read must be abandoned quickly, took ${elapsed}ms`);
  assert.ok(aborted, 'the in-flight request must be aborted at the deadline');
  assert.equal(observer.get('default').capability, 'unavailable', 'a timed-out read must report unavailable');
});

test('a stalled profile does not block a healthy sibling profile', async () => {
  // Greptile P1: "later profiles wait behind the stalled read". Each profile
  // must be read independently so one stalled transport delays only itself.
  const healthy = { capability: 'ledger-v1', workers: [worker('completed')], hasMore: false, push: 'blocked' };
  const notified = [];
  const observer = new WorkerObserver({
    scope: 'sibling', store: { getItem: async () => null, setItem: async () => {} },
    read: async (b, signal) => {
      if (b.profile === 'stalled') return new Promise((_r, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
      return healthy;
    },
    notify: async (b, w) => { notified.push(b.profile); return true; },
    readTimeoutMs: 20
  });
  await observer.refresh([bot('stalled'), bot('healthy')]);
  assert.equal(observer.get('healthy').capability, 'ledger-v1', 'the healthy profile must still publish');
  assert.ok(notified.includes('healthy'), 'the healthy profile must still notify');
});

test('the observer clears its pending promise after a bounded timeout so the next poll re-reads', async () => {
  // Greptile P1: the observer coalesced every refresh onto one pending promise.
  // If that promise never settled, every later poll returned it and no new read
  // was ever issued. After the deadline the run must settle and clear `pending`.
  let reads = 0;
  const observer = new WorkerObserver({
    scope: 'recover', store: { getItem: async () => null, setItem: async () => {} },
    read: async (_b, signal) => { reads += 1; return new Promise((_r, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    }); },
    notify: async () => true, readTimeoutMs: 20
  });
  await observer.refresh([bot('default')]);
  await observer.refresh([bot('default')]);
  assert.equal(reads, 2, 'each poll must issue a fresh read once the previous one settled');
});

test('a worker read that settles normally is not affected by the deadline', async () => {
  const observer = new WorkerObserver({
    scope: 'ok', store: { getItem: async () => null, setItem: async () => {} },
    read: async () => snapshot('completed'), notify: async () => true, readTimeoutMs: 50
  });
  await observer.refresh([bot('default')]);
  assert.equal(observer.get('default').capability, 'ledger-v1');
  assert.equal(observer.get('default').workers.length, 1);
});

test('the read deadline is a bounded constant', () => {
  assert.equal(typeof WORKER_READ_TIMEOUT_MS, 'number');
  assert.ok(WORKER_READ_TIMEOUT_MS > 0 && WORKER_READ_TIMEOUT_MS <= 60000,
    `the read deadline must be a positive bounded value, got ${WORKER_READ_TIMEOUT_MS}`);
});
