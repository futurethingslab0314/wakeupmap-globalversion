import test from "node:test";
import assert from "node:assert/strict";

import { createNotionDataHandler } from "../routes/notionData";
import { locations } from "../../data";

test("notion data route returns records loaded from the configured source", async () => {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return this;
    },
  };

  const handler = createNotionDataHandler({
    loadRecords: async () => [{ ...locations[0], id: "notion-1", city: "Seoul" }],
  });

  await handler({ method: "GET" }, response);

  assert.equal(statusCode, 200);
  assert.deepEqual(jsonPayload, [{ ...locations[0], id: "notion-1", city: "Seoul" }]);
});

test("notion data route falls back to local records when the loader returns nothing", async () => {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return this;
    },
  };

  const handler = createNotionDataHandler({
    loadRecords: async () => [],
  });

  await handler({ method: "GET" }, response);

  assert.equal(statusCode, 200);
  assert.deepEqual(jsonPayload, locations);
});

test("notion data route rejects non-GET methods", async () => {
  let statusCode = 200;
  let jsonPayload: unknown;

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

  const handler = createNotionDataHandler({
    loadRecords: async () => locations,
  });

  await handler({ method: "POST" }, response);

  assert.equal(statusCode, 405);
  assert.deepEqual(jsonPayload, { error: "Method Not Allowed" });
});
