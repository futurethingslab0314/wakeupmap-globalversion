# Automatic content after WakeUpHere acknowledgement

User requested changing the content trigger from opening the map point to pressing the real alarm confirmation. Persist the real acknowledgement first; after the booking API returns wakeRecordId, synchronously save a separate content job and start the existing text/image pipeline without awaiting it in the booking queue. The alarm UI and physical press timestamp stay unchanged.

Use a durable, deduplicated content queue in the already loaded booking-client.js. Retry independently every 15 seconds, on online, and after reload. A failed content job must not block reservation/cancellation or another day's content. Server-side prepared jobs remain the authority for city/time and resume without redoing completed text. Do not run for manual simulations or ordinary reservation writes. Keep the map's on-open recovery as a fallback. Defer automatic browser updates while content work is in flight; preserve unfinished jobs across restart.

Test queue persistence/deduplication/failure isolation; exercise the actual WakeUpHere page with fake real alarm, held image request, independent booking completion, reload retry, and simulation exclusion. Run affected alarm/booking/update/content suites, emitted serverless checks, build and lint; verify visible WakeUpHere HTML unchanged, push GitHub and confirm Vercel.

## Validation

- 165 affected core/map/content/booking/alarm/update tests plus 2 emitted-JavaScript serverless tests passed; TypeScript, production build and git diff --check passed.
- Actual WakeUpHere page script tests cover immediate sound stop, automatic two-stage content requests after a real acknowledgement, durable content saved before booking removal, independent cancellation while images run, startup resume without opening the map, manual simulation exclusion, and deployment reload deferral.
- Queue tests cover deduplication, reload persistence and failure isolation across jobs.
- Independent Chrome against the production build confirmed that opening the actual map point does not issue duplicate generation requests while the Pi job is running, and its completed content appears automatically without a refresh-button click.
- Stripping script tags yields identical WakeUpHere visible markup/styles before and after this change. No fake production awakening is needed for verification.
