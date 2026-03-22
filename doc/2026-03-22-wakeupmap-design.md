# WakeUpMap Design Doc

Date: 2026-03-22

## Overview

WakeUpMap will turn the `Wake Up Now` interaction into a server-backed content generation flow.
When a user enters their name and clicks the button, the app will:

1. Capture the user's local timestamp, browser time zone, and browser locale.
2. Find the world city whose local time is closest to `08:00`.
3. Avoid reusing the same city too often by checking recent Notion records.
4. Generate a local-language greeting for that city.
5. Generate a bilingual wake-up story.
6. Generate a local breakfast concept for that city.
7. Generate a bilingual single-serving breakfast recipe.
8. Generate a breakfast image prompt and image asset.
9. Upload the breakfast image to Cloudflare R2 and persist the public URL.
10. Persist the final result to Notion.
11. Read all website content from Notion for display.

## Goals

- Replace static local content with Notion-backed content.
- Support a `Wake Up Now` pipeline triggered by the frontend.
- Support bilingual UI display in English and Traditional Chinese.
- Generate a breakfast image that matches the generated recipe.
- Upload generated breakfast imagery to Cloudflare R2 and store its public URL.
- Preserve the existing UI design and interaction language while changing only the data layer and backend behavior.
- Keep generation and Notion writes on the server side for security.
- Use Vercel for final deployment.

## Non-Goals

- No admin CMS beyond the existing Notion database.
- No user-editable workflow for revising generated records inside the website.
- No personalized nutrition engine beyond optional lightweight dietary constraints.
- No visual redesign, layout rewrite, or stylistic overhaul of the current UI.

## Current Project Context

Current repo structure:

- `src/App.tsx`: main frontend state and `/api/notion-data` fetch flow
- `src/components/*`: map and detail presentation
- `src/data.ts`: current static location demo data
- `server.ts`: current local server entry

The existing app already has a `userName` input in the UI and a frontend flow that highlights locations based on time offset. The next version will move the source of truth to Notion and move city selection plus content generation to server APIs.

Important implementation constraint:

- existing UI design should remain intact
- data and backend logic must adapt to the current UI structure, not the other way around
- any frontend changes should be limited to wiring, state updates, and bilingual field mapping required to preserve the current experience

## User Flow

### Flow A: Wake Up Now

1. User enters `userName` on the page.
2. User clicks `Wake Up Now`.
3. Frontend sends:
   - `userName`
   - `clientTimestamp`
   - `browserTimeZone`
   - `browserLocale`
4. Backend selects a city near local `08:00`.
5. Backend generates content using OpenAI:
   - `greeting`
   - `story`
   - `story_zh`
   - `localBreakfast`
   - `localBreakfast_zh`
   - `highlightIngredients`
   - `recipe`
   - `recipe_zh`
   - `imagePrompt`
   - `imageBinary`
6. Backend uploads the generated breakfast image to Cloudflare R2.
7. Backend writes the new record into Notion.
8. Frontend refreshes latest and historical content from Notion.

### Flow B: Website Read

1. Frontend loads records from Notion.
2. Latest record is shown in the main UI.
3. Historical records are shown in the journal/database view.
4. Language toggle switches between English and Traditional Chinese UI fields.

## Architecture

### Frontend

The frontend is responsible for:

- collecting `userName`
- collecting browser metadata
- calling backend APIs
- displaying latest and historical records
- switching UI language between English and Traditional Chinese

The frontend does not:

- access Notion directly
- call OpenAI directly
- store any secrets

### Backend

The backend is responsible for:

- loading city mapping data
- selecting the best matching city
- reading recent Notion records for deduplication
- generating greeting, story, local breakfast, recipe, and breakfast image content
- uploading breakfast images to Cloudflare R2
- writing records into Notion
- exposing read APIs for frontend consumption

### Data Sources

- `city mapping` file: generation seed data and city selection data
- `Notion database`: final published content records
- `OpenAI API`: text generation and image generation

## Modular Skill Architecture

