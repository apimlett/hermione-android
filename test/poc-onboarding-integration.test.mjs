import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

// Execute the real TS modules with isolated platform/storage/UI adapters. No device data or network.
function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}
const policy = load('src/poc-policy.ts');
const valid = { baseUrl: 'https://hermes.example.ts.net:8443', apiKey: 'synthetic-test-only', cfClientId: '', cfClientSecret: '', bridgeUrl: '', bridgeKey: '' };
const unsafe = [
  { ...valid, baseUrl: 'http://hermes.example.ts.net' },
  { ...valid, baseUrl: 'https://example.com' },
  { ...valid, baseUrl: 'https://user:pass@hermes.example.ts.net' },
  { ...valid, baseUrl: 'https://hermes.example.ts.net?secret=x' },
  { ...valid, baseUrl: '' },
  { ...valid, apiKey: '   ' },
  { ...valid, bridgeUrl: 'http://hermes.example.ts.net', bridgeKey: 'synthetic-bridge' },
  { ...valid, bridgeUrl: 'https://user:pass@hermes.example.ts.net', bridgeKey: 'synthetic-bridge' },
  { ...valid, bridgeUrl: 'https://hermes.example.ts.net/bridge#fragment', bridgeKey: 'synthetic-bridge' },
  { ...valid, bridgeUrl: 'https://other.ts.net', bridgeKey: 'synthetic-bridge' },
];
function configModule(storage) {
  return load('src/config.ts', { './secure': storage, './poc-policy': policy });
}

test('unsafe configs are rejected before any config write and invalid loaded config returns null', async () => {
  for (const cfg of unsafe) {
    const writes = [];
    const mod = configModule({ getItem: async (key) => cfg[key.slice('hermes.'.length)] ?? null, setItem: async (...args) => writes.push(args) });
    await assert.rejects(() => mod.saveConfig(cfg));
    assert.deepEqual(writes, []);
    assert.equal(await mod.loadConfig(), null);
  }
});

test('valid native config saves and loads, and bridge remains opt-in', async () => {
  const values = new Map();
  const mod = configModule({ getItem: async (k) => values.get(k), setItem: async (k, v) => values.set(k, v) });
  await mod.saveConfig(valid);
  assert.deepEqual(await mod.loadConfig(), valid);
  assert.equal(mod.bridgeTarget(valid), null);
});

function secureModule(os, values = new Map()) {
  const writes = [];
  const native = { getItemAsync: async (k) => values.get(k) ?? null, setItemAsync: async (...args) => writes.push(args), deleteItemAsync: async (k) => values.delete(k) };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => { writes.push([k, v]); values.set(k, v); }, removeItem: (k) => values.delete(k) } });
  return { mod: load('src/secure.ts', { 'expo-secure-store': native, 'react-native': { Platform: { OS: os } } }), writes, restore: () => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage };
}

test('web fails closed for connection config, including legacy stored credentials, but keeps demo state', async () => {
  const keys = ['baseUrl', 'apiKey', 'cfClientId', 'cfClientSecret', 'bridgeUrl', 'bridgeKey'].map((k) => `hermes.${k}`);
  const { mod, writes, restore } = secureModule('web', new Map(keys.map((k) => [k, 'synthetic-legacy-value'])));
  try {
    for (const key of keys) {
      await assert.rejects(() => mod.setItem(key, 'synthetic-secret'), /demo.only|native|Android/i);
      assert.equal(await mod.getItem(key), null);
    }
    assert.deepEqual(writes, []);
    await assert.rejects(() => configModule(mod).saveConfig(valid), /demo.only|native|Android/i);
    assert.deepEqual(writes, []);
    assert.equal(await configModule(mod).loadConfig(), null);
    for (const key of ['hermes.demo', 'hermes.prefs.v1', 'hermes.primary.demo', 'hermes.roster', 'hermes.look.sample', 'hermes.draft.sample']) {
      const value = key === 'hermes.roster' ? JSON.stringify([{ id: 'sample-bot' }]) : 'sample';
      await mod.setItem(key, value);
      assert.equal(await mod.getItem(key), value);
      await mod.deleteItem(key);
      assert.equal(await mod.getItem(key), null);
    }
  } finally { restore(); }
});

test('native secure writes still use SecureStore unchanged', async () => {
  const { mod, writes, restore } = secureModule('android');
  try {
    await mod.setItem('hermes.apiKey', 'synthetic-native');
    assert.deepEqual(writes, [['hermes.apiKey', 'synthetic-native']]);
  } finally { restore(); }
});

