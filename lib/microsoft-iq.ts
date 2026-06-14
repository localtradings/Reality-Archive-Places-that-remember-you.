import 'server-only';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  MicrosoftIqLayer,
  MicrosoftIqMode,
  MuseumArchiveMemoryInput,
  MuseumGenerationRequestPayload,
} from '@/lib/museum-generation';
import {
  buildLocalPlaceSummary,
  type MuseumCollectionSummaryResponse,
  type MuseumPlaceSummary,
} from '@/lib/museum-collection';

const AZURE_AI_SEARCH_API_VERSION = '2025-09-01';
const AZURE_AI_AGENT_API_VERSION = normalizeText(process.env.AZURE_AI_AGENT_API_VERSION) || '2025-05-01';
const AZURE_AI_INFERENCE_API_VERSION = normalizeText(process.env.AZURE_AI_INFERENCE_API_VERSION) || '2024-05-01-preview';
const AZURE_AI_FOUNDRY_SCOPE = 'https://ai.azure.com/.default';
const MICROSOFT_IQ_LAYER: MicrosoftIqLayer = 'foundry-iq';
const execFileAsync = promisify(execFile);

type ArchiveSourceKind = 'place-metadata' | 'visitor-memory' | 'photo-caption' | 'voice-transcript' | 'mood';

