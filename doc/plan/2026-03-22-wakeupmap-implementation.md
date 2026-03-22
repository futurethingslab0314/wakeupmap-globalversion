# WakeUpMap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace static demo data with a modular server-side Wake Up Now pipeline that selects a city, generates bilingual content and an OpenAI breakfast image, uploads the image to Cloudflare R2, persists records to Notion, and feeds the existing UI without redesigning it.

**Architecture:** Keep the current UI intact and move all generation, storage, and integration logic to server-side modules under `src/server`. The API route layer should stay thin, delegating city selection, content generation, R2 upload, Notion persistence, and data normalization to separate skill-style modules. Frontend changes should be limited to wiring, language switching, and adapting normalized Notion data into the props already expected by the existing map and panel components.

**Tech Stack:** React 19, TypeScript, Express, Vite, Node test runner via `tsx --test`, OpenAI API, Notion API, Cloudflare R2, Vercel

---

### Task 1: Establish Server Module Layout And Test Harness

**Files:**
- Modify: `package.json`
- Create: `src/server/types.ts`
- Create: `src/server/test/testUtils.ts`
- Create: `src/server/skills/.gitkeep`
- Create: `src/server/services/.gitkeep`
- Create: `src/server/pipelines/.gitkeep`
- Create: `src/server/__tests__/smoke.test.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/smoke.test.ts` with a trivial import from `src/server/types.ts` so the test fails because the file does not exist yet.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/smoke.test.ts`

Expected: FAIL with module resolution error for `src/server/types.ts`

**Step 3: Write minimal implementation**

- Add a `test:server` script to `package.json`
- Create `src/server/types.ts` with shared interfaces for:
  - `CityMappingRecord`
  - `WakeUpNowRequest`
  - `WakeUpNowResult`
  - `NormalizedNotionRecord`
  - service interfaces for OpenAI, Notion, and R2 clients

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/smoke.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add package.json src/server/types.ts src/server/test/testUtils.ts src/server/skills/.gitkeep src/server/services/.gitkeep src/server/pipelines/.gitkeep src/server/__tests__/smoke.test.ts
git commit -m "chore: add server module scaffold"
```

### Task 2: Add City Mapping Data And City Selection Skill

**Files:**
- Create: `src/data/cityMapping.ts`
- Create: `src/server/skills/selectCity.ts`
- Create: `src/server/__tests__/selectCity.test.ts`
- Modify: `src/server/types.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/selectCity.test.ts` covering:
- picks the city with the smallest minute difference to local `08:00`
- breaks ties with higher `population`
- avoids cities present in the latest 7 normalized records when another close option exists

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/selectCity.test.ts`

Expected: FAIL because `selectCity` and `cityMapping` do not exist

**Step 3: Write minimal implementation**

- Create `src/data/cityMapping.ts` with an initial small but typed dataset
- Implement `selectCity` in `src/server/skills/selectCity.ts`
- Include selection diagnostics in the return value:
  - `minuteDiffToEight`
  - `isRecentlyUsed`
  - `evaluatedAtUtc`

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/selectCity.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/data/cityMapping.ts src/server/skills/selectCity.ts src/server/__tests__/selectCity.test.ts src/server/types.ts
git commit -m "feat: add city selection skill"
```

### Task 3: Add Notion Normalization And Read Skill

**Files:**
- Create: `src/server/services/notion.ts`
- Create: `src/server/skills/readFromNotion.ts`
- Create: `src/server/__tests__/readFromNotion.test.ts`
- Modify: `src/server/types.ts`
- Modify: `src/types.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/readFromNotion.test.ts` covering:
- normalizes Notion properties into the frontend record shape
- preserves fields required by current UI components
- safely handles missing bilingual fields
- surfaces `Image URL` as a string URL for the UI

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/readFromNotion.test.ts`

Expected: FAIL because normalization helpers do not exist

**Step 3: Write minimal implementation**

- Implement low-level Notion property readers in `src/server/services/notion.ts`
- Implement `readFromNotion` in `src/server/skills/readFromNotion.ts`
- Update `src/types.ts` so the existing UI consumes a normalized `NotionRecord` shape sourced from Notion instead of static demo data

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/readFromNotion.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/notion.ts src/server/skills/readFromNotion.ts src/server/__tests__/readFromNotion.test.ts src/server/types.ts src/types.ts
git commit -m "feat: add notion read normalization"
```

### Task 4: Add OpenAI Skill Modules For Greeting, Story, And Breakfast Concept

