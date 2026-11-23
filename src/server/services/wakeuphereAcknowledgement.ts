import { normalizePage } from '../../../api/notion-data.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { captureWakeUpContext, getDistanceBetweenCoordinates, getRecentCityNames, selectCity } from '../../../api/wake-up-now.js';

type Schema = Record<string, { type?: string }>;
export type WakeAcknowledgementInput = { userName: string; setup_city?: string; setup_city_zh?: string; setup_country?: string; setup_country_zh?: string; wakeEvent: unknown };
type RawCity = { city: string; city_zh?: string; country: string; country_zh?: string; latitude: number; longitude: number; timezone: string };
let rawCities: RawCity[] | undefined;
const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');
const text = (value: string) => ({ rich_text: [{ text: { content: value } }] });
const metadata: Record<string, string> = {
  wakeuphere_event_id: 'rich_text', wakeuphere_user_name: 'rich_text',
  wakeuphere_pressed_at: 'date', wakeuphere_scheduled_at: 'date',
  wakeuphere_target_city: 'rich_text', wakeuphere_target_city_zh: 'rich_text',
  wakeuphere_target_country: 'rich_text', wakeuphere_target_country_zh: 'rich_text',
  wakeuphere_target_latitude: 'number', wakeuphere_target_longitude: 'number',
  wakeuphere_target_timezone: 'rich_text', wakeuphere_client_timezone: 'rich_text',
  wakeuphere_distance_km: 'number', wakeuphere_delay_seconds: 'number',
};

export function wakeRoundId(userName: string, city: string, country: string, scheduled: Date) {
  return createHash('sha256').update(JSON.stringify([
    normalize(userName), city, country, scheduled.toISOString(),
  ])).digest('hex');
}

