import test from 'node:test';
import assert from 'node:assert/strict';
import { recordWakeAcknowledgement } from '../src/server/services/wakeuphereAcknowledgement';
import { normalizePage } from '../api/notion-data';
import mapHandler from '../api/notion-data';
import bookingHandler from '../api/wakeuphere';
import { captureWakeUpContext, selectCity, getDistanceBetweenCoordinates } from '../api/wake-up-now';

const body = {
  userName: 'YuPie', setup_city: 'Anchorage', setup_country: 'United States',
  wakeEvent: { pressedAt: '2026-03-28T16:20:12.345Z', scheduledAt: '2026-03-28T16:00:00.000Z',
    clientTimeZone: 'Asia/Taipei', currentBaseLatitude: 25.033, currentBaseLongitude: 121.5654 },
};
async function withNotion(fn: (state: any) => Promise<void>) {
  const previous = globalThis.fetch;
  const state = { properties: { userName:{type:'title'},city:{type:'rich_text'},country:{type:'rich_text'},
    latitude:{type:'number'},longitude:{type:'number'},recordedAtDate:{type:'date'} } as any,
    pages: [] as any[], writes: [] as any[], requests: [] as string[] };
  globalThis.fetch = (async (url,options:any={})=>{
    const path=String(url),method=options.method||'GET';state.requests.push(path);
    if(path.endsWith('/databases/map-db') && method==='GET')return Response.json({properties:state.properties});
    if(path.endsWith('/databases/map-db') && method==='PATCH'){
      const data=JSON.parse(options.body);for(const [key,value] of Object.entries(data.properties) as any)
        state.properties[key]={type:Object.keys(value)[0]};
      return Response.json({properties:state.properties});
    }
    if(path.endsWith('/databases/map-db/query')){
      const query=JSON.parse(options.body);
      const rows=query.filter?state.pages.filter(page=>page.properties.wakeuphere_event_id.rich_text[0].plain_text===query.filter.rich_text.equals):state.pages;
      return Response.json({results:rows,has_more:false});
    }
    if(path.endsWith('/pages') && method==='POST'){
      const data=JSON.parse(options.body);state.writes.push(data);
      const properties=structuredClone(data.properties);
      for(const value of Object.values(properties) as any[]) for(const type of ['title','rich_text'])
        if(value[type])value[type]=value[type].map((part:any)=>({...part,plain_text:part.text.content}));
      const row={id:'wake-'+state.writes.length,properties};state.pages.push(row);
      return Response.json(row);
    }
    throw Error('Unexpected external request: '+path);
  }) as typeof fetch;
  try{await fn(state)}finally{globalThis.fetch=previous}
}

test('acknowledgement writes original button time, resolved city and target distance into the map database', async()=>{
  await withNotion(async state=>{
    const result=await recordWakeAcknowledgement(body,{apiKey:'fixture',databaseId:'map-db'});
    assert.equal(result.id,'wake-1');assert.equal(state.writes.length,1);
    const properties=state.writes[0].properties;
    assert.equal(properties.wakeuphere_pressed_at.date.start,body.wakeEvent.pressedAt);
    assert.equal(properties.wakeuphere_scheduled_at.date.start,body.wakeEvent.scheduledAt);
    assert.equal(properties.wakeuphere_delay_seconds.number,1212.345);
    assert(properties.wakeuphere_distance_km.number>=0);
    assert.equal(properties.wakeuphere_target_city.rich_text[0].text.content,'Anchorage');
    assert.equal(properties.userName.title[0].text.content,'YuPie');
    assert.equal(state.writes[0].parent.database_id,'map-db');
    assert(state.requests.every((path:string)=>path.startsWith('https://api.notion.com/')));
    const normalized=normalizePage(state.pages[0]);
    assert.equal(normalized.wakePressedAt,body.wakeEvent.pressedAt);
    assert.equal(normalized.userName,'YuPie');assert.equal(normalized.recordedAtDate,'2026-03-29');
    const input={userName:body.userName,clientTimeZone:body.wakeEvent.clientTimeZone,
      clientIsoTime:body.wakeEvent.pressedAt,nowUtcIso:body.wakeEvent.pressedAt,
      currentBaseLatitude:25.033,currentBaseLongitude:121.5654};
    const expected=selectCity(input.nowUtcIso,[],input,captureWakeUpContext(input));
    assert.equal(normalized.city,expected.city);
    const expectedDistance=getDistanceBetweenCoordinates({latitude:61.2181,longitude:-149.9003},expected);
    assert(Math.abs((normalized.wakeDistanceKm??0)-expectedDistance)<2);
  });
});
test('retry returns the existing event instead of adding a duplicate record',async()=>{
  await withNotion(async state=>{
    const first=await recordWakeAcknowledgement(body,{apiKey:'fixture',databaseId:'map-db'});
    const again=await recordWakeAcknowledgement(body,{apiKey:'fixture',databaseId:'map-db'});
    assert.equal(first.id,again.id);assert.equal(state.writes.length,1);
  });
});
test('rejects a nonexistent target city and a press before the scheduled alarm',async()=>{
  await withNotion(async state=>{
    await assert.rejects(()=>recordWakeAcknowledgement({...body,setup_city:'Imaginary City'},{apiKey:'fixture',databaseId:'map-db'}));
    await assert.rejects(()=>recordWakeAcknowledgement({...body,wakeEvent:{...body.wakeEvent,pressedAt:'2026-03-28T15:00:00Z'}},{apiKey:'fixture',databaseId:'map-db'}));
    assert.equal(state.writes.length,0);
  });
});

