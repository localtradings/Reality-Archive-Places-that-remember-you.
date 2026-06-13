# Homepage + Explore UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage and Explore main content so the product is understandable at a glance, the homepage fits within one desktop viewport as much as practical, remembered-place entry works from both Home and Explore, and the sidebar remains visually untouched.

**Architecture:** Keep the existing shell and sidebar fixed in `ArchiveShell`, replace the homepage body with a compact dedicated component, and redesign Explore as a two-lane control center with a real nearby map plus remembered-place search/manual-add panels. Preserve the current local-first data model, add temporary place origins for `search` and `manual`, and drive the homepage Museum preview from real user state or an honest empty state.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind/global CSS, React Leaflet, Geoapify APIs, localStorage/sessionStorage, local Chrome/browser QA

**Visual references:**
- Approved spec: `docs/superpowers/specs/2026-06-12-homepage-explore-ux-redesign-design.md`
- Approved compact homepage concept: `/Users/lanceianleanillo/.codex/generated_images/019ebaa1-fa9a-7461-9e8f-619fb62b031d/ig_08560881c4f09e6f016a2bcc891dc881919d3c83ac1281e0f6.png`

---

## File Structure

**Modify**
- `app/page.tsx`
  - Homepage route entry; should render the dedicated homepage main-content component only
- `components/HomeLanding.tsx`
  - Compact homepage main area: headline, two actions, real live map preview, Museum preview
- `components/ExploreDiscovery.tsx`
  - Main Explore UX layout, remembered-place search/manual add, nearby map orchestration
- `components/GeoapifyPlaceCard.tsx`
  - Nearby place card copy and CTA clarity
- `components/AddMemoryScreen.tsx`
  - Origin-aware copy for `geoapify`, `search`, and `manual` places
- `components/ArchiveUI.tsx`
  - Only if needed for topbar suppression on the homepage without altering sidebar behavior; avoid changing sidebar markup/styles
- `app/globals.css`
  - Homepage compact layout classes, Explore spacing/hierarchy classes, responsive constraints
- `lib/geoapify.ts`
  - Provider-backed remembered-place search helper
- `lib/place-archive.ts`
  - Temporary place origins, consistent descriptions, search/manual hydration from URL params
- `types/index.ts`
  - Extend `Place.origin` union for `search` and `manual`

**Do not modify for this plan unless blocked**
- `components/ArchiveSidebar` and sidebar nav styles in `components/ArchiveUI.tsx`

**Verification surfaces**
- `/`
- `/explore`
- `/explore?mode=remembered`
- `/place/[id]` for manual/search-created remembered places

---

### Task 1: Compact Homepage Main Area

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/HomeLanding.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Capture failing homepage checks against the approved spec**

Run:

```bash
curl -sS http://localhost:3000 | rg -n "Search places, memories, themes|Explore\\. Remember\\. Preserve\\.|archive-memory|Museum"
```

Expected before fix:
- The old top search bar text still appears
- The old top line still appears
- The homepage content reads as tall and explanatory instead of compact

- [ ] **Step 2: Replace the route entry with the dedicated homepage component**

Use:

```tsx
import { HomeLanding } from '@/components/HomeLanding';

export default function HomePage() {
  return <HomeLanding />;
}
```

in `app/page.tsx`.

- [ ] **Step 3: Build the compact homepage structure in `components/HomeLanding.tsx`**

Implement the homepage body with this shape:

```tsx
<ArchiveShell>
  <section className="archive-home-reframe">
    <div className="archive-home-maincopy">
      <p className="archive-kicker">Home</p>
      <h1 className="archive-title archive-title--compact">
        Keep the places that matter to you.
      </h1>
      <span className="archive-title-rule" aria-hidden="true" />
      <p className="archive-hero-text archive-hero-text--wide">
        Discover somewhere nearby, or bring back a place you still remember from years ago.
      </p>
      <div className="archive-action-row">
        <TornPaperButton href="/explore">Explore nearby</TornPaperButton>
        <TornPaperButton
          href={{ pathname: '/explore', query: { mode: 'remembered' } }}
          tone="dark"
        >
          Add a place you remember
        </TornPaperButton>
      </div>
    </div>

    <InkPanel className="archive-home-preview">
      <ArchiveSectionHeader title="Live map preview" />
      {/* real map preview content goes here in Task 2 */}
    </InkPanel>
  </section>

  <section className="archive-card-grid archive-card-grid--two archive-home-previews">
    {/* compact nearby preview panel */}
    {/* museum preview panel */}
  </section>
</ArchiveShell>
```

Rules:
- No homepage top search bar
- No homepage `Explore. Remember. Preserve.`
- Sidebar remains untouched
- No archive/stats summary container

- [ ] **Step 4: Add compact homepage CSS instead of stretching the page**

