# Location Zh Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fill missing Chinese city or country names before writing wake-up records to Notion.

**Architecture:** Keep city selection based on `cities_data.json`, then localize only the missing Chinese labels with one structured OpenAI call right before generating story/recipe content and persisting to Notion. This keeps the current selection pipeline stable while improving the values written to prompts and Notion.

**Tech Stack:** TypeScript, OpenAI Responses API structured outputs, Node test runner

---

### Task 1: Add a failing localization helper test

**Files:**
- Create: `src/server/__tests__/locationNames.test.ts`
- Create: `src/server/services/locationNames.ts`

**Step 1: Write the failing test**

Add tests covering:
- missing `cityZh` triggers a structured output request and returns translated labels
- existing Chinese labels skip translation

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/server/__tests__/locationNames.test.ts`

**Step 3: Write minimal implementation**

Implement a helper with injected `generateText` dependency and structured output schema.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/server/__tests__/locationNames.test.ts`

### Task 2: Use the fallback in the production wake-up route

**Files:**
- Modify: `api/wake-up-now.ts`

**Step 1: Apply the helper logic inline**

Only call translation when `cityZh === city` or `countryZh === country`.

**Step 2: Run verification**

Run:
- `node --import tsx --test src/server/__tests__/locationNames.test.ts src/server/__tests__/openaiService.test.ts src/server/__tests__/generateTextSkills.test.ts src/server/__tests__/generateRecipeAndImage.test.ts`
- `npm run lint`
