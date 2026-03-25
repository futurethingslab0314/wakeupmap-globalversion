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
    nowUtcIso: request.nowUtcIso ?? recordedAtDateTime.toISOString(),
  };
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
  const selected = selectCity({
    nowUtcIso: context.nowUtcIso,
    cities,
    recentRecords: allRecords,
  });
  const localizedNames = await localizeLocationNames({
    openai: input.openai,
    city: selected.city.city,
    cityZh: selected.city.cityZh,
    country: selected.city.country,
    countryZh: selected.city.countryZh,
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
