# Home-Centered Spherical Drift

## Goal

Design a new WakeUp Map location-selection model that keeps the spirit of `near 8:00 AM` without being limited to strict Earth-time realism.

The new model should:

- keep a meaningful relationship to the user's current local time
- let location selection expand north/south instead of feeling locked to similar latitudes
- use the user's `home base` as the center of the system
- preserve a sense of surprise, including higher-latitude destinations
- avoid relying on unstable generated city or country names

## Why Change

The current mental model is strongly driven by time zone and longitude:

- near `8:00 AM` mostly pushes selection along east/west bands
- users with a stable home base can end up waking within similar latitude ranges
- high-latitude or polar-adjacent locations are unlikely unless explicitly forced

This creates a real-world logic, but it limits the poetic and exploratory range of WakeUp Map.

## Core Idea

Treat the Earth as a sphere and the user’s `home base` as the center of a local drift system.

The new selection model has two axes:

- `time axis`: determines the target longitude band by finding places `near 8:00 AM`
- `minute axis`: determines north/south spherical drift away from home base

This means:

- hours preserve the morning logic
- minutes create a north/south expansion pattern
- home base remains emotionally central
- the system can escape “same-latitude repetition”

## Conceptual Model

### 1. Home Base

Every user has a `home base`:

- home city
- home country
- home coordinates

This is the anchor point for spatial drift.

Home base should be inferred from the user's chosen or most stable location record, not from generated text.

### 2. Near-8 Longitude Band

Do not require a city to be exactly at `8:00 AM`.

Instead, assign each candidate city a `time score` based on how close its local time is to `8:00 AM`.

Suggested time windows:

- `0-30 min from 8:00`: strong match
- `30-60 min`: valid match
- `60-120 min`: weak but allowed
- `120+ min`: only used when intentionally broadening exploration

This keeps the “wake up in the morning somewhere on Earth” logic, but avoids brittle precision.

### 3. Spherical Distance From Home Base

Minutes should not map directly to raw latitude values.

Instead, minutes determine a spherical travel distance from home base on the Earth’s surface.

Think of it as:

- the user starts at home base on the globe
- the system moves along the sphere in a seeded direction
- the final target point is defined by angular distance, not by a manually assigned latitude number

This avoids awkward numeric latitude logic and better fits the globe metaphor.

## Recommended Mapping

### Time Controls East/West

The selected hour and local-time comparison determine which longitude corridor is eligible.

This answers:

- which part of the world is in a plausible morning state
- which cities qualify as “near 8:00”

### Minutes Control Spherical Distance

Minutes determine how far the system moves away from home base across the globe.

Recommended framing:

- `00` means very close to home base
- `59` means very far from home base
- the effective maximum distance is `180°`

This is important because:

- `0°` means no movement
- `90°` means far from home, but not maximally far
- `180°` means the opposite side of the globe, the furthest possible point
- values beyond `180°` would begin to wrap back toward home, so they are not useful as exploration distance

Recommended mapping:

- map `00-59` minutes onto `0°-180°` spherical distance

Conceptually:

- small minutes = small angular distance
- large minutes = large angular distance
- the end of the minute range represents maximum remoteness from home base

Recommended implementation:

- use a linear mapping

Example formula:

- `distanceDegrees = (minute / 59) * 180`

This means:

- `00` -> `0°`
- `15` -> about `45.8°`
- `30` -> about `91.5°`
- `45` -> about `137.3°`
- `59` -> `180°`

Why linear mapping is a good default:

- it is easy to explain
- it is easy to debug
- every minute step adds a predictable amount of spherical distance
- it matches the intuitive idea that later minutes mean farther from home

### Direction Comes From Odd/Even Date

Minutes should control spherical distance only.

Direction should come from date parity, not from minute.

Recommended rule:

- odd-numbered local date: use the `north arc`
- even-numbered local date: use the `south arc`
- `minute` controls how far along that arc the system travels

This gives the model a very clear rhythm:

- direction stays stable for the entire day
- direction flips only when the date changes
- minute remains responsible only for distance

