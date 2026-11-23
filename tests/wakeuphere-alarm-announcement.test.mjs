import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup({voices=[{lang:'zh-TW'}],missing=false,throws=false}={}) {
 let now=0,id=0,rings=0,stops=0,cancels=0;const timers=new Map(),spoken=[];
 const speech={getVoices:()=>voices,cancel:()=>cancels++,speak:u=>{if(throws)throw Error('blocked');spoken.push(u);}};
 const win={speechSynthesis:missing?null:speech,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}};
 const ctx=vm.createContext({window:win});vm.runInContext(fs.readFileSync(new URL('../public/wakeuphere/alarm-announcement.js',import.meta.url),'utf8'),ctx);
 const player=win.WakeupHereAnnouncement.create({speech:win.speechSynthesis,Utterance:win.SpeechSynthesisUtterance,startRinging:()=>rings++,stopRinging:()=>stops++,setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:i=>timers.delete(i)});
 function advance(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,x])=>x.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
 return {player,spoken,advance,rings:()=>rings,stops:()=>stops,cancels:()=>cancels};
}
test('speaks twice, waits 3 seconds after first ends, then rings',()=>{const p=setup();p.player.start('美國','安克拉治');assert.equal(p.spoken[0].text,'美國的安克拉治到了');assert.equal(p.rings(),0);p.spoken[0].onstart();p.advance(2000);p.spoken[0].onend();p.advance(2999);assert.equal(p.spoken.length,1);p.advance(1);assert.equal(p.spoken.length,2);assert.equal(p.spoken[1].text,p.spoken[0].text);p.spoken[1].onend();assert.equal(p.rings(),1);p.advance(30000);assert.equal(p.rings(),1);});
for(const options of [{missing:true},{voices:[]},{voices:[{lang:'en-US'}]},{throws:true}])test(`fallback ${JSON.stringify(options)}`,()=>{const p=setup(options);p.player.start('日本','東京');assert.equal(p.rings(),1);});
test('speech errors and stalled start/end fall back once',()=>{for(const mode of ['error','start','end']){const p=setup();p.player.start('日本','東京');if(mode==='error')p.spoken[0].onerror();else if(mode==='start')p.advance(3000);else{p.spoken[0].onstart();p.advance(15000);}assert.equal(p.rings(),1);p.spoken[0].onend();p.advance(30000);assert.equal(p.rings(),1);}});
test('stop during speech or gap cancels all future speech and ringing',()=>{for(const gap of [false,true]){const p=setup();p.player.start('日本','東京');const u=p.spoken[0];if(gap)u.onend();p.player.stop();u.onend();u.onerror();p.advance(60000);assert.equal(p.spoken.length,1);assert.equal(p.rings(),0);assert.equal(p.stops(),1);}});
test('new run ignores callbacks from old run and supports stop after fallback',()=>{const p=setup();p.player.start('日本','東京');const old=p.spoken[0];p.player.start('台灣','台北');old.onend();old.onerror();assert.equal(p.spoken.length,2);p.spoken[1].onerror();assert.equal(p.rings(),1);p.player.stop();p.advance(60000);assert.equal(p.rings(),1);assert.equal(p.stops(),1);});
