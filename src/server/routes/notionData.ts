import { locations } from "../../data";
import { createNotionClient } from "../services/notion";
import { readFromNotion } from "../skills/readFromNotion";

interface RequestLike {
  method?: string;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(payload: unknown): ResponseLike;
  setHeader?(name: string, value: string | string[]): ResponseLike | void;
}

interface NotionDataHandlerDependencies {
  loadRecords: () => Promise<unknown[]>;
}

export function createNotionDataHandler(dependencies: NotionDataHandlerDependencies) {
  return async function handleNotionDataRequest(
    request: RequestLike,
    response: ResponseLike,
  ): Promise<void> {
    try {
      if (request.method && request.method !== "GET") {
        response.setHeader?.("Allow", "GET");
        response.status(405).json({ error: "Method Not Allowed" });
        return;
      }

      const records = await dependencies.loadRecords();
      response.status(200).json(records.length > 0 ? records : locations);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      response.status(500).json({ error: message });
    }
  };
}

export const handleNotionDataRequest = createNotionDataHandler({
  loadRecords: async () => {
    const notionApiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!notionApiKey || !databaseId) {
      return locations;
    }

    return readFromNotion({
      notion: createNotionClient({ apiKey: notionApiKey }),
      databaseId,
    });
  },
});