This avoids the earlier problem where minute tried to control both direction and magnitude.

### Direction Examples

This means direction changes when:

- the local date changes from odd to even
- the local date changes from even to odd

This means direction does not change when:

- the user changes
- only the minute changes
- only the second changes
- the user presses the button again on the same day

Examples:

- `2026-03-27`
  - date is odd
  - direction = `north arc`
- `2026-03-28`
  - date is even
  - direction = `south arc`

So the system has a simple daily rhythm:

- odd day: northern spherical expansion
- even day: southern spherical expansion

This is easy to explain, easy to remember, and easy to debug.

## Recommended Selection Flow

1. Resolve user `home base` coordinates.
2. Compute all cities that are `near 8:00 AM` within a broad acceptable window.
3. Convert current minute into:
   - spherical distance from home base
4. Resolve drift direction from local date:
   - odd day = north arc
   - even day = south arc
5. Project a target point on the sphere:
   - centered on home base
   - moving along the daily north or south arc by the spherical distance
   - still favoring the eligible near-8 longitude corridor
6. Score candidate cities by:
   - closeness to target local time
   - closeness to target spherical point
   - repetition avoidance
   - optional diversity bonus
7. Choose the winning city.

## Worked Examples

Assume:

- user: `YT`
- home base: Taipei
- local date: `2026-03-27`
- date is odd
- direction = `north arc`

Then the same day behaves like this:

- `09:05`
  - near-8 longitude corridor is chosen from the time score
  - minute `05` gives a very short spherical distance from home base
  - linear mapping gives about `15.3°`
  - direction is `north arc`
  - result should stay close to Taipei, only slightly displaced along the northward spherical path

- `09:18`
  - same daily direction: `north arc`
  - minute `18` gives a larger spherical distance
  - linear mapping gives about `54.9°`
  - result should move farther from home than `09:05`, but still remain relatively near the home region

- `09:34`
  - same daily direction: `north arc`
  - minute `34` gives a medium-long spherical distance
  - linear mapping gives about `103.7°`
  - result is now meaningfully farther from home within the same near-8 longitude corridor

- `09:52`
  - same daily direction: `north arc`
  - minute `52` gives a very long spherical distance, approaching the far side of the globe
  - linear mapping gives about `158.6°`
  - result is allowed to reach much more remote candidates if they score well on time and diversity

Now assume the next day:

- user: `YT`
- home base: Taipei
- local date: `2026-03-28`
- date is even
- direction = `south arc`

Then:

- `09:05`
  - still a very short spherical distance
  - but now the system nudges away from home along the southward spherical path

- `09:52`
  - still a very long spherical distance
  - but now the large exploration push happens along the south arc instead of the north arc

This shows the separation clearly:

- `minute` controls how far from home the system moves
- `odd/even date` controls which directional arc the movement uses

## Comparison Example

Same user, same day, same direction:

- `YT`, `2026-03-27`, `09:05`
  - `north arc + very short spherical distance`
- `YT`, `2026-03-27`, `09:55`
  - `north arc + very long spherical distance`

Different day, same user:

- `YT`, `2026-03-27`, `09:55`
  - `north arc + very long spherical distance`
- `YT`, `2026-03-28`, `09:55`
  - `south arc + very long spherical distance`

Different user, same day:

- `YT`, `2026-03-27`, `09:20`
  - `north arc + medium spherical distance`
- `ANNIE`, `2026-03-27`, `09:20`
  - also `north arc + medium spherical distance`

## Why Cap Distance At 180°

This model should operationally cap spherical distance at `180°`.

Reason:

- `180°` is the furthest possible point from home base on a sphere
- beyond `180°`, the path would begin to wrap back toward home
- if minute is supposed to represent “how far from home”, then `180°` is the clean maximum

This makes the minute interpretation elegant:

- earlier minutes = nearer home
- later minutes = farther from home
- end of the minute range = maximum remoteness

## Scoring Philosophy

The final city should not come from a single hard rule. It should come from weighted scoring.

