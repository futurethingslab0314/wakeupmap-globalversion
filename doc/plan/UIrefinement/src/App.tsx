import React, { useState, useEffect, useCallback } from "react";
import Map from "./components/Map";
import DetailsPanel from "./components/DetailsPanel";
import ParticleStorm from "./components/ParticleStorm";
import { NotionRecord } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, Loader2, AlertCircle, ChevronLeft, ChevronRight, Sun, Clock, Database, X, Volume2, VolumeX, Globe2, RefreshCw } from "lucide-react";
import { soundService } from "./services/soundService";

export default function App() {
  const [records, setRecords] = useState<NotionRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<NotionRecord | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [showWakeupToday, setShowWakeupToday] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<NotionRecord[] | null>(null);
  const [language, setLanguage] = useState<"zh" | "en">("zh");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isAnyPanelOpen = !!(selectedRecord || selectedContinent || selectedGroup || showDatabase);

  // Mobile Navigation Helper
  const navigateTo = (view: 'map' | 'journal' | 'details') => {
    if (view === 'map') {
      setShowDatabase(false);
      setSelectedRecord(null);
      setSelectedGroup(null);
      setSelectedContinent(null);
    } else if (view === 'journal') {
      setShowDatabase(true);
      setSelectedRecord(null);
      setSelectedGroup(null);
      setSelectedContinent(null);
    } else if (view === 'details') {
      setShowDatabase(false);
      if (sortedRecords.length > 0) {
        setSelectedRecord(sortedRecords[0]);
      }
    }
    soundService.playClick();
  };

  const sortedRecords = React.useMemo(() => {
    return [...records].sort((a, b) => {
      const dateA = a.recordedAtDate ? new Date(a.recordedAtDate).getTime() : 0;
      const dateB = b.recordedAtDate ? new Date(b.recordedAtDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [records]);

  const wakeupRecords = React.useMemo(() => {
    if (!showWakeupToday) return [];
    
    // Get today's date string (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    
    // Filter records for today
    const todaysRecords = records.filter(r => r.recordedAtDate && r.recordedAtDate.startsWith(today));
    
    // Get latest record per user
    const userLatest: Record<string, NotionRecord> = {};
    todaysRecords.forEach(r => {
      const user = r.userName || "Unknown";
      if (!userLatest[user] || new Date(r.recordedAtDate!) > new Date(userLatest[user].recordedAtDate!)) {
        userLatest[user] = r;
      }
    });
    
    return Object.values(userLatest);
  }, [records, showWakeupToday]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notion-data");
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }
      const data = await response.json();
      
      // Inject mock data for "Wakeup Today" demonstration
      const today = new Date().toISOString().split('T')[0];
      const mockWakeups: NotionRecord[] = [
        {
          id: "mock-1",
          city: "Taipei",
          city_zh: "台北",
          country: "Taiwan",
          country_zh: "台灣",
          greeting: "早安！",
          story: "A fresh start in Taipei.",
          story_zh: "在台北的新開始。",
          longitude: 121.5654,
          latitude: 25.0330,
          imageUrl: "https://picsum.photos/seed/taipei/800/600",
          recipe: "Traditional Soy Milk",
          utcOffset: 8,
          userName: "YUUT",
          recordedAtDate: `${today}T08:00:00Z`
        },
        {
          id: "mock-2",
          city: "Tokyo",
          city_zh: "東京",
          country: "Japan",
          country_zh: "日本",
          greeting: "おはよう！",
          story: "Sunrise over Tokyo.",
          story_zh: "東京的日出。",
          longitude: 139.6503,
          latitude: 35.6762,
          imageUrl: "https://picsum.photos/seed/tokyo/800/600",
          recipe: "Miso Soup",
          utcOffset: 9,
          userName: "AKIRA",
          recordedAtDate: `${today}T07:30:00Z`
        },
        {
          id: "mock-3",
          city: "New York",
          city_zh: "紐約",
          country: "USA",
          country_zh: "美國",
          greeting: "Good Morning NY!",
          story: "The city that never sleeps is waking up.",
          story_zh: "這座永不眠的城市正在甦醒。",
          longitude: -74.0060,
          latitude: 40.7128,
          imageUrl: "https://picsum.photos/seed/nyc/800/600",
          recipe: "Bagel with Cream Cheese",
          utcOffset: -5,
          userName: "SARAH",
          recordedAtDate: `${today}T08:15:00Z`
        },
        {
          id: "mock-4",
          city: "Taipei",
          city_zh: "台北",
          country: "Taiwan",
          country_zh: "台灣",
          greeting: "台北早安！",
          story: "Coffee time.",
          story_zh: "咖啡時間。",
          longitude: 121.5654,
          latitude: 25.0330,
          imageUrl: "https://picsum.photos/seed/taipei2/800/600",
          recipe: "Latte",
          utcOffset: 8,
          userName: "DESIGNER",
          recordedAtDate: `${today}T08:45:00Z`
        }
      ];

      setRecords([...data, ...mockWakeups]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        isShifted={!!(selectedRecord || selectedContinent || selectedGroup)} 
        showDatabase={showDatabase}
        rotation={rotation}
      />

      {/* Background Grid */}
      <motion.div 
        className="absolute inset-[-20%] pointer-events-none opacity-[0.015]" 
        style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "30px 30px" }}
        animate={{
          x: (rotation[0] * 0.05) + (
            (selectedRecord || selectedContinent || selectedGroup) 
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
        drag={isMobile ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          if (!isMobile) return;
          if (info.offset.x > 100) {
            // Swipe Right -> Move towards Journal (Left) or Close Details (Right)
            if (selectedRecord || selectedContinent || selectedGroup) {
              setSelectedRecord(null);
              setSelectedContinent(null);
              setSelectedGroup(null);
            } else if (!showDatabase) {
              setShowDatabase(true);
            }
          } else if (info.offset.x < -100) {
            // Swipe Left -> Move towards Details (Right) or Close Journal (Left)
            if (showDatabase) {
              setShowDatabase(false);
            } else if (!selectedRecord && !selectedContinent && !selectedGroup) {
              if (sortedRecords.length > 0) setSelectedRecord(sortedRecords[0]);
            }
          }
        }}
        animate={{ 
          x: (selectedRecord || selectedContinent || selectedGroup) ? (isMobile ? "-100%" : "-25%") : (showDatabase ? (isMobile ? "100%" : "100%") : "0%"),
          opacity: (isMobile && (showDatabase || selectedRecord || selectedContinent || selectedGroup)) ? 0.2 : (showDatabase ? 0 : 1)
        }}
        transition={{ type: "spring", damping: 30, stiffness: 150 }}
      >
        <Map
          records={showWakeupToday ? wakeupRecords : records}
          isWakeupMode={showWakeupToday}
          rotation={rotation}
          onRotationChange={setRotation}
          onSelectRecord={(record) => {
            soundService.playClick();
            setSelectedRecord(record);
            setSelectedContinent(null);
            setSelectedGroup(null);
          }}
          onSelectGroup={(group) => {
            soundService.playClick();
            setSelectedGroup(group);
            setSelectedRecord(null);
            setSelectedContinent(null);
          }}
          onSelectContinent={(continent) => {
            setSelectedContinent(continent);
            setSelectedRecord(null);
            setSelectedGroup(null);
          }}
          selectedId={selectedRecord?.id}
          highlightedIds={highlightedIds}
          language={language}
          isPanelOpen={isAnyPanelOpen}
        />
      </motion.div>

      {/* Mobile Navigation Controls */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] pointer-events-auto bg-white border-t border-black">
        <div className="flex items-center w-full h-16">
          {/* Left Arrow */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (selectedRecord || selectedContinent || selectedGroup) {
                navigateTo('map');
              } else if (!showDatabase) {
                navigateTo('journal');
              }
            }}
            className={`flex-1 h-full border-r border-black flex items-center justify-center transition-all duration-300 ${
              showDatabase ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </motion.button>

          {/* Middle Button */}
          <AnimatePresence mode="wait">
            {!isAnyPanelOpen ? (
              <motion.button
                key="wakeup-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={findMorningLocations}
                className="flex-[3] h-full bg-[#45e945] text-black flex items-center justify-center gap-3 font-mono text-[14px] font-bold uppercase tracking-[0.1em] relative"
              >
                <Sun className="w-4 h-4" />
                <span>{language === "zh" ? (showWakeupToday ? "今日甦醒" : "現在覺醒") : (showWakeupToday ? "WAKEUPS" : "WAKE UP")}</span>
                <div className="w-2 h-2 bg-black/20" />
              </motion.button>
            ) : (
              <div className="flex-[3] h-full" />
            )}
          </AnimatePresence>

          {/* Right Arrow */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (showDatabase) {
                navigateTo('map');
              } else if (!selectedRecord && !selectedContinent && !selectedGroup) {
                navigateTo('details');
              }
            }}
            className={`flex-1 h-full border-l border-black flex items-center justify-center transition-all duration-300 ${
              (showDatabase || (!selectedRecord && !selectedContinent && !selectedGroup)) ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronRight className="w-6 h-6 text-black" />
          </motion.button>
        </div>
      </div>

      {/* Top Left: Header & Menu */}
      <motion.div 
        className={`absolute ${isMobile ? 'top-6 left-6' : 'top-10 left-10'} z-50 flex flex-col gap-6 lg:gap-10 pointer-events-none`}
        animate={{ 
          x: (selectedRecord || selectedContinent || selectedGroup) ? (isMobile ? "-150%" : "-120%") : (showDatabase ? (isMobile ? "-150%" : "calc(100vw - 480px)") : "0%"), 
          opacity: (selectedRecord || selectedContinent || selectedGroup || (isMobile && showDatabase)) ? 0 : 1,
          scale: (isMobile && showDatabase) ? 0.8 : 1
        }}
        transition={{ type: "spring", damping: 30, stiffness: 150 }}
      >
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-col gap-6"
        >
          {/* User Name Input */}
          <div className="flex flex-col gap-4 pointer-events-auto">
            <div className="group">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-1 bg-accent-neon rounded-full" />
                <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">
                  {language === "zh" ? "操作員身份" : "Operator Identity"}
                </span>
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
                    {language === "zh" ? "編輯" : "Edit"}
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={language === "zh" ? "輸入名稱..." : "ENTER NAME..."}
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
          </div>

          <div className="flex flex-col gap-4 w-[calc(100vw-48px)] lg:w-auto lg:max-w-md">
            <div className="flex gap-2 pointer-events-auto">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowWakeupToday(false);
                  soundService.playClick();
                }}
                className={`font-mono text-[10px] uppercase tracking-[0.1em] transition-all py-1.5 px-3 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                  !showWakeupToday 
                    ? 'bg-accent-neon text-black' 
                    : 'bg-white text-gray-500'
                }`}
              >
                {language === "zh" ? "我的甦醒地圖" : "MY WAKEUP MAP"}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowWakeupToday(true);
                  soundService.playClick();
                }}
                className={`font-mono text-[10px] uppercase tracking-[0.1em] transition-all py-1.5 px-3 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                  showWakeupToday 
                    ? 'bg-accent-neon text-black' 
                    : 'bg-white text-gray-500'
                }`}
              >
                {language === "zh" ? "今日誰醒來？" : "WHO WOKE UP?"}
              </motion.button>
            </div>

            <div className="flex flex-col lg:space-y-1">
              <p className="text-[10px] font-mono text-gray-400 uppercase tracking-[0.25em] hidden lg:block">
                {language === "zh" ? "全球早餐網絡" : "Global Breakfast Network"}
              </p>
              <div className="flex items-center gap-4 lg:block">
                <p className="text-[9px] font-mono text-black font-bold uppercase tracking-[0.3em]">
                  {records.length} {language === "zh" ? "個已發現位置" : "Locations Discovered"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Menu (Hidden on mobile as it's consolidated below) */}
        <div className="hidden lg:flex flex-col gap-6 pointer-events-auto pl-2">
          {/* Prominent Wake Up Now Button */}
          <motion.button
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => soundService.playHover()}
            onClick={findMorningLocations}
            className="flex items-center justify-center gap-3 bg-white text-black border border-black px-8 py-4 rounded-none font-mono text-[12px] font-bold uppercase tracking-[0.2em] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,255,0,1)] transition-all group overflow-hidden relative"
          >
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" 
              style={{ backgroundColor: '#45e945' }}
            />
            <Sun className="w-4 h-4 text-black relative z-10" />
            <span className="relative z-10 text-black">{language === "zh" ? "現在覺醒" : "Wake Up Now"}</span>
            <div className="w-2 h-2 bg-black rounded-none animate-pulse relative z-10" />
          </motion.button>

          {/* Wakeup Today Toggle Button */}
          <motion.button
            whileHover={{ x: 5 }}
            onMouseEnter={() => soundService.playHover()}
            onClick={() => {
              setShowWakeupToday(!showWakeupToday);
              soundService.playClick();
            }}
            className={`flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors group ${showWakeupToday ? 'text-accent-neon' : 'text-gray-400 hover:text-black'}`}
          >
            <div className={`w-10 h-[1px] transition-colors ${showWakeupToday ? 'bg-accent-neon' : 'bg-gray-200 group-hover:bg-black'}`} />
            <Clock className="w-4 h-4" />
            {language === "zh" ? (showWakeupToday ? "正在查看今日甦醒" : "查看今天誰醒了") : (showWakeupToday ? "Viewing Wakeups" : "Check Who Wakeup Today")}
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
              {language === "zh" ? "回顧日誌" : "Review Journal"}
            </motion.button>

            <motion.button
              whileHover={{ x: 5 }}
              onMouseEnter={() => soundService.playHover()}
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors group"
            >
              <div className="w-10 h-[1px] bg-gray-200 group-hover:bg-black transition-colors" />
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {language === "zh" ? "音效：" : "Audio: "} {soundEnabled ? (language === "zh" ? "開啟" : "ON") : (language === "zh" ? "關閉" : "OFF")}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Top Right: Language Toggle */}
      <div className={`absolute ${isMobile ? 'top-6 right-6' : 'top-10 right-10'} z-50 pointer-events-auto`}>
        <motion.button
          whileHover={{ x: -5 }}
          onMouseEnter={() => soundService.playHover()}
          onClick={() => {
            soundService.playClick();
            setLanguage(prev => prev === "zh" ? "en" : "zh");
          }}
          className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors group"
        >
          <Globe2 className="w-3 h-3" />
          {language === "zh" ? "LANGUAGE: 中文" : "LANGUAGE: ENGLISH"}
        </motion.button>
      </div>

      {/* Journal Panel (Sliding from left) */}
      <AnimatePresence>
        {showDatabase && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: "0%", opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 150 }}
            className={`absolute top-0 left-0 bottom-0 z-[40] overflow-hidden flex flex-col pointer-events-none ${isMobile ? 'w-full bg-white' : 'w-[calc(100vw-440px)]'}`}
          >
            <div className="flex-1 flex flex-col pointer-events-auto p-6 lg:p-12 pt-16 pb-32 lg:pb-12">
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
                      {language === "zh" ? "系統存檔 // 日誌" : "System Archive // Journal"}
                    </span>
                  </div>
                  <h2 className="text-5xl font-sans font-bold text-gray-900 tracking-tighter uppercase leading-none">
                    {language === "zh" ? "回顧日誌" : "Review Journal"}
                  </h2>
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden group/scroll">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-6">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-black/10 text-gray-400 uppercase tracking-widest">
                        <th className="py-6 px-4 font-medium">{language === "zh" ? "索引" : "Index"}</th>
                        <th className="py-6 px-4 font-medium">{language === "zh" ? "位置" : "Location"}</th>
                        <th className="py-6 px-4 font-medium">{language === "zh" ? "座標" : "Coordinates"}</th>
                        <th className="py-6 px-4 font-medium">{language === "zh" ? "時差" : "UTC Offset"}</th>
                        <th className="py-6 px-4 font-medium">{language === "zh" ? "操作" : "Action"}</th>
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
                            <div className="font-bold text-gray-900 uppercase">{language === "zh" ? (record.city_zh || record.city) : record.city}</div>
                            <div className="text-[9px] text-gray-400 uppercase tracking-widest">{language === "zh" ? (record.country_zh || record.country) : record.country}</div>
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
                              {language === "zh" ? "查看詳情 //" : "View Details //"}
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
        group={selectedGroup}
        records={records}
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
