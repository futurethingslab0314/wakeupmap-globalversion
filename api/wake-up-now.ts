import { Client } from "@notionhq/client";

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

function getMinuteDiffToEight(nowIso: string, utcOffset: number) {
  const now = new Date(nowIso);
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMinutes = utcMinutes + utcOffset * 60;
  const normalized = ((localMinutes % 1440) + 1440) % 1440;
  return Math.abs(normalized - 480);
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

function buildNotionProperties(record: {
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
  return {
    City: {
      title: [{ text: { content: record.city } }],
    },
    "City ZH": {
      rich_text: [{ text: { content: record.cityZh } }],
    },
    Country: {
      rich_text: [{ text: { content: record.country } }],
    },
    "Country ZH": {
      rich_text: [{ text: { content: record.countryZh } }],
    },
    Greeting: {
      rich_text: [{ text: { content: record.greeting } }],
    },
    Story: {
      rich_text: [{ text: { content: record.story } }],
    },
    "Story ZH": {
      rich_text: [{ text: { content: record.storyZh } }],
    },
    Recipe: {
      rich_text: [{ text: { content: record.recipe } }],
    },
    Latitude: {
      number: record.latitude,
    },
    Longitude: {
      number: record.longitude,
    },
    "UTC Offset": {
      number: record.utcOffset,
    },
    "Image URL": {
      url: record.imageUrl,
    },
    "Recorded At": {
      date: {
        start: record.recordedAtDate,
      },
    },
  };
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

    const notion = new Client({ auth: apiKey });
    const createdPage = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: buildNotionProperties({
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
    });

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
