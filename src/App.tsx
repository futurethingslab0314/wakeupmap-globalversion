import React, { useState, useEffect, useCallback, useRef } from "react";
import Map from "./components/Map";
import DetailsPanel from "./components/DetailsPanel";
import ParticleStorm from "./components/ParticleStorm";
import { NotionRecord, WakeUpNowResponse } from "./types";
import { getRecordCity, getRecordCountry, uiText, UiLanguage } from "./i18n";
import {
  filterRecordsForUser,
  getLatestRecord,
  getLatestRecordForUser,
  isMainView,
  shouldRecenterOnMainView,
} from "./mapSelection";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, Loader2, AlertCircle, RefreshCw, Sun, Clock, Database, X, Volume2, VolumeX, Users } from "lucide-react";
import { soundService } from "./services/soundService";

export default function App() {
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
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [isNameConfirmed, setIsNameConfirmed] = useState(false);
  const [highlightedJournalIndex, setHighlightedJournalIndex] = useState(0);
  const [rotation, setRotation] = useState<[number, number, number]>([0, -20, 0]);
  const [language, setLanguage] = useState<UiLanguage>("en");
  const text = uiText[language];
  const currentViewState = {
    showDatabase,
    selectedRecordId: selectedRecord?.id ?? null,
    selectedContinent,
  };
  const previousViewStateRef = useRef(currentViewState);
  const visibleRecords = React.useMemo(() => {
    if (!isNameConfirmed) {
      return records;
    }

    return filterRecordsForUser(records, userName);
  }, [records, isNameConfirmed, userName]);

  const sortedRecords = React.useMemo(() => {
    return [...visibleRecords].sort((a, b) => {
      const dateA = a.recordedAtDate ? new Date(a.recordedAtDate).getTime() : 0;
      const dateB = b.recordedAtDate ? new Date(b.recordedAtDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [visibleRecords]);

  // Wakeup Today: filter records to today's date, keep only each userName's latest record
  const todayRecords = React.useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const todayOnly = records.filter(r => r.recordedAtDate?.slice(0, 10) === todayStr);
    // Group by userName, keep the latest record per user
    const byUser: Record<string, NotionRecord> = {};
    todayOnly.forEach(r => {
      const name = r.userName || 'Unknown';
      const existing = byUser[name];
      if (!existing || (r.recordedAtDate && existing.recordedAtDate && r.recordedAtDate > existing.recordedAtDate)) {
        byUser[name] = r;
      }
    });
    return Object.values(byUser);
  }, [records]);

  const toggleWakeupToday = () => {
    soundService.playClick();
    const next = !showWakeupToday;
    setShowWakeupToday(next);
    setSelectedRecord(null);
    setSelectedGroup(null);
    setSelectedContinent(null);
    if (next) {
      setShowDatabase(false);
    }
  };

  useEffect(() => {
    if (!selectedRecord) return;
    const latest = visibleRecords.find((record) => record.id === selectedRecord.id);
    if (latest && latest !== selectedRecord) {
      setSelectedRecord(latest);
    }
    if (!latest) {
      setSelectedRecord(null);
    }
  }, [visibleRecords, selectedRecord]);

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notion-data");
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to fetch data");
      }
      const data = await response.json();
      setRecords(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          userName: trimmedUserName,
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          clientIsoTime: new Date().toISOString(),
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
        setRecords((current) => {
          const withoutCurrent = current.filter((record) => record.id !== payload?.record.id);
          return [payload.record, ...withoutCurrent];
        });
      }

      if (payload?.imageJob) {
        void fetch("/api/wake-up-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload.imageJob),
        })
          .then(async (imageResponse) => {
            if (!imageResponse.ok) {
              const detail = await imageResponse.text();
              console.error("Wake Up image generation failed:", detail);
              return;
            }

            await fetchData();
          })
          .catch((imageError) => {
            console.error("Wake Up image generation failed:", imageError);
          });
      }

      void fetchData();
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
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || error) return;

      if (e.key === "ArrowDown") {
        if (showDatabase) {
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
        setSelectedContinent(null);
        soundService.playClick();
      } else if (e.key === "ArrowUp") {
        if (showDatabase) {
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
        setSelectedContinent(null);
        soundService.playClick();
      } else if (e.key === "Enter") {
        if (showDatabase && sortedRecords.length > 0) {
          setSelectedRecord(sortedRecords[highlightedJournalIndex]);
          setShowDatabase(false);
          soundService.playClick();
        }
      } else if (e.key === "ArrowLeft") {
        // Move towards Review Journal (Left side)
        if (selectedRecord || selectedContinent) {
          // If on Details (Right), return to Main (Center)
          setSelectedRecord(null);
          setSelectedContinent(null);
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
        } else if (!selectedRecord && !selectedContinent) {
          // If on Main (Center), go to Details (Right)
          if (sortedRecords.length > 0) {
            setSelectedRecord(sortedRecords[0]);
          }
        }
        soundService.playClick();
      } else if (e.key === "Escape") {
        setSelectedRecord(null);
        setSelectedContinent(null);
        setShowDatabase(false);
        soundService.playClick();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, error, showDatabase, records, selectedRecord, selectedContinent]);

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans select-none bg-white">
      {/* Background Storm (Radial Emission & Grid Core) */}
      <ParticleStorm 
        isShifted={!!(selectedRecord || selectedContinent)} 
        showDatabase={showDatabase}
        rotation={rotation}
      />

      {/* Background Grid */}
      <motion.div 
        className="absolute inset-[-20%] pointer-events-none opacity-[0.015]" 
        style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "30px 30px" }}
        animate={{
          x: (rotation[0] * 0.05) + (
            (selectedRecord || selectedContinent) 
              ? -window.innerWidth * 0.25 
              : (showDatabase ? window.innerWidth : 0)
          ),
          y: rotation[1] * 0.05
        }}
        transition={{ type: "spring", damping: 40, stiffness: 100 }}
      />

      {/* Background Map */}
      <motion.div 
        className="absolute inset-0"
        animate={{ 
          x: (selectedRecord || selectedContinent) ? "-25%" : (showDatabase ? "100%" : "0%"),
          opacity: showDatabase ? 0 : 1
        }}
        transition={{ type: "spring", damping: 30, stiffness: 150 }}
      >
        <Map
          records={visibleRecords}
          language={language}
          rotation={rotation}
          onRotationChange={setRotation}
          onSelectRecord={(record) => {
            soundService.playClick();
            setSelectedRecord(record);
            setSelectedContinent(null);
          }}
          onSelectContinent={(continent) => {
            setSelectedContinent(continent);
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

      {/* Top Left: Header & Menu */}
      <motion.div 
        className="absolute top-10 left-10 z-50 flex flex-col gap-10 pointer-events-none"
        animate={{ 
          x: (selectedRecord || selectedContinent) ? "-120%" : (showDatabase ? "calc(100vw - 480px)" : "0%"), 
          opacity: (selectedRecord || selectedContinent) ? 0 : 1 
        }}
        transition={{ type: "spring", damping: 30, stiffness: 150 }}
      >
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-col gap-6"
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
                  onClick={() => setIsNameConfirmed(false)}
                  className="font-mono text-[9px] text-gray-400 hover:text-black border border-black/10 px-2 py-0.5 transition-colors uppercase"
                >
                  {text.edit}
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder={text.enterName}
                value={userName}
                onChange={(e) => setUserName(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userName.trim()) {
                    const latestRecordForUser = getLatestRecordForUser(records, userName);
                    setIsNameConfirmed(true);
                    if (latestRecordForUser) {
                      setSelectedRecord(latestRecordForUser);
                      setSelectedContinent(null);
                      setHighlightedIds([latestRecordForUser.id]);
                      setRotation([-latestRecordForUser.longitude, -latestRecordForUser.latitude, 0]);
                    }
                    soundService.playSuccess();
                  }
                }}
                className="bg-transparent border-b border-black/10 focus:border-accent-neon outline-none font-mono text-xs py-1 w-40 transition-colors uppercase placeholder:text-gray-200"
              />
            )}
          </div>

          <div className="pt-1">
            <h1 className="text-3xl font-sans font-bold text-black leading-none tracking-tight uppercase">
              WakeUp Map
            </h1>
            <div className="mt-2 space-y-1">
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-[0.25em]">
                {text.globalBreakfastNetwork}
              </p>
              <p className="text-[9px] font-mono text-black font-bold uppercase tracking-[0.3em]">
                {visibleRecords.length} {text.locationsDiscovered}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Menu */}
        <div className="flex flex-col gap-6 pointer-events-auto pl-2">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">
            <div className="w-10 h-[1px] bg-gray-200" />
            <span>{text.language}</span>
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
              onClick={toggleWakeupToday}
              className={`flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors group ${
                showWakeupToday ? "text-accent-neon" : "text-gray-400 hover:text-black"
              }`}
            >
              <div className={`w-10 h-[1px] transition-colors ${showWakeupToday ? "bg-accent-neon" : "bg-gray-200 group-hover:bg-black"}`} />
              <Users className="w-4 h-4" />
              {text.wakeupToday}
              {showWakeupToday && (
                <span className="text-[9px] tabular-nums">[{todayRecords.length}]</span>
              )}
            </motion.button>

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

      {/* Top Right: UTC Time */}
      <div className="absolute top-10 right-10 z-10 pointer-events-none">
        <div className="flex items-center gap-6 font-mono text-[11px] text-gray-400 uppercase tracking-[0.3em]">
          <div className="w-16 h-[1px] bg-gray-100" />
          UTC {currentTime.toISOString().slice(11, 16)}
        </div>
      </div>

      {/* Journal Panel (Sliding from left) */}
      <AnimatePresence>
        {showDatabase && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "0%", opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 150 }}
            className="absolute top-0 left-0 w-[calc(100vw-440px)] bottom-0 z-[40] overflow-hidden flex flex-col pointer-events-none"
          >
            <div className="flex-1 flex flex-col pointer-events-auto p-12 pt-16">
              <div className="flex items-start gap-8 mb-12">
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
                  <h2 className="text-5xl font-sans font-bold text-gray-900 tracking-tighter uppercase leading-none">
                    {text.reviewJournal}
                  </h2>
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden group/scroll">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-6">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-black/10 text-gray-400 uppercase tracking-widest">
                        <th className="py-6 px-4 font-medium">Index</th>
                        <th className="py-6 px-4 font-medium">{text.location}</th>
                        <th className="py-6 px-4 font-medium">{text.coordinates}</th>
                        <th className="py-6 px-4 font-medium">{text.utcOffset}</th>
                        <th className="py-6 px-4 font-medium">{text.action}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {sortedRecords.map((record, idx) => (
                        <tr 
                          key={record.id} 
                          className={`transition-colors group ${highlightedJournalIndex === idx ? 'bg-black/5' : 'hover:bg-black/[0.02]'}`}
                          onMouseEnter={() => {
                            setHighlightedJournalIndex(idx);
                            soundService.playHover();
                          }}
                        >
                          <td className="py-4 px-4 text-gray-300 tabular-nums">
                            {highlightedJournalIndex === idx ? (
                              <span className="text-accent-neon font-bold">→</span>
                            ) : (
                              String(idx + 1).padStart(3, '0')
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-gray-900 uppercase">{getRecordCity(record, language)}</div>
                            <div className="text-[9px] text-gray-400 uppercase tracking-widest">{getRecordCountry(record, language)}</div>
                          </td>
                          <td className="py-4 px-4 text-gray-500 tabular-nums">
                            {record.latitude.toFixed(4)} / {record.longitude.toFixed(4)}
                          </td>
                          <td className="py-4 px-4 text-gray-500 tabular-nums">
                            {record.utcOffset >= 0 ? `+${record.utcOffset}` : record.utcOffset}:00
                          </td>
                          <td className="py-4 px-4">
                            <button
                              onClick={() => {
                                soundService.playClick();
                                setSelectedRecord(record);
                                setShowDatabase(false);
                              }}
                              className="text-[9px] uppercase tracking-widest text-gray-400 hover:text-black transition-colors"
                            >
                              {text.viewDetails}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State (Data only) */}
      <AnimatePresence>
        {loading && (
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
        continent={selectedContinent}
        group={selectedGroup}
        records={visibleRecords}
        language={language}
        onClose={() => {
          soundService.playClick();
          setSelectedRecord(null);
          setSelectedContinent(null);
          setSelectedGroup(null);
        }}
      />
    </div>
  );
}
