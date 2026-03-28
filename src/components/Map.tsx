import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Sphere,
  Graticule
} from "react-simple-maps";
import { NotionRecord } from "../types";
import { getRecordCity, UiLanguage } from "../i18n";
import {
  getCityVisitMarkerRadius,
  getLatestRecord,
  getRecordsSortedByRecordedAt,
  getWakeupGroupUserNames,
} from "../mapSelection";
import { getMapOverlayScale, getStableSvgSize, normalizeViewportSize } from "../mapOverlayScale";
import { getGreetingBubbleHitArea, getMarkerLabelHitArea, getWakeupBubbleHitArea } from "../mapHitTargets";
import { buildVisibleLiftedArcSegments, toSvgPath } from "../mapArcs";
import { motion } from "motion/react";
import { geoOrthographic } from "d3-geo";
import { soundService } from "../services/soundService";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MapProps {
  records: NotionRecord[];
  language: UiLanguage;
  rotation: [number, number, number];
  onRotationChange: (rotation: [number, number, number]) => void;
  onSelectRecord: (record: NotionRecord) => void;
  onSelectCountry: (country: string) => void;
  selectedId?: string;
  highlightedIds?: string[];
  isWakeupMode?: boolean;
  todayRecords?: NotionRecord[];
  onSelectGroup?: (records: NotionRecord[]) => void;
}

