import test from "node:test";
import assert from "node:assert/strict";

import { getMapOverlayScale, getStableSvgSize, normalizeViewportSize } from "../mapOverlayScale";

test("normalizeViewportSize rounds live measurements for stable resize updates", () => {
  assert.deepEqual(normalizeViewportSize(412.4, 287.6), {
    width: 412,
    height: 288,
  });
});

test("normalizeViewportSize falls back when a transient measurement is invalid", () => {
  assert.deepEqual(normalizeViewportSize(0, 0, { width: 320, height: 480 }), {
    width: 320,
    height: 480,
  });
});

test("getMapOverlayScale returns 1 at the base map size", () => {
  assert.equal(getMapOverlayScale(800, 600), 1);
});

test("getMapOverlayScale shrinks with the rendered viewport", () => {
  assert.equal(getMapOverlayScale(400, 300), 0.5);
});

test("getStableSvgSize compensates for a smaller viewport scale", () => {
  assert.equal(getStableSvgSize(10, 0.5), 20);
});
