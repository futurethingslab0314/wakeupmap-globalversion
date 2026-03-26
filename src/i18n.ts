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
    greeting: "Greeting",
    coordinates: "Coordinates",
    utcOffset: "UTC Offset",
    action: "Action",
    viewDetails: "View Details //",
    synchronizingData: "Synchronizing Data",
    connectionError: "Connection Error",
    retryConnection: "Retry Connection",
    locationData: "Location Data",
    countryData: "Country Data",
    awakeningLog: "Awakening Log",
    awakeningFallback: "Awakening in a mysterious place...",
    visualReference: "Visual Reference // 01",
    localSustenance: "Local Sustenance",
    recipePending: "Recipe data pending synchronization...",
    preparingBreakfast: "Preparing your breakfast...",
    countries: "Countries",
    citiesVisited: "Cities Visited",
    totalVisits: "Total Visits",
    countrySummary: "Country Summary",
    countrySummaryText: (cities: number, country: string, visits: number) =>
      `You have visited ${cities} cities across ${country}. A total of ${visits} awakening logs have been recorded in this country.`,
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
    enterGlobe: "Enter Globe",
    entryTitle: "WakeUp Map",
    entryIdentityStatusExisting: "Entering existing wakeup identity",
    entryIdentityStatusNew: "No wakeup records yet. You can create your first wakeup after entering.",
    entryIdentityStatusLoading: "Synchronizing identity index...",
    entryIdentityHint: "Enter a public wakeup identity to open its globe page.",
    emptyIdentityTitle: "Identity Ready",
    emptyIdentityText: "No wakeup records yet. Trigger Wake Up Now to create the first one.",
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
    greeting: "問候",
    coordinates: "座標",
    utcOffset: "UTC 時差",
    action: "操作",
    viewDetails: "查看細節 //",
    synchronizingData: "同步資料中",
    connectionError: "連線錯誤",
    retryConnection: "重新連線",
    locationData: "地點資料",
    countryData: "國家資料",
    awakeningLog: "甦醒紀錄",
    awakeningFallback: "在神秘的地方醒來...",
    visualReference: "影像參考 // 01",
    localSustenance: "在地早餐",
    recipePending: "食譜資料同步中...",
    preparingBreakfast: "早餐準備中...",
    countries: "國家數",
    citiesVisited: "造訪城市",
    totalVisits: "造訪次數",
    countrySummary: "國家摘要",
    countrySummaryText: (cities: number, country: string, visits: number) =>
      `你已在 ${country} 造訪 ${cities} 個城市，並留下 ${visits} 筆甦醒紀錄。`,
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
    enterGlobe: "進入地球",
    entryTitle: "甦醒地圖",
    entryIdentityStatusExisting: "正在進入既有甦醒身分",
    entryIdentityStatusNew: "目前還沒有甦醒紀錄，進入後可用 Wake Up Now 建立第一筆。",
    entryIdentityStatusLoading: "同步身分索引中...",
    entryIdentityHint: "輸入公開的甦醒身分名稱，即可開啟對應地球頁。",
    emptyIdentityTitle: "身分已就緒",
    emptyIdentityText: "目前還沒有甦醒紀錄，按下 Wake Up Now 建立第一筆。",
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
