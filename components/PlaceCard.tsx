import Link from 'next/link';
import type { Place } from '@/types';
import { MoodBadge } from './MoodBadge';

export function PlaceCard({ place }: { place: Place }) {
  return (
    <Link
      href={{ pathname: '/add-memory', query: { place: place.id } }}
      className="torn-paper torn-paper-dark archive-place-card group"
    >
      <div className="archive-card-meta">
        <div>
          <p className="archive-kicker">{place.category}</p>
          <h3>{place.name}</h3>
          <p>{place.address}</p>
        </div>
        <span className="museum-plaque">{place.memoryCount} memories</span>
      </div>

      <p className="archive-card-copy">{place.description}</p>

      <div className="archive-chip-row">
        {place.moods.map((mood) => (
          <MoodBadge key={mood} mood={mood} />
        ))}
      </div>

      <div className="archive-card-footer">
        <span>Add memory</span>
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}
