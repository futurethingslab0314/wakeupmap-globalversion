import type { WakeAcknowledgementMetadata } from "../wakeAcknowledgement";

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
  currentBase?: string;
  currentBaseLatitude?: number;
  currentBaseLongitude?: number;
}

export interface WakeUpNowResult {
  record: NormalizedNotionRecord;
  imageJob?: WakeUpImageJob;
  imageStorageKey?: string;
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

export interface SelectCityInput {
  nowUtcIso: string;
  cities: CityMappingRecord[];
  recentRecords: NormalizedNotionRecord[];
  currentBaseLatitude?: number;
  currentBaseLongitude?: number;
  currentBaseLocalDate?: string;
  currentBaseLocalMinute?: number;
}

export interface SelectCityResult {
  city: CityMappingRecord;
  minuteDiffToEight: number;
  isRecentlyUsed: boolean;
  evaluatedAtUtc: string;
}

export interface NormalizedNotionRecord extends WakeAcknowledgementMetadata {
  id: string;
  userName?: string;
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
  breakfastName?: string;
  breakfastNameZh?: string;
  breakfastDescription?: string;
  breakfastDescriptionZh?: string;
  highlightIngredients?: string;
  imagePrompt?: string;
  tone?: string;
  motifs?: string[];
  breakfastCategory?: string;
  sceneSetting?: string;
  visualAnchors?: string[];
  avoidRepeats?: string;
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
  responseFormat?: {
    type: "json_schema";
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
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
  tone: string;
  motifs: string[];
}

export interface BreakfastConcept {
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  highlightIngredients: string[];
  breakfastCategory: string;
  sceneSetting: string;
  visualAnchors: string[];
  avoidRepeats: string[];
}

export interface RecipeResult {
  title: string;
  titleZh?: string;
  recipe: string;
  recipeZh?: string;
  highlightIngredients: string[];
  imagePrompt?: string;
  breakfastCategory?: string;
  sceneSetting?: string;
  visualAnchors?: string[];
}

export interface PersonalizationSummary {
  recentPatterns: string[];
  stablePreferences: string[];
  avoidRepeats: string[];
  confidenceNotes: string;
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
  getDatabase(databaseId: string): Promise<{ properties: Record<string, { type?: string; name?: string }> }>;
  updatePage(pageId: string, request: { properties: Record<string, unknown> }): Promise<unknown>;
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