To keep the project searchable, editable, and maintainable, the wake-up pipeline should be implemented as a set of separate server-side skill modules.

These "skills" are code modules with clear inputs and outputs. They are not only conceptual stages in the flow. Each one should live in its own file, have a narrow responsibility, and be independently editable.

Recommended characteristics:

- one skill per file
- explicit input and output types
- prompt text stored close to the skill that uses it
- minimal side effects inside generation skills
- orchestration handled separately by the API route or pipeline runner

Recommended directory shape:

```txt
src/
  server/
    skills/
      selectCity.ts
      generateGreeting.ts
      generateStory.ts
      generateLocalBreakfast.ts
      generateRecipe.ts
      generateBreakfastImage.ts
      uploadImageToR2.ts
      persistToNotion.ts
      readFromNotion.ts
    services/
      openai.ts
      notion.ts
      r2.ts
    pipelines/
      runWakeUpNow.ts
```

### Skill Responsibilities

#### `selectCity`

Purpose:

- choose the best city based on user timestamp, local `08:00` proximity, recent dedupe, and population tie-break

Input:

- `clientTimestamp`
- `browserTimeZone`
- `cityMappingRecords`
- `recentRecords`

Output:

- selected city record
- selection diagnostics such as `minuteDiffToEight`

#### `generateGreeting`

Purpose:

- generate the local-language morning greeting for the selected city

Input:

- selected city record

Output:

- `greeting`

#### `generateStory`

Purpose:

- generate bilingual wake-up story content

Input:

- selected city record
- `greeting`

Output:

- `story`
- `story_zh`

#### `generateLocalBreakfast`

Purpose:

- determine the breakfast concept, localized description, and canonical ingredients

Input:

- selected city record
- optional dietary constraints
- browser locale if needed

Output:

- `localBreakfast`
- `localBreakfast_zh`
- `breakfastStyle`
- `highlightIngredients`

#### `generateRecipe`

Purpose:

- convert breakfast concept and ingredients into practical bilingual recipe content

Input:

- selected city record
- `localBreakfast`
- `localBreakfast_zh`
- `breakfastStyle`
- `highlightIngredients`
- optional dietary constraints

Output:

- `recipe`
- `recipe_zh`

#### `generateBreakfastImage`

Purpose:

- generate OpenAI image prompt and breakfast image binary

Input:

- selected city record
- `highlightIngredients`
- `recipe`
- `recipe_zh`
- optional `styleHint`

Output:

- `imagePrompt`
- `imageBinary`

#### `uploadImageToR2`

Purpose:

- upload the generated image asset to Cloudflare R2 and return a public URL

Input:

- `imageBinary`
- selected city record
- generation metadata for filename construction

Output:

- `imageUrl`
- `imageStorageKey`

#### `persistToNotion`

Purpose:

- normalize and write the final record to Notion

Input:

- all generated record fields

Output:

- saved record in normalized app shape

#### `readFromNotion`

Purpose:

- fetch and normalize records for frontend use

Input:

- optional filters or query settings

Output:

- normalized website records

### Pipeline Orchestration

The orchestration layer should stay thin and should not own prompt details.

Recommended orchestration order:

1. `selectCity`
2. `generateGreeting`
3. `generateStory`
4. `generateLocalBreakfast`
5. `generateRecipe`
6. `generateBreakfastImage`
7. `uploadImageToR2`
8. `persistToNotion`

Recommended rule:

- the API route should call the pipeline runner
- the pipeline runner should coordinate skills
- each skill should be independently testable

### Why This Structure

This architecture is recommended because it makes it easier to:

- find and edit one prompt without touching unrelated logic
- swap one generation step without rewriting the whole pipeline
- test failures at a specific stage
- inspect or log intermediate outputs
- reuse individual skills for future tools or admin workflows
- keep the codebase readable as the project grows

## City Mapping File

A new local mapping file will be created and expanded over time.

Suggested path:

- `src/data/cityMapping.ts`

Suggested shape:

