import test from "node:test";
import assert from "node:assert/strict";

import { handleNotionDataRequest } from "../routes/notionData";
import { locations } from "../../data";

test("handleNotionDataRequest returns the current location dataset", async () => {
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

  await handleNotionDataRequest({ method: "GET" }, response);

  assert.equal(statusCode, 200);
  assert.deepEqual(jsonPayload, locations);
});

test("handleNotionDataRequest rejects non-GET methods", async () => {
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

  await handleNotionDataRequest({ method: "POST" }, response);

  assert.equal(statusCode, 405);
  assert.deepEqual(jsonPayload, { error: "Method Not Allowed" });
});
