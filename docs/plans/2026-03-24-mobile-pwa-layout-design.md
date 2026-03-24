# Wakeup Map Mobile PWA Layout Design

## Goal

Make the mobile experience feel intentional and app-like without changing the established Wakeup Map visual language.

The mobile layout should:

- avoid iPhone safe-area overlaps
- keep the globe visually centered
- preserve readability of the main content
- support installation as a PWA / home-screen experience

## Design Principles

- Keep the same black / white / neon green visual system
- Keep the same editorial / system-archive typography tone
- Reflow the layout for mobile rather than shrinking the desktop composition
- Treat the globe as the primary mobile-stage element
- Respect safe-area insets on top and bottom

## Mobile Main View

The mobile main view should become a three-zone layout:

### 1. Safe-Area Top Bar

Contains:

- current `userName`
- language toggle

Purpose:

- lift controls out of the visual content stack
- avoid collisions with the iPhone notch / Safari chrome

### 2. Main Stage

Contains:

- compact Wakeup Map title and subtitle
- globe as the primary visual focus

Rules:

- title block should be smaller than desktop
- globe should sit in the visual center of the available stage
- the globe can be nudged downward on mobile if needed to compensate for the fixed bottom controls

### 3. Lower Control Zone

Contains:

- map mode switcher
- bottom fixed navigation / Wake Up Now controls

Rules:

- these controls must be accounted for in layout spacing, not merely overlaid
- the globe stage should reserve vertical space for them

## Mobile Edge Pages

### Review Journal

- header stack from the main page should slide away
- language toggle should be hidden on small screens
- journal content should own the screen

### City / Group Detail

- language toggle should be hidden on small screens
- globe / background should retreat enough to stop interfering with reading
- returning with the left arrow should always land on the center main page

## PWA Behavior

Add a minimal but functional PWA setup:

- `manifest.webmanifest`
- standalone display mode
- app name `Wakeup Map`
- theme color aligned with the current white / neon palette
- iOS-friendly meta tags
- service worker registration

This should improve the "add to home screen" experience while still keeping the standard Safari experience usable.

## Non-Goals

- No separate mobile-only visual theme
- No native-style tab bar redesign
- No major rewrite of desktop layout

## Testing Focus

- safe-area controls stay visible on iPhone-sized screens
- language toggle is hidden on mobile edge pages
- mobile globe appears visually centered in the main view
- adding to home screen gets a proper standalone title/icon/manifest path
