import React from 'react';
import type {WakeMapFilter as Filter} from '../reservationMap';
import type {UiLanguage} from '../i18n';
export const mapToolbarButtonClassName='px-1.5 py-1 lg:px-3 font-mono text-[9px] lg:text-[10px] leading-[15px] tracking-[0.02em] lg:tracking-[0.15em] whitespace-nowrap transition-colors';
export default function WakeMapFilter({value,onChange,language,pendingCount,actualCount}:{value:Filter;onChange:(v:Filter)=>void;language:UiLanguage;pendingCount:number;actualCount:number}){
 const zh=language==='zh';
 return <div role="group" aria-label={zh?'地圖位置篩選':'Map position filter'} className="flex shrink-0 border border-black/10 bg-white/95">
   {(['all','reservations','actual'] as const).map((item,i)=><button key={item} type="button" aria-pressed={value===item} onClick={()=>onChange(item)}
    className={`${mapToolbarButtonClassName} flex items-center justify-center gap-1 lg:gap-1.5 uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${value===item?'bg-black text-white':'text-gray-500 hover:text-black'}`}>
    {i>0?<span aria-hidden="true" className={i===1?'h-1.5 w-1.5 shrink-0 rounded-full border border-[#c46320] lg:h-2 lg:w-2':'h-1.5 w-1.5 shrink-0 rounded-full border border-white/60 bg-black lg:h-2 lg:w-2'}/>:null}
    {(zh?['全部','預約位置','實際位置']:['All','Reserved','Actual'])[i]}
    {i>0?<span className="opacity-60">{i===1?pendingCount:actualCount}</span>:null}
   </button>)}
 </div>;
}
