# Restore full location content for actual awakenings

## Goal and approved behavior

Actual awakening points must open the original Location Data experience: local-language greeting, bilingual city introduction, breakfast image and recipe. Keep original city, account, press/scheduled timestamps, reservation snapshot and distance. WakeUpHere UI stays unchanged.

The previous acknowledgement-only renderer suppressed normal content and skipped generation. Restore the shared detail layout and use the existing production generators for the already stored city, without creating a new wake event or rerunning city selection. Persist the prepared image job on the original Notion page; after image failure or reload, opening the same record resumes that job. Completed records return immediately. The core acknowledgement write remains fast and independent of AI availability.

User additionally requested removing the two gray filter explanations and placing compact All / Reserved / Actual controls on the same row and at the same size as the language controls. Retain dot colors, counts and accessible filter labels.

## Steps

1. Write regression tests for enriching an existing event, preserving frozen metadata/geometry, cached retry, no extra Notion pages, non-wake/wrong-database rejection; client in-flight deduplication and failed-image retry; shared detail content and compact filter.
2. Add complete-awakening action to api/wake-up-now.ts, reusing its existing greeting/story/breakfast generators. Add additive required content/job fields only, store image job before image generation. Add authoritative stored-job resume and completed-image short circuit to api/wake-up-image.ts. Keep old actions unchanged.
3. Add client service and selected-record effect to generate/recover content and refresh the record after text/image completion, with visible retry on error. Show original content followed by optional awakening comparison details. Route local server's new action/flag through production handlers.
4. Compact the map filter, remove explanation paragraphs, align desktop controls with language switch; integrate the same compact control in mobile header where it fits.
5. Run affected suites, emitted JS smoke tests, lint, build and desktop/mobile Chrome QA with local fixtures. Push to GitHub, verify Vercel status and read-only production endpoints. Safely sync source files to shared workspace. Do not fabricate production awakenings.

## Validation

- 158 affected core/content/booking/map/alarm/update tests passed, plus 2 emitted-JavaScript serverless tests without the TypeScript loader; lint, production build and diff whitespace checks passed.
- Independent Chrome with local fixtures passed at 1440px, 390px and 320px: filter/language alignment and equal computed button size, removed captions, actual-point selection, local greeting, bilingual story, rendered image, recipe, original comparison metadata, no duplicate generation after completion, image failure and retry. No production fake records were created.
- WakeUpHere public files remain unchanged. Both content stages explicitly use the original main-database page and stored actual city/press time. Text-ready jobs persist on that page so reopening resumes image work.
