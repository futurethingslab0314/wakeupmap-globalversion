import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { captureWakeUpContext, getDistanceBetweenCoordinates, getRecentCityNames, selectCity } from '../../../api/wake-up-now.ts';

type Schema = Record<string, { type?: string }>;
type Input = { userName: string; setup_city?: string; setup_city_zh?: string; setup_country?: string; setup_country_zh?: string; wakeEvent: unknown };
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

export async function recordWakeAcknowledgement(input: Input, config: { apiKey: string; databaseId: string }) {
  const event = input.wakeEvent as Record<string, unknown> | null;
  if (!input.userName.trim() || !event || typeof event !== 'object') throw Error('Invalid wake acknowledgement');
  const parseTime = (value: unknown) => {
    if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
      throw Error('Wake event requires an explicit timestamp with timezone');
    return new Date(value);
  };
  const pressed = parseTime(event.pressedAt), scheduled = parseTime(event.scheduledAt);
  if (pressed < scheduled) throw Error('Wake acknowledgement cannot precede the alarm');
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
  const eventId = createHash('sha256').update(JSON.stringify([
    normalize(input.userName), target.city, target.country, scheduled.toISOString(),
  ])).digest('hex');
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
  const existing = await request(`databases/${config.databaseId}/query`, 'POST', {
    page_size: 1, filter: { property: 'wakeuphere_event_id', rich_text: { equals: eventId } },
  });
  if (existing.results?.[0]?.id) return { id: existing.results[0].id, existing: true };

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
    story: 'WakeUpHere alarm acknowledged. The wake city is selected by WakeUp Map at the button-press time; it is not GPS location.',
    story_zh: '已按下 WakeUpHere 鬧鐘確認鍵。醒來城市依按鈕時間套用 WakeUp Map 選址規則，並非 GPS 實際所在地。',
  };
  for (const [key,type,aliases] of standard) {
    const name = find(type,aliases)!;
    properties[name] = type === 'number' ? { number: values[key] } : type === 'date'
      ? { date: { start: values[key] } } : text(String(values[key]));
  }
  const offsetField = find('number',['utc offset','utcOffset']);
  if (offsetField) properties[offsetField] = { number: city.utcOffset };
  const created = await request('pages', 'POST', { parent: { database_id: config.databaseId }, properties });
  if (!created.id) throw Error('WakeUp Map did not return a record ID');
  return { id: created.id, existing: false };
}
