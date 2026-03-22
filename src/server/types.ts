export interface CityMappingRecord {
  id: string;
  city: string;
  cityZh: string;
  country: string;
  countryZh: string;
  timezone?: string;
  countryIsoCode?: string;
  latitude: number;
  longitude: number;
  utcOffset: number;
  population: number;
  greetingHint: string;
  languageCode: string;
}

export interface WakeUpNowRequest {
  language: "en" | "zh";
  nowUtcIso?: string;
  userName?: string;
  clientTimeZone?: string;
  clientIsoTime?: string;
}

export interface WakeUpNowResult {
  record: NormalizedNotionRecord;
  imageStorageKey?: string;
}

export interface SelectCityInput {
  nowUtcIso: string;
  cities: CityMappingRecord[];
  recentRecords: NormalizedNotionRecord[];
}

export interface SelectCityResult {
  city: CityMappingRecord;
  minuteDiffToEight: number;
  isRecentlyUsed: boolean;
  evaluatedAtUtc: string;
}

export interface NormalizedNotionRecord {
  id: string;
  city: string;
  cityZh: string;
  city_zh?: string;
  country: string;
  countryZh: string;
  country_zh?: string;
  greeting: string;
  greetingZh?: string;
  story: string;
  storyZh: string;
  story_zh?: string;
  recipe: string;
  recipeZh?: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  utcOffset: number;
  createdAt?: string;
  recordedAtDate?: string;
  recordedAt?: string;
  timezone?: string;
}

export interface OpenAITextRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface OpenAIImageRequest {
  prompt: string;
}

export interface OpenAIImageResult {
  imageBinary: Uint8Array;
  prompt: string;
}

export interface OpenAIClient {
  generateText(request: OpenAITextRequest): Promise<string>;
  generateImage(request: OpenAIImageRequest): Promise<Uint8Array>;
}

export interface StoryResult {
  story: string;
  storyZh: string;
}

export interface BreakfastConcept {
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  highlightIngredients: string[];
}

export interface RecipeResult {
  title: string;
  titleZh?: string;
  recipe: string;
  recipeZh?: string;
  highlightIngredients: string[];
  imagePrompt?: string;
}

export interface NotionQueryResult {
  results: unknown[];
}

export interface NotionCreatePageRequest {
  properties: Record<string, unknown>;
}

export interface NotionClient {
  queryDatabase(databaseId: string): Promise<NotionQueryResult>;
  createPage(databaseId: string, request: NotionCreatePageRequest): Promise<unknown>;
}

export interface R2UploadRequest {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface R2UploadResult {
  key: string;
  url: string;
}

export interface R2Client {
  upload(request: R2UploadRequest): Promise<R2UploadResult>;
}
