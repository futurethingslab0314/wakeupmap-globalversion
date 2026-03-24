# Mobile PWA Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the mobile Wakeup Map layout to respect safe areas, center the globe visually, and support a basic PWA install flow while preserving the current desktop visual language.

**Architecture:** Add a light PWA shell through static manifest/meta/service-worker registration, then refactor the mobile main view into safe-area-aware zones using responsive-only layout changes in `App.tsx` and shared CSS utilities in `src/index.css`. Keep desktop structure intact and isolate mobile behavior behind breakpoint-aware branches.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind v4 utilities, node:test with `tsx --test`

---

### Task 1: Add PWA Assets

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Modify: `index.html`
- Modify: `src/main.tsx`

**Step 1: Write minimal static asset integration**

Add:
- manifest link
- theme-color and apple web-app meta
- service-worker registration

**Step 2: Verify by inspection**

Run: `sed -n '1,120p' index.html`

Expected: PWA tags present

### Task 2: Add Safe-Area CSS Helpers

**Files:**
- Modify: `src/index.css`

**Step 1: Write CSS helpers**

Add helpers for:
- top safe area padding
- bottom safe area padding
- dynamic viewport height usage for mobile

**Step 2: Verify with type/build checks later**

No separate test required; covered by final verification

### Task 3: Rework Mobile Main Layout

**Files:**
- Modify: `src/App.tsx`

**Step 1: Implement mobile-only structure**

Add:
- safe-area top bar with `userName` and language toggle
- compact mobile title block
- lower mobile mode switch zone
- mobile-aware map offset / scale container adjustments

**Step 2: Preserve desktop layout**

Keep existing desktop sections under `lg:` behavior without restyling desktop.

### Task 4: Reconcile Edge Views

**Files:**
- Modify: `src/App.tsx`

**Step 1: Ensure mobile edge pages stay uncluttered**

Confirm:
- journal hides main header and language
- detail hides language and keeps reading space clear
- left/right arrow flow returns to center page correctly

### Task 5: Final Verification

**Files:**
- Review: `src/App.tsx`
- Review: `src/index.css`
- Review: `index.html`
- Review: `src/main.tsx`

**Step 1: Run tests**

Run:
- `./node_modules/.bin/tsx --test src/__tests__/entryState.test.ts src/__tests__/layoutState.test.ts src/__tests__/mapSelection.test.ts`

**Step 2: Run type/build checks**

Run:
- `./node_modules/.bin/tsc --noEmit --pretty false`
- `npm run build`

**Step 3: Inspect diff**

Run:
- `git diff -- src/App.tsx src/index.css src/main.tsx index.html public/manifest.webmanifest public/sw.js`
