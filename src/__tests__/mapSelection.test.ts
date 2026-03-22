import test from "node:test";
import assert from "node:assert/strict";

import { getLatestRecord, getLatestRecordForUser } from "../mapSelection";
import type { NotionRecord } from "../types";

function createRecord(id: string, recordedAtDate?: string, userName?: string): NotionRecord {
  return {
    id,
    ...(userName ? { userName } : {}),
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

test("getLatestRecordForUser returns the newest record for a matching username", () => {
  const latest = getLatestRecordForUser(
    [
      createRecord("older", "2026-03-22T08:00:00.000Z", "YT"),
      createRecord("other", "2026-03-22T10:00:00.000Z", "ANNIE"),
      createRecord("latest", "2026-03-22T09:30:00.000Z", "yt"),
    ],
    "YT",
  );

  assert.equal(latest?.id, "latest");
});
