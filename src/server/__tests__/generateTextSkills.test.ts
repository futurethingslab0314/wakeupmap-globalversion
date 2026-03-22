import test from "node:test";
import assert from "node:assert/strict";

import { generateGreeting } from "../skills/generateGreeting";
import { generateStory } from "../skills/generateStory";
import { generateLocalBreakfast } from "../skills/generateLocalBreakfast";
import type { CityMappingRecord, OpenAITextRequest } from "../types";

function createCity(overrides: Partial<CityMappingRecord> = {}): CityMappingRecord {
  return {
    id: "taipei",
    city: "Taipei",
    cityZh: "台北",
    country: "Taiwan",
    countryZh: "台灣",
    latitude: 25.033,
    longitude: 121.5654,
    utcOffset: 8,
    population: 2493000,
    greetingHint: "Warm Taiwanese morning greeting",
    languageCode: "zh-TW",
    ...overrides,
  };
}

test("generateGreeting builds a local-language request from languageCode and greetingHint", async () => {
  const requests: OpenAITextRequest[] = [];
  const openai = {
    generateText: async (request: OpenAITextRequest) => {
      requests.push(request);
      return "早安！";
    },
  };

  const result = await generateGreeting({
    openai,
    city: createCity(),
  });

  assert.equal(result, "早安！");
  assert.equal(requests.length, 1);
  assert.match(requests[0].userPrompt, /Taipei, Taiwan/);
  assert.match(requests[0].userPrompt, /most widely used local language/i);
  assert.match(requests[0].userPrompt, /3 to 20/i);
  assert.match(requests[0].userPrompt, /Return only the greeting/i);
});

test("generateStory builds bilingual output constraints including the required opening line", async () => {
  const requests: OpenAITextRequest[] = [];
  const openai = {
    generateText: async (request: OpenAITextRequest) => {
      requests.push(request);
      return JSON.stringify({
        story: "You wake up in Taipei to the scent of soy milk.",
        storyZh: "你在台北的豆漿香氣中醒來。",
      });
    },
  };

  const result = await generateStory({
    openai,
    city: createCity(),
    greeting: "早安！",
    userName: "YT",
  });

  assert.equal(result.story, "You wake up in Taipei to the scent of soy milk.");
  assert.equal(result.storyZh, "你在台北的豆漿香氣中醒來。");
  assert.match(requests[0].userPrompt, /Today you wake up in Taipei, Taiwan\./);
  assert.match(requests[0].userPrompt, /今天的你甦醒在台灣的台北。/);
  assert.match(requests[0].userPrompt, /lesser-known historical detail/i);
  assert.match(requests[0].userPrompt, /under 150/i);
  assert.match(requests[0].userPrompt, /YT/);
});

test("generateLocalBreakfast returns concept fields and canonical highlightIngredients", async () => {
  const openai = {
    generateText: async () =>
      JSON.stringify({
        name: "Soy Milk and Youtiao",
        nameZh: "豆漿油條",
        description: "A classic Taiwanese breakfast pairing.",
        descriptionZh: "經典台式早餐組合。",
        highlightIngredients: ["soy milk", "youtiao", "scallion"],
      }),
  };

  const result = await generateLocalBreakfast({
    openai,
    city: createCity(),
  });

  assert.equal(result.name, "Soy Milk and Youtiao");
  assert.equal(result.nameZh, "豆漿油條");
  assert.deepEqual(result.highlightIngredients, ["soy milk", "youtiao", "scallion"]);
});
