'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import {
  ArchiveSectionHeader,
  ArchiveShell,
  EmptyArchiveState,
  InkPanel,
  MuseumPlaque,
  TornPaperButton,
  TornPaperCard,
} from '@/components/ArchiveUI';
import { mockPlaces } from '@/data/mockPlaces';
import { GeoapifyPlaceCard } from '@/components/GeoapifyPlaceCard';
import { fetchGeoapifyNearbyPlaces, searchGeoapifyPlacesByText } from '@/lib/geoapify';
import { buildTemporaryPlace, buildTemporaryPlaceId, type GeoapifyNearbyPlace } from '@/lib/place-archive';
import { storeTemporaryPlace } from '@/lib/place-archive';
import { recordVisitedPlace } from '@/lib/visited-places';
import type { Coordinates } from '@/types';

const fallbackCenter: Coordinates = {
  latitude: 10.7202,
  longitude: 122.5621,
};

const rememberedCategories = ['Historic Street', 'Heritage House', 'Religious Landmark', 'Riverfront Walk', 'Cafe', 'Park', 'Museum', 'Neighborhood'] as const;
type RememberedCategory = (typeof rememberedCategories)[number];
type ManualCategory = '' | RememberedCategory;
type RememberedSearchResult =
  | {
      kind: 'local';
      id: string;
      name: string;
      address: string;
      category: string;
    }
  | ({
      kind: 'remote';
    } & GeoapifyNearbyPlace);

function isRememberedCategory(value: string): value is RememberedCategory {
  return (rememberedCategories as readonly string[]).includes(value);
}

// Remembered Places search is visible, so location can bias search and distance labels.
const enableExploreLocationSideEffects = true;

const DiscoveryMap = dynamic(
  () => import('@/components/DiscoveryMap').then((module) => module.DiscoveryMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-black/30" />,
  },
);

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error';

function statusCopy(status: LocationStatus) {
  switch (status) {
    case 'requesting':
      return {
        label: 'Requesting location',
        detail: 'Allow browser location access so nearby places can appear on the map.',
      };
    case 'granted':
      return {
        label: 'Using live location',
        detail: 'The map is centered on your current position.',
      };
    case 'denied':
      return {
        label: 'Location permission off',
        detail: 'Nearby discovery is paused until browser location is enabled.',
      };
    case 'unavailable':
      return {
        label: 'Location unavailable',
        detail: 'This browser cannot provide geolocation right now.',
      };
    case 'error':
      return {
        label: 'Location unresolved',
        detail: 'The browser could not resolve your position. Try again to load nearby places.',
      };
    default:
      return {
        label: 'Waiting for location',
        detail: 'The browser will ask for permission when the page loads.',
      };
  }
}

