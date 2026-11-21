# Reservation Map Implementation Plan

> Execute in this isolated checkout using executing-plans; no additional user approval required because implementation, testing and GitHub update are authorized.

**Goal:** Compare today's reserved wake position to the actual acknowledged wake city on the globe and in Review Journal.

**Architecture:** Add an opt-in map projection to the existing booking API. Pure shared client logic resolves city-local calendar dates, merges reservation targets with event snapshots, and produces pending journal entries and comparison pairs. Dedicated SVG layer and filter/journal components keep the existing globe and breakfast record contracts intact.

**Tech Stack:** TypeScript, React, react-simple-maps, d3-geo, Notion REST, Vercel Node ESM.

### 1. Reservation data and local calendar rules
- Tests first: add tests/reservation-map.test.ts for target-zone midnight, DST, after-08 reservations, cancellation/moves, account isolation, completed pair deduplication, zero distance, historical journal rows.
- Implement src/reservationMap.ts and src/server/services/wakeuphereMapBookings.ts; add API view=map after latest-per-account filtering in api/wakeuphere.ts. Keep old roster output unchanged. Add fixture API test in tests/wakeuphere-bookings.test.ts.
- Run node --import tsx --test tests/reservation-map.test.ts tests/wakeuphere-bookings.test.ts.

### 2. Globe layers and controls
- Implement src/components/ReservationMapLayer.tsx using existing clipped lifted-arc geometry, visible markers, selected detail callbacks and zero-distance concentric markers.
- Implement src/components/WakeMapFilter.tsx with accessible All / Reservations / Actual controls and legend. Integrate into Map.tsx and App.tsx, desktop and mobile. Preserve original historical black markers and hide comparisons in isolated views.
- Reservation API fetch is independent of main record fetch, retains last good data on transient failure and shows a retry message. Account filters apply to both sources.

### 3. Journal and details
- Create src/components/JournalRecordRow.tsx and reservation detail rendering. Journal merges only pending reservations with historical actual rows, and shows explicit booked/actual/distance columns. Completed events remain single rows with target snapshots, target-local date, and original button time. Pending rows never show breakfast loading.
- Test SSR controls, detail and journal output plus calendar/merge tests.

### 4. Verify and publish
- Extend tests/serverless-runtime.test.mjs to include the new runtime modules and execute the opt-in map API with mocked Notion data from emitted JS and real city JSON.
- Run npm run lint, npm run build, serverless tests, booking/awake/alarm/update tests, and core tests affected by map changes. Check WakeUpHere markup unchanged and git diff --check.
- Commit, push HEAD:main to the existing GitHub repo, wait for Vercel CI success, verify public GET map/records/icon endpoints, and safely sync changed files into the shared workspace. Do not create fake production bookings or awakenings.

## Verification results

- 150 core, reservation, UI rendering, alarm, queue and booking tests passed; 2 emitted-JavaScript serverless/icon tests passed separately without tsx.
- TypeScript check, production build and git diff --check passed.
- Real Chrome desktop (1440×960) and mobile (390×844): three filters, two reservation markers / one actual marker fixture, comparison distance, pending/completed journal rows, reservation details, horizontal journal scrolling, Chinese labels, failed-read snapshot retention, cancellation, and out-of-order read protection passed with no page errors. Fixtures were intercepted locally; no fake production records were written.
- WakeUpHere public files are unchanged. Repeated reserve writes for the same still-active city preserve the original booking timestamp so browser reloads do not incorrectly remove today's reservation.
