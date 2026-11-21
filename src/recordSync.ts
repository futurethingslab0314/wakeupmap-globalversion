import type { UiLanguage } from "./i18n";
import { getRecordRecipe } from "./i18n";
import type { NotionRecord } from "./types";

export function isRecordPreparing(record: NotionRecord | null, language: UiLanguage): boolean {
  return !!record && !record.wakeEventId && !record.imageUrl && !getRecordRecipe(record, language);
}

export function getCompletedRecordFromSnapshot(
  currentRecord: NotionRecord | null,
  nextRecords: NotionRecord[],
  language: UiLanguage,
): NotionRecord | null {
  if (!currentRecord || !isRecordPreparing(currentRecord, language)) {
    return null;
  }

  const nextRecord = nextRecords.find((record) => record.id === currentRecord.id) ?? null;
  if (!nextRecord || isRecordPreparing(nextRecord, language)) {
    return null;
  }

  return nextRecord;
}
