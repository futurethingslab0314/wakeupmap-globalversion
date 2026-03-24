import test from "node:test";
import assert from "node:assert/strict";

import { getContinentName, getRecordCity, getRecordCountry, getRecordRecipe, getRecordStory, uiText } from "../i18n";
import type { NotionRecord } from "../types";

const record: NotionRecord = {
  id: "1",
  city: "Mexico City",
  city_zh: "墨西哥城",
  country: "Mexico",
  country_zh: "墨西哥",
  greeting: "Buenos dias",
  story: "English story",
  story_zh: "中文故事",
  longitude: -99.1,
  latitude: 19.4,
  imageUrl: "https://example.com",
  recipe: "English recipe",
  recipe_zh: "中文食譜",
  utcOffset: -6,
};

test("i18n selectors return zh fields when language is zh", () => {
  assert.equal(getRecordCity(record, "zh"), "墨西哥城");
  assert.equal(getRecordCountry(record, "zh"), "墨西哥");
  assert.equal(getRecordStory(record, "zh"), "中文故事");
  assert.equal(getRecordRecipe(record, "zh"), "中文食譜");
  assert.equal(getContinentName("Asia", "zh"), "亞洲");
});

test("i18n selectors return english fields when language is en", () => {
  assert.equal(getRecordCity(record, "en"), "Mexico City");
  assert.equal(getRecordCountry(record, "en"), "Mexico");
  assert.equal(getRecordStory(record, "en"), "English story");
  assert.equal(getRecordRecipe(record, "en"), "English recipe");
  assert.equal(getContinentName("Asia", "en"), "Asia");
});

test("journal table label uses greeting in both languages", () => {
  assert.equal(uiText.en.greeting, "Greeting");
  assert.equal(uiText.zh.greeting, "問候");
});
