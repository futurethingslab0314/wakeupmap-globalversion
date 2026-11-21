import React from 'react';
import type {WakeMapFilter as Filter} from '../reservationMap';
import type {UiLanguage} from '../i18n';
export default function WakeMapFilter({value,onChange,language,pendingCount,actualCount}:{value:Filter;onChange:(v:Filter)=>void;language:UiLanguage;pendingCount:number;actualCount:number}){
 const zh=language==='zh';
 return <div className="max-w-full space-y-2 font-mono">
  <div role="group" aria-label={zh?'地圖位置篩選':'Map position filter'} className="flex border border-black/15 bg-white/95 p-1">
   {(['all','reservations','actual'] as const).map((item,i)=><button key={item} type="button" aria-pressed={value===item} onClick={()=>onChange(item)}
    className={`flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${value===item?'bg-black text-white':'text-gray-600 hover:bg-black/5'}`}>
    {i>0?<span aria-hidden="true" className={i===1?'h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#c46320]':'h-2.5 w-2.5 shrink-0 rounded-full border border-white/60 bg-black'}/>:null}
    {(zh?['全部','預約位置','實際位置']:['All','Reserved','Actual'])[i]}
    {i>0?<span className="opacity-60">{i===1?pendingCount:actualCount}</span>:null}
   </button>)}
  </div>
  <p className="text-[9px] leading-relaxed tracking-wide text-gray-500">{zh?'橘圈：預約甦醒位置 · 黑點：實際甦醒位置':'Orange ring: reserved · Black dot: actual awakening'}</p>
  <p className="text-[9px] leading-relaxed text-gray-500">{zh?'預約點為今天；以預約城市當地日期為準。實際點保留歷史紀錄。':'Reservations: today in each target city. Actual points include history.'}</p>
 </div>;
}
