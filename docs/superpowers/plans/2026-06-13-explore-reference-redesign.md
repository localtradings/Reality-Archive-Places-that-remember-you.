# Explore Reference Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Explore page to closely match `reference/explore.png` while keeping the current sidebar unchanged, preserving a working live map, real location-biased search results, manual add, and a scrollable Nearby Archives rail.

**Architecture:** Keep the existing `ArchiveShell` and sidebar components. Replace the Explore page body with a reference-matched three-column composition and reuse existing Geoapify, temporary-place, and Leaflet plumbing. Use CSS classes scoped to the Explore page for the parchment frame, antique map treatment, paper-textured cards/buttons, and responsive behavior.

**Tech Stack:** Next.js 14, React 18, TypeScript, Leaflet, React Leaflet, Geoapify Places/Autocomplete, CSS in `app/globals.css`, existing `reference/Paper.png`.

---

## File Map

- Modify `components/ExploreDiscovery.tsx`
  - Owns Explore page state, geolocation, Geoapify nearby places, remembered search, manual add, and the new reference-matched DOM structure.
- Modify `components/DiscoveryMap.tsx`
  - Keeps the live Leaflet map working while adding reference-friendly controls, user marker, and map styling hooks.
- Modify `components/GeoapifyPlaceCard.tsx`
  - Reworks nearby archive cards into compact paper cards matching the right rail in `reference/explore.png`.
- Modify `app/globals.css`
  - Adds/updates Explore-specific layout, map frame, markers, paper buttons/cards, scroll rail, and responsive rules.
- Possibly modify `app/explore/page.tsx`
  - Only if the Suspense fallback needs to hide the global topbar or match the new page shell.

## Safety And Scope

- No database operations.
- No billing, payment, subscription, ads, checkout, or paid API activation.
- No service role keys or secrets.
- No sidebar redesign.
- No changes to Home, Museum, Add Memory, or Place pages except shared CSS only if needed.
- Geoapify remains optional: if `NEXT_PUBLIC_GEOAPIFY_API_KEY` is missing, the UI must not pretend live real results exist.

---

### Task 1: Preserve Shell And Build Reference Page Frame

**Files:**
- Modify `components/ExploreDiscovery.tsx`
- Possibly modify `app/explore/page.tsx`
- Modify `app/globals.css`

- [ ] **Step 1: Hide the global topbar only for Explore**

  Change the Explore shell usage in `ExploreDiscovery.tsx` from:

  ```tsx
  <ArchiveShell>
  ```

  to:

  ```tsx
  <ArchiveShell className="archive-workspace--explore-reference" hideTopbar>
  ```

  Expected result: sidebar remains unchanged, but the Explore content starts with the reference page title instead of the shared topbar.

- [ ] **Step 2: Replace the current return layout with a reference page frame**

  In `ExploreDiscovery.tsx`, replace the current `<ArchiveShell>...</ArchiveShell>` body with this structure:

  ```tsx
  return (
    <ArchiveShell className="archive-workspace--explore-reference" hideTopbar>
      <section className="archive-explore-reference" aria-label="Explore places">
        <header className="archive-explore-reference__header">
          <h1>Explore</h1>
          <p>Find nearby places or bring back old ones.</p>
        </header>

        <section className="archive-explore-reference__grid">
          <aside className="archive-explore-reference__left">
            {/* Remembered Places panel goes here in Task 2 */}
            {/* Manual Add panel goes here in Task 3 */}
          </aside>

          <section className="archive-explore-reference__map" aria-label="Nearby map">
            {/* Working map goes here in Task 4 */}
          </section>

          <aside className="archive-explore-reference__right">
            {/* Scrollable Nearby Archives goes here in Task 5 */}
          </aside>
        </section>

        <footer className="archive-explore-reference__footer">
          <span aria-hidden="true" />
          <p>The past isn&apos;t gone. It&apos;s waiting.</p>
          <span aria-hidden="true" />
        </footer>
      </section>
    </ArchiveShell>
  );
  ```

