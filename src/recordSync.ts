import type { UiLanguage } from "./i18n";
import { getRecordRecipe } from "./i18n";
import type { NotionRecord } from "./types";

export function isRecordPreparing(record: NotionRecord | null, language: UiLanguage): boolean {
  return !!record && !record.imageUrl && !getRecordRecipe(record, language);
}
