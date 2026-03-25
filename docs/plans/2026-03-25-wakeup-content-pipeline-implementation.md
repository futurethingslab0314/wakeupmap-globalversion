# Wakeup Content Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a lightweight personalization summary and a richer structured content contract so Wakeup Map stories feel less templated and breakfast imagery feels more city-grounded.

**Architecture:** Read recent Notion records, derive a small repetition-control summary in app code, generate one structured story-and-breakfast payload, then generate the recipe and image prompt from that shared context. Keep reads backward-compatible while writing the new Notion properties whenever available.

**Tech Stack:** TypeScript, Node test runner, existing OpenAI JSON-schema wrappers, Notion API adapters

---

### Task 1: Lock the new content contract with failing tests

**Files:**
- Modify: `src/server/__tests__/generateTextSkills.test.ts`
- Modify: `src/server/__tests__/generateRecipeAndImage.test.ts`
- Test: `src/server/__tests__/generateTextSkills.test.ts`
- Test: `src/server/__tests__/generateRecipeAndImage.test.ts`

**Step 1: Write the failing test**

Add assertions that the main content generation returns and prompts for:
- `tone`
- `motifs`
- `breakfastName`
- `breakfastNameZh`
- `breakfastDescription`
- `breakfastDescriptionZh`
- `breakfastCategory`
- `sceneSetting`
- `visualAnchors`
- `avoidRepeats`

Also add assertions that image prompt generation includes scene and visual grounding.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateTextSkills.test.ts src/server/__tests__/generateRecipeAndImage.test.ts`
Expected: FAIL because the current schemas and generators do not expose the new fields.

**Step 3: Write minimal implementation**

Update types, JSON schemas, and generator prompts until the tests pass.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateTextSkills.test.ts src/server/__tests__/generateRecipeAndImage.test.ts`
Expected: PASS

### Task 2: Add backward-compatible Notion normalization tests first

**Files:**
- Modify: `src/server/__tests__/readFromNotion.test.ts`
- Test: `src/server/__tests__/readFromNotion.test.ts`

**Step 1: Write the failing test**

Add coverage for records that include the new Notion fields and assert they normalize into the app shape.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/readFromNotion.test.ts`
Expected: FAIL because the record type and normalizer do not yet include the new fields.

**Step 3: Write minimal implementation**

Extend the record type and Notion normalizer to read the new rich-text, select, and multi-select fields.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/readFromNotion.test.ts`
Expected: PASS

### Task 3: Add personalization summary tests

**Files:**
- Create: `src/server/__tests__/personalizationSummary.test.ts`
- Create: `src/server/skills/buildPersonalizationSummary.ts`
- Test: `src/server/__tests__/personalizationSummary.test.ts`

**Step 1: Write the failing test**

Add tests that derive:
- repeated tones,
- repeated motifs,
- repeated breakfast categories,
- repeated scene settings,
- repeated visual anchors,
- repeated breakfast names

from recent records into a compact summary with `avoidRepeats`, `recentPatterns`, `stablePreferences`, and `confidenceNotes`.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/personalizationSummary.test.ts`
Expected: FAIL because the summary builder does not exist.

**Step 3: Write minimal implementation**

Implement the summary helper with simple counting rules and graceful fallback for sparse history.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/personalizationSummary.test.ts`
Expected: PASS

### Task 4: Thread personalization summary into the content generators

**Files:**
- Modify: `src/server/types.ts`
- Modify: `src/server/services/openaiSchemas.ts`
- Modify: `src/server/skills/generateStory.ts`
- Modify: `src/server/skills/generateLocalBreakfast.ts`
- Modify: `src/server/skills/generateRecipe.ts`
- Modify: `src/server/skills/generateBreakfastImage.ts`

**Step 1: Write the failing test**

Use the tests from Tasks 1 and 3 as the failing tests for this step.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateTextSkills.test.ts src/server/__tests__/generateRecipeAndImage.test.ts src/server/__tests__/personalizationSummary.test.ts`
Expected: FAIL if any generator still ignores the new summary or structured fields.

**Step 3: Write minimal implementation**

Add the summary input to the content generators, keep the prompt concise, and ensure image prompts incorporate:
- scene setting,
- visual anchors,
- local serving context,
- anti-generic instructions.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateTextSkills.test.ts src/server/__tests__/generateRecipeAndImage.test.ts src/server/__tests__/personalizationSummary.test.ts`
Expected: PASS

### Task 5: Verify the targeted suite stays green

**Files:**
- Test: `src/server/__tests__/generateTextSkills.test.ts`
- Test: `src/server/__tests__/generateRecipeAndImage.test.ts`
- Test: `src/server/__tests__/readFromNotion.test.ts`
- Test: `src/server/__tests__/personalizationSummary.test.ts`

**Step 1: Run verification**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateTextSkills.test.ts src/server/__tests__/generateRecipeAndImage.test.ts src/server/__tests__/readFromNotion.test.ts src/server/__tests__/personalizationSummary.test.ts`
Expected: PASS

**Step 2: Note rollout requirement**

Document that Notion now needs the newly-added fields populated during future page writes, and that old pages remain readable.
