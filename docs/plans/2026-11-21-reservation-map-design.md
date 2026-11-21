# WakeUpHere reservation and awakening layers

Approved by the user: retain WakeUpHere UI; on WakeUp Map show orange hollow reservation markers, black actual awakening markers, a comparison arc and kilometre label, and All / Reservations / Actual filters. Today follows the reserved city's IANA timezone and scheduled local 08:00 date, not the viewer's date. Completed events preserve their original target. Only current valid pending reservations appear; switching/cancelling removes obsolete pending targets.

User added Review Journal: show pending reservations as awaiting awakening; completed event rows show reserved city, actual city, captured button time and distance together. Retain historical breakfast entries and completed target snapshots. Do not fabricate historical pending/cancelled bookings that were never saved.

Use the existing booking API with an opt-in map view; keep the Pi roster response unchanged. Read canonical city coordinates and timezone on the server. Combine active reservations and recorded event target snapshots client-side, deduplicate by user/target/scheduled instant, and scope by the existing account selector. Refresh with the existing 60-second/focus cycle. Read failures are visible and retain the last successful booking snapshot. No additional Notion writes or AI generation.
