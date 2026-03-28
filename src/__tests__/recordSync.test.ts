import test from "node:test";
import assert from "node:assert/strict";

import { getCompletedRecordFromSnapshot, isRecordPreparing } from "../recordSync";
import type { NotionRecord } from "../types";

function createRecord(overrides: Partial<NotionRecord> = {}): NotionRecord {
  return {
    id: "record-1",
    city: "Taipei",
    city_zh: "台北",
    country: "Taiwan",
    country_zh: "台灣",
    greeting: "早安",
    story: "Morning story",
    story_zh: "早晨故事",
    longitude: 121.5654,
    latitude: 25.033,
    imageUrl: "",
    recipe: "",
    utcOffset: 8,
    ...overrides,
  };
}

test("isRecordPreparing returns true when both recipe and image are still missing", () => {
  assert.equal(isRecordPreparing(createRecord(), "en"), true);
});

test("isRecordPreparing returns false once the image is available", () => {
  assert.equal(
    isRecordPreparing(createRecord({ imageUrl: "https://cdn.example.com/taipei.png" }), "en"),
    false,
  );
});

test("isRecordPreparing returns false once the localized recipe is available", () => {
  assert.equal(
    isRecordPreparing(createRecord({ recipe_zh: "食材：豆漿、油條。" }), "zh"),
    false,
  );
});

test("getCompletedRecordFromSnapshot returns the refreshed record once recipe and image are available", () => {
  const preparingRecord = createRecord();
  const completedRecord = createRecord({
    imageUrl: "https://cdn.example.com/taipei.png",
    recipe: "Soy milk and youtiao.",
  });

  assert.deepEqual(
    getCompletedRecordFromSnapshot(preparingRecord, [completedRecord], "en"),
    completedRecord,
  );
});

test("getCompletedRecordFromSnapshot ignores snapshots that are still preparing", () => {
  const preparingRecord = createRecord();

  assert.equal(
    getCompletedRecordFromSnapshot(preparingRecord, [createRecord()], "en"),
    null,
  );
});