**Files:**
- Create: `src/server/services/openai.ts`
- Create: `src/server/skills/generateGreeting.ts`
- Create: `src/server/skills/generateStory.ts`
- Create: `src/server/skills/generateLocalBreakfast.ts`
- Create: `src/server/__tests__/generateTextSkills.test.ts`
- Modify: `src/server/types.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/generateTextSkills.test.ts` covering:
- `generateGreeting` builds a local-language request from `languageCode` and `greetingHint`
- `generateStory` builds bilingual output constraints including the required opening line
- `generateLocalBreakfast` returns concept fields and canonical `highlightIngredients`

Use a fake OpenAI client so the test checks skill boundaries and prompt contracts rather than live API calls.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateTextSkills.test.ts`

Expected: FAIL because the OpenAI service wrapper and skills do not exist

**Step 3: Write minimal implementation**

- Implement an `openai.ts` wrapper with typed methods for text generation and image generation
- Implement the three text generation skills as separate files with prompts stored close to the skill
- Keep all prompt logic out of routes

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateTextSkills.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/openai.ts src/server/skills/generateGreeting.ts src/server/skills/generateStory.ts src/server/skills/generateLocalBreakfast.ts src/server/__tests__/generateTextSkills.test.ts src/server/types.ts
git commit -m "feat: add text generation skills"
```

### Task 5: Add Recipe And Image Generation Skills

**Files:**
- Create: `src/server/skills/generateRecipe.ts`
- Create: `src/server/skills/generateBreakfastImage.ts`
- Create: `src/server/__tests__/generateRecipeAndImage.test.ts`
- Modify: `src/server/services/openai.ts`
- Modify: `src/server/types.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/generateRecipeAndImage.test.ts` covering:
- `generateRecipe` preserves the selected breakfast concept and `highlightIngredients`
- `generateBreakfastImage` produces an OpenAI image prompt with:
  - fixed top view
  - single-serving constraints
  - no people, no hands, no text, no logo
- image prompt reflects the recipe ingredients consistently

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateRecipeAndImage.test.ts`

Expected: FAIL because the recipe and image skills do not exist

**Step 3: Write minimal implementation**

- Implement `generateRecipe.ts`
- Implement `generateBreakfastImage.ts`
- Extend `openai.ts` with a typed image-generation call returning `imageBinary`

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/generateRecipeAndImage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/skills/generateRecipe.ts src/server/skills/generateBreakfastImage.ts src/server/__tests__/generateRecipeAndImage.test.ts src/server/services/openai.ts src/server/types.ts
git commit -m "feat: add recipe and image generation skills"
```

### Task 6: Add Cloudflare R2 Upload Skill

**Files:**
- Create: `src/server/services/r2.ts`
- Create: `src/server/skills/uploadImageToR2.ts`
- Create: `src/server/__tests__/uploadImageToR2.test.ts`
- Modify: `.env.example`
- Modify: `src/server/types.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/uploadImageToR2.test.ts` covering:
- builds deterministic storage keys from city and timestamp metadata
- returns both `imageUrl` and `imageStorageKey`
- refuses empty `imageBinary`

Use a fake R2 client so the test stays local.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/uploadImageToR2.test.ts`

Expected: FAIL because the R2 service and upload skill do not exist

**Step 3: Write minimal implementation**

- Implement `r2.ts` service helpers
- Implement `uploadImageToR2.ts`
- Add required R2 variables to `.env.example`

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/uploadImageToR2.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/r2.ts src/server/skills/uploadImageToR2.ts src/server/__tests__/uploadImageToR2.test.ts .env.example src/server/types.ts
git commit -m "feat: add r2 image upload skill"
```

### Task 7: Add Notion Persistence Skill And Pipeline Orchestrator

**Files:**
- Create: `src/server/skills/persistToNotion.ts`
- Create: `src/server/pipelines/runWakeUpNow.ts`
- Create: `src/server/__tests__/runWakeUpNow.test.ts`
- Modify: `src/server/services/notion.ts`
- Modify: `src/server/types.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/runWakeUpNow.test.ts` covering:
- pipeline calls skills in order:
  - `selectCity`
  - `generateGreeting`
  - `generateStory`
  - `generateLocalBreakfast`
  - `generateRecipe`
  - `generateBreakfastImage`
  - `uploadImageToR2`
  - `persistToNotion`
