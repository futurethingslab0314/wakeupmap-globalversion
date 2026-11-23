import { createWakeRoundStore } from "../src/server/services/wakeRoundStore.js";
import { getLocalDate, getScheduledMorning } from "../src/reservationMap.js";
import { getMapReservations } from "../src/server/services/wakeuphereMapBookings.js";
import { findWakeAcknowledgementPage, recordWakeAcknowledgement, wakeRoundId } from "../src/server/services/wakeuphereAcknowledgement.js";

type NotionPropertyDefinition = {
  type?: string;
  name?: string;
};

type NotionPageResponse = {
  properties?: Record<string, unknown>;
};

type NotionDatabaseResponse = {
  properties?: Record<string, NotionPropertyDefinition>;
};

type BookingPage = {
  id?: string;
  properties?: Record<string, unknown>;
  created_time?: string;
  last_edited_time?: string;
  archived?: boolean;
  in_trash?: boolean;
};
type NotionQueryResponse = { results?: BookingPage[] };

const DEFAULT_USER_NAME = "YuPie";
const CITY_KEYS = ["setup_city", "setup city", "city"];
const CITY_ZH_KEYS = ["setup_city_zh", "setup city zh", "city_zh", "city zh"];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function getPlainText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (typeof item === "object" && item !== null && "plain_text" in item ? String((item as { plain_text?: unknown }).plain_text ?? "") : ""))
    .join("")
    .trim();
}

function getTitleProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("title" in property)) return "";
  return getPlainText((property as { title?: unknown }).title);
}

function getRichTextProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("rich_text" in property)) return "";
  return getPlainText((property as { rich_text?: unknown }).rich_text);
}

function getSelectProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("select" in property)) return "";
  const value = (property as { select?: { name?: unknown } | null }).select;
  return typeof value?.name === "string" ? value.name : "";
}

function getCheckboxProperty(properties: Record<string, unknown>, key: string): boolean {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("checkbox" in property)) return false;
  return Boolean((property as { checkbox?: unknown }).checkbox);
}

function findPropertyName(properties: Record<string, NotionPropertyDefinition>, type: string, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeKey));
  for (const [name, definition] of Object.entries(properties)) {
    if (definition.type === type && aliasSet.has(normalizeKey(name))) {
      return name;
    }
  }
  return undefined;
}

function buildTextProperty(value: string) {
  return { rich_text: value ? [{ text: { content: value } }] : [] };
}

function buildTitleProperty(value: string) {
  return { title: value ? [{ text: { content: value } }] : [] };
}