function formatDistance(distanceMeters?: number) {
  if (typeof distanceMeters !== 'number' || Number.isNaN(distanceMeters)) {
    return '';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

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

function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return <EmptyArchiveState icon="⌖" title={title} detail={detail} action={action} />;
}

function PlaceSkeleton() {
  return (
    <div className="torn-paper torn-paper-dark archive-place-card archive-skeleton">
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}

export function ExploreDiscovery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const requestedQuery = searchParams.get('q') ?? '';
  const rememberedMode = requestedMode === 'remembered';

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [center, setCenter] = useState<Coordinates>(fallbackCenter);
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [nearbyAttempt, setNearbyAttempt] = useState(0);
  const [nearbyPlaces, setNearbyPlaces] = useState<GeoapifyNearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(requestedQuery);
  const [searchResults, setSearchResults] = useState<RememberedSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualCategory, setManualCategory] = useState<ManualCategory>('');
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const searchControllerRef = useRef<AbortController | null>(null);
  const manualControllerRef = useRef<AbortController | null>(null);
  const hasResolvedCenter =
    locationStatus === 'granted' &&
    Number.isFinite(center.latitude) &&
    Number.isFinite(center.longitude);

  useEffect(() => {
    setSearchQuery(requestedQuery);
  }, [requestedQuery]);

  useEffect(
    () => () => {
      searchControllerRef.current?.abort();
      manualControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!enableExploreLocationSideEffects) {
      setLocationStatus('idle');
      return;
    }

    let cancelled = false;
    setLocationStatus('requesting');

    if (!('geolocation' in navigator)) {
      setLocationStatus('unavailable');
      setCenter(fallbackCenter);
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) {
          return;
        }

        setLocationStatus('granted');
        setCenter({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (cancelled) {
          return;
        }

        setCenter(fallbackCenter);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          return;
        }

        setLocationStatus('error');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 12_000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [locationAttempt]);

  useEffect(() => {
    if (locationStatus !== 'granted' || !hasResolvedCenter) {
      setNearbyPlaces([]);
      setPlacesLoading(false);
      setPlacesError(
        locationStatus === 'denied'
          ? 'Nearby discovery needs location permission.'
          : locationStatus === 'unavailable'
            ? 'Nearby discovery is unavailable in this browser.'
            : locationStatus === 'error'
              ? 'Nearby discovery could not resolve your location.'
              : locationStatus === 'granted'
                ? 'Nearby discovery does not have a resolved location yet.'
              : null,
      );
      return;
    }

    const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
    if (!geoapifyKey) {
      setNearbyPlaces([]);
      setPlacesLoading(false);
      setPlacesError('Add NEXT_PUBLIC_GEOAPIFY_API_KEY to .env.local to load live nearby places.');
      return;
    }

    const controller = new AbortController();

    async function loadPlaces() {
      try {
        setPlacesLoading(true);
        setPlacesError(null);
        const places = await fetchGeoapifyNearbyPlaces({
          apiKey: geoapifyKey,
          center,
          radiusMeters: 6500,
          limit: 8,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setNearbyPlaces(places);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setNearbyPlaces([]);
          setPlacesError(error instanceof Error ? error.message : 'Unable to load live nearby places.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setPlacesLoading(false);
        }
      }
    }

    void loadPlaces();

    return () => {
      controller.abort();
    };
  }, [center.latitude, center.longitude, hasResolvedCenter, locationStatus, nearbyAttempt]);

  const locationCopy = useMemo(() => statusCopy(locationStatus), [locationStatus]);
  const isUsingFallbackDiscovery = locationStatus === 'denied' || locationStatus === 'unavailable' || locationStatus === 'error';
  const geoapifyMissingKey = placesError?.includes('NEXT_PUBLIC_GEOAPIFY_API_KEY') ?? false;
  const nearbyPlacesByDistance = useMemo(
    () =>
      nearbyPlaces
        .map((place, originalIndex) => ({ place, originalIndex }))
        .sort((a, b) => {
          const distanceA =
            typeof a.place.distanceMeters === 'number' && Number.isFinite(a.place.distanceMeters)
              ? a.place.distanceMeters
              : Number.POSITIVE_INFINITY;
          const distanceB =
            typeof b.place.distanceMeters === 'number' && Number.isFinite(b.place.distanceMeters)
              ? b.place.distanceMeters
              : Number.POSITIVE_INFINITY;

          return distanceA - distanceB || a.originalIndex - b.originalIndex;
        })
        .map(({ place }) => place),
    [nearbyPlaces],
  );
  const mapStatusLabel =
    locationStatus === 'requesting' || locationStatus === 'idle'
      ? 'Finding location'
      : locationStatus === 'denied'
        ? 'Location permission off'
        : locationStatus === 'unavailable'
          ? 'Location unavailable'
          : locationStatus === 'error'
            ? 'Location unresolved'
            : geoapifyMissingKey
              ? 'Geoapify key missing'
              : placesLoading
                ? 'Live · Updating'
                : placesError
                  ? 'Live · Update paused'
                  : 'Live · Updated';
  const mapStatusState =
    locationStatus === 'granted' && !geoapifyMissingKey && !placesError
      ? 'live'
      : locationStatus === 'requesting' || locationStatus === 'idle'
        ? 'pending'
        : 'inactive';
  const nearbyResultLabel = placesLoading
    ? 'Loading nearby places.'
    : locationStatus === 'requesting' || locationStatus === 'idle'
      ? 'Finding your location for nearby archives.'
    : nearbyPlaces.length > 0
      ? `${nearbyPlaces.length} nearby archive results shown, ordered nearest first.`
      : geoapifyMissingKey
        ? 'Nearby archives require a Geoapify key.'
        : locationStatus === 'denied'
          ? 'Nearby archives require location permission.'
          : locationStatus === 'unavailable'
            ? 'Nearby discovery is unavailable in this browser.'
            : locationStatus === 'error'
              ? 'Nearby discovery could not resolve your location.'
              : placesError
                ? `Nearby discovery error: ${placesError}`
                : 'No nearby archives found.';
  const rememberedResultLabel = searchLoading ? 'Searching' : searchResults.length > 0 ? `${searchResults.length} results` : 'Search first';
  const rememberedSearchStatus = searchLoading
    ? 'Searching remembered places.'
    : searchError
      ? searchError
      : searchResults.length > 0
        ? `${Math.min(searchResults.length, 4)} remembered place results shown.`
        : 'No remembered place results shown yet.';
  const manualErrorId = 'manual-add-error';

  function retryNearbyDiscovery() {
    if (locationStatus === 'granted' && hasResolvedCenter) {
      setNearbyAttempt((attempt) => attempt + 1);
      return;
    }

    setLocationAttempt((attempt) => attempt + 1);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchControllerRef.current?.abort();
    searchControllerRef.current = null;
    setSearchLoading(false);
    setSearchError('');

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError('Type a place name to search for a remembered place.');
      return;
    }

    const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
    const normalizedQuery = query.toLowerCase();
    const localMatches = mockPlaces
      .filter((place) =>
        [place.name, place.address, place.category].some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
      .map((place) => ({
        kind: 'local' as const,
        id: place.id,
        name: place.name,
        address: place.address,
        category: place.category,
      }));

    if (!geoapifyKey) {
      setSearchResults(localMatches);
      setSearchError(localMatches.length === 0 ? 'Add NEXT_PUBLIC_GEOAPIFY_API_KEY to .env.local to search beyond the built-in archive places.' : '');
      return;
    }

    const controller = new AbortController();
    searchControllerRef.current = controller;

    try {
      setSearchLoading(true);
      const remotePlaces = await searchGeoapifyPlacesByText({
        apiKey: geoapifyKey,
        text: query,
        center: hasResolvedCenter ? center : undefined,
        limit: 5,
        signal: controller.signal,
      });
      const remotePlacesWithDistance = remotePlaces.map((place) => ({
        ...place,
        kind: 'remote' as const,
        distanceMeters:
          hasResolvedCenter
            ? distanceBetweenMeters(center, { latitude: place.latitude, longitude: place.longitude })
            : place.distanceMeters,
      }));
      const merged: RememberedSearchResult[] = [...localMatches];
      for (const place of remotePlacesWithDistance) {
        if (!merged.some((item) => item.name === place.name && item.address === place.address)) {
          merged.push(place);
        }
      }
      setSearchResults(merged);
      if (merged.length === 0) {
        setSearchError('No matching places were found. Try a more specific name or add it manually.');
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setSearchResults(localMatches);
      setSearchError(localMatches.length === 0 ? error instanceof Error ? error.message : 'Search failed.' : '');
    } finally {
      if (searchControllerRef.current === controller) {
        searchControllerRef.current = null;
        setSearchLoading(false);
      }
    }
  }

  function openRememberedSearchResult(place: RememberedSearchResult) {
    if (place.kind === 'local') {
      router.push(`/add-memory?place=${encodeURIComponent(place.id)}`);
      return;
    }

    openRememberedPlace(place, 'search');
  }

  function openRememberedPlace(place: GeoapifyNearbyPlace, origin: 'search' | 'manual') {
    const temporaryPlaceId = buildTemporaryPlaceId(place);
    const temporaryPlace = buildTemporaryPlace(
      {
        ...place,
        id: temporaryPlaceId,
      },
      origin,
    );
    storeTemporaryPlace(temporaryPlace);
    const params = new URLSearchParams({
      source: origin,
      name: place.name,
      address: place.address,
      category: place.category,
      latitude: String(place.latitude),
      longitude: String(place.longitude),
    });
    recordVisitedPlace(temporaryPlace);
    params.set('place', temporaryPlace.id);
    router.push(`/add-memory?${params.toString()}`);
  }

  async function handleManualAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (manualLoading) {
      return;
    }

    setManualError('');

    const name = manualName.trim();
    const address = manualAddress.trim();
    const category = manualCategory;
    if (!name || !address) {
      setManualError('Add both a place name and an address before saving it.');
      return;
    }
    if (!isRememberedCategory(category)) {
      setManualError('Choose a category before saving this place.');
      return;
    }

    const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
    if (!geoapifyKey) {
      setManualError('Manual add needs NEXT_PUBLIC_GEOAPIFY_API_KEY to resolve the address. Use search results if available.');
      return;
    }

    const controller = new AbortController();
    manualControllerRef.current = controller;

    try {
      setManualLoading(true);
      const geocodedPlaces = await searchGeoapifyPlacesByText({
        apiKey: geoapifyKey,
        text: `${name}, ${address}`,
        center: hasResolvedCenter ? center : undefined,
        limit: 1,
        signal: controller.signal,
      });
      const geocodedPlace = geocodedPlaces[0];

      if (!geocodedPlace) {
        setManualError('Could not resolve that address. Try a more specific address or use a search result if available.');
        return;
      }

      openRememberedPlace(
        {
          id: '',
          name,
          address,
          category,
          latitude: geocodedPlace.latitude,
          longitude: geocodedPlace.longitude,
        },
        'manual',
      );
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      setManualError('Manual add could not resolve that address right now. Try again or use a search result if available.');
    } finally {
      if (manualControllerRef.current === controller) {
        manualControllerRef.current = null;
        setManualLoading(false);
      }
    }
  }

  return (
    <ArchiveShell className="archive-workspace--explore-reference" hideTopbar>
      <section className="archive-explore-reference" aria-label="Explore places">
        <header className="archive-explore-reference__header">
          <h1>Explore</h1>
          <p>Find nearby places or bring back old ones.</p>
        </header>

        <section className="archive-explore-reference__grid" aria-label="Explore workspace preview">
          <aside className="archive-explore-reference__left" aria-label="Remembered place tools">
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
              <div className="sr-only" aria-live="polite" aria-atomic="true">
                {rememberedSearchStatus}
              </div>
              {searchError ? <p className="archive-reference-note">{searchError}</p> : null}
              {searchResults.length > 0 ? (
                <div className="archive-reference-search-results">
                  {searchResults.slice(0, 4).map((place) => {
                    const distanceLabel =
                      place.kind === 'remote' ? formatDistance(place.distanceMeters) : '';

                    return (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => openRememberedSearchResult(place)}
                        className="archive-reference-search-result"
                      >
                        <span className="archive-reference-pin" aria-hidden="true">
                          ⌖
                        </span>
                        <span>
                          <strong>{place.name}</strong>
                          <small>{place.address}</small>
                        </span>
                        {distanceLabel ? <em>{distanceLabel}</em> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
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
                    required
                    aria-invalid={manualError ? 'true' : undefined}
                    aria-describedby={manualError ? manualErrorId : undefined}
                  />
                </label>
                <label>
                  Address / City
                  <input
                    value={manualAddress}
                    onChange={(event) => setManualAddress(event.target.value)}
                    placeholder="e.g., 12 Rizal St, Iloilo City"
                    required
                    aria-invalid={manualError ? 'true' : undefined}
                    aria-describedby={manualError ? manualErrorId : undefined}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={manualCategory}
                    onChange={(event) => {
                      const value = event.target.value;
                      setManualCategory(isRememberedCategory(value) ? value : '');
                    }}
                    required
                    aria-invalid={manualError ? 'true' : undefined}
                    aria-describedby={manualError ? manualErrorId : undefined}
                  >
                    <option value="">Select a category</option>
                    {rememberedCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <TornPaperButton
                  type="submit"
                  tone="dark"
                  className="archive-reference-add-button"
                  disabled={manualLoading}
                >
                  <span aria-hidden="true">＋</span>
                  {manualLoading ? 'Resolving place…' : 'Add this place'}
                </TornPaperButton>
                {manualError ? (
                  <p id={manualErrorId} className="archive-reference-note" role="status" aria-live="polite">
                    {manualError}
                  </p>
                ) : null}
              </form>
            </section>
          </aside>

          <section className="archive-explore-reference__map" aria-label="Nearby map">
            <DiscoveryMap
              center={center}
              userCenter={hasResolvedCenter ? center : null}
              places={nearbyPlaces}
            />
            <div
              className="archive-reference-map-live"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-state={mapStatusState}
            >
              <span aria-hidden="true" />
              {mapStatusLabel}
            </div>
          </section>

          <aside className="archive-explore-reference__right" aria-label="Nearby archives">
            <section className="archive-reference-nearby">
              <div className="archive-reference-nearby__header">
                <h2>Nearby Archives</h2>
                <span className="archive-reference-nearby__sort">
                  Nearest⌄
                </span>
              </div>

              <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {nearbyResultLabel}
              </div>
              <div
                className="archive-reference-nearby__scroll"
                aria-label="Nearby archive results"
                aria-busy={placesLoading}
              >
                {placesLoading ? (
                  <>
                    <PlaceSkeleton />
                    <PlaceSkeleton />
                    <PlaceSkeleton />
                  </>
                ) : nearbyPlacesByDistance.length > 0 ? (
                  nearbyPlacesByDistance.map((place, index) => (
                    <GeoapifyPlaceCard key={place.id} place={place} index={index + 1} />
                  ))
                ) : geoapifyMissingKey ? (
                  <EmptyState
                    title="Connect Geoapify"
                    detail="Add a Geoapify key to show real nearby places."
                  />
                ) : locationStatus === 'denied' ? (
                  <EmptyState
                    title="Location access required"
                    detail="Allow browser location access to discover nearby archives."
                    action={
                      <button type="button" className="archive-reference-retry" onClick={retryNearbyDiscovery}>
                        Retry location
                      </button>
                    }
                  />
                ) : locationStatus === 'unavailable' ? (
                  <EmptyState
                    title="Nearby discovery unavailable"
                    detail="This browser cannot provide the location needed for nearby archives."
                  />
                ) : locationStatus === 'error' ? (
                  <EmptyState
                    title="Location unresolved"
                    detail="Nearby discovery could not resolve your location."
                    action={
                      <button type="button" className="archive-reference-retry" onClick={retryNearbyDiscovery}>
                        Retry location
                      </button>
                    }
                  />
                ) : locationStatus === 'requesting' || locationStatus === 'idle' ? (
                  <EmptyState
                    title="Finding your location"
                    detail="Nearby archives will appear after the browser resolves your location."
                  />
                ) : placesError ? (
                  <EmptyState
                    title="Nearby discovery paused"
                    detail={placesError}
                    action={
                      <button type="button" className="archive-reference-retry" onClick={retryNearbyDiscovery}>
                        Retry nearby places
                      </button>
                    }
                  />
                ) : (
                  <EmptyState
                    title="No nearby archives yet"
                    detail="Nearby archives appear here when live place discovery returns results."
                  />
                )}
              </div>

              {nearbyPlacesByDistance.length > 0 ? (
                <div className="archive-reference-view-all">
                  Showing all {nearbyPlacesByDistance.length} results <span aria-hidden="true">→</span>
                </div>
              ) : null}
            </section>
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
}
