import test from "node:test";
import assert from "node:assert/strict";

import { generateGreeting } from "../skills/generateGreeting";
import { generateStory } from "../skills/generateStory";
import { generateLocalBreakfast } from "../skills/generateLocalBreakfast";
import type {
  CityMappingRecord,
  OpenAITextRequest,
  PersonalizationSummary,
} from "../types";

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
        tone: "observant",
        motifs: ["street-side breakfast", "soft steam"],
      });
    },
  };

  const personalization: PersonalizationSummary = {
    recentPatterns: ["Recently used nostalgic openings and market scenes."],
    stablePreferences: ["Leans toward intimate, reflective mornings."],
    avoidRepeats: ["Avoid repeating market-stall openings", "Avoid soy milk as the first sensory image"],
    confidenceNotes: "Recent repetition is strong; stable preference is weak.",
  };

  const result = await generateStory({
    openai,
    city: createCity(),
    greeting: "早安！",
    userName: "YT",
    personalization,
  });

  assert.equal(result.story, "You wake up in Taipei to the scent of soy milk.");
  assert.equal(result.storyZh, "你在台北的豆漿香氣中醒來。");
  assert.equal(result.tone, "observant");
  assert.deepEqual(result.motifs, ["street-side breakfast", "soft steam"]);
  assert.match(requests[0].userPrompt, /Today you wake up in Taipei, Taiwan\./);
  assert.match(requests[0].userPrompt, /今天的你甦醒在台灣的台北。/);
  assert.match(requests[0].userPrompt, /lesser-known historical detail/i);
  assert.match(requests[0].userPrompt, /under 150/i);
  assert.match(requests[0].userPrompt, /YT/);
  assert.match(requests[0].userPrompt, /Avoid repeating market-stall openings/i);
  assert.match(requests[0].userPrompt, /Leans toward intimate, reflective mornings/i);
  assert.match(requests[0].userPrompt, /Return JSON with keys story, storyZh, tone, motifs/i);
  assert.equal(requests[0].responseFormat?.type, "json_schema");
  assert.equal(requests[0].responseFormat?.name, "wake_up_story");
});

test("generateStory accepts JSON wrapped in a markdown code fence", async () => {
  const openai = {
      generateText: async () => `\`\`\`json
{"story":"Today you wake up in Taipei, Taiwan.","storyZh":"今天的你甦醒在台灣的台北。","tone":"warm","motifs":["tram bells","stone alleys"]}
\`\`\``,
  };

  const result = await generateStory({
    openai,
    city: createCity(),
    greeting: "早安！",
    userName: "YT",
  });

  assert.equal(result.story, "Today you wake up in Taipei, Taiwan.");
  assert.equal(result.storyZh, "今天的你甦醒在台灣的台北。");
  assert.equal(result.tone, "warm");
  assert.deepEqual(result.motifs, ["tram bells", "stone alleys"]);
});

test("generateLocalBreakfast returns concept fields and canonical highlightIngredients", async () => {
  const requests: OpenAITextRequest[] = [];
  const openai = {
    generateText: async (request: OpenAITextRequest) => {
      requests.push(request);
      return JSON.stringify({
        name: "Soy Milk and Youtiao",
        nameZh: "豆漿油條",
        description: "A classic Taiwanese breakfast pairing.",
        descriptionZh: "經典台式早餐組合。",
        highlightIngredients: ["soy milk", "youtiao", "scallion"],
        breakfastCategory: "street breakfast set",
        sceneSetting: "street-side breakfast counter",
        visualAnchors: ["metal soy milk pot", "paper cup", "narrow breakfast shop counter"],
        avoidRepeats: ["avoid ceramic cafe plating"],
      });
    },
  };

  const personalization: PersonalizationSummary = {
    recentPatterns: ["Two recent records used cafe-table scenes."],
    stablePreferences: ["Slight preference for warm savory breakfasts."],
    avoidRepeats: ["Avoid cafe-table scenes", "Avoid flaky pastry breakfasts"],
    confidenceNotes: "Recent repetition is reliable.",
  };

  const result = await generateLocalBreakfast({
    openai,
    city: createCity(),
    story: {
      story: "Today you wake up in Taipei, Taiwan. Scooters gather under a pale sky while a soy scent lifts from the lane.",
      storyZh: "今天的你甦醒在台灣的台北。巷口機車聲和豆香一起浮起。",
      tone: "observant",
      motifs: ["morning scooters", "steam", "narrow lane"],
    },
    personalization,
  });

  assert.equal(result.name, "Soy Milk and Youtiao");
  assert.equal(result.nameZh, "豆漿油條");
  assert.deepEqual(result.highlightIngredients, ["soy milk", "youtiao", "scallion"]);
  assert.equal(result.breakfastCategory, "street breakfast set");
  assert.equal(result.sceneSetting, "street-side breakfast counter");
  assert.deepEqual(result.visualAnchors, ["metal soy milk pot", "paper cup", "narrow breakfast shop counter"]);
  assert.deepEqual(result.avoidRepeats, ["avoid ceramic cafe plating"]);
  assert.match(requests[0].userPrompt, /story tone: observant/i);
  assert.match(requests[0].userPrompt, /morning scooters, steam, narrow lane/i);
  assert.match(requests[0].userPrompt, /Avoid cafe-table scenes/i);
  assert.match(requests[0].userPrompt, /Return JSON with name, nameZh, description, descriptionZh, highlightIngredients, breakfastCategory, sceneSetting, visualAnchors, avoidRepeats\./i);
  assert.equal(requests[0].responseFormat?.type, "json_schema");
  assert.equal(requests[0].responseFormat?.name, "local_breakfast");
});
