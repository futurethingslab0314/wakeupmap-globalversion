# Wakeup Today: UI/UX Design & Implementation Guide

This document outlines the design principles and technical implementation of the "Wakeup Today" feature for the Morning Awakening Journal. It is designed to help other AI agents replicate this specific "Technical/Brutalist" aesthetic and real-time synchronization feel.

---

## 1. Design Philosophy
The design follows a **Technical Dashboard / Brutalist** aesthetic (Recipe 1 & 5).

- **Mood**: Professional, precise, information-dense.
- **Typography**: Heavy use of **Monospace** (JetBrains Mono) for data and labels to signal precision.
- **Color Palette**: 
  - Primary: White/Light Gray (`#f5f5f5`)
  - Ink: Black (`#000000`)
  - Accent: **Neon Green** (`#00FF00` / `accent-neon`) for active status indicators.
- **Layout**: Visible grid structures, thin borders (`border-black/5`), and large uppercase headings with tight tracking.

---

## 2. Core Feature: "Wakeup Today" Mode
In this mode, the application shifts from a historical journal to a real-time "Active Operator" monitoring station.

### Key UX Changes:
1. **Marker Aggregation**: Multiple users at the same location are grouped into a single "Synchronization Point".
2. **Visual Feedback**: Markers pulse with a neon green glow.
3. **Data Focus**: The sidebar switches from "Stories/Images" to a "Personnel List" (Active Operators).

---

## 3. Technical Implementation

### A. State Management (`App.tsx`)
Toggle the mode using a simple boolean state.

```tsx
const [showWakeupToday, setShowWakeupToday] = useState(false);
const [selectedGroup, setSelectedGroup] = useState<NotionRecord[] | null>(null);

// Triggered by the "Check Who Wakeup Today" button
const toggleMode = () => {
  setShowWakeupToday(!showWakeupToday);
  setSelectedRecord(null); // Clear single record selection
  setSelectedGroup(null);  // Clear group selection
};
```

### B. Location Grouping Logic (`Map.tsx`)
Group records by coordinate proximity (rounding to 2 decimal places) to handle multiple users in the same city.

```tsx
const groupedRecords = useMemo(() => {
  if (!isWakeupMode) return [];
  
  const groups: Record<string, { records: NotionRecord[], lat: number, lon: number }> = {};
  
  records.forEach(r => {
    // Group by approx 1km radius
    const key = `${r.latitude.toFixed(2)}_${r.longitude.toFixed(2)}`;
    if (!groups[key]) {
      groups[key] = { records: [], lat: r.latitude, lon: r.longitude };
    }
    groups[key].records.push(r);
  });
  
  return Object.values(groups);
}, [records, isWakeupMode]);
```

### C. The "Active Point" Marker (`Map.tsx`)
Visualizing the group with a pulsing neon ring.

```tsx
<Marker coordinates={[group.lon, group.lat]}>
  <motion.g onClick={() => onSelectGroup(group.records)} className="cursor-pointer">
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
```

### D. Personnel List View (`DetailsPanel.tsx`)
Replacing the editorial content with a technical list of users.

```tsx
{group.map((r, idx) => (
  <div key={r.id} className="flex items-center gap-6 p-6 border border-black/5 hover:border-accent-neon transition-colors">
    <div className="font-mono text-xs text-gray-300 tabular-nums">
      {String(idx + 1).padStart(2, '0')}
    </div>
    <div className="flex-1">
      <div className="font-mono text-lg font-bold text-gray-900 uppercase tracking-widest">
        {r.userName}
      </div>
      <div className="font-mono text-[10px] text-gray-400 uppercase tracking-widest mt-1">
        Status: Awake // {new Date(r.recordedAtDate).toLocaleTimeString()}
      </div>
    </div>
    {/* Active Status Dot */}
    <div className="w-2 h-2 bg-accent-neon rounded-full animate-pulse" />
  </div>
))}
```

---

## 4. Important Files & Key Code Sections

### `/src/App.tsx`
- **State Toggle**: `const [showWakeupToday, setShowWakeupToday] = useState(false);`
- **Group Selection**: `const [selectedGroup, setSelectedGroup] = useState<NotionRecord[] | null>(null);`
- **UI Button**: The "Check Who Wakeup Today" button which resets other selections and toggles `showWakeupToday`.
- **Prop Passing**: Passing `isWakeupMode={showWakeupToday}` and `onSelectGroup={setSelectedGroup}` to the `<Map />` component.

### `/src/components/Map.tsx`
- **Grouping Logic**: The `groupedRecords` `useMemo` block which clusters `NotionRecord` objects by rounded coordinates.
- **Marker Rendering**: The conditional block inside `<ComposableMap>` that renders pulsing `<Marker>` elements when `isWakeupMode` is true.
- **Interaction**: The `onClick` handler on group markers that calls `onSelectGroup(group.records)`.

### `/src/components/DetailsPanel.tsx`
- **Prop Definition**: `group: NotionRecord[] | null;` in the interface.
- **Conditional Layout**: The large `{group ? (...) : record ? (...) : (...)}` ternary block in the JSX.
- **Personnel List**: The `group.map()` loop that renders the "Active Operators Today" list with pulsing status dots.

### `/src/index.css`
- **Theme Colors**: `--color-accent-neon: #00FF00;` used for active status indicators.
- **Animations**: Any custom CSS animations (like `animate-pulse`) used for the "Active" feel.

---

## 5. CSS Variables & Theme
Ensure these are defined in your global CSS:

```css
@theme {
  --font-mono: "JetBrains Mono", monospace;
  --color-accent-neon: #00FF00;
}

/* Custom scrollbar for the technical look */
.custom-scrollbar::-webkit-scrollbar {
  width: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
}
```
