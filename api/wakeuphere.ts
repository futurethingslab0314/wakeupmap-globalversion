type NotionPropertyDefinition = {
  type?: string;
  name?: string;
};

type NotionPageResponse = {
  properties?: Record<string, unknown>;
};

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

function getCheckboxProperty(properties: Record<string, unknown>, key: string): boolean {
  const property = properties[key];
  if (typeof property !== "object" || property === null || !("checkbox" in property)) return false;
  return Boolean((property as { checkbox?: unknown }).checkbox);
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

function buildTextProperty(value: string) {
  return { rich_text: [{ text: { content: value } }] };
}

function buildTitleProperty(value: string) {
  return { title: [{ text: { content: value } }] };
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
  request: { method?: string; body?: Record<string, unknown> },
  response: {
    status(code: number): { json(payload: unknown): unknown };
    json(payload: unknown): unknown;
    setHeader?(name: string, value: string | string[]): unknown;
  },
) {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const pageId = process.env.WAKEUPHERE_PAGE_ID;

    if (!notionApiKey || !pageId) {
      return response.status(500).json({ error: "Missing NOTION_API_KEY or WAKEUPHERE_PAGE_ID" });
    }

    const page = await loadPage(pageId, notionApiKey);
    const properties = page.properties ?? {};
    const schema = properties as Record<string, NotionPropertyDefinition>;

    const userNameName =
      findPropertyName(schema, "title", ["userName", "user name", "name"]) ??
      findPropertyName(schema, "rich_text", ["userName", "user name", "name"]);
    const pressName =
      findPropertyName(schema, "select", ["press"]) ??
      findPropertyName(schema, "checkbox", ["press"]);
    const setupCityName =
      findPropertyName(schema, "rich_text", ["setup_city", "setup city", "city"]) ??
      findPropertyName(schema, "title", ["setup_city", "setup city", "city"]);
    const setupCityZhName =
      findPropertyName(schema, "rich_text", ["setup_city_zh", "setup city zh", "city_zh", "city zh"]);
    const setupCountryName =
      findPropertyName(schema, "rich_text", ["setup_country", "setup country", "country"]) ??
      findPropertyName(schema, "title", ["setup_country", "setup country", "country"]);
    const setupCountryZhName =
      findPropertyName(schema, "rich_text", ["setup_country_zh", "setup country zh", "country_zh", "country zh"]);

    if (request.method === "GET") {
      const userName =
        (userNameName
          ? (properties[userNameName] as { title?: unknown; rich_text?: unknown })?.title
            ? getTitleProperty(properties, userNameName)
            : getRichTextProperty(properties, userNameName)
          : "") || DEFAULT_USER_NAME;
      const press =
        (pressName
          ? (schema[pressName]?.type === "checkbox"
            ? getCheckboxProperty(properties, pressName)
            : getSelectProperty(properties, pressName) === "yes")
          : false);

      return response.status(200).json({
        pageId,
        userName,
        press,
      });
    }

    if (request.method === "POST") {
      const body = request.body ?? {};
      const nextUserName = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim() : DEFAULT_USER_NAME;
      const nextPress = typeof body.press === "string" ? body.press : "yes";
      const nextSetupCity = typeof body.setup_city === "string" ? body.setup_city : "";
      const nextSetupCityZh = typeof body.setup_city_zh === "string" ? body.setup_city_zh : "";
      const nextSetupCountry = typeof body.setup_country === "string" ? body.setup_country : "";
      const nextSetupCountryZh = typeof body.setup_country_zh === "string" ? body.setup_country_zh : "";
      const updateProperties: Record<string, unknown> = {};

      if (userNameName) {
        updateProperties[userNameName] =
          schema[userNameName]?.type === "title" ? buildTitleProperty(nextUserName) : buildTextProperty(nextUserName);
      }

      if (pressName) {
        if (schema[pressName]?.type === "checkbox") {
          updateProperties[pressName] = { checkbox: nextPress === "yes" };
        } else {
          updateProperties[pressName] = { select: { name: nextPress } };
        }
      }

      if (setupCityName && nextSetupCity) {
        updateProperties[setupCityName] =
          schema[setupCityName]?.type === "title" ? buildTitleProperty(nextSetupCity) : buildTextProperty(nextSetupCity);
      }

      if (setupCityZhName && nextSetupCityZh) {
        updateProperties[setupCityZhName] = buildTextProperty(nextSetupCityZh);
      }

      if (setupCountryName && nextSetupCountry) {
        updateProperties[setupCountryName] =
          schema[setupCountryName]?.type === "title" ? buildTitleProperty(nextSetupCountry) : buildTextProperty(nextSetupCountry);
      }

      if (setupCountryZhName && nextSetupCountryZh) {
        updateProperties[setupCountryZhName] = buildTextProperty(nextSetupCountryZh);
      }

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
        userName: nextUserName,
        press: nextPress,
        setup_city: nextSetupCity,
        setup_city_zh: nextSetupCityZh,
        setup_country: nextSetupCountry,
        setup_country_zh: nextSetupCountryZh,
      });
    }

    response.setHeader?.("Allow", "GET, POST");
    return response.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return response.status(500).json({ error: message });
  }
}
