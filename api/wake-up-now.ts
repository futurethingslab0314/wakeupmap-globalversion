import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

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

type RawWorldCity = {
  city: string;
  city_zh?: string;
  country: string;
  country_zh?: string;
  country_iso_code?: string;
  timezone: string;
  latitude: number;
  longitude: number;
};

type WorldCity = {
  id: string;
  city: string;
  cityZh: string;
  country: string;
  countryZh: string;
  timezone: string;
  latitude: number;
  longitude: number;
  utcOffset: number;
};

type WakeUpNowBody = {
  language?: "en" | "zh";
  userName?: string;
  nowUtcIso?: string;
  clientTimeZone?: string;
  clientIsoTime?: string;
};

type WakeUpContext = {
  userName: string;
  timezone: string;
  recordedAtDate: string;
  recordedAt: string;
  recordedAtIso: string;
  nowUtcIso: string;
};

type RecipeResult = {
  title: string;
  titleZh: string;
  recipe: string;
  recipeZh: string;
  highlightIngredients: string[];
  imagePrompt: string;
  breakfastCategory?: string;
  sceneSetting?: string;
  visualAnchors?: string[];
};

type StructuredResponseFormat = {
  type: "json_schema";
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

type ResponsesApiPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<
      | { type?: "output_text"; text?: string }
      | { type?: "refusal"; refusal?: string }
    >;
  }>;
};

const wakeUpStorySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    story: { type: "string" },
    storyZh: { type: "string" },
    tone: { type: "string" },
    motifs: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["story", "storyZh", "tone", "motifs"],
} as const;

const localBreakfastSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    nameZh: { type: "string" },
    description: { type: "string" },
    descriptionZh: { type: "string" },
    highlightIngredients: {
      type: "array",
      items: { type: "string" },
    },
    breakfastCategory: { type: "string" },
    sceneSetting: { type: "string" },
    visualAnchors: {
      type: "array",
      items: { type: "string" },
    },
    avoidRepeats: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "name",
    "nameZh",
    "description",
    "descriptionZh",
    "highlightIngredients",
    "breakfastCategory",
    "sceneSetting",
    "visualAnchors",
    "avoidRepeats",
  ],
} as const;

const breakfastRecipeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    titleZh: { type: "string" },
    recipe: { type: "string" },
    recipeZh: { type: "string" },
    highlightIngredients: {
      type: "array",
      items: { type: "string" },
    },
    imagePrompt: { type: "string" },
    breakfastCategory: { type: "string" },
    sceneSetting: { type: "string" },
    visualAnchors: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "title",
    "titleZh",
    "recipe",
    "recipeZh",
    "highlightIngredients",
    "imagePrompt",
    "breakfastCategory",
    "sceneSetting",
    "visualAnchors",
  ],
} as const;

const locationZhNamesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cityZh: { type: "string" },
    countryZh: { type: "string" },
  },
  required: ["cityZh", "countryZh"],
} as const;

