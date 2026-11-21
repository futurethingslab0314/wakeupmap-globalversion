import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/wakeuphere/index.html', import.meta.url), 'utf8');
const main = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(source => source.includes('class SoundService'));

async function page(storage = new Map(), time = Date.parse('2026-11-16T16:59:59Z'), options = {}) {
  let now = time, starts = 0, stops = 0;
  const elements = new Map(), timers = new Map(), handlers = new Map(); let timerId = 0;
  function element(id) {
    if (!elements.has(id)) {
      const node = { textContent: '', children: [], style: { setProperty() {} },
        classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {},
        appendChild(child) { this.children.push(child); }, offsetWidth: 600 };
      Object.defineProperty(node,'innerHTML',{ get() {return ''}, set() {this.children=[];} });
      elements.set(id,node);
    }
    return elements.get(id);
  }
  const marker = () => ({ addTo() { return this; }, remove() {}, on() {} });
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const ctx = vm.createContext({ Intl, Date: Clock, URL, AbortSignal,
    console: { log() {}, warn() {}, error(...args) { throw new Error(args.join(' ')); } },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    document: { getElementById: element, addEventListener() {}, querySelector:()=>null, createElement: () => element(Symbol()) },
    window: { addEventListener(name,fn) { if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn); }, location: { href: 'https://example.test/wakeuphere/' },
      CITIES_DATA: [{ city: 'Anchorage', city_zh: '安克拉治', country: 'United States', country_zh: '美國',
        timezone: 'America/Anchorage', latitude: 61.2, longitude: -149.9 }] },
    L: { divIcon: opts => opts, marker },
    fetch: options.fetch ?? (async () => ({ ok: true, json: async () => ({ ok: true, users: [] }) })),
    setTimeout: () => 1,
    setInterval: (fn, ms) => { timers.set(++timerId, {fn,ms}); return timerId; },
    clearInterval: id => timers.delete(id),
    countStart: () => starts++, countStop: () => stops++,
  });
  vm.runInContext(fs.readFileSync(new URL('../public/wakeuphere/alarm-scheduler.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(new URL('../public/wakeuphere/booking-client.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(main, ctx);
  vm.runInContext(`sound.playClick = () => {}; sound.playSuccess = () => {};
    sound.startAlarmRinging = countStart; sound.stopAlarmRinging = countStop;
    map = { setView() {}, setZoom() {}, panTo() {}, invalidateSize() {} };`, ctx);
  await vm.runInContext('loadDatabaseLocations()', ctx);
  return { ctx, storage, elements, timers, handlers, run: code => vm.runInContext(code,ctx),
    time: value => now = Date.parse(value), starts: () => starts, stops: () => stops };
}

test('real page arms at city selection, rings at local 08:00 and joystick Space dismisses', async () => {
  const p = await page();
  p.run('setStage(3)'); assert.equal(p.starts(), 0);
  assert(p.elements.get('alarm-schedule-label').textContent.includes('08:00'));
  assert.equal(JSON.parse(p.storage.get('wakeuphere.dailyAlarm')).schedule.nextAt, Date.parse('2026-11-16T17:00:00Z'));
  p.time('2026-11-16T17:00:00Z'); p.run('pollDailyAlarm()'); assert.equal(p.starts(),1);
  p.run('pollDailyAlarm()'); assert.equal(p.starts(),1);
  p.run('handleAlarmStageSpaceKey()'); assert.equal(p.stops(),1);
  assert.equal(p.run('isAlarmRinging'), false);
  assert.equal(JSON.parse(p.storage.get('wakeuphere.dailyAlarm')).schedule.pendingAt, null);
  const restored = await page(p.storage, Date.parse('2026-11-16T17:01:00Z'));
  assert.equal(restored.run('restoreSelectionAfterUpdate()'),true);
  assert.equal(restored.starts(),0);
  restored.time('2026-11-17T17:00:00Z'); restored.run('pollDailyAlarm()'); assert.equal(restored.starts(),1);
});

test('restart restores an unacknowledged ringing alarm; reset cancels it', async () => {
  const p = await page(); p.run('setStage(3)');
  p.time('2026-11-16T17:00:00Z'); p.run('pollDailyAlarm()');
  const restored = await page(p.storage, Date.parse('2026-11-16T17:02:00Z'));
  assert.equal(restored.run('restoreSelectionAfterUpdate()'),true);
  assert.equal(restored.starts(),1);
  restored.run('resetAlarm()');
  assert.equal(restored.storage.has('wakeuphere.dailyAlarm'), false);
  assert.equal(restored.run('dailyAlarm'), null);
  restored.time('2026-11-17T17:00:00Z'); restored.run('pollDailyAlarm()'); assert.equal(restored.starts(),1);
});

test('manual demo does not consume or cancel the scheduled alarm', async () => {
  const p = await page(); p.run('setStage(3); triggerAlarmSimulation()');
  assert.equal(p.starts(),1);
  p.run('handleAlarmStageSpaceKey()');
  assert.equal(p.run('dailyAlarm.snapshot().nextAt'),Date.parse('2026-11-16T17:00:00Z'));
  p.time('2026-11-16T17:00:00Z'); p.run('pollDailyAlarm()'); assert.equal(p.starts(),2);
});

test('choosing after 08:00 does not immediately fire; changing user does not inherit an alarm', async () => {
  const p = await page(new Map(), Date.parse('2026-11-16T18:00:00Z'));
  p.run('setStage(3)');
  assert.equal(p.starts(),0);
  assert.equal(p.run('dailyAlarm.snapshot().nextAt'), Date.parse('2026-11-17T17:00:00Z'));
  p.storage.set('wakeuphere.userName','OTHER');
  const restored = await page(p.storage, Date.parse('2026-11-16T18:01:00Z'));
  assert.equal(restored.run('restoreSelectionAfterUpdate()'), false);
  assert.equal(restored.starts(),0);
});

const settle = () => new Promise(resolve => setImmediate(resolve));
test('roster waits for reservation write and cancellation captures the old location', async () => {
  let release; const events=[], payloads=[];
  const p=await page(new Map(),Date.parse('2026-11-16T16:59:59Z'),{fetch:async(url,opts)=>{
    if(opts.method==='POST'){
      const payload=JSON.parse(opts.body);payloads.push(payload);events.push(payload.action);
      if(payloads.length===1)await new Promise(resolve=>release=resolve);
      events.push('written');return {ok:true,json:async()=>({ok:true})};
    }
    events.push('GET');return {ok:true,json:async()=>({users:['Bob']})};
  }});
  p.run('setStage(3)');assert.deepEqual(events,['reserve']);release();
  await p.run('getBookingQueue().flush()');await settle();
  assert(events.indexOf('GET')>events.indexOf('written'));
  p.run('resetAlarm()');await p.run('getBookingQueue().flush()');
  assert.equal(payloads.at(-1).action,'cancel');assert.equal(payloads.at(-1).setup_city,'Anchorage');
});

test('a delayed old-city response cannot replace the new-city roster', async () => {
  let release;const p=await page(new Map(),Date.parse('2026-11-16T16:59:59Z'),{fetch:async(url,opts)=>{
    if(opts.method==='POST')return {ok:true,json:async()=>({ok:true})};
    if(String(url).includes('setup_city=Anchorage'))await new Promise(resolve=>release=resolve);
    return {ok:true,json:async()=>({users:[String(url).includes('setup_city=Anchorage')?'Old':'New']})};
  }});
  p.run('setStage(3)');await p.run('getBookingQueue().flush()');await settle();
  p.run('selectedCity = {...selectedCity, name_en:"Taipei", name_zh:"臺北", timezone:"Asia/Taipei"}; startAlarmTick();');
  await p.run('getBookingQueue().flush()');await settle();release();await settle();
  const names=p.elements.get('alarm-orbit-runway').children[0].children.map(child=>child.children[0].textContent);
  assert.deepEqual(names,['New']);
});

test('startup installs a recurring roster refresh and outbox retry', async () => {
  const p=await page();p.run('initMap=()=>{}');
  p.handlers.get('DOMContentLoaded').at(-1)();await settle();
  assert([...p.timers.values()].some(timer=>timer.ms===60000));
  assert([...p.timers.values()].some(timer=>timer.ms===15000));
});

test('real alarm confirmation freezes the actual button time, account and scheduled city for retry',async()=>{
  const payloads=[];let release;
  const storage=new Map([['wakeuphere.userName','Pi-02'],['wakeupmap.current-base',JSON.stringify({latitude:25.033,longitude:121.5654})]]);
  const p=await page(storage,Date.parse('2026-11-16T16:59:59Z'),{fetch:async(url,opts)=>{
    if(opts.method==='POST'){
      const value=JSON.parse(opts.body);payloads.push(value);
      if(value.wakeEvent)await new Promise(resolve=>release=resolve);
      return {ok:true,json:async()=>({ok:true})};
    }
    return {ok:true,json:async()=>({users:[]})};
  }});
  p.run('setStage(3)');await p.run('getBookingQueue().flush()');
  p.time('2026-11-16T17:00:00Z');p.run('pollDailyAlarm()');
  p.time('2026-11-16T17:03:12.345Z');p.run('handleAlarmStageSpaceKey()');
  const acknowledgement=payloads.at(-1);
  assert.equal(acknowledgement.userName,'Pi-02');assert.equal(acknowledgement.setup_city,'Anchorage');
  assert.equal(acknowledgement.wakeEvent.pressedAt,'2026-11-16T17:03:12.345Z');
  assert.equal(acknowledgement.wakeEvent.scheduledAt,'2026-11-16T17:00:00.000Z');
  assert.equal(acknowledgement.wakeEvent.currentBaseLatitude,25.033);
  assert(JSON.parse(storage.get('wakeuphere.bookingOutbox')).some(job=>job.wakeEvent));
  p.time('2026-11-16T18:00:00Z');release();await p.run('getBookingQueue().flush()');
  assert.equal(payloads.at(-1).wakeEvent.pressedAt,'2026-11-16T17:03:12.345Z');
  p.run('handleAlarmStageSpaceKey()');assert.equal(payloads.filter(job=>job.wakeEvent).length,1);
});

test('manual simulation acknowledgement does not create a formal awakening event',async()=>{
  const payloads=[];const p=await page(new Map(),Date.parse('2026-11-16T16:59:59Z'),{fetch:async(url,opts)=>{
    if(opts.method==='POST')payloads.push(JSON.parse(opts.body));
    return {ok:true,json:async()=>({ok:true,users:[]})};
  }});
  p.run('setStage(3);triggerAlarmSimulation();handleAlarmStageSpaceKey()');
  await p.run('getBookingQueue().flush()');
  assert(payloads.some(job=>job.action==='dismiss'));
  assert(payloads.every(job=>!job.wakeEvent));
});
