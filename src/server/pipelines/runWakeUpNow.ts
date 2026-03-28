import type { CityMappingRecord, NotionClient, OpenAIClient, WakeUpNowRequest, WakeUpNowResult } from "../types";
import { localizeLocationNames } from "../services/locationNames";
import { buildWakeUpPageProperties } from "../services/notion";
import { loadWorldCities } from "../services/worldCities";
import { buildPersonalizationSummary } from "../skills/buildPersonalizationSummary";
import { generateGreeting } from "../skills/generateGreeting";
import { generateLocalBreakfast } from "../skills/generateLocalBreakfast";
import { generateStory } from "../skills/generateStory";
import { readFromNotion } from "../skills/readFromNotion";
import { selectCity } from "../skills/selectCity";

interface RunWakeUpNowInput {
  request: WakeUpNowRequest;
  databaseId: string;
  notion: NotionClient;
  openai: OpenAIClient;
  cities?: CityMappingRecord[];
}

function isValidTimeZone(timeZone: string | undefined): timeZone is string {
  if (!timeZone) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function parseClientDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDatePart(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatMinutePart(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return Number(parts.find((part) => part.type === "minute")?.value ?? "0");
}

function getDistanceBetweenCoordinates(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(right.latitude - left.latitude);
  const deltaLongitude = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function captureContext(request: WakeUpNowRequest) {
  const userName = request.userName?.trim();
  if (!userName) {
    throw new Error("userName must not be blank");
  }

  const timezone = isValidTimeZone(request.clientTimeZone) ? request.clientTimeZone : "UTC";
  const recordedAtDateTime = parseClientDate(request.clientIsoTime) ?? new Date();

  return {
    userName,
    timezone,
    recordedAtIso: recordedAtDateTime.toISOString(),
    recordedAtDate: formatDatePart(recordedAtDateTime, timezone),
    recordedAtMinute: formatMinutePart(recordedAtDateTime, timezone),
    nowUtcIso: request.nowUtcIso ?? recordedAtDateTime.toISOString(),
  };
}

function findExistingLocationLabels(
  records: Array<{ latitude: number; longitude: number; cityZh?: string; countryZh?: string }>,
  target: { latitude: number; longitude: number },
): { cityZh: string; countryZh: string } | null {
  const match = records.find(
    (record) =>
      record.latitude === target.latitude &&
      record.longitude === target.longitude &&
      record.cityZh?.trim() &&
      record.countryZh?.trim(),
  );

  if (!match?.cityZh || !match.countryZh) {
    return null;
  }

  return {
    cityZh: match.cityZh,
    countryZh: match.countryZh,
  };
}

function resolveCurrentBaseLabel(
  request: WakeUpNowRequest,
  cities: CityMappingRecord[],
): string | undefined {
  if (request.currentBase?.trim()) {
    return request.currentBase.trim();
  }

  if (
    typeof request.currentBaseLatitude !== "number" ||
    typeof request.currentBaseLongitude !== "number"
  ) {
    return undefined;
  }

  const nearestCity = [...cities].sort(
    (left, right) =>
      getDistanceBetweenCoordinates(
        { latitude: request.currentBaseLatitude as number, longitude: request.currentBaseLongitude as number },
        left,
      ) -
      getDistanceBetweenCoordinates(
        { latitude: request.currentBaseLatitude as number, longitude: request.currentBaseLongitude as number },
        right,
      ),
  )[0];

  return nearestCity ? `${nearestCity.city}, ${nearestCity.country}` : undefined;
}

export async function runWakeUpNow(input: RunWakeUpNowInput): Promise<WakeUpNowResult> {
  const context = captureContext(input.request);
  const allRecords = await readFromNotion({
    notion: input.notion,
    databaseId: input.databaseId,
  });
  const userRecords = allRecords.filter(
    (record) => record.userName?.trim().toLowerCase() === context.userName.toLowerCase(),
  );
  const personalization = buildPersonalizationSummary({
    recentRecords: userRecords,
  });
  const cities = input.cities ?? loadWorldCities(context.nowUtcIso);
  const currentBaseLabel = resolveCurrentBaseLabel(input.request, cities);
  const selected = selectCity({
    nowUtcIso: context.nowUtcIso,
    cities,
    recentRecords: allRecords,
    ...(typeof input.request.currentBaseLatitude === "number"
      ? { currentBaseLatitude: input.request.currentBaseLatitude }
      : {}),
    ...(typeof input.request.currentBaseLongitude === "number"
      ? { currentBaseLongitude: input.request.currentBaseLongitude }
      : {}),
    currentBaseLocalDate: context.recordedAtDate,
    currentBaseLocalMinute: context.recordedAtMinute,
  });
  const existingLocationLabels = findExistingLocationLabels(allRecords, selected.city);
  const localizedNames = await localizeLocationNames({
    openai: input.openai,
    city: selected.city.city,
    cityZh: existingLocationLabels?.cityZh ?? selected.city.cityZh,
    country: selected.city.country,
    countryZh: existingLocationLabels?.countryZh ?? selected.city.countryZh,
  });
  const city = {
    ...selected.city,
    cityZh: localizedNames.cityZh,
    countryZh: localizedNames.countryZh,
  };
  const greeting = await generateGreeting({ openai: input.openai, city });
  const story = await generateStory({
    openai: input.openai,
    city,
    greeting,
    userName: context.userName,
    personalization,
  });
  const breakfast = await generateLocalBreakfast({
    openai: input.openai,
    city,
    story,
    personalization,
  });
  const database = await input.notion.getDatabase(input.databaseId);
  const createPageResult = (await input.notion.createPage(input.databaseId, {
    properties: buildWakeUpPageProperties(database.properties, {
      userName: context.userName,
      ...(currentBaseLabel ? { currentBase: currentBaseLabel } : {}),
      city: city.city,
      cityZh: city.cityZh,
      country: city.country,
      countryZh: city.countryZh,
      greeting,
      story: story.story,
      storyZh: story.storyZh,
      breakfastName: breakfast.name,
      breakfastNameZh: breakfast.nameZh,
      breakfastDescription: breakfast.description,
      breakfastDescriptionZh: breakfast.descriptionZh,
      highlightIngredients: breakfast.highlightIngredients,
      imagePrompt: "",
      tone: story.tone,
      motifs: story.motifs,
      breakfastCategory: breakfast.breakfastCategory,
      sceneSetting: breakfast.sceneSetting,
      visualAnchors: breakfast.visualAnchors,
      avoidRepeats: breakfast.avoidRepeats,
      recipe: "",
      recipeZh: "",
      imageUrl: "",
      latitude: city.latitude,
      longitude: city.longitude,
      utcOffset: city.utcOffset,
      recordedAtDate: context.recordedAtDate,
      timezone: context.timezone,
    }),
  })) as { id?: string };

  const pageId = createPageResult.id ?? "";

  return {
    record: {
      id: pageId,
      userName: context.userName,
      city: city.city,
      cityZh: city.cityZh,
      city_zh: city.cityZh,
      country: city.country,
      countryZh: city.countryZh,
      country_zh: city.countryZh,
      greeting,
      story: story.story,
      storyZh: story.storyZh,
      story_zh: story.storyZh,
      recipe: "",
      breakfastName: breakfast.name,
      breakfastNameZh: breakfast.nameZh,
      breakfastDescription: breakfast.description,
      breakfastDescriptionZh: breakfast.descriptionZh,
      highlightIngredients: breakfast.highlightIngredients.join(", "),
      imagePrompt: "",
      tone: story.tone,
      motifs: story.motifs,
      breakfastCategory: breakfast.breakfastCategory,
      sceneSetting: breakfast.sceneSetting,
      visualAnchors: breakfast.visualAnchors,
      avoidRepeats: breakfast.avoidRepeats.join("; "),
      imageUrl: "",
      latitude: city.latitude,
      longitude: city.longitude,
      utcOffset: city.utcOffset,
      recordedAtDate: context.recordedAtDate,
      timezone: context.timezone,
    },
    imageJob: {
      pageId,
      city: city.city,
      cityZh: city.cityZh,
      country: city.country,
      countryZh: city.countryZh,
      recordedAtIso: context.recordedAtIso,
      breakfastName: breakfast.name,
      breakfastNameZh: breakfast.nameZh,
      breakfastDescription: breakfast.description,
      breakfastDescriptionZh: breakfast.descriptionZh,
      highlightIngredients: breakfast.highlightIngredients,
      breakfastCategory: breakfast.breakfastCategory,
      sceneSetting: breakfast.sceneSetting,
      visualAnchors: breakfast.visualAnchors,
      avoidRepeats: breakfast.avoidRepeats,
    },
  };
}