```ts
export interface CityMappingRecord {
  id: string;
  active: boolean;
  timezone: string;
  city: string;
  city_zh: string;
  country: string;
  country_zh: string;
  latitude: number;
  longitude: number;
  population: number;
  languageCode: string;
  greetingHint: string;
  breakfastHint: string;
  cultureNotes: string;
  historyNotes: string;
}
```

Field intent:

- `timezone`: IANA zone, used to calculate local time accurately
- `population`: tie-breaker when multiple cities are equally close to `08:00`
- `languageCode`: used to generate the greeting in the local language
- `greetingHint`: pronunciation or language guidance for the greeting
- `breakfastHint`: local breakfast inspiration for recipe generation
- `cultureNotes` and `historyNotes`: factual guardrails for story generation
- `active`: lets us disable incomplete or low-quality cities without deleting them

## City Selection Rules

The city selection algorithm follows the agreed rules:

1. Convert the user's submitted timestamp into UTC.
2. For each active city in the mapping file:
   - compute that city's local current time
   - compute the minute difference between that local time and `08:00`
3. Query the most recent 7 records from Notion.
4. Prefer cities not used in the recent 7 records.
5. Among remaining candidates, choose the city with the smallest minute difference.
6. If multiple cities have the same minute difference, prefer the city with higher population.
7. If all best candidates were recently used, fall back gracefully to the best overall match.

Recommended sort strategy:

1. `isRecentlyUsed ASC`
2. `minuteDiffToEight ASC`
3. `population DESC`

This matches the desired behavior of "avoid repetition when possible" without making the system fail if all strong candidates were used recently.

## Content Generation Rules

### Greeting Generation

Goal:

- Generate a morning greeting in the local language of the selected city.

Input:

- `city`
- `country`
- `languageCode`
- `greetingHint`

Output:

- `greeting`

Rules:

- Should represent how "good morning" is naturally expressed for the city or dominant local language.
- Should remain concise.
- Can include punctuation if natural.

### Story Generation

Goal:

- Generate a bilingual story about waking up in the selected city.

Inputs:

- `city`
- `city_zh`
- `country`
- `country_zh`
- `greeting`
- `cultureNotes`
- `historyNotes`

Outputs:

- `story` in English, at most 150 words
- `story_zh` in Traditional Chinese, at most 150 Chinese characters

Prompt requirements:

- English version begins with `Today you wake up in {city}, {country}.`
- Chinese version contains the image of `今天的你甦醒在{country_zh}的{city_zh}`
- includes local cultural habits, geography, and one lesser-known historical detail
- vivid but grounded
- avoids stereotypes and historical inaccuracies
- English and Chinese should align in meaning but not be word-for-word translations

### Local Breakfast Generation

Goal:

- Generate the core breakfast idea that represents how the selected city is likely to begin the day.
- Create a stable bridge between city context and the later recipe/image generation steps.

Inputs:

- `city`
- `city_zh`
- `country`
- `country_zh`
- `breakfastHint`
- `cultureNotes`
- `browserLocale`
- `dietaryConstraints` (optional)

Outputs:

- `localBreakfast`
- `localBreakfast_zh`
- `breakfastStyle`
- `highlightIngredients`

Prompt intent:

- Identify one plausible breakfast set or plate strongly associated with the city or country.
- Explain it briefly in English and Traditional Chinese.
- Surface the key ingredients that must remain consistent in later recipe and image generation.

Rules:

- Should describe one coherent breakfast experience, not a list of unrelated foods.
- Must stay plausible for the place and avoid tourism clichés.
- Should be grounded in everyday breakfast culture when possible.
- If the city has multiple strong breakfast traditions, choose the one best supported by `breakfastHint`, `cultureNotes`, and ingredient availability.
- `highlightIngredients` produced here become the canonical ingredient anchors for downstream recipe and image generation.
- If `dietaryConstraints` conflict with the original breakfast, preserve the local spirit while adapting ingredients explicitly.

Recommended responsibility split:

