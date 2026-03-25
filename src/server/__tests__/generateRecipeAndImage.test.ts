import test from "node:test";
import assert from "node:assert/strict";

import { generateRecipe } from "../skills/generateRecipe";
import { generateBreakfastImage } from "../skills/generateBreakfastImage";
import type { BreakfastConcept, OpenAIImageRequest, OpenAITextRequest } from "../types";

const breakfastConcept: BreakfastConcept = {
  name: "Soy Milk and Youtiao",
  nameZh: "豆漿油條",
  description: "A classic Taiwanese breakfast pairing.",
  descriptionZh: "經典台式早餐組合。",
  highlightIngredients: ["soy milk", "youtiao", "scallion"],
  breakfastCategory: "street breakfast set",
  sceneSetting: "street-side breakfast counter in Taipei",
  visualAnchors: ["metal soy milk pot", "paper cup", "narrow breakfast shop counter"],
  avoidRepeats: ["avoid cafe-table plating"],
};

test("generateRecipe creates a practical bilingual single-serving recipe with matched image prompt", async () => {
  const requests: OpenAITextRequest[] = [];
  const openai = {
    generateText: async (request: OpenAITextRequest) => {
      requests.push(request);
      return JSON.stringify({
        title: "Taipei Soy Milk Set",
        titleZh: "台北豆漿套餐",
        recipe: "Ingredients: 240 ml soy milk, 1 youtiao, 1 tbsp chopped scallion. Steps: Warm the soy milk, slice the youtiao, and serve together. Total time: 10 minutes.",
        recipeZh: "食材：豆漿 240 毫升、油條 1 根、蔥花 1 大匙。步驟：加熱豆漿，切好油條，一起上桌。總時長：10 分鐘。",
        highlightIngredients: ["soy milk", "youtiao", "scallion"],
        imagePrompt: "Top-down photo of a single-person Taipei breakfast with soy milk, youtiao, and scallion on a simple table.",
      });
    },
  };

  const result = await generateRecipe({
    openai,
    breakfastConcept,
    cityName: "Taipei",
    countryName: "Taiwan",
    cityNameZh: "台北",
    countryNameZh: "台灣",
  });

  assert.equal(result.title, "Taipei Soy Milk Set");
  assert.equal(result.titleZh, "台北豆漿套餐");
  assert.match(result.recipe, /Ingredients:/);
  assert.match(result.recipe, /Total time:/);
  assert.match(result.recipeZh ?? "", /食材：/);
  assert.match(result.recipeZh ?? "", /總時長：/);
  assert.deepEqual(result.highlightIngredients, ["soy milk", "youtiao", "scallion"]);
  assert.match(result.imagePrompt ?? "", /Top-down photo/i);
  assert.match(requests[0].userPrompt, /Soy Milk and Youtiao/);
  assert.match(requests[0].userPrompt, /soy milk, youtiao, scallion/);
  assert.match(requests[0].userPrompt, /single-serving/i);
  assert.match(requests[0].userPrompt, /image prompt/i);
  assert.match(requests[0].userPrompt, /street-side breakfast counter in Taipei/i);
  assert.match(requests[0].userPrompt, /metal soy milk pot, paper cup, narrow breakfast shop counter/i);
  assert.equal(requests[0].responseFormat?.type, "json_schema");
  assert.equal(requests[0].responseFormat?.name, "breakfast_recipe");
});

test("generateRecipe reports an empty JSON response with a clear error", async () => {
  const openai = {
    generateText: async () => "",
  };

  await assert.rejects(
    () =>
      generateRecipe({
        openai,
        breakfastConcept,
        cityName: "Taipei",
        countryName: "Taiwan",
        cityNameZh: "台北",
        countryNameZh: "台灣",
      }),
    /empty json/i,
  );
});

test("generateBreakfastImage produces a constrained OpenAI image prompt consistent with recipe ingredients", async () => {
  const requests: OpenAIImageRequest[] = [];
  const openai = {
    generateImage: async (request: OpenAIImageRequest) => {
      requests.push(request);
      return new Uint8Array([1, 2, 3]);
    },
  };

  const result = await generateBreakfastImage({
    openai,
    cityName: "Taipei",
    countryName: "Taiwan",
    recipe: {
      title: "Taipei Soy Milk Set",
      recipe: "Ingredients: 240 ml soy milk, 1 youtiao, 1 tbsp chopped scallion. Steps: Warm the soy milk, slice the youtiao, and serve together. Total time: 10 minutes.",
      recipeZh: "食材：豆漿 240 毫升、油條 1 根、蔥花 1 大匙。步驟：加熱豆漿，切好油條，一起上桌。總時長：10 分鐘。",
      highlightIngredients: ["soy milk", "youtiao", "scallion"],
      imagePrompt: "Top-down photo of a single-person Taipei breakfast with soy milk, youtiao, and scallion on a simple table.",
      breakfastCategory: "street breakfast set",
      sceneSetting: "street-side breakfast counter in Taipei",
      visualAnchors: ["metal soy milk pot", "paper cup", "narrow breakfast shop counter"],
    },
  });

  assert.deepEqual(result.imageBinary, new Uint8Array([1, 2, 3]));
  assert.match(result.prompt, /top view/i);
  assert.match(result.prompt, /single-person/i);
  assert.match(result.prompt, /no people/i);
  assert.match(result.prompt, /no hands/i);
  assert.match(result.prompt, /no text/i);
  assert.match(result.prompt, /no logo/i);
  assert.match(result.prompt, /realistic textures/i);
  assert.match(result.prompt, /tabletop/i);
  assert.match(result.prompt, /soy milk/i);
  assert.match(result.prompt, /youtiao/i);
  assert.match(result.prompt, /Taiwan/i);
  assert.match(result.prompt, /street-side breakfast counter in Taipei/i);
  assert.match(result.prompt, /metal soy milk pot/i);
  assert.match(result.prompt, /paper cup/i);
  assert.match(result.prompt, /avoid generic brunch/i);
  assert.equal(requests[0].prompt, result.prompt);
});
