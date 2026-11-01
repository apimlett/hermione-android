import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
function notifications({ allowed = true, permitted = true, fails = false } = {}) {
  const calls = [];
  const code = ts.transpileModule(readFileSync(new URL('../src/notify.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const native = { AppState: { currentState: 'active' }, Platform: { OS: 'android' } };
  const expo = { AndroidImportance: { HIGH: 4 }, setNotificationHandler() {}, setNotificationChannelAsync: async () => {}, setNotificationCategoryAsync: async () => {}, getPermissionsAsync: async () => ({ granted: permitted }), scheduleNotificationAsync: async value => { if (fails) throw Error('synthetic failure'); calls.push(value); } };
  const mocks = { 'react-native': native, 'expo-notifications': expo, './prefs': { getPrefs: () => ({ hidePreviews: false }), shouldNotify: () => allowed } };
  new Function('require', 'module', 'exports', code)(id => mocks[id] ?? {}, module, module.exports);
  return { ...module.exports, calls };
}
test('worker completion notification is safe, uniquely identified, linked to Activity, and never approval-capable', async () => {
  const n = notifications();
  assert.equal(typeof n.notifyWorker, 'function');
  assert.equal(await n.notifyWorker({ id: 'b', name: 'Parent' }, { id: 'd:0', taskIndex: 0, state: 'completed', eventId: 'd:0:completed:20', label: 'SECRET', activity: 'SECRET' }), true);
  assert.equal(n.calls.length, 1);
  const sent = n.calls[0];
  assert.doesNotMatch(JSON.stringify(sent), /SECRET/);
  assert.equal(sent.content.data.workerId, 'd:0');
  assert.equal(sent.content.data.botId, 'b');
  assert.equal(sent.content.categoryIdentifier, undefined);
  assert.match(sent.identifier, /worker/);
});
test('muted, permission denied or scheduling failure never acknowledges worker notification', async () => {
  for (const config of [{ allowed: false }, { permitted: false }, { fails: true }]) {
    const n = notifications(config);
    assert.equal(typeof n.notifyWorker, 'function');
    assert.equal(await n.notifyWorker({ id: 'b', name: 'Parent' }, { id: 'd:0', taskIndex: 0, state: 'failed', eventId: 'event' }), false);
    assert.equal(n.calls.length, 0);
  }
});
