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
test('wake confirmations are not shown as endlessly preparing breakfast',()=>{
  assert.equal(isRecordPreparing({wakeEventId:'event-1',imageUrl:'',recipe:''} as any,'en'),false);
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
