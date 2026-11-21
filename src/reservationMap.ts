import type {NotionRecord} from './types';

export interface WakeReservation {
  id: string; userName: string; city: string; cityZh: string; country: string; countryZh: string;
  latitude: number; longitude: number; timeZone: string; bookedAt: string; scheduledAt: string;
}
export type WakeMapFilter = 'all' | 'reservations' | 'actual';
const account = (name?: string) => (name || '').trim().toLowerCase().replace(/[\s_-]+/g,'');
export const filterReservationsForUser = (rows: WakeReservation[], userName: string) => rows.filter(row=>account(row.userName)===account(userName));

export function getLocalDate(instant: Date | string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date(instant));
  const value=(type:string)=>parts.find(p=>p.type===type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function getScheduledMorning(now: Date, zone: string): string {
  const [year,month,day]=getLocalDate(now,zone).split('-').map(Number);
  const wall=Date.UTC(year,month-1,day,8);
  let instant=wall;
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<6;i++){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
    const diff=wall-Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);
    if(diff===0)return new Date(instant).toISOString();
    instant+=diff;
  }
  throw Error('Cannot resolve city-local 08:00');
}
const key=(user: string|undefined, city:string|undefined, country:string|undefined, scheduled:string|undefined)=>
  JSON.stringify([account(user),account(city),account(country),scheduled?new Date(scheduled).toISOString():'']);
function asTarget(booking: WakeReservation, actual?: NotionRecord): NotionRecord {
  return {
    ...actual, id:`reservation:${key(booking.userName,booking.city,booking.country,booking.scheduledAt)}`,
    userName:booking.userName,city:booking.city,cityZh:booking.cityZh,city_zh:booking.cityZh,
    country:booking.country,countryZh:booking.countryZh,country_zh:booking.countryZh,
    latitude:booking.latitude,longitude:booking.longitude,utcOffset:0,
    greeting:actual?'Awakening confirmed':'Awaiting awakening',story:'',story_zh:'',imageUrl:'',recipe:'',
    recordedAtDate:getLocalDate(booking.scheduledAt,booking.timeZone),recordedAt:'08:00:00',
    wakeScheduledAt:booking.scheduledAt,wakeTargetCity:booking.city,wakeTargetCityZh:booking.cityZh,
    wakeTargetCountry:booking.country,wakeTargetCountryZh:booking.countryZh,
    wakeTargetLatitude:booking.latitude,wakeTargetLongitude:booking.longitude,wakeTargetTimeZone:booking.timeZone,
    mapPointKind:'reservation', linkedWakeRecordId:actual?.id,
  };
}
function isToday(scheduled: string, zone: string, now: Date){
  try{return getLocalDate(scheduled,zone)===getLocalDate(now,zone);}catch{return false;}
}
export function buildReservationMapState(records: NotionRecord[], bookings: WakeReservation[], now: Date) {
  const targets=new Map<string,NotionRecord>();
  const pairs: Array<{target:NotionRecord;actual:NotionRecord;distanceKm:number}> = [];
  for(const booking of bookings){
    if(!isToday(booking.scheduledAt,booking.timeZone,now) || Date.parse(booking.bookedAt)>Date.parse(booking.scheduledAt))continue;
    const target=asTarget(booking);targets.set(key(booking.userName,booking.city,booking.country,booking.scheduledAt),target);
  }
  for(const record of records){
    if(!record.wakeEventId || !record.wakeScheduledAt || !record.wakeTargetTimeZone ||
      !Number.isFinite(record.wakeTargetLatitude) || !Number.isFinite(record.wakeTargetLongitude) ||
      !isToday(record.wakeScheduledAt,record.wakeTargetTimeZone,now))continue;
    const booking:WakeReservation={id:record.id,userName:record.userName||'',city:record.wakeTargetCity||'',cityZh:record.wakeTargetCityZh||record.wakeTargetCity||'',
      country:record.wakeTargetCountry||'',countryZh:record.wakeTargetCountryZh||record.wakeTargetCountry||'',latitude:record.wakeTargetLatitude!,longitude:record.wakeTargetLongitude!,
      timeZone:record.wakeTargetTimeZone,bookedAt:'',scheduledAt:record.wakeScheduledAt};
    const target=asTarget(booking,record);
    targets.set(key(booking.userName,booking.city,booking.country,booking.scheduledAt),target);
    if(typeof record.wakeDistanceKm==='number' && Number.isFinite(record.wakeDistanceKm))pairs.push({target,actual:record,distanceKm:record.wakeDistanceKm});
  }
  return {targets:[...targets.values()],pairs};
}
export function getReservationJournalRows(records:NotionRecord[], targets:NotionRecord[]){
  return [...records,...targets.filter(t=>!t.linkedWakeRecordId)];
}