- [ ] **Step 3: Add base Explore frame CSS**

  Add these classes near the existing Explore CSS in `app/globals.css`:

  ```css
  .archive-workspace--explore-reference {
    min-height: 100svh;
    padding: clamp(1.85rem, 3.4vh, 2.75rem) clamp(1.3rem, 2.6vw, 2.35rem) 1rem;
  }

  .archive-explore-reference {
    min-height: calc(100svh - 3rem);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: clamp(1rem, 2vh, 1.45rem);
    border: 1px solid rgba(228, 211, 181, 0.2);
    padding: clamp(1.15rem, 2vw, 1.7rem);
    background:
      radial-gradient(circle at 67% 8%, rgba(216, 200, 174, 0.08), transparent 11rem),
      linear-gradient(180deg, rgba(5, 5, 3, 0.72), rgba(5, 5, 3, 0.34));
  }

  .archive-explore-reference__header h1 {
    margin: 0;
    color: var(--archive-paper-light);
    font-family: var(--archive-serif);
    font-size: clamp(3.1rem, 5.4vw, 4.85rem);
    line-height: 0.9;
  }

  .archive-explore-reference__header p {
    margin: 0.55rem 0 0;
    color: #d8ad72;
    font-family: var(--archive-serif);
    font-size: clamp(1rem, 1.45vw, 1.2rem);
  }

  .archive-explore-reference__grid {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(18rem, 0.84fr) minmax(32rem, 1.68fr) minmax(18rem, 0.88fr);
    gap: clamp(0.75rem, 1vw, 1rem);
    align-items: stretch;
  }

  .archive-explore-reference__left,
  .archive-explore-reference__right {
    min-height: 0;
    display: grid;
  }

  .archive-explore-reference__left {
    grid-template-rows: minmax(0, auto) minmax(0, auto);
    gap: 0.72rem;
  }

  .archive-explore-reference__footer {
    display: grid;
    grid-template-columns: minmax(4rem, 1fr) auto minmax(4rem, 1fr);
    align-items: center;
    gap: 1.15rem;
    color: #d8ad72;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-family: var(--archive-serif);
    font-size: 0.86rem;
  }

  .archive-explore-reference__footer span {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(216, 173, 114, 0.46), transparent);
  }

  .archive-explore-reference__footer p {
    margin: 0;
  }
  ```

- [ ] **Step 4: Build check**

  Run:

  ```bash
  npm run build
  ```

  Expected: Next.js production build completes without TypeScript or CSS errors.

---

### Task 2: Rebuild Remembered Places Search Panel

**Files:**
- Modify `components/ExploreDiscovery.tsx`
- Modify `app/globals.css`

- [ ] **Step 1: Keep existing search behavior but render reference-matched results**

  Preserve `handleSearch`, `searchGeoapifyPlacesByText`, `openRememberedPlace`, and the `searchResults` state. Render the panel inside `archive-explore-reference__left`:

  ```tsx
  <section className="archive-reference-panel archive-reference-panel--remembered">
    <div className="archive-reference-panel__heading">
      <h2>Remembered Places</h2>
      <span aria-hidden="true" />
    </div>
    <p>Search for a place from your past.</p>

    <form onSubmit={handleSearch} className="archive-reference-search">
      <label className="sr-only" htmlFor="remembered-place-search">
        Search for a place from your past
      </label>
      <span aria-hidden="true">⌕</span>
      <input
        id="remembered-place-search"
        value={searchQuery}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
        placeholder="Molo Mansion or your old cafe"
      />
    </form>

    <div className="archive-reference-results-header">Search Results</div>
    {searchError ? <p className="archive-reference-note">{searchError}</p> : null}
    <div className="archive-reference-search-results">
      {searchResults.slice(0, 4).map((place) => (
        <button
          key={place.id}
          type="button"
          onClick={() => openRememberedPlace(place, 'search')}
          className="archive-reference-search-result"
        >
          <span className="archive-reference-pin" aria-hidden="true">⌖</span>
          <span>
            <strong>{place.name}</strong>
            <small>{place.address}</small>
          </span>
          <em>{formatDistance(place.distanceMeters)}</em>
        </button>
      ))}
    </div>
  </section>
  ```

