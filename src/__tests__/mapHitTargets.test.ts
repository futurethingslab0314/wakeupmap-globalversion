import test from "node:test";
import assert from "node:assert/strict";

import {
  getGreetingBubbleHitArea,
  getMarkerLabelHitArea,
  getWakeupBubbleHitArea,
} from "../mapHitTargets";

test("getWakeupBubbleHitArea expands above and around the wakeup bubble", () => {
  assert.deepEqual(getWakeupBubbleHitArea(100, -48, 32, 10), {
    x: -60,
    y: -58,
    width: 120,
    height: 70,
  });
});

test("getMarkerLabelHitArea creates a centered tap area around marker text", () => {
  const hitArea = getMarkerLabelHitArea("ST. JOHN'S", 9);
  assert.equal(hitArea.y, -27);
  assert.equal(hitArea.height, 25);
  assert.equal(hitArea.x < 0, true);
  assert.equal(hitArea.width > 32, true);
});

test("getGreetingBubbleHitArea covers the visible bubble and its tail", () => {
  assert.deepEqual(getGreetingBubbleHitArea(80, 20, 25, 8), {
    x: -48,
    y: -53,
    width: 96,
    height: 46,
  });
});
