import test from "node:test";
import assert from "node:assert/strict";

import { readFromNotion } from "../skills/readFromNotion";

const notionPage = {
  id: "page-1",
  properties: {
    City: { type: "title", title: [{ plain_text: "Taipei" }] },
    "City ZH": { type: "rich_text", rich_text: [{ plain_text: "台北" }] },
    Country: { type: "rich_text", rich_text: [{ plain_text: "Taiwan" }] },
    "Country ZH": { type: "rich_text", rich_text: [{ plain_text: "台灣" }] },
    Greeting: { type: "rich_text", rich_text: [{ plain_text: "Zao An" }] },
    Story: { type: "rich_text", rich_text: [{ plain_text: "Morning market" }] },
    "Story ZH": { type: "rich_text", rich_text: [{ plain_text: "清晨市場" }] },
    Recipe: { type: "rich_text", rich_text: [{ plain_text: "Soy milk and youtiao" }] },
    "Breakfast Name": { type: "rich_text", rich_text: [{ plain_text: "Soy Milk and Youtiao" }] },
    "Breakfast Name ZH": { type: "rich_text", rich_text: [{ plain_text: "豆漿油條" }] },
    "Breakfast Description": { type: "rich_text", rich_text: [{ plain_text: "A quick Taipei breakfast set." }] },
    "Breakfast Description ZH": { type: "rich_text", rich_text: [{ plain_text: "快速的台北早餐組合。" }] },
    "Highlight Ingredients": { type: "rich_text", rich_text: [{ plain_text: "soy milk, youtiao, scallion" }] },
    "Image Prompt": { type: "rich_text", rich_text: [{ plain_text: "Top view Taipei breakfast counter." }] },
    Tone: { type: "select", select: { name: "observant" } },
    Motifs: { type: "multi_select", multi_select: [{ name: "steam" }, { name: "morning scooters" }] },
    "Breakfast Category": { type: "select", select: { name: "street breakfast set" } },
    "Scene Setting": { type: "select", select: { name: "street-side breakfast counter" } },
    "Visual Anchors": { type: "multi_select", multi_select: [{ name: "paper cup" }, { name: "metal soy milk pot" }] },
    "Avoid Repeats": { type: "rich_text", rich_text: [{ plain_text: "Avoid cafe-table scenes" }] },
    Latitude: { type: "number", number: 25.033 },
    Longitude: { type: "number", number: 121.5654 },
    "UTC Offset": { type: "number", number: 8 },
    "Image URL": { type: "url", url: "https://cdn.example.com/taipei.jpg" },
    "Recorded At": { type: "date", date: { start: "2026-03-22T08:00:00.000+08:00" } },
  },
};

test("readFromNotion normalizes Notion properties into the UI record shape", async () => {
  const notion = {
    queryDatabase: async () => ({ results: [notionPage] }),
  };

  const records = await readFromNotion({
    notion,
    databaseId: "db-123",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].id, "page-1");
  assert.equal(records[0].city, "Taipei");
  assert.equal(records[0].city_zh, "台北");
  assert.equal(records[0].country, "Taiwan");
  assert.equal(records[0].country_zh, "台灣");
  assert.equal(records[0].story, "Morning market");
  assert.equal(records[0].story_zh, "清晨市場");
  assert.equal(records[0].breakfastName, "Soy Milk and Youtiao");
  assert.equal(records[0].breakfastNameZh, "豆漿油條");
  assert.equal(records[0].breakfastDescription, "A quick Taipei breakfast set.");
  assert.equal(records[0].breakfastDescriptionZh, "快速的台北早餐組合。");
  assert.equal(records[0].highlightIngredients, "soy milk, youtiao, scallion");
  assert.equal(records[0].imagePrompt, "Top view Taipei breakfast counter.");
  assert.equal(records[0].tone, "observant");
  assert.deepEqual(records[0].motifs, ["steam", "morning scooters"]);
  assert.equal(records[0].breakfastCategory, "street breakfast set");
  assert.equal(records[0].sceneSetting, "street-side breakfast counter");
  assert.deepEqual(records[0].visualAnchors, ["paper cup", "metal soy milk pot"]);
  assert.equal(records[0].avoidRepeats, "Avoid cafe-table scenes");
  assert.equal(records[0].imageUrl, "https://cdn.example.com/taipei.jpg");
  assert.equal(records[0].recordedAtDate, "2026-03-22T08:00:00.000+08:00");
});

test("readFromNotion safely handles missing bilingual fields", async () => {
  const notion = {
    queryDatabase: async () => ({
      results: [
        {
          id: "page-2",
          properties: {
            City: { type: "title", title: [{ plain_text: "Paris" }] },
            Country: { type: "rich_text", rich_text: [{ plain_text: "France" }] },
            Story: { type: "rich_text", rich_text: [{ plain_text: "Croissant sunrise" }] },
            Recipe: { type: "rich_text", rich_text: [{ plain_text: "Croissant" }] },
            Latitude: { type: "number", number: 48.8566 },
            Longitude: { type: "number", number: 2.3522 },
            "UTC Offset": { type: "number", number: 1 },
            "Image URL": { type: "url", url: "https://cdn.example.com/paris.jpg" },
          },
        },
      ],
    }),
  };

  const [record] = await readFromNotion({
    notion,
    databaseId: "db-123",
  });

  assert.equal(record.city_zh, "Paris");
  assert.equal(record.country_zh, "France");
  assert.equal(record.story_zh, "Croissant sunrise");
  assert.equal(record.imageUrl, "https://cdn.example.com/paris.jpg");
  assert.deepEqual(record.motifs, []);
  assert.deepEqual(record.visualAnchors, []);
});
