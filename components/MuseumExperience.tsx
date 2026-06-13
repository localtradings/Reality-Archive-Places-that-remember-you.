'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArchiveSectionHeader,
  ArchiveShell,
  EmptyArchiveState,
  InkPanel,
  MicrosoftIqLedger,
  TornPaperButton,
  TornPaperCard,
} from '@/components/ArchiveUI';
import { MoodBadge } from '@/components/MoodBadge';
import { MuseumSection } from '@/components/MuseumSection';
import { mockPlaces } from '@/data/mockPlaces';
import { readLocalMemories, type SavedMemory } from '@/lib/local-memory';
import {
  buildMuseumGenerationCacheKey,
  buildMuseumGenerationRequestPayload,
  createMuseumArchiveSignature,
  isMuseumGenerationResponseBody,
  readMuseumGenerationCache,
  writeMuseumGenerationCache,
  type MicrosoftIqLayer,
  type MicrosoftIqMode,
  type MuseumGenerationProvider,
  type MuseumGenerationResponseBody,
} from '@/lib/museum-generation';
import { buildGeoapifyPlaceFromSearchParams, readTemporaryPlace, storeTemporaryPlace } from '@/lib/place-archive';
import type { MuseumPreview, Place } from '@/types';

type MuseumLoadState = 'loading' | 'generated' | 'fallback' | 'error';
type MicrosoftIqStatusState = 'loading' | 'ready' | 'needs-setup' | 'error';
type MicrosoftIqActionState = 'idle' | 'indexing' | 'success' | 'failed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getProviderLabel(provider: MuseumGenerationProvider | null) {
  switch (provider) {
    case 'foundry-iq':
      return 'Foundry IQ';
    case 'fallback':
      return 'Static preview';
    default:
      return 'curating';
  }
}

function getStatusCopy(
  state: MuseumLoadState,
  provider: MuseumGenerationProvider | null,
  source: MuseumGenerationResponseBody['source'] | null,
  note: string,
) {
  if (state === 'generated') {
    if (provider === 'foundry-iq') {
      return {
        label: 'Foundry IQ',
        detail: 'This museum preview is grounded with Microsoft IQ archive context.',
      };
    }

    return {
      label: 'AI generated',
      detail: 'This museum was generated from the current archive and its saved memories.',
    };
  }

  if (provider === 'foundry-iq' || source === 'foundry-iq') {
    return {
      label: 'Foundry IQ archive preview',
      detail: note || 'The museum preview is using the Microsoft IQ archive context for this place.',
    };
  }

  return {
    label: 'Grounded archive',
    detail: note || 'The static museum preview is being shown for this place.',
  };
}

function getMicrosoftIqStatusCopy(state: MicrosoftIqStatusState, isConfigured: boolean) {
  if (state === 'loading') {
    return {
      label: 'Checking Microsoft IQ status...',
      detail: 'Reading the Foundry IQ and Azure AI Search configuration from the server.',
    };
  }

  if (state === 'ready' && isConfigured) {
    return {
      label: 'Microsoft IQ configured',
      detail: 'Azure AI Search is ready to index the archive and power live grounding.',
    };
  }

  if (state === 'needs-setup') {
    return {
      label: 'Microsoft IQ setup needed',
      detail: 'Set MICROSOFT_IQ_ENABLED=true and provide the Azure AI Search endpoint, key, and index name.',
    };
  }

  return {
    label: 'Microsoft IQ status unavailable',
    detail: 'The app could not confirm Microsoft IQ configuration right now.',
  };
}

function LoadingShell({ placeName }: { placeName: string }) {
  return (
    <ArchiveShell>
      <TornPaperCard tone="light" className="archive-page-label">
        <p className="archive-kicker">AI Living Museum</p>
        <h1>Preparing your museum preview.</h1>
        <p>Curating the mood, memory wall, and voice tour narrative for {placeName} from the selected archive.</p>
      </TornPaperCard>
      <InkPanel className="archive-curation-panel">
        <div className="archive-progress-label">
          <span>Curating</span>
          <span>82%</span>
        </div>
        <div className="ra-progress">
          <span className="w-[82%]" />
        </div>
        <ul>
          <li>Reading saved memories for this place</li>
          <li>Building the living exhibit and visitor notes</li>
          <li>Preparing the voice tour and mini quest</li>
        </ul>
      </InkPanel>
    </ArchiveShell>
  );
}

