import type { NormalizedNotionRecord, NotionClient } from "../types";
import { readWakeAcknowledgement } from "../../wakeAcknowledgement";
import {
  getDateProperty,
  getMultiSelectProperty,
  getNumberProperty,
  getRichTextProperty,
  getSelectProperty,
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

  const wake = readWakeAcknowledgement(properties);
  const city = getTitleProperty(properties, "City") || getRichTextProperty(properties,"City") || getRichTextProperty(properties,"city");
  const cityZh = getRichTextProperty(properties, "City ZH") || getRichTextProperty(properties,"city_zh") || city;
  const country = getRichTextProperty(properties, "Country") || getRichTextProperty(properties,"country");
  const countryZh = getRichTextProperty(properties, "Country ZH") || getRichTextProperty(properties,"country_zh") || country;
  const story = getRichTextProperty(properties, "Story") || getRichTextProperty(properties,"story");
  const storyZh = getRichTextProperty(properties, "Story ZH") || getRichTextProperty(properties,"story_zh") || story;
  const recordedAtDate = getDateProperty(properties,"recordedAtDate") || getDateProperty(properties, "Recorded At");
  const motifsText = getRichTextProperty(properties, "Motifs");
  const visualAnchorsText = getRichTextProperty(properties, "Visual Anchors");

  return {
    ...wake,
    id: "id" in pageObject && typeof pageObject.id === "string" ? pageObject.id : "",
    userName: getRichTextProperty(properties,"wakeuphere_user_name") || getTitleProperty(properties, "User Name") || getTitleProperty(properties, "Name") || getTitleProperty(properties,"userName"),
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
    breakfastName: getRichTextProperty(properties, "Breakfast Name"),
    breakfastNameZh: getRichTextProperty(properties, "Breakfast Name ZH"),
    breakfastDescription: getRichTextProperty(properties, "Breakfast Description"),
    breakfastDescriptionZh: getRichTextProperty(properties, "Breakfast Description ZH"),
    highlightIngredients: getRichTextProperty(properties, "Highlight Ingredients"),
    imagePrompt: getRichTextProperty(properties, "Image Prompt"),
    tone: getRichTextProperty(properties, "Tone") || getSelectProperty(properties, "Tone"),
    motifs: motifsText
      ? motifsText.split(",").map((value) => value.trim()).filter(Boolean)
      : getMultiSelectProperty(properties, "Motifs"),
    breakfastCategory:
      getRichTextProperty(properties, "Breakfast Category") || getSelectProperty(properties, "Breakfast Category"),
    sceneSetting:
      getRichTextProperty(properties, "Scene Setting") || getSelectProperty(properties, "Scene Setting"),
    visualAnchors: visualAnchorsText
      ? visualAnchorsText.split(",").map((value) => value.trim()).filter(Boolean)
      : getMultiSelectProperty(properties, "Visual Anchors"),
    avoidRepeats: getRichTextProperty(properties, "Avoid Repeats"),
    imageUrl: getUrlProperty(properties, "Image URL"),
    latitude: getNumberProperty(properties, "Latitude") || getNumberProperty(properties,"latitude"),
    longitude: getNumberProperty(properties, "Longitude") || getNumberProperty(properties,"longitude"),
    utcOffset: getNumberProperty(properties, "UTC Offset"),
    createdAt: wake.wakePressedAt || recordedAtDate,
    recordedAtDate,
    recordedAt: getRichTextProperty(properties,"recordedAt"),
  };
}

export async function readFromNotion(input: ReadFromNotionInput): Promise<NormalizedNotionRecord[]> {
  const response = await input.notion.queryDatabase(input.databaseId);
  return response.results.map((page) => normalizeRecord(page));
}
