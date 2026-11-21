export interface WakeAcknowledgementMetadata {
  wakeEventId?: string;
  wakePressedAt?: string;
  wakeScheduledAt?: string;
  wakeTimeZone?: string;
  wakeTargetCity?: string;
  wakeTargetCityZh?: string;
  wakeTargetCountry?: string;
  wakeTargetCountryZh?: string;
  wakeTargetTimeZone?: string;
  wakeTargetLatitude?: number;
  wakeTargetLongitude?: number;
  wakeDistanceKm?: number;
  wakeDelaySeconds?: number;
}

export function readWakeAcknowledgement(properties: Record<string, unknown>): WakeAcknowledgementMetadata {
  const text = (name: string) => {
    const value = properties[name] as {rich_text?: Array<{plain_text?: string; text?: {content?: string}}> } | undefined;
    return value?.rich_text?.map(part => part.plain_text ?? part.text?.content ?? '').join('').trim() || undefined;
  };
  const date = (name: string) => (properties[name] as {date?: {start?: string}} | undefined)?.date?.start;
  const number = (name: string) => {
    const value = (properties[name] as {number?: unknown} | undefined)?.number;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  };
  const eventId = text('wakeuphere_event_id');
  if (!eventId) return {};
  return {
    wakeEventId: eventId, wakePressedAt: date('wakeuphere_pressed_at'), wakeScheduledAt: date('wakeuphere_scheduled_at'),
    wakeTimeZone: text('wakeuphere_client_timezone'), wakeTargetTimeZone: text('wakeuphere_target_timezone'),
    wakeTargetCity: text('wakeuphere_target_city'), wakeTargetCityZh: text('wakeuphere_target_city_zh'),
    wakeTargetCountry: text('wakeuphere_target_country'), wakeTargetCountryZh: text('wakeuphere_target_country_zh'),
    wakeTargetLatitude: number('wakeuphere_target_latitude'), wakeTargetLongitude: number('wakeuphere_target_longitude'),
    wakeDistanceKm: number('wakeuphere_distance_km'), wakeDelaySeconds: number('wakeuphere_delay_seconds'),
  };
}

export function formatWakePressTime(record: WakeAcknowledgementMetadata, language: 'en' | 'zh', withDate = false): string {
  if (!record.wakePressedAt || !Number.isFinite(Date.parse(record.wakePressedAt))) return '—';
  try {
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-TW' : 'en-GB', {
      timeZone: record.wakeTimeZone || 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      ...(withDate ? {year:'numeric',month:'2-digit',day:'2-digit'} as const : {}),
    }).format(new Date(record.wakePressedAt));
  } catch { return record.wakePressedAt; }
}

export function formatWakeDistance(record: WakeAcknowledgementMetadata): string {
  return typeof record.wakeDistanceKm === 'number' && Number.isFinite(record.wakeDistanceKm)
    ? `${record.wakeDistanceKm.toFixed(1)} km` : '—';
}
