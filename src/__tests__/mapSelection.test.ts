import test from "node:test";
import assert from "node:assert/strict";

import {
  filterRecordsForUser,
  getLatestRecord,
  getLatestRecordForUser,
  getLatestRecordsForDateByUser,
  getRecordsSortedByRecordedAt,
  isMainView,
  shouldRecenterOnMainView,
} from "../mapSelection";
import type { NotionRecord } from "../types";

function createRecord(
  id: string,
  recordedAtDate?: string,
  userName?: string,
  options?: { recordedAt?: string; utcOffset?: number },
): NotionRecord {
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
    utcOffset: options?.utcOffset ?? 0,
    ...(options?.recordedAt ? { recordedAt: options.recordedAt } : {}),
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

test("getLatestRecord uses recordedAt to break ties within the same recordedAtDate", () => {
  const latest = getLatestRecord([
    createRecord("older-time", "2026-03-24", "YT", { recordedAt: "08:00:00", utcOffset: 8 }),
    createRecord("latest-time", "2026-03-24", "YT", { recordedAt: "09:30:00", utcOffset: 8 }),
  ]);

  assert.equal(latest?.id, "latest-time");
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

test("filterRecordsForUser returns only records for the confirmed username", () => {
  const filtered = filterRecordsForUser(
    [
      createRecord("one", "2026-03-22T08:00:00.000Z", "YT"),
      createRecord("two", "2026-03-22T09:00:00.000Z", "ANNIE"),
      createRecord("three", "2026-03-22T10:00:00.000Z", "yt"),
    ],
    "YT",
  );

  assert.deepEqual(filtered.map((record) => record.id), ["one", "three"]);
});

test("getLatestRecordsForDateByUser keeps only the newest record per user for the target day", () => {
  const filtered = getLatestRecordsForDateByUser(
    [
      createRecord("yt-older", "2026-03-24", "YT", { recordedAt: "01:00:00", utcOffset: 8 }),
      createRecord("annie-today", "2026-03-24", "ANNIE", { recordedAt: "02:00:00", utcOffset: 8 }),
      createRecord("yt-latest", "2026-03-24", "yt", { recordedAt: "03:00:00", utcOffset: 8 }),
      createRecord("annie-yesterday", "2026-03-23", "ANNIE", { recordedAt: "23:30:00", utcOffset: 8 }),
      createRecord("unknown-older", "2026-03-24", undefined, { recordedAt: "04:00:00", utcOffset: 8 }),
      createRecord("unknown-latest", "2026-03-24", undefined, { recordedAt: "05:00:00", utcOffset: 8 }),
    ],
    "2026-03-24",
  );

  assert.deepEqual(
    filtered.map((record) => record.id).sort(),
    ["annie-today", "unknown-latest", "yt-latest"],
  );
});

test("getRecordsSortedByRecordedAt orders records from newest to oldest", () => {
  const sorted = getRecordsSortedByRecordedAt([
    createRecord("middle", "2026-03-24", "YT", { recordedAt: "08:00:00", utcOffset: 8 }),
    createRecord("oldest", "2026-03-24", "YT", { recordedAt: "07:00:00", utcOffset: 8 }),
    createRecord("latest", "2026-03-24", "YT", { recordedAt: "09:00:00", utcOffset: 8 }),
  ]);

  assert.deepEqual(sorted.map((record) => record.id), ["latest", "middle", "oldest"]);
});

test("isMainView returns true only when no detail or journal panel is open", () => {
  assert.equal(
    isMainView({ showDatabase: false, selectedRecordId: null, selectedContinent: null }),
    true,
  );
  assert.equal(
    isMainView({ showDatabase: true, selectedRecordId: null, selectedContinent: null }),
    false,
  );
  assert.equal(
    isMainView({ showDatabase: false, selectedRecordId: "record-1", selectedContinent: null }),
    false,
  );
});

test("shouldRecenterOnMainView only triggers when returning to the initial view", () => {
  assert.equal(
    shouldRecenterOnMainView(
      { showDatabase: true, selectedRecordId: null, selectedContinent: null },
      { showDatabase: false, selectedRecordId: null, selectedContinent: null },
    ),
    true,
  );
  assert.equal(
    shouldRecenterOnMainView(
      { showDatabase: false, selectedRecordId: null, selectedContinent: null },
      { showDatabase: false, selectedRecordId: null, selectedContinent: null },
    ),
    false,
  );
  assert.equal(
    shouldRecenterOnMainView(
      { showDatabase: false, selectedRecordId: "record-1", selectedContinent: null },
      { showDatabase: false, selectedRecordId: "record-1", selectedContinent: null },
    ),
    false,
  );
});
