# 3D Lifted Arc Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade WakeUp Map journey lines from the current 2D screen-space curve system to a true 3D lifted arc system while preserving the existing black thin-line visual style and animation rhythm.

**Architecture:** Keep `Map.tsx` as the rendering shell and move arc generation into `src/mapArcs.ts`. Replace the current single quadratic curve with sampled globe-space points that represent a lifted arc above the sphere, then project only the visible front-side segments back into SVG paths. Preserve the existing stroke color, stroke weight, motion timing, and record ordering behavior.

**Tech Stack:** React, TypeScript, `react-simple-maps`, `d3-geo`, `motion/react`, Node test runner via `tsx --test`

---

### Task 1: Lock the target behavior with failing tests

**Files:**
- Modify: `src/__tests__/mapArcs.test.ts`
- Reference: `src/mapArcs.ts`

**Step 1: Add failing tests for 3D lifted arc expectations**

Add tests that prove the new system must:
- preserve a visible segment when one endpoint goes behind the globe
- return multiple visible polyline points instead of a single screen-space quadratic shortcut
- keep endpoints visually stable when both cities are fully visible

Suggested test additions:

```ts
test("buildVisibleLiftedArcSegments returns front-side sampled segments for a cross-horizon route", () => {
  // expect one or more visible point arrays
});

test("buildVisibleLiftedArcSegments keeps endpoints near the projected record positions", () => {
  // expect first and last sampled points to remain anchored
});
```

**Step 2: Run the focused test file to verify it fails**

Run:

```bash
./node_modules/.bin/tsx --test src/__tests__/mapArcs.test.ts
```

Expected:
- FAIL because `buildVisibleLiftedArcSegments` or equivalent 3D helper does not exist yet
- or FAIL because current helper still returns a 2D fallback path only

**Step 3: Do not change production code yet**

Confirm the failure is specifically about missing 3D arc behavior, not a typo in the test.

**Step 4: Commit the red state only if the team wants explicit TDD checkpoints**

```bash
git add src/__tests__/mapArcs.test.ts
git commit -m "test: define 3d lifted arc expectations"
```

### Task 2: Introduce globe-space lifted arc sampling

**Files:**
- Modify: `src/mapArcs.ts`
- Reference: `src/components/Map.tsx`
- Test: `src/__tests__/mapArcs.test.ts`

**Step 1: Add new helper types for sampled globe-space arcs**

Add structures such as:

```ts
interface ProjectedArcPoint {
  x: number;
  y: number;
}

type ProjectedArcSegment = ProjectedArcPoint[];
```

**Step 2: Implement a lifted arc sampler in globe space**

Create a helper that:
- interpolates between the two lon/lat endpoints with `geoInterpolate`
- computes a lift profile that peaks around the middle of the route
- projects each sampled point after applying the lifted arc logic
- groups only front-facing points into visible segments

Suggested function shape:

```ts
export function buildVisibleLiftedArcSegments(input: BuildVisibleLiftedArcPathInput): ProjectedArcSegment[] {
  // sample t from 0..1
  // compute great-circle interpolation
  // compute lift amount with a midpoint-biased curve
  // project visible samples
  // split invisible gaps into separate segments
}
```

Notes:
- preserve the current center/projection assumptions unless the refactor clearly benefits from parameterizing them
- the lift profile should feel visually close to the current arc height, not dramatically taller
- do not change color, stroke width, or animation timing here

**Step 3: Keep a compatibility wrapper only if needed**

If `Map.tsx` still wants a single path during migration, optionally keep:

```ts
export function buildVisibleLiftedArcPath(...) { ... }
```

but implement it in terms of the new segment generator rather than preserving the old quadratic math.

**Step 4: Run the focused test file to verify it passes**

Run:

```bash
./node_modules/.bin/tsx --test src/__tests__/mapArcs.test.ts
```

Expected:
- PASS for new 3D arc behavior tests

**Step 5: Commit**

```bash
git add src/mapArcs.ts src/__tests__/mapArcs.test.ts
git commit -m "feat: add 3d lifted arc sampling"
```

### Task 3: Swap the map renderer to multi-segment 3D arc drawing

**Files:**
- Modify: `src/components/Map.tsx`
- Reference: `src/mapArcs.ts`
- Test: `src/__tests__/mapArcs.test.ts`

**Step 1: Replace single-path arc rendering with segment-aware rendering**

