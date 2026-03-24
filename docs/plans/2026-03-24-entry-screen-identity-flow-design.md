# WakeUp Map Entry Screen And Identity Flow Design

## Goal

Introduce an entry screen that matches the current WakeUp Map visual language and lets a person enter a `userName` before the globe view appears.

The globe should then initialize in that `userName` context so the first visible state already reflects that identity's data.

## Product Decision

`userName` remains the identity key at the data layer.

Rules:

- Data-layer identities should not remix across different names.
- If a `userName` already exists, entering that name should open that existing globe page.
- If a `userName` does not exist yet, entering that name should still allow entry and show an empty state for that identity.
- The first record for a new identity is only created later through `Wake Up Now`.
- This is not a private login system. Anyone who knows a `userName` can open that globe page.

## Entry Screen

The entry screen should follow the existing UI style instead of looking like a traditional login page.

Visual direction:

- White base
- Existing grid / glow / terminal-like typography language
- Strong black display type
- Mono labels similar to `OPERATOR IDENTITY`
- Minimal interaction surface

Suggested structure:

- Product title: `WakeUp Map`
- Small label: `OPERATOR IDENTITY`
- Main input for `userName`
- Primary CTA: `Enter Globe`
- Supporting copy that changes by state

Supporting copy behavior:

- Existing name: `Entering existing wakeup identity`
- New name: `No wakeup records yet. You can create your first wakeup after entering.`

## Identity Flow

### Existing `userName`

If the entered `userName` already has records:

- Skip any error state
- Enter the globe directly
- Initialize the globe in that identity context
- Focus the map on that identity's latest record
- Use only that identity's data for the personal globe view

### New `userName`

If the entered `userName` has no records yet:

- Still allow entry
- Enter the globe in an empty-state identity context
- Do not create a record yet
- Keep `Wake Up Now` as the primary action to create the first record

## Main View Behavior After Entry

After entering through the entry screen:

- `My Wakeup Map` should represent only the chosen `userName`
- The initial globe state should already be scoped to that identity
- The user should still be able to change identity later through an edit / change-name action

For new identities with no records yet:

- Show a clear empty-state message
- Keep the globe on a neutral default view
- Encourage creating the first record through `Wake Up Now`

Suggested empty-state copy:

- `No wakeup records yet. Trigger Wake Up Now to create the first one.`

## Deep Link

Support a direct identity link using query params:

- `?userName=YUTING`

Behavior:

- If the URL contains `userName`, auto-enter that identity context
- Skip the entry screen
- If the `userName` exists, load that globe page
- If the `userName` does not exist, load the empty-state globe page for that identity

This allows:

- Bookmarking a personal globe page
- Returning on another device without manually re-entering the name
- Sharing a public identity page

## Data Rules

The globe page should continue to read identity data by `userName`.

Important constraint:

- The system should treat an existing `userName` as the same identity
- A new identity should only be created if no record currently exists for that `userName`

That means:

- Entry screen lookup is a routing decision
- `Wake Up Now` submission is still the final creation point for brand-new identities

## Edge Cases

### Another person creates the same new `userName` first

Possible flow:

1. User enters a new `userName`
2. User reaches the empty-state globe
3. Before they press `Wake Up Now`, another person creates the first record for that same name

Expected behavior:

- On `Wake Up Now`, run a final existence check
- If the identity now exists, do not fork a new identity
- Treat the session as entering that existing identity instead

### Cross-device reuse

Because the system is intentionally public:

- Re-entering the same `userName` on another device should work
- The same `?userName=...` link should open the same globe page anywhere

## Recommended Implementation Scope

Phase 1:

- Add the entry screen
- Support `?userName=...`
- Initialize the globe in identity context
- Show empty state for new identities
- Keep change-name/edit flow available after entry

Phase 2:

- Add a visible `Copy My Globe Link` action
- Refine empty-state visuals and messaging

## Testing Focus

Verify these behaviors:

- Existing `userName` opens existing globe context
- New `userName` opens empty-state context
- `?userName=...` skips the entry screen
- Personal globe view is scoped to that identity on first render
- New identity can create its first record through `Wake Up Now`
- If the name becomes occupied before first submit, the app resolves to the existing identity instead of creating a duplicate
