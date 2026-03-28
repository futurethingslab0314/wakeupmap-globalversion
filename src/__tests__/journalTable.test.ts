import assert from "node:assert/strict";
import test from "node:test";

import { getJournalDateLabel } from "../journalTable";

test("getJournalDateLabel returns YYYY-MM-DD from recordedAtDate", () => {
  assert.equal(
    getJournalDateLabel({ recordedAtDate: "2026-03-28T08:00:00.000+08:00" }),
    "2026-03-28",
  );
});

test("getJournalDateLabel falls back to N/A when recordedAtDate is missing", () => {
  assert.equal(getJournalDateLabel({}), "N/A");
});
