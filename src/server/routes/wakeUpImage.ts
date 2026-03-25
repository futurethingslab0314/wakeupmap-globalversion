import type { WakeUpImageJob } from "../types";

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
  runWakeUpImage: (request: WakeUpImageJob) => Promise<{ ok: true } | { ok: true; imageUrl: string }>;
}

export function createWakeUpImageHandler(dependencies: WakeUpImageHandlerDependencies) {
  return async function handleWakeUpImageRequest(request: RequestLike, response: ResponseLike): Promise<void> {
    try {
      if (request.method !== "POST") {
        response.setHeader?.("Allow", "POST");
        response.status(405).json({ error: "Method Not Allowed" });
        return;
      }

      const body = (request.body ?? {}) as Partial<WakeUpImageJob>;

      if (!body.pageId || !body.city || !body.country || !body.recordedAtIso) {
        response.status(400).json({ error: "Missing required wake-up image payload" });
        return;
      }

      const result = await dependencies.runWakeUpImage({
        pageId: body.pageId,
        city: body.city,
        ...(body.cityZh ? { cityZh: body.cityZh } : {}),
        country: body.country,
        ...(body.countryZh ? { countryZh: body.countryZh } : {}),
        recordedAtIso: body.recordedAtIso,
        ...(body.breakfastName ? { breakfastName: body.breakfastName } : {}),
        ...(body.breakfastNameZh ? { breakfastNameZh: body.breakfastNameZh } : {}),
        ...(body.breakfastDescription ? { breakfastDescription: body.breakfastDescription } : {}),
        ...(body.breakfastDescriptionZh ? { breakfastDescriptionZh: body.breakfastDescriptionZh } : {}),
        ...(body.highlightIngredients ? { highlightIngredients: body.highlightIngredients } : {}),
        ...(body.breakfastCategory ? { breakfastCategory: body.breakfastCategory } : {}),
        ...(body.sceneSetting ? { sceneSetting: body.sceneSetting } : {}),
        ...(body.visualAnchors ? { visualAnchors: body.visualAnchors } : {}),
        ...(body.avoidRepeats ? { avoidRepeats: body.avoidRepeats } : {}),
      });

      response.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      response.status(500).json({ error: message });
    }
  };
}