test('a new scheduled day gets a new record while retries of that day remain deduplicated',async()=>{
  await withNotion(async state=>{
    await recordWakeAcknowledgement(body,{apiKey:'fixture',databaseId:'map-db'});
    const next={...body,wakeEvent:{...body.wakeEvent,pressedAt:'2026-03-29T16:20:12.345Z',scheduledAt:'2026-03-29T16:00:00Z'}};
    await recordWakeAcknowledgement(next,{apiKey:'fixture',databaseId:'map-db'});
    await recordWakeAcknowledgement(next,{apiKey:'fixture',databaseId:'map-db'});
    assert.equal(state.writes.length,2);
  });
});

function mockSharedAwakeningApi(options: { reserved?: boolean; bookedAt?: string } = {}) {
  const env = {
    NOTION_API_KEY: 'fixture', NOTION_DATABASE_ID: 'map-db', WAKEUPHERE_PAGE_ID: 'booking-db',
    CLOUDFLARE_R2_ENDPOINT: 'https://storage.example.test', CLOUDFLARE_R2_BUCKET: 'wake',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'fixture', CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'fixture-secret',
  };
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);

  const nextFetch = globalThis.fetch;
  const objects = new Map<string, string>();
  globalThis.fetch = (async (url, opts: RequestInit = {}) => {
    const address = String(url);
    if (address.startsWith(env.CLOUDFLARE_R2_ENDPOINT)) {
      const headers = new Headers(opts.headers);
      if (opts.method === 'PUT') {
        if (headers.get('if-none-match') === '*' && objects.has(address)) return new Response(null, { status: 412 });
        objects.set(address, String(opts.body));
        return new Response(null, { status: 200 });
      }
      if (opts.method === 'DELETE') {
        objects.delete(address);
        return new Response(null, { status: 204 });
      }
      if (!objects.has(address)) return new Response(null, { status: 404 });
      return new Response(opts.method === 'HEAD' ? null : objects.get(address));
    }
    if (address.endsWith('/databases/booking-db')) return Response.json({
      properties: { userName: { type: 'title' }, setup_city: { type: 'rich_text' }, setup_country: { type: 'rich_text' } },
    });
    if (address.endsWith('/databases/booking-db/query')) {
      const richText = (value: string) => ({ rich_text: [{ plain_text: value }] });
      return Response.json({ results: options.reserved ? [{
        id: 'reservation', properties: {
          userName: { title: [{ plain_text: 'YuPie' }] },
          setup_city: richText('Anchorage'), setup_country: richText('United States'),
          wakeuphere_active: { checkbox: true }, wakeuphere_updated_at: { date: { start: options.bookedAt ?? '2026-03-27T15:00:00Z' } },
        },
      }] : [], has_more: false });
    }
    if (address.endsWith('/pages/reservation') && opts.method === 'PATCH') return Response.json({ id: 'reservation' });
    return nextFetch(url, opts);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = nextFetch;
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

async function callHandler(handler: typeof bookingHandler, request: Parameters<typeof bookingHandler>[0]) {
  let status = 200;
  let data: any;
  await handler(request, { status(code) { status = code; return this; }, json(value) { data = value; }, setHeader() {} });
  return { status, data };
}

const pressMap = (clientIsoTime: string, userName = 'yu-pie') => callHandler(bookingHandler, {
  method: 'POST', body: { action: 'wake-map', userName, clientIsoTime, clientTimeZone: 'Asia/Taipei' },
});
const pressHere = () => callHandler(bookingHandler, { method: 'POST', body: { ...body, action: 'dismiss', press: 'yes' } });
const checkRound = (scheduledAt: string) => {
  const query = new URLSearchParams({
    view: 'wake-round', userName: body.userName, city: body.setup_city, country: body.setup_country, scheduledAt,
  });
  return callHandler(bookingHandler, { method: 'GET', url: '/api/wakeuphere?' + query });
};

test('dismiss API writes the awakening to the main map database and returns its record ID', async () => {
  await withNotion(async state => {
    const restore = mockSharedAwakeningApi();
    try {
      const { status, data } = await pressHere();
      assert.equal(status, 200);
      assert.equal(data.wakeRecordId, 'wake-1');
      assert.equal(state.writes.length, 1);
      const mapped = await callHandler(mapHandler, { method: 'GET' });
      assert.equal(mapped.status, 200);
      assert.equal(mapped.data[0].id, 'wake-1');
      assert.equal(mapped.data[0].userName, 'YuPie');
      assert.equal(mapped.data[0].wakePressedAt, body.wakeEvent.pressedAt);
    } finally { restore(); }
  });
});

test('same-account Map skips only the booked round and preserves the first press when Here retries', async () => {
  await withNotion(async state => {
    const restore = mockSharedAwakeningApi({ reserved: true });
    try {
      const earlyTime = '2026-03-28T15:00:00.000Z';
      const first = await pressMap(earlyTime);
      assert.equal(first.status, 200);
      assert.equal(first.data.record.wakeDelaySeconds, -3600);
      assert.equal(first.data.record.wakePressedAt, earlyTime);
      assert.equal((await checkRound(body.wakeEvent.scheduledAt)).data.confirmed, true);
      assert.equal((await checkRound('2026-03-29T16:00:00.000Z')).data.confirmed, false);
      assert.equal((await pressHere()).data.wakeRecordId, first.data.wakeRecordId);
      assert.equal(state.writes.length, 1);
    } finally { restore(); }
  });
});

test('concurrent Map and Here presses produce one Notion record for the ringing alarm', async () => {
  await withNotion(async state => {
    const restore = mockSharedAwakeningApi({ reserved: true });
    try {
      const results = await Promise.all([pressMap(body.wakeEvent.pressedAt), pressHere(), pressMap(body.wakeEvent.pressedAt)]);
      assert(results.every(result => [200, 202].includes(result.status)));
      assert.equal(state.writes.length, 1);
      assert.equal((await checkRound(body.wakeEvent.scheduledAt)).data.confirmed, true);
      assert.equal((await pressMap(body.wakeEvent.pressedAt)).data.wakeRecordId, 'wake-1');
      assert.equal(state.writes.length, 1);
    } finally { restore(); }
  });
});

test('reservation after 08:00 skips its first alarm the following morning', async () => {
  await withNotion(async () => {
    const restore = mockSharedAwakeningApi({ reserved: true, bookedAt: '2026-03-28T16:01:00Z' });
    try {
      const result = await pressMap('2026-03-28T16:02:00Z');
      assert.equal(result.status, 200);
      assert.equal(result.data.record.wakeScheduledAt, '2026-03-29T16:00:00.000Z');
    } finally { restore(); }
  });
});

test('Map with another account uses the standalone wake flow', async () => {
  await withNotion(async state => {
    const restore = mockSharedAwakeningApi({ reserved: true });
    try {
      const result = await pressMap(body.wakeEvent.pressedAt, 'someone else');
      assert.equal(result.status, 200);
      assert.equal(result.data.hasReservation, false);
      assert.equal(state.writes.length, 0);
    } finally { restore(); }
  });
});

test('Map acknowledges a round that is still ringing after city-local midnight', async () => {
  await withNotion(async state => {
    const restore = mockSharedAwakeningApi({ reserved: true });
    try {
      const { status } = await callHandler(bookingHandler, {
        method: 'POST', body: { action: 'alarm-ringing', userName: body.userName,
          city: body.setup_city, country: body.setup_country, scheduledAt: body.wakeEvent.scheduledAt },
      });
      assert.equal(status, 200);
      const result = await pressMap('2026-03-29T09:00:00.000Z');
      assert.equal(result.status, 200);
      assert.equal(result.data.record.wakeScheduledAt, body.wakeEvent.scheduledAt);
      assert.equal((await checkRound(body.wakeEvent.scheduledAt)).data.confirmed, true);
      assert.equal(state.writes.length, 1);
    } finally { restore(); }
  });
});
