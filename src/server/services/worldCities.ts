import { readFileSync } from "node:fs";

import type { CityMappingRecord } from "../types.ts";

interface RawWorldCity {
  city: string;
  city_zh?: string;
  country: string;
  country_zh?: string;
  country_iso_code?: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

let cachedCities: RawWorldCity[] | undefined;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseShortOffset(value: string): number {
  const normalized = value.replace("UTC", "GMT");

  if (normalized === "GMT") {
    return 0;
  }

  const match = normalized.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * (hours + minutes / 60);
}

export function getUtcOffsetHoursAt(nowUtcIso: string, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(new Date(nowUtcIso));
  const offsetText = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  return parseShortOffset(offsetText);
}

function isUsableCity(city: RawWorldCity): boolean {
  const lowered = `${city.city} ${city.country}`.toLowerCase();

  if (city.country === "Antarctica") {
    return false;
  }

  return !/(station|research station|base|camp)$/.test(lowered);
}

function loadRawCities(): RawWorldCity[] {
  if (cachedCities) {
    return cachedCities;
  }

  const fileUrl = new URL("../../../cities_data.json", import.meta.url);
  const fileContent = readFileSync(fileUrl, "utf-8");
  const parsed = JSON.parse(fileContent) as RawWorldCity[];

  cachedCities = parsed.filter(isUsableCity);
  return cachedCities;
}

export function loadWorldCities(nowUtcIso: string): CityMappingRecord[] {
  return loadRawCities().map((city) => ({
    id: `${slugify(city.country)}-${slugify(city.city)}`,
    city: city.city,
    cityZh: city.city_zh ?? city.city,
    country: city.country,
    countryZh: city.country_zh ?? city.country,
    countryIsoCode: city.country_iso_code,
    timezone: city.timezone,
    latitude: city.latitude,
    longitude: city.longitude,
    utcOffset: getUtcOffsetHoursAt(nowUtcIso, city.timezone),
    population: 0,
    greetingHint: `Natural everyday morning greeting used in ${city.city}, ${city.country}`,
    languageCode: city.country_iso_code ? `${city.country_iso_code.toLowerCase()}` : "local",
  }));
}
