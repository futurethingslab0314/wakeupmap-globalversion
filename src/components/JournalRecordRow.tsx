import React from 'react';
import type {NotionRecord} from '../types';
import {getRecordCity,getRecordCountry,type UiLanguage,uiText} from '../i18n';
import {getJournalDateLabel} from '../journalTable';
import {getLocalDate} from '../reservationMap';
import {formatWakePressTime,formatWakeDistance} from '../wakeAcknowledgement';
export default function JournalRecordRow({record,language,highlighted,onHover,onSelect}:{record:NotionRecord;language:UiLanguage;highlighted:boolean;onHover:()=>void;onSelect:()=>void}){
 const zh=language==='zh',pending=record.mapPointKind==='reservation'&&!record.linkedWakeRecordId;
 let date=getJournalDateLabel(record);
 if(record.wakeScheduledAt&&record.wakeTargetTimeZone){try{date=getLocalDate(record.wakeScheduledAt,record.wakeTargetTimeZone);}catch{}}
 const target=zh?record.wakeTargetCityZh||record.wakeTargetCity:record.wakeTargetCity;
 const targetCountry=zh?record.wakeTargetCountryZh||record.wakeTargetCountry:record.wakeTargetCountry;
 return <tr className={`transition-colors ${highlighted?'bg-black/5':'hover:bg-black/[0.02]'}`} onMouseEnter={onHover}>
  <td className="px-4 py-4 align-top tabular-nums text-gray-600">
   <div>{date}</div>
   {record.wakeScheduledAt?<div className="mt-1 max-w-[140px] break-words text-[9px] leading-relaxed text-gray-400">08:00 // {record.wakeTargetTimeZone}</div>:null}
   <div className="mt-2 text-[9px] text-gray-400">{record.userName}</div>
  </td>
  <td className="px-4 py-4 align-top">
   {target?<><div className="flex items-center gap-2 font-bold text-[#a95018]"><span className="h-2 w-2 shrink-0 rounded-full border border-current"/>{target}</div><div className="mt-1 text-[9px] text-gray-400">{targetCountry}</div></>:<span className="text-gray-400">—</span>}
  </td>
  <td className="px-4 py-4 align-top">
   {pending?<span className="text-gray-500">{zh?'待甦醒':'Awaiting awakening'}</span>:<><div className="flex items-center gap-2 font-bold text-gray-900"><span className="h-2 w-2 shrink-0 rounded-full bg-black"/>{getRecordCity(record,language)}</div><div className="mt-1 text-[9px] text-gray-400">{getRecordCountry(record,language)}</div>
    {record.wakeEventId?<div className="mt-2 text-[10px] leading-relaxed text-gray-500">{formatWakePressTime(record,language)}<div className="text-[9px]">{record.wakeTimeZone}</div></div>:null}</>}
  </td>
  <td className="px-4 py-4 align-top tabular-nums text-gray-600">{pending?'—':formatWakeDistance(record)}</td>
  <td className="px-4 py-4 align-top text-gray-500"><div className="max-w-[240px] whitespace-normal leading-relaxed">{pending?(zh?'待甦醒':'Awaiting awakening'):record.wakeEventId?((record.wakeDelaySeconds ?? 0) < 0 ? (zh?'提前醒來，已跳過鬧鐘':'Awoke early, alarm skipped') : (zh?'已確認醒來':'Awakening confirmed')):record.greeting}</div></td>
  <td className="px-4 py-4 align-top"><button onClick={onSelect} className="min-h-10 whitespace-nowrap text-[9px] uppercase tracking-widest text-gray-500 transition-colors hover:text-black focus-visible:outline focus-visible:outline-2">{uiText[language].viewDetails}</button></td>
 </tr>;
}