async function loadDatabase(databaseId: string, apiKey: string): Promise<NotionDatabaseResponse> {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!response.ok) {
    throw new Error(`Notion database fetch failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as NotionDatabaseResponse;
}

async function loadAllPages(databaseId: string, apiKey: string): Promise<BookingPage[]> {
  const pages: BookingPage[] = [];
  let startCursor: string | undefined;

  for (;;) {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 100,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Notion query failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as NotionQueryResponse & { has_more?: boolean; next_cursor?: string | null };
    pages.push(...(payload.results ?? []));

    if (!payload.has_more || !payload.next_cursor) {
      break;
    }

    startCursor = payload.next_cursor;
  }

  return pages;
}

function pickRequestQuery(request: { url?: string }) {
  if (!request.url) return new URLSearchParams();
  try {
    return new URL(request.url, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function readTextProperty(properties: Record<string, unknown>, key: string, schema?: Record<string, NotionPropertyDefinition>): string {
  const propertyType = schema?.[key]?.type;
  if (propertyType === "title") return getTitleProperty(properties, key);
  if (propertyType === "rich_text") return getRichTextProperty(properties, key);
  return getRichTextProperty(properties, key) || getTitleProperty(properties, key);
}

const ACTIVE_FIELD = "wakeuphere_active";
const UPDATED_FIELD = "wakeuphere_updated_at";

function textField(schema: Record<string, NotionPropertyDefinition>, aliases: string[]) {
  return findPropertyName(schema, "rich_text", aliases) ?? findPropertyName(schema, "title", aliases);
}

function booking(page: BookingPage, schema: Record<string, NotionPropertyDefinition>) {
  const properties = page.properties ?? {};
  const read = (aliases: string[]) => {
    const key = textField(schema, aliases);
    return key ? readTextProperty(properties, key, schema) : "";
  };
  const date = properties[UPDATED_FIELD] as { date?: { start?: string } | null } | undefined;
  const updatedAt = Date.parse(date?.date?.start ?? "");
  return {
    page,
    userName: read(["userName", "user name", "name"]),
    city: read(CITY_KEYS), cityZh: read(CITY_ZH_KEYS),
    country: read(["setup_country", "setup country", "country"]),
    countryZh: read(["setup_country_zh", "setup country zh", "country_zh", "country zh"]),
    active: getCheckboxProperty(properties, ACTIVE_FIELD),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

function latestBookings(pages: BookingPage[], schema: Record<string, NotionPropertyDefinition>) {
  const latest = new Map<string, ReturnType<typeof booking>>();
  const records = pages.filter(p => !p.archived && !p.in_trash).map(p => booking(p, schema));
  const timestamp = (value?: string) => Date.parse(value ?? "") || 0;
  records.sort((a, b) =>
    Number(b.updatedAt > 0) - Number(a.updatedAt > 0) || b.updatedAt - a.updatedAt ||
    timestamp(b.page.last_edited_time) - timestamp(a.page.last_edited_time) ||
    timestamp(b.page.created_time) - timestamp(a.page.created_time) ||
    (b.page.id ?? "").localeCompare(a.page.id ?? ""));
  for (const record of records) {
    const key = normalizeKey(record.userName);
    if (key && !latest.has(key)) latest.set(key, record);
  }
  return [...latest.values()];
}

function matchesLocation(record: ReturnType<typeof booking>, city: string, cityZh: string, country: string, countryZh: string) {
  const matches = (en: string, zh: string, currentEn: string, currentZh: string) =>
    Boolean((normalizeKey(en) && normalizeKey(en) === normalizeKey(currentEn)) ||
      (normalizeKey(zh) && normalizeKey(zh) === normalizeKey(currentZh)));
  return matches(city, cityZh, record.city, record.cityZh) &&
    (!(country || countryZh) || matches(country, countryZh, record.country, record.countryZh));
}

async function ensureBookingSchema(databaseId: string, apiKey: string, schema: Record<string, NotionPropertyDefinition>, needsCountry: boolean) {
  const additions: Record<string, unknown> = {};
  for (const [name, type] of [[ACTIVE_FIELD, "checkbox"], [UPDATED_FIELD, "date"]]) {
    if (schema[name] && schema[name].type !== type) throw new Error(`Notion field ${name} must be ${type}`);
    if (!schema[name]) additions[name] = { [type]: {} };
  }
  if (needsCountry && !textField(schema, ["setup_country", "setup country", "country"])) {
    if (schema.setup_country) throw new Error("Notion setup_country must be a text field");
    additions.setup_country = { rich_text: {} };
  }
  if (!Object.keys(additions).length) return;
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify({ properties: additions }),
  });
  if (!response.ok) throw new Error(`Cannot add booking fields to Notion database: ${response.status}`);
  for (const [name, definition] of Object.entries(additions)) schema[name] = { type: Object.keys(definition as object)[0] };
}

export default async function handler(
  request: { method?: string; body?: Record<string, unknown>; url?: string },
  response: {
    status(code: number): { json(payload: unknown): unknown };
    json(payload: unknown): unknown;
    setHeader?(name: string, value: string | string[]): unknown;
  },
) {
  response.setHeader?.("Cache-Control", "no-store");
  try {
    if (request.method !== "GET" && request.method !== "POST") {
      response.setHeader?.("Allow", "GET, POST");
      return response.status(405).json({ error: "Method Not Allowed" });
    }
    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.WAKEUPHERE_PAGE_ID;
    if (request.method === "POST" && request.body?.action === "wake-map" && !databaseId) {
      return response.status(200).json({ ok: true, hasReservation: false });
    }
    if (!apiKey || !databaseId) return response.status(500).json({ error: "Missing NOTION_API_KEY or WAKEUPHERE_PAGE_ID" });
    const query = pickRequestQuery(request);
    const isRoundRead = request.method === "GET" && query.get("view") === "wake-round";
    const isRingingUpdate = request.method === "POST" && request.body?.action === "alarm-ringing";
    if (isRoundRead || isRingingUpdate) {
      const get = (name: string) => String((isRoundRead ? query.get(name) : request.body?.[name]) || "");
      const user = get("userName"), city = get("city"), country = get("country");
      const scheduled = new Date(get("scheduledAt"));
      const mapDatabaseId = process.env.NOTION_DATABASE_ID;
      if (!mapDatabaseId) throw Error("Missing WakeUp Map NOTION_DATABASE_ID");
      if (!normalizeKey(user) || !city || !country || !Number.isFinite(scheduled.getTime())) {
        return response.status(400).json({ error: "Missing wake round identity" });
      }
      const store = createWakeRoundStore(mapDatabaseId);
      if (isRingingUpdate) {
        if (scheduled.getTime() > Date.now()) return response.status(400).json({ error: "Alarm is not due" });
        await store.publishRinging(JSON.stringify([normalizeKey(user), city, country]), scheduled.toISOString());
        return response.status(200).json({ ok: true });
      }
      const id = wakeRoundId(user, city, country, scheduled);
      const claim = await store.getClaim(id);
      const confirmed = Boolean(claim && await findWakeAcknowledgementPage(id, { apiKey, databaseId: mapDatabaseId }));
      return response.status(200).json({ confirmed, pending: Boolean(claim) && !confirmed });
    }
    const database = await loadDatabase(databaseId, apiKey);
    const schema = database.properties ?? {};
    const userField = textField(schema, ["userName", "user name", "name"]);
    const cityField = textField(schema, CITY_KEYS);
    const cityZhField = textField(schema, CITY_ZH_KEYS);
    let countryField = textField(schema, ["setup_country", "setup country", "country"]);
    const countryZhField = textField(schema, ["setup_country_zh", "setup country zh", "country_zh", "country zh"]);
    const pressField = findPropertyName(schema, "checkbox", ["press"]) ?? findPropertyName(schema, "select", ["press"]);
    if (!userField || (!cityField && !cityZhField)) throw new Error("Notion database needs userName and city fields");
    const records = latestBookings(await loadAllPages(databaseId, apiKey), schema);

    if (request.method === "GET") {
      if (query.get("view") === "map") {
        return response.status(200).json({ reservations: getMapReservations(records), refreshedAt: new Date().toISOString() });
      }
      const city = query.get("setup_city") || query.get("city") || "";
      const cityZh = query.get("setup_city_zh") || query.get("city_zh") || "";
      const country = query.get("setup_country") || query.get("country") || "";
      const countryZh = query.get("setup_country_zh") || query.get("country_zh") || "";
      const user = normalizeKey(query.get("userName") || query.get("user_name") || "");
      // Deduplicate BEFORE filtering active/location: an inactive latest record
      // must suppress all of that user's previous active locations.
      const matched = records.filter(r => r.active && r.updatedAt > 0 && Boolean(r.city || r.cityZh) &&
        (!user || normalizeKey(r.userName) === user) &&
        (!(city || cityZh) || matchesLocation(r, city, cityZh, country, countryZh)));
      const first = matched[0];
      const properties = first?.page.properties ?? {};
      return response.status(200).json({ pageId: databaseId, pageCount: matched.length,
        matched: Boolean(first), userName: first?.userName ?? DEFAULT_USER_NAME,
        users: matched.map(r => r.userName),
        press: pressField ? schema[pressField]?.type === "checkbox" ? getCheckboxProperty(properties, pressField) : getSelectProperty(properties, pressField) === "yes" : false,
      });
    }

    const body = request.body ?? {};
    const user = typeof body.userName === "string" ? body.userName.trim() : "";
    const action = body.action ?? (body.press === "yes" ? "dismiss" : "reserve");
    const read = (name: string) => typeof body[name] === "string" ? (body[name] as string).trim() : "";
    const city = read("setup_city"), cityZh = read("setup_city_zh");
    const country = read("setup_country"), countryZh = read("setup_country_zh");
    if (action === "wake-map") {
      if (!normalizeKey(user)) return response.status(400).json({ error: "Missing userName" });
      const booking = records.find(record => record.active && normalizeKey(record.userName) === normalizeKey(user));
      if (!booking) return response.status(200).json({ ok: true, hasReservation: false });
      const pressed = new Date(read("clientIsoTime"));
      if (!Number.isFinite(pressed.getTime())) return response.status(400).json({ error: "Invalid wake time" });
      // Looking one day ahead also includes reservations made after today's 08:00.
      const [reservation] = getMapReservations([booking], new Date(pressed.getTime() + 86_400_000));
      if (!reservation) throw Error("The active reservation could not be resolved");
      const today = getScheduledMorning(pressed, reservation.timeZone);
      let scheduledAt = booking.updatedAt <= Date.parse(today) ? today : reservation.scheduledAt;
      const mapDatabaseId = process.env.NOTION_DATABASE_ID;
      if (!mapDatabaseId) throw Error("Missing WakeUp Map NOTION_DATABASE_ID");
      const store = createWakeRoundStore(mapDatabaseId);
      const ringing = await store.getRinging(JSON.stringify([normalizeKey(user), reservation.city, reservation.country]));
      if (ringing && ringing.getTime() >= booking.updatedAt && ringing <= pressed && ringing.toISOString() < scheduledAt &&
          getScheduledMorning(ringing, reservation.timeZone) === ringing.toISOString()) {
        const claim = await store.getClaim(wakeRoundId(user, reservation.city, reservation.country, ringing));
        if (!claim || (claim.modifiedAt && getLocalDate(claim.modifiedAt, reservation.timeZone) >=
            getLocalDate(pressed, reservation.timeZone))) {
          scheduledAt = ringing.toISOString();
        }
      }
      const result = await recordWakeAcknowledgement({
        userName: user, setup_city: reservation.city, setup_country: reservation.country,
        wakeEvent: { ...body, pressedAt: pressed.toISOString(), scheduledAt },
      }, { apiKey, databaseId: mapDatabaseId, allowEarly: true, roundStore: store });
      return response.status(result.id ? 200 : 202).json({ ok: true, hasReservation: true, wakeRecordId: result.id, record: result.record });
    }
    if (!user || !["reserve", "cancel", "dismiss"].includes(String(action)) ||
        (action === "reserve" && !(city || cityZh))) {
      return response.status(400).json({ error: "Valid userName, action and reservation city are required" });
    }
    const current = records.find(r => normalizeKey(r.userName) === normalizeKey(user));
    const sameLocation = current && matchesLocation(current, city, cityZh, country, countryZh);
    let wakeRecordId: string | undefined;
    if (action === "dismiss" && body.wakeEvent) {
      const mapDatabaseId = process.env.NOTION_DATABASE_ID;
      if (!mapDatabaseId) throw new Error("Missing WakeUp Map NOTION_DATABASE_ID");
      const wakeRecord = await recordWakeAcknowledgement({
        userName: user, setup_city: city, setup_city_zh: cityZh,
        setup_country: country, setup_country_zh: countryZh, wakeEvent: body.wakeEvent,
      }, { apiKey, databaseId: mapDatabaseId, roundStore: createWakeRoundStore(mapDatabaseId) });
      if (!wakeRecord.id) return response.status(202).json({ ok: true, action, pending: true });
      wakeRecordId = wakeRecord.id;
    }
    if (action !== "reserve" && (!current || !sameLocation || (action === "dismiss" && !current.active))) {
      return response.status(200).json({ ok: true, ignored: true, action, ...(wakeRecordId ? { wakeRecordId } : {}) });
    }
    if (action !== "dismiss") {
      await ensureBookingSchema(databaseId, apiKey, schema, action === "reserve" && Boolean(country));
      countryField = textField(schema, ["setup_country", "setup country", "country"]);
    }
    const properties: Record<string, unknown> = {};
    const setText = (key: string | undefined, value: string) => {
      if (key) properties[key] = schema[key]?.type === "title" ? buildTitleProperty(value) : buildTextProperty(value);
    };
    setText(userField, user);
    if (action === "reserve") {
      setText(cityField, city); setText(cityZhField, cityZh);
      setText(countryField, country); setText(countryZhField, countryZh);
    }
    if (action !== "dismiss") {
      properties[ACTIVE_FIELD] = { checkbox: action === "reserve" };
      // A Pi reload re-sends the same active reservation. It must not move
      // the original booking past today's 08:00 deadline. Rebooking after
      // cancellation or moving to another city still gets a new timestamp.
      if (!(action === "reserve" && current?.active && sameLocation && current.updatedAt > 0)) {
        properties[UPDATED_FIELD] = { date: { start: new Date().toISOString() } };
      }
    }
    if (pressField && (action !== "reserve" || !current?.active || !sameLocation)) {
      properties[pressField] = schema[pressField]?.type === "checkbox"
        ? { checkbox: action === "dismiss" }
        : { select: action === "dismiss" ? { name: "yes" } : null };
    }
    const id = current?.page.id;
    const result = await fetch(id ? `https://api.notion.com/v1/pages/${id}` : "https://api.notion.com/v1/pages", {
      method: id ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify(id ? { properties } : { parent: { database_id: databaseId }, properties }),
    });
    if (!result.ok) throw new Error(`Notion booking update failed: ${result.status}`);
    return response.status(200).json({ ok: true, action, created: !id, userName: user, active: action !== "cancel",
      ...(wakeRecordId ? { wakeRecordId } : {}),
      setup_city: action === "reserve" ? city : current?.city, ...(action === "dismiss" ? { press: "yes" } : {}) });
  } catch (error) {
    return response.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}
