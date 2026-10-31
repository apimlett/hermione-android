import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const appConfig=createRequire(import.meta.url)('../app.config.js');
const app=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8')).expo;
test('POC has its own Android identity and version',()=>{
 assert.equal(app.name,'Hermione POC');
 assert.equal(app.android.package,'com.example.hermione.poc');
 assert.equal(app.version,'0.1.1');
 assert.equal(app.android.versionCode,2);
});
test('Android application ID can be overridden locally',()=>{
 const saved=process.env.HERMIONE_ANDROID_PACKAGE;
 try {
  delete process.env.HERMIONE_ANDROID_PACKAGE;
  assert.equal(appConfig({config:app}).android.package,'com.example.hermione.poc');
  process.env.HERMIONE_ANDROID_PACKAGE='org.example.custom';
  assert.equal(appConfig({config:app}).android.package,'org.example.custom');
  assert.equal(appConfig({config:app}).name,'Hermione POC');
 } finally { if (saved===undefined) delete process.env.HERMIONE_ANDROID_PACKAGE; else process.env.HERMIONE_ANDROID_PACKAGE=saved; }
});
test('POC is not linked to the upstream maintainer cloud build project',()=>{
 assert.equal(app.owner,undefined);
 assert.equal(app.extra?.eas?.projectId,undefined);
 assert.equal(app.updates?.enabled,false);
});
