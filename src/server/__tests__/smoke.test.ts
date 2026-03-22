import test from "node:test";
import assert from "node:assert/strict";

import { createTestWakeUpNowRequest } from "../test/testUtils";

test("server types can be imported", () => {
  const request = createTestWakeUpNowRequest();

  assert.equal(request.language, "en");
});
