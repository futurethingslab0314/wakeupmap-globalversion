import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function factory(){const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../public/wakeuphere/booking-client.js',import.meta.url),'utf8'),ctx);return ctx.createWakeupHereContentQueue;}
test('saves a content job before sending and deduplicates pending and completed work',async()=>{
 let saved=[],release;const sent=[];const create=factory();
 const queue=create({read:()=>saved,write:jobs=>saved=JSON.parse(JSON.stringify(jobs)),send:async job=>{assert(saved.some(row=>row.pageId===job.pageId));sent.push(job.pageId);await new Promise(resolve=>release=resolve);}});
 const first=queue.enqueue({pageId:'wake-1'});queue.enqueue({pageId:'wake-1'});
 assert.deepEqual(sent,['wake-1']);assert.equal(queue.isBusy(),true);release();assert.equal(await first,true);
 assert.equal(saved.length,0);await queue.enqueue({pageId:'wake-1'});assert.deepEqual(sent,['wake-1']);assert.equal(queue.isBusy(),false);
});
test('failed content persists across reload but does not block another content job',async()=>{
 let saved=[],fail=true;const sent=[];const create=factory();
 const options={read:()=>saved,write:jobs=>saved=JSON.parse(JSON.stringify(jobs)),send:async job=>{sent.push(job.pageId);if(fail&&job.pageId==='old')throw Error('offline');}};
 const queue=create(options);assert.equal(await queue.enqueue({pageId:'old'}),false);
 await queue.enqueue({pageId:'new'});assert(saved.some(job=>job.pageId==='old'));assert(!saved.some(job=>job.pageId==='new'));assert(sent.includes('new'));
 fail=false;assert.equal(await create(options).flush(),true);assert.equal(saved.length,0);
});
test('ignores malformed or duplicate restored jobs',async()=>{
 const sent=[];const queue=factory()({read:()=>[null,{}, {pageId:42},{pageId:'a'},{pageId:'a'}],write:()=>{},send:async job=>sent.push(job.pageId)});
 await queue.flush();assert.deepEqual(sent,['a']);
});
