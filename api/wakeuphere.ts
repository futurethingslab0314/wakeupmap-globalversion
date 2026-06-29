type NotionPropertyDefinition = {
  type?: string;
  name?: string;
};

type NotionPageResponse = {
  properties?: Record<string, unknown>;
};

const WAKEUPHERE_PAGE_ID = "38ea7f1b413c803cb5b7c0c18811688e";
const DEFAULT_USER_NAME = "YuPie";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function getPlainText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (typeof item === "object" && item !== null && "plain_text" in item ? String((item as { plain_text?: unknown }).plain_text ?? "") : ""))
    .join("")
    .trim();
}

function getTitleProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("title" in property)) return "";
  return getPlainText((property as { title?: unknown }).title);
}

function getRichTextProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("rich_text" in property)) return "";
  return getPlainText((property as { rich_text?: unknown }).rich_text);
}

function getSelectProperty(properties: Record<string, unknown>, key: string): string {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("select" in property)) return "";
  const value = (property as { select?: { name?: unknown } | null }).select;
  return typeof value?.name === "string" ? value.name : "";
}

function findPropertyName(properties: Record<string, NotionPropertyDefinition>, type: string, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeKey));
  for (const [name, definition] of Object.entries(properties)) {
    if (definition.type === type && aliasSet.has(normalizeKey(name))) {
      return name;
    }
  }
  return undefined;
}

function readPropertyValue(properties: Record<string, unknown>, candidates: Array<{ type: string; aliases: string[] }>) {
  for (const candidate of candidates) {
    const propertyName = Object.keys(properties).find((name) => {
      const definition = properties[name] as NotionPropertyDefinition | undefined;
      return definition?.type === candidate.type && candidate.aliases.some((alias) => normalizeKey(alias) === normalizeKey(name));
    });
    if (!propertyName) continue;
    if (candidate.type === "title") return getTitleProperty(properties, propertyName);
    if (candidate.type === "rich_text") return getRichTextProperty(properties, propertyName);
    if (candidate.type === "select") return getSelectProperty(properties, propertyName);
  }
  return "";
}

function buildTextProperty(value: string) {
  return { rich_text: [{ text: { content: value } }] };
}

function buildTitleProperty(value: string) {
  return { title: [{ text: { content: value } }] };
}

function buildPressProperty(pageProperties: Record<string, NotionPropertyDefinition>, pressValue: "yes") {
  const pressName = findPropertyName(pageProperties, "select", ["press"]) ?? findPropertyName(pageProperties, "checkbox", ["press"]);
  if (!pressName) return {};

  const pressProperty = pageProperties[pressName];
  if (pressProperty?.type === "checkbox") {
    return { [pressName]: { checkbox: true } };
  }
  return { [pressName]: { select: { name: pressValue } } };
}

