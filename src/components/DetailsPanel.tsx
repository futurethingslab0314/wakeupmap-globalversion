import React from "react";
import { NotionRecord } from "../types";
import { getContinentName, getRecordCity, getRecordCountry, getRecordRecipe, getRecordStory, uiText, UiLanguage } from "../i18n";
import { motion, AnimatePresence } from "motion/react";
import { X, Coffee, Globe2, Layers } from "lucide-react";
import { COUNTRY_TO_CONTINENT } from "../constants/continents";

interface DetailsPanelProps {
  record: NotionRecord | null;
  continent: string | null;
  group: NotionRecord[] | null;
  records: NotionRecord[];
  language: UiLanguage;
  onClose: () => void;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({ record, continent, group, records, language, onClose }) => {
  if (!record && !continent && !group) return null;
  const text = uiText[language];
  const isBreakfastPreparing = !!record && !record.imageUrl && !getRecordRecipe(record, language);

  // Calculate continent stats if needed
  const continentStats = React.useMemo(() => {
    if (!continent) return null;
    const continentRecords = records.filter(r => COUNTRY_TO_CONTINENT[r.country] === continent);
    const uniqueCountries = new Set(continentRecords.map(r => r.country));
    return {
      totalVisits: continentRecords.length,
      totalCountries: uniqueCountries.size,
      name: getContinentName(continent, language),
    };
  }, [continent, records, language]);

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
                  {group
                    ? `${text.synchronizationPoint} // ${group.length}`
                    : record
                      ? `${text.locationData} // ${record.id.slice(0, 8)}`
                      : `${text.continentData} // ${continent}`}
                </span>
              </div>
              <h2 className="text-5xl font-mono font-bold text-gray-900 leading-[0.9] tracking-tighter uppercase">
                {group
                  ? text.activeOperatorsToday
                  : record
                    ? getRecordCity(record, language)
                    : continentStats?.name}
              </h2>
              <div className="flex items-center gap-3 font-mono text-xs text-gray-500">
                {group ? (
                  <span className="uppercase tracking-widest">
                    {group.length > 0 ? getRecordCity(group[0], language) : ''}
                  </span>
                ) : record ? (
                  <>
                    <span className="uppercase tracking-widest">{getRecordCountry(record, language)}</span>
                    <span className="opacity-30">/</span>
                    <span className="tabular-nums">
                      {record.latitude.toFixed(4)}°N, {record.longitude.toFixed(4)}°E
                    </span>
                  </>
                ) : (
                  <span className="uppercase tracking-widest">{continentStats?.name ?? continent}</span>
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
              {group ? (
                /* Personnel List View */
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                    <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                      {text.activeOperatorsToday}
                    </h3>
                  </div>
                  {group.length === 0 ? (
                    <p className="font-mono text-sm text-gray-400 uppercase tracking-widest">
                      {text.noOneToday}
                    </p>
                  ) : (
                    <div className="space-y-0">
                      {group.map((r, idx) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-6 p-6 border border-black/5 hover:border-accent-neon transition-colors"
                        >
                          <div className="font-mono text-xs text-gray-300 tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </div>
                          <div className="flex-1">
                            <div className="font-mono text-lg font-bold text-gray-900 uppercase tracking-widest">
                              {r.userName || 'Unknown'}
                            </div>
                            <div className="font-mono text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                              {text.statusAwake} // {r.recordedAtDate ? new Date(r.recordedAtDate).toLocaleTimeString() : 'N/A'}
                            </div>
                            <div className="font-mono text-[10px] text-gray-300 uppercase tracking-widest mt-0.5">
                              {getRecordCity(r, language)}, {getRecordCountry(r, language)}
                            </div>
                          </div>
                          {/* Active Status Dot */}
                          <div className="w-2 h-2 bg-accent-neon rounded-full animate-pulse" />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : record ? (
                <>
                  {/* Story Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {text.awakeningLog}
                      </h3>
                    </div>
                    <div className="font-serif text-2xl text-gray-700 leading-relaxed italic">
                      "{getRecordStory(record, language) || text.awakeningFallback}"
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
                      <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-8">
                        <Coffee className="w-12 h-12 text-gray-200" />
                        {isBreakfastPreparing ? (
                          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-400">
                            {text.preparingBreakfast}
                          </p>
                        ) : null}
                      </div>
                    )}
                    <div className="absolute bottom-4 right-4 font-mono text-[9px] text-white bg-black/40 px-2 py-1 backdrop-blur-sm uppercase tracking-widest">
                      {text.visualReference}
                    </div>
                  </div>

                  {/* Recipe Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent-neon rounded-full shadow-[0_0_10px_rgba(0,255,0,0.6)]" />
                      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {text.localSustenance}
                      </h3>
                    </div>
                    <div className="font-mono text-sm text-gray-600 leading-relaxed whitespace-pre-wrap border-l border-black/5 pl-6">
                      {getRecordRecipe(record, language) || text.preparingBreakfast}
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
                          {text.countries}
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
                          {text.totalVisits}
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
                        {text.continentSummary}
                      </h3>
                    </div>
                    <p className="font-mono text-sm text-gray-500 leading-relaxed">
                      {text.continentSummaryText(
                        continentStats?.totalCountries ?? 0,
                        continentStats?.name ?? continent ?? "",
                        continentStats?.totalVisits ?? 0,
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-black/5 flex justify-between items-center">
            <div className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">
              {group
                ? `${text.activeOperatorsToday}: ${group.length}`
                : record
                  ? `${text.timestamp}: ${record.recordedAtDate || "N/A"}`
                  : `${text.region}: ${continentStats?.name ?? continent}`}
            </div>
            <div className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">
              {text.status}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DetailsPanel;
