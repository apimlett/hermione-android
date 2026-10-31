import {test} from 'node:test';
import assert from 'node:assert/strict';
let policy={};
try {policy=await import('../src/poc-policy.ts');} catch(e) {if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const cfg=(baseUrl,bridgeUrl='')=>({baseUrl,bridgeUrl});
test('private connection policy rejects plaintext before any request',()=>{
 assert.equal(typeof policy.validatePocConnection,'function','Missing private connection policy');
 assert.match(policy.validatePocConnection(cfg('http://hermes.example.ts.net:8443')),/HTTPS/i);
});
test('private connection policy accepts tailnet HTTPS',()=>{
 assert.equal(typeof policy.validatePocConnection,'function');
 assert.equal(policy.validatePocConnection(cfg('https://hermes.example.ts.net:8443')),null);
});
test('private connection policy rejects public hosts and URL-embedded credentials',()=>{
 assert.equal(typeof policy.validatePocConnection,'function');
 assert.match(policy.validatePocConnection(cfg('https://example.com')),/Tailscale/i);
 assert.match(policy.validatePocConnection(cfg('https://u:p@hermes.example.ts.net')),/credentials/i);
});
test('private connection policy keeps bridge credentials on the selected host',()=>{
 assert.equal(typeof policy.validatePocConnection,'function');
 assert.equal(policy.validatePocConnection(cfg('https://hermes.example.ts.net:8443','https://hermes.example.ts.net:8444')),null);
 assert.match(policy.validatePocConnection(cfg('https://hermes.example.ts.net:8443','https://other.ts.net')),/same host/i);
});
test('private connection policy rejects fragments and query strings',()=>{
 assert.equal(typeof policy.validatePocConnection,'function');
 assert.match(policy.validatePocConnection(cfg('https://hermes.example.ts.net?key=wrong')),/query|fragment/i);
});
