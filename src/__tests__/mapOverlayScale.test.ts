import test from "node:test";
import assert from "node:assert/strict";

import { getMapOverlayScale, getStableSvgSize } from "../mapOverlayScale";

test("getMapOverlayScale returns 1 at the base map size", () => {
  assert.equal(getMapOverlayScale(800, 600), 1);
});

test("getMapOverlayScale shrinks with the rendered viewport", () => {
  assert.equal(getMapOverlayScale(400, 300), 0.5);
});

test("getStableSvgSize compensates for a smaller viewport scale", () => {
  assert.equal(getStableSvgSize(10, 0.5), 20);
});
