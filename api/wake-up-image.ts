import { createHash, createHmac, randomUUID } from "node:crypto";

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
    throw Object.assign(new Error(`OpenAI image request failed: ${response.status} ${errorText}`), { confirmedNoImage: [400, 401, 403, 404, 422, 429].includes(response.status) });
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
  extraHeaders?: Record<string, string>;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashSha256(options.body);
  const host = options.url.host;
  const headers: Record<string,string> = {
    "content-type":options.contentType, host,
    "x-amz-content-sha256":payloadHash, "x-amz-date":amzDate,
    ...options.extraHeaders,
  };
  const names=Object.keys(headers).sort();
  const canonicalHeaders=names.map(name=>`${name}:${headers[name].trim()}\n`).join("");
  const signedHeaders=names.join(";");
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
  const existingUrl = imageUrlName ? (properties[imageUrlName] as {url?:string}).url : "";
  if (imageUrlName) patchProperties[imageUrlName] = {url:existingUrl || payload.imageUrl};

  const imagePromptName = findPropertyName(properties, "rich_text", ["image prompt"]);
  if (imagePromptName) {
    patchProperties[imagePromptName] = {
      rich_text: [{ text: { content: payload.imagePrompt } }],
    };
  }

  const imageStorageKeyText = findPropertyName(properties, "rich_text", ["imagestoragekey", "image storage key"]);
  const imageStorageKeyUrl = findPropertyName(properties, "url", ["imagestoragekey", "image storage key"]);
  if (imageStorageKeyText && payload.imageStorageKey) patchProperties[imageStorageKeyText] = {rich_text:[{text:{content:payload.imageStorageKey}}]};
  else if (imageStorageKeyUrl && payload.imageStorageKey) patchProperties[imageStorageKeyUrl] = {url:payload.imageUrl};

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
  return existingUrl || payload.imageUrl;
}

type StoredBreakfast = {recipe:string;recipeZh:string;imagePrompt:string;imageUrl:string;imageStorageKey:string};
type ImageReceipt = {version:1;pageId:string;owner:string;phase:'preparing'|'image_requested'|'stored'|'failed';updatedAt:number;breakfast?:StoredBreakfast};

export function createR2ObjectRequester() {
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw Error("Missing Cloudflare R2 configuration");
  return (method: string, key: string, body = new Uint8Array(), contentType = "application/json",
    conditions: Record<string, string> = {}) => {
    const url = new URL(`${endpoint.replace(/\/$/, "")}/${bucket}/${encodeR2Key(key)}`);
    const signature = signR2Request({ method, url, accessKeyId, secretAccessKey, body, contentType, extraHeaders: conditions });
    return fetch(url, {
      method,
      headers: {
        "Content-Type": contentType,
        Authorization: signature.authorization,
        "x-amz-content-sha256": signature.payloadHash,
        "x-amz-date": signature.amzDate,
        ...conditions,
      },
      ...(method === "PUT" ? { body: Buffer.from(body) } : {}),
    });
  };
}

