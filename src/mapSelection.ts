import type { NotionRecord } from "./types";

interface ViewState {
  showDatabase: boolean;
  selectedRecordId: string | null;
  selectedContinent: string | null;
}

interface CountryVisitStats {
  country: string;
  totalVisits: number;
  totalCities: number;
}

function getRecordedAtTimestamp(record: NotionRecord): number {
  if (record.recordedAtDate) {
    const timePart = record.recordedAt?.trim() || "00:00:00";
    const match = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3] ?? "0");
      const offsetHours = Math.trunc(record.utcOffset);
      const offsetMinutes = Math.round(Math.abs(record.utcOffset - offsetHours) * 60);
      const offsetSign = record.utcOffset >= 0 ? "+" : "-";
      const offset = `${offsetSign}${String(Math.abs(offsetHours)).padStart(2, "0")}:${String(offsetMinutes).padStart(2, "0")}`;
      const isoLike = `${record.recordedAtDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${offset}`;
      const parsed = new Date(isoLike).getTime();
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    const parsedDate = new Date(record.recordedAtDate).getTime();
    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }
  }

  return 0;
}

export function getRecordsSortedByRecordedAt(records: NotionRecord[]): NotionRecord[] {
  return [...records].sort((left, right) => getRecordedAtTimestamp(right) - getRecordedAtTimestamp(left));
}

export function getWakeupGroupUserNames(records: NotionRecord[]): string[] {
  const sorted = getRecordsSortedByRecordedAt(records);
  const seen = new Set<string>();
  const names: string[] = [];

  for (const record of sorted) {
    const displayName = record.userName?.trim() || "Unknown";
    const normalizedName = displayName.toLowerCase();

    if (!seen.has(normalizedName)) {
      seen.add(normalizedName);
      names.push(displayName);
    }
  }

  return names;
}

export function getLatestRecord(records: NotionRecord[]): NotionRecord | null {
  if (records.length === 0) {
    return null;
  }

  return getRecordsSortedByRecordedAt(records)[0] ?? null;
}

export function getLatestRecordForUser(records: NotionRecord[], userName: string): NotionRecord | null {
  const normalizedUserName = userName.trim().toLowerCase();
  if (!normalizedUserName) {
    return null;
  }

  const matchedRecords = records.filter((record) => record.userName?.trim().toLowerCase() === normalizedUserName);
  return getLatestRecord(matchedRecords);
}

export function filterRecordsForUser(records: NotionRecord[], userName: string): NotionRecord[] {
  const normalizedUserName = userName.trim().toLowerCase();
  if (!normalizedUserName) {
    return records;
  }

  return records.filter((record) => record.userName?.trim().toLowerCase() === normalizedUserName);
}

export function getLatestRecordsForDateByUser(records: NotionRecord[], targetDate: string): NotionRecord[] {
  if (!targetDate) {
    return [];
  }

  const recordsForDate = records.filter((record) => record.recordedAtDate?.slice(0, 10) === targetDate);
  const latestByUser = new Map<string, NotionRecord>();

  for (const record of recordsForDate) {
    const userKey = record.userName?.trim().toLowerCase() || "__unknown__";
    const existing = latestByUser.get(userKey);
    const recordTime = getRecordedAtTimestamp(record);
    const existingTime = existing ? getRecordedAtTimestamp(existing) : 0;

    if (!existing || recordTime > existingTime) {
      latestByUser.set(userKey, record);
    }
  }

  return Array.from(latestByUser.values());
}

function isSameCityVisit(left: NotionRecord, right: NotionRecord): boolean {
  return left.latitude === right.latitude && left.longitude === right.longitude;
}

export function getCityVisitCount(records: NotionRecord[], targetRecord: NotionRecord | null): number {
  if (!targetRecord) {
    return 0;
  }

  const sorted = [...records].sort((left, right) => {
    const timeDelta = getRecordedAtTimestamp(left) - getRecordedAtTimestamp(right);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.id.localeCompare(right.id);
  });

  let visitCount = 0;

  for (const record of sorted) {
    if (!isSameCityVisit(record, targetRecord)) {
      continue;
    }

    visitCount += 1;

    if (record.id === targetRecord.id) {
      return visitCount;
    }
  }

  return 0;
}

export function getCityVisitMarkerRadius(records: NotionRecord[], targetRecord: NotionRecord | null): number {
  const visitCount = getCityVisitCount(records, targetRecord);

  if (visitCount >= 4) {
    return 3.6;
  }

  if (visitCount === 3) {
    return 3.1;
  }

  if (visitCount === 2) {
    return 2.6;
  }

  return 2;
}

export function getCountryVisitStats(records: NotionRecord[], targetCountry: string | null): CountryVisitStats | null {
  if (!targetCountry) {
    return null;
  }

  const countryRecords = records.filter((record) => record.country === targetCountry);
  const uniqueCities = new Set(countryRecords.map((record) => record.city));

  return {
    country: targetCountry,
    totalVisits: countryRecords.length,
    totalCities: uniqueCities.size,
  };
}

export function isMainView(state: ViewState): boolean {
  return !state.showDatabase && !state.selectedRecordId && !state.selectedContinent;
}

export function shouldRecenterOnMainView(previousState: ViewState, nextState: ViewState): boolean {
  return !isMainView(previousState) && isMainView(nextState);
}