async function loadPage(pageId: string, apiKey: string): Promise<NotionPageResponse> {
  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });
  if (!response.ok) {
    throw new Error(`Notion page fetch failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as NotionPageResponse;
}

export default async function handler(
  request: { method?: string; body?: Record<string, unknown>; query?: Record<string, string | string[] | undefined> },
  response: {
    status(code: number): { json(payload: unknown): unknown };
    json(payload: unknown): unknown;
    setHeader?(name: string, value: string | string[]): unknown;
  },
) {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) {
      return response.status(500).json({ error: "Missing NOTION_API_KEY" });
    }

    if (request.method === "GET") {
      const pageId = typeof request.query?.pageId === "string" ? request.query.pageId : WAKEUPHERE_PAGE_ID;
      const selectedCityEn = typeof request.query?.city === "string" ? request.query.city : "";
      const selectedCountryEn = typeof request.query?.country === "string" ? request.query.country : "";
      const selectedCityZh = typeof request.query?.cityZh === "string" ? request.query.cityZh : "";
      const selectedCountryZh = typeof request.query?.countryZh === "string" ? request.query.countryZh : "";

      const page = await loadPage(pageId, notionApiKey);
      const properties = page.properties ?? {};
      const pageCity = readPropertyValue(properties, [
        { type: "rich_text", aliases: ["setup_city", "setup city", "city"] },
        { type: "title", aliases: ["setup_city", "setup city", "city"] },
      ]);
      const pageCountry = readPropertyValue(properties, [
        { type: "rich_text", aliases: ["setup_country", "setup country", "country"] },
        { type: "title", aliases: ["setup_country", "setup country", "country"] },
      ]);

      const pageCityZh = readPropertyValue(properties, [
        { type: "rich_text", aliases: ["setup_city_zh", "setup city zh", "city_zh", "city zh"] },
      ]);
      const pageCountryZh = readPropertyValue(properties, [
        { type: "rich_text", aliases: ["setup_country_zh", "setup country zh", "country_zh", "country zh"] },
      ]);

      const pageUserName = readPropertyValue(properties, [
        { type: "title", aliases: ["userName", "user name", "name"] },
        { type: "rich_text", aliases: ["userName", "user name", "name"] },
      ]) || DEFAULT_USER_NAME;

      const matched =
        normalizeKey(pageCity) === normalizeKey(selectedCityEn) ||
        normalizeKey(pageCityZh) === normalizeKey(selectedCityZh);

      return response.status(200).json({
        matched,
        userName: matched ? pageUserName : DEFAULT_USER_NAME,
        setup_city: pageCity,
        setup_city_zh: pageCityZh,
        setup_country: pageCountry,
        setup_country_zh: pageCountryZh,
        pageId,
      });
    }

    if (request.method === "POST") {
      const body = request.body ?? {};
      const pageId = typeof body.pageId === "string" ? body.pageId : WAKEUPHERE_PAGE_ID;
      const page = await loadPage(pageId, notionApiKey);
      const properties = page.properties ?? {};
      const updateProperties: Record<string, unknown> = {};

      const userName = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim() : DEFAULT_USER_NAME;
      const setupCity = typeof body.setup_city === "string" ? body.setup_city : "";
      const setupCityZh = typeof body.setup_city_zh === "string" ? body.setup_city_zh : "";
      const setupCountry = typeof body.setup_country === "string" ? body.setup_country : "";
      const setupCountryZh = typeof body.setup_country_zh === "string" ? body.setup_country_zh : "";
      const press = typeof body.press === "string" ? body.press : "yes";

      const userNameName = findPropertyName(properties as Record<string, NotionPropertyDefinition>, "title", ["userName", "user name", "name"]);
      if (userNameName) updateProperties[userNameName] = buildTitleProperty(userName);

      const setupCityName = findPropertyName(properties as Record<string, NotionPropertyDefinition>, "rich_text", ["setup_city", "setup city", "city"]);
      if (setupCityName) updateProperties[setupCityName] = buildTextProperty(setupCity);

      const setupCityZhName = findPropertyName(properties as Record<string, NotionPropertyDefinition>, "rich_text", ["setup_city_zh", "setup city zh", "city_zh", "city zh"]);
      if (setupCityZhName) updateProperties[setupCityZhName] = buildTextProperty(setupCityZh);

      const setupCountryName = findPropertyName(properties as Record<string, NotionPropertyDefinition>, "rich_text", ["setup_country", "setup country", "country"]);
      if (setupCountryName) updateProperties[setupCountryName] = buildTextProperty(setupCountry);

      const setupCountryZhName = findPropertyName(properties as Record<string, NotionPropertyDefinition>, "rich_text", ["setup_country_zh", "setup country zh", "country_zh", "country zh"]);
      if (setupCountryZhName) updateProperties[setupCountryZhName] = buildTextProperty(setupCountryZh);

      Object.assign(updateProperties, buildPressProperty(properties as Record<string, NotionPropertyDefinition>, press === "yes" ? "yes" : "yes"));

      const updateResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties: updateProperties }),
      });

      if (!updateResponse.ok) {
        throw new Error(`Notion page update failed: ${updateResponse.status} ${await updateResponse.text()}`);
      }

      return response.status(200).json({
        ok: true,
        pageId,
        userName,
        press: "yes",
      });
    }

    response.setHeader?.("Allow", "GET, POST");
    return response.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return response.status(500).json({ error: message });
  }
}
