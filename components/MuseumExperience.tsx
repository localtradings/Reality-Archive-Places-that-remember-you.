'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArchiveShell } from '@/components/ArchiveUI';
import { CloudCurationConsent } from '@/components/CloudCurationConsent';
import { mockPlaces } from '@/data/mockPlaces';
import { formatMemoryTypeLabel, readLocalMemories, type MemoryType, type SavedMemory } from '@/lib/local-memory';
import type { MuseumCollectionMode, MuseumCollectionSummaryResponse, MuseumPlaceSummary } from '@/lib/museum-collection';
import { buildMuseumGenerationRequestPayload, createMuseumArchiveSignature } from '@/lib/museum-generation';
import { buildGeoapifyPlaceFromSearchParams, readTemporaryPlace, storeTemporaryPlace } from '@/lib/place-archive';
import { readVisitedPlaces, visitedPlaceToPlace } from '@/lib/visited-places';
import type { Place } from '@/types';

type FoundryStoryState = 'idle' | 'loading' | 'live' | 'prepared' | 'error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatDate(value?: string) {
  if (!value) {
    return 'Not remembered yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not remembered yet';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getMemoryTitle(memory: SavedMemory) {
  if (memory.title?.trim()) {
    return memory.title.trim();
  }

  if (memory.photoCaption?.trim()) {
    return memory.photoCaption.trim();
  }

  if (memory.voiceTranscript?.trim()) {
    return memory.voiceTranscript.trim().slice(0, 58);
  }

  return `${formatMemoryTypeLabel(memory.type)} memory`;
}

function getMemoryBody(memory: SavedMemory) {
  if (memory.type === 'photo') {
    return memory.photoCaption?.trim() || memory.text.trim();
  }

  if (memory.type === 'voice') {
    return memory.voiceTranscript?.trim() || memory.text.trim();
  }

  return memory.text.trim();
}

function getMemoryTypes(memories: SavedMemory[]) {
  const types = new Set<MemoryType>();
  memories.forEach((memory) => types.add(memory.type));
  return Array.from(types);
}

function buildSummary(place: Place, memories: SavedMemory[]) {
  const latestMemory = memories[0];

  if (latestMemory) {
    const title = getMemoryTitle(latestMemory);
    const memoryType = formatMemoryTypeLabel(latestMemory.type).toLowerCase();
    return `${place.name} is saved in your living museum because you kept memories from this place. The latest ${memoryType} memory, "${title}", gives the exhibit its current story.`;
  }

  return `${place.name} is saved in your living museum. Add a text, photo, or voice memory to turn this place into a fuller exhibit.`;
}

function getSourcesUsed(memories: SavedMemory[]) {
  const sources = ['Place details'];

  if (memories.some((memory) => memory.type === 'text')) {
    sources.push('Text memories');
  }

  if (memories.some((memory) => memory.type === 'photo')) {
    sources.push('Photo memories');
  }

  if (memories.some((memory) => memory.type === 'voice')) {
    sources.push('Voice memories');
  }

  return sources;
}

function normalizeFoundryStory(value: unknown): MuseumPlaceSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.placeId !== 'string' || typeof value.title !== 'string' || typeof value.summary !== 'string' || typeof value.mood !== 'string') {
    return null;
  }

  return {
    placeId: value.placeId,
    title: value.title,
    summary: value.summary,
    mood: value.mood,
    memoryHighlights: Array.isArray(value.memoryHighlights) ? value.memoryHighlights.filter((item): item is string => typeof item === 'string') : [],
    citations: Array.isArray(value.citations) ? value.citations.filter((item): item is string => typeof item === 'string') : [],
  };
}

function normalizeSummaryResponse(value: unknown): MuseumCollectionSummaryResponse | null {
  if (!isRecord(value) || !Array.isArray(value.places)) {
    return null;
  }

  const mode = value.mode === 'live' || value.mode === 'prepared' || value.mode === 'local' ? value.mode : null;
  const provider = value.provider === 'foundry-iq' || value.provider === 'local' ? value.provider : null;
  if (!mode || !provider) {
    return null;
  }

  return {
    mode,
    provider,
    places: value.places.map(normalizeFoundryStory).filter((item): item is MuseumPlaceSummary => item !== null),
    sourceChunkCount: typeof value.sourceChunkCount === 'number' ? value.sourceChunkCount : undefined,
    documentsUploaded: typeof value.documentsUploaded === 'number' ? value.documentsUploaded : undefined,
    reason: typeof value.reason === 'string' ? value.reason : undefined,
  };
}

function getStoryStatusLabel(state: FoundryStoryState, mode: MuseumCollectionMode | null) {
  if (state === 'loading') {
    return 'Writing with Foundry IQ';
  }

  if (state === 'live' && mode === 'live') {
    return 'Live Foundry IQ story';
  }

  if (state === 'prepared') {
    return 'Local fallback';
  }

  if (state === 'error') {
    return 'Foundry IQ failed';
  }

  return 'Local archive story';
}

