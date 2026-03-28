import assert from "node:assert/strict";
import test from "node:test";

import { getBreakfastImageFrameClassName } from "../detailsPanelStyles";

test("getBreakfastImageFrameClassName uses a square frame without grayscale styling", () => {
  const className = getBreakfastImageFrameClassName();

  assert.match(className, /\baspect-square\b/);
  assert.doesNotMatch(className, /\bgrayscale\b/);
  assert.doesNotMatch(className, /\bhover:grayscale-0\b/);
});
