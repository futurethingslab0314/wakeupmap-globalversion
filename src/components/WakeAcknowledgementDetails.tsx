import React from 'react';
import type { NotionRecord } from '../types';
import { formatWakeDistance, formatWakePressTime } from '../wakeAcknowledgement';
import { getRecordCity, getRecordCountry, type UiLanguage } from '../i18n';

export default function WakeAcknowledgementDetails({ record, language }: { record: NotionRecord; language: UiLanguage }) {
  const zh = language === 'zh';
  const target = zh ? record.wakeTargetCityZh || record.wakeTargetCity : record.wakeTargetCity;
  const targetCountry = zh ? record.wakeTargetCountryZh || record.wakeTargetCountry : record.wakeTargetCountry;
  let scheduled = record.wakeScheduledAt || '—';
  try {
    if (record.wakeScheduledAt) scheduled = new Intl.DateTimeFormat(zh ? 'zh-TW' : 'en-GB', {
      timeZone: record.wakeTargetTimeZone || 'UTC', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
    }).format(new Date(record.wakeScheduledAt));
  } catch {}
  const delay = typeof record.wakeDelaySeconds === 'number' ? Math.max(0,Math.floor(record.wakeDelaySeconds)) : null;
  const rows = [
    [zh ? '帳號' : 'Account', record.userName || '—'],
    [zh ? '醒來確認：按鈕時間' : 'Awake: button pressed at', formatWakePressTime(record,language,true)],
    [zh ? '按鈕時間的時區' : 'Button time zone', record.wakeTimeZone || 'UTC'],
    [zh ? '預約城市' : 'Reserved city', [target,targetCountry].filter(Boolean).join(', ') || '—'],
    [zh ? '預約響鈴：城市當地時間' : 'Scheduled alarm: target local time', scheduled],
    [zh ? '醒來城市：依時間選址' : 'Wake city: selected by time', `${getRecordCity(record,language)}, ${getRecordCountry(record,language)}`],
    [zh ? '距離預約城市' : 'Distance from reserved city', formatWakeDistance(record)],
    [zh ? '響鈴後多久確認' : 'Time until acknowledgement', delay === null ? '—' : zh
      ? `${Math.floor(delay/60)} 分 ${delay%60} 秒` : `${Math.floor(delay/60)} min ${delay%60} sec`],
  ];
  return <section className="space-y-6">
    <h3 className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-gray-900">
      {zh ? 'WakeUpHere 醒來紀錄' : 'WakeUpHere awakening record'}
    </h3>
    <dl className="divide-y divide-black/10 border-y border-black/10">
      {rows.map(([label,value]) => <div key={label} className="space-y-2 py-4">
        <dt className="font-mono text-[11px] uppercase tracking-wider text-gray-500">{label}</dt>
        <dd className="break-words font-mono text-base leading-relaxed text-gray-900">{value}</dd>
      </div>)}
    </dl>
    <p className="font-mono text-xs leading-relaxed text-gray-500">
      {zh ? '按下確認鍵代表「我醒來了」。醒來城市套用按鈕當下的 WakeUp Map 選址規則，並非 GPS 所在地；距離為兩個城市座標間的球面距離。'
        : 'Pressing confirm means “I am awake”. The wake city follows WakeUp Map’s rules at the button time; it is not GPS location. Distance is the great-circle distance between the two city coordinates.'}
    </p>
  </section>;
}
