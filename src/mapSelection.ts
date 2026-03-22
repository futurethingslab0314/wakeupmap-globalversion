import type { NotionRecord } from "./types";

export function getLatestRecord(records: NotionRecord[]): NotionRecord | null {
  if (records.length === 0) {
    return null;
  }

  return [...records].sort((left, right) => {
    const leftTime = left.recordedAtDate ? new Date(left.recordedAtDate).getTime() : 0;
    const rightTime = right.recordedAtDate ? new Date(right.recordedAtDate).getTime() : 0;
    return rightTime - leftTime;
  })[0] ?? null;
}
