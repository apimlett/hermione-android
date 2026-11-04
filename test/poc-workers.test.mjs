import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';

execSync('./node_modules/.bin/esbuild src/live-backend.ts --bundle --platform=node --format=esm --alias:expo/fetch=./test/fetch-shim.mjs --alias:react-native=./test/native-storage-shim.mjs --alias:expo-secure-store=./test/native-storage-shim.mjs --outfile=node_modules/.cache/workers-live.mjs --log-level=error');
const { LiveBackend } = await import('../node_modules/.cache/workers-live.mjs');
const SRC = process.env.HERMES_BRIDGE_SRC;
const skip = !SRC || !existsSync(`${SRC}/src/hermes_bridge/workers.py`);

test('real feature bridge: child still running after parent ends, later completion recovered on a new client', { skip }, async () => {
  const process = spawn('python3', ['test/workers_stack.py'], { env: { ...globalThis.process.env, HERMES_BRIDGE_SRC: SRC }, stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = createInterface({ input: process.stdout });
  const next = () => new Promise((resolve) => lines.once('line', resolve));
  const { url, key } = JSON.parse(await next());
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (target, init) => {
    calls.push([target, init.headers.Authorization]);
    return original(url + new URL(target).pathname.replace(/^\/bridge/, ''), init);
  };
  try {
    const cfg = { baseUrl: 'https://example.ts.net', apiKey: 'not-for-bridge', bridgeKey: key, cfClientId: '', cfClientSecret: '' };
    const bot = { id: 'default', profile: 'default', name: 'Parent' };
    const be = new LiveBackend(cfg);
    execSync('./node_modules/.bin/esbuild src/worker-observer.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/workers-integration.mjs --log-level=error');
    const { WorkerObserver } = await import('../node_modules/.cache/workers-integration.mjs');
    const saved = new Map(); const notifications = [];
    const options = { scope: cfg.baseUrl, store: { getItem: async k => saved.get(k) ?? null, setItem: async (k, v) => { saved.set(k, v); } }, read: b => be.listWorkers(b), notify: async (_, w) => { notifications.push(w.id); return true; } };
    const observer = new WorkerObserver(options);
    assert.equal(typeof be.listWorkers, 'function', 'independent child-status client is missing');
    const active = await be.listWorkers(bot);
    assert.equal(active.workers[0].state, 'running');
    assert.equal(active.workers[0].parentSessionId, 'parent-session');
    await observer.refresh([bot]);
    assert.equal(observer.get('default').workers[0].state, 'running');
    assert.equal(notifications.length, 0);
    const ready = next(); process.stdin.write('complete\n'); await ready;
    const terminal = await new LiveBackend(cfg).listWorkers(bot);
    assert.equal(terminal.workers[0].state, 'completed');
    assert.equal(terminal.workers[0].review, 'unknown');
    assert.ok(terminal.workers[0].eventId);
    assert.doesNotMatch(JSON.stringify(terminal), /PRIVATE/);
    assert.ok(calls.every(([, auth]) => auth === `Bearer ${key}`));
    assert.deepEqual(await be.listWorkers(bot), terminal);
    await observer.refresh([bot]);
    await new WorkerObserver(options).refresh([bot]);
    assert.deepEqual(notifications, ['deleg_fixture:0'], 'one scheduling across status replay and reopened observer');
  } finally { globalThis.fetch = original; process.stdin.end(); process.kill(); lines.close(); }
});
