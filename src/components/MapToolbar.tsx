import React from 'react';
import {Globe2} from 'lucide-react';
import WakeMapFilter,{mapToolbarButtonClassName} from './WakeMapFilter';
import type {WakeMapFilter as Filter} from '../reservationMap';
import {uiText,type UiLanguage} from '../i18n';
export default function MapToolbar({language,onLanguageChange,value,onFilterChange,pendingCount,actualCount,showFilter=true}:{language:UiLanguage;onLanguageChange:(lang:UiLanguage)=>void;value:Filter;onFilterChange:(value:Filter)=>void;pendingCount:number;actualCount:number;showFilter?:boolean}){
 return <div className="flex max-w-full items-center justify-between gap-2 lg:justify-end lg:gap-4" data-map-toolbar="true">
  {showFilter?<WakeMapFilter value={value} onChange={onFilterChange} language={language} pendingCount={pendingCount} actualCount={actualCount}/>:null}
  <div className="flex shrink-0 items-center gap-3">
   <Globe2 className="hidden h-3.5 w-3.5 text-gray-400 lg:block"/>
   <div role="group" aria-label={language==='zh'?'語言':'Language'} className="flex border border-black/10 bg-white/95">
    {(['en','zh'] as const).map(lang=><button key={lang} type="button" aria-pressed={language===lang} onClick={()=>onLanguageChange(lang)} className={`${mapToolbarButtonClassName} ${language===lang?'bg-black text-white':'text-gray-500 hover:text-black'}`}>{lang==='en'?uiText[language].english:uiText[language].chinese}</button>)}
   </div>
  </div>
 </div>;
}
