import { Client } from "@notionhq/client";

const fallbackLocations = [
  {
    id: "1",
    city: "Taipei",
    city_zh: "台北",
    country: "Taiwan",
    country_zh: "台灣",
    longitude: 121.5654,
    latitude: 25.033,
    utcOffset: 8,
    story: "Waking up to the smell of fresh soy milk and youtiao in a bustling traditional market.",
    story_zh: "在熱鬧的傳統市場中，聞著新鮮豆漿和油條的香氣醒來。",
    recipe: "Traditional Soy Milk & Youtiao (Deep-fried dough sticks)",
    imageUrl: "https://picsum.photos/seed/taipei/800/600",
    greeting: "Zao An!",
  },
];

function getPlainText(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (typeof item === "object" && item !== null && "plain_text" in item) {
        const plainText = (item as { plain_text?: unknown }).plain_text;
        return typeof plainText === "string" ? plainText : "";
      }

      return "";
    })
    .join("")
    .trim();
}

function getTitleProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("title" in property)) {
    return "";
  }

  return getPlainText((property as { title?: unknown }).title);
}

function getRichTextProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("rich_text" in property)) {
    return "";
  }

  return getPlainText((property as { rich_text?: unknown }).rich_text);
}

function getNumberProperty(properties: Record<string, unknown>, key: string): number {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("number" in property)) {
    return 0;
  }

  const value = (property as { number?: unknown }).number;
  return typeof value === "number" ? value : 0;
}

function getUrlProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("url" in property)) {
    return "";
  }

  const value = (property as { url?: unknown }).url;
  return typeof value === "string" ? value : "";
}

function getDateProperty(properties: Record<string, unknown>, key: string): string | undefined {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("date" in property)) {
    return undefined;
  }

  const date = (property as { date?: unknown }).date;
  if (typeof date !== "object" || date === null || !("start" in date)) {
    return undefined;
  }

  const start = (date as { start?: unknown }).start;
  return typeof start === "string" ? start : undefined;
}

function normalizePage(page: { id?: string; properties?: Record<string, unknown> }) {
  const properties = page.properties ?? {};
  const city = getTitleProperty(properties, "City");
  const cityZh = getRichTextProperty(properties, "City ZH") || city;
  const country = getRichTextProperty(properties, "Country");
  const countryZh = getRichTextProperty(properties, "Country ZH") || country;
  const story = getRichTextProperty(properties, "Story");
  const storyZh = getRichTextProperty(properties, "Story ZH") || story;
  const recordedAtDate = getDateProperty(properties, "Recorded At");

  return {
    id: page.id ?? "",
    city,
    city_zh: cityZh,
    country,
    country_zh: countryZh,
    greeting: getRichTextProperty(properties, "Greeting"),
    story,
    story_zh: storyZh,
    recipe: getRichTextProperty(properties, "Recipe"),
    imageUrl: getUrlProperty(properties, "Image URL"),
    latitude: getNumberProperty(properties, "Latitude"),
    longitude: getNumberProperty(properties, "Longitude"),
    utcOffset: getNumberProperty(properties, "UTC Offset"),
    recordedAtDate,
  };
}

export default async function handler(
  request: { method?: string },
  response: {
    status(code: number): { json(payload: unknown): unknown };
    json(payload: unknown): unknown;
    setHeader?(name: string, value: string | string[]): unknown;
  },
) {
  try {
    if (request.method && request.method !== "GET") {
      response.setHeader?.("Allow", "GET");
      return response.status(405).json({ error: "Method Not Allowed" });
    }

    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!apiKey || !databaseId) {
      return response.status(200).json(fallbackLocations);
    }

    const notion = new Client({ auth: apiKey });
    const queryResponse = await notion.databases.query({
      database_id: databaseId,
    });

    const records = queryResponse.results
      .map((page) => normalizePage(page as { id?: string; properties?: Record<string, unknown> }))
      .filter((record) => record.city);

    return response.status(200).json(records.length > 0 ? records : fallbackLocations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return response.status(500).json({ error: message });
  }
}
