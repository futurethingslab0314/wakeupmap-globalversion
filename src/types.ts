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
  longitude: number;
  latitude: number;
  imageUrl: string;
  recipe: string;
  utcOffset: number;
  recordedAtDate?: string;
}
