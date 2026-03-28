export function getJournalDateLabel(record: { recordedAtDate?: string | null }): string {
  return record.recordedAtDate?.slice(0, 10) || "N/A";
}
