import React from "react";
import { NotionRecord } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, MapPin, Utensils, BookOpen, Coffee, Globe2, Layers } from "lucide-react";
import { CONTINENT_NAMES_ZH, COUNTRY_TO_CONTINENT } from "../constants/continents";

interface DetailsPanelProps {
  record: NotionRecord | null;
  continent: string | null;
  records: NotionRecord[];
  onClose: () => void;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({ record, continent, records, onClose }) => {
  if (!record && !continent) return null;

  // Calculate continent stats if needed
  const continentStats = React.useMemo(() => {
    if (!continent) return null;
    const continentRecords = records.filter(r => COUNTRY_TO_CONTINENT[r.country] === continent);
    const uniqueCountries = new Set(continentRecords.map(r => r.country));
    return {
      totalVisits: continentRecords.length,
      totalCountries: uniqueCountries.size,
      nameZh: CONTINENT_NAMES_ZH[continent] || continent
    };
  }, [continent, records]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 150 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-xl z-50 overflow-hidden flex flex-col pointer-events-none"
      >
        <div className="flex-1 flex flex-col pointer-events-auto p-12">
          {/* Header */}
          <div className="flex justify-between items-start mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-[1px] bg-black/20" />
                <span className="font-mono text-[10px] text-gray-400 uppercase tracking-[0.3em]">
                  {record ? `Location Data // ${record.id.slice(0, 8)}` : `Continent Data // ${continent}`}
                </span>
              </div>
              <h2 className="text-5xl font-mono font-bold text-gray-900 leading-[0.9] tracking-tighter uppercase">
                {record ? (record.city_zh || record.city) : continentStats?.nameZh}
              </h2>
              <div className="flex items-center gap-3 font-mono text-xs text-gray-500">
                {record ? (
                  <>
                    <span className="uppercase tracking-widest">{record.country_zh || record.country}</span>
                    <span className="opacity-30">/</span>
                    <span className="tabular-nums">
                      {record.latitude.toFixed(4)}°N, {record.longitude.toFixed(4)}°E
                    </span>
                  </>
                ) : (
                  <span className="uppercase tracking-widest">{continent}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/5 rounded-full transition-colors group"
            >
              <X className="w-6 h-6 text-gray-400 group-hover:text-black" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 relative overflow-hidden group/scroll">
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar space-y-12 pr-6 pb-12">
              {record ? (
                <>
                  {/* Story Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Awakening Log
                      </h3>
                    </div>
                    <div className="font-serif text-2xl text-gray-700 leading-relaxed italic">
                      "{record.story_zh || record.story || "Awakening in a mysterious place..."}"
                    </div>
                  </section>

                  {/* Image Section */}
                  <div className="relative aspect-[4/3] grayscale hover:grayscale-0 transition-all duration-700 border border-black/5">
                    {record.imageUrl ? (
                      <img
                        src={record.imageUrl}
                        alt="Location"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                        <Coffee className="w-12 h-12 text-gray-200" />
                      </div>
                    )}
                    <div className="absolute bottom-4 right-4 font-mono text-[9px] text-white bg-black/40 px-2 py-1 backdrop-blur-sm uppercase tracking-widest">
                      Visual Reference // 01
                    </div>
                  </div>

                  {/* Recipe Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Local Sustenance
                      </h3>
                    </div>
                    <div className="font-mono text-sm text-gray-600 leading-relaxed whitespace-pre-wrap border-l border-black/5 pl-6">
                      {record.recipe || "Recipe data pending synchronization..."}
                    </div>
                  </section>
                </>
              ) : (
                <div className="space-y-16">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Globe2 className="w-4 h-4 text-accent-neon" />
                        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Countries
                        </h3>
                      </div>
                      <div className="text-6xl font-mono font-bold text-gray-900 tabular-nums">
                        {String(continentStats?.totalCountries).padStart(2, '0')}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-accent-neon" />
                        <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Total Visits
                        </h3>
                      </div>
                      <div className="text-6xl font-mono font-bold text-gray-900 tabular-nums">
                        {String(continentStats?.totalVisits).padStart(2, '0')}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Continent Summary
                      </h3>
                    </div>
                    <p className="font-mono text-sm text-gray-500 leading-relaxed">
                      You have explored {continentStats?.totalCountries} countries across {continentStats?.nameZh}. 
                      A total of {continentStats?.totalVisits} awakening logs have been recorded in this region.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-black/5 flex justify-between items-center">
            <div className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">
              {record ? `Timestamp: ${record.recordedAtDate || "N/A"}` : `Region: ${continent}`}
            </div>
            <div className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">
              Status: Synchronized
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DetailsPanel;
