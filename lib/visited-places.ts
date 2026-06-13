import type { Place } from '@/types';

export interface VisitedPlace {
  id: string;
  name: string;
  address: string;
  category: string;
  description: string;
  memoryCount: number;
  moods: Place['moods'];
  memories: Place['memories'];
  museum: Place['museum'];
  coordinates?: Place['coordinates'];
  origin?: Place['origin'];
  isDemo?: boolean;
  firstVisitedAt: string;
  lastVisitedAt: string;
}

const VISITED_PLACES_STORAGE_KEY = 'reality-archive:visited-places:v1';
const recordableMuseumOrigins = new Set<NonNullable<Place['origin']>>(['mock', 'geoapify', 'search', 'manual']);

export function isRecordableMuseumPlace(place: Pick<Place, 'origin'>) {
  return Boolean(place.origin && recordableMuseumOrigins.has(place.origin));
}

function isVisitedPlace(value: unknown): value is VisitedPlace {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.address === 'string' &&
    typeof record.category === 'string' &&
    typeof record.description === 'string' &&
    typeof record.firstVisitedAt === 'string' &&
    typeof record.lastVisitedAt === 'string' &&
    Array.isArray(record.moods)
  );
}

export function readVisitedPlaces() {
  if (typeof window === 'undefined') {
    return [] as VisitedPlace[];
  }

  try {
    const raw = window.localStorage.getItem(VISITED_PLACES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isVisitedPlace)
      .filter(isRecordableMuseumPlace)
      .sort((a, b) => Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt));
  } catch {
    return [];
  }
}

export function recordVisitedPlace(place: Place, memoryCount = place.memoryCount) {
  if (typeof window === 'undefined') {
    return [] as VisitedPlace[];
  }

  if (!isRecordableMuseumPlace(place)) {
    return readVisitedPlaces();
  }

  const now = new Date().toISOString();
  const current = readVisitedPlaces();
  const existing = current.find((item) => item.id === place.id);
  const nextPlace: VisitedPlace = {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    description: place.description,
    memoryCount,
    moods: place.moods,
    memories: place.memories,
    museum: place.museum,
    coordinates: place.coordinates,
    origin: place.origin,
    isDemo: place.isDemo,
    firstVisitedAt: existing?.firstVisitedAt ?? now,
    lastVisitedAt: now,
  };

  const next = [nextPlace, ...current.filter((item) => item.id !== place.id)];
  window.localStorage.setItem(VISITED_PLACES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function visitedPlaceToPlace(place: VisitedPlace): Place {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    description: place.description,
    memoryCount: place.memoryCount,
    moods: place.moods,
    memories: place.memories,
    museum: place.museum,
    coordinates: place.coordinates,
    origin: place.origin,
    isDemo: place.isDemo,
  };
}
