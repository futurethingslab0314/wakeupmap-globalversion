# Main View Recenter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Recenter the globe on the latest record only when the user returns to the initial main view.

**Architecture:** Keep dragging behavior unchanged inside the map. Detect the transition back into the app's "main view" in `App.tsx`, then rotate the globe to the latest visible record once on that transition.

**Tech Stack:** React, TypeScript, node:test

---

### Task 1: Add failing tests for main-view transition detection

**Files:**
- Modify: `src/__tests__/mapSelection.test.ts`
- Modify: `src/mapSelection.ts`

**Step 1: Write the failing test**

Add tests for a helper that returns `true` only when state changes from a non-main view to the main view.

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/__tests__/mapSelection.test.ts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Add `isMainView` and `shouldRecenterOnMainView` to `src/mapSelection.ts`.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/__tests__/mapSelection.test.ts`
Expected: PASS

### Task 2: Recenter the globe on main-view return

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/mapSelection.ts`

**Step 1: Write the failing behavior test surrogate**

Reuse the helper test from Task 1 to lock the transition rule before wiring React state.

**Step 2: Write minimal implementation**

Track whether the app was previously in the main view. When it transitions back to main view, compute the latest visible record and call `setRotation([-longitude, -latitude, 0])`.

**Step 3: Run focused verification**

Run: `node --import tsx --test src/__tests__/mapSelection.test.ts`
Expected: PASS

**Step 4: Run broader verification**

Run: `npm run lint`
Expected: PASS
