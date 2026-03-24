import test from "node:test";
import assert from "node:assert/strict";

import { getHeaderAnimationState, getLanguageTogglePosition, getMobileNavVisibility, getMobileView } from "../layoutState";

test("getMobileView returns journal when the review journal is open", () => {
  assert.equal(
    getMobileView({
      showDatabase: true,
      hasSelectedRecord: false,
      hasSelectedContinent: false,
      hasSelectedGroup: false,
    }),
    "journal",
  );
});

test("getMobileView returns detail when a detail panel is open", () => {
  assert.equal(
    getMobileView({
      showDatabase: false,
      hasSelectedRecord: true,
      hasSelectedContinent: false,
      hasSelectedGroup: false,
    }),
    "detail",
  );
});

test("getMobileNavVisibility hides the left arrow on journal and right arrow on detail", () => {
  assert.deepEqual(getMobileNavVisibility("journal"), {
    showLeft: false,
    showCenter: false,
    showRight: true,
  });

  assert.deepEqual(getMobileNavVisibility("detail"), {
    showLeft: true,
    showCenter: false,
    showRight: false,
  });
});

test("getHeaderAnimationState fully hides the mobile header when journal is open", () => {
  assert.deepEqual(getHeaderAnimationState(true, "journal"), {
    x: "-120%",
    opacity: 0,
  });
});

test("getHeaderAnimationState keeps the desktop header visible beside the journal", () => {
  assert.deepEqual(getHeaderAnimationState(false, "journal"), {
    x: "calc(100vw - 480px)",
    opacity: 1,
  });
});

test("getLanguageTogglePosition moves the language switcher to the left on detail view", () => {
  assert.equal(getLanguageTogglePosition("detail"), "left");
  assert.equal(getLanguageTogglePosition("main"), "right");
});
