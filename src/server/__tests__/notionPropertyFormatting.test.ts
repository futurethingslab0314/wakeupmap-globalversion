import test from "node:test";
import assert from "node:assert/strict";

import { buildWakeUpPageProperties } from "../services/notion";

test("buildWakeUpPageProperties writes stable formatting for rich-text taxonomy fields", () => {
  const properties = buildWakeUpPageProperties(
    {
      "User Name": { type: "title" },
      "Current Base": { type: "rich_text" },
      Tone: { type: "rich_text" },
      "Breakfast Category": { type: "rich_text" },
      "Scene Setting": { type: "rich_text" },
      Motifs: { type: "rich_text" },
      "Visual Anchors": { type: "rich_text" },
    },
    {
      userName: "YT",
      currentBase: "Taipei, Taiwan",
      city: "",
      cityZh: "",
      country: "",
      countryZh: "",
      greeting: "",
      story: "",
      storyZh: "",
      breakfastName: "",
      breakfastNameZh: "",
      breakfastDescription: "",
      breakfastDescriptionZh: "",
      highlightIngredients: [],
      imagePrompt: "",
      tone: "soft, reflective morning",
      motifs: ["paper cup, warm steam", "scooter lane"],
      breakfastCategory: "casual breakfast spots or food trucks in Ahwatukee Foothills, with outdoor seating and a lively morning atmosphere.",
      sceneSetting: "street-side counter, outdoor stools, neighborhood regulars",
      visualAnchors: ["paper cup, metal soy milk pot", "counter tray"],
      avoidRepeats: [],
      recipe: "",
      recipeZh: "",
      imageUrl: "",
      latitude: 0,
      longitude: 0,
      utcOffset: 0,
      recordedAtDate: "",
      timezone: "",
    },
  ) as Record<string, any>;

  assert.equal(properties["Current Base"].rich_text[0].text.content, "Taipei, Taiwan");
  assert.equal(properties["Tone"].rich_text[0].text.content, "soft");
  assert.equal(
    properties["Breakfast Category"].rich_text[0].text.content,
    "casual breakfast spots or food trucks in Ahwatukee Foothills",
  );
  assert.equal(properties["Scene Setting"].rich_text[0].text.content, "street-side counter");
  assert.equal(properties["Motifs"].rich_text[0].text.content, "paper cup, scooter lane");
  assert.equal(properties["Visual Anchors"].rich_text[0].text.content, "paper cup, counter tray");
});