1. `generate local breakfast` decides the breakfast concept and key ingredients.
2. `generate one-person recipe` turns that breakfast concept into a practical single-serving recipe.
3. `generate breakfast image` later uses the same ingredients and plating style so image and text stay aligned.

### Recipe Generation

Goal:

- Generate a practical single-serving breakfast recipe based on the chosen local breakfast concept.

Inputs:

- `city`
- `country`
- `city_zh`
- `country_zh`
- `breakfastHint`
- `localBreakfast`
- `localBreakfast_zh`
- `breakfastStyle`
- `highlightIngredients`
- `dietaryConstraints` (optional)

Outputs:

- `highlightIngredients`: array of strings
- `recipe`
- `recipe_zh`

Rules:

- single serving only
- include ingredients and quantities
- include steps
- include total duration
- local culture can influence ingredients and plating
- `recipe` and `recipe_zh` must follow the selected `localBreakfast` concept
- `recipe` and `recipe_zh` must match `highlightIngredients`

### Breakfast Image Generation

Goal:

- Generate a top-down breakfast image based on the recipe-defined key ingredients.
- Produce an image that can be uploaded to Cloudflare R2 and referenced from Notion.

Model source:

- Use an OpenAI image generation model for breakfast image creation.

Inputs:

- `city`
- `country`
- `highlightIngredients`
- `recipe`
- `recipe_zh`
- `styleHint` (optional)

Outputs:

- `imagePrompt`
- `imageBinary`

Prompt template:

`Top-down photo of a single-person breakfast set inspired by authentic {city}, {country} food culture. Must include these ingredients from recipe: {highlightIngredients}. Match recipe plating style and portions. Show only food, utensils, and tabletop. No humans, no hands, no text, no logo. Natural light, realistic textures, editorial composition.`

Rules:

- fixed top view
- single serving only
- ingredients must match `highlightIngredients`, `recipe`, and `recipe_zh`
- no people or body parts in the frame
- no watermark, no logo, and no text in the image
- plating and portion size must stay consistent with the generated recipe
- resulting asset should be suitable for upload to Cloudflare R2

## Notion Database Schema

The current database already contains many target fields. The implementation should preserve those field names where possible.

Primary content fields:

- `userName`
- `recordedAtDate`
- `recordedAt`
- `localTime`
- `city`
- `city_zh`
- `country`
- `country_zh`
- `greeting`
- `story`
- `story_zh`
- `localBreakfast`
- `localBreakfast_zh`
- `longitude`
- `latitude`
- `Image URL`
- `recipe`
- `recipe_zh`

Additional system fields recommended:

- `timezone`
- `population`
- `minuteDiffToEight`
- `browserTimeZone`
- `browserLocale`
- `imagePrompt`
- `highlightIngredients`
- `breakfastStyle`
- `imageStorageKey`
- `generationStatus`
- `sourceVersion`

Recommended intent of system fields:

- `timezone`: selected city's IANA time zone
- `population`: stored for debugging and future analytics
- `minuteDiffToEight`: debugging and tuning city selection quality
- `browserTimeZone`: source user environment
- `browserLocale`: source user environment
- `imagePrompt`: saved prompt used to generate the breakfast image
- `highlightIngredients`: serialized ingredient list
- `breakfastStyle`: compact descriptor of breakfast format, for example `bakery`, `street bowl`, or `home plate`
- `imageStorageKey`: useful for future replacement or cleanup of uploaded R2 image assets
- `generationStatus`: helpful if the flow later becomes multi-stage
- `sourceVersion`: tracks mapping/prompt version used to create the record

## API Design

### `POST /api/wake-up-now`

Purpose:

- Run the full wake-up generation pipeline.

Request body:

```json
{
  "userName": "YUTING",
  "clientTimestamp": "2026-03-22T08:15:00.000+08:00",
  "browserTimeZone": "Asia/Taipei",
  "browserLocale": "zh-TW"
}
```

High-level flow:

1. Validate request body.
2. Compute UTC reference time.
3. Read recent Notion records.
4. Select best matching city from mapping file.
5. Generate `greeting`.
6. Generate `story` and `story_zh`.
7. Generate `localBreakfast`, `localBreakfast_zh`, `breakfastStyle`, and canonical `highlightIngredients`.
8. Generate `recipe` and `recipe_zh`.
9. Generate `imagePrompt` and `imageBinary`.
10. Upload image to Cloudflare R2 and obtain `Image URL`.
11. Persist record to Notion.
12. Return normalized record payload to frontend.

Suggested response:

- the full newly created record in website display shape

### `GET /api/notion-data`

Purpose:

- Return the normalized list of all records for map, detail, and journal display.

Suggested behavior:

- sort newest first
- normalize missing fields safely
- return consistent frontend shape

### Optional `GET /api/notion-latest`

Purpose:

- Return only the latest record for fast homepage rendering

This endpoint is optional because the frontend can also take the first record from `/api/notion-data`.

## Frontend Display Model

The frontend should eventually use Notion records as its primary display source.

Implementation guardrail:

- do not redesign the current UI
- do not change the established visual language, layout composition, map presentation, animation style, or panel structure unless explicitly requested later
- adapt record normalization and field mapping so generated data fits the current UI components cleanly
- if a backend field does not match the UI, fix the data adapter first before considering UI changes

Language toggle behavior:

- English UI uses:
  - `city`
  - `country`
  - `story`
  - `recipe`
- Traditional Chinese UI uses:
  - `city_zh`
  - `country_zh`
  - `story_zh`
  - `recipe_zh`

`greeting` should remain in the selected city's local language regardless of UI language. This preserves the place-based feeling of the experience.

UI data alignment reminder:

- `GET /api/notion-data` should return a frontend-friendly normalized shape that matches the needs of existing components such as the map, details panel, journal/database panel, and latest-record display
- preserve any fields currently expected by the UI, even if they are internally derived from new Notion properties
- use adapters or normalization helpers when backend field names and UI component props differ

## Error Handling

### API-level

- If `userName` is empty, return validation error.
- If no city can be selected, return server error with fallback diagnostics.
- If OpenAI generation fails, do not write partial user-facing content to Notion unless explicitly designed as draft mode.
- If Notion write fails, return failure and do not claim success to the frontend.

### Frontend-level

- show loading state while generation is running
- show retry option if pipeline fails
- refresh display after a successful write
- preserve user name input for resubmission

## Deployment Plan

Target platform:

- Vercel

Deployment model:

- Vite frontend build
- server-side API routes deployed as Vercel serverless functions

Required environment variables:

- `OPENAI_API_KEY`
- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`

Optional future variables:

- `OPENAI_MODEL`
- `IMAGE_MODEL`

Security principles:

- secrets never exposed to frontend
- OpenAI text generation, OpenAI image generation, and Notion calls only happen on the server
- frontend sends only user input and browser metadata

## Suggested Implementation Order

1. Create `city mapping` file and types.
2. Implement city selection utility using IANA time zones and recent Notion dedupe.
3. Implement Notion read/write service.
4. Implement OpenAI generation service for greeting, story, local breakfast, and recipe.
5. Implement breakfast image generation and Cloudflare R2 upload service.
6. Implement `POST /api/wake-up-now`.
7. Implement `GET /api/notion-data`.
8. Replace static frontend data with Notion-backed data.
9. Add UI language toggle.
10. Prepare Vercel deployment config and environment variables.

## Open Questions

- Final Notion property types still need to be matched exactly against the real database configuration.
- The exact OpenAI model choice is still open.
- `dietaryConstraints` is designed but no UI input has been defined yet.
- The exact R2 public delivery strategy still needs to be finalized, for example public bucket URL versus custom domain.

## Recommendation

Proceed with a server-first implementation where:

- frontend collects user context
- backend owns city selection and content generation
- Notion becomes the content source of truth
- local mapping file provides reliable cultural and geographic grounding for generation

This gives the project a stable base for bilingual storytelling, Notion publishing, and Vercel deployment while keeping room for later image generation and richer city coverage.