- final persisted record contains data aligned to existing UI needs
- UI-facing fields such as image URL and bilingual content are present

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/runWakeUpNow.test.ts`

Expected: FAIL because the persistence skill and orchestrator do not exist

**Step 3: Write minimal implementation**

- Implement `persistToNotion.ts`
- Implement `runWakeUpNow.ts`
- Keep the pipeline runner thin, coordinating typed skill modules only

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/runWakeUpNow.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/skills/persistToNotion.ts src/server/pipelines/runWakeUpNow.ts src/server/__tests__/runWakeUpNow.test.ts src/server/services/notion.ts src/server/types.ts
git commit -m "feat: add wake up pipeline orchestrator"
```

### Task 8: Wire Express API Routes Without Changing UI Layout

**Files:**
- Modify: `server.ts`
- Create: `src/server/routes/wakeUpNow.ts`
- Create: `src/server/routes/notionData.ts`
- Create: `src/server/__tests__/routes.test.ts`
- Modify: `src/server/pipelines/runWakeUpNow.ts`

**Step 1: Write the failing test**

Create `src/server/__tests__/routes.test.ts` covering:
- `GET /api/notion-data` returns normalized records
- `POST /api/wake-up-now` validates required request body fields
- route delegates to the pipeline rather than embedding generation logic

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/routes.test.ts`

Expected: FAIL because route modules do not exist

**Step 3: Write minimal implementation**

- Extract route handlers into `src/server/routes`
- Update `server.ts` to use:
  - `GET /api/notion-data`
  - `POST /api/wake-up-now`
- Keep the existing dev server behavior intact

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/routes.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add server.ts src/server/routes/wakeUpNow.ts src/server/routes/notionData.ts src/server/__tests__/routes.test.ts src/server/pipelines/runWakeUpNow.ts
git commit -m "feat: wire wake up api routes"
```

### Task 9: Connect Existing Frontend UI To Normalized Notion Data

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Modify: `src/components/Map.tsx`
- Modify: `src/components/DetailsPanel.tsx`
- Create: `src/lib/recordAdapters.ts`
- Create: `src/__tests__/recordAdapters.test.ts`

**Step 1: Write the failing test**

Create `src/__tests__/recordAdapters.test.ts` covering:
- adapts normalized Notion records into the current UI expectations
- preserves bilingual fields for language switching
- preserves map coordinate fields and image URL
- does not require visual layout changes

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/tsx --test src/__tests__/recordAdapters.test.ts`

Expected: FAIL because the adapter does not exist

**Step 3: Write minimal implementation**

- Create `src/lib/recordAdapters.ts`
- Update `src/App.tsx` to call `POST /api/wake-up-now`
- Replace direct reliance on `src/data.ts` for live content
- Add language toggle state and field selection without redesigning the current UI
- Limit component changes to data wiring only

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/tsx --test src/__tests__/recordAdapters.test.ts`

Expected: PASS

**Step 5: Run typecheck for the existing UI**

Run: `npm run lint`

Expected: PASS with no TypeScript errors

**Step 6: Commit**

```bash
git add src/App.tsx src/types.ts src/components/Map.tsx src/components/DetailsPanel.tsx src/lib/recordAdapters.ts src/__tests__/recordAdapters.test.ts
git commit -m "feat: connect ui to notion-backed records"
```

### Task 10: Prepare Vercel Deployment And Final Verification

**Files:**
- Modify: `README.md`
- Create: `vercel.json`
- Modify: `.env.example`
- Modify: `package.json`

**Step 1: Write the verification checklist**

Add deployment and verification notes covering:
- required env vars
- local development commands
- Vercel deployment expectations
- manual UI checks confirming no design regressions

**Step 2: Add minimal deployment implementation**

- Create `vercel.json` if needed for API routing behavior
- Update `README.md` with setup for:
  - OpenAI
  - Notion
  - Cloudflare R2
  - local dev server

**Step 3: Run the full server test suite**

Run: `./node_modules/.bin/tsx --test src/server/__tests__/*.test.ts src/__tests__/*.test.ts`

Expected: PASS

**Step 4: Run typecheck**

Run: `npm run lint`

Expected: PASS

**Step 5: Manual verification**

Run the app locally and verify:
- existing UI layout is unchanged
- `Wake Up Now` submits successfully
- latest record appears without layout shifts
- map pins and detail panel still render expected fields
- image loads from the R2-backed URL stored in Notion
- language toggle switches content fields without breaking the layout

**Step 6: Commit**

```bash
git add README.md vercel.json .env.example package.json
git commit -m "chore: prepare vercel deployment"
```
