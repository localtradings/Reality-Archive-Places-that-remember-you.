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

export type TemporaryPlaceOrigin = 'geoapify' | 'search' | 'manual';

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

function buildTemporaryMuseum(place: GeoapifyNearbyPlace, origin: TemporaryPlaceOrigin): MuseumPreview {
  if (origin === 'search') {
    return {
      livingExhibit: `${place.name} was found by name and prepared as a remembered-place archive preview.`,
      placeMood: `Search result category: ${place.category}. Coordinates: ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}.`,
      memoryWallSummary: 'No saved memories yet. This place was added from search so you can start building its archive.',
      voiceTourScript: [
        `This archive began with a remembered-place search for ${place.name}.`,
        'Use the place page to confirm it feels right, then add a memory to make it personal.',
        'The museum will treat it like any other place in your archive once you save it.',
      ],
      visitorTips: [
        'Open the archive to confirm the place details feel correct.',
        'Add one memory to turn this result into part of your personal collection.',
        'Return to Explore if you want to search for another remembered place.',
      ],
      miniQuest: {
        title: 'Remembered place',
        prompt: 'Write down the first detail you still remember about this place.',
        reward: 'A remembered-place bookmark.',
      },
      sourcesUsed: ['Geoapify geocoding search', 'Client-side remembered place preview'],
    };
  }

  if (origin === 'manual') {
    return {
      livingExhibit: `${place.name} was added manually as a place you remember and is ready for memories and museum summaries.`,
      placeMood: `Manual archive category: ${place.category}. Coordinates: ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}.`,
      memoryWallSummary: 'No saved memories yet. This archive was created manually so you can preserve a place from memory.',
      voiceTourScript: [
        `This is a manually added archive for ${place.name}.`,
        'It exists so remembered places from years ago can still become part of your collection.',
        'Add a memory when you are ready to give the archive its first story.',
      ],
      visitorTips: [
        'Use the archive page to check the name, address, and category feel right.',
        'Add a memory to explain why this place matters to you.',
        'Open the museum later to see it appear beside your other places.',
      ],
      miniQuest: {
        title: 'Memory anchor',
        prompt: 'Capture one detail that proves this place still lives in your memory.',
        reward: 'A memory anchor stamp.',
      },
      sourcesUsed: ['Manual place entry', 'Client-side remembered place preview'],
    };
  }

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
      'Return to Explore to discover more places for your personal museum.',
    ],
    miniQuest: {
      title: 'Temporary archive',
      prompt: 'Notice how a live place discovery differs from a curated mock landmark.',
      reward: 'A live discovery bookmark.',
    },
    sourcesUsed: ['Geoapify Places API', 'Browser geolocation', 'Client-side temporary place object'],
  };
}

export function buildTemporaryPlace(place: GeoapifyNearbyPlace, origin: TemporaryPlaceOrigin = 'geoapify'): Place {
  const description =
    origin === 'search'
      ? `A remembered place found from search in ${place.category}.`
      : origin === 'manual'
        ? `A remembered place you added manually under ${place.category}.`
        : `A live nearby place discovered from ${place.category}.`;

  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    description,
    memoryCount: 0,
    moods: [deriveMood(place.category)],
    memories: [],
    museum: buildTemporaryMuseum(place, origin),
    coordinates: {
      latitude: place.latitude,
      longitude: place.longitude,
    },
    origin,
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
  const source = searchParams.get('source');

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
  }, source === 'manual' || source === 'search' ? source : 'geoapify');
}
