'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArchiveShell } from '@/components/ArchiveUI';
import { formatMemoryTypeLabel, readLocalMemories, type MemoryType, type SavedMemory } from '@/lib/local-memory';
import { readVisitedPlaces, type VisitedPlace } from '@/lib/visited-places';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function uniqueMemoryTypes(memories: SavedMemory[]) {
  const ordered: MemoryType[] = ['text', 'photo', 'voice'];
  const available = new Set(memories.map((memory) => memory.type));
  return ordered.filter((type) => available.has(type));
}

function latestMemoryTitle(memory: SavedMemory | undefined) {
  if (!memory) {
    return 'No memory saved yet';
  }

  if (memory.title?.trim()) {
    return memory.title.trim();
  }

  if (memory.type === 'photo' && memory.photoCaption?.trim()) {
    return memory.photoCaption.trim();
  }

  if (memory.type === 'voice' && memory.voiceTranscript?.trim()) {
    return memory.voiceTranscript.trim();
  }

  return memory.text.trim() || `${formatMemoryTypeLabel(memory.type)} memory`;
}

function BuildingSketch() {
  return (
    <svg className="museum-reference-building" viewBox="0 0 520 230" aria-hidden="true">
      <path d="M64 175h386M95 167V89h288v78M130 167V99M176 167V99M222 167V99M268 167V99M314 167V99M360 167V99" />
      <path d="M71 91h336L239 30 71 91Z" />
      <path d="M104 78h270M122 63h232M160 50h154M239 30v-13M217 17h44" />
      <path d="M74 181c34-19 66-19 98 0 32-18 64-18 96 0 32-18 64-18 96 0 27-15 54-18 81-8" />
      <path d="M420 98c28 20 40 48 35 84M82 110c-21 15-31 38-28 69" />
      <path d="M106 185h302M122 198h270" />
    </svg>
  );
}

function MuseumPlaceCard({ place }: { place: VisitedPlace }) {
  const localMemories = readLocalMemories(place.id);
  const latestMemory = localMemories[0];
  const memoryTypes = uniqueMemoryTypes(localMemories);
  const mood = latestMemory?.mood ?? place.moods[0] ?? 'Calm';

  return (
    <article className="museum-reference-card">
      <div className="museum-reference-postmark" aria-hidden="true" />
      <header className="museum-reference-card-header">
        <span className="museum-reference-icon" aria-hidden="true">●</span>
        <div>
          <h2>{place.name}</h2>
          <p>{place.address}</p>
        </div>
      </header>

      <div className="museum-reference-card-rule" />

      <div className="museum-reference-card-body">
        <div className="museum-reference-detail-stack">
          <div className="museum-reference-detail">
            <span aria-hidden="true">▤</span>
            <div>
              <small>Latest memory</small>
              <em>{latestMemoryTitle(latestMemory)}</em>
            </div>
          </div>
          <div className="museum-reference-detail">
            <span aria-hidden="true">☻</span>
            <div>
              <small>Mood</small>
              <em>{mood}</em>
            </div>
          </div>
          <div className="museum-reference-detail">
            <span aria-hidden="true">◇</span>
            <div>
              <small>Category</small>
              <em>{place.category}</em>
            </div>
          </div>
        </div>

        <div className="museum-reference-meta">
          <div className="museum-reference-detail">
            <span aria-hidden="true">▣</span>
            <div>
              <small>Last remembered</small>
              <em>{formatDate(latestMemory?.createdAt ?? place.lastVisitedAt)}</em>
            </div>
          </div>
          <div className="museum-reference-detail">
            <span aria-hidden="true">◇</span>
            <div>
              <small>Memory types</small>
              <div className="museum-reference-memory-types">
                {memoryTypes.length > 0
                  ? memoryTypes.map((type) => <span key={type}>{formatMemoryTypeLabel(type)} memory</span>)
                  : <span>None yet</span>}
              </div>
            </div>
          </div>
          <Link href={`/museum/${place.id}`} className="museum-reference-open">
            Open <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export function MuseumCollection() {
  const [visitedPlaces, setVisitedPlaces] = useState<VisitedPlace[]>([]);

  useEffect(() => {
    setVisitedPlaces(readVisitedPlaces());
  }, []);

  const sortedPlaces = useMemo(
    () => [...visitedPlaces].sort((a, b) => Date.parse(b.lastVisitedAt) - Date.parse(a.lastVisitedAt)),
    [visitedPlaces],
  );

  return (
    <ArchiveShell hideTopbar className="archive-workspace--museum-reference">
      <section className="museum-reference-page">
        <section className="museum-reference-hero">
          <div className="museum-reference-hero-copy">
            <h1>Your Living Museum</h1>
            <p>Places saved from your memories.</p>
            <Link href="/add-memory" className="museum-reference-add">
              <span aria-hidden="true">＋</span>
              Add memory
            </Link>
          </div>
          <BuildingSketch />
        </section>

        {sortedPlaces.length > 0 ? (
          <section className="museum-reference-exhibits" aria-label="Saved place exhibits">
            <div className="museum-reference-section-title">
              <h2>Saved Place Exhibits</h2>
              <span aria-hidden="true" />
            </div>
            <div className="museum-reference-grid">
              {sortedPlaces.map((place) => <MuseumPlaceCard key={place.id} place={place} />)}
            </div>
          </section>
        ) : null}
      </section>
    </ArchiveShell>
  );
}
