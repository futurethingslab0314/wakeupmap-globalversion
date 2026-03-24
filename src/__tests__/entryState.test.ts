import test from "node:test";
import assert from "node:assert/strict";

import {
  getIdentityPresenceState,
  getInitialIdentityState,
  getUserNameFromSearch,
  normalizeIdentityName,
} from "../entryState";

test("normalizeIdentityName trims whitespace and uppercases the value", () => {
  assert.equal(normalizeIdentityName("  yuting  "), "YUTING");
});

test("getUserNameFromSearch reads and normalizes userName from query params", () => {
  assert.equal(getUserNameFromSearch("?userName=annie"), "ANNIE");
  assert.equal(getUserNameFromSearch("?foo=bar"), "");
});

test("getInitialIdentityState skips the entry screen when search already provides a userName", () => {
  assert.deepEqual(getInitialIdentityState("?userName=yt"), {
    userName: "YT",
    isNameConfirmed: true,
    shouldShowEntryScreen: false,
  });
});

test("getInitialIdentityState keeps the entry screen visible when no identity is provided", () => {
  assert.deepEqual(getInitialIdentityState(""), {
    userName: "",
    isNameConfirmed: false,
    shouldShowEntryScreen: true,
  });
});

test("getIdentityPresenceState reports whether a userName already has records", () => {
  assert.equal(getIdentityPresenceState("YT", ["ANNIE", "yt"]), "existing");
  assert.equal(getIdentityPresenceState("NEW", ["ANNIE", "yt"]), "new");
  assert.equal(getIdentityPresenceState("", ["ANNIE", "yt"]), "empty");
});
