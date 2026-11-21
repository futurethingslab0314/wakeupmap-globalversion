import test from 'node:test';
import assert from 'node:assert/strict';
import { readWakeAcknowledgement, formatWakePressTime, formatWakeDistance } from '../src/wakeAcknowledgement';
import { isRecordPreparing } from '../src/recordSync';
import { getRecordsSortedByRecordedAt } from '../src/mapSelection';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WakeAcknowledgementDetails from '../src/components/WakeAcknowledgementDetails';

const r=(value:string)=>({rich_text:[{plain_text:value}]});
test('decodes typed wake metadata and preserves a zero-kilometre distance',()=>{
  const result=readWakeAcknowledgement({wakeuphere_event_id:r('event-1'),wakeuphere_pressed_at:{date:{start:'2026-03-28T16:20:12Z'}},
    wakeuphere_distance_km:{number:0},wakeuphere_client_timezone:r('Asia/Taipei'),wakeuphere_target_city:r('Anchorage')});
  assert.equal(result.wakeEventId,'event-1');assert.equal(result.wakeDistanceKm,0);
  assert.equal(formatWakeDistance(result),'0.0 km');
  assert(formatWakePressTime(result,'en').includes('00:20:12'));
});
test('actual awakenings prepare breakfast until their image and recipe are ready',()=>{
  assert.equal(isRecordPreparing({wakeEventId:'event-1',imageUrl:'',recipe:''} as any,'en'),true);
});
test('journal sorting uses the precise press timestamp, not the virtual city UTC offset',()=>{
  const later={id:'later',wakePressedAt:'2026-03-28T16:20:12Z',recordedAtDate:'2026-03-29',recordedAt:'00:20:12',utcOffset:-8};
  const earlier={id:'earlier',wakePressedAt:'2026-03-28T16:10:00Z',recordedAtDate:'2026-03-29',recordedAt:'00:10:00',utcOffset:12};
  assert.equal(getRecordsSortedByRecordedAt([earlier,later] as any)[0].id,'later');
});

test('map details show confirmation time, target, selected wake city and distance without a breakfast placeholder',()=>{
  const markup=renderToStaticMarkup(React.createElement(WakeAcknowledgementDetails,{language:'zh',record:{
    id:'wake-1',wakeEventId:'event-1',userName:'YuPie',wakePressedAt:'2026-03-28T16:20:12Z',
    wakeTimeZone:'Asia/Taipei',wakeTargetCity:'Anchorage',wakeTargetCityZh:'安克拉治',
    wakeTargetCountry:'United States',wakeTargetCountryZh:'美國',wakeScheduledAt:'2026-03-28T16:00:00Z',
    wakeTargetTimeZone:'America/Anchorage',wakeDistanceKm:123.4,wakeDelaySeconds:1212,
    city:'Fairbanks',city_zh:'費爾班克斯',country:'United States',country_zh:'美國',
  } as any}));
  for(const value of ['YuPie','00:20:12','安克拉治','費爾班克斯','123.4 km','20 分 12 秒','並非 GPS'])assert(markup.includes(value),value);
  assert(!markup.includes('preparingBreakfast'));
});

test('actual awakening Location Data includes original greeting, city introduction and breakfast alongside confirmation metadata',async()=>{
  const {default:DetailsPanel}=await import('../src/components/DetailsPanel');
  const record={id:'wake-1',wakeEventId:'event-1',userName:'YuPie',city:'Muscat',city_zh:'馬斯喀特',country:'Oman',country_zh:'阿曼',latitude:23.61,longitude:58.59,utcOffset:4,
    greeting:'صباح الخير',story:'Morning light crosses the harbour in Muscat.',story_zh:'晨光照亮馬斯喀特的港灣。',recipe:'Bread with coffee.',recipe_zh:'麵包搭配咖啡。',imageUrl:'https://fixture.invalid/breakfast.png',wakeDistanceKm:358.4,wakeTargetCity:'Dubai',wakePressedAt:'2026-11-21T04:01:05Z',wakeTimeZone:'Asia/Taipei'} as any;
  const html=renderToStaticMarkup(React.createElement(DetailsPanel,{record,country:null,group:null,records:[record],language:'en',onClose:()=>{}}));
  for(const value of ['صباح الخير','Morning light crosses the harbour in Muscat.','https://fixture.invalid/breakfast.png','Bread with coffee.','358.4 km','Dubai'])assert(html.includes(value),value);
});

test('an actual awakening with only an image still needs its local greeting and introduction',()=>{
  assert.equal(isRecordPreparing({wakeEventId:'event',imageUrl:'https://fixture.invalid/image.png',recipe:'Bread',greeting:'AWAKE // 已醒來',story:'WakeUpHere alarm acknowledged.'} as any,'en'),true);
});
