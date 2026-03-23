import type { NotionRecord } from "./types";
import { CONTINENT_NAMES_ZH } from "./constants/continents";

export type UiLanguage = "en" | "zh";

export const uiText = {
  en: {
    operatorIdentity: "Operator Identity",
    edit: "Edit",
    enterName: "Enter Name...",
    globalBreakfastNetwork: "Global Breakfast Network",
    locationsDiscovered: "Locations Discovered",
    generating: "Generating...",
    wakeUpNow: "Wake Up Now",
    reviewJournal: "Review Journal",
    audio: "Audio",
    on: "ON",
    off: "OFF",
    systemArchive: "System Archive // Journal",
    index: "Index",
    location: "Location",
    coordinates: "Coordinates",
    utcOffset: "UTC Offset",
    action: "Action",
    viewDetails: "View Details //",
    synchronizingData: "Synchronizing Data",
    connectionError: "Connection Error",
    retryConnection: "Retry Connection",
    locationData: "Location Data",
    continentData: "Continent Data",
    awakeningLog: "Awakening Log",
    awakeningFallback: "Awakening in a mysterious place...",
    visualReference: "Visual Reference // 01",
    localSustenance: "Local Sustenance",
    recipePending: "Recipe data pending synchronization...",
    preparingBreakfast: "Preparing your breakfast...",
    countries: "Countries",
    totalVisits: "Total Visits",
    continentSummary: "Continent Summary",
    continentSummaryText: (countries: number, continent: string, visits: number) =>
      `You have explored ${countries} countries across ${continent}. A total of ${visits} awakening logs have been recorded in this region.`,
    timestamp: "Timestamp",
    region: "Region",
    status: "Status: Synchronized",
    wakeupToday: "Who Woke Up Today",
    activeOperatorsToday: "Active Operators Today",
    statusAwake: "Status: Awake",
    synchronizationPoint: "Synchronization Point",
    noOneToday: "No awakening records for today yet.",
    myWakeupMap: "My Wakeup Map",
    whoWokeUpToday: "Who Woke Up Today?",
    language: "Language",
    english: "English",
    chinese: "中文",
  },
  zh: {
    operatorIdentity: "操作員身分",
    edit: "編輯",
    enterName: "輸入名字...",
    globalBreakfastNetwork: "全球早餐網絡",
    locationsDiscovered: "已發現地點",
    generating: "生成中...",
    wakeUpNow: "立即甦醒",
    reviewJournal: "檢視日誌",
    audio: "音效",
    on: "開",
    off: "關",
    systemArchive: "系統檔案 // 日誌",
    index: "編號",
    location: "地點",
    coordinates: "座標",
    utcOffset: "UTC 時差",
    action: "操作",
    viewDetails: "查看細節 //",
    synchronizingData: "同步資料中",
    connectionError: "連線錯誤",
    retryConnection: "重新連線",
    locationData: "地點資料",
    continentData: "洲別資料",
    awakeningLog: "甦醒紀錄",
    awakeningFallback: "在神秘的地方醒來...",
    visualReference: "影像參考 // 01",
    localSustenance: "在地早餐",
    recipePending: "食譜資料同步中...",
    preparingBreakfast: "早餐準備中...",
    countries: "國家數",
    totalVisits: "造訪次數",
    continentSummary: "洲別摘要",
    continentSummaryText: (countries: number, continent: string, visits: number) =>
      `你已探索 ${continent} 的 ${countries} 個國家，並在此區域留下 ${visits} 筆甦醒紀錄。`,
    timestamp: "時間",
    region: "區域",
    status: "狀態：已同步",
    wakeupToday: "今天誰醒了",
    activeOperatorsToday: "今日活躍操作員",
    statusAwake: "狀態：已清醒",
    synchronizationPoint: "同步點",
    noOneToday: "今天還沒有甦醒紀錄。",
    myWakeupMap: "我的甦醒地圖",
    whoWokeUpToday: "今日誰醒來？",
    language: "語言",
    english: "English",
    chinese: "中文",
  },
} as const;

export function getRecordCity(record: NotionRecord, language: UiLanguage): string {
  return language === "zh" ? record.city_zh || record.cityZh || record.city : record.city;
}

export function getRecordCountry(record: NotionRecord, language: UiLanguage): string {
  return language === "zh" ? record.country_zh || record.countryZh || record.country : record.country;
}

export function getRecordStory(record: NotionRecord, language: UiLanguage): string {
  return language === "zh" ? record.story_zh || record.storyZh || record.story : record.story;
}

export function getRecordRecipe(record: NotionRecord, language: UiLanguage): string {
  return language === "zh" ? record.recipe_zh || record.recipeZh || record.recipe : record.recipe;
}

export function getContinentName(continent: string, language: UiLanguage): string {
  return language === "zh" ? CONTINENT_NAMES_ZH[continent] || continent : continent;
}
