import { createHash, createHmac } from "node:crypto";

type WakeUpImageBody = {
  awakeningRecord?: boolean;
  pageId?: string;
  city?: string;
  cityZh?: string;
  country?: string;
  countryZh?: string;
  recordedAtIso?: string;
  breakfastName?: string;
  breakfastNameZh?: string;
  breakfastDescription?: string;
  breakfastDescriptionZh?: string;
  highlightIngredients?: string[];
  breakfastCategory?: string;
  sceneSetting?: string;
  visualAnchors?: string[];
  avoidRepeats?: string[];
};

type NotionPropertyDefinition = {
  type?: string;
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
  },
  required: ["name", "nameZh", "description", "descriptionZh", "highlightIngredients"],
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return apiKey;
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

async function generateBreakfastConcept(city: { city: string; cityZh: string; country: string; countryZh: string }) {
  return parseModelJson<{
    name: string;
    nameZh: string;
    description: string;
    descriptionZh: string;
    highlightIngredients: string[];
  }>(
    await callOpenAIText(
      [
        "Recommend one iconic local breakfast and return it as JSON.",
        `City: ${city.city}, ${city.country}`,
        `City (Traditional Chinese): ${city.cityZh}, ${city.countryZh}`,
        "Return JSON with name, nameZh, description, descriptionZh, highlightIngredients.",
        "highlightIngredients must be an array of short canonical ingredient names.",
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

async function generateRecipe(
  city: { city: string; cityZh: string; country: string; countryZh: string },
  breakfastConcept: Awaited<ReturnType<typeof generateBreakfastConcept>>,
) {
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
        ...("breakfastCategory" in breakfastConcept && breakfastConcept.breakfastCategory
          ? [`Breakfast category: ${breakfastConcept.breakfastCategory}`]
          : []),
        ...("sceneSetting" in breakfastConcept && breakfastConcept.sceneSetting
          ? [`Scene setting: ${breakfastConcept.sceneSetting}`]
          : []),
        ...("visualAnchors" in breakfastConcept && Array.isArray(breakfastConcept.visualAnchors) && breakfastConcept.visualAnchors.length
          ? [`Visual anchors: ${breakfastConcept.visualAnchors.join(", ")}`]
          : []),
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

async function callOpenAIImage(prompt: string): Promise<Uint8Array> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2.5-flare",
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

function buildImagePrompt(
  city: string,
  country: string,
  recipe: {
    title?: string;
    recipe?: string;
    highlightIngredients?: string[];
    imagePrompt?: string;
    breakfastCategory?: string;
    sceneSetting?: string;
    visualAnchors?: string[];
  },
): string {
  if (recipe.imagePrompt?.trim()) {
    return [
      recipe.imagePrompt.trim(),
      `Inspired by authentic ${city}, ${country} food culture.`,
      ...(recipe.sceneSetting ? [`Scene setting: ${recipe.sceneSetting}.`] : []),
      ...(recipe.visualAnchors?.length ? [`Visual anchors: ${recipe.visualAnchors.join(", ")}.`] : []),
      ...(recipe.breakfastCategory ? [`Breakfast category: ${recipe.breakfastCategory}.`] : []),
      "Fixed camera angle: 90-degree overhead top view from directly above the table.",
      "Keep the full breakfast set centered on the table in the middle of the frame.",
      "Single-person breakfast portion.",
      "Show only food, utensils, and tabletop.",
      "Natural light, realistic textures, editorial composition.",
      "Avoid generic brunch styling, luxury hotel plating, and unrelated western props.",
      "No angled shot, no 3/4 view, no side view, no extreme close-up crop.",
      "No people, no humans, no hands, no text, no logo, no watermark.",
    ].join(" ");
  }

  return [
    `90-degree overhead top view editorial food photograph of a single-person breakfast set inspired by authentic ${city}, ${country} food culture.`,
    `Dish title: ${recipe.title ?? city}.`,
    `Must include these ingredients from recipe: ${(recipe.highlightIngredients ?? []).join(", ")}.`,
    `Match recipe plating style and portions: ${recipe.recipe ?? ""}`,
    ...(recipe.sceneSetting ? [`Scene setting: ${recipe.sceneSetting}.`] : []),
    ...(recipe.visualAnchors?.length ? [`Visual anchors: ${recipe.visualAnchors.join(", ")}.`] : []),
    ...(recipe.breakfastCategory ? [`Breakfast category: ${recipe.breakfastCategory}.`] : []),
    "Keep the full breakfast set centered on the table in the middle of the frame.",
    "Show only food, utensils, and tabletop.",
    "90-degree overhead top view, centered on the table, single-person composition, natural light, realistic textures, editorial composition.",
    "Avoid generic brunch styling, luxury hotel plating, and unrelated western props.",
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

  return { authorization, amzDate, payloadHash };
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

async function updateNotionBreakfastProperties(
  pageId: string,
  payload: { recipe: string; recipeZh: string; imagePrompt: string; imageUrl: string; imageStorageKey: string },
) {
  const notionApiKey = process.env.NOTION_API_KEY;
  if (!notionApiKey) {
    throw new Error("Missing NOTION_API_KEY");
  }

  const pageResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!pageResponse.ok) {
    const errorText = await pageResponse.text();
    throw new Error(`Notion page fetch failed: ${pageResponse.status} ${errorText}`);
  }

  const page = (await pageResponse.json()) as { properties?: Record<string, NotionPropertyDefinition> };
  const properties = page.properties ?? {};
  const patchProperties: Record<string, unknown> = {};

  const recipeName = findPropertyName(properties, "rich_text", ["recipe"]);
  if (recipeName) {
    patchProperties[recipeName] = {
      rich_text: [{ text: { content: payload.recipe } }],
    };
  }

  const recipeZhName = findPropertyName(properties, "rich_text", ["recipe zh", "recipezh", "recipe_zh"]);
  if (recipeZhName) {
    patchProperties[recipeZhName] = {
      rich_text: [{ text: { content: payload.recipeZh } }],
    };
  }

  const imageUrlName = findPropertyName(properties, "url", ["image url", "imageurl", "image"]);
  if (imageUrlName) {
    patchProperties[imageUrlName] = { url: payload.imageUrl };
  }

  const imagePromptName = findPropertyName(properties, "rich_text", ["image prompt"]);
  if (imagePromptName) {
    patchProperties[imagePromptName] = {
      rich_text: [{ text: { content: payload.imagePrompt } }],
    };
  }

  const imageStorageKeyName = findPropertyName(properties, "url", ["imagestoragekey", "image storage key"]);
  if (imageStorageKeyName) {
    patchProperties[imageStorageKeyName] = { url: payload.imageStorageKey };
  }

  if (properties.wakeuphere_content_status?.type === "rich_text") {
    patchProperties.wakeuphere_content_status = {rich_text:[{text:{content:"complete"}}]};
  }

  const updateResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${notionApiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: patchProperties }),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Notion page update failed: ${updateResponse.status} ${errorText}`);
  }
}

export default async function handler(
  request: { method?: string; body?: WakeUpImageBody },
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

    let body = request.body ?? {};
    if (body.awakeningRecord) {
      response.setHeader?.("Cache-Control", "no-store");
      if (!body.pageId) return response.status(400).json({ error: "Missing awakening pageId" });
      const pageResponse = await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(body.pageId)}`, {
        headers: { Authorization: `Bearer ${process.env.NOTION_API_KEY}`, "Notion-Version": "2022-06-28" },
      });
      if (!pageResponse.ok) throw new Error(`Awakening image page fetch failed (${pageResponse.status})`);
      const page = await pageResponse.json();
      const p = page.properties ?? {};
      const normalize = (s:string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");
      const read = (aliases:string[]) => {
        const key = Object.keys(p).find(name => aliases.some(alias => normalize(alias) === normalize(name)) && p[name]?.rich_text);
        return key ? p[key].rich_text.map((part:any) => part.plain_text ?? part.text?.content ?? "").join("") : "";
      };
      if (page.archived || page.in_trash || !process.env.NOTION_DATABASE_ID || normalize(page.parent?.database_id || "") !== normalize(process.env.NOTION_DATABASE_ID) || !read(["wakeuphere_event_id"])) throw new Error("Page is not an awakening in the WakeUp Map database");
      const imageName = Object.keys(p).find(name => ["imageurl","image"].includes(normalize(name)) && p[name]?.url);
      if (imageName && read(["recipe"])) return response.status(200).json({ ok:true, imageUrl:p[imageName].url, existing:true });
      const storedJob = JSON.parse(read(["wakeuphere_image_job"]) || "null");
      if (!storedJob?.awakeningRecord || storedJob.pageId !== body.pageId) throw new Error("Prepare the awakening content before its image");
      body = storedJob;
    }
    if (!body.pageId || !body.city || !body.country || !body.recordedAtIso) {
      return response.status(400).json({ error: "Missing required wake-up image payload" });
    }

    const localizedCity = body.cityZh || body.city;
    const localizedCountry = body.countryZh || body.country;
    const breakfastConcept =
      body.breakfastName && body.breakfastNameZh && body.breakfastDescription && body.breakfastDescriptionZh
        ? {
            name: body.breakfastName,
            nameZh: body.breakfastNameZh,
            description: body.breakfastDescription,
            descriptionZh: body.breakfastDescriptionZh,
            highlightIngredients: body.highlightIngredients ?? [],
            breakfastCategory: body.breakfastCategory ?? "",
            sceneSetting: body.sceneSetting ?? "",
            visualAnchors: body.visualAnchors ?? [],
            avoidRepeats: body.avoidRepeats ?? [],
          }
        : await generateBreakfastConcept({
            city: body.city,
            cityZh: localizedCity,
            country: body.country,
            countryZh: localizedCountry,
          });
    const recipe = await generateRecipe(
      {
        city: body.city,
        cityZh: localizedCity,
        country: body.country,
        countryZh: localizedCountry,
      },
      breakfastConcept,
    );
    const imagePrompt = buildImagePrompt(body.city, body.country, recipe);
    const imageBinary = await callOpenAIImage(imagePrompt);
    const uploadedImage = await uploadToR2(body.city, body.recordedAtIso, imageBinary);
    await updateNotionBreakfastProperties(body.pageId, {
      recipe: recipe.recipe,
      recipeZh: recipe.recipeZh,
      imagePrompt,
      imageUrl: uploadedImage.imageUrl,
      imageStorageKey: uploadedImage.imageStorageKey,
    });

    return response.status(200).json({ ok: true, imageUrl: uploadedImage.imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return response.status(500).json({ error: message });
  }
}
