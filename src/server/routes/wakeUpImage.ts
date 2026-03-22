interface WakeUpImageRequest {
  pageId: string;
  city: string;
  country: string;
  recordedAtIso: string;
  recipe: {
    title: string;
    recipe: string;
    highlightIngredients: string[];
    imagePrompt?: string;
  };
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

    if (!body.pageId || !body.city || !body.country || !body.recordedAtIso || !body.recipe?.title || !body.recipe?.recipe) {
      response.status(400).json({ error: "Missing required wake-up image payload" });
      return;
    }

    await dependencies.runWakeUpImage({
      pageId: body.pageId,
      city: body.city,
      country: body.country,
      recordedAtIso: body.recordedAtIso,
      recipe: {
        title: body.recipe.title,
        recipe: body.recipe.recipe,
        highlightIngredients: body.recipe.highlightIngredients ?? [],
        ...(body.recipe.imagePrompt ? { imagePrompt: body.recipe.imagePrompt } : {}),
      },
    });

    response.status(200).json({ ok: true });
  };
}
