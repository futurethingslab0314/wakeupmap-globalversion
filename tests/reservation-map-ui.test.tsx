import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import WakeMapFilter from '../src/components/WakeMapFilter';
import JournalRecordRow from '../src/components/JournalRecordRow';
import ReservationDetails from '../src/components/ReservationDetails';
import {buildReservationMapState,type WakeReservation} from '../src/reservationMap';
import type {NotionRecord} from '../src/types';
const booking:WakeReservation={id:'b',userName:'YuPie',city:'Dubai',cityZh:'迪拜',country:'United Arab Emirates',countryZh:'阿聯酋',latitude:25,longitude:55,timeZone:'Asia/Dubai',bookedAt:'2026-11-20T00:00:00Z',scheduledAt:'2026-11-21T04:00:00Z'};
const target=buildReservationMapState([],[booking],new Date('2026-11-21T03:00:00Z')).targets[0];
test('filter has three accessible choices with legend and city-local date explanation',()=>{
 const html=renderToStaticMarkup(<WakeMapFilter value="reservations" onChange={()=>{}} language="zh" pendingCount={1} actualCount={0}/>);
 assert.match(html,/預約位置/);assert.match(html,/實際位置/);assert.match(html,/全部/);
 assert.match(html,/aria-pressed="true"/);assert.match(html,/預約城市當地日期/);
});
test('pending journal entry shows reserved city and awaiting state rather than an actual wake location',()=>{
 const html=renderToStaticMarkup(<table><tbody><JournalRecordRow record={target} language="zh" highlighted={false} onHover={()=>{}} onSelect={()=>{}}/></tbody></table>);
 assert.match(html,/迪拜/);assert.match(html,/待甦醒/);assert.doesNotMatch(html,/0\.0 km/);
});
test('completed journal row uses reserved-city date and includes both cities, exact button time and distance',()=>{
 const record:NotionRecord={...target,id:'wake',mapPointKind:undefined,city:'Muscat',city_zh:'馬斯喀特',wakeTargetCityZh:'迪拜',wakeEventId:'e',recordedAtDate:'2026-11-22',wakePressedAt:'2026-11-21T04:01:05Z',wakeTimeZone:'Asia/Taipei',wakeDistanceKm:0};
 const html=renderToStaticMarkup(<table><tbody><JournalRecordRow record={record} language="zh" highlighted={false} onHover={()=>{}} onSelect={()=>{}}/></tbody></table>);
 assert.match(html,/2026-11-21/);assert.doesNotMatch(html,/2026-11-22/);
 assert.match(html,/迪拜/);assert.match(html,/馬斯喀特/);assert.match(html,/12:01:05/);assert.match(html,/0\.0 km/);
});
test('reservation details explain 08:00, account and pending acknowledgement without a breakfast placeholder',()=>{
 const html=renderToStaticMarkup(<ReservationDetails record={target} language="zh"/>);
 assert.match(html,/YuPie/);assert.match(html,/08:00/);assert.match(html,/待甦醒/);assert.match(html,/預約甦醒位置/);assert.doesNotMatch(html,/早餐準備/);
});

test('reservation points never appear as breakfast still preparing', async()=>{
 const {isRecordPreparing}=await import('../src/recordSync');
 assert.equal(isRecordPreparing(target,'zh'),false);
});
test('globe layer hides comparisons in reserved-only mode and retains the 0 km label in combined mode', async()=>{
 const {default:Layer}=await import('../src/components/ReservationMapLayer');
 const {geoOrthographic}=await import('d3-geo');
 const projection=geoOrthographic().rotate([-55,-25,0]).translate([400,300]);
 const actual={...target,id:'awake',mapPointKind:undefined,wakeEventId:'e',latitude:25,longitude:55};
 const props={targets:[target],pairs:[{target,actual,distanceKm:0}],projection,isVisible:()=>true,onSelect:()=>{},language:'zh' as const,fontSize:11};
 const all=renderToStaticMarkup(<svg><Layer {...props} filter="all"/></svg>);
 assert.match(all,/0\.0 km/);assert.match(all,/預約甦醒位置/);assert.match(all,/role="button"/);
 const reserved=renderToStaticMarkup(<svg><Layer {...props} filter="reservations"/></svg>);
 assert.doesNotMatch(reserved,/0\.0 km/);
 assert.equal(renderToStaticMarkup(<svg><Layer {...props} filter="actual"/></svg>),'<svg></svg>');
});
