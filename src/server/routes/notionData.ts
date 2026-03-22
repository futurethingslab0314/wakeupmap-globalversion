import { locations } from "../../data";

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
    if (request.method && request.method !== "GET") {
      response.setHeader?.("Allow", "GET");
      response.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const records = await dependencies.loadRecords();
    response.status(200).json(records.length > 0 ? records : locations);
  };
}

export const handleNotionDataRequest = createNotionDataHandler({
  loadRecords: async () => locations,
});