Suggested scoring components:

- `time_score`
  - how close the candidate city is to local `8:00 AM`
- `sphere_score`
  - how close the city is to the intended spherical drift target
- `home_bias_score`
  - how strongly the result should stay near home base
- `novelty_score`
  - whether the city, country, or latitude band was recently repeated
- `latitude_diversity_score`
  - whether the user has recently been stuck in similar latitude ranges

This makes the system feel guided, not mechanical.

## Home Bias Rules

When the user is very near their own local `8:00 AM`, the system should favor their own place.

Recommended hierarchy:

- very near local `8:00`: own city first
- somewhat near local `8:00`: own country first
- moderately far: same region or nearby countries
- far: global exploration

This supports the desired feeling that when the user is closest to morning at home, they are more likely to wake up in their own city or country.

## Latitude Diversity Rules

To avoid repeated same-band results, the system should track recent latitude bands.

Suggested bands:

- equatorial
- low latitude
- subtropical
- temperate
- high latitude
- polar-adjacent

If the last several wakeups cluster inside the same band, apply a diversity bonus to underused bands.

This is a cleaner way to encourage north/south exploration than directly forcing the raw latitude.

## Polar and High-Latitude Handling

Users with high-latitude home bases need special handling.

If a user already lives in a high-latitude or polar-adjacent region, minutes should not endlessly push them toward even more extreme latitudes.

Recommended rule:

- for mid-latitude home bases, drift range expands normally
- for high-latitude home bases, drift compresses near the poles
- when very close to polar limits, part of the drift should rebound back toward more habitable latitudes

This keeps the system exploratory without collapsing into a tiny set of extreme cities.

## Why Ignore Raw Latitude Mapping

Directly mapping minutes to a latitude value like `minute -> 0 to 90` is easy, but not ideal.

Problems:

- it treats the globe as a flat numeric grid
- it disconnects the result from home base
- it behaves awkwardly for users already near high latitudes
- it is harder to explain emotionally

The spherical drift model is better because it says:

- “start from where you are”
- “drift north or south on the globe”
- “stay within a plausible morning corridor”

That is much closer to the WakeUp Map feeling.

## Data Requirements

This model assumes the project already has:

- stable city coordinates from `cities_data.json`
- stable English city and country names from the dataset
- optional stable Chinese names from dataset or reused Notion records

It should not depend on generated city or country text for location identity.

## Practical Implementation Notes

Recommended internal inputs:

- `homeBaseLat`
- `homeBaseLon`
- `currentMinute`
- `currentLocalHour`
- `localDate`
- `userName`
- `candidateCityLocalTime`
- `candidateCityLat`
- `candidateCityLon`

Recommended internal outputs:

- `targetLongitudeBand`
- `targetDriftRadius`
- `targetDriftDirection`
- `targetSphericalPoint`
- `rankedCities`

## Three Tuning Modes

### Conservative

- strong near-8 weighting
- small north/south drift
- high home-country bias

Best for: realism and familiarity

### Balanced

- medium near-8 weighting
- visible north/south drift
- periodic high-latitude exploration

Best for: WakeUp Map default behavior

### Exploratory

- broad near-8 window
- strong spherical drift
- aggressive latitude diversity bonus

Best for: poetic and surprising outputs

## Recommended Default

Use the `Balanced` version:

- keep `near 8:00` as the east/west anchor
- use `minute` for north/south spherical drift
- center all drift around home base
- reuse stable dataset coordinates and names
- add latitude diversity as a soft scoring bonus

This gives the project a stronger world-building logic without losing the recognizable wake-up premise.

## Summary

The proposed system is:

- not strict Earth-time simulation
- not random global jumping
- not raw latitude-number mapping

It is a home-centered spherical drift model where:

- `near 8:00` determines longitude
- `minute` determines spherical distance from home
- `home base` determines the center
- deterministic seed determines direction
- diversity logic keeps the globe feeling alive

This is the most coherent bridge between realism, personalization, and geographic imagination.
