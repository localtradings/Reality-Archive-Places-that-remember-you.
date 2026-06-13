import type { GeoapifyNearbyPlace } from './place-archive';

export interface GeoapifySearchCenter {
  latitude: number;
  longitude: number;
}

export interface GeoapifyPlacesOptions {
  apiKey: string;
  center: GeoapifySearchCenter;
  radiusMeters?: number;
  limit?: number;
  signal?: AbortSignal;
}

export interface GeoapifyPlaceSearchOptions {
  apiKey: string;
  text: string;
  center?: GeoapifySearchCenter;
  limit?: number;
  signal?: AbortSignal;
}

type GeoapifyDiscoveryQuery = {
  categories: string[];
  priority: number;
};

type GeoapifyFeature = {
  id?: string | number;
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: Record<string, unknown>;
};

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizePlace(feature: GeoapifyFeature): GeoapifyNearbyPlace | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const longitude = asNumber(coordinates[0]);
  const latitude = asNumber(coordinates[1]);
  if (longitude === null || latitude === null) {
    return null;
  }

  const properties = feature.properties ?? {};
  const categories = Array.isArray(properties.categories)
    ? properties.categories.filter((value): value is string => typeof value === 'string')
    : [];

  const name = asString(properties.name) || asString(properties.address_line1) || 'Nearby place';
  const addressLine1 = asString(properties.address_line1);
  const addressLine2 = asString(properties.address_line2);
  const formatted = asString(properties.formatted);
  const address = [addressLine1, addressLine2].filter(Boolean).join(', ') || formatted || 'Unknown address';
  const category = categories[0] || asString(properties.category) || 'tourism';
  const distanceMeters = asNumber(properties.distance) ?? undefined;
  const rawId = asString(properties.place_id) || String(feature.id ?? '');
  const id = rawId || `${name}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;

  return {
    id,
    name,
    address,
    category,
    latitude,
    longitude,
    distanceMeters,
  };
}

const discoveryQueries: GeoapifyDiscoveryQuery[] = [
  {
    categories: ['entertainment.museum'],
    priority: 100,
  },
  {
    categories: ['tourism.attraction', 'tourism.sights', 'tourism.sights.place_of_worship', 'religion.place_of_worship'],
    priority: 90,
  },
  {
    categories: ['leisure.park', 'natural.water', 'man_made.pier', 'maritime.marina'],
    priority: 70,
  },
  {
    categories: ['catering.cafe'],
    priority: 40,
  },
];

async function fetchGeoapifyPlacesForQuery(
  apiKey: string,
  center: GeoapifySearchCenter,
  radiusMeters: number,
  limit: number,
  query: GeoapifyDiscoveryQuery,
  signal?: AbortSignal,
) {
  const url = new URL('https://api.geoapify.com/v2/places');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('categories', query.categories.join(','));
  url.searchParams.set('filter', `circle:${center.longitude},${center.latitude},${radiusMeters}`);
  url.searchParams.set('bias', `proximity:${center.longitude},${center.latitude}`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', 'en');

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Geoapify request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    features?: GeoapifyFeature[];
  };

  return (data.features ?? [])
    .map((feature) => {
      const place = normalizePlace(feature);
      if (!place) {
        return null;
      }

      return {
        ...place,
        discoveryPriority: query.priority,
      };
    })
    .filter((place): place is GeoapifyNearbyPlace & { discoveryPriority: number } => place !== null);
}

export async function fetchGeoapifyNearbyPlaces({
  apiKey,
  center,
  radiusMeters = 5000,
  limit = 8,
  signal,
}: GeoapifyPlacesOptions) {
  const results = await Promise.allSettled(
    discoveryQueries.map((query) => fetchGeoapifyPlacesForQuery(apiKey, center, radiusMeters, limit, query, signal)),
  );

  const byId = new Map<string, GeoapifyNearbyPlace & { discoveryPriority: number }>();

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    for (const place of result.value) {
      const existing = byId.get(place.id);
      if (!existing) {
        byId.set(place.id, place);
        continue;
      }

      const isBetterPriority = place.discoveryPriority > existing.discoveryPriority;
      const bothHaveDistance =
        typeof place.distanceMeters === 'number' && typeof existing.distanceMeters === 'number';
      const currentDistance = bothHaveDistance ? place.distanceMeters : undefined;
      const existingDistance = bothHaveDistance ? existing.distanceMeters : undefined;
      const isCloser =
        typeof currentDistance === 'number' && typeof existingDistance === 'number'
          ? currentDistance < existingDistance
          : false;

      if (isBetterPriority || isCloser) {
        byId.set(place.id, {
          ...existing,
          ...place,
          discoveryPriority: Math.max(existing.discoveryPriority, place.discoveryPriority),
        });
      }
    }
  }

  if (byId.size === 0) {
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (rejected) {
      throw rejected.reason instanceof Error ? rejected.reason : new Error('Geoapify discovery failed.');
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const distanceA =
        typeof a.distanceMeters === 'number' && Number.isFinite(a.distanceMeters)
          ? a.distanceMeters
          : Number.POSITIVE_INFINITY;
      const distanceB =
        typeof b.distanceMeters === 'number' && Number.isFinite(b.distanceMeters)
          ? b.distanceMeters
          : Number.POSITIVE_INFINITY;

      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }

      if (a.discoveryPriority !== b.discoveryPriority) {
        return b.discoveryPriority - a.discoveryPriority;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map(({ discoveryPriority: _discoveryPriority, ...place }) => place);
}

type GeoapifyGeocodeResult = {
  place_id?: string;
  name?: string;
  address_line1?: string;
  address_line2?: string;
  formatted?: string;
  result_type?: string;
  category?: string;
  lat?: number;
  lon?: number;
};

export async function searchGeoapifyPlacesByText({
  apiKey,
  text,
  center,
  limit = 5,
  signal,
}: GeoapifyPlaceSearchOptions) {
  const query = text.trim();
  if (!query) {
    return [] as GeoapifyNearbyPlace[];
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('text', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', 'en');

  if (center) {
    url.searchParams.set('bias', `proximity:${center.longitude},${center.latitude}`);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Geoapify search failed with status ${response.status}`);
  }

  const data = (await response.json()) as { results?: GeoapifyGeocodeResult[] };

  return (data.results ?? [])
    .map((result) => {
      const latitude = asNumber(result.lat);
      const longitude = asNumber(result.lon);
      if (latitude === null || longitude === null) {
        return null;
      }

      const name = asString(result.name) || asString(result.address_line1) || asString(result.formatted) || query;
      const address = [asString(result.address_line1), asString(result.address_line2)].filter(Boolean).join(', ') || asString(result.formatted) || 'Unknown address';
      const category = asString(result.category) || asString(result.result_type) || 'remembered place';
      const id = asString(result.place_id) || `${name}-${latitude.toFixed(4)}-${longitude.toFixed(4)}`;

      return {
        id,
        name,
        address,
        category,
        latitude,
        longitude,
      } satisfies GeoapifyNearbyPlace;
    })
    .filter((place): place is GeoapifyNearbyPlace => place !== null);
}