export async function findWakeAcknowledgementPage(eventId: string, config: { apiKey: string; databaseId: string }) {
  const response = await fetch(`https://api.notion.com/v1/databases/${config.databaseId}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_size: 1, filter: { property: 'wakeuphere_event_id', rich_text: { equals: eventId } } }),
  });
  if (!response.ok) throw Error(`Wake record lookup failed (${response.status})`);
  const { results } = await response.json();
  return results?.[0] as { id: string; properties?: Record<string, unknown> } | undefined;
}

type RoundStore = Pick<ReturnType<typeof import('./wakeRoundStore.js').createWakeRoundStore>, 'claim' | 'release'>;

export async function recordWakeAcknowledgement(
  input: WakeAcknowledgementInput,
  config: { apiKey: string; databaseId: string; roundStore?: RoundStore; allowEarly?: boolean },
) {
  const event = input.wakeEvent as Record<string, unknown> | null;
  if (!input.userName.trim() || !event || typeof event !== 'object') throw Error('Invalid wake acknowledgement');
  const parseTime = (value: unknown) => {
    if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
      throw Error('Wake event requires an explicit timestamp with timezone');
    return new Date(value);
  };
  const pressed = parseTime(event.pressedAt), scheduled = parseTime(event.scheduledAt);
  if (!config.allowEarly && pressed < scheduled) throw Error('Wake acknowledgement cannot precede the alarm');
  if (typeof event.clientTimeZone !== 'string') throw Error('Missing wake acknowledgement timezone');
  new Intl.DateTimeFormat('en', { timeZone: event.clientTimeZone }).format(pressed);
  if (!rawCities) rawCities = JSON.parse(readFileSync(new URL('../../../cities_data.json', import.meta.url), 'utf8'));
  const target = rawCities!.find(city =>
    ((input.setup_city && normalize(city.city) === normalize(input.setup_city)) ||
      (input.setup_city_zh && normalize(city.city_zh || '') === normalize(input.setup_city_zh))) &&
    ((input.setup_country && normalize(city.country) === normalize(input.setup_country)) ||
      (input.setup_country_zh && normalize(city.country_zh || '') === normalize(input.setup_country_zh))));
  if (!target) throw Error('Reserved city is not in the city dataset');
  const scheduledParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: target.timezone, hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
  }).format(scheduled);
  if (scheduledParts !== '08:00:00' || scheduled.getUTCMilliseconds() !== 0)
    throw Error('Wake event must refer to the city-local 08:00 alarm');
  const eventId = wakeRoundId(input.userName, target.city, target.country, scheduled);
  const early = pressed < scheduled;
  const headers = { Authorization: `Bearer ${config.apiKey}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch('https://api.notion.com/v1/' + path, {
      method, headers, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw Error(`Wake record persistence failed (${response.status})`);
    return response.json();
  };
  const database = await request('databases/' + config.databaseId);
  const schema: Schema = database.properties ?? {};
  const find = (type: string, aliases: string[]) => Object.keys(schema).find(key =>
    schema[key]?.type === type && aliases.some(alias => normalize(alias) === normalize(key)));
  const title = find('title', ['userName', 'user name', 'name', 'title']) || Object.keys(schema).find(key => schema[key]?.type === 'title');
  if (!title) throw Error('WakeUp Map database needs a title field');
  const additions: Record<string, unknown> = {};
  for (const [key, type] of Object.entries(metadata)) {
    if (schema[key] && schema[key].type !== type) throw Error(`Wake record field ${key} must be ${type}`);
    if (!schema[key]) additions[key] = { [type]: {} };
  }
  const standard: Array<[string, string, string[]]> = [
    ['city','rich_text',['city']], ['city_zh','rich_text',['city zh','cityZh','city_zh']],
    ['country','rich_text',['country']], ['country_zh','rich_text',['country zh','countryZh','country_zh']],
    ['latitude','number',['latitude']], ['longitude','number',['longitude','longtitude']],
    ['recordedAtDate','date',['recordedAtDate','date']], ['recordedAt','rich_text',['recordedAt','local time']],
    ['timezone','rich_text',['timezone']], ['greeting','rich_text',['greeting']],
    ['story','rich_text',['story']], ['story_zh','rich_text',['story zh','storyZh','story_zh']],
  ];
  for (const [key,type,aliases] of standard) if (!find(type,aliases)) {
    if (schema[key]) throw Error(`WakeUp Map field ${key} has an incompatible type`);
    additions[key] = { [type]: {} };
  }
  if (Object.keys(additions).length) {
    await request('databases/' + config.databaseId, 'PATCH', { properties: additions });
    for (const [key, definition] of Object.entries(additions)) schema[key] = { type: Object.keys(definition as object)[0] };
  }
  const findExisting = async () => {
    const page = await findWakeAcknowledgementPage(eventId, config);
    return page?.id ? { id: page.id, record: normalizePage(page), existing: true } : undefined;
  };
  const existing = await findExisting();
  if (existing) return existing;

  const base: { currentBaseLatitude?: number; currentBaseLongitude?: number } = {};
  if (event.currentBaseLatitude !== undefined || event.currentBaseLongitude !== undefined) {
    if (typeof event.currentBaseLatitude !== 'number' || !Number.isFinite(event.currentBaseLatitude) || Math.abs(event.currentBaseLatitude) > 90 ||
        typeof event.currentBaseLongitude !== 'number' || !Number.isFinite(event.currentBaseLongitude) || Math.abs(event.currentBaseLongitude) > 180)
      throw Error('Invalid saved WakeUp Map current base');
    base.currentBaseLatitude = event.currentBaseLatitude;
    base.currentBaseLongitude = event.currentBaseLongitude;
  }
  const selectionInput = { userName: input.userName.trim(), clientIsoTime: pressed.toISOString(),
    nowUtcIso: pressed.toISOString(), clientTimeZone: event.clientTimeZone, ...base };
  const context = captureWakeUpContext(selectionInput);
  const recent = await getRecentCityNames(config.apiKey, config.databaseId);
  const city = selectCity(pressed.toISOString(), recent, selectionInput, context);
  const distanceKm = getDistanceBetweenCoordinates(target, city);
  const properties: Record<string, unknown> = {
    [title]: { title: [{ text: { content: input.userName.trim() } }] },
    wakeuphere_event_id: text(eventId), wakeuphere_user_name: text(input.userName.trim()),
    wakeuphere_pressed_at: { date: { start: pressed.toISOString() } },
    wakeuphere_scheduled_at: { date: { start: scheduled.toISOString() } },
    wakeuphere_target_city: text(target.city), wakeuphere_target_city_zh: text(target.city_zh || target.city),
    wakeuphere_target_country: text(target.country), wakeuphere_target_country_zh: text(target.country_zh || target.country),
    wakeuphere_target_latitude: { number: target.latitude }, wakeuphere_target_longitude: { number: target.longitude },
    wakeuphere_target_timezone: text(target.timezone), wakeuphere_client_timezone: text(event.clientTimeZone),
    wakeuphere_distance_km: { number: distanceKm },
    wakeuphere_delay_seconds: { number: (pressed.getTime() - scheduled.getTime()) / 1000 },
  };
  const values: Record<string, unknown> = {
    city: city.city, city_zh: city.cityZh, country: city.country, country_zh: city.countryZh,
    latitude: city.latitude, longitude: city.longitude, recordedAtDate: context.recordedAtDate,
    recordedAt: context.recordedAt, timezone: event.clientTimeZone, greeting: 'AWAKE // 已醒來',
    story: early ? 'Awoke before the scheduled alarm.' : 'Scheduled alarm acknowledged.',
    story_zh: early ? '已提前醒來，跳過本輪鬧鐘。' : '已確認醒來，停止本輪鬧鐘。',
  };
  for (const [key,type,aliases] of standard) {
    const name = find(type,aliases)!;
    properties[name] = type === 'number' ? { number: values[key] } : type === 'date'
      ? { date: { start: values[key] } } : text(String(values[key]));
  }
  const offsetField = find('number',['utc offset','utcOffset']);
  if (offsetField) properties[offsetField] = { number: city.utcOffset };
  const store = config.roundStore;
  if (store && !await store.claim(eventId)) return await findExisting() ?? { id: undefined, record: undefined, existing: true };

  // A lost response or server error can still mean Notion created the page.
  // Keep the claim in that case so a retry cannot create a second page.
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST', headers, body: JSON.stringify({ parent: { database_id: config.databaseId }, properties }),
  });
  if (!response.ok) {
    if (store && [400, 401, 403, 404, 429].includes(response.status)) await store.release(eventId);
    throw Error(`Wake record persistence failed (${response.status})`);
  }
  const created = await response.json();
  if (!created.id) throw Error('WakeUp Map did not return a record ID');
  return { id: created.id as string, record: normalizePage(created), existing: false };
}