export function MuseumExperience() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const placeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [place, setPlace] = useState<Place | null>(null);
  const [localMemories, setLocalMemories] = useState<SavedMemory[]>([]);
  const [isResolvingPlace, setIsResolvingPlace] = useState(true);
  const [foundryStory, setFoundryStory] = useState<MuseumPlaceSummary | null>(null);
  const [foundryStoryState, setFoundryStoryState] = useState<FoundryStoryState>('idle');
  const [foundryStoryMode, setFoundryStoryMode] = useState<MuseumCollectionMode | null>(null);
  const [foundryStoryReason, setFoundryStoryReason] = useState('');
  const [foundryStoryError, setFoundryStoryError] = useState('');
  const searchParamsString = useMemo(() => searchParams.toString(), [searchParams]);
  const archivePayload = useMemo(() => (place ? buildMuseumGenerationRequestPayload(place, localMemories) : null), [place, localMemories]);
  const archiveSignature = useMemo(() => (archivePayload ? createMuseumArchiveSignature(archivePayload) : ''), [archivePayload]);

  useEffect(() => {
    setIsResolvingPlace(true);

    const mockPlace = mockPlaces.find((item) => item.id === placeId);
    if (mockPlace) {
      setPlace(mockPlace);
      setIsResolvingPlace(false);
      return;
    }

    const visitedPlace = readVisitedPlaces().find((item) => item.id === placeId);
    if (visitedPlace) {
      setPlace(visitedPlaceToPlace(visitedPlace));
      setIsResolvingPlace(false);
      return;
    }

    const storedPlace = readTemporaryPlace(placeId);
    if (storedPlace) {
      setPlace(storedPlace);
      setIsResolvingPlace(false);
      return;
    }

    const tempPlace = buildGeoapifyPlaceFromSearchParams(new URLSearchParams(searchParamsString));
    if (tempPlace) {
      storeTemporaryPlace(tempPlace);
      setPlace(tempPlace);
    } else {
      setPlace(null);
    }

    setIsResolvingPlace(false);
  }, [placeId, searchParamsString]);

  useEffect(() => {
    setLocalMemories(readLocalMemories(placeId));
  }, [placeId]);

  async function loadFoundryStory(accessCode?: string) {
    if (!archivePayload || !archiveSignature) {
      throw new Error('This archive is not ready for cloud curation.');
    }

    const requestPayload = archivePayload;
    setFoundryStoryState('loading');
    setFoundryStoryMode(null);
    setFoundryStory(null);
    setFoundryStoryReason('');
    setFoundryStoryError('');

    try {
      if (accessCode) {
        const sessionResponse = await fetch('/api/microsoft-iq/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ accessCode }),
        });
        const sessionData = (await sessionResponse.json()) as unknown;
        if (!sessionResponse.ok) {
          throw new Error(isRecord(sessionData) && typeof sessionData.error === 'string' ? sessionData.error : 'Demo access failed.');
        }
      }

      const response = await fetch('/api/microsoft-iq/summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-reality-archive-cloud-consent': 'granted',
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ places: [requestPayload] }),
      });

      const responseText = await response.text();
      let data: unknown = null;
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(isRecord(data) && typeof data.error === 'string' ? data.error : 'Foundry IQ summary request failed.');
      }

      const summaryResponse = normalizeSummaryResponse(data);
      const story = summaryResponse?.places.find((item) => item.placeId === requestPayload.place.id) ?? summaryResponse?.places[0] ?? null;
      if (!summaryResponse || !story || summaryResponse.mode !== 'live') {
        throw new Error(summaryResponse?.reason || 'Foundry IQ did not return a grounded live story for this place.');
      }

      setFoundryStory(story);
      setFoundryStoryMode(summaryResponse.mode);
      setFoundryStoryState('live');
      setFoundryStoryReason('');
    } catch (error) {
      setFoundryStoryState('error');
      setFoundryStoryMode(null);
      setFoundryStory(null);
      setFoundryStoryReason('');
      const message = error instanceof Error ? error.message : 'Foundry IQ could not write this story.';
      setFoundryStoryError(message);
      throw error;
    }
  }

  if (isResolvingPlace) {
    return (
      <ArchiveShell hideTopbar className="archive-workspace--museum-detail">
        <main className="museum-detail-page">
          <section className="museum-detail-paper museum-detail-loading">
            <p className="museum-detail-kicker">Opening exhibit</p>
            <h1>Loading this place.</h1>
          </section>
        </main>
      </ArchiveShell>
    );
  }

  if (!place) {
    return (
      <ArchiveShell hideTopbar className="archive-workspace--museum-detail">
        <main className="museum-detail-page">
          <section className="museum-detail-paper museum-detail-loading">
            <p className="museum-detail-kicker">Museum exhibit</p>
            <h1>Place not found.</h1>
            <p>This place is not saved in your museum yet.</p>
            <Link className="museum-reference-open" href="/museum">
              Museum <span>→</span>
            </Link>
          </section>
        </main>
      </ArchiveShell>
    );
  }

  const latestMemory = localMemories[0];
  const memoryTypes = getMemoryTypes(localMemories);
  const sourcesUsed = getSourcesUsed(localMemories);
  const summary = foundryStory?.summary ?? buildSummary(place, localMemories);
  const summaryTitle = foundryStory?.title ?? (latestMemory ? getMemoryTitle(latestMemory) : 'This place is ready for memories.');
  const storyMood = foundryStory?.mood ?? latestMemory?.mood ?? place.moods[0] ?? 'Calm';
  const sourceLabels = foundryStory?.citations.length ? foundryStory.citations : sourcesUsed;

  return (
    <ArchiveShell hideTopbar className="archive-workspace--museum-detail">
      <main className="museum-detail-page">
        <section className="museum-detail-paper museum-detail-hero">
          <div>
            <p className="museum-detail-kicker">Your Living Museum</p>
            <h1>{place.name}</h1>
            <p>{place.address}</p>
          </div>
        </section>

        <section className="museum-detail-grid">
          <article className="museum-detail-paper museum-detail-summary">
            <div className="museum-detail-section-heading">
              <p className="museum-detail-kicker">Museum Story</p>
              <span className={`museum-detail-status museum-detail-status--${foundryStoryState}`}>
                {getStoryStatusLabel(foundryStoryState, foundryStoryMode)}
              </span>
            </div>
            <h2>{foundryStoryState === 'loading' ? 'Writing your museum story...' : summaryTitle}</h2>
            <p>{foundryStoryState === 'loading' ? 'Foundry IQ is reading the place details, memory text, photo captions, and voice transcripts to write a grounded story.' : summary}</p>

            {foundryStory?.memoryHighlights.length ? (
              <div className="museum-detail-highlights">
                {foundryStory.memoryHighlights.map((highlight) => (
                  <span key={highlight}>{highlight}</span>
                ))}
              </div>
            ) : null}

            {foundryStoryState === 'error' ? (
              <div className="museum-detail-story-alert">
                <p>{foundryStoryError}</p>
              </div>
            ) : null}

            <CloudCurationConsent
              state={foundryStoryState}
              reason={foundryStoryReason}
              onGenerate={loadFoundryStory}
            />

            <p className="museum-detail-muted">
              {foundryStoryState === 'live'
                ? 'Written live by Foundry IQ from your saved place details and memories.'
                : foundryStoryState === 'prepared'
                  ? foundryStoryReason || 'Foundry IQ was called, but the live story was not available, so a grounded fallback is shown.'
                  : foundryStoryState === 'error'
                    ? 'The local fallback remains visible until Foundry IQ returns a live story.'
                    : 'This local story stays on your device until you explicitly request Microsoft cloud curation.'}
            </p>
          </article>

          <aside className="museum-detail-paper museum-detail-facts">
            <p className="museum-detail-kicker">Exhibit details</p>
            <dl>
              <div>
                <dt>Last remembered</dt>
                <dd>{formatDate(latestMemory?.createdAt)}</dd>
              </div>
              <div>
                <dt>Mood</dt>
                <dd>{storyMood}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{place.category}</dd>
              </div>
              <div>
                <dt>Memory types</dt>
                <dd>{memoryTypes.length > 0 ? memoryTypes.map(formatMemoryTypeLabel).join(', ') : 'None yet'}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="museum-detail-memory-section">
          <div className="museum-reference-section-title">
            <h2>Saved Memories</h2>
            <span />
          </div>

          {localMemories.length > 0 ? (
            <div className="museum-detail-memory-grid">
              {localMemories.map((memory) => (
                <article key={memory.id} className="museum-detail-paper museum-detail-memory-card">
                  <div className="museum-detail-memory-top">
                    <span>{formatMemoryTypeLabel(memory.type)} memory</span>
                    <time>{formatDate(memory.createdAt)}</time>
                  </div>
                  <h3>{getMemoryTitle(memory)}</h3>
                  {memory.imageDataUrl ? <img src={memory.imageDataUrl} alt={memory.photoCaption || getMemoryTitle(memory)} /> : null}
                  <p>{getMemoryBody(memory)}</p>
                  <small>Mood: {memory.mood}</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="museum-detail-paper museum-detail-empty">
              <h3>No memories saved for this place yet.</h3>
              <p>Add one memory to make the summary more personal.</p>
              <Link className="museum-reference-add" href={{ pathname: '/add-memory', query: { place: place.id } }}>
                <span>＋</span> Add memory
              </Link>
            </div>
          )}
        </section>

        <section className="museum-detail-paper museum-detail-sources">
          <p className="museum-detail-kicker">Sources used</p>
          <div>
            {sourceLabels.map((source) => (
              <span key={source}>{source}</span>
            ))}
          </div>
        </section>
      </main>
    </ArchiveShell>
  );
}
