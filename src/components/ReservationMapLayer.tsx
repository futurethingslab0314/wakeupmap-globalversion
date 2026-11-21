import React from 'react';
import type {GeoProjection} from 'd3-geo';
import type {NotionRecord} from '../types';
import type {WakeMapFilter} from '../reservationMap';
import type {UiLanguage} from '../i18n';
import {getRecordCity} from '../i18n';
import {buildVisibleLiftedArcSegments,toSvgPath} from '../mapArcs';

type Pair={target:NotionRecord;actual:NotionRecord;distanceKm:number};
export default function ReservationMapLayer({targets,pairs,filter,projection,isVisible,onSelect,language,fontSize,selectedId}:{targets:NotionRecord[];pairs:Pair[];filter:WakeMapFilter;projection:GeoProjection;isVisible:(lon:number,lat:number)=>boolean;onSelect:(record:NotionRecord)=>void;language:UiLanguage;fontSize:number;selectedId?:string}){
 const zh=language==='zh';
 if(filter==='actual')return null;
 return <g data-map-layer="reservations">
  {filter==='all'&&pairs.map(pair=>{
   const segments=buildVisibleLiftedArcSegments({start:{lon:pair.target.longitude,lat:pair.target.latitude},end:{lon:pair.actual.longitude,lat:pair.actual.latitude},projection,isVisible});
   const longest=[...segments].sort((a,b)=>b.length-a.length)[0];
   const label=longest?.[Math.floor(longest.length/2)] || (isVisible(pair.target.longitude,pair.target.latitude)?(()=>{const p=projection([pair.target.longitude,pair.target.latitude]);return p?{x:p[0]+12,y:p[1]+20}:null;})():null);
   const start=projection([pair.target.longitude,pair.target.latitude]);
   const end=projection([pair.actual.longitude,pair.actual.latitude]);
   const shortArc=start&&end&&Math.hypot(start[0]-end[0],start[1]-end[1])<fontSize*12;
   return <g key={`comparison:${pair.actual.id}`} aria-label={`${pair.target.city} → ${pair.actual.city}: ${pair.distanceKm.toFixed(1)} km`}>
    {segments.map((segment,index)=><path key={index} d={toSvgPath(segment)||undefined} stroke="#b66028" strokeWidth={1.1} strokeDasharray="3 3" fill="none" pointerEvents="none"/>)}
    {label?<text x={label.x} y={label.y+(shortArc?34:-5)} textAnchor="middle" fontSize={fontSize} fontFamily="monospace" fill="#904214" stroke="white" strokeWidth={3} paintOrder="stroke" pointerEvents="none">{pair.distanceKm.toFixed(1)} km</text>:null}
   </g>;
  })}
  {targets.map(target=>{
   if(!isVisible(target.longitude,target.latitude))return null;
   const point=projection([target.longitude,target.latitude]);if(!point)return null;
   const select=()=>onSelect(target);
   const label=`${zh?'預約甦醒位置':'Reserved awakening'} · ${getRecordCity(target,language)}`;
   return <g key={target.id} transform={`translate(${point[0]},${point[1]})`} role="button" tabIndex={0} aria-label={`${target.userName}: ${label}`} className="cursor-pointer outline-none" onClick={select}
    onMouseDown={event=>event.stopPropagation()} onTouchStart={event=>event.stopPropagation()}
    onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();select();}}}>
    <title>{`${target.userName} // ${label} // ${target.wakeTargetTimeZone}`}</title>
    <circle r={12} fill="transparent"/>
    <circle r={selectedId===target.id?7:5.5} fill="none" stroke="#c46320" strokeWidth={1.7}/>
    <text y={-12} textAnchor="middle" fontSize={fontSize} fontFamily="monospace" fill="#a95018" stroke="white" strokeWidth={3} paintOrder="stroke">{label}</text>
   </g>;
  })}
 </g>;
}
