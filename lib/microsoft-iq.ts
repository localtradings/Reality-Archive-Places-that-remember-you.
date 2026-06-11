import 'server-only';

import type {
  MicrosoftIqLayer,
  MicrosoftIqMode,
  MuseumArchiveMemoryInput,
  MuseumGenerationRequestPayload,
} from '@/lib/museum-generation';

const AZURE_AI_SEARCH_API_VERSION = '2025-09-01';
const MICROSOFT_IQ_LAYER: MicrosoftIqLayer = 'foundry-iq';

type ArchiveSourceKind = 'place-metadata' | 'visitor-memory' | 'photo-caption' | 'voice-transcript' | 'mood';

export interface MicrosoftIqConfigStatus {
  enabled: boolean;
  configured: boolean;
  missingVariables: string[];
  indexNamePresent: boolean;
}

export interface MicrosoftIqSourceChunk {
  id: string;
  sourceKind: ArchiveSourceKind | 'indexed-archive-chunk';
  sourceLabel: string;
  title: string;
  content: string;
  citation: string;
}

export interface MicrosoftIqArchiveDocument {
  id: string;
  placeId: string;
  placeName: string;
  title: string;
  searchableText: string;
  metadata: {
    address: string;
    category: string;
    description: string;
    moods: string[];
    memoryCount: number;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  sourceKinds: string[];
}

export interface MicrosoftIqIndexDocument {
  id: string;
  placeId: string;
  placeName: string;
  title: string;
  sourceKind: string;
  sourceLabel: string;
  content: string;
  searchableText: string;
  citation: string;
  address: string;
  category: string;
  description: string;
  moods: string[];
  memoryCount: number;
  latitude?: number;
  longitude?: number;
}

export interface MicrosoftIqGroundingContext {
  layer: MicrosoftIqLayer;
  mode: MicrosoftIqMode;
  groundingSources: string[];
  citations: string[];
  chunks: MicrosoftIqSourceChunk[];
}

interface MicrosoftIqConfig extends MicrosoftIqConfigStatus {
  endpoint: string;
  apiKey: string;
  indexName: string;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBooleanFlag(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function cleanEndpoint(value: string) {
  return value.replace(/\/+$/, '');
}

function encodeDocumentKey(value: string) {
  return `ra-${Buffer.from(value, 'utf8').toString('base64url')}`;
}

function buildChunkId(placeId: string, kind: string, suffix: string) {
  return encodeDocumentKey(`${placeId}:${kind}:${suffix}`);
}

function buildChunkTitle(label: string, detail?: string) {
  return detail ? `${label}: ${detail}` : label;
}

function buildCitation(placeId: string, kind: string, suffix: string) {
  return `archive://${placeId}/${kind}/${suffix}`;
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function memoryLabel(memory: MuseumArchiveMemoryInput) {
  return memory.title || `Memory ${memory.id}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function buildSearchQuery(payload: MuseumGenerationRequestPayload) {
  const parts = [
    payload.place.name,
    payload.place.category,
    payload.place.address,
    payload.place.description,
    payload.place.moods.join(' '),
    ...payload.memories.slice(0, 4).map((memory) => memory.text),
    ...payload.memories.slice(0, 2).map((memory) => memory.photoCaption || ''),
    ...payload.memories.slice(0, 2).map((memory) => memory.voiceTranscript || ''),
  ].filter((part) => part.trim().length > 0);

  return truncateText(parts.join(' '), 600);
}

function mapKindToLabel(kind: string) {
  switch (kind) {
    case 'place-metadata':
      return 'Place metadata';
    case 'visitor-memory':
      return 'Visitor memories';
    case 'photo-caption':
      return 'Photo captions';
    case 'voice-transcript':
      return 'Voice transcripts';
    case 'mood':
      return 'Moods';
    default:
      return 'Azure AI Search indexed chunk';
  }
}

function buildPreparedGroundingContext(chunks: MicrosoftIqSourceChunk[]): MicrosoftIqGroundingContext {
  return {
    layer: MICROSOFT_IQ_LAYER,
    mode: 'prepared',
    groundingSources: uniqueStrings(chunks.map((chunk) => chunk.sourceLabel)),
    citations: uniqueStrings(chunks.map((chunk) => chunk.citation)),
    chunks,
  };
}

export function getMicrosoftIqConfigStatus(): MicrosoftIqConfigStatus {
  const enabled = normalizeBooleanFlag(process.env.MICROSOFT_IQ_ENABLED);
  const endpoint = normalizeText(process.env.AZURE_AI_SEARCH_ENDPOINT);
  const apiKey = normalizeText(process.env.AZURE_AI_SEARCH_API_KEY);
  const indexName = normalizeText(process.env.AZURE_AI_SEARCH_INDEX_NAME);
  const missingVariables = [
    !endpoint ? 'AZURE_AI_SEARCH_ENDPOINT' : '',
    !apiKey ? 'AZURE_AI_SEARCH_API_KEY' : '',
    !indexName ? 'AZURE_AI_SEARCH_INDEX_NAME' : '',
  ].filter((value) => value.length > 0);

  return {
    enabled,
    configured: missingVariables.length === 0,
    missingVariables,
    indexNamePresent: indexName.length > 0,
  };
}

function getMicrosoftIqConfig(): MicrosoftIqConfig {
  const status = getMicrosoftIqConfigStatus();
  const endpoint = cleanEndpoint(normalizeText(process.env.AZURE_AI_SEARCH_ENDPOINT));
  const apiKey = normalizeText(process.env.AZURE_AI_SEARCH_API_KEY);
  const indexName = normalizeText(process.env.AZURE_AI_SEARCH_INDEX_NAME);

  return {
    ...status,
    endpoint,
    apiKey,
    indexName,
  };
}

export function buildMicrosoftIqArchiveDocument(payload: MuseumGenerationRequestPayload): {
  document: MicrosoftIqArchiveDocument;
  sourceChunks: MicrosoftIqSourceChunk[];
} {
  const sourceChunks: MicrosoftIqSourceChunk[] = [];
  const metadataChunkId = buildChunkId(payload.place.id, 'place-metadata', 'primary');

  sourceChunks.push({
    id: metadataChunkId,
    sourceKind: 'place-metadata',
    sourceLabel: 'Place metadata',
    title: buildChunkTitle('Place metadata', payload.place.name),
    content: [
      `Name: ${payload.place.name}`,
      `Category: ${payload.place.category}`,
      `Address: ${payload.place.address}`,
      `Description: ${payload.place.description}`,
      `Moods: ${payload.place.moods.join(', ')}`,
    ].join('\n'),
    citation: buildCitation(payload.place.id, 'place-metadata', 'primary'),
  });

  payload.place.moods.forEach((mood, index) => {
    const chunkId = buildChunkId(payload.place.id, 'mood', `${index + 1}`);
    sourceChunks.push({
      id: chunkId,
      sourceKind: 'mood',
      sourceLabel: 'Moods',
      title: buildChunkTitle('Mood', mood),
      content: `${payload.place.name} carries the mood "${mood}".`,
      citation: buildCitation(payload.place.id, 'mood', `${index + 1}`),
    });
  });

  payload.memories.forEach((memory, index) => {
    const chunkId = buildChunkId(payload.place.id, 'visitor-memory', `${index + 1}`);
    sourceChunks.push({
      id: chunkId,
      sourceKind: 'visitor-memory',
      sourceLabel: 'Visitor memories',
      title: buildChunkTitle('Visitor memory', memoryLabel(memory)),
      content: [
        `Place: ${memory.placeName}`,
        memory.mood ? `Mood: ${memory.mood}` : '',
        memory.tag ? `Tag: ${memory.tag}` : '',
        `Type: ${memory.type}`,
        `Text: ${memory.text}`,
      ]
        .filter((line) => line.length > 0)
        .join('\n'),
      citation: buildCitation(payload.place.id, 'visitor-memory', `${index + 1}`),
    });

    if (memory.photoCaption) {
      const photoChunkId = buildChunkId(payload.place.id, 'photo-caption', `${index + 1}`);
      sourceChunks.push({
        id: photoChunkId,
        sourceKind: 'photo-caption',
        sourceLabel: 'Photo captions',
        title: buildChunkTitle('Photo caption', memoryLabel(memory)),
        content: memory.photoCaption,
        citation: buildCitation(payload.place.id, 'photo-caption', `${index + 1}`),
      });
    }

    if (memory.voiceTranscript) {
      const voiceChunkId = buildChunkId(payload.place.id, 'voice-transcript', `${index + 1}`);
      sourceChunks.push({
        id: voiceChunkId,
        sourceKind: 'voice-transcript',
        sourceLabel: 'Voice transcripts',
        title: buildChunkTitle('Voice transcript', memoryLabel(memory)),
        content: memory.voiceTranscript,
        citation: buildCitation(payload.place.id, 'voice-transcript', `${index + 1}`),
      });
    }
  });

  const document: MicrosoftIqArchiveDocument = {
    id: `place-archive-${payload.place.id}`,
    placeId: payload.place.id,
    placeName: payload.place.name,
    title: `${payload.place.name} archive`,
    searchableText: sourceChunks.map((chunk) => chunk.content).join('\n\n'),
    metadata: {
      address: payload.place.address,
      category: payload.place.category,
      description: payload.place.description,
      moods: payload.place.moods,
      memoryCount: payload.memories.length,
      coordinates: payload.place.coordinates,
    },
    sourceKinds: uniqueStrings(sourceChunks.map((chunk) => chunk.sourceKind)),
  };

  return { document, sourceChunks };
}

export function buildMicrosoftIqIndexDocuments(payload: MuseumGenerationRequestPayload) {
  const archive = buildMicrosoftIqArchiveDocument(payload);
  const archiveDocument: MicrosoftIqIndexDocument = {
    id: archive.document.id,
    placeId: archive.document.placeId,
    placeName: archive.document.placeName,
    title: archive.document.title,
    sourceKind: 'archive',
    sourceLabel: 'Archive document',
    content: archive.document.searchableText,
    searchableText: archive.document.searchableText,
    citation: `archive://${archive.document.placeId}/archive`,
    address: archive.document.metadata.address,
    category: archive.document.metadata.category,
    description: archive.document.metadata.description,
    moods: archive.document.metadata.moods,
    memoryCount: archive.document.metadata.memoryCount,
    ...(archive.document.metadata.coordinates ? { latitude: archive.document.metadata.coordinates.latitude, longitude: archive.document.metadata.coordinates.longitude } : {}),
  };

  const chunkDocuments: MicrosoftIqIndexDocument[] = archive.sourceChunks.map((chunk) => ({
    id: chunk.id,
    placeId: payload.place.id,
    placeName: payload.place.name,
    title: chunk.title,
    sourceKind: chunk.sourceKind,
    sourceLabel: chunk.sourceLabel,
    content: chunk.content,
    searchableText: chunk.content,
    citation: chunk.citation,
    address: payload.place.address,
    category: payload.place.category,
    description: payload.place.description,
    moods: payload.place.moods,
    memoryCount: payload.memories.length,
    ...(payload.place.coordinates ? { latitude: payload.place.coordinates.latitude, longitude: payload.place.coordinates.longitude } : {}),
  }));

  return {
    archiveDocument,
    chunkDocuments,
    documents: [archiveDocument, ...chunkDocuments],
  };
}

export function buildMicrosoftIqIndexDefinition(indexName: string) {
  return {
    name: indexName,
    fields: [
      { name: 'id', type: 'Edm.String', key: true, searchable: false, filterable: true, retrievable: true, sortable: true },
      { name: 'placeId', type: 'Edm.String', searchable: false, filterable: true, retrievable: true, sortable: true },
      { name: 'placeName', type: 'Edm.String', searchable: true, filterable: true, retrievable: true, sortable: true },
      { name: 'title', type: 'Edm.String', searchable: true, filterable: false, retrievable: true, sortable: false },
      { name: 'sourceKind', type: 'Edm.String', searchable: true, filterable: true, retrievable: true, sortable: true },
      { name: 'sourceLabel', type: 'Edm.String', searchable: true, filterable: true, retrievable: true, sortable: true },
      { name: 'content', type: 'Edm.String', searchable: true, filterable: false, retrievable: true, sortable: false },
      { name: 'searchableText', type: 'Edm.String', searchable: true, filterable: false, retrievable: true, sortable: false },
      { name: 'citation', type: 'Edm.String', searchable: false, filterable: true, retrievable: true, sortable: false },
      { name: 'address', type: 'Edm.String', searchable: true, filterable: true, retrievable: true, sortable: false },
      { name: 'category', type: 'Edm.String', searchable: true, filterable: true, retrievable: true, sortable: false },
      { name: 'description', type: 'Edm.String', searchable: true, filterable: false, retrievable: true, sortable: false },
      { name: 'moods', type: 'Collection(Edm.String)', searchable: true, filterable: true, retrievable: true },
      { name: 'memoryCount', type: 'Edm.Int32', searchable: false, filterable: true, retrievable: true, sortable: true },
      { name: 'latitude', type: 'Edm.Double', searchable: false, filterable: false, retrievable: true, sortable: false },
      { name: 'longitude', type: 'Edm.Double', searchable: false, filterable: false, retrievable: true, sortable: false },
    ],
  };
}

async function retrieveLiveSearchChunks(
  config: MicrosoftIqConfig,
  payload: MuseumGenerationRequestPayload,
): Promise<MicrosoftIqSourceChunk[]> {
  const query = buildSearchQuery(payload);
  if (!query) {
    return [];
  }

  const response = await fetch(
    `${config.endpoint}/indexes/${encodeURIComponent(config.indexName)}/docs/search?api-version=${AZURE_AI_SEARCH_API_VERSION}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey,
      },
      body: JSON.stringify({
        search: query,
        top: 5,
        count: true,
        queryType: 'simple',
        searchMode: 'any',
        searchFields: 'placeName,title,sourceLabel,content,searchableText,description,category',
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`Azure AI Search returned ${response.status}.`);
  }

  const data = (await response.json()) as { value?: Array<Record<string, unknown>> };
  const results = Array.isArray(data.value) ? data.value : [];

  return results
    .map((item, index) => {
      const content = normalizeText(item.content) || normalizeText(item.chunk) || normalizeText(item.text) || normalizeText(item.description);
      if (!content) {
        return null;
      }

      const rawKind = normalizeText(item.sourceKind) || normalizeText(item.kind) || 'indexed-archive-chunk';
      const sourceLabel = normalizeText(item.sourceLabel) || mapKindToLabel(rawKind);
      const id = normalizeText(item.id) || normalizeText(item.chunkId) || `result-${index + 1}`;
      const title = normalizeText(item.title) || normalizeText(item.name) || buildChunkTitle(sourceLabel, `${index + 1}`);
      const citation =
        normalizeText(item.citation) ||
        normalizeText(item.source) ||
        normalizeText(item.path) ||
        `azure-search://${config.indexName}/${id}`;

      return {
        id,
        sourceKind: rawKind as MicrosoftIqSourceChunk['sourceKind'],
        sourceLabel,
        title,
        content: truncateText(content, 1200),
        citation,
      } satisfies MicrosoftIqSourceChunk;
    })
    .filter((chunk): chunk is MicrosoftIqSourceChunk => chunk !== null);
}

export async function buildMicrosoftIqGroundingContext(payload: MuseumGenerationRequestPayload): Promise<MicrosoftIqGroundingContext> {
  const config = getMicrosoftIqConfig();
  const archive = buildMicrosoftIqArchiveDocument(payload);
  const preparedContext = buildPreparedGroundingContext(archive.sourceChunks);

  if (!config.enabled || !config.configured) {
    return preparedContext;
  }

  try {
    const liveChunks = await retrieveLiveSearchChunks(config, payload);
    if (liveChunks.length === 0) {
      return preparedContext;
    }

    return {
      layer: MICROSOFT_IQ_LAYER,
      mode: 'live',
      groundingSources: uniqueStrings(liveChunks.map((chunk) => chunk.sourceLabel)),
      citations: uniqueStrings(liveChunks.map((chunk) => chunk.citation)),
      chunks: liveChunks,
    };
  } catch (error) {
    console.error('Microsoft IQ retrieval failed:', error);
    return preparedContext;
  }
}

export async function ensureMicrosoftIqSearchIndex(indexName: string) {
  const config = getMicrosoftIqConfig();
  if (!config.enabled || !config.configured) {
    return {
      created: false,
      status: 'prepared' as const,
      reason: 'Microsoft IQ search is not fully configured.',
    };
  }

  const response = await fetch(`${config.endpoint}/indexes/${encodeURIComponent(indexName)}?api-version=${AZURE_AI_SEARCH_API_VERSION}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify(buildMicrosoftIqIndexDefinition(indexName)),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 800);
    throw new Error(`Azure AI Search index create/update failed with ${response.status}: ${errorText}`);
  }

  return {
    created: true,
    status: 'live' as const,
    reason: undefined,
  };
}

export async function uploadMicrosoftIqArchiveDocuments(indexName: string, documents: MicrosoftIqIndexDocument[]) {
  const config = getMicrosoftIqConfig();
  if (!config.enabled || !config.configured) {
    return {
      uploaded: 0,
      status: 'prepared' as const,
      reason: 'Microsoft IQ search is not fully configured.',
    };
  }

  const response = await fetch(`${config.endpoint}/indexes/${encodeURIComponent(indexName)}/docs/index?api-version=${AZURE_AI_SEARCH_API_VERSION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify({
      value: documents.map((document) => ({
        '@search.action': 'mergeOrUpload',
        ...document,
      })),
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 800);
    throw new Error(`Azure AI Search document upload failed with ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as { value?: Array<{ key?: string; status?: boolean; statusCode?: number }> };
  return {
    uploaded: Array.isArray(data.value) ? data.value.length : documents.length,
    status: 'live' as const,
    reason: undefined,
  };
}
