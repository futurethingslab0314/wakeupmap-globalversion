import type { CityMappingRecord, SelectCityInput, SelectCityResult } from "../types";

interface RankedCity {
  city: CityMappingRecord;
  minuteDiffToEight: number;
  isRecentlyUsed: boolean;
}

function getMinuteDiffToEight(nowUtcIso: string, utcOffset: number): number {
  const now = new Date(nowUtcIso);
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const localMinutes = utcMinutes + utcOffset * 60;
  const normalizedMinutes = ((localMinutes % 1440) + 1440) % 1440;
  const targetMinutes = 8 * 60;
  return Math.abs(normalizedMinutes - targetMinutes);
}

function rankCities(input: SelectCityInput): RankedCity[] {
  const recentCityNames = new Set(
    input.recentRecords.slice(0, 7).map((record) => record.city.toLowerCase()),
  );

  return input.cities.map((city) => ({
    city,
    minuteDiffToEight: getMinuteDiffToEight(input.nowUtcIso, city.utcOffset),
    isRecentlyUsed: recentCityNames.has(city.city.toLowerCase()),
  }));
}

export function selectCity(input: SelectCityInput): SelectCityResult {
  const rankedCities = rankCities(input).sort((left, right) => {
    if (left.isRecentlyUsed !== right.isRecentlyUsed) {
      return left.isRecentlyUsed ? 1 : -1;
    }
    if (left.minuteDiffToEight !== right.minuteDiffToEight) {
      return left.minuteDiffToEight - right.minuteDiffToEight;
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
