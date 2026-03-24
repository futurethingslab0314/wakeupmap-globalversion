export interface NotionRecord {
  id: string;
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
}

export interface WakeUpNowResponse {
  record?: NotionRecord;
  imageJob?: WakeUpImageJob;
  error?: string;
}
