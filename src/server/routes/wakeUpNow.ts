import type { WakeUpNowRequest, WakeUpNowResult } from "../types";

interface RequestLike {
  method?: string;
  body?: unknown;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(payload: unknown): ResponseLike;
  setHeader?(name: string, value: string | string[]): ResponseLike | void;
}

interface WakeUpNowHandlerDependencies {
  runWakeUpNow: (request: WakeUpNowRequest) => Promise<WakeUpNowResult>;
}

export function createWakeUpNowHandler(dependencies: WakeUpNowHandlerDependencies) {
  return async function handleWakeUpNowRequest(
    request: RequestLike,
    response: ResponseLike,
  ): Promise<void> {
    if (request.method !== "POST") {
      response.setHeader?.("Allow", "POST");
      response.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const body = (request.body ?? {}) as Partial<WakeUpNowRequest>;
    const language = body.language ?? "en";

    if (language !== "en" && language !== "zh") {
      response.status(400).json({ error: "Invalid language" });
      return;
    }

    const result = await dependencies.runWakeUpNow({
      language,
      userName: body.userName,
      nowUtcIso: body.nowUtcIso,
    });

    response.status(200).json(result);
  };
}
