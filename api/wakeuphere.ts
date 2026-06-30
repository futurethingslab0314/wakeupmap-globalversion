type NotionPropertyDefinition = {
  type?: string;
  name?: string;
};

type NotionPageResponse = {
  properties?: Record<string, unknown>;
};

type NotionDatabaseResponse = {
  properties?: Record<string, NotionPropertyDefinition>;
};

type NotionQueryResponse = {
  results?: Array<{ id?: string; properties?: Record<string, unknown> }>;
};

const DEFAULT_USER_NAME = "YuPie";
const CITY_KEYS = ["setup_city", "setup city", "city"];
const CITY_ZH_KEYS = ["setup_city_zh", "setup city zh", "city_zh", "city zh"];

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

async function loadDatabase(databaseId: string, apiKey: string): Promise<NotionDatabaseResponse> {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!response.ok) {
    throw new Error(`Notion database fetch failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as NotionDatabaseResponse;
}

async function loadFirstPage(databaseId: string, apiKey: string): Promise<{ id?: string; properties?: Record<string, unknown> }> {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      page_size: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Notion query failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as NotionQueryResponse;
  return payload.results?.[0] ?? {};
}

async function loadAllPages(databaseId: string, apiKey: string): Promise<Array<{ id?: string; properties?: Record<string, unknown> }>> {
  const pages: Array<{ id?: string; properties?: Record<string, unknown> }> = [];
  let startCursor: string | undefined;

  for (;;) {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 100,
        ...(startCursor ? { start_cursor: startCursor } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Notion query failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as NotionQueryResponse & { has_more?: boolean; next_cursor?: string | null };
    pages.push(...(payload.results ?? []));

    if (!payload.has_more || !payload.next_cursor) {
      break;
    }

    startCursor = payload.next_cursor;
  }

  return pages;
}

function pickRequestQuery(request: { url?: string }) {
  if (!request.url) return new URLSearchParams();
  try {
    return new URL(request.url, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function readTextProperty(properties: Record<string, unknown>, key: string, schema?: Record<string, NotionPropertyDefinition>): string {
  const propertyType = schema?.[key]?.type;
  if (propertyType === "title") return getTitleProperty(properties, key);
  if (propertyType === "rich_text") return getRichTextProperty(properties, key);
  return getRichTextProperty(properties, key) || getTitleProperty(properties, key);
}

function findCityProperties(properties: Record<string, unknown>, schema: Record<string, NotionPropertyDefinition>) {
  const setupCity = readTextProperty(properties, CITY_KEYS[0], schema) || readTextProperty(properties, CITY_KEYS[1], schema) || readTextProperty(properties, CITY_KEYS[2], schema);
  const setupCityZh = readTextProperty(properties, CITY_ZH_KEYS[0], schema) || readTextProperty(properties, CITY_ZH_KEYS[1], schema) || readTextProperty(properties, CITY_ZH_KEYS[2], schema) || readTextProperty(properties, CITY_ZH_KEYS[3], schema);
  const userNameName =
    findPropertyName(schema, "title", ["userName", "user name", "name"]) ??
    findPropertyName(schema, "rich_text", ["userName", "user name", "name"]);

  return {
    setupCity,
    setupCityZh,
    userName: userNameName ? readTextProperty(properties, userNameName, schema) : "",
  };
}

async function loadMatchingPage(
  databaseId: string,
  apiKey: string,
  schema: Record<string, NotionPropertyDefinition>,
  cityEn = "",
  cityZh = "",
  userName = "",
): Promise<{ id?: string; properties?: Record<string, unknown> }> {
  const normalizedCityEn = normalizeKey(cityEn);
  const normalizedCityZh = normalizeKey(cityZh);
  const normalizedUserName = normalizeKey(userName);
  const hasCityMatchInput = Boolean(normalizedCityEn || normalizedCityZh);
  const hasUserMatchInput = Boolean(normalizedUserName);

  return (
    (await loadAllPages(databaseId, apiKey)).find((page) => {
      const properties = page.properties ?? {};
      const current = findCityProperties(properties, schema);
      const normalizedSetupCity = normalizeKey(current.setupCity);
      const normalizedSetupCityZh = normalizeKey(current.setupCityZh);
      const normalizedCurrentUserName = normalizeKey(current.userName);
      const cityMatches =
        (normalizedCityEn && normalizedSetupCity === normalizedCityEn) ||
        (normalizedCityZh && normalizedSetupCityZh === normalizedCityZh);
      const userMatches = normalizedUserName && normalizedCurrentUserName === normalizedUserName;

      if (hasCityMatchInput && hasUserMatchInput) {
        return cityMatches && userMatches;
      }
      if (hasCityMatchInput) {
        return cityMatches;
      }
      if (hasUserMatchInput) {
        return userMatches;
      }

      return (
        Boolean(normalizedSetupCity) ||
        Boolean(normalizedSetupCityZh) ||
        Boolean(normalizedCurrentUserName)
      );
    }) ?? {}
  );
}

export default async function handler(
  request: { method?: string; body?: Record<string, unknown>; url?: string },
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

    const database = await loadDatabase(pageId, notionApiKey);
    const schema = database.properties ?? {};

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
    const userNameFallback = DEFAULT_USER_NAME;

    if (request.method === "GET") {
      const query = pickRequestQuery(request);
      const cityEn = query.get("setup_city") || query.get("city") || "";
      const cityZh = query.get("setup_city_zh") || query.get("city_zh") || "";
      const userNameQuery = query.get("userName") || query.get("user_name") || "";
      const matchedPage = await loadMatchingPage(pageId, notionApiKey, schema, cityEn, cityZh, userNameQuery);
      const properties = matchedPage.properties ?? {};
      const userName =
        (userNameName ? readTextProperty(properties, userNameName, schema) : "") || DEFAULT_USER_NAME;
      const press =
        (pressName
          ? (schema[pressName]?.type === "checkbox"
            ? getCheckboxProperty(properties, pressName)
            : getSelectProperty(properties, pressName) === "yes")
          : false);

      return response.status(200).json({
        pageId,
        pageCount: 1,
        matched: Boolean(matchedPage.id),
        userName,
        press,
      });
    }

    if (request.method === "POST") {
      const body = request.body ?? {};
      const nextUserName = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim() : userNameFallback;
      const hasPress = typeof body.press === "string";
      const nextPress = hasPress ? body.press : "";
      const nextSetupCity = typeof body.setup_city === "string" ? body.setup_city : "";
      const nextSetupCityZh = typeof body.setup_city_zh === "string" ? body.setup_city_zh : "";
      const nextSetupCountry = typeof body.setup_country === "string" ? body.setup_country : "";
      const nextSetupCountryZh = typeof body.setup_country_zh === "string" ? body.setup_country_zh : "";
      const matchedPage = await loadMatchingPage(pageId, notionApiKey, schema, nextSetupCity, nextSetupCityZh, nextUserName);
      const pageIdToUpdate = matchedPage.id;
      const updateProperties: Record<string, unknown> = {};
      let requestMethod = "PATCH";

      if (!pageIdToUpdate) {
        requestMethod = "POST";
        if (userNameName) {
          updateProperties[userNameName] =
            schema[userNameName]?.type === "title" ? buildTitleProperty(nextUserName) : buildTextProperty(nextUserName);
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
        if (pressName && hasPress) {
          if (schema[pressName]?.type === "checkbox") {
            updateProperties[pressName] = { checkbox: nextPress === "yes" };
          } else {
            updateProperties[pressName] = { select: { name: nextPress || "yes" } };
          }
        }
      } else {
        if (userNameName) {
          updateProperties[userNameName] =
            schema[userNameName]?.type === "title" ? buildTitleProperty(nextUserName) : buildTextProperty(nextUserName);
        }
        if (pressName && hasPress) {
          if (schema[pressName]?.type === "checkbox") {
            updateProperties[pressName] = { checkbox: nextPress === "yes" };
          } else {
            updateProperties[pressName] = { select: { name: nextPress || "yes" } };
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
      }

      const targetUrl =
        requestMethod === "POST"
          ? `https://api.notion.com/v1/pages`
          : `https://api.notion.com/v1/pages/${pageIdToUpdate}`;
      const updateResponse = await fetch(targetUrl, {
        method: requestMethod,
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body:
          requestMethod === "POST"
            ? JSON.stringify({
                parent: { database_id: pageId },
                properties: updateProperties,
              })
            : JSON.stringify({ properties: updateProperties }),
      });

      if (!updateResponse.ok) {
        throw new Error(`Notion page ${requestMethod === "POST" ? "create" : "update"} failed: ${updateResponse.status} ${await updateResponse.text()}`);
      }

      return response.status(200).json({
        ok: true,
        pageId,
        pageIdToUpdate: pageIdToUpdate || null,
        created: requestMethod === "POST",
        userName: nextUserName,
        ...(hasPress ? { press: nextPress } : {}),
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
