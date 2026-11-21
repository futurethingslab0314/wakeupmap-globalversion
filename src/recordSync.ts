import type { UiLanguage } from "./i18n";
import { getRecordRecipe, getRecordStory } from "./i18n";
import type { NotionRecord } from "./types";

export function isRecordPreparing(record: NotionRecord | null, language: UiLanguage): boolean {
  if (!record || record.mapPointKind === "reservation") return false;
  if (record.wakeEventId) {
    const story = getRecordStory(record, language);
    return !record.imageUrl || !getRecordRecipe(record, language) || !record.greeting || record.greeting.startsWith("AWAKE //") || !story || story.startsWith("WakeUpHere alarm acknowledged.") || story.startsWith("已按下 WakeUpHere");
  }
  return !record.imageUrl && !getRecordRecipe(record, language);
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
