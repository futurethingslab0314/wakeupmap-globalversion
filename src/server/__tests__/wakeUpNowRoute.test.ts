import test from "node:test";
import assert from "node:assert/strict";

import { createWakeUpNowHandler } from "../routes/wakeUpNow";

test("wake up now route validates POST and delegates to the pipeline", async () => {
  let statusCode = 200;
  let jsonPayload: unknown;
  let receivedBody: unknown;

  const handler = createWakeUpNowHandler({
    runWakeUpNow: async (body) => {
      receivedBody = body;
      return {
        record: {
          id: "new-record",
          city: "Taipei",
          cityZh: "台北",
          city_zh: "台北",
          country: "Taiwan",
          countryZh: "台灣",
          country_zh: "台灣",
          greeting: "Zao An",
          story: "Story",
          storyZh: "故事",
          story_zh: "故事",
          longitude: 121.5654,
          latitude: 25.033,
          imageUrl: "https://example.com/image.jpg",
          recipe: "Recipe",
          utcOffset: 8,
        },
      };
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
        language: "en",
        userName: "YT",
        currentBase: "Taipei, Taiwan",
        currentBaseLatitude: 25.033,
        currentBaseLongitude: 121.5654,
      },
    },
    response,
  );

  assert.equal(statusCode, 200);
  assert.deepEqual(receivedBody, {
    language: "en",
    userName: "YT",
    currentBase: "Taipei, Taiwan",
    currentBaseLatitude: 25.033,
    currentBaseLongitude: 121.5654,
  });
  assert.deepEqual(jsonPayload, {
    record: {
      id: "new-record",
      city: "Taipei",
      cityZh: "台北",
      city_zh: "台北",
      country: "Taiwan",
      countryZh: "台灣",
      country_zh: "台灣",
      greeting: "Zao An",
      story: "Story",
      storyZh: "故事",
      story_zh: "故事",
      longitude: 121.5654,
      latitude: 25.033,
      imageUrl: "https://example.com/image.jpg",
      recipe: "Recipe",
      utcOffset: 8,
    },
  });
});

test("wake up now route rejects unsupported methods", async () => {
  let statusCode = 200;
  let jsonPayload: unknown;

  const handler = createWakeUpNowHandler({
    runWakeUpNow: async () => {
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

  await handler({ method: "GET" }, response);

  assert.equal(statusCode, 405);
  assert.deepEqual(jsonPayload, { error: "Method Not Allowed" });
});