Add and use classes like:

```css
.archive-home-reframe {
  display: grid;
  grid-template-columns: minmax(21rem, 0.82fr) minmax(38rem, 1.4fr);
  gap: 1rem;
  align-items: stretch;
}

.archive-home-maincopy {
  padding: 1.25rem 0.5rem 0 0;
}

.archive-title--compact {
  margin-top: 1rem;
  font-size: clamp(3.5rem, 5.6vw, 5.75rem);
}

.archive-hero-text--wide {
  max-width: 30rem;
}
```

Do not change shared sidebar classes while adding these homepage-specific rules.

- [ ] **Step 5: Verify the homepage route still renders and the old topbar text is gone**

Run:

```bash
curl -sS http://localhost:3000 | rg -n "Search places, memories, themes|Explore\\. Remember\\. Preserve\\." || true
```

Expected:
- No matches

Run:

```bash
curl -sS http://localhost:3000 | rg -n "Keep the places that matter to you|Explore nearby|Add a place you remember"
```

Expected:
- All three strings present

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/HomeLanding.tsx app/globals.css
git commit -m "feat: compact homepage main area"
```

---

### Task 2: Real Homepage Live Map Preview + Honest Museum Preview

**Files:**
- Modify: `components/HomeLanding.tsx`
- Modify: `app/globals.css`
- Reuse: `components/DiscoveryMap.tsx`
- Reuse: `lib/visited-places.ts`
- Reuse: `lib/local-memory.ts`

- [ ] **Step 1: Capture failing homepage content expectations**

Run:

```bash
curl -sS http://localhost:3000 | rg -n "Iloilo River Esplanade|Museum|No places yet|Create one"
```

Expected before fix:
- The live map preview may still include a featured place card/name
- Museum preview may not yet be honest/real-state driven

- [ ] **Step 2: Replace the fake homepage map visual with a real map component**

Use a live preview block in `components/HomeLanding.tsx`:

```tsx
<div className="archive-home-preview-grid">
  <div className="archive-home-preview-mapframe">
    <DiscoveryMap center={previewCenter} places={previewPlaces} />
  </div>
  <div className="archive-home-preview-note">
    <p className="archive-kicker">Nearby discovery</p>
    <p>Open Explore to use your live location and save a place into your archive.</p>
  </div>
</div>
```

Rules:
- Do not place a featured visited-place card inside the map preview
- The preview can use a fallback center if the homepage does not request geolocation

- [ ] **Step 3: Build the homepage Museum preview from real user state**

Implement logic like:

```tsx
const [visitedPlaces, setVisitedPlaces] = useState<VisitedPlace[]>([]);

useEffect(() => {
  setVisitedPlaces(readVisitedPlaces());
}, []);

const rememberedPlace = visitedPlaces[0] ?? null;
const rememberedPreview = rememberedPlace ? visitedPlaceToPlace(rememberedPlace) : null;
const rememberedMemoryCount = rememberedPreview ? readLocalMemories(rememberedPreview.id).length : 0;
```

Then render:

```tsx
<InkPanel className="archive-home-secondary-panel">
  <ArchiveSectionHeader title="Museum" href="/museum" action="View all" />
  {rememberedPreview ? (
    <div className="archive-home-mini-card">
      <p className="archive-kicker">{rememberedPreview.category}</p>
      <h3>{rememberedPreview.name}</h3>
      <p>{rememberedPreview.address}</p>
      <div className="archive-chip-row">
        <MuseumPlaque>{rememberedMemoryCount} local memories</MuseumPlaque>
      </div>
    </div>
  ) : (
    <EmptyArchiveState
      icon="▱"
      title="No places yet."
      detail="Create one from Explore and it will appear here."
      action={
        <TornPaperButton href={{ pathname: '/explore', query: { mode: 'remembered' } }} tone="dark">
          Create one
        </TornPaperButton>
      }
    />
  )}
</InkPanel>
```

Rules:
- No fabricated scenic cards
- Use real user-added state when available
- Any future image shown here must come from user-added content

- [ ] **Step 4: Add compact preview CSS that preserves one-screen desktop fit**

Add rules similar to:

```css
.archive-home-preview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(15rem, 0.85fr);
  gap: 1rem;
}

.archive-home-preview-mapframe {
  min-height: 20rem;
  overflow: hidden;
  border: 1px solid var(--archive-line-strong);
  background: #070604;
}

