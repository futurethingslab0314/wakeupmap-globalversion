import test from "node:test";
import assert from "node:assert/strict";

import { COUNTRY_TO_CONTINENT } from "../constants/continents";

test("COUNTRY_TO_CONTINENT maps Myanmar and Burma to Asia", () => {
  assert.equal(COUNTRY_TO_CONTINENT.Myanmar, "Asia");
  assert.equal(COUNTRY_TO_CONTINENT.Burma, "Asia");
});