const Map: React.FC<MapProps> = ({ 
  records, 
  language,
  rotation,
  onRotationChange,
  onSelectRecord, 
  onSelectCountry, 
  selectedId, 
  highlightedIds = [],
  isWakeupMode = false,
  todayRecords = [],
  onSelectGroup,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number } | null>(null);
  const [lastTouchPos, setLastTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
  const [mapScale, setMapScale] = useState(320);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Center on the selected record, or the most recent record by recordedAtDate.
  const focusedRecordId = React.useMemo(() => {
    const latestRecord = getLatestRecord(records);
    return selectedId || latestRecord?.id || (highlightedIds.length > 0 ? highlightedIds[0] : undefined);
  }, [selectedId, records, highlightedIds]);

  useEffect(() => {
    const targetId = focusedRecordId ?? null;
    
    if (targetId) {
      const record = records.find(r => r.id === targetId);
      if (record) {
        onRotationChange([-record.longitude, -record.latitude, 0]);
      }
    }
  }, [focusedRecordId, records, onRotationChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    soundService.playHover();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lastMousePos) return;

    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;

    // Sensitivity factor
    const sensitivity = 0.4;

    onRotationChange([
      rotation[0] + dx * sensitivity,
      rotation[1] - dy * sensitivity,
      rotation[2]
    ]);

    setLastMousePos({ x: e.clientX, y: e.clientY });
    
    // Play a very subtle tick occasionally while dragging
    if (Math.abs(dx) + Math.abs(dy) > 10 && Math.random() > 0.9) {
      soundService.playHover();
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      soundService.playHover();
    }
    setIsDragging(false);
    setLastMousePos(null);
  };

  // Touch event handlers for mobile
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setLastTouchPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      setLastTouchPos(null);
      setLastPinchDist(getTouchDistance(e.touches[0], e.touches[1]));
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouchPos) {
      const dx = e.touches[0].clientX - lastTouchPos.x;
      const dy = e.touches[0].clientY - lastTouchPos.y;
      const sensitivity = 0.4;
      onRotationChange([
        rotation[0] + dx * sensitivity,
        rotation[1] - dy * sensitivity,
        rotation[2]
      ]);
      setLastTouchPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2 && lastPinchDist !== null) {
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const scaleFactor = dist / lastPinchDist;
      setMapScale(prev => Math.max(160, Math.min(prev * scaleFactor, 2560)));
      setLastPinchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setLastTouchPos(null);
    setLastPinchDist(null);
  };

  const sortedRecords = useMemo(() => {
    return getRecordsSortedByRecordedAt(records);
  }, [records]);
  const overlayScale = useMemo(
    () => getMapOverlayScale(viewportSize.width, viewportSize.height),
    [viewportSize.height, viewportSize.width],
  );
  const bubbleTextSize = getStableSvgSize(9, overlayScale);
  const markerLabelSize = getStableSvgSize(9, overlayScale);
  const greetingTextSize = getStableSvgSize(10, overlayScale);
  const greetingBubbleWidth = getStableSvgSize(80, overlayScale);
  const greetingBubbleHeight = getStableSvgSize(20, overlayScale);
  const greetingBubbleRadius = getStableSvgSize(4, overlayScale);
  const greetingBubbleYOffset = getStableSvgSize(25, overlayScale);
  const greetingTextYOffset = getStableSvgSize(7, overlayScale);
  const bubblePadding = getStableSvgSize(20, overlayScale);

  // Group todayRecords by coordinate proximity for Wakeup Today mode
  const groupedRecords = useMemo(() => {
    if (!isWakeupMode) return [];
    const groups: Record<string, { records: NotionRecord[]; lat: number; lon: number }> = {};
    todayRecords.forEach(r => {
      const key = `${r.latitude.toFixed(2)}_${r.longitude.toFixed(2)}`;
      if (!groups[key]) {
        groups[key] = { records: [], lat: r.latitude, lon: r.longitude };
      }
      groups[key].records.push(r);
    });
    return Object.values(groups);
  }, [todayRecords, isWakeupMode]);

  // Create a d3 projection to calculate 2D coordinates for custom paths
  const projection = useMemo(() => {
    return geoOrthographic()
      .scale(mapScale)
      .rotate(rotation)
      .translate([400, 300]);
  }, [rotation, mapScale]);

  // Visibility check for Orthographic projection
  const isVisible = (lon: number, lat: number) => {
    const r = projection.rotate();
    const lambda = (lon * Math.PI) / 180;
    const phi = (lat * Math.PI) / 180;
    const lambda0 = (r[0] * Math.PI) / 180;
    const phi0 = (r[1] * Math.PI) / 180;

    // Standard orthographic visibility formula:
    // cos(c) = sin(phi1)sin(phi) + cos(phi1)cos(phi)cos(lambda - lambda1)
    // where [lambda1, phi1] is the center of the projection [-r0, -r1]
    const cosC = Math.sin(-phi0) * Math.sin(phi) + Math.cos(-phi0) * Math.cos(phi) * Math.cos(lambda - (-lambda0));
    return cosC > 0;
  };

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    let rafId: number | null = null;

    const measureViewport = () => {
      const target = containerRef.current;
      if (!target) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const nextSize = normalizeViewportSize(rect.width, rect.height, viewportSize);
      setViewportSize((previous) => {
        if (previous.width === nextSize.width && previous.height === nextSize.height) {
          return previous;
        }
        return nextSize;
      });
    };

    const scheduleMeasure = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        measureViewport();
      });
    };

    measureViewport();

    const resizeHandler = () => {
      scheduleMeasure();
    };

    window.addEventListener("resize", resizeHandler);
    window.addEventListener("orientationchange", resizeHandler);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.removeEventListener("resize", resizeHandler);
        window.removeEventListener("orientationchange", resizeHandler);
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
      };
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextSize = normalizeViewportSize(entry.contentRect.width, entry.contentRect.height, viewportSize);
      setViewportSize((previous) => {
        if (previous.width === nextSize.width && previous.height === nextSize.height) {
          return previous;
        }
        return nextSize;
      });
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeHandler);
      window.removeEventListener("orientationchange", resizeHandler);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [viewportSize]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden relative touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <ComposableMap
        projection="geoOrthographic"
        width={800}
        height={600}
        projectionConfig={{
          scale: mapScale,
          rotate: rotation
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Sphere stroke="#000" strokeWidth={0.15} fill="#fff" />
        <Graticule stroke="#000" strokeWidth={0.1} opacity={0.05} />
        
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => {
                  const countryName = geo.properties.name || geo.properties.NAME;
                  if (countryName) {
                    onSelectCountry(countryName);
                    soundService.playClick();
                  }
                }}
                fill="#fff"
                stroke="#000"
                strokeWidth={0.15}
                style={{
                  default: { outline: "none" },
                  hover: { fill: "#00FF00", outline: "none", cursor: "pointer" },
                  pressed: { fill: "#f8f8f8", outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {!isWakeupMode && (
          <g className="pointer-events-none">
            {sortedRecords.map((record, index) => {
              if (index === 0) return null;
              const prev = sortedRecords[index - 1];
              const segments = buildVisibleLiftedArcSegments({
                start: { lon: prev.longitude, lat: prev.latitude },
                end: { lon: record.longitude, lat: record.latitude },
                projection,
                isVisible,
              });

              if (segments.length === 0) {
                return null;
              }

              return segments.map((segment, segmentIndex) => {
                const path = toSvgPath(segment);
                if (!path) {
                  return null;
                }

                return (
                  <motion.path
                    key={`arc-${record.id}-${segmentIndex}`}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.3 }}
                    transition={{ 
                      duration: 2.5, 
                      delay: index * 0.05,
                      ease: "easeInOut"
                    }}
                    d={path}
                    fill="none"
                    stroke="#000"
                    strokeWidth={0.4}
                  />
                );
              });
            })}
          </g>
        )}

        {/* Wakeup Today Mode: Pulsing Group Markers */}
        {isWakeupMode && groupedRecords.map((group, idx) => {
          if (!isVisible(group.lon, group.lat)) return null;
          const groupNames = getWakeupGroupUserNames(group.records);
          const handleGroupSelect = () => onSelectGroup?.(group.records);
          const bubbleWidth = Math.max(
            getStableSvgSize(68, overlayScale),
            Math.min(
              getStableSvgSize(160, overlayScale),
              groupNames.reduce((max, name) => Math.max(max, name.length * bubbleTextSize * 0.8 + bubblePadding), 0),
            ),
          );
          const bubbleHeight = groupNames.length * getStableSvgSize(14, overlayScale) + getStableSvgSize(12, overlayScale);
          const bubbleTop = -bubbleHeight - getStableSvgSize(18, overlayScale);
          const bubbleTailBaseY = bubbleTop + bubbleHeight - getStableSvgSize(1.25, overlayScale);
          const bubbleTailTipY = bubbleTailBaseY + getStableSvgSize(8, overlayScale);
          const bubbleHitArea = getWakeupBubbleHitArea(
            bubbleWidth,
            bubbleTop,
            bubbleHeight,
            getStableSvgSize(10, overlayScale),
          );

          return (
            <Marker key={`wakeup-group-${idx}`} coordinates={[group.lon, group.lat]}>
              <motion.g
                onClick={handleGroupSelect}
                className="cursor-pointer"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <rect
                  x={bubbleHitArea.x}
                  y={bubbleHitArea.y}
                  width={bubbleHitArea.width}
                  height={bubbleHitArea.height}
                  fill="transparent"
                  pointerEvents="all"
                  onClick={handleGroupSelect}
                />
                <motion.g
                  initial={{ opacity: 0, scale: 0.9, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="pointer-events-auto"
                >
                  <rect
                    x={-bubbleWidth / 2}
                    y={bubbleTop}
                    width={bubbleWidth}
                    height={bubbleHeight}
                    rx="6"
                    fill="white"
                    stroke="black"
                    strokeWidth="0.6"
                  />
                  <path
                    d={`M ${-getStableSvgSize(6, overlayScale)} ${bubbleTailBaseY} L 0 ${bubbleTailTipY} L ${getStableSvgSize(6, overlayScale)} ${bubbleTailBaseY} Z`}
                    fill="white"
                    stroke="black"
                    strokeWidth="0.6"
                  />
                  {groupNames.map((name, nameIndex) => (
                    <text
                      key={`${name}-${nameIndex}`}
                      x="0"
                      y={bubbleTop + getStableSvgSize(16, overlayScale) + nameIndex * getStableSvgSize(14, overlayScale)}
                      className="font-sans font-bold fill-black"
                      style={{ fontSize: `${bubbleTextSize}px` }}
                      textAnchor="middle"
                    >
                      {name}
                    </text>
                  ))}
                </motion.g>
                {/* Inner Point */}
                <circle r={2} fill="#000" />
                {/* Pulsing Neon Ring */}
                <motion.circle
                  r={6}
                  fill="transparent"
                  stroke="#00FF00"
                  strokeWidth={1}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.g>
            </Marker>
          );
        })}

        {/* Normal Mode: Individual Markers */}
        {!isWakeupMode && records.map((record) => {
          const isSelected = focusedRecordId === record.id;
          const isHighlighted = highlightedIds.includes(record.id);
          const baseMarkerRadius = getCityVisitMarkerRadius(records, record);
          const markerRadius = isSelected
            ? baseMarkerRadius + 0.5
            : isHighlighted
              ? baseMarkerRadius + 0.2
              : baseMarkerRadius;
          const long = parseFloat(record.longitude as any);
          const lat = parseFloat(record.latitude as any);
          const cityLabel = getRecordCity(record, language);
          const handleRecordSelect = () => onSelectRecord(record);
          const labelHitArea = getMarkerLabelHitArea(cityLabel, markerLabelSize);
          const greetingHitArea = getGreetingBubbleHitArea(
            greetingBubbleWidth,
            greetingBubbleHeight,
            greetingBubbleYOffset,
            getStableSvgSize(8, overlayScale),
          );

          if (isNaN(long) || isNaN(lat)) return null;
          if (!isVisible(long, lat)) return null;

          return (
            <Marker key={record.id} coordinates={[long, lat]}>
              <motion.g
                initial={{ scale: 0 }}
                animate={{ 
                  scale: isHighlighted ? 1.2 : 1,
                }}
                onClick={handleRecordSelect}
                className="cursor-pointer"
              >
                {/* Small Solid Black Dot Marker */}
                <circle
                  r={markerRadius}
                  fill="#000"
                />
                
                {/* Selection Ring - neon green glow */}
                {isSelected && (
                  <motion.circle
                    r={6}
                    fill="none"
                    stroke="#00FF00"
                    strokeWidth={0.5}
                    initial={{ scale: 0.8, opacity: 0.8 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}

                {/* Label for selected/highlighted - Centered above as in screenshot */}
                {(isSelected || isHighlighted) && (
                  <>
                    <rect
                      x={labelHitArea.x}
                      y={labelHitArea.y}
                      width={labelHitArea.width}
                      height={labelHitArea.height}
                      fill="transparent"
                      pointerEvents="all"
                      onClick={handleRecordSelect}
                    />
                    <motion.text
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: -8 }}
                      className="font-mono font-bold uppercase tracking-tighter fill-black"
                      style={{ fontSize: `${markerLabelSize}px` }}
                      textAnchor="middle"
                    >
                      {cityLabel}
                    </motion.text>
                  </>
                )}

                {/* Good Morning Speech Bubble */}
                {isSelected && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0, y: 0 }}
                    animate={{ opacity: 1, scale: 1, y: -greetingBubbleYOffset }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className="pointer-events-auto"
                  >
                    <rect
                      x={greetingHitArea.x}
                      y={greetingHitArea.y}
                      width={greetingHitArea.width}
                      height={greetingHitArea.height}
                      fill="transparent"
                      pointerEvents="all"
                      onClick={handleRecordSelect}
                    />
                    {/* Bubble Background */}
                    <rect
                      x={-greetingBubbleWidth / 2}
                      y={-greetingBubbleHeight}
                      width={greetingBubbleWidth}
                      height={greetingBubbleHeight}
                      rx={greetingBubbleRadius}
                      fill="white"
                      stroke="black"
                      strokeWidth="0.5"
                      className="shadow-sm"
                    />
                    {/* Bubble Tail */}
                    <path
                      d={`M ${-getStableSvgSize(5, overlayScale)} 0 L 0 ${getStableSvgSize(5, overlayScale)} L ${getStableSvgSize(5, overlayScale)} 0 Z`}
                      fill="white"
                      stroke="black"
                      strokeWidth="0.5"
                    />
                    {/* Greeting Text */}
                    <text
                      y={-greetingTextYOffset}
                      className="font-sans font-bold fill-black"
                      style={{ fontSize: `${greetingTextSize}px` }}
                      textAnchor="middle"
                    >
                      {record.greeting || "Good Morning!"}
                    </text>
                  </motion.g>
                )}
              </motion.g>
            </Marker>
          );
        })}
      </ComposableMap>
    </div>
  );
};

export default Map;
