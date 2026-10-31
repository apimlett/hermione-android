import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('POC voice cannot silently use an external Android recognition service',()=>{
 for(const f of ['../src/ui/dictation.ts','../app/call/[botId].tsx']){
  const s=readFileSync(new URL(f,import.meta.url),'utf8');
  assert.ok(!s.includes('ExpoSpeechRecognitionModule.start'),f+' must not start speech recognition in this MVP');
  assert.match(s,/disabled|not included/i);
 }
});