let cachedWorldCities: RawWorldCity[] | undefined;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeOptionName(value: string, maxLength = 60): string {
  const primarySegment = value.split(",")[0] ?? value;
  return primarySegment
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

function sanitizeMultiSelectValues(values: string[], maxLength = 40): string[] {
  return values.map((value) => sanitizeOptionName(value, maxLength)).filter(Boolean);
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

function getNumberProperty(properties: Record<string, unknown>, key: string): number | null {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("number" in property)) {
    return null;
  }

  const value = (property as { number?: unknown }).number;
  return typeof value === "number" ? value : null;
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

function captureWakeUpContext(body: WakeUpNowBody): WakeUpContext {
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

function parseShortOffset(value: string): number {
  const normalized = value.replace("UTC", "GMT");
  if (normalized === "GMT") {
    return 0;
  }

  const match = normalized.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours + minutes / 60);
}

function getUtcOffsetHoursAt(nowUtcIso: string, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(new Date(nowUtcIso));
  const offsetText = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  return parseShortOffset(offsetText);
}

function getLocalMinutesInTimeZone(nowUtcIso: string, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(new Date(nowUtcIso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function getMinuteDiffToEight(nowUtcIso: string, timezone: string): number {
  return Math.abs(getLocalMinutesInTimeZone(nowUtcIso, timezone) - 8 * 60);
}

function isUsableCity(city: RawWorldCity): boolean {
  const lowered = `${city.city} ${city.country}`.toLowerCase();
  if (city.country === "Antarctica") {
    return false;
  }

  return !/(station|research station|base|camp)$/.test(lowered);
}

function loadRawWorldCities(): RawWorldCity[] {
  if (cachedWorldCities) {
    return cachedWorldCities;
  }

  const fileUrl = new URL("../cities_data.json", import.meta.url);
  const content = readFileSync(fileUrl, "utf-8");
  const parsed = JSON.parse(content) as RawWorldCity[];
  cachedWorldCities = parsed.filter(isUsableCity);
  return cachedWorldCities;
}

function loadWorldCities(nowUtcIso: string): WorldCity[] {
  return loadRawWorldCities().map((city) => ({
    id: `${slugify(city.country)}-${slugify(city.city)}`,
    city: city.city,
    cityZh: city.city_zh ?? city.city,
    country: city.country,
    countryZh: city.country_zh ?? city.country,
    timezone: city.timezone,
    latitude: city.latitude,
    longitude: city.longitude,
    utcOffset: getUtcOffsetHoursAt(nowUtcIso, city.timezone),
  }));
}

async function getRecentCityNames(apiKey: string, databaseId: string): Promise<string[]> {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

async function getExistingLocationLabels(
  apiKey: string,
  databaseId: string,
  target: Pick<WorldCity, "latitude" | "longitude">,
): Promise<{ cityZh: string; countryZh: string } | null> {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as NotionQueryResponse;

  for (const page of payload.results ?? []) {
    const properties = page.properties ?? {};
    const latitude = getNumberProperty(properties, "Latitude") ?? getNumberProperty(properties, "latitude");
    const longitude =
      getNumberProperty(properties, "Longitude") ??
      getNumberProperty(properties, "longitude") ??
      getNumberProperty(properties, "longtitude");

    if (latitude !== target.latitude || longitude !== target.longitude) {
      continue;
    }

    const cityZh = getRichTextProperty(properties, "City ZH") || getRichTextProperty(properties, "city_zh");
    const countryZh =
      getRichTextProperty(properties, "Country ZH") || getRichTextProperty(properties, "country_zh");

    if (cityZh && countryZh) {
      return { cityZh, countryZh };
    }
  }

  return null;
}

function selectCity(nowUtcIso: string, recentCityNames: string[]): WorldCity {
  const recent = new Set(recentCityNames.map((city) => city.toLowerCase()));
  const cities = loadWorldCities(nowUtcIso);

  const ranked = cities
    .map((city) => ({
      city,
      minuteDiffToEight: getMinuteDiffToEight(nowUtcIso, city.timezone),
      isRecent: recent.has(city.city.toLowerCase()),
    }))
    .sort((left, right) => {
      if (left.minuteDiffToEight !== right.minuteDiffToEight) {
        return left.minuteDiffToEight - right.minuteDiffToEight;
      }
      if (left.isRecent !== right.isRecent) {
        return left.isRecent ? 1 : -1;
      }
      return left.city.city.localeCompare(right.city.city);
    });

  return ranked[0].city;
}

function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return apiKey;
}

async function callOpenAIText(prompt: string, responseFormat?: StructuredResponseFormat): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      ...(responseFormat
        ? {
            text: {
              format: responseFormat,
            },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI text request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as ResponsesApiPayload;

  if (data.output_text?.trim()) {
    return data.output_text;
  }

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text?.trim()) {
        return content.text;
      }

      if (content.type === "refusal" && content.refusal?.trim()) {
        throw new Error(`OpenAI text request refused: ${content.refusal}`);
      }
    }
  }

  return "";
}

async function callOpenAIImage(prompt: string): Promise<Uint8Array> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI image request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };
  const base64 = data.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error("OpenAI image response did not include image data");
  }

  return Uint8Array.from(Buffer.from(base64, "base64"));
}

