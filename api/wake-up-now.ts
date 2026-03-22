const cityCandidates = [
  {
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
    breakfastName: "Soy Milk and Youtiao",
    breakfastNameZh: "豆漿油條",
  },
  {
    id: "tokyo",
    city: "Tokyo",
    cityZh: "東京",
    country: "Japan",
    countryZh: "日本",
    latitude: 35.6895,
    longitude: 139.6917,
    utcOffset: 9,
    population: 13960000,
    greetingHint: "Polite Japanese morning greeting",
    languageCode: "ja-JP",
    breakfastName: "Grilled Fish Breakfast",
    breakfastNameZh: "日式烤魚早餐",
  },
  {
    id: "bangkok",
    city: "Bangkok",
    cityZh: "曼谷",
    country: "Thailand",
    countryZh: "泰國",
    latitude: 13.7563,
    longitude: 100.5018,
    utcOffset: 7,
    population: 10539000,
    greetingHint: "Friendly Thai morning greeting",
    languageCode: "th-TH",
    breakfastName: "Jok Rice Porridge",
    breakfastNameZh: "泰式粥品 Jok",
  },
];

type NotionPropertyDefinition = {
  id?: string;
  name?: string;
  type?: string;
};

type NotionDatabaseResponse = {
  properties?: Record<string, NotionPropertyDefinition>;
};