Update the route-line block so each record pair:
- requests sampled visible arc segments from `src/mapArcs.ts`
- renders one `motion.path` per visible segment
- preserves the current stroke color `#000`
- preserves the current stroke width `0.4`
- preserves the current animation duration, delay ladder, and easing

Suggested rendering pattern:

```tsx
const segments = buildVisibleLiftedArcSegments(...);

return segments.map((segment, segmentIndex) => (
  <motion.path
    key={`arc-${record.id}-${segmentIndex}`}
    d={toSvgPath(segment)}
    stroke="#000"
    strokeWidth={0.4}
    ...
  />
));
```

**Step 2: Preserve current interaction and marker behavior**

Do not change:
- record ordering
- focus rotation behavior
- marker styling
- country click behavior
- wakeup-today mode

**Step 3: Run targeted tests**

Run:

```bash
./node_modules/.bin/tsx --test src/__tests__/mapArcs.test.ts src/__tests__/mapSelection.test.ts
```

Expected:
- PASS

**Step 4: Perform a quick manual visual check**

Run the dev server and verify:
- black thin lines still match the current style
- line animation still feels the same
- routes near the back side of the globe now leave a front-side visible segment instead of disappearing completely
- long routes do not produce ugly zig-zag artifacts

Suggested commands:

```bash
npm run dev
```

**Step 5: Commit**

```bash
git add src/components/Map.tsx src/mapArcs.ts src/__tests__/mapArcs.test.ts
git commit -m "feat: render 3d lifted arc segments on globe"
```

### Task 4: Tune the visual system without changing its identity

**Files:**
- Modify: `src/mapArcs.ts`
- Modify: `src/components/Map.tsx`
- Optional: `src/__tests__/mapArcs.test.ts`

**Step 1: Tune the arc lift profile**

Adjust only the geometry knobs needed to keep the new 3D arc feeling close to the existing design:
- sample density
- midpoint lift amount
- segment splitting threshold if tiny gaps appear near the horizon

Avoid:
- changing stroke color
- changing stroke width
- changing animation timing
- introducing glow or dashed styles

**Step 2: Add or update tests if any new edge case appears**

Examples:
- routes near polar regions
- very short routes between nearby cities
- antipodal-ish routes that approach the far side of the sphere

**Step 3: Re-run verification**

Run:

```bash
./node_modules/.bin/tsx --test src/__tests__/mapArcs.test.ts src/__tests__/mapSelection.test.ts
```

If feasible, also run a broader frontend-oriented check:

```bash
./node_modules/.bin/tsx --test src/__tests__/recordSync.test.ts src/__tests__/i18n.test.ts
```

**Step 4: Commit**

```bash
git add src/mapArcs.ts src/components/Map.tsx src/__tests__/mapArcs.test.ts
git commit -m "refactor: tune lifted arc visuals for globe rendering"
```

### Task 5: Document and hand off visual QA notes

**Files:**
- Modify: `docs/plans/2026-03-28-3d-lifted-arc-upgrade.md`

**Step 1: Add a short implementation notes section after coding**

Capture:
- final lift profile choice
- sample count
- any known limitations near the horizon or extreme long-distance routes

**Step 2: Add manual QA scenarios**

Document at least these scenarios:
- island destination near the back side of the globe
- cross-ocean route where one endpoint goes behind the sphere
- two fully visible cities on the front hemisphere
- a nearly antipodal route

**Step 3: Commit documentation updates**

```bash
git add docs/plans/2026-03-28-3d-lifted-arc-upgrade.md
git commit -m "docs: capture 3d lifted arc QA notes"
```

## Implementation Notes

- The upgrade should preserve the current visual identity:
  - black line
  - thin stroke
  - same staggered path animation rhythm
- The architectural change is in geometry, not in styling.
- Prefer helper extraction in `src/mapArcs.ts` so the render tree in `src/components/Map.tsx` stays readable.
- Keep the existing A-version horizon fix behavior only as a migration fallback, not as the final rendering model.

## Verification Checklist

- Lines no longer disappear completely when the route crosses toward the back side of the globe.
- The visible front-side portion looks like a real lifted arc in space, not a flattened 2D shortcut.
- The route ordering still follows `recordedAt` chronology.
- Marker rendering, detail panel selection, and country selection still behave exactly as before.
- The new geometry does not materially slow down drag rotation on a realistic number of records.

