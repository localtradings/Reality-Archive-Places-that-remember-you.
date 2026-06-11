import type { Mood, MuseumPreview, Place } from '@/types';

export interface GeoapifyNearbyPlace {
  id: string;
  name: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
}

const TEMP_PLACE_STORAGE_PREFIX = 'reality-archive:temp-place:';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function deriveMood(category: string): Mood {
  const normalized = category.toLowerCase();

  if (normalized.includes('religion') || normalized.includes('worship') || normalized.includes('church') || normalized.includes('temple') || normalized.includes('cathedral')) {
    return 'Spiritual';
  }

  if (normalized.includes('historic') || normalized.includes('museum') || normalized.includes('heritage') || normalized.includes('monument') || normalized.includes('sight')) {
    return 'Historic';
  }

  if (normalized.includes('cafe') || normalized.includes('park') || normalized.includes('walk') || normalized.includes('garden') || normalized.includes('water')) {
    return 'Calm';
  }

  if (normalized.includes('market') || normalized.includes('food') || normalized.includes('shop') || normalized.includes('art')) {
    return 'Colorful';
  }

  if (normalized.includes('transit') || normalized.includes('event') || normalized.includes('station') || normalized.includes('tourism')) {
    return 'Energetic';
  }

  return 'Calm';
}

export function formatGeoapifyCategoryLabel(category: string) {
  const normalized = category.toLowerCase();

  if (normalized.startsWith('entertainment.museum')) {
    return 'Museum';
  }

  if (normalized.startsWith('religion.place_of_worship') || normalized.includes('place_of_worship')) {
    return 'Religious Landmark';
  }

  if (normalized.startsWith('tourism.sights') || normalized.startsWith('tourism.attraction') || normalized === 'tourism') {
    return 'Heritage / Attraction';
  }

  if (normalized.startsWith('leisure.park')) {
    return 'Park';
  }

  if (normalized.startsWith('natural.water') || normalized.startsWith('man_made.pier') || normalized.startsWith('maritime.marina')) {
    return 'Riverside Space';
  }

  if (normalized.startsWith('catering.cafe')) {
    return 'Cafe';
  }

  return category
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' · ');
}

function buildTemporaryMuseum(place: GeoapifyNearbyPlace): MuseumPreview {
  return {
    livingExhibit: `A live nearby discovery pulled from Geoapify for ${place.name}. This archive is temporary, but it already gives the place a clear museum voice.`,
    placeMood: `Live category: ${place.category}. Coordinates: ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}.`,
    memoryWallSummary: 'No saved memories yet. This place was opened from a live discovery card, not the curated mock archive.',
    voiceTourScript: [
      `You are looking at ${place.name}, a nearby place discovered through a live location search.`,
      `The place came from Geoapify with its name, address, category, and coordinates.`,
      'Use the archive route to preview it now, then return later if you want to add a memory.',
    ],
    visitorTips: [
      'Use the map to see how close this place is to your current location.',
      'Treat this as a temporary archive entry until the app stores it permanently.',
      'Return to Explore to compare it with the curated Iloilo landmarks.',
    ],
    miniQuest: {
      title: 'Temporary archive',
      prompt: 'Notice how a live place discovery differs from a curated mock landmark.',
      reward: 'A live discovery bookmark.',
    },
    sourcesUsed: ['Geoapify Places API', 'Browser geolocation', 'Client-side temporary place object'],
  };
}

export function buildTemporaryPlace(place: GeoapifyNearbyPlace): Place {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    description: `A live nearby place discovered from ${place.category}.`,
    memoryCount: 0,
    moods: [deriveMood(place.category)],
    memories: [],
    museum: buildTemporaryMuseum(place),
    coordinates: {
      latitude: place.latitude,
      longitude: place.longitude,
    },
    origin: 'geoapify',
  };
}

export function storeTemporaryPlace(place: Place) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(`${TEMP_PLACE_STORAGE_PREFIX}${place.id}`, JSON.stringify(place));
}

export function readTemporaryPlace(placeId: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(`${TEMP_PLACE_STORAGE_PREFIX}${placeId}`);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Place;
  } catch {
    return null;
  }
}

export function buildTemporaryPlaceId(place: Omit<GeoapifyNearbyPlace, 'id'>) {
  return `geoapify-${slugify(place.name) || 'place'}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`;
}

export function buildGeoapifyPlaceFromSearchParams(searchParams: URLSearchParams) {
  const name = searchParams.get('name');
  const address = searchParams.get('address');
  const category = searchParams.get('category');
  const latitude = searchParams.get('latitude');
  const longitude = searchParams.get('longitude');

  if (!name || !address || !category || !latitude || !longitude) {
    return null;
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return null;
  }

  const temporaryPlaceId = buildTemporaryPlaceId({
    name,
    address,
    category,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  });

  return buildTemporaryPlace({
    id: temporaryPlaceId,
    name,
    address,
    category,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  });
}
