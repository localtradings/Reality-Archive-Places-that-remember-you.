'use client';

import L from 'leaflet';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import type { Coordinates } from '@/types';
import type { GeoapifyNearbyPlace } from '@/lib/place-archive';

const placeMarkerIcon = L.divIcon({
  className: 'ra-marker ra-marker--place',
  html: '<span class="ra-marker__dot"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -8],
});

function MapCenter({ center }: { center: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    map.setView([center.latitude, center.longitude], map.getZoom(), {
      animate: true,
    });
  }, [center.latitude, center.longitude, map]);

  return null;
}

function PlaceMarkers({ places }: { places: GeoapifyNearbyPlace[] }) {
  return (
    <>
      {places.map((place) => (
        <Marker key={place.id} position={[place.latitude, place.longitude]} icon={placeMarkerIcon}>
          <Popup>
            <div className="max-w-[12rem]">
              <p className="text-sm font-semibold text-zinc-950">{place.name}</p>
              <p className="mt-1 text-xs text-zinc-700">{place.address}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function UserMarker({ center }: { center: Coordinates }) {
  return (
    <CircleMarker
      center={[center.latitude, center.longitude]}
      radius={10}
      pathOptions={{
        color: '#dbeafe',
        weight: 2,
        fillColor: '#2f82ff',
        fillOpacity: 0.9,
      }}
    >
      <Popup>
        <div className="max-w-[12rem]">
          <p className="text-sm font-semibold text-zinc-950">Your location</p>
          <p className="mt-1 text-xs text-zinc-700">
            {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
          </p>
        </div>
      </Popup>
    </CircleMarker>
  );
}

export function DiscoveryMap({
  center,
  userCenter,
  places,
}: {
  center: Coordinates;
  userCenter?: Coordinates | null;
  places: GeoapifyNearbyPlace[];
}) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={14}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ height: '100%', width: '100%' }}
    >
      <MapCenter center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userCenter ? <UserMarker center={userCenter} /> : null}
      <PlaceMarkers places={places} />
    </MapContainer>
  );
}
