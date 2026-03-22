import type { CityMappingRecord, SelectCityInput, SelectCityResult } from "../types.ts";

interface RankedCity {
  city: CityMappingRecord;
  minuteDiffToEight: number;
  isRecentlyUsed: boolean;
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

function rankCities(input: SelectCityInput): RankedCity[] {
  const recentCityNames = new Set(
    input.recentRecords.slice(0, 7).map((record) => record.city.toLowerCase()),
  );

  return input.cities.map((city) => ({
    city,
    minuteDiffToEight: getMinuteDiffToEight(input.nowUtcIso, city),
    isRecentlyUsed: recentCityNames.has(city.city.toLowerCase()),
  }));
}

export function selectCity(input: SelectCityInput): SelectCityResult {
  const rankedCities = rankCities(input).sort((left, right) => {
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