function getMinuteDiffToEight(nowIso: string, utcOffset: number) {
  const now = new Date(nowIso);
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMinutes = utcMinutes + utcOffset * 60;
  const normalized = ((localMinutes % 1440) + 1440) % 1440;
  return Math.abs(normalized - 480);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function findPropertyName(
  properties: Record<string, NotionPropertyDefinition>,
  type: string,
  aliases: string[],
): string | undefined {
  const aliasSet = new Set(aliases.map(normalizeKey));

  for (const [name, definition] of Object.entries(properties)) {
    if (definition.type === type && aliasSet.has(normalizeKey(name))) {
      return name;
    }
  }

  return undefined;
}

async function callOpenAIText(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { output_text?: string };
  return data.output_text ?? null;
}

function buildNotionProperties(
  schema: Record<string, NotionPropertyDefinition>,
  record: {
  userName: string;
  city: string;
  cityZh: string;
  country: string;
  countryZh: string;
  greeting: string;
  story: string;
  storyZh: string;
  recipe: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  utcOffset: number;
  recordedAtDate: string;
}) {
  const properties: Record<string, unknown> = {};

  const titleName = findPropertyName(schema, "title", ["userName", "user name", "name", "title"]);
  if (titleName) {
    properties[titleName] = {
      title: [{ text: { content: record.userName } }],
    };
  }

  const richTextMappings: Array<[string[], string]> = [
    [["city"], record.city],
    [["city zh", "cityzh", "city_zh"], record.cityZh],
    [["country"], record.country],
    [["country zh", "countryzh", "country_zh"], record.countryZh],
    [["greeting"], record.greeting],
    [["story"], record.story],
    [["story zh", "storyzh", "story_zh"], record.storyZh],
    [["recipe"], record.recipe],
    [["recipe zh", "recipezh", "recipe_zh"], record.recipe],
    [["local time", "localtime"], new Date(record.recordedAtDate).toLocaleString("en-US", { timeZone: "UTC" })],
  ];

  for (const [aliases, value] of richTextMappings) {
    const propertyName = findPropertyName(schema, "rich_text", aliases);
    if (propertyName) {
      properties[propertyName] = {
        rich_text: [{ text: { content: value } }],
      };
    }
  }

  const numberMappings: Array<[string[], number]> = [
    [["latitude"], record.latitude],
    [["longitude", "longtitude"], record.longitude],
    [["utc offset", "utcoffset"], record.utcOffset],
  ];

  for (const [aliases, value] of numberMappings) {
    const propertyName = findPropertyName(schema, "number", aliases);
    if (propertyName) {
      properties[propertyName] = {
        number: value,
      };
    }
  }

  const imageUrlName = findPropertyName(schema, "url", ["image url", "imageurl", "image"]);
  if (imageUrlName) {
    properties[imageUrlName] = { url: record.imageUrl };
  }

  const imageStorageKeyName = findPropertyName(schema, "url", ["imagestoragekey", "image storage key"]);
  if (imageStorageKeyName) {
    properties[imageStorageKeyName] = { url: record.imageUrl };
  }

  const recordedAtNames = [
    findPropertyName(schema, "date", ["recordedatdate", "recorded at date"]),
    findPropertyName(schema, "date", ["recordedat", "recorded at", "date"]),
  ].filter((value): value is string => Boolean(value));

  for (const recordedAtName of recordedAtNames) {
    properties[recordedAtName] = {
      date: {
        start: record.recordedAtDate,
      },
    };
  }

  return properties;
}

export default async function handler(
  request: { method?: string; body?: { language?: "en" | "zh"; userName?: string } },
  response: {
    status(code: number): { json(payload: unknown): unknown };
    json(payload: unknown): unknown;
    setHeader?(name: string, value: string | string[]): unknown;
  },
) {
  try {
    if (request.method !== "POST") {
      response.setHeader?.("Allow", "POST");
      return response.status(405).json({ error: "Method Not Allowed" });
    }

    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!apiKey || !databaseId) {
      return response.status(500).json({ error: "Missing NOTION_API_KEY or NOTION_DATABASE_ID" });
    }

    const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
      },
    });

    if (!databaseResponse.ok) {
      const errorPayload = await databaseResponse.text();
      throw new Error(`Notion database fetch failed: ${databaseResponse.status} ${errorPayload}`);
    }

    const database = (await databaseResponse.json()) as NotionDatabaseResponse;
    const schema = database.properties ?? {};

    const nowIso = new Date().toISOString();
    const city = [...cityCandidates].sort(
      (left, right) =>
        getMinuteDiffToEight(nowIso, left.utcOffset) - getMinuteDiffToEight(nowIso, right.utcOffset) ||
        right.population - left.population,
    )[0];

    const greeting =
      (await callOpenAIText(
        `Write a brief local morning greeting for ${city.city} in ${city.languageCode}. Return only the greeting.`,
      )) ?? `Good morning from ${city.city}!`;

    const story =
      (await callOpenAIText(
        `Write one short English sentence that begins with "You wake up in ${city.city}" and mentions a local breakfast.`,
      )) ?? `You wake up in ${city.city} to the aroma of ${city.breakfastName}.`;

    const storyZh =
      (await callOpenAIText(
        `Translate this into Traditional Chinese naturally: ${story}`,
      )) ?? `你在 ${city.cityZh} 的清晨裡，聞到 ${city.breakfastNameZh} 的香氣而醒來。`;

    const recipe =
      (await callOpenAIText(
        `Write a compact breakfast description for ${city.breakfastName} in one sentence.`,
      )) ?? `${city.breakfastName} inspired breakfast, prepared as a single serving morning plate.`;

    const recordedAtDate = new Date().toISOString();
    const imageUrl = `https://picsum.photos/seed/${city.id}-${recordedAtDate}/800/600`;
    const notionUserName = request.body?.userName?.trim() || `${city.city} Wake Up`;

    const createPageResponse = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: buildNotionProperties(schema, {
          userName: notionUserName,
          city: city.city,
          cityZh: city.cityZh,
          country: city.country,
          countryZh: city.countryZh,
          greeting,
          story,
          storyZh,
          recipe,
          imageUrl,
          latitude: city.latitude,
          longitude: city.longitude,
          utcOffset: city.utcOffset,
          recordedAtDate,
        }),
      }),
    });

    if (!createPageResponse.ok) {
      const errorPayload = await createPageResponse.text();
      throw new Error(`Notion page create failed: ${createPageResponse.status} ${errorPayload}`);
    }

    const createdPage = (await createPageResponse.json()) as { id: string };

    return response.status(200).json({
      record: {
        id: createdPage.id,
        city: city.city,
        city_zh: city.cityZh,
        country: city.country,
        country_zh: city.countryZh,
        greeting,
        story,
        story_zh: storyZh,
        recipe,
        imageUrl,
        latitude: city.latitude,
        longitude: city.longitude,
        utcOffset: city.utcOffset,
        recordedAtDate,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return response.status(500).json({ error: message });
  }
}
