import type { CityMappingRecord, SelectCityInput, SelectCityResult } from "../types.ts";

interface RankedCity {
  city: CityMappingRecord;
  minuteDiffToEight: number;
  isRecentlyUsed: boolean;
  latitudeDiffFromTarget: number;
  timeBand: number;
}

function getLocalMinutesFromUtcOffset(nowUtcIso: string, utcOffset: number): number {
  const now = new Date(nowUtcIso);
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMinutes = utcMinutes + utcOffset * 60;
  return ((localMinutes % 1440) + 1440) % 1440;
}

function getLocalMinutesFromTimeZone(nowUtcIso: string, timezone: string): number {
  const now = new Date(nowUtcIso);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
}

function getMinuteDiffToEight(nowUtcIso: string, city: CityMappingRecord): number {
  const normalizedMinutes = city.timezone
    ? getLocalMinutesFromTimeZone(nowUtcIso, city.timezone)
    : getLocalMinutesFromUtcOffset(nowUtcIso, city.utcOffset);
  const targetMinutes = 8 * 60;
  return Math.abs(normalizedMinutes - targetMinutes);
}

function getMinuteTimeBand(minuteDiffToEight: number): number {
  if (minuteDiffToEight <= 30) {
    return 0;
  }

  if (minuteDiffToEight <= 60) {
    return 1;
  }

  if (minuteDiffToEight <= 120) {
    return 2;
  }

  return 3;
}

function getSphericalDistanceDegrees(currentBaseLocalMinute: number): number {
  return (Math.max(0, Math.min(currentBaseLocalMinute, 59)) / 59) * 180;
}

function normalizeLatitudeAfterArc(latitude: number): number {
  let next = latitude;

  while (next > 90 || next < -90) {
    if (next > 90) {
      next = 180 - next;
      continue;
    }

    next = -180 - next;
  }

  return next;
}

function getTargetLatitude(input: Pick<SelectCityInput, "currentBaseLatitude" | "currentBaseLocalDate" | "currentBaseLocalMinute">): number | null {
  if (
    typeof input.currentBaseLatitude !== "number" ||
    typeof input.currentBaseLocalMinute !== "number" ||
    !input.currentBaseLocalDate
  ) {
    return null;
  }

  const day = Number(input.currentBaseLocalDate.split("-")[2] ?? "0");
  if (!Number.isFinite(day) || day <= 0) {
    return null;
  }

  const distanceDegrees = getSphericalDistanceDegrees(input.currentBaseLocalMinute);
  const signedDistance = day % 2 === 1 ? distanceDegrees : -distanceDegrees;

  return normalizeLatitudeAfterArc(input.currentBaseLatitude + signedDistance);
}

function rankCities(input: SelectCityInput): RankedCity[] {
  const recentCityNames = new Set(
    input.recentRecords.slice(0, 7).map((record) => record.city.toLowerCase()),
  );
  const targetLatitude = getTargetLatitude(input);

  return input.cities.map((city) => ({
    city,
    minuteDiffToEight: getMinuteDiffToEight(input.nowUtcIso, city),
    isRecentlyUsed: recentCityNames.has(city.city.toLowerCase()),
    latitudeDiffFromTarget: targetLatitude === null ? Infinity : Math.abs(city.latitude - targetLatitude),
    timeBand: getMinuteTimeBand(getMinuteDiffToEight(input.nowUtcIso, city)),
  }));
}

export function selectCity(input: SelectCityInput): SelectCityResult {
  const rankedCities = rankCities(input).sort((left, right) => {
    if (left.timeBand !== right.timeBand) {
      return left.timeBand - right.timeBand;
    }
    if (left.latitudeDiffFromTarget !== right.latitudeDiffFromTarget) {
      return left.latitudeDiffFromTarget - right.latitudeDiffFromTarget;
    }
    if (left.minuteDiffToEight !== right.minuteDiffToEight) {
      return left.minuteDiffToEight - right.minuteDiffToEight;
    }
    if (left.isRecentlyUsed !== right.isRecentlyUsed) {
      return left.isRecentlyUsed ? 1 : -1;
    }
    return right.city.population - left.city.population;
  });

  const winner = rankedCities[0];

  return {
    city: winner.city,
    minuteDiffToEight: winner.minuteDiffToEight,
    isRecentlyUsed: winner.isRecentlyUsed,
    evaluatedAtUtc: input.nowUtcIso,
  };
}