// The receipt is shared by all serverless instances. Never expire an
// image_requested receipt: a lost provider response must not charge for a retry.
function breakfastStore(pageId:string) {
  const publicBase=process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if(!publicBase)throw Error('Missing Cloudflare R2 public URL');
  const normalized=pageId.trim().toLowerCase().replace(/-/g,'');
  const prefix=`breakfast-records/v1/${createHash('sha256').update(normalized).digest('hex')}`;
  const imageStorageKey=prefix+'/image.png',receiptKey=prefix+'/job.json';
  const imageUrl=buildR2PublicUrl(publicBase,imageStorageKey);
  const request = createR2ObjectRequester();
  const read=async():Promise<{job:ImageReceipt;etag:string}|null>=>{
    const response=await request('GET',receiptKey);
    if(response.status===404)return null;
    if(!response.ok)throw Error(`Image receipt read failed (${response.status})`);
    const job=await response.json() as ImageReceipt,etag=response.headers.get('etag');
    if(job.version!==1||job.pageId!==pageId||!etag)throw Error('Invalid image receipt; regeneration disabled');
    return {job,etag};
  };
  const write=async(job:ImageReceipt,etag?:string)=>{
    let response:Response;
    try{
      for(let attempt=0;attempt<3;attempt++){
        response=await request('PUT',receiptKey,Buffer.from(JSON.stringify(job)),'application/json',etag?{'if-match':etag}:{'if-none-match':'*'});
        if(response.status!==429||attempt===2)break;
        await new Promise(resolve=>setTimeout(resolve,1100));
      }
    }
    catch(error){const saved=await read();if(saved?.job.owner===job.owner&&saved.job.phase===job.phase)return saved;throw error;}
    if(response.status===412)return null;
    if(!response.ok)throw Error(`Image receipt write failed (${response.status})`);
    const next=response.headers.get('etag');
    if(next)return {job,etag:next};
    const saved=await read();return saved?.job.owner===job.owner&&saved.job.phase===job.phase?saved:null;
  };
  const hasImage=async()=>{
    const response=await request('HEAD',imageStorageKey,new Uint8Array(),'image/png');
    if(response.status===404)return false;
    if(!response.ok)throw Error(`Stored image check failed (${response.status})`);
    return true;
  };
  const saveImage=async(bytes:Uint8Array)=>{
    let error:unknown;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await request('PUT',imageStorageKey,bytes,'image/png',{'if-none-match':'*'});
        if(response.ok||response.status===412)return;
        if(response.status===429&&attempt<2)await new Promise(resolve=>setTimeout(resolve,1100));
        throw Error(`Image storage failed (${response.status})`);
      }catch(failure){error=failure;}
    }
    throw error;
  };
  return {read,write,hasImage,saveImage,imageUrl,imageStorageKey};
}

async function prepareImageRecipe(body:WakeUpImageBody){
  const city={city:body.city!,cityZh:body.cityZh||body.city!,country:body.country!,countryZh:body.countryZh||body.country!};
  const concept=body.breakfastName&&body.breakfastNameZh&&body.breakfastDescription&&body.breakfastDescriptionZh
    ?{name:body.breakfastName,nameZh:body.breakfastNameZh,description:body.breakfastDescription,descriptionZh:body.breakfastDescriptionZh,highlightIngredients:body.highlightIngredients??[],breakfastCategory:body.breakfastCategory??'',sceneSetting:body.sceneSetting??'',visualAnchors:body.visualAnchors??[],avoidRepeats:body.avoidRepeats??[]}
    :await generateBreakfastConcept(city);
  return generateRecipe(city,concept);
}

