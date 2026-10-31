import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
execFileSync('./node_modules/.bin/esbuild', ['src/live-backend.ts', '--bundle', '--platform=node', '--format=esm', '--alias:expo/fetch=./test/fetch-shim.mjs', '--alias:react-native=./test/native-storage-shim.mjs', '--alias:expo-secure-store=./test/native-storage-shim.mjs', '--outfile=node_modules/.cache/hm-live/poc-mobile-profiles.js', '--log-level=error']);
const live = await import('../node_modules/.cache/hm-live/poc-mobile-profiles.js');
test('new mobile bot profile ids cannot address a non-mobile profile', () => {
  assert.equal(typeof live.mobileProfileIdFrom, 'function', 'mobile profile naming policy is missing');
  assert.equal(live.mobileProfileIdFrom('Research'), 'mobile-research');
  assert.equal(live.mobileProfileIdFrom('default'), 'mobile-default');
  assert.equal(live.mobileProfileIdFrom('mobile-chef'), 'mobile-chef');
  assert.equal(live.mobileProfileIdFrom('???'), '');
  const long = live.mobileProfileIdFrom('x'.repeat(80));
  assert.match(long, /^mobile-[a-z0-9_-]+$/);
  assert.ok(long.length <= 64);
});
test('creation screen previews the same mobile-prefixed id used by creation', () => {
  const source = readFileSync(new URL('../app/new-bot.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ mobileProfileIdFrom \}/);
  assert.match(source, /mobileProfileIdFrom\(b\.profile \|\| b\.name\)/);
});
test('create bot sends only a mobile-prefixed profile name to management', async () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/v1/profiles') && init.method === 'POST') {
      const body = JSON.parse(init.body);
      sent.push(body);
      return new Response(JSON.stringify({ profile: { id: body.name }, api_key: 'fixture-mobile-api-key-0123456789' }), { status: 201 });
    }
    if (u.pathname.endsWith('/toolsets')) return new Response(JSON.stringify({ toolsets: [] }), { status: 200 });
    throw new Error('Unexpected test request: ' + u.pathname);
  };
  try {
    const backend = new live.LiveBackend({ baseUrl: 'https://hermes.example.ts.net:8444', apiKey: 'fixture-main-api-key-0123456789', bridgeKey: 'fixture-management-key-0123456789', cfClientId: '', cfClientSecret: '' });
    const bot = await backend.createBot({ name: 'Research', emoji: '🔎', color: '#123', description: 'Research helper', toolsets: [] });
    assert.equal(sent[0].name, 'mobile-research');
    assert.equal(bot.profile, 'mobile-research');
    assert.equal(bot.name, 'Research');
  } finally { globalThis.fetch = originalFetch; }
});
