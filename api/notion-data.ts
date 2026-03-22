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

function getFirstAvailableTitle(properties: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = getTitleProperty(properties, key);
    if (value) {
      return value;
    }
  }

  return "";
}

function getFirstAvailableProperty(
  reader: (properties: Record<string, unknown>, key: string) => string,
  properties: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = reader(properties, key);
    if (value) {
      return value;
    }
  }

  return "";
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
  const city = getFirstAvailableProperty(getRichTextProperty, properties, ["City", "city"]) ||
    getFirstAvailableProperty(getTitleProperty, properties, ["City", "city"]);
  const cityZh = getFirstAvailableProperty(getRichTextProperty, properties, ["City ZH", "city zh", "cityZh", "city_zh"]) || city;
  const country = getFirstAvailableProperty(getRichTextProperty, properties, ["Country", "country"]);
  const countryZh = getFirstAvailableProperty(getRichTextProperty, properties, ["Country ZH", "country zh", "countryZh", "country_zh"]) || country;
  const greeting = getFirstAvailableProperty(getRichTextProperty, properties, ["Greeting", "greeting"]);
  const story = getFirstAvailableProperty(getRichTextProperty, properties, ["Story", "story"]);
  const storyZh = getFirstAvailableProperty(getRichTextProperty, properties, ["Story ZH", "story zh", "storyZh", "story_zh"]) || story;
  const recipe = getFirstAvailableProperty(getRichTextProperty, properties, ["Recipe", "recipe"]);
  const imageUrl = getFirstAvailableProperty(getUrlProperty, properties, ["Image URL", "image url", "imageUrl", "image"]);
  const recordedAtDate =
    getDateProperty(properties, "recordedAtDate") ??
    getDateProperty(properties, "recordedAt") ??
    getDateProperty(properties, "Recorded At") ??
    getDateProperty(properties, "recorded at") ??
    getDateProperty(properties, "Date");
  const userName = getFirstAvailableTitle(properties, ["userName", "User Name", "Name"]);

  return {
    id: page.id ?? userName ?? "",
    city,
    city_zh: cityZh,
    country,
    country_zh: countryZh,
    greeting,
    story,
    story_zh: storyZh,
    recipe,
    imageUrl,
    latitude: getNumberProperty(properties, "Latitude") || getNumberProperty(properties, "latitude"),
    longitude:
      getNumberProperty(properties, "Longitude") ||
      getNumberProperty(properties, "longitude") ||
      getNumberProperty(properties, "longtitude"),
    utcOffset: getNumberProperty(properties, "UTC Offset") || getNumberProperty(properties, "utc offset"),
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

    const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!queryResponse.ok) {
      const errorPayload = await queryResponse.text();
      throw new Error(`Notion query failed: ${queryResponse.status} ${errorPayload}`);
    }

    const queryResult = (await queryResponse.json()) as {
      results: Array<{ id?: string; properties?: Record<string, unknown> }>;
    };

    const records = queryResult.results
      .map((page) => normalizePage(page))
      .filter((record) => record.city);

    return response.status(200).json(records.length > 0 ? records : fallbackLocations);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return response.status(500).json({ error: message });
  }
}