function extractJsonCandidate(value: string): string {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function parseModelJson<T>(value: string, label: string): T {
  const candidate = extractJsonCandidate(value);

  if (!candidate) {
    throw new Error(`${label} returned empty JSON`);
  }

  try {
    return JSON.parse(candidate) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`${label} returned invalid JSON: ${message}`);
  }
}

async function generateGreeting(city: WorldCity): Promise<string> {
  return callOpenAIText(
    [
      "You determine the everyday local language and produce one short natural morning greeting.",
      `City: ${city.city}, ${city.country}`,
      `City (Traditional Chinese): ${city.cityZh}, ${city.countryZh}`,
      "Determine the most widely used local language for an everyday greeting in this city.",
      "Return one short natural morning greeting in that language.",
      "Limit the greeting to 3 to 20 characters including spaces.",
      "Return only the greeting text with no explanation.",
    ].join("\n"),
  );
}

async function generateStory(city: WorldCity, greeting: string, userName: string) {
  return parseModelJson<{ story: string; storyZh: string; tone: string; motifs: string[] }>(
    await callOpenAIText(
      [
        "Create a grounded bilingual wake-up vignette as JSON.",
        `Selected city: ${city.city}, ${city.country}`,
        `Greeting to weave in: ${greeting}`,
        `User name: ${userName}`,
        `The English story must begin exactly with: "Today you wake up in ${city.city}, ${city.country}."`,
        `The Traditional Chinese story must begin exactly with: "今天的你甦醒在${city.countryZh}的${city.cityZh}。"`,
        "Include local cultural habits, geography, and one lesser-known historical detail.",
        "Keep the English story under 150 words.",
        "Keep the Traditional Chinese story under 150 Chinese characters.",
        "Avoid stereotypes and invented facts.",
        "Also return a short tone label and 2 to 4 motifs that describe the morning.",
        "Return JSON with keys story, storyZh, tone, motifs.",
      ].join("\n"),
      {
        type: "json_schema",
        name: "wake_up_story",
        schema: wakeUpStorySchema,
        strict: true,
      },
    ),
    "Story generator",
  );
}

async function generateBreakfastConcept(city: WorldCity) {
  return parseModelJson<{
    name: string;
    nameZh: string;
    description: string;
    descriptionZh: string;
    highlightIngredients: string[];
    breakfastCategory: string;
    sceneSetting: string;
    visualAnchors: string[];
    avoidRepeats: string[];
  }>(
    await callOpenAIText(
      [
        "Recommend one iconic local breakfast and return it as JSON.",
        `City: ${city.city}, ${city.country}`,
        `City (Traditional Chinese): ${city.cityZh}, ${city.countryZh}`,
        "Prioritize city-level breakfast culture, serving context, and plausible tableware or packaging.",
        "Use short label-style values for breakfastCategory and sceneSetting, ideally 1 to 4 words.",
        "Do not use commas in breakfastCategory, sceneSetting, motifs, or visualAnchors.",
        "Return JSON with name, nameZh, description, descriptionZh, highlightIngredients, breakfastCategory, sceneSetting, visualAnchors, avoidRepeats.",
        "highlightIngredients must be an array of short canonical ingredient names.",
        "visualAnchors must be an array of concrete city-grounded serving or tableware cues.",
        "avoidRepeats must be an array of brief repetition-control notes.",
      ].join("\n"),
      {
        type: "json_schema",
        name: "local_breakfast",
        schema: localBreakfastSchema,
        strict: true,
      },
    ),
    "Breakfast generator",
  );
}

