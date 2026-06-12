# Reality Archive Homepage + Explore UX Redesign

Date: 2026-06-12
Status: Approved design, pending implementation review

## Goal

Make the app understandable at a glance without changing the product concept or touching the existing sidebar. The redesign should make the homepage feel self-explanatory on desktop and make Explore feel like the main working surface for both nearby discovery and older remembered places.

## In Scope

- Redesign the homepage main content area only
- Redesign the Explore page main content area only
- Add a clear remembered-place entry path in both homepage and Explore
- Improve spacing, hierarchy, and first-impression clarity
- Keep the existing product flow: place -> memory -> museum

## Out of Scope

- Sidebar redesign, removal, or relabeling
- Museum page redesign beyond surfaces indirectly affected by new place origin types
- Auth, cloud sync, backend storage, or account systems
- Replacing the core map stack
- Faking user-added images or scenic content
- Mobile no-scroll guarantee

## Product Intent

Reality Archive should read as a place-memory product immediately:

- discover nearby places now
- add an older remembered place by name or manual entry
- save memories to places
- let those places appear in the museum

The app should not depend on explanatory copy blocks, tours, or step-by-step onboarding to be understandable.

## Approved UX Direction

### Homepage

The homepage should fit within a single desktop viewport as much as reasonably possible. It should stop behaving like a tall explanatory landing page and instead act like a compact, readable entry screen.

Required homepage behavior and layout:

- Keep the sidebar exactly as-is
- Remove the top search bar from the homepage
- Remove the top line `Explore. Remember. Preserve.` from the homepage
- Compress the vertical spacing so the main content fits in one desktop screen
- Keep a short headline and one short supporting sentence
- Keep exactly two clear primary actions:
  - `Explore nearby`
  - `Add a place you remember`
- Show a real live map preview in the main preview area
- Do not show a featured visited-place card inside the live map preview
- Remove the archive/stats summary container that previously surfaced counts
- Keep a lower preview section titled `Museum` with `View all`
- If the user has no places yet, the Museum area should show an empty state such as `No places yet` / `Create one`
- If the user has places, the Museum area should reflect actual user-driven data rather than invented scenic cards
- Any image used inside Museum cards must come from user-added content when available; do not fabricate place proof imagery

### Explore

Explore becomes the working control center for two jobs:

- discover nearby places on the live map
- add a place from memory through search or manual entry

Required Explore behavior and layout:

- Keep the sidebar exactly as-is
- Redesign only the main content layout
- Improve spacing and hierarchy so the page feels cleaner and more intentional
- Preserve the nearby live map as a major visual region
- Add a clearly grouped remembered-place section
- Add a clearly grouped manual-add section
- The remembered-place search should support:
  - provider-backed place-name search when Geoapify is available
  - local archive-name fallback so known in-app places are discoverable predictably
- Manual add should let the user create a place archive with:
  - place name
  - address/city
  - category
- Both search and manual-add flows should open a real place archive page

## Data and State Rules

### Sidebar Rule

The sidebar is a fixed surface for this redesign. No implementation work may:

- remove it
- restyle it
- change nav structure
- compress or rebuild it

### Museum Preview Rule

Homepage Museum preview content must be honest:

- no fabricated scenic “user place” cards
- no fake memories presented as user data
- placeholder empty state is preferred until user data exists
- user-provided images are allowed if they already exist in app data

### Place Origin Rule

The app must support distinct temporary origins:

- `geoapify`
- `search`
- `manual`
- existing `mock`

These origins should affect user-facing context only where needed, such as place notes or add-memory messaging.

## Desktop and Mobile Constraints

### Desktop

Homepage should fit within one visible viewport on standard laptop/desktop sizes as much as practical. The intent is “no homepage scroll on desktop” unless a narrow viewport makes that impossible.

### Mobile

Mobile scrolling is allowed. The redesign should remain clean and readable, but mobile is not required to fit the entire homepage into one viewport.

## Technical Approach

### Homepage

- Create a dedicated homepage main-content component rather than continuing to assemble the old homepage directly in `app/page.tsx`
- Use a compact two-column main structure on desktop:
  - left column for headline and actions
  - right column for live map preview
- Add a second row or lower band for Museum preview
- Keep CSS additions scoped to homepage-specific classes

### Explore

- Keep the existing route
- Rework the layout composition inside the Explore component
- Preserve the live map component
- Add remembered-place search and manual-add panels in the left/main control region
- Keep nearby place cards below the main surface

### Search Strategy

Use a layered search approach:

1. Local archive-name matching against built-in mock/archive places
2. Geoapify-backed search when API configuration is available
3. Manual add fallback when search does not find a match

This avoids a brittle experience where landmark-name queries depend entirely on provider ranking.

## Error Handling

- If browser geolocation is unavailable, keep nearby discovery disabled but intact
- If Geoapify key is missing, nearby search and remembered-place remote search should degrade cleanly
- If provider-backed remembered-place search fails, local archive-name fallback should still work when possible
- Manual-add validation must require place name and address/city

## Testing Plan

Verify at minimum:

- homepage loads and remains compact on desktop
- homepage no longer shows the top search bar
- homepage no longer shows the top `Explore. Remember. Preserve.` line
- homepage `Explore nearby` opens Explore
- homepage `Add a place you remember` opens remembered-mode Explore
- Explore shows remembered-place search, manual add, and nearby map in a clean layout
- remembered-place search produces a result for built-in known archive places
- manual add opens a real place archive route
- mobile homepage still renders coherently even if it scrolls

## Risks and Tradeoffs

- A true live map preview on the homepage introduces more visual density and more runtime cost than a static map mock
- Desktop no-scroll depends on disciplined spacing and compact typography; very large copy or extra widgets would break this goal
- Provider-backed place-name search may remain inconsistent for some real-world landmarks, so the local fallback is important
- Honest Museum preview states are visually quieter than fake scenic content, but they are product-correct

## Implementation Notes

- Do not add fake scenic images as user content
- Use Image Gen only for UI/UX assets or supporting visual design assets, not for pretending user place photos exist
- Keep edits localized to homepage and Explore main content whenever possible
- Preserve the current product language around archive, memory, and museum, but reduce excess explanatory clutter
