import test from "node:test";
import assert from "node:assert/strict";

import { getLatestRecord } from "../mapSelection";
import type { NotionRecord } from "../types";

function createRecord(id: string, recordedAtDate?: string): NotionRecord {
  return {
    id,
    city: id,
    city_zh: id,
    country: "Country",
    country_zh: "國家",
    greeting: "Hello",
    story: "Story",
    story_zh: "故事",
    recipe: "Recipe",
    recipe_zh: "食譜",
    longitude: 0,
    latitude: 0,
    imageUrl: "",
    utcOffset: 0,
    ...(recordedAtDate ? { recordedAtDate } : {}),
  };
}

test("getLatestRecord returns the newest record by recordedAtDate", () => {
  const latest = getLatestRecord([
    createRecord("older", "2026-03-22T08:00:00.000Z"),
    createRecord("latest", "2026-03-22T09:30:00.000Z"),
    createRecord("middle", "2026-03-22T08:45:00.000Z"),
  ]);

  assert.equal(latest?.id, "latest");
});

test("getLatestRecord falls back safely when dates are missing", () => {
  const latest = getLatestRecord([
    createRecord("undated"),
    createRecord("dated", "2026-03-22T09:30:00.000Z"),
  ]);

  assert.equal(latest?.id, "dated");
});
