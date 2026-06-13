'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  ArchiveShell,
  EmptyArchiveState,
  TornPaperButton,
} from '@/components/ArchiveUI';
import { readLocalMemories, type SavedMemory } from '@/lib/local-memory';
import type { GeoapifyNearbyPlace } from '@/lib/place-archive';
import { readVisitedPlaces, visitedPlaceToPlace, type VisitedPlace } from '@/lib/visited-places';
import type { Coordinates, Place } from '@/types';

const DiscoveryMap = dynamic(
  () => import('@/components/DiscoveryMap').then((module) => module.DiscoveryMap),
  {
    ssr: false,
    loading: () => <div className="archive-home-preview-map-loading" aria-hidden="true" />,
  },
);

const homepageFallbackCenter: Coordinates = {
  latitude: 10.7202,
  longitude: 122.5621,
};

function visitedPlaceToPreviewPlace(place: VisitedPlace): GeoapifyNearbyPlace | null {
  if (!place.coordinates) {
    return null;
  }

  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    latitude: place.coordinates.latitude,
    longitude: place.coordinates.longitude,
  };
}

function formatCardDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Saved locally';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function MuseumIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="archive-home-museum-icon">
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 10h14" />
      <path d="M7 10v8" />
      <path d="M12 10v8" />
      <path d="M17 10v8" />
      <path d="M4 18h16" />
      <path d="M3 21h18" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="archive-button-icon">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.6 8.4-2.2 5-5 2.2 2.2-5 5-2.2Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="archive-button-icon">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function findPhotoMemory(memories: SavedMemory[]) {
  return memories.find((memory) => memory.type === 'photo' && memory.imageDataUrl);
}

export function HomeLanding() {
  const [visitedPlaces, setVisitedPlaces] = useState<VisitedPlace[]>([]);
  const [liveCenter, setLiveCenter] = useState<Coordinates | null>(null);
  const [mapStatus, setMapStatus] = useState('Finding your location');

  useEffect(() => {
    setVisitedPlaces(readVisitedPlaces());
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setMapStatus('Location unavailable');
      return;
    }

    const handleLocation = (position: GeolocationPosition) => {
      setLiveCenter({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setMapStatus('Live map');
    };

    const handleLocationError = () => {
      setLiveCenter(null);
      setMapStatus('Allow location access');
    };

    navigator.geolocation.getCurrentPosition(handleLocation, handleLocationError, {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 10_000,
    });

    const watchId = navigator.geolocation.watchPosition(
      handleLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 10_000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const rememberedPlace = useMemo(() => visitedPlaces[0] ?? null, [visitedPlaces]);
  const rememberedPreview: Place | null = rememberedPlace ? visitedPlaceToPlace(rememberedPlace) : null;
  const museumCards = useMemo(
    () =>
      visitedPlaces.slice(0, 5).map((visitedPlace) => {
        const place = visitedPlaceToPlace(visitedPlace);
        const memories = readLocalMemories(place.id);
        const photoMemory = findPhotoMemory(memories);
        const latestMemory = memories[0] ?? null;

        return {
          id: place.id,
          title: place.name,
          location: place.address,
          note: latestMemory?.text ?? 'Add a memory to give this place its first story.',
          date: formatCardDate(latestMemory?.createdAt ?? visitedPlace.lastVisitedAt),
          imageDataUrl: photoMemory?.imageDataUrl,
          imageAlt: photoMemory?.photoCaption || latestMemory?.text || place.name,
        };
      }),
    [visitedPlaces],
  );
  const previewPlaces = useMemo(
    () => visitedPlaces.map(visitedPlaceToPreviewPlace).filter((place): place is GeoapifyNearbyPlace => place !== null).slice(0, 6),
    [visitedPlaces],
  );
  const previewCenter = useMemo<Coordinates>(() => {
    const firstPreviewPlace = previewPlaces[0];
    if (liveCenter) {
      return liveCenter;
    }

    if (firstPreviewPlace) {
      return {
        latitude: firstPreviewPlace.latitude,
        longitude: firstPreviewPlace.longitude,
      };
    }

    if (rememberedPreview?.coordinates) {
      return rememberedPreview.coordinates;
    }

    return homepageFallbackCenter;
  }, [liveCenter, previewPlaces, rememberedPreview]);

  return (
    <ArchiveShell className="archive-workspace--home" hideTopbar>
      <section className="archive-home-reframe">
        <div className="archive-home-maincopy">
          <p className="archive-kicker">Home</p>
          <span className="archive-title-rule" aria-hidden="true" />
          <h1 className="archive-title archive-title--compact">Keep the places that matter to you.</h1>
          <p className="archive-hero-text archive-hero-text--wide">
            Discover somewhere nearby, or bring back a place you still remember from years ago.
          </p>
          <div className="archive-action-row">
            <TornPaperButton href="/explore">
              <CompassIcon />
              Explore nearby
            </TornPaperButton>
            <TornPaperButton href={{ pathname: '/explore', query: { mode: 'remembered' } }} tone="dark">
              <PlusIcon />
              Add a place you remember
            </TornPaperButton>
          </div>
        </div>

        <section className="archive-home-map-card" aria-label="Map preview">
          <DiscoveryMap center={previewCenter} userCenter={liveCenter} places={previewPlaces} />
          <div className="archive-home-map-caption">
            <strong>{liveCenter ? 'Your location' : 'Location'}</strong>
            <span>{mapStatus}</span>
          </div>
        </section>
      </section>

      <section className="archive-home-museum-panel">
        <div className="archive-home-museum-header">
          <div className="archive-home-museum-title">
            <MuseumIcon />
            <div>
              <h2>Museum</h2>
              <p>Stories from places that live on.</p>
            </div>
          </div>
          <a href="/museum" className="archive-home-view-all">
            View all
            <span aria-hidden="true">{'->'}</span>
          </a>
        </div>

        {museumCards.length > 0 ? (
          <div className="archive-home-museum-rail">
            {museumCards.map((card) => (
              <article key={card.id} className="archive-home-memory-card">
                <div className="archive-home-memory-image">
                  {card.imageDataUrl ? (
                    <img src={card.imageDataUrl} alt={card.imageAlt} />
                  ) : (
                    <div className="archive-home-memory-placeholder">
                      <MuseumIcon />
                      <span>No photo yet</span>
                    </div>
                  )}
                </div>
                <div className="archive-home-memory-body">
                  <h3>{card.title}</h3>
                  <p className="archive-home-memory-location">{card.location}</p>
                  <p className="archive-home-memory-note">{card.note}</p>
                  <div className="archive-home-memory-footer">
                    <span aria-hidden="true">▦</span>
                    <span>{card.date}</span>
                  </div>
                </div>
              </article>
            ))}
            <a href="/museum" className="archive-home-museum-next" aria-label="Open museum">
              <span aria-hidden="true">{'->'}</span>
            </a>
          </div>
        ) : (
          <EmptyArchiveState
            icon="▱"
            title="No places yet."
            detail="Add a place you remember and it will appear here."
            className="archive-home-museum-empty"
            action={
              <TornPaperButton href={{ pathname: '/explore', query: { mode: 'remembered' } }} tone="dark">
                <PlusIcon />
                Add a place you remember
              </TornPaperButton>
            }
          />
        )}
      </section>
    </ArchiveShell>
  );
}