.archive-home-secondary-panel {
  min-height: 14.5rem;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 5: Verify the live map preview is real and the Museum preview is honest**

Run:

```bash
curl -sS http://localhost:3000 | rg -n "Live map preview|Museum|View all|No places yet|Create one"
```

Expected:
- `Live map preview` present
- `Museum` and `View all` present
- Empty-state copy present when no places exist

Then verify in browser QA that:
- a real Leaflet map renders in the homepage preview
- no featured `Iloilo River Esplanade` card appears inside that preview

- [ ] **Step 6: Commit**

```bash
git add components/HomeLanding.tsx app/globals.css
git commit -m "feat: add real homepage map preview and honest museum state"
```

---

### Task 3: Redesign Explore as the Working Control Center

**Files:**
- Modify: `components/ExploreDiscovery.tsx`
- Modify: `components/GeoapifyPlaceCard.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Capture failing Explore checks**

Run:

```bash
curl -sS "http://localhost:3000/explore?mode=remembered" | rg -n "Remembered places|Search by place name|Add manually|Nearby Places Around The Active Position"
```

Expected before fix:
- Missing or poorly grouped remembered-place controls
- Layout hierarchy not matching the approved compact design

- [ ] **Step 2: Rebuild the Explore intro and left-rail grouping**

Use this content structure:

```tsx
<TornPaperCard tone="light" className="archive-page-label archive-page-label--explore">
  <p className="archive-kicker">Explore</p>
  <h1>Find nearby places or bring back old ones.</h1>
  <p>Use the map for nearby discovery, or search and add a place from years ago.</p>
</TornPaperCard>

<InkPanel className={requestedMode === 'remembered' ? 'archive-panel-emphasis' : undefined}>
  <ArchiveSectionHeader title="Remembered places" />
  {/* search form */}
</InkPanel>

<InkPanel className={requestedMode === 'remembered' ? 'archive-panel-emphasis' : undefined}>
  <ArchiveSectionHeader title="Add manually" />
  {/* manual form */}
</InkPanel>

<InkPanel>
  <ArchiveSectionHeader title="Nearby discovery" />
  {/* location status */}
</InkPanel>
```

The goal is clearer spacing and hierarchy, not more content.

- [ ] **Step 3: Implement remembered-place search with local fallback and provider merge**

In `components/ExploreDiscovery.tsx`, implement the layered search path:

```tsx
const localMatches = mockPlaces
  .filter((place) =>
    [place.name, place.address, place.category].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  )
  .map((place) => ({
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    latitude: place.coordinates?.latitude ?? featuredPlace.coordinates?.latitude ?? fallbackCenter.latitude,
    longitude: place.coordinates?.longitude ?? featuredPlace.coordinates?.longitude ?? fallbackCenter.longitude,
  }));

const remotePlaces = await searchGeoapifyPlacesByText({
  apiKey: geoapifyKey,
  text: query,
  center: locationStatus === 'granted' ? center : undefined,
  limit: 5,
});
```

Merge by name/address, prefer local reliability, and show:

```tsx
<button
  key={place.id}
  type="button"
  onClick={() => openRememberedPlace(place, 'search')}
  className="archive-remembered-result"
>
  <span className="archive-kicker">{place.category}</span>
  <strong>{place.name}</strong>
  <small>{place.address}</small>
</button>
```

- [ ] **Step 4: Implement manual-add remembered place flow**

The manual form should validate and then route to a real place archive:

```tsx
function handleManualAdd(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const name = manualName.trim();
  const address = manualAddress.trim();

  if (!name || !address) {
    setManualError('Add both a place name and an address before saving it.');
    return;
  }

  openRememberedPlace(
    {
      id: '',
      name,
      address,
      category: manualCategory,
      latitude: center.latitude,
      longitude: center.longitude,
    },
    'manual',
  );
}
```

- [ ] **Step 5: Tighten Explore spacing and hierarchy with dedicated CSS**

Add rules like:

```css
.archive-panel-emphasis {
  border-color: rgba(216, 200, 174, 0.34);
}

.archive-remembered-form,
.archive-manual-form {
  display: grid;
  gap: 0.9rem;
  margin-top: 1rem;
}

.archive-remembered-results {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

.archive-page-label--explore h1 {
  font-size: clamp(2rem, 2.8vw, 3.1rem);
  line-height: 0.98;
  max-width: 10ch;
}
```

- [ ] **Step 6: Refine nearby place card copy**

Update `components/GeoapifyPlaceCard.tsx` copy to stay direct:

```tsx
<p className="archive-card-copy">
  Nearby discovery from Geoapify. Open it to turn this place into part of your archive.
</p>
```

This should feel less abstract and more product-accurate.

- [ ] **Step 7: Verify Explore desktop behavior**

Run:

```bash
curl -sS "http://localhost:3000/explore?mode=remembered" | rg -n "Remembered places|Add manually|Nearby discovery"
```

Expected:
- All three sections present

Browser QA target:
- remembered-mode opens from the homepage CTA
- search for `Iloilo River Esplanade` returns a visible result
- manual add opens `/place/...` successfully

- [ ] **Step 8: Commit**

```bash
git add components/ExploreDiscovery.tsx components/GeoapifyPlaceCard.tsx app/globals.css
git commit -m "feat: redesign explore for nearby and remembered places"
```

---

### Task 4: Temporary Place Origins, Add-Memory Context, and Final QA

**Files:**
- Modify: `lib/geoapify.ts`
- Modify: `lib/place-archive.ts`
- Modify: `types/index.ts`
- Modify: `components/AddMemoryScreen.tsx`

- [ ] **Step 1: Extend the place origin union**

In `types/index.ts`:

```ts
origin?: 'mock' | 'geoapify' | 'search' | 'manual';
```

- [ ] **Step 2: Add provider-backed remembered-place search helper**

In `lib/geoapify.ts`, keep the autocomplete-backed helper:

```ts
export async function searchGeoapifyPlacesByText({
  apiKey,
  text,
  center,
  limit = 5,
}: GeoapifyPlaceSearchOptions) {
  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('text', text.trim());
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', 'en');

  if (center) {
    url.searchParams.set('bias', `proximity:${center.longitude},${center.latitude}`);
  }
}
```

- [ ] **Step 3: Make temporary places origin-aware and descriptive**

In `lib/place-archive.ts`, keep origin-sensitive descriptions:

```ts
const description =
  origin === 'search'
    ? `A remembered place found from search in ${place.category}.`
    : origin === 'manual'
      ? `A remembered place you added manually under ${place.category}.`
      : `A live nearby place discovered from ${place.category}.`;
```

Also ensure URL-param hydration respects `source`:

```ts
return buildTemporaryPlace(
  {
    id: temporaryPlaceId,
    name,
    address,
    category,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  },
  source === 'manual' || source === 'search' ? source : 'geoapify',
);
```

- [ ] **Step 4: Update add-memory context for remembered places**

In `components/AddMemoryScreen.tsx`, keep origin-specific messaging:

```tsx
setPlaceNote(
  nextPlace.origin === 'geoapify'
    ? 'This is a live nearby place from Explore.'
    : nextPlace.origin === 'search'
      ? 'This place was found from remembered-place search.'
      : nextPlace.origin === 'manual'
        ? 'This place was added manually from memory.'
        : 'This place is already in your archive.',
);
```

Also render the chip label:

```tsx
<MuseumPlaque>
  {isLivePlace ? 'Live nearby place' : isRememberedPlace ? 'Remembered place' : 'Visited archive'}
</MuseumPlaque>
```

- [ ] **Step 5: Run build verification**

Run:

```bash
npm run build
```

Expected:
- Successful production build

If build fails, fix only issues introduced by this plan.

- [ ] **Step 6: Run final desktop/mobile QA**

Desktop QA:

```bash
curl -sS http://localhost:3000 | rg -n "Keep the places that matter to you|Explore nearby|Add a place you remember|Museum|View all"
curl -sS "http://localhost:3000/explore?mode=remembered" | rg -n "Remembered places|Search by place name|Add manually"
```

Browser QA checklist:
- Homepage fits within one desktop viewport as much as practical
- Sidebar looks unchanged
- Homepage top search is gone
- Homepage top slogan is gone
- Homepage live map preview renders a real map
- No featured-place card sits inside the map preview
- Homepage Museum preview shows honest empty state or real user-driven content
- Homepage CTA opens remembered-mode Explore
- Explore spacing is cleaner than before
- Search by built-in name works
- Manual add opens a real place archive
- Mobile homepage remains readable even if it scrolls

- [ ] **Step 7: Commit**

```bash
git add lib/geoapify.ts lib/place-archive.ts types/index.ts components/AddMemoryScreen.tsx
git commit -m "feat: support remembered place origins and final homepage explore polish"
```

---

## Self-Review

### Spec Coverage Check

- Homepage compact one-screen desktop target: covered in Tasks 1 and 2
- Homepage top search removal: covered in Task 1
- Homepage top slogan removal: covered in Task 1
- Real homepage live map preview: covered in Task 2
- No featured place card in live map preview: covered in Task 2
- Museum preview renamed and made honest: covered in Task 2
- Explore spacing/hierarchy redesign: covered in Task 3
- Remembered place entry from Explore: covered in Task 3
- Search + manual add for older places: covered in Task 3
- Origin-aware remembered/manual behavior downstream: covered in Task 4
- Sidebar untouched: enforced across Tasks 1-4

### Placeholder Scan

- No `TODO` or `TBD`
- All referenced files are explicit
- All commands are explicit
- All code-change steps contain concrete code examples

### Type Consistency

- `Place.origin` values: `mock | geoapify | search | manual`
- Search helper name is consistently `searchGeoapifyPlacesByText`
- Remembered-place routing consistently uses `source=search` or `source=manual`