async function generateRecipe(city: WorldCity, breakfastConcept: Awaited<ReturnType<typeof generateBreakfastConcept>>) {
  return parseModelJson<RecipeResult>(
    await callOpenAIText(
      [
        "Create a practical bilingual single-serving recipe as JSON.",
        `City: ${city.city}, ${city.country}`,
        `City (Traditional Chinese): ${city.cityZh}, ${city.countryZh}`,
        `Breakfast concept: ${breakfastConcept.name}`,
        `Breakfast concept (Traditional Chinese): ${breakfastConcept.nameZh}`,
        `Description: ${breakfastConcept.description}`,
        `Description (Traditional Chinese): ${breakfastConcept.descriptionZh}`,
        `Highlight ingredients: ${breakfastConcept.highlightIngredients.join(", ")}`,
        `Breakfast category: ${breakfastConcept.breakfastCategory}`,
        `Scene setting: ${breakfastConcept.sceneSetting}`,
        `Visual anchors: ${breakfastConcept.visualAnchors.join(", ")}`,
        "Generate a practical single-serving breakfast recipe inspired by this city and country.",
        "The recipe must include ingredients with quantities, steps, and total time.",
        "Return bilingual content that stays consistent with the same ingredients in English and Traditional Chinese.",
        "Also return an image prompt that matches exactly the same ingredients, scene setting, and plating style.",
        "Return JSON with title, titleZh, recipe, recipeZh, highlightIngredients, imagePrompt, breakfastCategory, sceneSetting, visualAnchors.",
      ].join("\n"),
      {
        type: "json_schema",
        name: "breakfast_recipe",
        schema: breakfastRecipeSchema,
        strict: true,
      },
    ),
    "Recipe generator",
  );
}

async function localizeLocationNames(city: WorldCity): Promise<WorldCity> {
  const needsCityTranslation = city.cityZh.trim() === city.city.trim();
  const needsCountryTranslation = city.countryZh.trim() === city.country.trim();

  if (!needsCityTranslation && !needsCountryTranslation) {
    return city;
  }

  const localized = parseModelJson<{ cityZh: string; countryZh: string }>(
    await callOpenAIText(
      [
        "Translate place names into Traditional Chinese and return JSON.",
        `City in English: ${city.city}`,
        `Country in English: ${city.country}`,
        "Return Traditional Chinese names that are natural and commonly used in Taiwan.",
        "Return JSON with keys cityZh and countryZh.",
      ].join("\n"),
      {
        type: "json_schema",
        name: "location_zh_names",
        schema: locationZhNamesSchema,
        strict: true,
      },
    ),
    "Location name generator",
  );

  return {
    ...city,
    cityZh: localized.cityZh,
    countryZh: localized.countryZh,
  };
}

function buildImagePrompt(city: WorldCity, recipe: RecipeResult): string {
  if (recipe.imagePrompt?.trim()) {
    return [
      recipe.imagePrompt.trim(),
      `Inspired by authentic ${city.city}, ${city.country} food culture.`,
      "Fixed camera angle: 90-degree overhead top view from directly above the table.",
      "Keep the full breakfast set centered on the table in the middle of the frame.",
      "Single-person breakfast portion.",
      "Show only food, utensils, and tabletop.",
      "Natural light, realistic textures, editorial composition.",
      "No angled shot, no 3/4 view, no side view, no extreme close-up crop.",
      "No people, no humans, no hands, no text, no logo, no watermark.",
    ].join(" ");
  }

  return [
    `90-degree overhead top view editorial food photograph of a single-person breakfast set inspired by authentic ${city.city}, ${city.country} food culture.`,
    `Dish title: ${recipe.title}.`,
    `Must include these ingredients from recipe: ${recipe.highlightIngredients.join(", ")}.`,
    `Match recipe plating style and portions: ${recipe.recipe}`,
    "Keep the full breakfast set centered on the table in the middle of the frame.",
    "Show only food, utensils, and tabletop.",
    "90-degree overhead top view, centered on the table, single-person composition, natural light, realistic textures, editorial composition.",
    "No angled shot, no 3/4 view, no side view, no extreme close-up crop.",
    "No people, no humans, no hands, no text, no logo, no watermark.",
  ].join(" ");
}

