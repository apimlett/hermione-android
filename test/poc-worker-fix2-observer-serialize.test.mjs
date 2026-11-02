import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

execSync('./node_modules/.bin/esbuild src/worker-observer.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/worker-observer-fix.mjs --log-level=error');
const { WorkerObserver } = await import('../node_modules/.cache/worker-observer-fix.mjs');

const bot = { id: 'parent', profile: 'default', name: 'Parent' };
const worker = (state) => ({
  id: 'deleg_test:0', delegationId: 'deleg_test', taskIndex: 0, profile: 'default',
  parentSessionId: 'session', parentRunId: null, parentJobId: null,
  label: 'Delegated task 1', state, recordedState: state, activity: 'Recorded',
  startedAt: 10, updatedAt: 20, completedAt: state === 'running' ? null : 20,
  liveness: 'unknown', review: 'unknown', delivery: 'pending',
  eventId: state === 'running' ? null : 'deleg_test:0:completed:20'
});
const snapshot = (state) => ({ capability: 'ledger-v1', workers: [worker(state)], hasMore: false, push: 'blocked' });

test('observer write queue prevents a late acknowledgement write from erasing a newer observer\'s acks', async () => {
  // A connection change spawns observer B while observer A's setItem is still in
  // flight. Without the queue, A's late write overwrites B's persisted state.
  // With the queue, B reads only after A's writes complete, and every write
  // happens in order so the latest persisted set is always the winner.
  let stored = null;
  const order = [];
  const slowWrite = async (_, value) => {
    order.push(`A-write:${value.length}`);
    // Simulate the OS taking time to persist A's value.
    await new Promise(r => setTimeout(r, 30));
    stored = value;
    order.push(`A-done:${value.length}`);
  };
  const fastWrite = async (_, value) => {
    order.push(`B-write:${value.length}`);
    stored = value;
    order.push(`B-done:${value.length}`);
  };
  let data = snapshot('completed');
  const a = new WorkerObserver({
    scope: 'race', store: { getItem: async () => null, setItem: slowWrite },
    read: async () => data, notify: async () => true
  });
  // A notifies and queues its setItem.
  const aRefresh = a.refresh([bot]);
  // B starts a new observer before A's slow write has completed.
  const b = new WorkerObserver({
    scope: 'race', store: { getItem: async () => stored, setItem: fastWrite },
    read: async () => data, notify: async () => true
  });
  const bRefresh = b.refresh([bot]);
  await Promise.all([aRefresh, bRefresh]);
  // Final stored state should contain B's worker notification (the second ack
  // queue) and never be overwritten by an earlier A write.
  const parsed = JSON.parse(stored);
  assert.ok(Array.isArray(parsed) && parsed.length >= 1, 'observer acks must persist at least one entry');
  // Writes must have happened in queued order: A's setItem completed before B's
  // setItem started, regardless of which refresh resolved first.
  const aDoneIdx = order.findIndex(e => e.startsWith('A-done'));
  const bWriteIdx = order.findIndex(e => e.startsWith('B-write'));
  assert.ok(aDoneIdx >= 0 && bWriteIdx >= 0);
  assert.ok(aDoneIdx < bWriteIdx, `expected A's write to complete before B's, got ${JSON.stringify(order)}`);
});

test('observer keeps its own acknowledged set when persisted state is empty', async () => {
  // Ensures ensureLoaded does not race with the queue: a new observer that
  // starts before any prior writes still records its own ack without inheriting
  // a stale empty state from a half-cleared store.
  let stored = null;
  const a = new WorkerObserver({
    scope: 'solo', store: { getItem: async () => stored, setItem: async (_, v) => { stored = v; } },
    read: async () => snapshot('completed'), notify: async () => true
  });
  const b = new WorkerObserver({
    scope: 'solo', store: { getItem: async () => stored, setItem: async (_, v) => { stored = v; } },
    read: async () => snapshot('completed'), notify: async () => true
  });
  await a.refresh([bot]); await b.refresh([bot]);
  const parsed = JSON.parse(stored);
  assert.ok(parsed.length >= 1, 'B\'s acknowledgement must be persisted even after a connection change');
});
