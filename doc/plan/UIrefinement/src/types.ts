export interface NotionRecord {
  id: string;
  city: string;
  city_zh: string;
  country: string;
  country_zh: string;
  greeting: string;
  story: string;
  story_zh: string;
  longitude: number;
  latitude: number;
  imageUrl: string;
  recipe: string;
  utcOffset: number;
  userName?: string;
  recordedAtDate?: string;
}
