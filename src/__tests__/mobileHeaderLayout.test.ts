import assert from "node:assert/strict";
import test from "node:test";

import {
  getMobileCurrentBaseLabelClassName,
  getMobileMainHeaderControlsClassName,
  getMobileMainHeaderTitleClassName,
} from "../mobileHeaderLayout";

test("mobile current base label wraps instead of truncating", () => {
  const className = getMobileCurrentBaseLabelClassName();

  assert.match(className, /\bbreak-words\b/);
  assert.doesNotMatch(className, /\btruncate\b/);
});

test("mobile main header uses a stacked controls layout", () => {
  const className = getMobileMainHeaderControlsClassName();

  assert.match(className, /\bflex-col\b/);
});

test("mobile title block no longer relies on the old fixed top padding hack", () => {
  const className = getMobileMainHeaderTitleClassName();

  assert.doesNotMatch(className, /pt-\[72px\]/);
});