test('web blocks profile API keys in a live roster but preserves harmless sample bots', async () => {
  const secretRoster = JSON.stringify([{ id: 'sample-profile', apiKey: 'synthetic-profile-secret' }]);
  const safeRoster = JSON.stringify([{ id: 'sample-profile', name: 'Sample bot' }]);
  const { mod, writes, restore } = secureModule('web', new Map([['hermes.roster', secretRoster]]));
  try {
    assert.equal(await mod.getItem('hermes.roster'), null);
    await assert.rejects(() => mod.setItem('hermes.roster', secretRoster), /demo.only|native|Android/i);
    assert.deepEqual(writes, []);
    await mod.setItem('hermes.roster', safeRoster);
    assert.equal(await mod.getItem('hermes.roster'), safeRoster);
  } finally { restore(); }
});

function settings(cfg, os = 'android') {
  const calls = [], statuses = [];
  let stateIndex = 0;
  const jsx = (type, props) => ({ type, props });
  const { mod: secure, restore } = secureModule(os);
  const component = load('app/settings.tsx', {
    'expo-router': { router: { replace: () => calls.push('navigate'), back() {} } },
    'lucide-react-native': { ChevronDown: 'ChevronDown', ChevronRight: 'ChevronRight', X: 'X' },
    react: { useState: (initial) => { const i = stateIndex++; return [i === 3 ? true : initial, (value) => { if (i === 1) statuses.push(value); }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { KeyboardAvoidingView: 'KeyboardAvoidingView', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View', Platform: { OS: os } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../src/bridge': { BridgeClient: class { async status() { calls.push('bridge-request'); return { ok: true }; } } },
    '../src/config': configModule(secure),
    '../src/poc-policy': policy,
    '../src/secure': secure,
    '../src/hermes': { HermesClient: class { async capabilities() { calls.push('api-request'); } } },
    '../src/app-state': { useApp: () => ({ config: cfg, save: async () => calls.push('save'), demo: false, setDemo: async () => {} }) },
    '../src/ui/logo': { Logo: 'Logo' },
    '../src/ui/theme': { colors: {}, font: {}, radii: {}, type: {} },
  }).default;
  const tree = component();
  const nodes = [];
  function visit(n) { if (!n || typeof n !== 'object') return; nodes.push(n); for (const child of [n.props?.children].flat(Infinity)) visit(child); }
  visit(tree);
  return { calls, statuses, restore, nodes, testAndSave: nodes.find((n) => n.type === 'Pressable' && n.props.disabled !== undefined).props.onPress, saveOnly: nodes.find((n) => n.props?.accessibilityLabel === 'Save without testing').props.onPress };
}

test('both settings actions block unsafe settings before requests, save, or navigation', async () => {
  for (const cfg of unsafe) {
    for (const action of ['testAndSave', 'saveOnly']) {
      const ui = settings(cfg);
      try {
        await ui[action]();
        assert.deepEqual(ui.calls, [], action);
        assert.ok(ui.statuses.some((s) => s?.ok === false && s.text));
      } finally { ui.restore(); }
    }
  }
});

test('web live connection attempts fail before network or save with an understandable demo-only message', async () => {
  for (const action of ['testAndSave', 'saveOnly']) {
    const ui = settings(valid, 'web');
    try {
      await ui[action]();
      assert.deepEqual(ui.calls, []);
      assert.ok(ui.statuses.some((s) => /demo.only|native|Android/i.test(s?.text ?? '')));
    } finally { ui.restore(); }
  }
});

test('valid native settings test and save without contacting a disabled bridge', async () => {
  const ui = settings(valid);
  try {
    await ui.testAndSave();
    assert.deepEqual(ui.calls, ['api-request', 'save', 'navigate']);
  } finally { ui.restore(); }
  const saveUi = settings(valid);
  try {
    await saveUi.saveOnly();
    assert.deepEqual(saveUi.calls, ['save', 'navigate']);
  } finally { saveUi.restore(); }
});

test('onboarding starts empty, identifies the server and offline samples, and prevents web credential entry', () => {
  for (const os of ['android', 'web']) {
    const ui = settings(null, os);
    try {
      const inputs = ui.nodes.filter((n) => n.type === 'TextInput');
      assert.ok(inputs.every((n) => !n.props.value));
      if (os === 'web') assert.ok(inputs.every((n) => n.props.editable === false));
      const copy = ui.nodes.filter((n) => n.type === 'Text').flatMap((n) => [n.props.children].flat(Infinity)).filter((n) => typeof n === 'string').join(' ');
      for (const phrase of ['Hermione POC', 'Tailscale Serve', 'NOT the existing webapp login/password', 'Offline sample demo', 'Disabled by default', 'cloud LLM calls remain possible']) assert.ok(copy.includes(phrase), phrase);
    } finally { ui.restore(); }
  }
});
