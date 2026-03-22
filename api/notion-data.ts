import { handleNotionDataRequest } from "../src/server/routes/notionData";

export default async function handler(request: unknown, response: unknown) {
  return handleNotionDataRequest(
    request as { method?: string },
    response as {
      status(code: number): { json(payload: unknown): unknown };
      json(payload: unknown): unknown;
      setHeader?(name: string, value: string | string[]): unknown;
    },
  );
}
