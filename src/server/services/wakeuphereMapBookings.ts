import {readFileSync} from 'node:fs';
import {getScheduledMorning, type WakeReservation} from '../../reservationMap.js';

type Booking = {page:{id?:string};userName:string;city:string;cityZh:string;country:string;countryZh:string;active:boolean;updatedAt:number};
type City = {city:string;city_zh?:string;country:string;country_zh?:string;timezone:string;latitude:number;longitude:number};
let cities:City[]|undefined;
const normalize=(value:string)=>value.trim().toLowerCase().replace(/[\s_-]+/g,'');
export function getMapReservations(bookings:Booking[], now=new Date()):WakeReservation[]{
  cities ||= JSON.parse(readFileSync(new URL('../../../cities_data.json',import.meta.url),'utf8'));
  const result:WakeReservation[]=[];
  for(const booking of bookings){
    if(!booking.active || !booking.updatedAt || !booking.userName)continue;
    const matches=cities!.filter(city=>
      ((booking.city && normalize(city.city)===normalize(booking.city)) || (booking.cityZh && normalize(city.city_zh||'')===normalize(booking.cityZh))) &&
      (!(booking.country||booking.countryZh) || (booking.country && normalize(city.country)===normalize(booking.country)) ||
       (booking.countryZh && normalize(city.country_zh||'')===normalize(booking.countryZh))));
    // A country-less legacy booking is usable only when its city is unambiguous.
    if(!matches.length || new Set(matches.map(city=>city.country)).size>1)continue;
    const city=matches[0];
    const scheduledAt=getScheduledMorning(now,city.timezone);
    if(booking.updatedAt>Date.parse(scheduledAt))continue;
    result.push({id:booking.page.id||booking.userName,userName:booking.userName,
      city:city.city,cityZh:city.city_zh||city.city,country:city.country,countryZh:city.country_zh||city.country,
      latitude:city.latitude,longitude:city.longitude,timeZone:city.timezone,
      bookedAt:new Date(booking.updatedAt).toISOString(),scheduledAt});
  }
  return result;
}
