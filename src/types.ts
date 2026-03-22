export interface NotionRecord {
  id: string;
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
}

export interface WakeUpImageJob {
  pageId: string;
  city: string;
  country: string;
  recordedAtIso: string;
  recipe: {
    title: string;
    recipe: string;
    highlightIngredients: string[];
    imagePrompt?: string;
  };
}

export interface WakeUpNowResponse {
  record?: NotionRecord;
  imageJob?: WakeUpImageJob;
  error?: string;
}
