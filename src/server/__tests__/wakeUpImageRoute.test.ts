import test from "node:test";
import assert from "node:assert/strict";

import { createWakeUpImageHandler } from "../routes/wakeUpImage";

test("wake up image route validates POST and delegates to background image generation", async () => {
  let statusCode = 200;
  let jsonPayload: unknown;
  let receivedBody: unknown;

  const handler = createWakeUpImageHandler({
    runWakeUpImage: async (body) => {
      receivedBody = body;
      return { ok: true };
    },
  });

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return this;
    },
    setHeader() {
      return this;
    },
  };

  await handler(
    {
      method: "POST",
      body: {
        pageId: "page-1",
        city: "Taipei",
        country: "Taiwan",
        recordedAtIso: "2026-03-22T08:00:00.000Z",
        recipe: {
          title: "Soy Milk Set",
          recipe: "Warm soy milk and serve with youtiao.",
          highlightIngredients: ["soy milk", "youtiao"],
          imagePrompt: "Top-view breakfast photo.",
        },
      },
    },
    response,
  );

  assert.equal(statusCode, 200);
  assert.deepEqual(receivedBody, {
    pageId: "page-1",
    city: "Taipei",
    country: "Taiwan",
    recordedAtIso: "2026-03-22T08:00:00.000Z",
    recipe: {
      title: "Soy Milk Set",
      recipe: "Warm soy milk and serve with youtiao.",
      highlightIngredients: ["soy milk", "youtiao"],
      imagePrompt: "Top-view breakfast photo.",
    },
  });
  assert.deepEqual(jsonPayload, { ok: true });
});

test("wake up image route rejects incomplete payloads", async () => {
  let statusCode = 200;
  let jsonPayload: unknown;

  const handler = createWakeUpImageHandler({
    runWakeUpImage: async () => {
      throw new Error("should not be called");
    },
  });

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return this;
    },
    setHeader() {
      return this;
    },
  };

  await handler({ method: "POST", body: { pageId: "page-1" } }, response);

  assert.equal(statusCode, 400);
  assert.deepEqual(jsonPayload, { error: "Missing required wake-up image payload" });
});
