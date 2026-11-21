import React from 'react';
import type {NotionRecord} from '../types';
import {getRecordCity,getRecordCountry,type UiLanguage} from '../i18n';
import {formatWakeDistance,formatWakePressTime} from '../wakeAcknowledgement';
export default function ReservationDetails({record,language,actualRecord}:{record:NotionRecord;language:UiLanguage;actualRecord?:NotionRecord}){
 const zh=language==='zh';
 let scheduled=record.wakeScheduledAt||'—';
 try{scheduled=new Intl.DateTimeFormat(zh?'zh-TW':'en-GB',{timeZone:record.wakeTargetTimeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(scheduled));}catch{}
 const rows=[
  [zh?'帳號':'Account',record.userName||'—'],
  [zh?'預約城市':'Reserved city',zh?record.wakeTargetCityZh||record.wakeTargetCity:record.wakeTargetCity],
  [zh?'預約響鈴：城市當地時間':'Alarm: target local time',scheduled],
  [zh?'預約城市時區':'Target time zone',record.wakeTargetTimeZone],
  [zh?'狀態':'Status',record.linkedWakeRecordId?(zh?'已確認醒來':'Awakening confirmed'):(zh?'待甦醒':'Awaiting awakening')],
  ...(actualRecord?[[zh?'實際甦醒位置':'Actual awakening position',`${getRecordCity(actualRecord,language)}, ${getRecordCountry(actualRecord,language)}`]]:[]),
  ...(record.linkedWakeRecordId?[[zh?'實際按鈕確認時間':'Actual button time',formatWakePressTime(record,language,true)],[zh?'距離實際甦醒位置':'Distance to actual awakening',formatWakeDistance(record)]]:[]),
 ];
 return <section className="space-y-6"><h3 className="font-mono text-sm font-bold uppercase tracking-widest text-[#a95018]">{zh?'預約甦醒位置':'Reserved awakening position'}</h3>
  <dl className="divide-y divide-black/10 border-y border-black/10">{rows.map(([label,value])=><div key={label} className="space-y-2 py-4"><dt className="font-mono text-[11px] tracking-wide text-gray-500">{label}</dt><dd className="break-words font-mono text-base text-gray-900">{value||'—'}</dd></div>)}</dl>
  <p className="font-mono text-xs leading-relaxed text-gray-500">{zh?'今天以預約城市的當地日期為準。鬧鐘響起並按下確認鍵後，才會出現黑色的實際甦醒位置；該城市依按鈕時間選址，並非 GPS 所在地。':'Today follows the reserved city’s local date. The black actual awakening point appears after an alarm acknowledgement. It is selected by button time, not GPS.'}</p>
 </section>;
}
