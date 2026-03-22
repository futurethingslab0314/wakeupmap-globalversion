import { locations } from "../../data";

interface RequestLike {
  method?: string;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(payload: unknown): ResponseLike;
  setHeader?(name: string, value: string | string[]): ResponseLike | void;
}

export async function handleNotionDataRequest(
  request: RequestLike,
  response: ResponseLike,
): Promise<void> {
  if (request.method && request.method !== "GET") {
    response.setHeader?.("Allow", "GET");
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  response.status(200).json(locations);
}
