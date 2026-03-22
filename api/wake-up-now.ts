import { generateBreakfastImage } from "../src/server/skills/generateBreakfastImage.ts";
import { generateGreeting } from "../src/server/skills/generateGreeting.ts";
import { generateLocalBreakfast } from "../src/server/skills/generateLocalBreakfast.ts";
import { generateRecipe } from "../src/server/skills/generateRecipe.ts";
import { selectCity } from "../src/server/skills/selectCity.ts";
import { generateStory } from "../src/server/skills/generateStory.ts";
import { uploadImageToR2 } from "../src/server/skills/uploadImageToR2.ts";
import { createOpenAIClient } from "../src/server/services/openai.ts";
import { createR2Client } from "../src/server/services/r2.ts";
import { loadWorldCities } from "../src/server/services/worldCities.ts";
import type { NormalizedNotionRecord, RecipeResult } from "../src/server/types.ts";

type NotionPropertyDefinition = {
  id?: string;
  name?: string;
  type?: string;
};

type NotionDatabaseResponse = {
  properties?: Record<string, NotionPropertyDefinition>;
};

type NotionQueryResponse = {
  results?: Array<{ properties?: Record<string, unknown> }>;
};

interface WakeUpNowBody {
  language?: "en" | "zh";
  userName?: string;
  nowUtcIso?: string;
  clientTimeZone?: string;
  clientIsoTime?: string;
}

