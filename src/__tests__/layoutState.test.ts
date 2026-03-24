import test from "node:test";
import assert from "node:assert/strict";

import {
  getHeaderAnimationState,
  getLanguageToggleState,
  getMobileNavVisibility,
  getMobileView,
} from "../layoutState";

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

test("getHeaderAnimationState slides the mobile header to the right when journal is open", () => {
  assert.deepEqual(getHeaderAnimationState(true, "journal"), {
    x: "120%",
    opacity: 0,
  });
});

test("getHeaderAnimationState keeps the desktop header visible beside the journal", () => {
  assert.deepEqual(getHeaderAnimationState(false, "journal"), {
    x: "calc(100vw - 480px)",
    opacity: 1,
  });
});

test("getLanguageToggleState hides the language switcher on mobile edge pages", () => {
  assert.deepEqual(getLanguageToggleState(true, "journal"), {
    show: false,
    position: "right",
  });
  assert.deepEqual(getLanguageToggleState(true, "detail"), {
    show: false,
    position: "left",
  });
});

test("getLanguageToggleState keeps the language switcher visible on desktop detail view", () => {
  assert.deepEqual(getLanguageToggleState(false, "detail"), {
    show: true,
    position: "left",
  });
});
