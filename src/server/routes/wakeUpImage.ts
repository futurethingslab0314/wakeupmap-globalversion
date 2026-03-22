interface WakeUpImageRequest {
  pageId: string;
  city: string;
  cityZh?: string;
  country: string;
  countryZh?: string;
  recordedAtIso: string;
}

interface RequestLike {
  method?: string;
  body?: unknown;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  json(payload: unknown): ResponseLike;
  setHeader?(name: string, value: string | string[]): ResponseLike | void;
}

interface WakeUpImageHandlerDependencies {
  runWakeUpImage: (request: WakeUpImageRequest) => Promise<{ ok: true }>;
}

export function createWakeUpImageHandler(dependencies: WakeUpImageHandlerDependencies) {
  return async function handleWakeUpImageRequest(request: RequestLike, response: ResponseLike): Promise<void> {
    if (request.method !== "POST") {
      response.setHeader?.("Allow", "POST");
      response.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const body = (request.body ?? {}) as Partial<WakeUpImageRequest>;

    if (!body.pageId || !body.city || !body.country || !body.recordedAtIso) {
      response.status(400).json({ error: "Missing required wake-up image payload" });
      return;
    }

    await dependencies.runWakeUpImage({
      pageId: body.pageId,
      city: body.city,
      ...(body.cityZh ? { cityZh: body.cityZh } : {}),
      country: body.country,
      ...(body.countryZh ? { countryZh: body.countryZh } : {}),
      recordedAtIso: body.recordedAtIso,
    });

    response.status(200).json({ ok: true });
  };
}