interface CapturedWakeUpContext {
  userName: string;
  timezone: string;
  recordedAtDate: string;
  recordedAt: string;
  recordedAtIso: string;
  nowUtcIso: string;
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

function isValidTimeZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseClientDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDatePart(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function formatTimePart(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  return formatter.format(date);
}

function captureWakeUpContext(body: WakeUpNowBody): CapturedWakeUpContext {
  const userName = body.userName?.trim();
  if (!userName) {
    throw new Error("userName must not be blank");
  }

  const timezone = isValidTimeZone(body.clientTimeZone) ? body.clientTimeZone : "UTC";
  const recordedAtDateTime = parseClientDate(body.clientIsoTime) ?? new Date();
  const nowUtcIso = body.nowUtcIso ?? recordedAtDateTime.toISOString();

  return {
    userName,
    timezone,
    recordedAtDate: formatDatePart(recordedAtDateTime, timezone),
    recordedAt: formatTimePart(recordedAtDateTime, timezone),
    recordedAtIso: recordedAtDateTime.toISOString(),
    nowUtcIso,
  };
}

async function getRecentCityNames(input: {
  apiKey: string;
  databaseId: string;
}): Promise<string[]> {
  const response = await fetch(`https://api.notion.com/v1/databases/${input.databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page_size: 7,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    }),
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as NotionQueryResponse;

  return (payload.results ?? [])
    .map((page) => {
      const properties = page.properties ?? {};
      return (
        getRichTextProperty(properties, "city") ||
        getRichTextProperty(properties, "City") ||
        getTitleProperty(properties, "city") ||
        getTitleProperty(properties, "City")
      );
    })
    .filter(Boolean);
}

function buildRecentRecords(cityNames: string[]): NormalizedNotionRecord[] {
  return cityNames.map((city) => ({
    id: city,
    city,
    cityZh: city,
    country: "",
    countryZh: "",
    greeting: "",
    story: "",
    storyZh: "",
    recipe: "",
    imageUrl: "",
    latitude: 0,
    longitude: 0,
    utcOffset: 0,
  }));
}

function buildFallbackRecipe(cityName: string, cityNameZh: string): RecipeResult {
  return {
    title: `${cityName} Morning Plate`,
    titleZh: `${cityNameZh}晨間早餐`,
    recipe:
      "Ingredients: 1 warm drink, 1 main starch, and 1 fresh garnish. Steps: Prepare the drink, plate the starch, and finish with the garnish. Total time: 15 minutes.",
    recipeZh:
      "食材：1 份熱飲、1 份主食、1 份新鮮配料。步驟：準備熱飲，擺好主食，最後加入配料。總時長：15 分鐘。",
    highlightIngredients: ["warm drink", "main starch", "fresh garnish"],
    imagePrompt: `Top-down photo of a single-person ${cityName} breakfast with a warm drink, a main starch, and a fresh garnish on a simple tabletop.`,
  };
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
    recipeZh: string;
    imageUrl: string;
    imageStorageKey: string;
    latitude: number;
    longitude: number;
    utcOffset: number;
    recordedAtDate: string;
    recordedAt: string;
    timezone: string;
  },
) {
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
    [["recipe zh", "recipezh", "recipe_zh"], record.recipeZh],
    [["timezone"], record.timezone],
    [["recordedat", "recorded at", "local time", "localtime"], record.recordedAt],
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
    properties[imageStorageKeyName] = { url: record.imageStorageKey };
  }

  const recordedAtDateName = findPropertyName(schema, "date", ["recordedatdate", "recorded at date", "date"]);
  if (recordedAtDateName) {
    properties[recordedAtDateName] = {
      date: {
        start: record.recordedAtDate,
      },
    };
  }

  return properties;
}

function createOpenAiFromEnv() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  return createOpenAIClient({ apiKey });
}

function createR2FromEnv() {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrlBase) {
    throw new Error("Missing Cloudflare R2 configuration");
  }

  return createR2Client({
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrlBase,
  });
}

export default async function handler(
  request: { method?: string; body?: WakeUpNowBody },
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

    const notionApiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!notionApiKey || !databaseId) {
      return response.status(500).json({ error: "Missing NOTION_API_KEY or NOTION_DATABASE_ID" });
    }

    const context = captureWakeUpContext(request.body ?? {});

    const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
      },
    });

    if (!databaseResponse.ok) {
      const errorPayload = await databaseResponse.text();
      throw new Error(`Notion database fetch failed: ${databaseResponse.status} ${errorPayload}`);
    }

    const database = (await databaseResponse.json()) as NotionDatabaseResponse;
    const schema = database.properties ?? {};
    const recentCityNames = await getRecentCityNames({ apiKey: notionApiKey, databaseId });
    const selected = selectCity({
      nowUtcIso: context.nowUtcIso,
      cities: loadWorldCities(context.nowUtcIso),
      recentRecords: buildRecentRecords(recentCityNames),
    });
    const city = selected.city;

    const openai = createOpenAiFromEnv();
    const greeting = await generateGreeting({ openai, city });
    const story = await generateStory({
      openai,
      city,
      greeting,
      userName: context.userName,
    });
    const breakfastConcept = await generateLocalBreakfast({ openai, city });
    const recipe =
      (await generateRecipe({
        openai,
        breakfastConcept,
        cityName: city.city,
        countryName: city.country,
        cityNameZh: city.cityZh,
        countryNameZh: city.countryZh,
      })) ?? buildFallbackRecipe(city.city, city.cityZh);
    const breakfastImage = await generateBreakfastImage({
      openai,
      cityName: city.city,
      countryName: city.country,
      recipe,
    });
    const r2 = createR2FromEnv();
    const uploadedImage = await uploadImageToR2({
      r2,
      imageBinary: breakfastImage.imageBinary,
      cityName: city.city,
      recordedAtIso: context.recordedAtIso,
    });

    const createPageResponse = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: buildNotionProperties(schema, {
          userName: context.userName,
          city: city.city,
          cityZh: city.cityZh,
          country: city.country,
          countryZh: city.countryZh,
          greeting,
          story: story.story,
          storyZh: story.storyZh,
          recipe: recipe.recipe,
          recipeZh: recipe.recipeZh ?? recipe.recipe,
          imageUrl: uploadedImage.imageUrl,
          imageStorageKey: uploadedImage.imageStorageKey,
          latitude: city.latitude,
          longitude: city.longitude,
          utcOffset: city.utcOffset,
          recordedAtDate: context.recordedAtDate,
          recordedAt: context.recordedAt,
          timezone: context.timezone,
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
        cityZh: city.cityZh,
        city_zh: city.cityZh,
        country: city.country,
        countryZh: city.countryZh,
        country_zh: city.countryZh,
        greeting,
        story: story.story,
        storyZh: story.storyZh,
        story_zh: story.storyZh,
        recipe: recipe.recipe,
        recipeZh: recipe.recipeZh,
        imageUrl: uploadedImage.imageUrl,
        latitude: city.latitude,
        longitude: city.longitude,
        utcOffset: city.utcOffset,
        recordedAtDate: context.recordedAtDate,
        recordedAt: context.recordedAt,
        timezone: context.timezone,
      },
      imageStorageKey: uploadedImage.imageStorageKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return response.status(500).json({ error: message });
  }
}
