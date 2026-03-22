import test from "node:test";
import assert from "node:assert/strict";

import { cityMapping } from "../../data/cityMapping";
import { selectCity } from "../skills/selectCity";
import type { CityMappingRecord, NormalizedNotionRecord } from "../types";

function createCity(overrides: Partial<CityMappingRecord>): CityMappingRecord {
  return {
    id: "city",
    city: "City",
    cityZh: "城市",
    country: "Country",
    countryZh: "國家",
    latitude: 0,
    longitude: 0,
    utcOffset: 0,
    population: 1,
    greetingHint: "Good morning",
    languageCode: "en",
    ...overrides,
  };
}

function createRecord(city: string): NormalizedNotionRecord {
  return {
    id: city,
    city,
    cityZh: city,
    country: "Country",
    countryZh: "國家",
    greeting: "Hello",
    story: "Story",
    storyZh: "故事",
    recipe: "Recipe",
    imageUrl: "https://example.com/image.jpg",
    latitude: 0,
    longitude: 0,
    utcOffset: 0,
  };
}

test("selectCity picks the city closest to local 08:00", () => {
  const result = selectCity({
    nowUtcIso: "2026-03-22T00:20:00.000Z",
    cities: [
      createCity({ id: "taipei", city: "Taipei", utcOffset: 8 }),
      createCity({ id: "bangkok", city: "Bangkok", utcOffset: 7 }),
      createCity({ id: "tokyo", city: "Tokyo", utcOffset: 9 }),
    ],
    recentRecords: [],
  });

  assert.equal(result.city.id, "taipei");
  assert.equal(result.minuteDiffToEight, 20);
  assert.equal(result.isRecentlyUsed, false);
  assert.match(result.evaluatedAtUtc, /2026-03-22T00:20:00.000Z/);
});

test("selectCity breaks ties with higher population", () => {
  const result = selectCity({
    nowUtcIso: "2026-03-22T00:30:00.000Z",
    cities: [
      createCity({ id: "taipei", city: "Taipei", utcOffset: 8, population: 2500000 }),
      createCity({ id: "bangkok", city: "Bangkok", utcOffset: 7, population: 10500000 }),
    ],
    recentRecords: [],
  });

  assert.equal(result.city.id, "bangkok");
  assert.equal(result.minuteDiffToEight, 30);
});

test("selectCity uses timezone rules when available instead of relying on static utcOffset", () => {
  const result = selectCity({
    nowUtcIso: "2026-07-01T12:00:00.000Z",
    cities: [
      createCity({
        id: "new-york",
        city: "New York",
        country: "United States",
        timezone: "America/New_York",
        utcOffset: -5,
        population: 8000000,
      }),
      createCity({
        id: "lima",
        city: "Lima",
        country: "Peru",
        timezone: "America/Lima",
        utcOffset: -5,
        population: 11000000,
      }),
    ],
    recentRecords: [],
  });

  assert.equal(result.city.id, "new-york");
  assert.equal(result.minuteDiffToEight, 0);
});

test("selectCity uses recent records only as a tie-breaker after time proximity", () => {
  const result = selectCity({
    nowUtcIso: "2026-03-22T00:00:00.000Z",
    cities: [
      createCity({ id: "taipei", city: "Taipei", utcOffset: 8, population: 2500000 }),
      createCity({ id: "hong-kong", city: "Hong Kong", utcOffset: 8.25, population: 7500000 }),
    ],
    recentRecords: [
      createRecord("Taipei"),
      createRecord("Paris"),
      createRecord("London"),
      createRecord("Tokyo"),
      createRecord("Sydney"),
      createRecord("Bangkok"),
      createRecord("New York"),
    ],
  });

  assert.equal(result.city.id, "taipei");
  assert.equal(result.isRecentlyUsed, true);
  assert.equal(result.minuteDiffToEight, 0);
});

test("cityMapping exports a typed starter dataset", () => {
  assert.ok(cityMapping.length >= 5);
  assert.ok(cityMapping.every((city) => typeof city.languageCode === "string"));
});
