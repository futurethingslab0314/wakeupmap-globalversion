import React, { useState, useEffect, useCallback, useRef } from "react";
import WakeMapFilter from "./components/WakeMapFilter";
import JournalRecordRow from "./components/JournalRecordRow";
import { buildReservationMapState, getReservationJournalRows, filterReservationsForUser, getLocalDate, type WakeReservation, type WakeMapFilter as MapLayerFilter } from "./reservationMap";
import Map from "./components/Map";
import DetailsPanel from "./components/DetailsPanel";
import ParticleStorm from "./components/ParticleStorm";
import { NotionRecord, WakeUpNowResponse } from "./types";
import { getIdentityPresenceState, getInitialIdentityState, normalizeIdentityName } from "./entryState";
import { getRecordCity, getRecordCountry, uiText, UiLanguage } from "./i18n";
import { getHeaderAnimationState, getLanguageToggleState, getMobileNavVisibility, getMobileView } from "./layoutState";
import {
  getMobileCurrentBaseLabelClassName,
  getMobileMainHeaderControlsClassName,
  getMobileMainHeaderIdentityRowClassName,
  getMobileMainHeaderTitleClassName,
} from "./mobileHeaderLayout";
import { getCompletedRecordFromSnapshot, isRecordPreparing } from "./recordSync";
import {
  filterRecordsForUser,
  getLatestRecord,
  getLatestRecordForUser,
  getLatestRecordsForDateByUser,
  getRecordsSortedByRecordedAt,
  isMainView,
  shouldRecenterOnMainView,
} from "./mapSelection";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, Loader2, AlertCircle, RefreshCw, Sun, Clock, Database, X, Volume2, VolumeX, Users, Globe2, ChevronLeft, ChevronRight } from "lucide-react";
import { soundService } from "./services/soundService";

interface CurrentBaseState {
  latitude: number;
  longitude: number;
  label: string;
  updatedAt: string;
}

const CURRENT_BASE_STORAGE_KEY = "wakeupmap.current-base";