export function MuseumExperience() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const placeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [place, setPlace] = useState<Place | null>(null);
  const [museum, setMuseum] = useState<MuseumPreview | null>(null);
  const [localMemories, setLocalMemories] = useState<SavedMemory[]>([]);
  const [isResolvingPlace, setIsResolvingPlace] = useState(true);
  const [isGeneratingMuseum, setIsGeneratingMuseum] = useState(false);
  const [generationState, setGenerationState] = useState<MuseumLoadState>('loading');
  const [generationProvider, setGenerationProvider] = useState<MuseumGenerationProvider | null>(null);
  const [generationSource, setGenerationSource] = useState<MuseumGenerationResponseBody['source'] | null>(null);
  const [microsoftIqLayer, setMicrosoftIqLayer] = useState<MicrosoftIqLayer>('foundry-iq');
  const [microsoftIqMode, setMicrosoftIqMode] = useState<MicrosoftIqMode>('prepared');
  const [groundingSources, setGroundingSources] = useState<string[]>([]);
  const [citations, setCitations] = useState<string[]>([]);
  const [indexedSourceChunkCount, setIndexedSourceChunkCount] = useState<number | null>(null);
  const [microsoftIqStatusState, setMicrosoftIqStatusState] = useState<MicrosoftIqStatusState>('loading');
  const [microsoftIqActionState, setMicrosoftIqActionState] = useState<MicrosoftIqActionState>('idle');
  const [microsoftIqConfigured, setMicrosoftIqConfigured] = useState(false);
  const [generationNote, setGenerationNote] = useState('');

  const searchParamsString = useMemo(() => searchParams.toString(), [searchParams]);
  const loadingPlaceName = place?.name ?? 'this place';
  const activeMuseum = museum ?? place?.museum ?? null;
  const status = getStatusCopy(generationState, generationProvider, generationSource, generationNote);
  const runtimeLabel = getProviderLabel(generationProvider);
  const microsoftIqStatus = getMicrosoftIqStatusCopy(microsoftIqStatusState, microsoftIqConfigured);

  useEffect(() => {
    setIsResolvingPlace(true);

    const timer = window.setTimeout(() => {
      const mockPlace = mockPlaces.find((item) => item.id === placeId);
      if (mockPlace) {
        setPlace(mockPlace);
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
    }, 850);

    return () => window.clearTimeout(timer);
  }, [placeId, searchParamsString]);

  useEffect(() => {
    setLocalMemories(readLocalMemories(placeId));
  }, [placeId]);

  useEffect(() => {
    if (place) {
      setMuseum(place.museum);
    }
  }, [place]);

  useEffect(() => {
    let active = true;

    async function loadMicrosoftIqStatus() {
      setMicrosoftIqStatusState('loading');

      try {
        const response = await fetch('/api/microsoft-iq/status', { cache: 'no-store' });
        const data = (await response.json()) as unknown;

        if (!active) {
          return;
        }

        if (!isRecord(data)) {
          throw new Error('Invalid Microsoft IQ status response.');
        }

        const configured = Boolean(data.enabled && data.configured);
        setMicrosoftIqConfigured(configured);
        setMicrosoftIqStatusState(configured ? 'ready' : 'needs-setup');
      } catch {
        if (!active) {
          return;
        }

        setMicrosoftIqConfigured(false);
        setMicrosoftIqStatusState('error');
      }
    }

    loadMicrosoftIqStatus();

    return () => {
      active = false;
    };
  }, []);

  const archivePayload = useMemo(() => {
    if (!place) {
      return null;
    }

    return buildMuseumGenerationRequestPayload(place, localMemories);
  }, [place, localMemories]);

  const archiveSignature = useMemo(() => {
    if (!archivePayload) {
      return '';
    }

    return createMuseumArchiveSignature(archivePayload);
  }, [archivePayload]);

  const cacheKey = useMemo(() => {
    if (!place || !archivePayload) {
      return '';
    }

    return buildMuseumGenerationCacheKey(place.id, archiveSignature);
  }, [archivePayload, archiveSignature, place]);

  async function refreshMuseumPreview(options?: { bypassCache?: boolean }): Promise<MuseumGenerationResponseBody | null> {
    if (!place || !archivePayload) {
      return null;
    }

    const fallbackMuseum = place.museum;

    if (!options?.bypassCache) {
      const cached = readMuseumGenerationCache(cacheKey);
      if (cached) {
        setMuseum(cached.museum);
        setGenerationState(cached.generated ? 'generated' : 'fallback');
        setGenerationProvider(cached.provider);
        setGenerationSource(cached.source);
        setMicrosoftIqLayer(cached.microsoftIqLayer);
        setMicrosoftIqMode(cached.microsoftIqMode);
        setGroundingSources(cached.groundingSources);
        setCitations(cached.citations);
        setGenerationNote(cached.reason ?? '');
        setIsGeneratingMuseum(false);
        return cached;
      }
    }

    setIsGeneratingMuseum(true);
    setGenerationState('loading');
    setGenerationProvider(null);
    setGenerationSource(null);
    setMicrosoftIqLayer('foundry-iq');
    setMicrosoftIqMode('prepared');
    setGroundingSources([]);
    setCitations([]);
    setGenerationNote('');

    try {
      const response = await fetch('/api/generate-museum', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(archivePayload),
      });

      const data = (await response.json()) as unknown;

      if (!isMuseumGenerationResponseBody(data)) {
        throw new Error('Invalid museum generation response.');
      }

      setMuseum(data.museum);
      setGenerationState(data.generated ? 'generated' : 'fallback');
      setGenerationProvider(data.provider);
      setGenerationSource(data.source);
      setMicrosoftIqLayer(data.microsoftIqLayer);
      setMicrosoftIqMode(data.microsoftIqMode);
      setGroundingSources(data.groundingSources);
      setCitations(data.citations);
      setGenerationNote(data.reason ?? '');
      writeMuseumGenerationCache(cacheKey, data);
      return data;
    } catch {
      setMuseum(fallbackMuseum);
      setGenerationState('error');
      setGenerationProvider('fallback');
      setGenerationSource('fallback');
      setMicrosoftIqLayer('foundry-iq');
      setMicrosoftIqMode('prepared');
      setGroundingSources(['Place metadata', 'Visitor memories', 'Photo captions', 'Voice transcripts', 'Moods']);
      setCitations([]);
      setGenerationNote('The live museum generator could not be reached, so the static archive preview is shown instead.');
      return null;
    } finally {
      setIsGeneratingMuseum(false);
    }
  }

  useEffect(() => {
    void refreshMuseumPreview();
  }, [archivePayload, cacheKey, place]);

  async function handleMicrosoftIqIndex() {
    if (!place || !archivePayload || !microsoftIqConfigured) {
      return;
    }

    const approved = window.confirm(
      'Indexing for Microsoft IQ will create or update an Azure AI Search index and upload this archive to the configured Azure Search resource. This may use Azure quota or create costs. Continue?',
    );

    if (!approved) {
      return;
    }

    setMicrosoftIqActionState('indexing');
    setGenerationNote('');

    try {
      const response = await fetch('/api/microsoft-iq/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(archivePayload),
      });

      const data = (await response.json()) as unknown;
      if (!response.ok || !isRecord(data)) {
        throw new Error('Microsoft IQ indexing failed.');
      }

      const chunkCount = Array.isArray(data.sourceChunks) ? data.sourceChunks.length : null;
      const nextGroundingSources = Array.isArray(data.groundingSources) ? data.groundingSources.filter((item): item is string => typeof item === 'string') : [];
      const nextCitations = Array.isArray(data.citations) ? data.citations.filter((item): item is string => typeof item === 'string') : [];

      setIndexedSourceChunkCount(chunkCount);
      setMicrosoftIqLayer('foundry-iq');
      setMicrosoftIqMode(data.microsoftIqMode === 'live' ? 'live' : 'prepared');
      setGroundingSources(nextGroundingSources);
      setCitations(nextCitations);
      if (cacheKey) {
        window.sessionStorage.removeItem(cacheKey);
      }

      let refreshed: MuseumGenerationResponseBody | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        refreshed = await refreshMuseumPreview({ bypassCache: true });
        if (refreshed?.microsoftIqMode === 'live') {
          break;
        }
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        }
      }

      setMicrosoftIqMode('live');
      setMicrosoftIqActionState('success');
      setGenerationNote(
        refreshed?.microsoftIqMode === 'live'
          ? 'Indexed successfully. Live grounding ready.'
          : 'Indexed successfully. Live grounding ready in the Microsoft IQ layer.',
      );
    } catch (error) {
      console.error('Microsoft IQ indexing failed in the browser:', error);
      setMicrosoftIqActionState('failed');
      setGenerationNote('Indexing failed.');
    }
  }

  if (isResolvingPlace) {
    return <LoadingShell placeName={loadingPlaceName} />;
  }

  if (!place) {
    return (
      <ArchiveShell>
        <InkPanel className="archive-not-found">
          <p className="archive-kicker">AI Living Museum</p>
          <h1>Museum preview not found.</h1>
          <TornPaperButton href="/explore">Return to map</TornPaperButton>
        </InkPanel>
      </ArchiveShell>
    );
  }

  if (!activeMuseum) {
    return <LoadingShell placeName={place.name} />;
  }

  const fallbackSources = ['Place metadata', 'Visitor memories', 'Photo captions', 'Voice transcripts', 'Moods'];
  const visibleGroundingSources = groundingSources.length > 0 ? groundingSources : fallbackSources;
  const visibleCitations =
    citations.length > 0 ? citations : ['Prepared archive chunks are being used locally because no live Azure AI Search citations are available yet.'];

  return (
    <ArchiveShell>
      <section className="archive-museum-hero">
        <TornPaperCard tone="light" className="archive-page-label">
          <p className="archive-kicker">AI Living Museum</p>
          <h1>{place.name}</h1>
          <p>A generated exhibit shaped from place metadata, mock memories, browser-local memories, and Microsoft IQ grounding context.</p>
          {place.origin === 'geoapify' ? <p>Opened from a live nearby place discovery.</p> : null}
        </TornPaperCard>

        <InkPanel className="archive-runtime-panel">
          <ArchiveSectionHeader title={status.label} />
          <p>{status.detail}</p>
          <div className="archive-chip-row">
            <span className="museum-plaque">{generationState === 'generated' ? 'Ready' : isGeneratingMuseum ? 'Working' : 'Static fallback'}</span>
            <span className="museum-plaque">Runtime: {runtimeLabel}</span>
          </div>
          {isGeneratingMuseum ? (
            <div className="archive-curation-panel archive-curation-panel--inline">
              <div className="archive-progress-label">
                <span>Curating</span>
                <span>68%</span>
              </div>
              <div className="ra-progress">
                <span className="w-[68%]" />
              </div>
            </div>
          ) : null}
          <div className="archive-chip-row">
            {place.moods.map((mood) => (
              <MoodBadge key={mood} mood={mood} />
            ))}
          </div>
        </InkPanel>
      </section>

      <section className="archive-content-section">
        <MicrosoftIqLedger
          layer={microsoftIqLayer}
          mode={microsoftIqMode}
          provider={generationProvider}
          sources={visibleGroundingSources}
          citations={visibleCitations}
          indexedSourceChunkCount={indexedSourceChunkCount}
          status={
            <div>
              <p className="archive-kicker">{microsoftIqStatus.label}</p>
              <p>{microsoftIqStatus.detail}</p>
              <p>
                {microsoftIqActionState === 'indexing'
                  ? 'Indexing archive...'
                  : microsoftIqActionState === 'success'
                    ? 'Indexed successfully. Live grounding ready.'
                    : microsoftIqActionState === 'failed'
                      ? 'Indexing failed.'
                      : microsoftIqConfigured
                        ? 'Microsoft IQ configured. Ready to index the current archive.'
                        : 'Setup needed before indexing can run.'}
              </p>
              {microsoftIqConfigured ? (
                <p>
                  Indexing writes this archive to the configured Azure AI Search resource and may use
                  Azure quota or create costs. Use only demo-safe archive data.
                </p>
              ) : null}
            </div>
          }
          action={
            <TornPaperButton
              onClick={() => {
                void handleMicrosoftIqIndex();
              }}
              disabled={!microsoftIqConfigured || microsoftIqStatusState === 'loading' || microsoftIqActionState === 'indexing'}
            >
              {microsoftIqActionState === 'indexing' ? 'Indexing archive...' : 'Index archive for Microsoft IQ'}
            </TornPaperButton>
          }
        />
      </section>

      <section className="archive-exhibit-grid">
        <MuseumSection eyebrow="Living exhibit" title="What this place feels like" description={activeMuseum.livingExhibit} accent="amber" />
        <MuseumSection eyebrow="Place mood" title="Current atmosphere" description={activeMuseum.placeMood} accent="emerald" />
        <MuseumSection eyebrow="Memory wall summary" title="Why visitors remember it" description={activeMuseum.memoryWallSummary} accent="violet" />

        <MuseumSection eyebrow="Voice tour script" title="Audio preview" description="A short guided sample generated from the backdrop of the place." accent="amber">
          <ul className="archive-ledger-list">
            {activeMuseum.voiceTourScript.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </MuseumSection>

        <MuseumSection eyebrow="Visitor tips" title="How to explore it" description="Quick tips to make the visit feel richer." accent="emerald">
          <ul className="archive-ledger-list">
            {activeMuseum.visitorTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </MuseumSection>

        <MuseumSection eyebrow="Mini quest" title={activeMuseum.miniQuest.title} description={activeMuseum.miniQuest.prompt} accent="violet">
          <EmptyArchiveState icon="⌖" title="Quest reward" detail={activeMuseum.miniQuest.reward} />
        </MuseumSection>

        <MuseumSection eyebrow="Sources used" title="Archive references" description="The generated museum only uses the place archive that was provided for this page." accent="emerald">
          <ul className="archive-ledger-list">
            {activeMuseum.sourcesUsed.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </MuseumSection>
      </section>

      <div className="archive-action-row">
        <TornPaperButton href="/museum">
          Back to museum
        </TornPaperButton>
        <TornPaperButton href={{ pathname: '/add-memory', query: { place: place.id } }} tone="dark">
          Add another memory
        </TornPaperButton>
      </div>
    </ArchiveShell>
  );
}
