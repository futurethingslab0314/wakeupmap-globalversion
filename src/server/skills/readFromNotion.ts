import type { NormalizedNotionRecord, NotionClient } from "../types";
import {
  getDateProperty,
  getNumberProperty,
  getRichTextProperty,
  getTitleProperty,
  getUrlProperty,
} from "../services/notion";

interface ReadFromNotionInput {
  notion: Pick<NotionClient, "queryDatabase">;
  databaseId: string;
}

function normalizeRecord(page: unknown): NormalizedNotionRecord {
  const pageObject = typeof page === "object" && page !== null ? page : {};
  const properties =
    "properties" in pageObject && typeof pageObject.properties === "object" && pageObject.properties !== null
      ? (pageObject.properties as Record<string, unknown>)
      : {};

  const city = getTitleProperty(properties, "City");
  const cityZh = getRichTextProperty(properties, "City ZH") || city;
  const country = getRichTextProperty(properties, "Country");
  const countryZh = getRichTextProperty(properties, "Country ZH") || country;
  const story = getRichTextProperty(properties, "Story");
  const storyZh = getRichTextProperty(properties, "Story ZH") || story;
  const recordedAtDate = getDateProperty(properties, "Recorded At");

  return {
    id: "id" in pageObject && typeof pageObject.id === "string" ? pageObject.id : "",
    city,
    cityZh,
    city_zh: cityZh,
    country,
    countryZh,
    country_zh: countryZh,
    greeting: getRichTextProperty(properties, "Greeting"),
    story,
    storyZh,
    story_zh: storyZh,
    recipe: getRichTextProperty(properties, "Recipe"),
    imageUrl: getUrlProperty(properties, "Image URL"),
    latitude: getNumberProperty(properties, "Latitude"),
    longitude: getNumberProperty(properties, "Longitude"),
    utcOffset: getNumberProperty(properties, "UTC Offset"),
    createdAt: recordedAtDate,
    recordedAtDate,
  };
}

export async function readFromNotion(input: ReadFromNotionInput): Promise<NormalizedNotionRecord[]> {
  const response = await input.notion.queryDatabase(input.databaseId);
  return response.results.map((page) => normalizeRecord(page));
}
