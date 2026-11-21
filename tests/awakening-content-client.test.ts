import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureAwakeningContent} from '../src/services/awakeningContent';

test('opening the same actual awakening deduplicates in-flight content work and uses the existing two-stage pipeline',async()=>{
 const calls:any[]=[];let release!:()=>void;const gate=new Promise<void>(r=>release=r);let textReady=0;
 const fetcher=(async(url:any,options:any)=>{calls.push({url,body:JSON.parse(options.body)});await gate;return Response.json(calls.length===1?{ok:true,imageJob:{pageId:'a',city:'Muscat',awakeningRecord:true}}:{ok:true,imageUrl:'https://fixture.invalid/a.png'});}) as typeof fetch;
 const a=ensureAwakeningContent('a',{fetcher,onTextReady:async()=>{textReady++;}});
 const b=ensureAwakeningContent('a',{fetcher});assert.equal(a,b);release();await a;
 assert.equal(calls.length,2);assert.deepEqual(calls[0].body,{action:'complete-awakening',pageId:'a'});assert.equal(calls[1].url,'/api/wake-up-image');assert.equal(calls[1].body.city,'Muscat');assert.equal(textReady,1);
});
test('an image failure allows retry of the same page while completed records do not regenerate images',async()=>{
 let attempts=0;
 const fetcher=(async(url:any)=>{
  attempts++;if(url==='/api/wake-up-image')return Response.json({error:'image unavailable'},{status:503});
  return Response.json({ok:true,imageJob:{pageId:'retry'}});
 }) as typeof fetch;
 await assert.rejects(ensureAwakeningContent('retry',{fetcher}),/image unavailable/);
 await assert.rejects(ensureAwakeningContent('retry',{fetcher}),/image unavailable/);assert.equal(attempts,4);
 let calls=0;await ensureAwakeningContent('done',{fetcher:(async()=>{calls++;return Response.json({ok:true,complete:true});}) as typeof fetch});assert.equal(calls,1);
});