export default function App() {
  const bootIdentityState =
    typeof window !== "undefined"
      ? getInitialIdentityState(window.location.search)
      : { userName: "", isNameConfirmed: false, shouldShowEntryScreen: true };
  const [reservations, setReservations] = useState<WakeReservation[]>([]);
  const [reservationError, setReservationError] = useState(false);
  const latestReservationRequest = useRef(0);
  const [layerFilter, setLayerFilter] = useState<MapLayerFilter>("all");
  const [records, setRecords] = useState<NotionRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<NotionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [wakeUpLoading, setWakeUpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatabase, setShowDatabase] = useState(false);
  const [showWakeupToday, setShowWakeupToday] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<NotionRecord[] | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [currentBase, setCurrentBase] = useState<CurrentBaseState | null>(null);
  const [currentBaseLoading, setCurrentBaseLoading] = useState(false);
  const [pendingBreakfastRecords, setPendingBreakfastRecords] = useState<NotionRecord[] | null>(null);
  const [readyBreakfastRecordId, setReadyBreakfastRecordId] = useState<string | null>(null);
  const [userName, setUserName] = useState(bootIdentityState.userName);
  const [isNameConfirmed, setIsNameConfirmed] = useState(bootIdentityState.isNameConfirmed);
  const [showEntryScreen, setShowEntryScreen] = useState(bootIdentityState.shouldShowEntryScreen);
  const [highlightedJournalIndex, setHighlightedJournalIndex] = useState(0);
  const [rotation, setRotation] = useState<[number, number, number]>([0, -20, 0]);
  const [language, setLanguage] = useState<UiLanguage>("en");
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false,
  );
  const text = uiText[language];
  const existingIdentityNames = React.useMemo(
    () => records.map((record) => record.userName ?? ""),
    [records],
  );
  const entryIdentityStatus = getIdentityPresenceState(userName, existingIdentityNames);
  const hasDetailPanelOpen = !!(selectedRecord || selectedCountry || selectedGroup);
  const mobileView = getMobileView({
    showDatabase,
    hasSelectedRecord: !!selectedRecord,
    hasSelectedContinent: !!selectedCountry,
    hasSelectedGroup: !!selectedGroup,
  });
  const mobileNavVisibility = getMobileNavVisibility(mobileView);
  const headerAnimationState = getHeaderAnimationState(isMobileViewport, mobileView);
  const languageToggleState = getLanguageToggleState(isMobileViewport, mobileView);
  const isMobileDetailView = isMobileViewport && mobileView === "detail";
  const isMobileMainView = isMobileViewport && mobileView === "main";
  const currentViewState = {
    showDatabase,
    selectedRecordId: selectedRecord?.id ?? null,
    selectedContinent: selectedCountry,
  };
  const previousViewStateRef = useRef(currentViewState);
  const visibleRecords = React.useMemo(() => {
    if (!isNameConfirmed) {
      return records;
    }

    return filterRecordsForUser(records, userName);
  }, [records, isNameConfirmed, userName]);
  const visibleReservations = React.useMemo(() => isNameConfirmed ? filterReservationsForUser(reservations, userName) : reservations, [reservations, isNameConfirmed, userName]);
  const personalReservationState = React.useMemo(() => buildReservationMapState(visibleRecords, visibleReservations, currentTime), [visibleRecords, visibleReservations, currentTime]);
  const reservationState = React.useMemo(() => showWakeupToday ? buildReservationMapState(records, reservations, currentTime) : personalReservationState, [showWakeupToday, records, reservations, currentTime, personalReservationState]);
  const selectableRecords = React.useMemo(() => [...visibleRecords, ...reservationState.targets], [visibleRecords, reservationState.targets]);
  const showIdentityEmptyState = isNameConfirmed && !loading && visibleRecords.length === 0 && personalReservationState.targets.length === 0 && !showWakeupToday;
  const hasReadyBreakfastRefresh = !!selectedRecord && readyBreakfastRecordId === selectedRecord.id;

  const sortedRecords = React.useMemo(() => {
    return getRecordsSortedByRecordedAt(getReservationJournalRows(visibleRecords, personalReservationState.targets));
  }, [visibleRecords, personalReservationState.targets]);

  useEffect(() => {
    setHighlightedJournalIndex(index => Number.isFinite(index) ? Math.min(index, Math.max(0, sortedRecords.length - 1)) : 0);
  }, [sortedRecords.length]);

  const todayRecords = React.useMemo(() => {
    const todayStr = currentTime.toISOString().slice(0, 10);
    const legacy = getLatestRecordsForDateByUser(records.filter(r => !r.wakeEventId), todayStr);
    const acknowledged = records.filter(record => {
      try { return Boolean(record.wakeEventId && record.wakeScheduledAt && record.wakeTargetTimeZone && getLocalDate(record.wakeScheduledAt, record.wakeTargetTimeZone) === getLocalDate(currentTime, record.wakeTargetTimeZone)); }
      catch { return false; }
    });
    return [...legacy, ...acknowledged];
  }, [records, currentTime]);

  const toggleWakeupToday = () => {
    soundService.playClick();
    const next = !showWakeupToday;
    setShowWakeupToday(next);
    setSelectedRecord(null);
    setSelectedGroup(null);
    setSelectedCountry(null);
    if (next) {
      setShowDatabase(false);
    }
  };

  const handleEnterIdentity = useCallback(
    (value: string) => {
      const normalizedName = normalizeIdentityName(value);
      if (!normalizedName) {
        return;
      }

      const latestRecordForUser = getLatestRecordForUser(records, normalizedName);
      setUserName(normalizedName);
      setIsNameConfirmed(true);
      setShowEntryScreen(false);
      setSelectedRecord(null);
      setSelectedCountry(null);
      setSelectedGroup(null);
      setShowDatabase(false);
      setShowWakeupToday(false);
      setError(null);

      if (latestRecordForUser) {
        setRotation([-latestRecordForUser.longitude, -latestRecordForUser.latitude, 0]);
        setHighlightedIds([latestRecordForUser.id]);
      } else {
        setHighlightedIds([]);
        setRotation([0, -20, 0]);
      }

      soundService.playSuccess();
    },
    [records],
  );

  useEffect(() => {
    if (!selectedRecord) return;
    const latest = selectableRecords.find((record) => record.id === selectedRecord.id);
    if (latest && latest !== selectedRecord) {
      setSelectedRecord(latest);
    }
    if (!latest) {
      setSelectedRecord(null);
    }
  }, [selectableRecords, selectedRecord]);

  useEffect(() => {
    const previousViewState = previousViewStateRef.current;
    previousViewStateRef.current = currentViewState;

    if (!shouldRecenterOnMainView(previousViewState, currentViewState)) {
      return;
    }

    const latestRecord = getLatestRecord(visibleRecords);
    if (!latestRecord) {
      return;
    }

    setRotation([-latestRecord.longitude, -latestRecord.latitude, 0]);
  }, [currentViewState, visibleRecords]);

  const fetchReservations = useCallback(async () => {
    const requestId = ++latestReservationRequest.current;
    try {
      const response = await fetch("/api/wakeuphere?view=map", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload?.reservations)) throw new Error("Reservation fetch failed");
      if (requestId !== latestReservationRequest.current) return;
      setReservations(payload.reservations);
      setReservationError(false);
    } catch {
      // Preserve the last successful snapshot; never turn a failed read into cancellations.
      if (requestId === latestReservationRequest.current) setReservationError(true);
    }
  }, []);

  const loadRecordsSnapshot = useCallback(async (): Promise<NotionRecord[]> => {
    const response = await fetch("/api/notion-data", {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store",
      },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error ?? "Failed to fetch data");
    }

    return response.json();
  }, []);

  const fetchData = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;

    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await loadRecordsSnapshot();
      setRecords(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [loadRecordsSnapshot]);

  const checkBreakfastReadiness = useCallback(async (targetRecord?: NotionRecord | null) => {
    const recordToCheck = targetRecord ?? selectedRecord;
    if (!recordToCheck || !isRecordPreparing(recordToCheck, language)) {
      return null;
    }

    try {
      const nextRecords = await loadRecordsSnapshot();
      const completedRecord = getCompletedRecordFromSnapshot(recordToCheck, nextRecords, language);
      if (!completedRecord) {
        return null;
      }

      setPendingBreakfastRecords(nextRecords);
      setReadyBreakfastRecordId(completedRecord.id);
      return completedRecord;
    } catch (err) {
      console.error("Breakfast readiness check failed:", err);
      return null;
    }
  }, [language, loadRecordsSnapshot, selectedRecord]);

  const refreshReadyBreakfast = useCallback(async () => {
    if (!selectedRecord) {
      return;
    }

    if (pendingBreakfastRecords && readyBreakfastRecordId === selectedRecord.id) {
      setRecords(pendingBreakfastRecords);
      const nextSelectedRecord = pendingBreakfastRecords.find((record) => record.id === selectedRecord.id) ?? null;
      if (nextSelectedRecord) {
        setSelectedRecord(nextSelectedRecord);
      }
      setPendingBreakfastRecords(null);
      setReadyBreakfastRecordId(null);
      return;
    }

    try {
      const nextRecords = await fetchData({ showLoading: false });
      const nextSelectedRecord = nextRecords?.find((record) => record.id === selectedRecord.id) ?? null;
      if (nextSelectedRecord) {
        setSelectedRecord(nextSelectedRecord);
      }
    } catch {
      // fetchData already reports the error state
    }
  }, [fetchData, pendingBreakfastRecords, readyBreakfastRecordId, selectedRecord]);

  const locateCurrentBase = useCallback(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    if (!navigator.geolocation) {
      setError(text.currentBaseUnsupported);
      return;
    }

    setCurrentBaseLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextBase = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          label: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
          updatedAt: new Date().toISOString(),
        };

        setCurrentBase(nextBase);
        window.localStorage.setItem(CURRENT_BASE_STORAGE_KEY, JSON.stringify(nextBase));
        setCurrentBaseLoading(false);
      },
      (geoError) => {
        setCurrentBaseLoading(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError(text.currentBaseDenied);
          return;
        }

        setError(geoError.message || text.connectionError);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 30,
        timeout: 10000,
      },
    );
  }, [text.connectionError, text.currentBaseDenied, text.currentBaseUnsupported]);

  const handleWakeUpNow = async () => {
    const trimmedUserName = userName.trim();
    if (!trimmedUserName) {
      setError("Please enter your name before using Wake Up Now.");
      return;
    }

    setWakeUpLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wake-up-now", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          language,
          userName: trimmedUserName,
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          clientIsoTime: new Date().toISOString(),
          ...(currentBase ? {
            currentBaseLatitude: currentBase.latitude,
            currentBaseLongitude: currentBase.longitude,
          } : {}),
        }),
      });

      const rawResponse = await response.text();
      let payload: WakeUpNowResponse | null = null;
      const trimmedResponse = rawResponse.trim();

      if (trimmedResponse) {
        try {
          payload = JSON.parse(rawResponse);
        } catch {
          if (response.ok) {
            throw new Error(
              `Wake Up Now returned invalid JSON (${response.status}): ${trimmedResponse || "empty response"}`,
            );
          }
        }
      }

      if (!response.ok) {
        const detail =
          payload?.error ??
          (trimmedResponse ? trimmedResponse : `Empty response from /api/wake-up-now (${response.status})`);
        throw new Error(`Wake Up Now failed (${response.status}): ${detail}`);
      }

      if (payload?.record) {
        setSelectedRecord(payload.record);
        setPendingBreakfastRecords(null);
        setReadyBreakfastRecordId(null);
        setRecords((current) => {
          const withoutCurrent = current.filter((record) => record.id !== payload?.record.id);
          return [payload.record, ...withoutCurrent];
        });
      }

      if (payload?.imageJob) {
        void fetch("/api/wake-up-image", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          body: JSON.stringify(payload.imageJob),
        })
          .then(async (imageResponse) => {
            if (!imageResponse.ok) {
              const detail = await imageResponse.text();
              console.error("Wake Up image generation failed:", detail);
              return;
            }

            await checkBreakfastReadiness(payload?.record ?? null);
          })
          .catch((imageError) => {
            console.error("Wake Up image generation failed:", imageError);
          });
      }

      void fetchData({ showLoading: false });
      soundService.playSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWakeUpLoading(false);
    }
  };

  const findMorningLocations = useCallback(() => {
    soundService.playClick();
    const now = new Date();
    const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    
    // Target: Local time = 8:00 AM
    // LocalTime = UTCTime + Offset
    // 8 = utcHour + Offset => Offset = 8 - utcHour
    let targetOffset = 8 - utcHour;
    
    // Normalize offset to [-12, 14]
    if (targetOffset > 14) targetOffset -= 24;
    if (targetOffset < -12) targetOffset += 24;

    // Find records with offset within 0.5 hours of target
    const matches = visibleRecords.filter(r => Math.abs(r.utcOffset - targetOffset) <= 0.5);
    setHighlightedIds(matches.map(m => m.id));
    
    // We no longer auto-select the record to keep the details panel closed initially
    // if (matches.length > 0) {
    //   setSelectedRecord(matches[0]);
    // }
  }, [visibleRecords]);

  useEffect(() => {
    const refresh = () => { setCurrentTime(new Date()); void fetchData({ showLoading: false }).catch(() => {}); void fetchReservations(); };
    void fetchData().catch(() => {});
    void fetchReservations();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [fetchData, fetchReservations]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const cachedValue = window.localStorage.getItem(CURRENT_BASE_STORAGE_KEY);
    if (!cachedValue) {
      return;
    }

    try {
      const parsed = JSON.parse(cachedValue) as Partial<CurrentBaseState>;
      if (
        typeof parsed.latitude === "number" &&
        typeof parsed.longitude === "number" &&
        typeof parsed.label === "string" &&
        typeof parsed.updatedAt === "string"
      ) {
        setCurrentBase({
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          label: parsed.label,
          updatedAt: parsed.updatedAt,
        });
      }
    } catch {
      window.localStorage.removeItem(CURRENT_BASE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!selectedRecord || !isRecordPreparing(selectedRecord, language)) {
      setPendingBreakfastRecords(null);
      setReadyBreakfastRecordId(null);
      return;
    }

    const timeoutIds = [10000, 25000].map((delay) =>
      window.setTimeout(() => {
        void checkBreakfastReadiness(selectedRecord);
      }, delay),
    );

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [checkBreakfastReadiness, language, selectedRecord]);

  useEffect(() => {
    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible" && selectedRecord && isRecordPreparing(selectedRecord, language)) {
        void checkBreakfastReadiness(selectedRecord);
      }
    };

    const handlePageShow = () => {
      if (selectedRecord && isRecordPreparing(selectedRecord, language)) {
        void checkBreakfastReadiness(selectedRecord);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [checkBreakfastReadiness, language, selectedRecord]);

  // Automatically find morning locations once records are loaded
  useEffect(() => {
    if (visibleRecords.length > 0) {
      findMorningLocations();
    } else {
      setHighlightedIds([]);
    }
  }, [visibleRecords, findMorningLocations]);

  useEffect(() => {
    soundService.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (isNameConfirmed && !showEntryScreen && userName) {
      url.searchParams.set("userName", userName);
    } else {
      url.searchParams.delete("userName");
    }

    window.history.replaceState({}, "", url);
  }, [isNameConfirmed, showEntryScreen, userName]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || error || showEntryScreen) return;

      if (e.key === "ArrowDown") {
        if (showDatabase) {
          if (!sortedRecords.length) return;
          // Highlight next in journal
          setHighlightedJournalIndex(prev => (prev + 1) % sortedRecords.length);
          soundService.playHover();
          return;
        }
        // Older (Next in sorted list)
        if (sortedRecords.length === 0) return;
        const currentIndex = selectedRecord ? sortedRecords.findIndex(r => r.id === selectedRecord.id) : -1;
        const nextIndex = (currentIndex + 1) % sortedRecords.length;
        setSelectedRecord(sortedRecords[nextIndex]);
        setSelectedCountry(null);
        soundService.playClick();
      } else if (e.key === "ArrowUp") {
        if (showDatabase) {
          if (!sortedRecords.length) return;
          // Highlight prev in journal
          setHighlightedJournalIndex(prev => (prev - 1 + sortedRecords.length) % sortedRecords.length);
          soundService.playHover();
          return;
        }
        // Newer (Previous in sorted list)
        if (sortedRecords.length === 0) return;
        const currentIndex = selectedRecord ? sortedRecords.findIndex(r => r.id === selectedRecord.id) : sortedRecords.length;
        const prevIndex = (currentIndex - 1 + sortedRecords.length) % sortedRecords.length;
        setSelectedRecord(sortedRecords[prevIndex]);
        setSelectedCountry(null);
        soundService.playClick();
      } else if (e.key === "Enter") {
        if (showDatabase && sortedRecords.length > 0) {
          setSelectedRecord(sortedRecords[highlightedJournalIndex]);
          setShowDatabase(false);
          soundService.playClick();
        }
      } else if (e.key === "ArrowLeft") {
        // Move towards Review Journal (Left side)
        if (selectedRecord || selectedCountry) {
          // If on Details (Right), return to Main (Center)
          setSelectedRecord(null);
          setSelectedCountry(null);
        } else if (!showDatabase) {
          // If on Main (Center), go to Journal (Left)
          setShowDatabase(true);
        }
        soundService.playClick();
      } else if (e.key === "ArrowRight") {
        // Move towards Details Panel (Right side)
        if (showDatabase) {
          // If on Journal (Left), return to Main (Center)
          setShowDatabase(false);
        } else if (!selectedRecord && !selectedCountry) {
          // If on Main (Center), go to Details (Right)
          if (sortedRecords.length > 0) {
            setSelectedRecord(sortedRecords[0]);
          }
        }
        soundService.playClick();
      } else if (e.key === "Escape") {
        setSelectedRecord(null);
        setSelectedCountry(null);
        setShowDatabase(false);
        soundService.playClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, error, showDatabase, records, selectedRecord, selectedCountry, showEntryScreen]);

  if (showEntryScreen) {
    return (
      <div className="relative w-screen h-[100dvh] overflow-hidden font-sans select-none bg-white">
        <ParticleStorm isShifted={false} showDatabase={false} rotation={rotation} />
        <motion.div
          className="absolute inset-[-20%] pointer-events-none opacity-[0.02]"
          style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "30px 30px" }}
          animate={{ x: 0, y: 0 }}
        />

        <div className="absolute top-6 right-6 lg:top-10 lg:right-10 z-10 pointer-events-auto">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">
            <Globe2 className="w-3.5 h-3.5" />
            <div className="flex border border-black/10">
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 transition-colors ${language === "en" ? "bg-black text-white" : "text-gray-500 hover:text-black"}`}
              >
                {text.english}
              </button>
              <button
                onClick={() => setLanguage("zh")}
                className={`px-3 py-1 transition-colors ${language === "zh" ? "bg-black text-white" : "text-gray-500 hover:text-black"}`}
              >
                {text.chinese}
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-20 flex min-h-full items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl border border-black/10 bg-white/85 p-8 backdrop-blur-sm lg:p-12"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-accent-neon" />
              <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-gray-400">
                {text.operatorIdentity}
              </span>
            </div>

            <div className="space-y-5">
              <h1 className="text-5xl font-sans font-bold uppercase leading-none tracking-tight text-black lg:text-7xl">
                {text.entryTitle}
              </h1>
              <p className="max-w-xl font-mono text-[11px] uppercase tracking-[0.22em] text-gray-400">
                {text.entryIdentityHint}
              </p>
            </div>

            <div className="mt-12 space-y-5">
              <input
                type="text"
                placeholder={text.enterName}
                value={userName}
                onChange={(e) => setUserName(normalizeIdentityName(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEnterIdentity(userName);
                  }
                }}
                className="w-full border-b border-black/15 bg-transparent pb-4 font-mono text-2xl font-bold uppercase tracking-[0.18em] text-black outline-none transition-colors placeholder:text-gray-200 focus:border-accent-neon"
              />

	              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
	                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400">
	                  {loading
	                    ? text.entryIdentityStatusLoading
	                    : entryIdentityStatus === "existing"
	                      ? text.entryIdentityStatusExisting
	                      : text.entryIdentityStatusNew}
	                </p>
	                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleEnterIdentity(userName)}
                  disabled={!normalizeIdentityName(userName)}
                  className={`inline-flex items-center justify-center gap-3 border px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] transition-all ${
                    normalizeIdentityName(userName)
                      ? "bg-black text-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.25)]"
                      : "bg-white text-gray-300 border-black/10"
                  }`}
                >
	                  <Globe2 className="h-4 w-4" />
	                  {text.enterGlobe}
	                </motion.button>
	              </div>
	              <div className="flex flex-col gap-3 border border-black/10 bg-black/[0.02] p-4">
	                <div className="flex items-center justify-between gap-4">
	                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">
	                    {currentBase ? `${text.currentBaseReady} // ${currentBase.label}` : text.currentBaseMissing}
	                  </p>
	                  <motion.button
	                    whileHover={{ scale: 1.02 }}
	                    whileTap={{ scale: 0.98 }}
	                    onClick={locateCurrentBase}
	                    disabled={currentBaseLoading}
	                    className="inline-flex items-center gap-2 border border-black px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-black transition-colors disabled:border-black/10 disabled:text-gray-300"
	                  >
	                    {currentBaseLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
	                    {text.locateCurrentBase}
	                  </motion.button>
	                </div>
	                {currentBaseLoading ? (
	                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">
	                    {text.currentBaseLocating}
	                  </p>
	                ) : null}
	              </div>
	            </div>

            {error ? (
              <div className="mt-8 border border-red-200 bg-red-50/70 p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-500">{error}</p>
              </div>
            ) : null}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden font-sans select-none bg-white">
      {/* Background Storm (Radial Emission & Grid Core) */}
      <ParticleStorm 
        isShifted={hasDetailPanelOpen} 
        showDatabase={showDatabase}
        rotation={rotation}
      />

      {/* Background Grid */}
      <motion.div 
        className="absolute inset-[-20%] pointer-events-none opacity-[0.015]" 
        style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "30px 30px" }}
        animate={{
          x: (rotation[0] * 0.05) + (
            isMobileDetailView
              ? -window.innerWidth
              : hasDetailPanelOpen 
              ? -window.innerWidth * 0.25 
              : (showDatabase ? window.innerWidth : 0)
          ),
          y: rotation[1] * 0.05
        }}
        transition={{ type: "spring", damping: 40, stiffness: 100 }}
      />

      {/* Background Map */}
      <motion.div 
        className={isMobileMainView ? "absolute inset-x-0 mobile-main-map-frame" : "absolute inset-0"}
        animate={{ 
          x: isMobileDetailView ? "-100%" : (hasDetailPanelOpen ? "-25%" : (showDatabase ? "100%" : "0%")),
          opacity: (showDatabase || isMobileDetailView) ? 0 : 1
        }}
        transition={{ type: "spring", damping: 30, stiffness: 150 }}
      >
        <Map
          records={visibleRecords}
          reservationTargets={reservationState.targets}
          comparisonPairs={reservationState.pairs}
          layerFilter={layerFilter}
          language={language}
          rotation={rotation}
          onRotationChange={setRotation}
          onSelectRecord={(record) => {
            soundService.playClick();
            setSelectedRecord(record);
            setSelectedCountry(null);
          }}
          onSelectCountry={(country) => {
            setSelectedCountry(country);
            setSelectedRecord(null);
          }}
          selectedId={selectedRecord?.id}
          highlightedIds={highlightedIds}
          isWakeupMode={showWakeupToday}
          todayRecords={todayRecords}
          onSelectGroup={(group) => {
            soundService.playClick();
            setSelectedGroup(group);
          }}
        />
      </motion.div>

      {!showEntryScreen && !showDatabase && !hasDetailPanelOpen ? (
        <div className="absolute left-4 right-4 z-30 max-w-[390px] pointer-events-auto lg:left-auto lg:right-10 lg:top-28 lg:max-w-[390px]" style={isMobileViewport ? { top: "calc(var(--safe-top) + 164px)" } : undefined}>
          <WakeMapFilter value={layerFilter} onChange={value => {
            setLayerFilter(value); setSelectedRecord(null); setSelectedCountry(null); setSelectedGroup(null);
            soundService.playClick();
          }} language={language} pendingCount={reservationState.targets.length} actualCount={showWakeupToday ? todayRecords.length : visibleRecords.length} />
          {reservationError ? <p role="status" className="mt-2 bg-white/95 px-2 py-1 font-mono text-[10px] leading-relaxed text-[#a95018]">{language === "zh" ? "預約資料暫時無法更新，保留上次資料並自動重試。" : "Reservations could not refresh. Keeping the last snapshot and retrying."}</p> : null}
          {layerFilter === "reservations" && reservationState.targets.length === 0 && !reservationError ? <p role="status" className="mt-2 bg-white/95 px-2 py-1 font-mono text-[10px] text-gray-500">{language === "zh" ? "今天沒有有效預約。" : "No valid reservations for today."}</p> : null}
        </div>
      ) : null}

      {/* Top Left: Header & Menu */}
      <motion.div 
        className="absolute top-6 left-6 z-50 hidden flex-col gap-8 pointer-events-none lg:top-10 lg:left-10 lg:flex lg:gap-10"
        animate={headerAnimationState}
        transition={{ type: "spring", damping: 30, stiffness: 150 }}
      >
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-col gap-4 lg:gap-6"
        >
          {/* User Name Input */}
          <div className="pointer-events-auto group">
              <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-1 bg-accent-neon rounded-full" />
              <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">{text.operatorIdentity}</span>
            </div>
            {isNameConfirmed ? (
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-accent-neon font-bold uppercase tracking-widest">
                  {userName}
                </span>
                <button 
                  onClick={() => {
                    setIsNameConfirmed(false);
                    setShowEntryScreen(true);
                    setShowWakeupToday(false);
                    setShowDatabase(false);
                    setSelectedRecord(null);
                    setSelectedCountry(null);
                    setSelectedGroup(null);
                    setHighlightedIds([]);
                  }}
                  className="font-mono text-[9px] text-gray-400 hover:text-black border border-black/10 px-2 py-0.5 transition-colors uppercase"
                >
                  {text.edit}
                </button>
              </div>
            ) : null}
          </div>

          <div className="pt-1">
            <h1 className="text-2xl lg:text-3xl font-sans font-bold text-black leading-none tracking-tight uppercase">
              {text.entryTitle}
            </h1>
            <div className="mt-2">
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.3em] text-black/70">
                {visibleRecords.length} {text.locationsDiscovered}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Map Mode Toggle Buttons */}
        <div className="flex gap-2 pointer-events-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              soundService.playClick();
              if (showWakeupToday) {
                setShowWakeupToday(false);
                setSelectedGroup(null);
              }
            }}
            className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
              !showWakeupToday
                ? "bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)]"
                : "bg-white text-gray-500 border-black/10 hover:border-black/30"
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            {text.myWakeupMap}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleWakeupToday}
            className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
              showWakeupToday
                ? "bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)]"
                : "bg-white text-gray-500 border-black/10 hover:border-black/30"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {text.whoWokeUpToday}
            {showWakeupToday && (
              <span className="text-[8px] tabular-nums opacity-70">[{todayRecords.length}]</span>
            )}
          </motion.button>
        </div>

        {/* Action Menu - Desktop only */}
        <div className="hidden lg:flex flex-col gap-6 pointer-events-auto pl-2">
          {/* Prominent Wake Up Now Button */}
          <motion.button
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => soundService.playHover()}
            onClick={handleWakeUpNow}
            disabled={wakeUpLoading}
            className={`flex items-center justify-center gap-3 border px-8 py-4 rounded-none font-mono text-[12px] font-bold uppercase tracking-[0.2em] transition-all overflow-hidden relative ${
              wakeUpLoading
                ? "bg-white text-black border-black/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                : "bg-accent-neon text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:brightness-110"
            }`}
          >
            {wakeUpLoading ? (
              <Loader2 className="w-4 h-4 text-black animate-spin" />
            ) : (
              <Sun className="w-4 h-4 text-black" />
            )}
            <span className="text-black">
              {wakeUpLoading ? text.generating : text.wakeUpNow}
            </span>
            <div className={`w-2 h-2 rounded-none animate-pulse ${wakeUpLoading ? "bg-black/30" : "bg-black"}`} />
          </motion.button>

	          <div className="flex flex-col gap-4 mt-4">
	            <motion.button
	              whileHover={{ x: 5 }}
	              onMouseEnter={() => soundService.playHover()}
	              onClick={locateCurrentBase}
	              disabled={currentBaseLoading}
	              className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors group disabled:opacity-40"
	            >
	              <div className="w-10 h-[1px] bg-gray-200 group-hover:bg-black transition-colors" />
	              {currentBaseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
	              {text.refreshCurrentBase}
	            </motion.button>

	            <p className="pl-14 font-mono text-[9px] uppercase tracking-[0.18em] text-gray-300">
	              {currentBase ? `${text.currentBaseReady} // ${currentBase.label}` : text.currentBaseMissing}
	            </p>

	            <motion.button
	              whileHover={{ x: 5 }}
	              onMouseEnter={() => soundService.playHover()}
              onClick={() => {
                soundService.playClick();
                setShowDatabase(true);
                setShowWakeupToday(false);
              }}
              className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors group"
            >
              <div className="w-10 h-[1px] bg-gray-200 group-hover:bg-black transition-colors" />
              <Database className="w-4 h-4" />
              {text.reviewJournal}
            </motion.button>

            <motion.button
              whileHover={{ x: 5 }}
              onMouseEnter={() => soundService.playHover()}
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors group"
            >
              <div className="w-10 h-[1px] bg-gray-200 group-hover:bg-black transition-colors" />
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {text.audio}: {soundEnabled ? text.on : text.off}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {isMobileMainView && (
        <>
          <div className="absolute inset-x-0 safe-top-offset z-50 px-5 pt-3 pointer-events-none">
            <div className={getMobileMainHeaderControlsClassName()}>
              <div className={getMobileMainHeaderIdentityRowClassName()}>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-accent-neon" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-gray-400">
                      {text.operatorIdentity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="truncate font-mono text-sm font-bold uppercase tracking-[0.2em] text-black">
                      {userName}
                    </span>
                    <button
                      onClick={() => {
                        setIsNameConfirmed(false);
                        setShowEntryScreen(true);
                        setShowWakeupToday(false);
                        setShowDatabase(false);
                        setSelectedRecord(null);
                        setSelectedCountry(null);
                        setSelectedGroup(null);
                        setHighlightedIds([]);
                      }}
                      className="border border-black/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400 transition-colors hover:text-black"
                    >
                      {text.edit}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">
                  <Globe2 className="h-3.5 w-3.5 shrink-0" />
                  <div className="flex border border-black/10 bg-white/90">
                    <button
                      onClick={() => setLanguage("en")}
                      className={`px-3 py-1 transition-colors ${language === "en" ? "bg-black text-white" : "text-gray-500 hover:text-black"}`}
                    >
                      {text.english}
                    </button>
                    <button
                      onClick={() => setLanguage("zh")}
                      className={`px-3 py-1 transition-colors ${language === "zh" ? "bg-black text-white" : "text-gray-500 hover:text-black"}`}
                    >
                      {text.chinese}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pointer-events-auto flex flex-col gap-3 border border-black/10 bg-white/90 p-3 backdrop-blur-sm">
                <p className={getMobileCurrentBaseLabelClassName()}>
                  {currentBase ? `${text.currentBaseReady} // ${currentBase.label}` : text.currentBaseMissing}
                </p>
                <button
                  onClick={locateCurrentBase}
                  disabled={currentBaseLoading}
                  className="inline-flex w-fit items-center gap-2 border border-black/10 bg-white px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-black disabled:text-gray-300"
                >
                  {currentBaseLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {text.refreshCurrentBase}
                </button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={getMobileMainHeaderTitleClassName()}
              >
                <div className="space-y-2">
                  <h1 className="text-4xl font-sans font-bold uppercase leading-none tracking-tight text-black">
                    {text.entryTitle}
                  </h1>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-black/70">
                    {visibleRecords.length} {text.locationsDiscovered}
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="fixed inset-x-0 z-[95] px-4 pointer-events-none mobile-mode-tabs-fixed">
            <div className="pointer-events-auto flex gap-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  soundService.playClick();
                  if (showWakeupToday) {
                    setShowWakeupToday(false);
                    setSelectedGroup(null);
                  }
                }}
                className={`flex min-h-[var(--mobile-mode-tabs-height)] flex-1 items-center justify-center gap-2 border px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                  !showWakeupToday
                    ? "bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.25)]"
                    : "bg-white text-gray-500 border-black/10"
                }`}
              >
                <Globe2 className="h-3.5 w-3.5" />
                {text.myWakeupMap}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={toggleWakeupToday}
                className={`flex min-h-[var(--mobile-mode-tabs-height)] flex-1 items-center justify-center gap-2 border px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                  showWakeupToday
                    ? "bg-black text-white border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.25)]"
                    : "bg-white text-gray-500 border-black/10"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                {text.whoWokeUpToday}
              </motion.button>
            </div>
          </div>
        </>
      )}

      {showIdentityEmptyState && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute left-6 right-6 top-1/2 z-30 mx-auto max-w-md -translate-y-1/2 border border-black/10 bg-white/85 p-6 backdrop-blur-sm lg:left-auto lg:right-10 lg:top-1/2 lg:mx-0"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-accent-neon" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-400">
              {userName}
            </span>
          </div>
          <h2 className="text-2xl font-sans font-bold uppercase tracking-tight text-black">
            {text.emptyIdentityTitle}
          </h2>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
            {text.emptyIdentityText}
          </p>
        </motion.div>
      )}

      {/* Top Right: Language Toggle */}
      {!isMobileViewport && languageToggleState.show && (
        <div
          className={`absolute top-6 lg:top-10 z-10 pointer-events-auto transition-all ${
            languageToggleState.position === "left" ? "left-6 lg:left-10" : "right-6 lg:right-10"
          }`}
        >
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">
            <Globe2 className="w-3.5 h-3.5" />
            <div className="flex border border-black/10">
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 transition-colors ${language === "en" ? "bg-black text-white" : "text-gray-500 hover:text-black"}`}
              >
                {text.english}
              </button>
              <button
                onClick={() => setLanguage("zh")}
                className={`px-3 py-1 transition-colors ${language === "zh" ? "bg-black text-white" : "text-gray-500 hover:text-black"}`}
              >
                {text.chinese}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journal Panel (Sliding from left) */}
      <AnimatePresence>
        {showDatabase && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "0%", opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 150 }}
            className="absolute top-0 left-0 w-full lg:w-[calc(100vw-440px)] bottom-0 z-[40] overflow-hidden flex flex-col pointer-events-none"
          >
            <div className="flex-1 flex flex-col pointer-events-auto px-5 pt-12 lg:p-12 lg:pt-16">
              <div className="mb-8 flex items-start gap-5 lg:mb-12 lg:gap-8">
                <button
                  onMouseEnter={() => soundService.playHover()}
                  onClick={() => {
                    soundService.playClick();
                    setShowDatabase(false);
                  }}
                  className="p-3 hover:bg-black/5 rounded-full transition-colors group"
                >
                  <X className="w-8 h-8 text-gray-400 group-hover:text-black" />
                </button>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-[1px] bg-black/20" />
                    <span className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.3em]">
                      {text.systemArchive}
                    </span>
                  </div>
                  <h2 className="text-4xl font-sans font-bold text-gray-900 tracking-tighter uppercase leading-none lg:text-5xl">
                    {text.reviewJournal}
                  </h2>
                </div>
              </div>

              <p className="mb-3 font-mono text-[10px] text-gray-500 lg:hidden">{language === "zh" ? "左右滑動表格，查看實際位置與距離。" : "Swipe the table to see actual positions and distances."}</p>
              <div className="flex-1 relative overflow-hidden group/scroll">
                <div
                  className="absolute inset-0 overflow-y-auto custom-scrollbar lg:pr-6"
                  style={{ paddingBottom: "calc(var(--safe-bottom) + var(--mobile-footer-height) + 24px)" }}
                >
                  <div className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
                    <table className="min-w-[880px] w-full text-left font-mono text-[11px]">
                      <thead>
                        <tr className="border-b border-black/10 text-gray-400 uppercase tracking-widest">
                          <th className="py-6 px-4 font-medium">{text.date}</th>
                          <th className="py-6 px-4 font-medium">{language === "zh" ? "預約甦醒位置" : "Reserved position"}</th>
                          <th className="py-6 px-4 font-medium">{language === "zh" ? "實際甦醒位置" : "Actual position"}</th>
                          <th className="py-6 px-4 font-medium">{language === "zh" ? "距離" : "Distance"}</th>
                          <th className="py-6 px-4 font-medium">{language === "zh" ? "狀態／問候" : "Status / Greeting"}</th>
                          <th className="py-6 px-4 font-medium">{text.action}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {sortedRecords.map((record, idx) => (
                          <React.Fragment key={record.id}><JournalRecordRow record={record} language={language} highlighted={highlightedJournalIndex === idx}
                            onHover={() => { setHighlightedJournalIndex(idx); soundService.playHover(); }}
                            onSelect={() => { soundService.playClick(); setSelectedRecord(record); setShowDatabase(false); }} /></React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State (Data only) */}
      <AnimatePresence>
        {loading && !showEntryScreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-[200] flex flex-col items-center justify-center"
          >
            <div className="space-y-8 text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-24 h-24 border border-black/10 flex items-center justify-center mx-auto"
              >
                <div className="w-12 h-12 border-2 border-accent-neon relative">
                   <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[80%] h-[1px] bg-accent-neon rotate-45" />
                    <div className="w-[80%] h-[1px] bg-accent-neon -rotate-45" />
                  </div>
                </div>
              </motion.div>
              <div className="space-y-2">
                <p className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.4em]">
                  {text.synchronizingData}
                </p>
                <div className="w-48 h-[1px] bg-gray-100 mx-auto relative overflow-hidden">
                  <motion.div 
                    animate={{ x: [-200, 200] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute inset-0 w-1/2 bg-black/20"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-white z-[300] flex items-center justify-center p-12"
          >
            <div className="max-w-md space-y-8 text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto opacity-20" />
              <div className="space-y-4">
                <h2 className="text-3xl font-sans font-bold text-gray-900 tracking-tighter uppercase">
                  {text.connectionError}
                </h2>
                <p className="font-mono text-[10px] text-gray-500 leading-relaxed uppercase tracking-widest">
                  {error}
                </p>
              </div>
              <button
                onMouseEnter={() => soundService.playHover()}
                onClick={() => {
                  soundService.playClick();
                  fetchData();
                }}
                className="group flex items-center gap-4 mx-auto font-mono text-[11px] uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
              >
                <div className="w-12 h-[1px] bg-gray-200 group-hover:bg-black transition-colors" />
                <RefreshCw className="w-4 h-4" />
                {text.retryConnection}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Panel */}
      <DetailsPanel
        record={selectedRecord}
        country={selectedCountry}
        group={selectedGroup}
        records={showWakeupToday ? records : visibleRecords}
        language={language}
        hasBreakfastRefreshReady={hasReadyBreakfastRefresh}
        onRefreshBreakfast={hasReadyBreakfastRefresh ? refreshReadyBreakfast : undefined}
        onClose={() => {
          soundService.playClick();
          setSelectedRecord(null);
          setSelectedCountry(null);
          setSelectedGroup(null);
        }}
      />

      {/* Mobile Navigation Controls */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] pointer-events-auto border-t border-black bg-white safe-bottom-pad">
        <div className="flex items-center w-full h-16">
          {/* Left Arrow - Journal */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              soundService.playClick();
              if (mobileView === "detail") {
                setSelectedRecord(null);
                setSelectedCountry(null);
                setSelectedGroup(null);
              } else if (showDatabase) {
                setShowDatabase(false);
              } else {
                setSelectedRecord(null);
                setSelectedCountry(null);
                setSelectedGroup(null);
                setShowDatabase(true);
                setShowWakeupToday(false);
              }
            }}
            className={`${mobileNavVisibility.showLeft ? "flex" : "hidden"} flex-1 h-full items-center justify-center border-r border-black active:bg-black/5 transition-colors`}
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </motion.button>

          {/* Center - Wake Up Now (hidden when any panel is open) */}
          <AnimatePresence mode="wait">
            {mobileNavVisibility.showCenter && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleWakeUpNow}
                disabled={wakeUpLoading}
                className={`flex-[3] h-full flex items-center justify-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.15em] transition-all ${
                  wakeUpLoading
                    ? "bg-white text-black"
                    : "bg-accent-neon text-black"
                }`}
              >
                {wakeUpLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
                <span>{wakeUpLoading ? text.generating : text.wakeUpNow}</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Right Arrow - Details */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              soundService.playClick();
              if (showDatabase) {
                setShowDatabase(false);
              } else if (sortedRecords.length > 0) {
                setSelectedRecord(sortedRecords[0]);
              }
            }}
            className={`${mobileNavVisibility.showRight ? "flex" : "hidden"} flex-1 h-full items-center justify-center border-l border-black active:bg-black/5 transition-colors`}
          >
            <ChevronRight className="w-6 h-6 text-black" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