- [ ] **Step 2: Add a shared distance formatter in `ExploreDiscovery.tsx`**

  Add near the top:

  ```tsx
  function formatDistance(distanceMeters?: number) {
    if (typeof distanceMeters !== 'number' || Number.isNaN(distanceMeters)) {
      return '';
    }

    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)} m`;
    }

    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }
  ```

- [ ] **Step 3: Make Geoapify search results distance-aware**

  In `handleSearch`, after remote search returns, calculate approximate distance from `center` when location is granted. Add this helper:

  ```tsx
  function distanceBetweenMeters(a: Coordinates, b: Coordinates) {
    const earthRadiusMeters = 6_371_000;
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const deltaLatitude = toRadians(b.latitude - a.latitude);
    const deltaLongitude = toRadians(b.longitude - a.longitude);
    const latitudeA = toRadians(a.latitude);
    const latitudeB = toRadians(b.latitude);
    const haversine =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;

    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }
  ```

  Then map remote results with:

  ```tsx
  const remotePlacesWithDistance = remotePlaces.map((place) => ({
    ...place,
    distanceMeters:
      locationStatus === 'granted'
        ? distanceBetweenMeters(center, { latitude: place.latitude, longitude: place.longitude })
        : place.distanceMeters,
  }));
  ```

  Use `remotePlacesWithDistance` for the merge loop.

- [ ] **Step 4: Add CSS for the search panel**

  Add:

  ```css
  .archive-reference-panel {
    min-width: 0;
    border: 1px solid var(--archive-line-strong);
    padding: 1rem;
    background:
      radial-gradient(circle at 0% 0%, rgba(216, 173, 114, 0.06), transparent 10rem),
      rgba(3, 4, 4, 0.72);
    box-shadow: inset 0 0 2rem rgba(0, 0, 0, 0.34);
  }

  .archive-reference-panel__heading {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }

  .archive-reference-panel__heading h2,
  .archive-reference-results-header {
    margin: 0;
    color: #d8ad72;
    font-family: var(--archive-serif);
    font-size: 0.92rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .archive-reference-panel__heading span {
    height: 1px;
    flex: 1;
    background: linear-gradient(90deg, rgba(216, 173, 114, 0.42), transparent);
  }

  .archive-reference-panel p,
  .archive-reference-note {
    margin: 0.65rem 0 0;
    color: var(--archive-paper-light);
    font-family: var(--archive-serif);
    line-height: 1.45;
    font-size: 0.88rem;
  }

  .archive-reference-search {
    height: 2.65rem;
    margin-top: 1rem;
    border: 1px solid rgba(228, 211, 181, 0.22);
    display: flex;
    align-items: center;
    gap: 0.72rem;
    padding: 0 0.8rem;
    background: rgba(255, 255, 255, 0.035);
  }

  .archive-reference-search input {
    min-width: 0;
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--archive-paper-light);
    font-family: var(--archive-serif);
  }

  .archive-reference-results-header {
    margin-top: 1.2rem;
    font-size: 0.78rem;
  }

  .archive-reference-search-results {
    margin-top: 0.55rem;
    overflow: hidden;
    background-image: var(--archive-paper-surface);
    background-size: 100% 100%;
    color: var(--archive-black);
    filter: saturate(0.9) brightness(0.98);
  }

  .archive-reference-search-result {
    width: 100%;
    min-height: 3.65rem;
    border: 0;
    border-bottom: 1px solid rgba(5, 5, 3, 0.18);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.72rem;
    align-items: center;
    padding: 0.58rem 0.9rem;
    color: var(--archive-black);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .archive-reference-search-result strong,
  .archive-reference-search-result small {
    display: block;
  }

  .archive-reference-search-result small {
    margin-top: 0.12rem;
    color: rgba(5, 5, 3, 0.74);
  }

  .archive-reference-search-result em {
    font-style: normal;
    white-space: nowrap;
  }
  ```

- [ ] **Step 5: Build check**

  Run:

  ```bash
  npm run build
  ```

  Expected: build passes.

---

### Task 3: Rebuild Manual Add Panel

**Files:**
- Modify `components/ExploreDiscovery.tsx`
- Modify `app/globals.css`

- [ ] **Step 1: Render Manual Add under Remembered Places**

  Add below the Remembered Places panel:

  ```tsx
  <section className="archive-reference-panel archive-reference-panel--manual">
    <div className="archive-reference-panel__heading">
      <h2>Manual Add</h2>
      <span aria-hidden="true" />
    </div>
    <p>Add a place that isn&apos;t on the map.</p>

    <form onSubmit={handleManualAdd} className="archive-reference-manual-form">
      <label>
        Place name
        <input
          value={manualName}
          onChange={(event) => setManualName(event.target.value)}
          placeholder="e.g., Our Old Townhouse"
        />
      </label>
      <label>
        Address / City
        <input
          value={manualAddress}
          onChange={(event) => setManualAddress(event.target.value)}
          placeholder="e.g., 12 Rizal St, Iloilo City"
        />
      </label>
      <label>
        Category
        <select
          value={manualCategory}
          onChange={(event) => setManualCategory(event.target.value as (typeof rememberedCategories)[number])}
        >
          <option value="">Select a category</option>
          {rememberedCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <TornPaperButton type="submit" tone="dark" className="archive-reference-add-button">
        <span aria-hidden="true">＋</span>
        Add this place
      </TornPaperButton>
      {manualError ? <p className="archive-reference-note">{manualError}</p> : null}
    </form>
  </section>
  ```

- [ ] **Step 2: Confirm manual add still opens temporary place route**

  Keep `handleManualAdd` behavior:

  ```tsx
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
  ```

  Expected: clicking `Add this place` still routes to `/place/[id]` with temporary place query params.

- [ ] **Step 3: Add CSS for manual form**

  Add:

  ```css
  .archive-reference-manual-form {
    display: grid;
    gap: 0.72rem;
    margin-top: 0.8rem;
  }

  .archive-reference-manual-form label {
    display: grid;
    gap: 0.35rem;
    color: var(--archive-paper-light);
    font-family: var(--archive-serif);
    font-size: 0.86rem;
  }

  .archive-reference-manual-form input,
  .archive-reference-manual-form select {
    min-height: 2.35rem;
    width: 100%;
    border: 1px solid rgba(228, 211, 181, 0.18);
    border-radius: 0.2rem;
    padding: 0 0.7rem;
    color: var(--archive-paper-light);
    background: rgba(255, 255, 255, 0.045);
    outline: 0;
  }

  .archive-reference-manual-form input::placeholder {
    color: rgba(228, 211, 181, 0.42);
  }

  .archive-reference-add-button {
    width: 100%;
    min-width: 0;
    min-height: 2.75rem;
    margin-top: 0.2rem;
    color: var(--archive-paper-light);
    background-image:
      linear-gradient(180deg, rgba(54, 96, 72, 0.92), rgba(22, 63, 48, 0.96)),
      var(--archive-paper-surface);
    border: 1px solid rgba(126, 176, 132, 0.36);
    filter: none;
  }
  ```

- [ ] **Step 4: Build check**

  Run:

  ```bash
  npm run build
  ```

  Expected: build passes.

---

### Task 4: Keep Map Working And Match Reference Styling

**Files:**
- Modify `components/ExploreDiscovery.tsx`
- Modify `components/DiscoveryMap.tsx`
- Modify `app/globals.css`

- [ ] **Step 1: Pass user center to the map**

  In the map section render:

  ```tsx
  <DiscoveryMap
    center={center}
    userCenter={locationStatus === 'granted' ? center : null}
    places={nearbyPlaces}
  />
  <div className="archive-reference-map-live">
    <span aria-hidden="true" />
    Live · Updating
  </div>
  ```

- [ ] **Step 2: Keep existing Leaflet behavior**

  Do not replace the live `MapContainer` with an image. Keep `DiscoveryMap` using:

  ```tsx
  <MapContainer
    center={[center.latitude, center.longitude]}
    zoom={14}
    scrollWheelZoom={false}
    className="h-full w-full"
    style={{ height: '100%', width: '100%' }}
  >
  ```

- [ ] **Step 3: Add reference map wrapper CSS**

  Add:

  ```css
  .archive-explore-reference__map {
    position: relative;
    min-height: 0;
    border: 1px solid var(--archive-line-strong);
    padding: 0.35rem;
    background: rgba(216, 173, 114, 0.1);
  }

  .archive-explore-reference__map .leaflet-container {
    height: 100%;
    min-height: 35rem;
    background: #080705;
    filter: saturate(0.42) sepia(0.42) brightness(0.72) contrast(1.15);
  }

  .archive-explore-reference__map .leaflet-tile {
    filter: sepia(0.72) saturate(0.42) brightness(0.66) contrast(1.2);
  }

  .archive-explore-reference__map::after {
    content: "";
    position: absolute;
    inset: 0.35rem;
    z-index: 500;
    pointer-events: none;
    background:
      radial-gradient(circle at 50% 53%, transparent 0 20%, rgba(0, 0, 0, 0.08) 48%, rgba(0, 0, 0, 0.22) 100%),
      repeating-linear-gradient(0deg, rgba(228, 211, 181, 0.025) 0 1px, transparent 1px 7px);
    mix-blend-mode: multiply;
  }

  .archive-reference-map-live {
    position: absolute;
    z-index: 650;
    right: 1.4rem;
    bottom: 1.3rem;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid rgba(228, 211, 181, 0.14);
    border-radius: 0.32rem;
    padding: 0.62rem 0.82rem;
    color: var(--archive-paper-light);
    background: rgba(3, 5, 4, 0.78);
    font-family: var(--archive-serif);
  }

  .archive-reference-map-live span {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: #78c69a;
    box-shadow: 0 0 0.8rem rgba(120, 198, 154, 0.75);
  }
  ```

- [ ] **Step 4: Style markers toward the reference**

  Update existing marker CSS or add scoped overrides:

  ```css
  .archive-explore-reference__map .ra-marker__dot {
    border-color: #d8ad72;
    background: #244e42;
    box-shadow:
      0 0 0 5px rgba(216, 173, 114, 0.16),
      0 0.6rem 1.1rem rgba(0, 0, 0, 0.48);
  }

  .archive-explore-reference__map .leaflet-interactive {
    stroke: #d9ead5 !important;
    fill: #68b788 !important;
    fill-opacity: 0.9 !important;
    filter: drop-shadow(0 0 0.8rem rgba(126, 208, 150, 0.58));
  }
  ```

- [ ] **Step 5: Build check**

  Run:

  ```bash
  npm run build
  ```

  Expected: build passes and map remains rendered by Leaflet.

---

### Task 5: Rebuild Scrollable Nearby Archives

**Files:**
- Modify `components/ExploreDiscovery.tsx`
- Modify `components/GeoapifyPlaceCard.tsx`
- Modify `app/globals.css`

- [ ] **Step 1: Move Nearby Archives into the right rail**

  Replace the separate bottom `archive-content-section` with right-rail content:

  ```tsx
  <section className="archive-reference-nearby">
    <div className="archive-reference-nearby__header">
      <h2>Nearby Archives</h2>
      <button type="button">Nearest⌄</button>
    </div>

    <div className="archive-reference-nearby__scroll" aria-label="Nearby archive results">
      {placesLoading ? (
        <>
          <PlaceSkeleton />
          <PlaceSkeleton />
          <PlaceSkeleton />
        </>
      ) : nearbyPlaces.length > 0 ? (
        nearbyPlaces.map((place, index) => (
          <GeoapifyPlaceCard key={place.id} place={place} index={index + 1} />
        ))
      ) : (
        <EmptyState
          title={geoapifyMissingKey ? 'Connect Geoapify' : 'No nearby archives yet'}
          detail={
            geoapifyMissingKey
              ? 'Add a Geoapify key to show real nearby places.'
              : 'Nearby archives appear here when live place discovery returns results.'
          }
        />
      )}
    </div>

    {nearbyPlaces.length > 0 ? (
      <button type="button" className="archive-reference-view-all">
        View all {nearbyPlaces.length} results <span aria-hidden="true">→</span>
      </button>
    ) : null}
  </section>
  ```

- [ ] **Step 2: Update `GeoapifyPlaceCard` props**

  Change the component signature to:

  ```tsx
  export function GeoapifyPlaceCard({
    place,
    index,
  }: {
    place: GeoapifyNearbyPlace;
    index?: number;
  }) {
  ```

  Render a compact paper card:

  ```tsx
  return (
    <Link
      href={{
        pathname: `/place/${temporaryPlace.id}`,
        query: {
          source: 'geoapify',
          name: place.name,
          address: place.address,
          category: place.category,
          latitude: String(place.latitude),
          longitude: String(place.longitude),
        },
      }}
      onClick={() => storeTemporaryPlace(temporaryPlace)}
      className="archive-reference-nearby-card"
    >
      <div className="archive-reference-nearby-card__top">
        {typeof index === 'number' ? <span>{index}</span> : null}
        <h3>{place.name}</h3>
        <em>{formatDistance(place.distanceMeters)}</em>
      </div>
      <p>{place.address}</p>
      <div className="archive-reference-nearby-card__action">
        Open archive
      </div>
    </Link>
  );
  ```

  Keep the existing temporary-place creation code above this return unchanged.

- [ ] **Step 3: Add right rail CSS**

  Add:

  ```css
  .archive-reference-nearby {
    min-height: 0;
    border: 1px solid var(--archive-line-strong);
    padding: 1rem 0.82rem 0.72rem;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    background: rgba(3, 4, 4, 0.72);
  }

  .archive-reference-nearby__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    padding: 0 0.25rem 0.72rem;
  }

  .archive-reference-nearby__header h2 {
    margin: 0;
    color: #d8ad72;
    font-family: var(--archive-serif);
    font-size: 0.92rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .archive-reference-nearby__header button {
    border: 1px solid rgba(228, 211, 181, 0.18);
    border-radius: 0.2rem;
    color: var(--archive-paper-light);
    background: rgba(255, 255, 255, 0.03);
    padding: 0.42rem 0.58rem;
    font-family: var(--archive-serif);
  }

  .archive-reference-nearby__scroll {
    min-height: 0;
    overflow-y: auto;
    display: grid;
    align-content: start;
    gap: 0.72rem;
    padding: 0.18rem 0.25rem 0.4rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(216, 173, 114, 0.5) rgba(0, 0, 0, 0.18);
  }

  .archive-reference-nearby-card {
    min-height: 8.55rem;
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 0.45rem;
    padding: 1.05rem 1rem;
    color: var(--archive-black);
    background-image: var(--archive-paper-surface);
    background-size: 100% 100%;
    filter: saturate(0.92) brightness(1.01);
  }

  .archive-reference-nearby-card__top {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.55rem;
    align-items: start;
  }

  .archive-reference-nearby-card__top span {
    width: 1.45rem;
    height: 1.45rem;
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: var(--archive-paper-light);
    background: #244e42;
    font-size: 0.72rem;
  }

  .archive-reference-nearby-card h3 {
    margin: 0;
    font-family: var(--archive-serif);
    font-size: 1.06rem;
    line-height: 1.1;
  }

  .archive-reference-nearby-card p {
    margin: 0 0 0 2rem;
    color: rgba(5, 5, 3, 0.8);
    line-height: 1.35;
  }

  .archive-reference-nearby-card em {
    font-style: normal;
    white-space: nowrap;
  }

  .archive-reference-nearby-card__action {
    align-self: end;
    justify-self: end;
    border-radius: 0.22rem;
    padding: 0.48rem 0.72rem;
    color: var(--archive-paper-light);
    background: #244e42;
    font-family: var(--archive-serif);
    font-size: 0.84rem;
  }

  .archive-reference-view-all {
    border: 0;
    padding: 0.74rem 0.25rem 0.15rem;
    color: #d8ad72;
    background: transparent;
    display: flex;
    justify-content: space-between;
    font-family: var(--archive-serif);
    cursor: pointer;
  }
  ```

- [ ] **Step 4: Build check**

  Run:

  ```bash
  npm run build
  ```

  Expected: build passes and the right rail alone scrolls when there are enough nearby archives.

---

### Task 6: Responsive Behavior And Visual Verification

**Files:**
- Modify `app/globals.css`

- [ ] **Step 1: Add responsive rules**

  Add:

  ```css
  @media (max-width: 1280px) {
    .archive-explore-reference__grid {
      grid-template-columns: minmax(17rem, 0.85fr) minmax(28rem, 1.5fr);
    }

    .archive-explore-reference__right {
      grid-column: 1 / -1;
      min-height: 20rem;
    }
  }

  @media (max-width: 860px) {
    .archive-workspace--explore-reference {
      padding: 1rem;
    }

    .archive-explore-reference {
      min-height: auto;
      padding: 1rem;
    }

    .archive-explore-reference__grid {
      grid-template-columns: 1fr;
    }

    .archive-explore-reference__map {
      min-height: 22rem;
    }

    .archive-explore-reference__map .leaflet-container {
      min-height: 22rem;
    }

    .archive-reference-nearby__scroll {
      max-height: 28rem;
    }
  }
  ```

- [ ] **Step 2: Start dev server**

  Run:

  ```bash
  npm run dev
  ```

  Expected: Next.js dev server starts, usually at `http://localhost:3000`.

- [ ] **Step 3: Verify in browser against reference**

  Open:

  ```text
  http://localhost:3000/explore
  ```

  Verify:

  - Sidebar is unchanged.
  - Explore title/subtitle placement matches `reference/explore.png`.
  - Left remembered/manual panels match the reference proportions.
  - Center map is live and styled antique.
  - Nearby Archives is the only dedicated scroll rail.
  - `Paper.png` texture appears on nearby cards and buttons.
  - No topbar appears above the Explore title.
  - No billing/payment/subscription UI appears.

- [ ] **Step 4: Take one correction pass**

  If visual mismatch is obvious, tune only these CSS values:

  ```css
  .archive-explore-reference__grid { grid-template-columns: ...; }
  .archive-explore-reference__header h1 { font-size: ...; }
  .archive-reference-panel { padding: ...; }
  .archive-reference-nearby-card { min-height: ...; padding: ...; }
  .archive-explore-reference__map .leaflet-container { min-height: ...; }
  ```

- [ ] **Step 5: Final build**

  Run:

  ```bash
  npm run build
  ```

  Expected: production build passes.

## Self-Review

- Spec coverage:
  - Reference image: covered by Tasks 1, 4, 5, 6.
  - Sidebar unchanged: covered by Task 1 and verification in Task 6.
  - Paper buttons/cards: covered by Tasks 3 and 5.
  - Working map: covered by Task 4.
  - Real remembered search results: covered by Task 2 using existing Geoapify autocomplete.
  - Nearby Archives scrollable: covered by Task 5.
  - No code outside Explore scope: covered by File Map and Safety And Scope.
- Placeholder scan: no unresolved placeholder wording remains.
- Type consistency: `GeoapifyNearbyPlace`, `Coordinates`, `locationStatus`, `center`, and existing temporary-place helpers are reused from current files.
