import test from 'node:test';
import assert from 'node:assert/strict';
import {getLocalDate, getScheduledMorning, buildReservationMapState, getReservationJournalRows, filterReservationsForUser} from '../src/reservationMap';
import type {WakeReservation} from '../src/reservationMap';
import type {NotionRecord} from '../src/types';
const now = new Date('2026-11-21T17:05:00Z');
const reservation: WakeReservation = {id:'booking-1',userName:'YuPie',city:'Anchorage',cityZh:'安克拉治',country:'USA',countryZh:'美國',latitude:61.2181,longitude:-149.9003,timeZone:'America/Anchorage',bookedAt:'2026-11-20T00:00:00Z',scheduledAt:'2026-11-21T17:00:00Z'};
const awake: NotionRecord = {id:'wake-1',userName:'YuPie',city:'Honolulu',city_zh:'檀香山',country:'USA',country_zh:'美國',latitude:21.3,longitude:-157.8,utcOffset:-10,greeting:'Awake',story:'',story_zh:'',recipe:'',imageUrl:'',recordedAtDate:'2026-11-22',wakeEventId:'event-1',wakeScheduledAt:reservation.scheduledAt,wakePressedAt:'2026-11-21T17:03:00Z',wakeTargetCity:'Anchorage',wakeTargetCityZh:'安克拉治',wakeTargetCountry:'USA',wakeTargetCountryZh:'美國',wakeTargetLatitude:61.2181,wakeTargetLongitude:-149.9003,wakeTargetTimeZone:'America/Anchorage',wakeDistanceKm:4500,wakeTimeZone:'Asia/Taipei'};

test('today and 08:00 use the target timezone across viewer midnight and DST',()=>{
 assert.equal(getLocalDate(now,'America/Anchorage'),'2026-11-21');
 assert.equal(getLocalDate(now,'Asia/Taipei'),'2026-11-22');
 assert.equal(getScheduledMorning(new Date('2026-03-08T20:00:00Z'),'America/Anchorage'),'2026-03-08T16:00:00.000Z');
 assert.equal(getScheduledMorning(new Date('2026-03-07T20:00:00Z'),'America/Anchorage'),'2026-03-07T17:00:00.000Z');
});
test('pending reservation produces an orange target and a single pending journal row',()=>{
 const state=buildReservationMapState([], [reservation], now);
 assert.equal(state.targets.length,1);assert.equal(state.targets[0].mapPointKind,'reservation');
 assert.equal(state.pairs.length,0);
 const rows=getReservationJournalRows([],state.targets);assert.equal(rows.length,1);assert.equal(rows[0].city,'Anchorage');
});
test('completed target is deduplicated with current booking and retains its pair after cancellation or move',()=>{
 const state=buildReservationMapState([awake],[reservation],now);
 assert.equal(state.targets.length,1);assert.equal(state.pairs.length,1);
 assert.equal(state.pairs[0].actual.id,'wake-1');assert.equal(state.pairs[0].distanceKm,4500);
 assert.equal(getReservationJournalRows([awake],state.targets).length,1);
 const cancelled=buildReservationMapState([awake],[],now);assert.equal(cancelled.targets.length,1);
 const moved=buildReservationMapState([awake],[{...reservation,id:'booking-new',city:'Dubai',timeZone:'Asia/Dubai',scheduledAt:'2026-11-21T04:00:00Z',bookedAt:'2026-11-21T18:00:00Z'}],now);
 assert.equal(moved.targets.length,1);assert.equal(moved.targets[0].city,'Anchorage');
});
test('old targets and reservations created after local 08:00 are not shown as today',()=>{
 assert.equal(buildReservationMapState([], [{...reservation,bookedAt:'2026-11-21T17:01:00Z'}],now).targets.length,0);
 assert.equal(buildReservationMapState([awake],[],new Date('2026-11-23T18:00:00Z')).targets.length,0);
 assert.equal(getReservationJournalRows([awake],[]).length,1);
});
test('account filter matches case and never mixes other accounts',()=>{
 assert.deepEqual(filterReservationsForUser([reservation,{...reservation,id:'other',userName:'Bob'}],'yupie'),[reservation]);
});
test('zero-distance completion keeps both point types and the 0 km comparison',()=>{
 const state=buildReservationMapState([{...awake,latitude:61.2181,longitude:-149.9003,wakeDistanceKm:0}],[reservation],now);
 assert.equal(state.targets.length,1);assert.equal(state.pairs[0].distanceKm,0);
});
test('late acknowledgement is assigned to its original alarm day, not the press day',()=>{
 const late={...awake,wakePressedAt:'2026-11-22T18:00:00Z'};
 assert.equal(buildReservationMapState([late],[],now).pairs.length,1);
 assert.equal(buildReservationMapState([late],[],new Date('2026-11-22T18:00:00Z')).pairs.length,0);
});