export interface MicrosoftIqConfigStatus {
  enabled: boolean;
  configured: boolean;
  agentConfigured: boolean;
  missingVariables: string[];
  missingAgentVariables: string[];
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

interface FoundryAgentConfig {
  projectEndpoint: string;
  agentId: string;
  agentApiKey?: string;
  authMode: 'azure-cli' | 'api-key';
}

interface FoundryChatDeployment {
  endpoint: string;
  model: string;
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

function deriveFoundryResourceEndpoint(projectEndpoint: string) {
  try {
    const url = new URL(projectEndpoint);
    if (url.hostname.endsWith('.services.ai.azure.com') || url.hostname.endsWith('.cognitiveservices.azure.com')) {
      return url.origin;
    }
  } catch {
    return '';
  }

  const workspaceSegment = decodeURIComponent(projectEndpoint).match(/\/workspaces\/([^/?]+)/)?.[1];
  const resourceName = workspaceSegment?.split('@')[0];
  if (!resourceName) {
    return '';
  }

  return `https://${resourceName}.services.ai.azure.com`;
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
  const projectEndpoint = normalizeText(process.env.AZURE_AI_PROJECT_ENDPOINT);
  const agentId = normalizeText(process.env.AZURE_AI_AGENT_ID);
  const agentApiKey = normalizeText(process.env.AZURE_AI_AGENT_API_KEY);
  const agentUsesAzureCli = normalizeText(process.env.AZURE_AI_AGENT_AUTH_MODE).toLowerCase() !== 'api-key';
  const missingVariables = [
    !endpoint ? 'AZURE_AI_SEARCH_ENDPOINT' : '',
    !apiKey ? 'AZURE_AI_SEARCH_API_KEY' : '',
    !indexName ? 'AZURE_AI_SEARCH_INDEX_NAME' : '',
  ].filter((value) => value.length > 0);
  const missingAgentVariables = [
    !projectEndpoint ? 'AZURE_AI_PROJECT_ENDPOINT' : '',
    !agentId ? 'AZURE_AI_AGENT_ID' : '',
    !agentUsesAzureCli && !agentApiKey ? 'AZURE_AI_AGENT_API_KEY' : '',
  ].filter((value) => value.length > 0);

  return {
    enabled,
    configured: missingVariables.length === 0,
    agentConfigured: missingAgentVariables.length === 0,
    missingVariables,
    missingAgentVariables,
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

function getFoundryAgentConfig(): FoundryAgentConfig | null {
  const projectEndpoint = cleanEndpoint(normalizeText(process.env.AZURE_AI_PROJECT_ENDPOINT));
  const agentId = normalizeText(process.env.AZURE_AI_AGENT_ID);
  const agentApiKey = normalizeText(process.env.AZURE_AI_AGENT_API_KEY);
  const authMode = normalizeText(process.env.AZURE_AI_AGENT_AUTH_MODE).toLowerCase() === 'api-key' ? 'api-key' : 'azure-cli';

  if (!projectEndpoint || !agentId || (authMode === 'api-key' && !agentApiKey)) {
    return null;
  }

  return {
    projectEndpoint,
    agentId,
    agentApiKey: agentApiKey || undefined,
    authMode,
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
    id: encodeDocumentKey(`place-archive-${payload.place.id}`),
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
        filter: `placeId eq '${payload.place.id.replace(/'/g, "''")}'`,
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

async function retrieveLiveSearchChunksForPayloads(
  config: MicrosoftIqConfig,
  payloads: MuseumGenerationRequestPayload[],
): Promise<Map<string, MicrosoftIqSourceChunk[]>> {
  const result = new Map<string, MicrosoftIqSourceChunk[]>();

  for (const payload of payloads) {
    try {
      result.set(payload.place.id, await retrieveLiveSearchChunks(config, payload));
    } catch (error) {
      console.error(`Microsoft IQ retrieval failed for ${payload.place.id}:`, error);
      result.set(payload.place.id, []);
    }
  }

  return result;
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

export async function indexMicrosoftIqCollection(payloads: MuseumGenerationRequestPayload[]) {
  const config = getMicrosoftIqConfig();
  if (!config.enabled || !config.configured) {
    return {
      status: 'prepared' as const,
      indexCreated: false,
      documentsUploaded: 0,
      sourceChunkCount: payloads.reduce((total, payload) => total + buildMicrosoftIqArchiveDocument(payload).sourceChunks.length, 0),
      reason: 'Microsoft IQ search is not fully configured.',
    };
  }

  const indexResult = await ensureMicrosoftIqSearchIndex(config.indexName);
  const documents = payloads.flatMap((payload) => buildMicrosoftIqIndexDocuments(payload).documents);
  const uploadResult = await uploadMicrosoftIqArchiveDocuments(config.indexName, documents);

  return {
    status: 'live' as const,
    indexCreated: indexResult.created,
    documentsUploaded: uploadResult.uploaded,
    sourceChunkCount: documents.length,
    reason: undefined,
  };
}

function buildFoundryPrompt(payloads: MuseumGenerationRequestPayload[], chunksByPlace: Map<string, MicrosoftIqSourceChunk[]>) {
  return JSON.stringify(
    {
      instruction:
        'You are Reality Archive, a museum curator. Use only the provided archive and Azure AI Search grounding chunks. Return strict JSON only. Write the summary as a warm museum story in real natural language, not a technical report. The summary must be one polished paragraph of about 80 to 140 words that weaves together the place details, text memories, photo captions, voice transcripts, mood, and category when they are available. Do not invent historical facts, dates, events, personal claims, objects, lighting, weather, sounds, sensory details, or scenes that are not explicitly supported by the input. If a detail is not written in the archive, leave it out. If the archive has no user memories yet, say that the exhibit is waiting for its first memory instead of making up a story.',
      requiredShape: {
        places: [
          {
            placeId: 'string',
            title: 'short exhibit title based on the place and memories',
            summary: 'one story-like paragraph grounded only in the provided context',
            mood: 'one mood word or short phrase grounded in the archive',
            memoryHighlights: ['2 to 4 short grounded details that shaped the story'],
            citations: ['string'],
          },
        ],
      },
      places: payloads.map((payload) => ({
        place: payload.place,
        memories: payload.memories,
        fallbackMuseum: payload.fallbackMuseum,
        groundingChunks: chunksByPlace.get(payload.place.id) ?? [],
      })),
    },
    null,
    2,
  );
}

function normalizeFoundrySummary(value: unknown, payloads: MuseumGenerationRequestPayload[]): MuseumPlaceSummary[] | null {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  const rawPlaces = Array.isArray(record?.places) ? record.places : null;
  if (!rawPlaces) {
    return null;
  }

  const validPlaceIds = new Set(payloads.map((payload) => payload.place.id));
  const summaries = rawPlaces
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as Record<string, unknown>;
      const placeId = normalizeText(row.placeId);
      const title = normalizeText(row.title);
      const summary = normalizeText(row.summary);
      const mood = normalizeText(row.mood);
      const memoryHighlights = Array.isArray(row.memoryHighlights)
        ? row.memoryHighlights.map(normalizeText).filter((value) => value.length > 0).slice(0, 4)
        : [];
      const citations = Array.isArray(row.citations)
        ? row.citations.map(normalizeText).filter((value) => value.length > 0).slice(0, 8)
        : [];

      if (!validPlaceIds.has(placeId) || !title || !summary || !mood) {
        return null;
      }

      return {
        placeId,
        title,
        summary,
        mood,
        memoryHighlights,
        citations,
      } satisfies MuseumPlaceSummary;
    })
    .filter((item): item is MuseumPlaceSummary => item !== null);

  return summaries.length > 0 ? summaries : null;
}

function tryParseJsonFromText(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]) as unknown;
    } catch {
      return null;
    }
  }
}

function getFoundryIqFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Azure CLI token unavailable') || message.includes('az account get-access-token')) {
    return 'Foundry IQ was called, but Azure CLI authentication is not available. Run az login, then refresh the museum page.';
  }

  if (message.includes('Azure AI Search index create/update failed') || message.includes('OperationNotAllowed')) {
    return 'Foundry IQ was called, but Azure AI Search could not update the grounding index right now. A grounded story fallback is shown.';
  }

  if (message.includes('Azure AI Search document upload failed') || message.includes('Invalid document key')) {
    return 'Foundry IQ was called, but Azure AI Search could not upload the archive documents. A grounded story fallback is shown.';
  }

  if (message.includes('does not have permissions') || message.includes('Forbidden')) {
    return 'Foundry IQ was called and Azure AI Search was updated, but the configured Foundry Agent identity does not have permission to run. A grounded story fallback is shown until the Azure role is fixed.';
  }

  if (message.includes('API version not supported')) {
    return 'Foundry IQ was called, but the configured Foundry Agent API version was rejected. A grounded story fallback is shown.';
  }

  return 'Foundry IQ live summaries failed, so a grounded story fallback is shown.';
}

