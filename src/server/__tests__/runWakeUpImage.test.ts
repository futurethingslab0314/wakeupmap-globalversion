import test from "node:test";
import assert from "node:assert/strict";

import { runWakeUpImage } from "../pipelines/runWakeUpImage";
import type { NotionCreatePageRequest, OpenAIImageRequest, OpenAITextRequest } from "../types";

test("runWakeUpImage writes recipe and image fields back to the existing Notion page", async () => {
  const updatedPages: Array<{ pageId: string; request: { properties: Record<string, unknown> } }> = [];
  const imageRequests: OpenAIImageRequest[] = [];
  const textRequests: OpenAITextRequest[] = [];

  const notion = {
    queryDatabase: async () => ({ results: [] }),
    createPage: async (_databaseId: string, _request: NotionCreatePageRequest) => ({ id: "unused" }),
    getDatabase: async () => ({
      properties: {
        Recipe: { type: "rich_text" },
        "Recipe ZH": { type: "rich_text" },
        "Image URL": { type: "url" },
        "Image Prompt": { type: "rich_text" },
      },
    }),
    updatePage: async (pageId: string, request: { properties: Record<string, unknown> }) => {
      updatedPages.push({ pageId, request });
      return {};
    },
  };

  const openai = {
    generateText: async (request: OpenAITextRequest) => {
      textRequests.push(request);
      return JSON.stringify({
        title: "Taipei Soy Milk Set",
        titleZh: "台北豆漿套餐",
        recipe: "Ingredients: soy milk, youtiao. Steps: serve warm. Total time: 10 minutes.",
        recipeZh: "食材：豆漿、油條。步驟：溫熱上桌。總時長：10 分鐘。",
        highlightIngredients: ["soy milk", "youtiao"],
        imagePrompt: "Top-down photo of a Taipei breakfast counter with soy milk and youtiao.",
        breakfastCategory: "street breakfast set",
        sceneSetting: "street-side breakfast counter",
        visualAnchors: ["paper cup", "metal soy milk pot"],
      });
    },
    generateImage: async (request: OpenAIImageRequest) => {
      imageRequests.push(request);
      return new Uint8Array([1, 2, 3]);
    },
  };

  const r2 = {
    upload: async (request: { key: string }) => ({
      key: request.key,
      url: `https://cdn.example.com/${request.key}`,
    }),
  };

  const result = await runWakeUpImage({
    request: {
      pageId: "page-123",
      city: "Taipei",
      cityZh: "台北",
      country: "Taiwan",
      countryZh: "台灣",
      recordedAtIso: "2026-03-25T00:00:00.000Z",
      breakfastName: "Soy Milk and Youtiao",
      breakfastNameZh: "豆漿油條",
      breakfastDescription: "A street-side Taipei breakfast set.",
      breakfastDescriptionZh: "台北街邊早餐組合。",
      highlightIngredients: ["soy milk", "youtiao"],
      breakfastCategory: "street breakfast set",
      sceneSetting: "street-side breakfast counter",
      visualAnchors: ["paper cup", "metal soy milk pot"],
      avoidRepeats: ["avoid cafe-table plating"],
    },
    databaseId: "db-123",
    notion,
    openai,
    r2,
  });

  assert.deepEqual(result, { ok: true, imageUrl: "https://cdn.example.com/wake-up-now/taipei/2026-03-25t00-00-00-000z.png" });
  assert.match(textRequests[0].userPrompt, /street-side breakfast counter/i);
  assert.match(imageRequests[0].prompt, /paper cup/i);
  assert.match(imageRequests[0].prompt, /avoid generic brunch/i);
  assert.equal(updatedPages[0].pageId, "page-123");
  const properties = updatedPages[0].request.properties as Record<string, any>;
  assert.equal(properties["Recipe"].rich_text[0].text.content, "Ingredients: soy milk, youtiao. Steps: serve warm. Total time: 10 minutes.");
  assert.equal(properties["Recipe ZH"].rich_text[0].text.content, "食材：豆漿、油條。步驟：溫熱上桌。總時長：10 分鐘。");
  assert.equal(properties["Image URL"].url, "https://cdn.example.com/wake-up-now/taipei/2026-03-25t00-00-00-000z.png");
  assert.equal(properties["Image Prompt"].rich_text[0].text.content, imageRequests[0].prompt);
});
