'use client';

import Link from 'next/link';
import type { GeoapifyNearbyPlace } from '@/lib/place-archive';
import {
  buildTemporaryPlace,
  buildTemporaryPlaceId,
  storeTemporaryPlace,
} from '@/lib/place-archive';

function formatDistance(distanceMeters?: number) {
  if (typeof distanceMeters !== 'number' || Number.isNaN(distanceMeters)) {
    return 'Nearby';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function GeoapifyPlaceCard({
  place,
  index,
}: {
  place: GeoapifyNearbyPlace;
  index?: number;
}) {
  const temporaryPlaceId = buildTemporaryPlaceId({
    name: place.name,
    address: place.address,
    category: place.category,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceMeters: place.distanceMeters,
  });

  const temporaryPlace = buildTemporaryPlace({
    id: temporaryPlaceId,
    name: place.name,
    address: place.address,
    category: place.category,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceMeters: place.distanceMeters,
  });

  return (
    <Link
      href={{
        pathname: '/add-memory',
        query: {
          place: temporaryPlace.id,
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
    </Link>
  );
}
