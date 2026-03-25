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

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function getTitleProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("title" in property)) {
    return "";
  }

  return getPlainText((property as { title?: unknown }).title);
}

export function getRichTextProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("rich_text" in property)) {
    return "";
  }

  return getPlainText((property as { rich_text?: unknown }).rich_text);
}

export function getSelectProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("select" in property)) {
    return "";
  }

  const value = (property as { select?: { name?: unknown } | null }).select;
  if (typeof value !== "object" || value === null || !("name" in value)) {
    return "";
  }

  return typeof value.name === "string" ? value.name : "";
}

export function getMultiSelectProperty(properties: Record<string, unknown>, key: string): string[] {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("multi_select" in property)) {
    return [];
  }

  const value = (property as { multi_select?: unknown }).multi_select;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null || !("name" in item)) {
        return "";
      }

      return typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name : "";
    })
    .filter(Boolean);
}

export function getNumberProperty(properties: Record<string, unknown>, key: string): number {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("number" in property)) {
    return 0;
  }

  const value = (property as { number?: unknown }).number;
  return typeof value === "number" ? value : 0;
}

export function getUrlProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("url" in property)) {
    return "";
  }

  const value = (property as { url?: unknown }).url;
  return typeof value === "string" ? value : "";
}

export function getDateProperty(properties: Record<string, unknown>, key: string): string | undefined {
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

export function findPropertyName(
  properties: Record<string, { type?: string; name?: string }>,
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

function asRichText(value: string) {
  return {
    rich_text: [{ text: { content: value } }],
  };
}

function asTitle(value: string) {
  return {
    title: [{ text: { content: value } }],
  };
}

function asSelect(value: string) {
  return {
    select: { name: value },
  };
}

function asMultiSelect(values: string[]) {
  return {
    multi_select: values.filter(Boolean).map((value) => ({ name: value })),
  };
}

interface BuildWakeUpPagePropertiesInput {
  userName: string;
  city: string;
  cityZh: string;
  country: string;
  countryZh: string;
  greeting: string;
  story: string;
  storyZh: string;
  breakfastName: string;
  breakfastNameZh: string;
  breakfastDescription: string;
  breakfastDescriptionZh: string;
  highlightIngredients: string[];
  imagePrompt: string;
  tone: string;
  motifs: string[];
  breakfastCategory: string;
  sceneSetting: string;
  visualAnchors: string[];
  avoidRepeats: string[];
  recipe: string;
  recipeZh: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  utcOffset: number;
  recordedAtDate: string;
  timezone: string;
}

export function buildWakeUpPageProperties(
  schema: Record<string, { type?: string; name?: string }>,
  input: BuildWakeUpPagePropertiesInput,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  const titleName = findPropertyName(schema, "title", ["userName", "user name", "name", "title"]);
  if (titleName) {
    properties[titleName] = asTitle(input.userName);
  }

  const richTextMappings: Array<[string[], string]> = [
    [["city"], input.city],
    [["city zh", "cityzh", "city_zh"], input.cityZh],
    [["country"], input.country],
    [["country zh", "countryzh", "country_zh"], input.countryZh],
    [["greeting"], input.greeting],
    [["story"], input.story],
    [["story zh", "storyzh", "story_zh"], input.storyZh],
    [["breakfast name"], input.breakfastName],
    [["breakfast name zh"], input.breakfastNameZh],
    [["breakfast description"], input.breakfastDescription],
    [["breakfast description zh"], input.breakfastDescriptionZh],
    [["highlight ingredients"], input.highlightIngredients.join(", ")],
    [["image prompt"], input.imagePrompt],
    [["avoid repeats"], input.avoidRepeats.join("; ")],
    [["recipe"], input.recipe],
    [["recipe zh", "recipezh", "recipe_zh"], input.recipeZh],
    [["timezone"], input.timezone],
  ];

  for (const [aliases, value] of richTextMappings) {
    const propertyName = findPropertyName(schema, "rich_text", aliases);
    if (propertyName) {
      properties[propertyName] = asRichText(value);
    }
  }

  const selectMappings: Array<[string[], string]> = [
    [["tone"], input.tone],
    [["breakfast category"], input.breakfastCategory],
    [["scene setting"], input.sceneSetting],
  ];

  for (const [aliases, value] of selectMappings) {
    const propertyName = findPropertyName(schema, "select", aliases);
    if (propertyName && value) {
      properties[propertyName] = asSelect(value);
    }
  }

  const multiSelectMappings: Array<[string[], string[]]> = [
    [["motifs"], input.motifs],
    [["visual anchors"], input.visualAnchors],
  ];

  for (const [aliases, values] of multiSelectMappings) {
    const propertyName = findPropertyName(schema, "multi_select", aliases);
    if (propertyName) {
      properties[propertyName] = asMultiSelect(values);
    }
  }

  const numberMappings: Array<[string[], number]> = [
    [["latitude"], input.latitude],
    [["longitude", "longtitude"], input.longitude],
    [["utc offset", "utcoffset"], input.utcOffset],
  ];

  for (const [aliases, value] of numberMappings) {
    const propertyName = findPropertyName(schema, "number", aliases);
    if (propertyName) {
      properties[propertyName] = { number: value };
    }
  }

  const imageUrlName = findPropertyName(schema, "url", ["image url", "imageurl", "image"]);
  if (imageUrlName) {
    properties[imageUrlName] = { url: input.imageUrl };
  }

  const recordedAtDateName = findPropertyName(schema, "date", ["recorded at", "recordedat", "date"]);
  if (recordedAtDateName) {
    properties[recordedAtDateName] = { date: { start: input.recordedAtDate } };
  }

  return properties;
}

interface CreateNotionClientOptions {
  apiKey: string;
}

export function createNotionClient(options: CreateNotionClientOptions) {
  const headers = {
    Authorization: `Bearer ${options.apiKey}`,
    "Notion-Version": "2022-06-28",
  };

  return {
    async queryDatabase(databaseId: string) {
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          sorts: [{ timestamp: "created_time", direction: "descending" }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notion query failed: ${response.status} ${errorText}`);
      }

      return (await response.json()) as { results: unknown[] };
    },
    async createPage(databaseId: string, request: { properties: Record<string, unknown> }) {
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: request.properties,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notion page create failed: ${response.status} ${errorText}`);
      }

      return await response.json();
    },
    async getDatabase(databaseId: string) {
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notion database fetch failed: ${response.status} ${errorText}`);
      }

      const payload = (await response.json()) as { properties?: Record<string, { type?: string; name?: string }> };
      return { properties: payload.properties ?? {} };
    },
    async updatePage(pageId: string, request: { properties: Record<string, unknown> }) {
      const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notion page update failed: ${response.status} ${errorText}`);
      }

      return await response.json();
    },
  };
}
