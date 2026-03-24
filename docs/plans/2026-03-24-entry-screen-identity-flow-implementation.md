# Entry Screen And Identity Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an entry screen and identity-aware app boot flow so WakeUp Map can open directly into a chosen `userName` context, including `?userName=...` deep links and empty-state handling for brand-new identities.

**Architecture:** Keep `userName` as the public identity key, but move identity selection into a dedicated entry flow before the main globe renders. Add small pure helpers to parse identity sources and keep app initialization, URL sync, and empty-state rendering deterministic and testable.

**Tech Stack:** React 18, TypeScript, Vite, node:test with `tsx --test`, existing motion/lucide UI stack

---

### Task 1: Add Entry Flow Helpers

**Files:**
- Create: `src/entryState.ts`
- Test: `src/__tests__/entryState.test.ts`

**Step 1: Write the failing test**

Cover:
- reading `userName` from query params
- normalizing entered names
- deciding whether to skip the entry screen

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/__tests__/entryState.test.ts`

Expected: FAIL because helper exports do not exist yet

**Step 3: Write minimal implementation**

Implement small helpers for:
- parsing `userName` from `window.location.search`
- normalizing identity strings
- deciding initial identity state

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/__tests__/entryState.test.ts`

Expected: PASS

### Task 2: Integrate Identity Boot Flow Into App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/i18n.ts`

**Step 1: Write the failing test**

Use helper-level tests from Task 1 to cover app boot logic boundaries before touching UI state.

**Step 2: Run test to verify it fails**

Re-run: `./node_modules/.bin/tsx --test src/__tests__/entryState.test.ts`

Expected: red/green cycle already captures missing helper behavior

**Step 3: Write minimal implementation**

Update app flow to:
- show entry screen when no identity is active
- skip entry screen when `?userName=...` exists
- initialize `userName` and confirmation state from the entry flow
- keep personal filtering scoped to the active identity from first render
- allow returning to the entry screen from the in-app edit action
- sync the chosen identity back into the URL
- show empty-state guidance when a chosen identity has no records yet

Add any needed copy in `src/i18n.ts`.

**Step 4: Run focused verification**

Run:
- `./node_modules/.bin/tsx --test src/__tests__/entryState.test.ts src/__tests__/layoutState.test.ts src/__tests__/mapSelection.test.ts`
- `./node_modules/.bin/tsc --noEmit --pretty false`

Expected: PASS

### Task 3: Refine Entry Screen UI

**Files:**
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Rely on helper tests for state logic; this task is visual integration and should keep existing verification green while introducing the new screen.

**Step 2: Run test baseline**

Run: `./node_modules/.bin/tsx --test src/__tests__/entryState.test.ts src/__tests__/layoutState.test.ts src/__tests__/mapSelection.test.ts`

Expected: PASS before visual refinement

**Step 3: Write minimal implementation**

Build an entry screen that matches the current design language:
- bold WakeUp Map title
- operator identity label
- `userName` input
- `Enter Globe` CTA
- contextual helper copy for existing vs new identity

Preserve mobile responsiveness and keep existing main-view UI patterns once entered.

**Step 4: Run verification**

Run:
- `./node_modules/.bin/tsx --test src/__tests__/entryState.test.ts src/__tests__/layoutState.test.ts src/__tests__/mapSelection.test.ts`
- `./node_modules/.bin/tsc --noEmit --pretty false`

Expected: PASS

### Task 4: Final Verification

**Files:**
- Review: `src/App.tsx`
- Review: `src/entryState.ts`
- Review: `src/i18n.ts`

**Step 1: Run full required verification**

Run:
- `./node_modules/.bin/tsx --test src/__tests__/entryState.test.ts src/__tests__/layoutState.test.ts src/__tests__/mapSelection.test.ts`
- `./node_modules/.bin/tsc --noEmit --pretty false`

**Step 2: Manually inspect diff**

Run: `git diff -- src/App.tsx src/entryState.ts src/i18n.ts src/__tests__/entryState.test.ts`

**Step 3: Confirm behavior coverage**

Checklist:
- entry screen appears when no identity is specified
- `?userName=...` skips entry
- existing names open existing context
- new names enter empty-state context
- edit action can leave the current identity
- empty-state copy appears for identities with no records