function buildR2PublicUrl(publicUrlBase: string, key: string): string {
  return `${publicUrlBase.replace(/\/$/, "")}/${key}`;
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hashSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: string | Uint8Array, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function encodeR2Key(key: string): string {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function signR2Request(options: {
  method: string;
  url: URL;
  accessKeyId: string;
  secretAccessKey: string;
  body: Uint8Array;
  contentType: string;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashSha256(options.body);
  const host = options.url.host;
  const canonicalHeaders =
    `content-type:${options.contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    options.method,
    options.url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join("\n");
  const kDate = hmacSha256(`AWS4${options.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, "auto");
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    authorization,
    amzDate,
    payloadHash,
  };
}

async function uploadToR2(cityName: string, recordedAtIso: string, imageBinary: Uint8Array) {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrlBase) {
    throw new Error("Missing Cloudflare R2 configuration");
  }

  const key = `wake-up-now/${slugify(cityName)}/${recordedAtIso.toLowerCase().replace(/[:.]/g, "-")}.png`;
  const url = new URL(`${endpoint.replace(/\/$/, "")}/${bucket}/${encodeR2Key(key)}`);
  const signature = signR2Request({
    method: "PUT",
    url,
    accessKeyId,
    secretAccessKey,
    body: imageBinary,
    contentType: "image/png",
  });

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: signature.authorization,
      "Content-Type": "image/png",
      "x-amz-content-sha256": signature.payloadHash,
      "x-amz-date": signature.amzDate,
    },
    body: Buffer.from(imageBinary),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} ${errorText}`);
  }

  return {
    imageStorageKey: key,
    imageUrl: buildR2PublicUrl(publicUrlBase, key),
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
    tone: string;
    motifs: string[];
    breakfastName: string;
    breakfastNameZh: string;
    breakfastDescription: string;
    breakfastDescriptionZh: string;
    highlightIngredients: string[];
    imagePrompt: string;
    breakfastCategory: string;
    sceneSetting: string;
    visualAnchors: string[];
    avoidRepeats: string[];
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
    [["breakfast name"], record.breakfastName],
    [["breakfast name zh"], record.breakfastNameZh],
    [["breakfast description"], record.breakfastDescription],
    [["breakfast description zh"], record.breakfastDescriptionZh],
    [["highlight ingredients"], record.highlightIngredients.join(", ")],
    [["image prompt"], record.imagePrompt],
    [["avoid repeats"], record.avoidRepeats.join("; ")],
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

  const toneName = findPropertyName(schema, "rich_text", ["tone"]);
  if (toneName && record.tone) {
    properties[toneName] = {
      rich_text: [{ text: { content: sanitizeOptionName(record.tone) } }],
    };
  }

  const breakfastCategoryName = findPropertyName(schema, "rich_text", ["breakfast category"]);
  if (breakfastCategoryName && record.breakfastCategory) {
    properties[breakfastCategoryName] = {
      rich_text: [{ text: { content: sanitizeOptionName(record.breakfastCategory) } }],
    };
  }

  const sceneSettingName = findPropertyName(schema, "rich_text", ["scene setting"]);
  if (sceneSettingName && record.sceneSetting) {
    properties[sceneSettingName] = {
      rich_text: [{ text: { content: sanitizeOptionName(record.sceneSetting) } }],
    };
  }

  const motifsName = findPropertyName(schema, "rich_text", ["motifs"]);
  if (motifsName) {
    properties[motifsName] = {
      rich_text: [{ text: { content: sanitizeMultiSelectValues(record.motifs).join(", ") } }],
    };
  }

  const visualAnchorsName = findPropertyName(schema, "rich_text", ["visual anchors"]);
  if (visualAnchorsName) {
    properties[visualAnchorsName] = {
      rich_text: [{ text: { content: sanitizeMultiSelectValues(record.visualAnchors).join(", ") } }],
    };
  }

  const numberMappings: Array<[string[], number]> = [
    [["latitude"], record.latitude],
    [["longitude", "longtitude"], record.longitude],
    [["utc offset", "utcoffset"], record.utcOffset],
  ];

  for (const [aliases, value] of numberMappings) {
    const propertyName = findPropertyName(schema, "number", aliases);
    if (propertyName) {
      properties[propertyName] = { number: value };
    }
  }

  const imageUrlName = findPropertyName(schema, "url", ["image url", "imageurl", "image"]);
  if (imageUrlName && record.imageUrl) {
    properties[imageUrlName] = { url: record.imageUrl };
  }

  const imageStorageKeyName = findPropertyName(schema, "url", ["imagestoragekey", "image storage key"]);
  if (imageStorageKeyName && record.imageStorageKey) {
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

    const recentCityNames = await getRecentCityNames(notionApiKey, databaseId);
    const selectedCity = selectCity(context.nowUtcIso, recentCityNames);
    const existingLocationLabels = await getExistingLocationLabels(notionApiKey, databaseId, selectedCity);
    const city = await localizeLocationNames({
      ...selectedCity,
      cityZh: existingLocationLabels?.cityZh ?? selectedCity.cityZh,
      countryZh: existingLocationLabels?.countryZh ?? selectedCity.countryZh,
    });
    const greeting = await generateGreeting(city);
    const story = await generateStory(city, greeting, context.userName);
    const breakfastConcept = await generateBreakfastConcept(city);
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
          tone: story.tone,
          motifs: story.motifs,
          breakfastName: breakfastConcept.name,
          breakfastNameZh: breakfastConcept.nameZh,
          breakfastDescription: breakfastConcept.description,
          breakfastDescriptionZh: breakfastConcept.descriptionZh,
          highlightIngredients: breakfastConcept.highlightIngredients,
          imagePrompt: "",
          breakfastCategory: breakfastConcept.breakfastCategory,
          sceneSetting: breakfastConcept.sceneSetting,
          visualAnchors: breakfastConcept.visualAnchors,
          avoidRepeats: breakfastConcept.avoidRepeats,
          recipe: "",
          recipeZh: "",
          imageUrl: "",
          imageStorageKey: "",
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
        userName: context.userName,
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
        breakfastName: breakfastConcept.name,
        breakfastNameZh: breakfastConcept.nameZh,
        breakfastDescription: breakfastConcept.description,
        breakfastDescriptionZh: breakfastConcept.descriptionZh,
        highlightIngredients: breakfastConcept.highlightIngredients.join(", "),
        imagePrompt: "",
        tone: story.tone,
        motifs: story.motifs,
        breakfastCategory: breakfastConcept.breakfastCategory,
        sceneSetting: breakfastConcept.sceneSetting,
        visualAnchors: breakfastConcept.visualAnchors,
        avoidRepeats: breakfastConcept.avoidRepeats.join("; "),
        recipe: "",
        recipeZh: "",
        recipe_zh: "",
        imageUrl: "",
        latitude: city.latitude,
        longitude: city.longitude,
        utcOffset: city.utcOffset,
        recordedAtDate: context.recordedAtDate,
        recordedAt: context.recordedAt,
        timezone: context.timezone,
      },
      imageJob: {
        pageId: createdPage.id,
        city: city.city,
        cityZh: city.cityZh,
        country: city.country,
        countryZh: city.countryZh,
        recordedAtIso: context.recordedAtIso,
        breakfastName: breakfastConcept.name,
        breakfastNameZh: breakfastConcept.nameZh,
        breakfastDescription: breakfastConcept.description,
        breakfastDescriptionZh: breakfastConcept.descriptionZh,
        highlightIngredients: breakfastConcept.highlightIngredients,
        breakfastCategory: breakfastConcept.breakfastCategory,
        sceneSetting: breakfastConcept.sceneSetting,
        visualAnchors: breakfastConcept.visualAnchors,
        avoidRepeats: breakfastConcept.avoidRepeats,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return response.status(500).json({ error: message });
  }
}
