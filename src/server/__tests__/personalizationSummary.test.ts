import test from "node:test";
import assert from "node:assert/strict";

import { buildPersonalizationSummary } from "../skills/buildPersonalizationSummary";
import type { NormalizedNotionRecord } from "../types";

function createRecord(overrides: Partial<NormalizedNotionRecord> = {}): NormalizedNotionRecord {
  return {
    id: "record-1",
    city: "Taipei",
    cityZh: "台北",
    city_zh: "台北",
    country: "Taiwan",
    countryZh: "台灣",
    country_zh: "台灣",
    greeting: "早安",
    story: "Morning market",
    storyZh: "清晨市場",
    story_zh: "清晨市場",
    recipe: "Soy milk and youtiao",
    imageUrl: "https://cdn.example.com/taipei.jpg",
    latitude: 25.033,
    longitude: 121.5654,
    utcOffset: 8,
    tone: "observant",
    motifs: ["steam", "market"],
    breakfastName: "Soy Milk and Youtiao",
    breakfastCategory: "street breakfast set",
    sceneSetting: "street-side breakfast counter",
    visualAnchors: ["paper cup", "metal soy milk pot"],
    ...overrides,
  };
}

test("buildPersonalizationSummary derives repetition controls from recent records", () => {
  const summary = buildPersonalizationSummary({
    recentRecords: [
      createRecord(),
      createRecord({
        id: "record-2",
        motifs: ["steam", "scooters"],
        visualAnchors: ["paper cup", "narrow breakfast shop counter"],
      }),
      createRecord({
        id: "record-3",
        breakfastName: "Scallion Pancake and Soy Milk",
        visualAnchors: ["paper cup"],
      }),
    ],
  });

  assert.match(summary.recentPatterns.join(" "), /observant/i);
  assert.match(summary.recentPatterns.join(" "), /street breakfast set/i);
  assert.match(summary.stablePreferences.join(" "), /paper cup/i);
  assert.match(summary.avoidRepeats.join(" "), /Soy Milk and Youtiao/i);
  assert.match(summary.avoidRepeats.join(" "), /street-side breakfast counter/i);
  assert.match(summary.confidenceNotes, /recent repetition/i);
});

test("buildPersonalizationSummary stays lightweight for sparse history", () => {
  const summary = buildPersonalizationSummary({
    recentRecords: [createRecord()],
  });

  assert.equal(summary.recentPatterns.length, 1);
  assert.equal(summary.stablePreferences.length, 0);
  assert.match(summary.avoidRepeats.join(" "), /Soy Milk and Youtiao/i);
});
