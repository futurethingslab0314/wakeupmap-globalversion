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

test('dismiss API writes the awakening to the main map database and returns its record ID',async()=>{
  await withNotion(async state=>{
    const nextFetch=globalThis.fetch;
    globalThis.fetch=(async(url,opts:any={})=>{
      if(String(url).endsWith('/databases/booking-db'))return Response.json({properties:{userName:{type:'title'},setup_city:{type:'rich_text'}}});
      if(String(url).endsWith('/databases/booking-db/query'))return Response.json({results:[],has_more:false});
      return nextFetch(url,opts);
    }) as typeof fetch;
    const before={NOTION_API_KEY:process.env.NOTION_API_KEY,NOTION_DATABASE_ID:process.env.NOTION_DATABASE_ID,WAKEUPHERE_PAGE_ID:process.env.WAKEUPHERE_PAGE_ID};
    Object.assign(process.env,{NOTION_API_KEY:'fixture',NOTION_DATABASE_ID:'map-db',WAKEUPHERE_PAGE_ID:'booking-db'});
    try{
      let status=200,data:any;
      await bookingHandler({method:'POST',body:{...body,action:'dismiss',press:'yes'}},{status(code){status=code;return this},json(value){data=value},setHeader(){}});
      assert.equal(status,200);assert.equal(data.wakeRecordId,'wake-1');assert.equal(state.writes.length,1);
      await mapHandler({method:'GET'},{status(code){status=code;return this},json(value){data=value},setHeader(){}});
      assert.equal(status,200);assert.equal(data[0].id,'wake-1');assert.equal(data[0].userName,'YuPie');
      assert.equal(data[0].wakePressedAt,body.wakeEvent.pressedAt);
    }finally{
      for(const [key,value] of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  });
});