async function getAzureCliFoundryAccessToken() {
  try {
    const { stdout } = await execFileAsync('az', ['account', 'get-access-token', '--scope', AZURE_AI_FOUNDRY_SCOPE, '--query', 'accessToken', '-o', 'tsv'], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    const token = normalizeText(stdout);
    if (!token) {
      throw new Error('Azure CLI returned an empty access token.');
    }

    return token;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Azure CLI token unavailable. Run az login and retry. Detail: ${detail}`);
  }
}

async function foundryFetch(config: FoundryAgentConfig, path: string, init: RequestInit = {}) {
  const separator = path.includes('?') ? '&' : '?';
  const authorization =
    config.authMode === 'azure-cli'
      ? `Bearer ${await getAzureCliFoundryAccessToken()}`
      : `Bearer ${config.agentApiKey}`;
  const response = await fetch(`${config.projectEndpoint}${path}${separator}api-version=${AZURE_AI_AGENT_API_VERSION}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      ...(config.authMode === 'api-key' && config.agentApiKey ? { 'api-key': config.agentApiKey } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 800);
    throw new Error(`Foundry Agent request failed with ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

async function getFoundryChatDeployment(config: FoundryAgentConfig): Promise<FoundryChatDeployment> {
  const configuredEndpoint = normalizeText(process.env.AZURE_AI_INFERENCE_ENDPOINT);
  const endpoint = cleanEndpoint(configuredEndpoint || deriveFoundryResourceEndpoint(config.projectEndpoint));
  if (!endpoint) {
    throw new Error('Foundry model endpoint could not be inferred from AZURE_AI_PROJECT_ENDPOINT.');
  }

  const configuredModel = normalizeText(process.env.AZURE_AI_MODEL_DEPLOYMENT) || normalizeText(process.env.AZURE_OPENAI_DEPLOYMENT);
  if (configuredModel) {
    return {
      endpoint,
      model: configuredModel,
    };
  }

  const response = await foundryFetch(config, '/deployments', {
    method: 'GET',
  });
  const deployments = Array.isArray(response.value) ? response.value : [];
  const chatDeployment = deployments.find((deployment) => {
    if (!deployment || typeof deployment !== 'object') {
      return false;
    }

    const capabilities = (deployment as Record<string, unknown>).capabilities;
    return typeof capabilities === 'object' && capabilities !== null && (capabilities as Record<string, unknown>).chat_completion === 'true';
  });

  const model = chatDeployment && typeof chatDeployment === 'object' ? normalizeText((chatDeployment as Record<string, unknown>).name) : '';
  if (!model) {
    throw new Error('No Foundry chat model deployment is available for live story generation.');
  }

  return {
    endpoint,
    model,
  };
}

async function runFoundryChatSummary(
  config: FoundryAgentConfig,
  payloads: MuseumGenerationRequestPayload[],
  chunksByPlace: Map<string, MicrosoftIqSourceChunk[]>,
) {
  const deployment = await getFoundryChatDeployment(config);
  const authorization =
    config.authMode === 'azure-cli'
      ? `Bearer ${await getAzureCliFoundryAccessToken()}`
      : `Bearer ${config.agentApiKey}`;
  const response = await fetch(`${deployment.endpoint}/models/chat/completions?api-version=${AZURE_AI_INFERENCE_API_VERSION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
      ...(config.authMode === 'api-key' && config.agentApiKey ? { 'api-key': config.agentApiKey } : {}),
    },
    body: JSON.stringify({
      model: deployment.model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are Reality Archive, a museum curator. Return strict JSON only. Use only the supplied archive context and citations. Do not add objects, lighting, weather, historical facts, or sensory details unless they are explicitly present in the input.',
        },
        {
          role: 'user',
          content: buildFoundryPrompt(payloads, chunksByPlace),
        },
      ],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 800);
    throw new Error(`Foundry model request failed with ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0];
  const message = firstChoice && typeof firstChoice === 'object' ? (firstChoice as Record<string, unknown>).message : null;
  const content = message && typeof message === 'object' ? normalizeText((message as Record<string, unknown>).content) : '';
  const parsed = tryParseJsonFromText(content);
  const summaries = parsed ? normalizeFoundrySummary(parsed, payloads) : null;
  if (!summaries) {
    throw new Error('Foundry model returned an invalid summary shape.');
  }

  return summaries;
}

async function runFoundryAgentSummary(
  config: FoundryAgentConfig,
  payloads: MuseumGenerationRequestPayload[],
  chunksByPlace: Map<string, MicrosoftIqSourceChunk[]>,
) {
  if (!config.agentId.startsWith('asst_')) {
    return runFoundryChatSummary(config, payloads, chunksByPlace);
  }

  const thread = await foundryFetch(config, '/threads', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const threadId = normalizeText(thread.id);
  if (!threadId) {
    throw new Error('Foundry Agent did not return a thread id.');
  }

  await foundryFetch(config, `/threads/${encodeURIComponent(threadId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      role: 'user',
      content: buildFoundryPrompt(payloads, chunksByPlace),
    }),
  });

  const run = await foundryFetch(config, `/threads/${encodeURIComponent(threadId)}/runs`, {
    method: 'POST',
    body: JSON.stringify({
      assistant_id: config.agentId,
    }),
  });
  const runId = normalizeText(run.id);
  if (!runId) {
    throw new Error('Foundry Agent did not return a run id.');
  }

  let status = normalizeText(run.status);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (status === 'completed') {
      break;
    }

    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      throw new Error(`Foundry Agent run ended with status: ${status}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1250));
    const nextRun = await foundryFetch(config, `/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}`, {
      method: 'GET',
    });
    status = normalizeText(nextRun.status);
  }

  if (status !== 'completed') {
    throw new Error('Foundry Agent summary timed out.');
  }

  const messages = await foundryFetch(config, `/threads/${encodeURIComponent(threadId)}/messages`, {
    method: 'GET',
  });
  const rawMessages = Array.isArray(messages.data) ? messages.data : Array.isArray(messages.value) ? messages.value : [];
  const assistantMessage = rawMessages.find((message) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    return (message as Record<string, unknown>).role === 'assistant';
  });

  if (!assistantMessage || typeof assistantMessage !== 'object') {
    throw new Error('Foundry Agent did not return an assistant message.');
  }

  const content = (assistantMessage as Record<string, unknown>).content;
  const textParts = Array.isArray(content)
    ? content
        .map((part) => {
          if (!part || typeof part !== 'object') {
            return '';
          }

          const record = part as Record<string, unknown>;
          if (typeof record.text === 'string') {
            return record.text;
          }

          if (record.text && typeof record.text === 'object' && typeof (record.text as Record<string, unknown>).value === 'string') {
            return (record.text as Record<string, unknown>).value as string;
          }

          return '';
        })
        .filter((value) => value.length > 0)
    : [normalizeText(content)];

  const parsed = tryParseJsonFromText(textParts.join('\n'));
  const summaries = parsed ? normalizeFoundrySummary(parsed, payloads) : null;
  if (!summaries) {
    throw new Error('Foundry Agent returned an invalid summary shape.');
  }

  return summaries;
}

export async function generateFoundryIqCollectionSummaries(payloads: MuseumGenerationRequestPayload[]): Promise<MuseumCollectionSummaryResponse> {
  const config = getMicrosoftIqConfig();
  const agentConfig = getFoundryAgentConfig();
  const localPlaces = payloads.map(buildLocalPlaceSummary);

  if (!config.enabled || !config.configured) {
    return {
      mode: 'prepared',
      provider: 'foundry-iq',
      places: localPlaces,
      sourceChunkCount: payloads.reduce((total, payload) => total + buildMicrosoftIqArchiveDocument(payload).sourceChunks.length, 0),
      reason: 'Azure AI Search is not fully configured, so local summaries remain visible.',
    };
  }

  let indexResult: Awaited<ReturnType<typeof indexMicrosoftIqCollection>>;
  try {
    indexResult = await indexMicrosoftIqCollection(payloads);
  } catch (error) {
    console.error('Foundry IQ indexing failed:', error);
    return {
      mode: 'prepared',
      provider: 'foundry-iq',
      places: localPlaces,
      sourceChunkCount: payloads.reduce((total, payload) => total + buildMicrosoftIqArchiveDocument(payload).sourceChunks.length, 0),
      reason: getFoundryIqFailureReason(error),
    };
  }

  if (!agentConfig) {
    return {
      mode: 'prepared',
      provider: 'foundry-iq',
      places: localPlaces,
      sourceChunkCount: indexResult.sourceChunkCount,
      documentsUploaded: indexResult.documentsUploaded,
      reason: 'Azure AI Search indexing is available, but Foundry Agent configuration is missing.',
    };
  }

  try {
    const chunksByPlace = await retrieveLiveSearchChunksForPayloads(config, payloads);
    const summaries = await runFoundryAgentSummary(agentConfig, payloads, chunksByPlace);
    const sourceChunkCount = Array.from(chunksByPlace.values()).reduce((total, chunks) => total + chunks.length, 0);

    return {
      mode: 'live',
      provider: 'foundry-iq',
      places: summaries,
      sourceChunkCount,
      documentsUploaded: indexResult.documentsUploaded,
      reason: undefined,
    };
  } catch (error) {
    console.error('Foundry IQ summary generation failed:', error);
    return {
      mode: 'prepared',
      provider: 'foundry-iq',
      places: localPlaces,
      sourceChunkCount: indexResult.sourceChunkCount,
      documentsUploaded: indexResult.documentsUploaded,
      reason: getFoundryIqFailureReason(error),
    };
  }
}
