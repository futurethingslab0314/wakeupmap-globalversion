import React from "react";
import { NotionRecord } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, MapPin, Utensils, BookOpen, Coffee, Globe2, Layers } from "lucide-react";
import { CONTINENT_NAMES_ZH, COUNTRY_TO_CONTINENT } from "../constants/continents";

interface DetailsPanelProps {
  record: NotionRecord | null;
  continent: string | null;
  group: NotionRecord[] | null;
  records: NotionRecord[];
  onClose: () => void;
  language: "zh" | "en";
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({ record, continent, group, records, onClose, language }) => {
  if (!record && !continent && !group) return null;

  const isZh = language === "zh";

  // Calculate continent stats if needed
  const continentStats = React.useMemo(() => {
    if (!continent) return null;
    const continentRecords = records.filter(r => COUNTRY_TO_CONTINENT[r.country] === continent);
    const uniqueCountries = new Set(continentRecords.map(r => r.country));
    return {
      totalVisits: continentRecords.length,
      totalCountries: uniqueCountries.size,
      nameZh: CONTINENT_NAMES_ZH[continent] || continent,
      nameEn: continent
    };
  }, [continent, records]);

  const displayRecord = record || (group && group.length > 0 ? group[0] : null);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 150 }}
        className={`fixed inset-0 lg:left-auto lg:right-0 lg:bottom-0 z-50 overflow-hidden flex flex-col pointer-events-none bg-white lg:w-full lg:max-w-xl`}
      >
        <div className="flex-1 flex flex-col pointer-events-auto p-4 lg:p-12 pb-32 lg:pb-12">
          {/* Header */}
          <div className="flex justify-between items-start mb-4 lg:mb-12">
            <div className="space-y-1 lg:space-y-4">
              <div className="flex items-center gap-2 lg:gap-4">
                <div className="w-6 lg:w-10 h-[1px] bg-black/20" />
                <span className="font-mono text-[8px] lg:text-[10px] text-gray-400 uppercase tracking-[0.3em]">
                  {group 
                    ? (isZh ? `甦醒群組 // ${group.length} 位` : `Wakeup Group // ${group.length}`) 
                    : (record 
                        ? (isZh ? `位置數據 // ${record.id.slice(0, 8)}` : `Location Data // ${record.id.slice(0, 8)}`) 
                        : (isZh ? `洲際數據 // ${continent}` : `Continent Data // ${continent}`))
                  }
                </span>
              </div>
              <h2 className="text-2xl lg:text-5xl font-mono font-bold text-gray-900 leading-[0.9] tracking-tighter uppercase">
                {displayRecord ? (isZh ? (displayRecord.city_zh || displayRecord.city) : displayRecord.city) : (isZh ? continentStats?.nameZh : continentStats?.nameEn)}
              </h2>
              <div className="flex items-center gap-2 lg:gap-3 font-mono text-[10px] lg:text-xs text-gray-500">
                {displayRecord ? (
                  <>
                    <span className="uppercase tracking-widest">{isZh ? (displayRecord.country_zh || displayRecord.country) : displayRecord.country}</span>
                    <span className="opacity-30">/</span>
                    <span className="tabular-nums">
                      {displayRecord.latitude.toFixed(2)}°, {displayRecord.longitude.toFixed(2)}°
                    </span>
                  </>
                ) : (
                  <span className="uppercase tracking-widest">{continent}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 lg:p-2 hover:bg-black/5 rounded-full transition-colors group"
            >
              <X className="w-5 h-5 lg:w-6 lg:h-6 text-gray-400 group-hover:text-black" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 relative overflow-hidden group/scroll">
            <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-4 lg:space-y-12 pr-1 lg:pr-6 pb-12">
              {group ? (
                <div className="space-y-4 lg:space-y-12">
                  <section className="space-y-4 lg:space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[9px] lg:text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {isZh ? "今日活躍操作員" : "Active Operators Today"}
                      </h3>
                    </div>
                    <div className="space-y-2 lg:space-y-4">
                      {group.map((r, idx) => (
                        <div key={r.id} className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6 p-3 lg:p-6 border border-black/5 hover:border-accent-neon transition-colors group/item">
                          <div className="font-mono text-xs text-gray-300 tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </div>
                          <div className="flex-1">
                            <div className="font-mono text-lg font-bold text-gray-900 uppercase tracking-widest">
                              {r.userName || (isZh ? "未知操作員" : "Unknown Operator")}
                            </div>
                            <div className="font-mono text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                              {isZh ? "狀態：已甦醒" : "Status: Awake"} // {r.recordedAtDate ? new Date(r.recordedAtDate).toLocaleTimeString() : "N/A"}
                            </div>
                          </div>
                          <div className="w-2 h-2 bg-accent-neon rounded-full animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {isZh ? "區域情報" : "Regional Intelligence"}
                      </h3>
                    </div>
                    <p className="font-mono text-sm text-gray-500 leading-relaxed">
                      {isZh 
                        ? `此位置今日有 ${group.length} 個活躍同步點。所有操作員均已成功初始化晨間協議。`
                        : `This location has ${group.length} active synchronization points today. All operators have successfully initialized their morning protocols.`
                      }
                    </p>
                  </section>
                </div>
              ) : record ? (
                <>
                  {/* Story Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {isZh ? "覺醒日誌" : "Awakening Log"}
                      </h3>
                    </div>
                    <div className="font-serif text-2xl text-gray-700 leading-relaxed italic">
                      "{isZh ? (record.story_zh || record.story) : record.story || (isZh ? "在神秘的地方覺醒..." : "Awakening in a mysterious place...")}"
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
                      {isZh ? "視覺參考 // 01" : "Visual Reference // 01"}
                    </div>
                  </div>

                  {/* Recipe Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {isZh ? "在地補給" : "Local Sustenance"}
                      </h3>
                    </div>
                    <div className="font-mono text-sm text-gray-600 leading-relaxed whitespace-pre-wrap border-l border-black/5 pl-6">
                      {record.recipe || (isZh ? "配方數據待同步..." : "Recipe data pending synchronization...")}
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
                          {isZh ? "國家" : "Countries"}
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
                          {isZh ? "總造訪次數" : "Total Visits"}
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
                        {isZh ? "洲際摘要" : "Continent Summary"}
                      </h3>
                    </div>
                    <p className="font-mono text-sm text-gray-500 leading-relaxed">
                      {isZh 
                        ? `您已在 ${continentStats?.nameZh} 探索了 ${continentStats?.totalCountries} 個國家。該地區共記錄了 ${continentStats?.totalVisits} 筆覺醒日誌。`
                        : `You have explored ${continentStats?.totalCountries} countries across ${continent}. A total of ${continentStats?.totalVisits} awakening logs have been recorded in this region.`
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-black/5 flex justify-between items-center">
            <div className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">
              {record ? (isZh ? `時間戳記: ${record.recordedAtDate || "無"}` : `Timestamp: ${record.recordedAtDate || "N/A"}`) : (isZh ? `區域: ${continentStats?.nameZh}` : `Region: ${continent}`)}
            </div>
            <div className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">
              {isZh ? "狀態：已同步" : "Status: Synchronized"}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DetailsPanel;
