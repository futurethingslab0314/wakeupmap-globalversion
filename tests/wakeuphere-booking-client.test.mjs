import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function factory() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../public/wakeuphere/booking-client.js', import.meta.url), 'utf8'), context);
  return context.createWakeupHereBookingQueue;
}
test('serializes reserve, cancel and move; reads can wait for the complete write queue', async () => {
  let release; const sent=[];
  const queue = factory()({ read:()=>[],write:()=>{},send: async payload => {
    sent.push(payload.action); if(sent.length===1)await new Promise(resolve=>release=resolve);
  }});
  const first=queue.enqueue({action:'reserve'});
  queue.enqueue({action:'cancel'}); queue.enqueue({action:'reserve'});
  assert.deepEqual(sent,['reserve']); release();
  assert.equal(await first,true); assert.deepEqual(sent,['reserve','cancel','reserve']);
  assert.equal(await queue.flush(),true);
});
test('failed cancellations persist and retry in order on the next page load', async () => {
  let saved=[],fail=true;const sent=[];
  const create=factory();
  const options={read:()=>saved,write:items=>saved=JSON.parse(JSON.stringify(items)),send:async payload=>{
    if(fail)throw Error('offline');sent.push(payload.action);
  }};
  const queue=create(options);assert.equal(await queue.enqueue({action:'cancel'}),false);
  assert.equal(saved.length,1); fail=false;
  const restored=create(options);await restored.enqueue({action:'reserve'});
  assert.deepEqual(sent,['cancel','reserve']);assert.equal(saved.length,0);
});
test('malformed stored data is ignored; callbacks cannot break syncing', async () => {
  const queue=factory()({read:()=>null,write:()=>{throw Error('storage unavailable')},
    send:async()=>{},onState:()=>{throw Error('view unavailable')}});
  assert.equal(await queue.enqueue({action:'reserve'}),true);
});
