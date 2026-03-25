import test from "node:test";
import assert from "node:assert/strict";

import { runWakeUpNow } from "../pipelines/runWakeUpNow";
import type {
  CityMappingRecord,
  NotionCreatePageRequest,
  NotionQueryResult,
  OpenAITextRequest,
  R2UploadResult,
} from "../types";

const city: CityMappingRecord = {
  id: "taipei",
  city: "Taipei",
  cityZh: "台北",
  country: "Taiwan",
  countryZh: "台灣",
  timezone: "Asia/Taipei",
  latitude: 25.033,
  longitude: 121.5654,
  utcOffset: 8,
  population: 2493000,
  greetingHint: "Warm Taiwanese morning greeting",
  languageCode: "zh-TW",
};

test("runWakeUpNow writes structured story and breakfast fields to Notion and returns an image job", async () => {
  const createdPages: NotionCreatePageRequest[] = [];
  const textRequests: OpenAITextRequest[] = [];

  const notion = {
    queryDatabase: async (): Promise<NotionQueryResult> => ({
      results: [
        {
          id: "old-1",
          properties: {
            "User Name": { type: "title", title: [{ plain_text: "YT" }] },
            City: { type: "title", title: [{ plain_text: "Taipei" }] },
            Country: { type: "rich_text", rich_text: [{ plain_text: "Taiwan" }] },
            Story: { type: "rich_text", rich_text: [{ plain_text: "Old story" }] },
            Tone: { type: "rich_text", rich_text: [{ plain_text: "soft" }] },
            Motifs: { type: "rich_text", rich_text: [{ plain_text: "steam" }] },
            "Breakfast Name": { type: "rich_text", rich_text: [{ plain_text: "Soy Milk and Youtiao" }] },
            "Breakfast Category": { type: "rich_text", rich_text: [{ plain_text: "street breakfast set" }] },
            "Scene Setting": { type: "rich_text", rich_text: [{ plain_text: "street-side breakfast counter" }] },
            "Visual Anchors": { type: "rich_text", rich_text: [{ plain_text: "paper cup" }] },
          },
        },
      ],
    }),
    getDatabase: async () => ({
      properties: {
        "User Name": { type: "title" },
        City: { type: "rich_text" },
        "City ZH": { type: "rich_text" },
        Country: { type: "rich_text" },
        "Country ZH": { type: "rich_text" },
        Greeting: { type: "rich_text" },
        Story: { type: "rich_text" },
        "Story ZH": { type: "rich_text" },
        "Breakfast Name": { type: "rich_text" },
        "Breakfast Name ZH": { type: "rich_text" },
        "Breakfast Description": { type: "rich_text" },
        "Breakfast Description ZH": { type: "rich_text" },
        "Highlight Ingredients": { type: "rich_text" },
        "Image Prompt": { type: "rich_text" },
        Tone: { type: "rich_text" },
        Motifs: { type: "rich_text" },
        "Breakfast Category": { type: "rich_text" },
        "Scene Setting": { type: "rich_text" },
        "Visual Anchors": { type: "rich_text" },
        "Avoid Repeats": { type: "rich_text" },
        Recipe: { type: "rich_text" },
        "Recipe ZH": { type: "rich_text" },
        Latitude: { type: "number" },
        Longitude: { type: "number" },
        "UTC Offset": { type: "number" },
        "Image URL": { type: "url" },
        "Recorded At": { type: "date" },
        Timezone: { type: "rich_text" },
      },
    }),
    createPage: async (_databaseId: string, request: NotionCreatePageRequest) => {
      createdPages.push(request);
      return { id: "page-123" };
    },
    updatePage: async () => {
      throw new Error("updatePage should not be used in wake-up-now");
    },
  };

  const openai = {
    generateText: async (request: OpenAITextRequest) => {
      textRequests.push(request);
      if (/morning greeting/i.test(request.systemPrompt)) {
        return "早安";
      }
      if (/Translate place names/i.test(request.systemPrompt)) {
        return JSON.stringify({ cityZh: "台北", countryZh: "台灣" });
      }
      if (/grounded bilingual wake-up vignette/i.test(request.systemPrompt)) {
        return JSON.stringify({
          story: "Today you wake up in Taipei, Taiwan. Steam curls near the scooter-lined lane.",
          storyZh: "今天的你甦醒在台灣的台北。機車排成巷口，熱氣慢慢升起。",
          tone: "observant",
          motifs: ["steam", "scooter lane"],
        });
      }

      return JSON.stringify({
        name: "Soy Milk and Youtiao",
        nameZh: "豆漿油條",
        description: "A street-side Taipei breakfast set.",
        descriptionZh: "台北街邊早餐組合。",
        highlightIngredients: ["soy milk", "youtiao", "scallion"],
        breakfastCategory: "street breakfast set",
        sceneSetting: "street-side breakfast counter",
        visualAnchors: ["paper cup", "metal soy milk pot"],
        avoidRepeats: ["avoid cafe-table plating"],
      });
    },
    generateImage: async () => new Uint8Array([1]),
  };

  const result = await runWakeUpNow({
    request: {
      language: "en",
      userName: "YT",
      nowUtcIso: "2026-03-25T00:00:00.000Z",
      clientTimeZone: "Asia/Taipei",
      clientIsoTime: "2026-03-25T08:00:00.000+08:00",
    },
    databaseId: "db-123",
    notion,
    openai,
    cities: [city],
  });

  assert.equal(result.record.id, "page-123");
  assert.equal(result.record.breakfastName, "Soy Milk and Youtiao");
  assert.equal(result.record.tone, "observant");
  assert.deepEqual(result.record.motifs, ["steam", "scooter lane"]);
  assert.deepEqual(result.record.visualAnchors, ["paper cup", "metal soy milk pot"]);
  assert.equal(result.imageJob?.pageId, "page-123");
  assert.deepEqual(result.imageJob?.highlightIngredients, ["soy milk", "youtiao", "scallion"]);

  const properties = createdPages[0].properties as Record<string, any>;
  assert.equal(properties["Breakfast Name"].rich_text[0].text.content, "Soy Milk and Youtiao");
  assert.equal(properties["Breakfast Name ZH"].rich_text[0].text.content, "豆漿油條");
  assert.equal(properties["Breakfast Description"].rich_text[0].text.content, "A street-side Taipei breakfast set.");
  assert.equal(properties["Image Prompt"].rich_text[0].text.content, "");
  assert.equal(properties["Tone"].rich_text[0].text.content, "observant");
  assert.equal(properties["Motifs"].rich_text[0].text.content, "steam, scooter lane");
  assert.equal(properties["Breakfast Category"].rich_text[0].text.content, "street breakfast set");
  assert.equal(properties["Scene Setting"].rich_text[0].text.content, "street-side breakfast counter");
  assert.equal(properties["Visual Anchors"].rich_text[0].text.content, "paper cup, metal soy milk pot");
  assert.equal(properties["Avoid Repeats"].rich_text[0].text.content, "avoid cafe-table plating");
  assert.match(textRequests.map((request) => request.userPrompt).join("\n"), /recent tone: soft/i);
});
