import test from "node:test";
import assert from "node:assert/strict";

import { localizeLocationNames } from "../services/locationNames";
import type { OpenAITextRequest } from "../types";

test("localizeLocationNames translates missing Chinese labels with structured output", async () => {
  const requests: OpenAITextRequest[] = [];
  const openai = {
    generateText: async (request: OpenAITextRequest) => {
      requests.push(request);
      return JSON.stringify({
        cityZh: "墨西哥城",
        countryZh: "墨西哥",
      });
    },
  };

  const result = await localizeLocationNames({
    openai,
    city: "Mexico City",
    cityZh: "Mexico City",
    country: "Mexico",
    countryZh: "Mexico",
  });

  assert.equal(result.cityZh, "墨西哥城");
  assert.equal(result.countryZh, "墨西哥");
  assert.equal(requests[0].responseFormat?.type, "json_schema");
  assert.equal(requests[0].responseFormat?.name, "location_zh_names");
});

test("localizeLocationNames skips translation when Chinese labels already exist", async () => {
  let called = false;
  const openai = {
    generateText: async () => {
      called = true;
      return "";
    },
  };

  const result = await localizeLocationNames({
    openai,
    city: "Taipei",
    cityZh: "台北",
    country: "Taiwan",
    countryZh: "台灣",
  });

  assert.equal(result.cityZh, "台北");
  assert.equal(result.countryZh, "台灣");
  assert.equal(called, false);
});
