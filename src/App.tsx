import React, { useState, useEffect, useCallback } from "react";
import Map from "./components/Map";
import DetailsPanel from "./components/DetailsPanel";
import ParticleStorm from "./components/ParticleStorm";
import { NotionRecord } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, Loader2, AlertCircle, RefreshCw, Sun, Clock, Database, X, Volume2, VolumeX } from "lucide-react";
import { soundService } from "./services/soundService";

export default function App() {
  const [records, setRecords] = useState<NotionRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<NotionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [wakeUpLoading, setWakeUpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatabase, setShowDatabase] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [isNameConfirmed, setIsNameConfirmed] = useState(false);
  const [highlightedJournalIndex, setHighlightedJournalIndex] = useState(0);
  const [rotation, setRotation] = useState<[number, number, number]>([0, -20, 0]);

  const sortedRecords = React.useMemo(() => {
    return [...records].sort((a, b) => {
      const dateA = a.recordedAtDate ? new Date(a.recordedAtDate).getTime() : 0;
      const dateB = b.recordedAtDate ? new Date(b.recordedAtDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [records]);

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
    setWakeUpLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wake-up-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "en",
          userName: userName.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to run Wake Up Now");
      }

      if (payload?.record) {
        setSelectedRecord(payload.record);
      }

      await fetchData();
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
    const matches = records.filter(r => Math.abs(r.utcOffset - targetOffset) <= 0.5);
    setHighlightedIds(matches.map(m => m.id));
    
    // We no longer auto-select the record to keep the details panel closed initially
    // if (matches.length > 0) {
    //   setSelectedRecord(matches[0]);
    // }
  }, [records]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Automatically find morning locations once records are loaded
  useEffect(() => {
    if (records.length > 0) {
      findMorningLocations();
    }
  }, [records, findMorningLocations]);

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
          records={records}
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
              <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">Operator Identity</span>
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
                  Edit
                </button>
              </div>
            ) : (
              <input
                type="text"
                placeholder="ENTER NAME..."
                value={userName}
                onChange={(e) => setUserName(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userName.trim()) {
                    setIsNameConfirmed(true);
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
                Global Breakfast Network
              </p>
              <p className="text-[9px] font-mono text-accent-neon font-bold uppercase tracking-[0.3em]">
                {records.length} Locations Discovered
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Menu */}
        <div className="flex flex-col gap-6 pointer-events-auto pl-2">
          {/* Prominent Wake Up Now Button */}
          <motion.button
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => soundService.playHover()}
            onClick={handleWakeUpNow}
            disabled={wakeUpLoading}
            className="flex items-center justify-center gap-3 bg-white text-black border border-black px-8 py-4 rounded-none font-mono text-[12px] font-bold uppercase tracking-[0.2em] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,255,0,1)] transition-all group overflow-hidden relative"
          >
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" 
              style={{ backgroundColor: '#45e945' }}
            />
            {wakeUpLoading ? (
              <Loader2 className="w-4 h-4 text-black relative z-10 animate-spin" />
            ) : (
              <Sun className="w-4 h-4 text-black relative z-10" />
            )}
            <span className="relative z-10 text-black">
              {wakeUpLoading ? "Generating..." : "Wake Up Now"}
            </span>
            <div className="w-2 h-2 bg-black rounded-none animate-pulse relative z-10" />
          </motion.button>

          <div className="flex flex-col gap-4 mt-4">
            <motion.button
              whileHover={{ x: 5 }}
              onMouseEnter={() => soundService.playHover()}
              onClick={() => {
                soundService.playClick();
                setShowDatabase(true);
              }}
              className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors group"
            >
              <div className="w-10 h-[1px] bg-gray-200 group-hover:bg-black transition-colors" />
              <Database className="w-4 h-4" />
              Review Journal
            </motion.button>

            <motion.button
              whileHover={{ x: 5 }}
              onMouseEnter={() => soundService.playHover()}
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors group"
            >
              <div className="w-10 h-[1px] bg-gray-200 group-hover:bg-black transition-colors" />
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              Audio: {soundEnabled ? "ON" : "OFF"}
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
                      System Archive // Journal
                    </span>
                  </div>
                  <h2 className="text-5xl font-sans font-bold text-gray-900 tracking-tighter uppercase leading-none">
                    Review Journal
                  </h2>
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden group/scroll">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-6">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-black/10 text-gray-400 uppercase tracking-widest">
                        <th className="py-6 px-4 font-medium">Index</th>
                        <th className="py-6 px-4 font-medium">Location</th>
                        <th className="py-6 px-4 font-medium">Coordinates</th>
                        <th className="py-6 px-4 font-medium">UTC Offset</th>
                        <th className="py-6 px-4 font-medium">Action</th>
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
                            <div className="font-bold text-gray-900 uppercase">{record.city}</div>
                            <div className="text-[9px] text-gray-400 uppercase tracking-widest">{record.country}</div>
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
                              View Details //
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
                  Synchronizing Data
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
                  Connection Error
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
                Retry Connection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Panel */}
      <DetailsPanel
        record={selectedRecord}
        continent={selectedContinent}
        records={records}
        onClose={() => {
          soundService.playClick();
          setSelectedRecord(null);
          setSelectedContinent(null);
        }}
      />
    </div>
  );
}