export default async function handler(
  request: { method?: string; body?: WakeUpImageBody },
  response: {
    status(code: number): { json(payload: unknown): unknown };
    json(payload: unknown): unknown;
    setHeader?(name: string, value: string | string[]): unknown;
  },
) {
  response.setHeader?.("Cache-Control", "no-store");
  try {
    if(request.method!=="POST") { response.setHeader?.("Allow","POST"); return response.status(405).json({error:"Method Not Allowed"}); }
    let body=request.body??{};
    if(!body.pageId)return response.status(400).json({error:"Missing wake-up image pageId"});
    const apiKey=process.env.NOTION_API_KEY,databaseId=process.env.NOTION_DATABASE_ID;
    if(!apiKey||!databaseId)throw Error("Missing NOTION_API_KEY or NOTION_DATABASE_ID");
    const pageResponse=await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(body.pageId)}`,{headers:{Authorization:`Bearer ${apiKey}`,"Notion-Version":"2022-06-28"}});
    if(!pageResponse.ok)throw Error(`Image page fetch failed (${pageResponse.status})`);
    const page=await pageResponse.json(),p=page.properties??{};
    const normalize=(value:string)=>value.trim().toLowerCase().replace(/[\s_-]+/g,"");
    const read=(aliases:string[])=>{
      const names=Object.keys(p).filter(name=>aliases.some(alias=>normalize(alias)===normalize(name)));
      return names.map(name=>p[name]?.rich_text?.map((part:any)=>part.plain_text??part.text?.content??"").join("")).find(Boolean)||"";
    };
    if(page.archived||page.in_trash||normalize(page.parent?.database_id||"")!==normalize(databaseId))throw Error("Image record is not in the WakeUp Map database");
    const imageName=Object.keys(p).find(name=>["imageurl","image"].includes(normalize(name))&&p[name]?.type==="url");
    const existingImage=imageName?p[imageName].url:"";
    const isAwakening=Boolean(read(["wakeuphere_event_id"]));
    // A saved image always wins, even if the caller changed its city/time,
    // or its recipe is incomplete. Repair text separately, never the picture.
    if(existingImage&&read(["recipe"]))return response.status(200).json({ok:true,imageUrl:existingImage,existing:true});
    if(body.awakeningRecord&&!isAwakening)throw Error("Page is not an awakening in the WakeUp Map database");
    if(isAwakening){
      const stored=read(["wakeuphere_image_job"]);
      if(stored){const job=JSON.parse(stored);if(!job.awakeningRecord||job.pageId!==body.pageId)throw Error("Invalid stored breakfast job");body=job;}
      else if(!existingImage)throw Error("Prepare awakening content before its image");
    }
    if(existingImage){
      if(body.city&&body.country){
        const recipe=await prepareImageRecipe(body);
        await updateNotionBreakfastProperties(body.pageId!,{recipe:recipe.recipe,recipeZh:recipe.recipeZh,imagePrompt:read(["image prompt"]),imageUrl:existingImage,imageStorageKey:""});
      }
      return response.status(200).json({ok:true,imageUrl:existingImage,existing:true});
    }
    if(!body.city||!body.country||!body.recordedAtIso)return response.status(400).json({error:"Missing required wake-up image payload"});
    if(!imageName)throw Error("The record needs an Image URL field before image generation");
    const id=page.id||body.pageId;
    const store=breakfastStore(id),previous=await store.read();
    if(await store.hasImage()){
      const saved=previous?.job.breakfast || {
        recipe:read(["recipe"]),recipeZh:read(["recipe zh","recipeZh","recipe_zh"]),imagePrompt:read(["image prompt"]),
        imageUrl:store.imageUrl,imageStorageKey:store.imageStorageKey,
      };
      const imageUrl=await updateNotionBreakfastProperties(id,saved);
      return response.status(200).json({ok:true,imageUrl,existing:true});
    }
    const pending=()=>response.status(409).json({ok:false,pending:true,error:"Image generation already started; waiting for its stored result. A second image will not be requested."});
    if(previous&&!(previous.job.phase==="failed"||(previous.job.phase==="preparing"&&Date.now()-previous.job.updatedAt>300000)))return pending();
    let receipt=await store.write({version:1,pageId:id,owner:randomUUID(),phase:"preparing",updatedAt:Date.now()},previous?.etag);
    if(!receipt)return pending();
    let imageStarted=false;
    try{
      const recipe=await prepareImageRecipe(body);
      const breakfast:StoredBreakfast={recipe:recipe.recipe,recipeZh:recipe.recipeZh,imagePrompt:buildImagePrompt(body.city,body.country,recipe),imageUrl:store.imageUrl,imageStorageKey:store.imageStorageKey};
      const requested=await store.write({...receipt.job,phase:"image_requested",breakfast,updatedAt:Date.now()},receipt.etag);
      if(!requested)return pending();
      receipt=requested;imageStarted=true;
      const bytes=await callOpenAIImage(breakfast.imagePrompt);
      await store.saveImage(bytes);
      // If this receipt update fails, HEAD + the image_requested receipt can
      // still recover the saved bytes. Never call the image model again.
      await store.write({...receipt.job,phase:"stored",updatedAt:Date.now()},receipt.etag);
      const imageUrl=await updateNotionBreakfastProperties(id,breakfast);
      return response.status(200).json({ok:true,imageUrl});
    }catch(error){
      if(!imageStarted||(error as {confirmedNoImage?:boolean})?.confirmedNoImage){
        try{await store.write({...receipt.job,phase:"failed",updatedAt:Date.now()},receipt.etag);}catch{}
      }
      throw error;
    }
  }catch(error){return response.status(500).json({error:error instanceof Error?error.message:"Unknown image error"});}
}
