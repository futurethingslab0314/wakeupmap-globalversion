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
};

test("generateRecipe preserves the selected breakfast concept and highlightIngredients", async () => {
  const requests: OpenAITextRequest[] = [];
  const openai = {
    generateText: async (request: OpenAITextRequest) => {
      requests.push(request);
      return JSON.stringify({
        title: "Taipei Soy Milk Set",
        recipe: "Serve warm soy milk with crispy youtiao and chopped scallion.",
        highlightIngredients: ["soy milk", "youtiao", "scallion"],
      });
    },
  };

  const result = await generateRecipe({
    openai,
    breakfastConcept,
  });

  assert.equal(result.title, "Taipei Soy Milk Set");
  assert.equal(result.recipe, "Serve warm soy milk with crispy youtiao and chopped scallion.");
  assert.deepEqual(result.highlightIngredients, ["soy milk", "youtiao", "scallion"]);
  assert.match(requests[0].userPrompt, /Soy Milk and Youtiao/);
  assert.match(requests[0].userPrompt, /soy milk, youtiao, scallion/);
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
    recipe: {
      title: "Taipei Soy Milk Set",
      recipe: "Serve warm soy milk with crispy youtiao and chopped scallion.",
      highlightIngredients: ["soy milk", "youtiao", "scallion"],
    },
  });

  assert.deepEqual(result.imageBinary, new Uint8Array([1, 2, 3]));
  assert.match(result.prompt, /top view/i);
  assert.match(result.prompt, /single-serving/i);
  assert.match(result.prompt, /no people/i);
  assert.match(result.prompt, /no hands/i);
  assert.match(result.prompt, /no text/i);
  assert.match(result.prompt, /no logo/i);
  assert.match(result.prompt, /soy milk/i);
  assert.match(result.prompt, /youtiao/i);
  assert.equal(requests[0].prompt, result.prompt);
});
