# Wakeup Map Content Pipeline Design

**Date:** 2026-03-25

## Goal

Redesign the Wakeup Map content pipeline so that:
- stories feel less templated,
- personalization uses recent history to avoid repetition without trapping a user in one style,
- breakfast image prompts carry stronger city and country grounding,
- the system stores reusable structured signals in Notion for future generations.

## Scope

This design covers the production content contract used by the server-side Wakeup Map generators:
- story generation
- breakfast concept generation
- recipe generation
- image direction generation
- Notion persistence and retrieval

## Problems To Solve

### 1. Story output is too template-like

The current story generator only returns `story` and `storyZh`, and it relies on a short prompt with little reusable structure. That makes it hard to vary:
- opening emotional tone,
- sensory framing,
- historical angle,
- narrative rhythm,
- continuity across repeated generations for the same user.

### 2. Personalization is too weak

`userName` is passed into the prompt, but the system does not currently store or extract the structured signals needed for useful repetition control. It cannot reliably tell whether a user recently received:
- the same kind of breakfast,
- the same mood,
- the same visual setup,
- the same historical framing.

### 3. Breakfast image prompts are too generic

The current image prompt logic mostly says “authentic city/country food culture” plus ingredients. It does not strongly constrain:
- serving context,
- tableware or packaging,
- breakfast scene type,
- visual anchors tied to the selected city,
- anti-generic guardrails.

## Design Principles

- City grounding comes before personalization.
- Personalization should mostly shape tone, emphasis, and avoidance of repetition.
- Recent repetition control is stronger than long-term preference reuse.
- Story, breakfast, recipe, and image prompt must feel like the same morning.
- New structured fields should be lightweight and reusable.

## Chosen Architecture

Use a balanced pipeline with:
1. a lightweight history summary step,
2. one main structured content generation call for story + breakfast direction,
3. one recipe generation call,
4. one image generation call.

This keeps latency under control while still adding a real memory layer.

## Pipeline

### Step 1. Read history

When `userName` is present:
- read the most recent 3 to 5 records for repetition control,
- optionally inspect a slightly longer history window for weak stable patterns.

If no useful history exists:
- fall back to city-first generation with no invented preference profile.

### Step 2. Build personalization summary in app code

Create a lightweight summary object from past records:
- `recentPatterns`
- `stablePreferences`
- `avoidRepeats`
- `confidenceNotes`

The summary should emphasize:
- repeated tones,
- repeated motifs,
- repeated breakfast categories,
- repeated scene settings,
- repeated visual anchors,
- repeated breakfast names or ingredient clusters.

This summary is not persisted as a separate database object. It is derived from Notion records.

### Step 3. Main structured content generation

Replace today’s split between “story only” and “breakfast only” with a main content contract that returns:
- `story`
- `storyZh`
- `tone`
- `motifs`
- `breakfastName`
- `breakfastNameZh`
- `breakfastDescription`
- `breakfastDescriptionZh`
- `highlightIngredients`
- `breakfastCategory`
- `sceneSetting`
- `visualAnchors`
- `avoidRepeats`

This step should:
- anchor the morning in the chosen city,
- avoid recently repeated tone and imagery,
- choose one coherent breakfast identity,
- establish scene and visual anchors for the later image prompt.

### Step 4. Recipe generation

Generate bilingual recipe output using the structured breakfast fields from Step 3.

Recipe generation should preserve:
- breakfast identity,
- ingredient continuity,
- scene plausibility,
- image prompt readiness.

### Step 5. Image direction and image generation

Image prompt generation should explicitly include:
- city and country,
- breakfast name,
- scene setting,
- visual anchors,
- serving context,
- local tableware or packaging cues when plausible,
- strong anti-generic constraints.

The prompt must forbid drifting into:
- generic brunch boards,
- luxury hotel breakfast styling,
- random western props not grounded in the selected city,
- over-styled editorial clutter.

## Contracts

### Main content contract

Required:
- `story`
- `storyZh`
- `tone`
- `motifs`
- `breakfastName`
- `breakfastNameZh`
- `breakfastDescription`
- `breakfastDescriptionZh`
- `highlightIngredients`
- `breakfastCategory`
- `sceneSetting`
- `visualAnchors`
- `avoidRepeats`

### Recipe contract

Required:
- `title`
- `titleZh`
- `recipe`
- `recipeZh`
- `highlightIngredients`
- `imagePrompt`

### Personalization summary contract

Derived in app code:
- `recentPatterns`
- `stablePreferences`
- `avoidRepeats`
- `confidenceNotes`

## Notion Schema

The following newly-added properties become part of the content system:
- `Breakfast Name`
- `Breakfast Name ZH`
- `Breakfast Description`
- `Breakfast Description ZH`
- `Highlight Ingredients`
- `Image Prompt`
- `Tone`
- `Motifs`
- `Breakfast Category`
- `Scene Setting`
- `Visual Anchors`
- `Avoid Repeats`

These support two separate needs:
- persistence for display and debugging,
- structured retrieval for personalization and repetition control.

## Story Rules

The story generator should:
- keep the exact city-opening requirement,
- remain concise and bilingual,
- vary emotional framing and sensory detail,
- avoid repeating recently used structures,
- use historical detail only when it helps grounding,
- stay aligned with the same breakfast morning.

## Image Grounding Rules

The image prompt should be built from structured signals, not just prose:
- `breakfastName`
- `highlightIngredients`
- `breakfastCategory`
- `sceneSetting`
- `visualAnchors`
- location

This is the main mechanism for improving city-specific breakfast imagery.

## Migration Strategy

The implementation should remain backward-compatible:
- old records with missing fields still normalize safely,
- personalization falls back gracefully when structured fields are absent,
- new fields are optional when reading but populated whenever writing.

## Testing Strategy

Add or update tests for:
- main content generation prompt contract,
- recipe generation continuity,
- breakfast image prompt grounding,
- Notion record normalization for new fields,
- personalization summary derivation from recent records.

## Non-Goals

- building a heavy long-term recommendation engine,
- changing frontend rendering in this pass,
- introducing a separate planning model call for every generation layer,
- making personalization override factual city grounding.
