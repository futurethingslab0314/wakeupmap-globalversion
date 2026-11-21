import type { WakeAcknowledgementMetadata } from "./wakeAcknowledgement";

export interface NotionRecord extends WakeAcknowledgementMetadata {
  id: string;
  mapPointKind?: "reservation";
  linkedWakeRecordId?: string;
  userName?: string;
  city: string;
  cityZh?: string;
  city_zh: string;
  country: string;
  countryZh?: string;
  country_zh: string;
  greeting: string;
  story: string;
  storyZh?: string;
  story_zh: string;
  recipeZh?: string;
  recipe_zh?: string;
  longitude: number;
  latitude: number;
  imageUrl: string;
  recipe: string;
  utcOffset: number;
  recordedAtDate?: string;
  recordedAt?: string;
}

export interface WakeUpImageJob {
  pageId: string;
  city: string;
  cityZh?: string;
  country: string;
  countryZh?: string;
  recordedAtIso: string;
  breakfastName?: string;
  breakfastNameZh?: string;
  breakfastDescription?: string;
  breakfastDescriptionZh?: string;
  highlightIngredients?: string[];
  breakfastCategory?: string;
  sceneSetting?: string;
  visualAnchors?: string[];
  avoidRepeats?: string[];
}

export interface WakeUpNowResponse {
  record?: NotionRecord;
  imageJob?: WakeUpImageJob;
  error?: string;
}
