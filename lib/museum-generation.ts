import type { SavedMemory } from '@/lib/local-memory';
import type { MemoryEntry, Mood, MuseumPreview, Place } from '@/types';

export type MuseumMemoryType = 'text' | 'photo' | 'voice';
export type MicrosoftIqLayer = 'foundry-iq';
export type MicrosoftIqMode = 'live' | 'prepared';
export type MuseumGenerationProvider = MicrosoftIqLayer | 'fallback';

export interface MuseumArchiveMemoryInput {
  id: string;
  origin: 'mock' | 'local';
  type: MuseumMemoryType;
  title?: string;
  text: string;
  mood?: string;
  tag?: string;
  placeName: string;
  photoCaption?: string;
  voiceTranscript?: string;
  createdAt?: string;
}

export interface MuseumGenerationPlaceInput {
  id: string;
  name: string;
  address: string;
  category: string;
  description: string;
  origin?: Place['origin'];
  coordinates?: Place['coordinates'];
  moods: Place['moods'];
}

export interface MuseumGenerationRequestPayload {
  place: MuseumGenerationPlaceInput;
  memories: MuseumArchiveMemoryInput[];
  fallbackMuseum: MuseumPreview;
}

export interface MuseumGenerationResponseBody {
  generated: boolean;
  museum: MuseumPreview;
  source: MicrosoftIqLayer | 'fallback';
  provider: MuseumGenerationProvider;
  microsoftIqLayer: MicrosoftIqLayer;
  microsoftIqMode: MicrosoftIqMode;
  groundingSources: string[];
  citations: string[];
  reason?: string;
  model?: string;
}

export const MUSEUM_GENERATION_CACHE_PREFIX = 'reality-archive:museum-generation:v2:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isMood(value: string): value is Mood {
  return value === 'Historic' || value === 'Calm' || value === 'Romantic' || value === 'Colorful' || value === 'Spiritual' || value === 'Energetic';
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

export function buildMuseumGenerationPlaceInput(place: Place): MuseumGenerationPlaceInput {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: place.category,
    description: place.description,
    origin: place.origin,
    coordinates: place.coordinates,
    moods: place.moods,
  };
}

export function normalizeMuseumGenerationPlaceInput(value: unknown): MuseumGenerationPlaceInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeText(value.id);
  const name = normalizeText(value.name);
  const address = normalizeText(value.address);
  const category = normalizeText(value.category);
  const description = normalizeText(value.description);
  const moods = Array.isArray(value.moods) ? value.moods.map(normalizeText).filter(isMood) : [];

  if (!id || !name || !address || !category || !description || moods.length === 0) {
    return null;
  }

  const origin = value.origin === 'mock' || value.origin === 'geoapify' ? value.origin : undefined;
  const coordinates =
    isRecord(value.coordinates) && typeof value.coordinates.latitude === 'number' && typeof value.coordinates.longitude === 'number'
      ? {
          latitude: value.coordinates.latitude,
          longitude: value.coordinates.longitude,
        }
      : undefined;

  return {
    id,
    name,
    address,
    category,
    description,
    origin,
    coordinates,
    moods,
  };
}

function buildMockMemoryInput(place: Place, memory: MemoryEntry): MuseumArchiveMemoryInput {
  return {
    id: memory.id,
    origin: 'mock',
    type: 'text',
    title: memory.title,
    text: memory.note,
    tag: memory.tag,
    placeName: place.name,
  };
}

function buildLocalMemoryInput(memory: SavedMemory): MuseumArchiveMemoryInput {
  return {
    id: memory.id,
    origin: 'local',
    type: memory.type,
    text: memory.text,
    mood: memory.mood,
    placeName: memory.placeName,
    photoCaption: memory.photoCaption,
    voiceTranscript: memory.voiceTranscript,
    createdAt: memory.createdAt,
  };
}

export function normalizeMuseumArchiveMemoryInput(value: unknown): MuseumArchiveMemoryInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeText(value.id);
  const origin = value.origin === 'mock' || value.origin === 'local' ? value.origin : null;
  const type = value.type === 'text' || value.type === 'photo' || value.type === 'voice' ? value.type : null;
  const text = normalizeText(value.text);
  const placeName = normalizeText(value.placeName);

  if (!id || !origin || !type || !text || !placeName) {
    return null;
  }

  return {
    id,
    origin,
    type,
    title: normalizeText(value.title) || undefined,
    text,
    mood: normalizeText(value.mood) || undefined,
    tag: normalizeText(value.tag) || undefined,
    placeName,
    photoCaption: normalizeText(value.photoCaption) || undefined,
    voiceTranscript: normalizeText(value.voiceTranscript) || undefined,
    createdAt: normalizeText(value.createdAt) || undefined,
  };
}

export function buildMuseumGenerationRequestPayload(place: Place, localMemories: SavedMemory[]): MuseumGenerationRequestPayload {
  return {
    place: buildMuseumGenerationPlaceInput(place),
    memories: [...localMemories.map(buildLocalMemoryInput), ...place.memories.map((memory) => buildMockMemoryInput(place, memory))],
    fallbackMuseum: place.museum,
  };
}

export function createMuseumArchiveSignature(payload: MuseumGenerationRequestPayload) {
  return hashString(
    JSON.stringify({
      placeId: payload.place.id,
      placeName: payload.place.name,
      placeAddress: payload.place.address,
      placeCategory: payload.place.category,
      memories: payload.memories.map((memory) => ({
        id: memory.id,
        origin: memory.origin,
        type: memory.type,
        title: memory.title ?? '',
        text: memory.text,
        mood: memory.mood ?? '',
        tag: memory.tag ?? '',
        placeName: memory.placeName,
        photoCaption: memory.photoCaption ?? '',
        voiceTranscript: memory.voiceTranscript ?? '',
        createdAt: memory.createdAt ?? '',
      })),
    }),
  );
}

export function buildMuseumGenerationCacheKey(placeId: string, signature: string) {
  return `${MUSEUM_GENERATION_CACHE_PREFIX}${encodeURIComponent(placeId)}:${signature}`;
}

export function readMuseumGenerationCache(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isMuseumGenerationResponseBody(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeMuseumGenerationCache(key: string, value: MuseumGenerationResponseBody) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota failures and continue with the live response.
  }
}

export function buildArchivePromptLines(memories: MuseumArchiveMemoryInput[]) {
  if (memories.length === 0) {
    return ['No memories are available yet. The archive is still growing.'];
  }

  return memories.map((memory, index) => {
    const parts = [
      `${index + 1}. [${memory.origin} ${memory.type}]`,
      memory.title ? `title: ${memory.title}` : null,
      `place: ${memory.placeName}`,
      memory.tag ? `tag: ${memory.tag}` : null,
      memory.mood ? `mood: ${memory.mood}` : null,
      memory.text ? `text: ${memory.text}` : null,
      memory.photoCaption ? `photo caption: ${memory.photoCaption}` : null,
      memory.voiceTranscript ? `voice transcript: ${memory.voiceTranscript}` : null,
      memory.createdAt ? `created at: ${memory.createdAt}` : null,
    ].filter((part): part is string => Boolean(part));

    return parts.join(' | ');
  });
}

export function buildMuseumGenerationInstructions() {
  return [
    'You are Reality Archive, a mobile museum curator for places the user explores.',
    'Use only the provided place metadata and memory archive. Do not invent historical facts, dates, events, or claims that are not present in the input.',
    'Treat the Microsoft IQ grounding context as the highest-priority retrieval layer. If it is in prepared mode, use only the prepared archive chunks that were supplied.',
    'If the archive has limited information, say the archive is still growing or that the museum is being shaped from a small set of memories.',
    'Return only valid JSON that matches the requested schema. Do not wrap the result in markdown or extra commentary.',
    'Keep the tone warm, polished, and exhibit-like. The copy should feel like a living museum preview for a phone screen.',
  ].join(' ');
}

export function buildMuseumGenerationInput(
  payload: MuseumGenerationRequestPayload,
  groundingContext: {
    layer: MicrosoftIqLayer;
    mode: MicrosoftIqMode;
    groundingSources: string[];
    citations: string[];
    chunks: Array<{
      id: string;
      sourceKind: string;
      sourceLabel: string;
      content: string;
      citation: string;
    }>;
  },
) {
  return JSON.stringify(
    {
      place: payload.place,
      memories: payload.memories,
      archiveSummary: buildArchivePromptLines(payload.memories),
      microsoftIqGrounding: groundingContext,
    },
    null,
    2,
  );
}

export function normalizeMuseumPreview(value: unknown): MuseumPreview | null {
  if (!isRecord(value)) {
    return null;
  }

  const livingExhibit = normalizeText(value.livingExhibit);
  const placeMood = normalizeText(value.placeMood);
  const memoryWallSummary = normalizeText(value.memoryWallSummary);
  const voiceTourScript = toStringArray(value.voiceTourScript);
  const visitorTips = toStringArray(value.visitorTips);
  const sourcesUsed = toStringArray(value.sourcesUsed);

  if (!livingExhibit || !placeMood || !memoryWallSummary || voiceTourScript.length === 0 || visitorTips.length === 0 || sourcesUsed.length === 0) {
    return null;
  }

  if (!isRecord(value.miniQuest)) {
    return null;
  }

  const miniQuestTitle = normalizeText(value.miniQuest.title);
  const miniQuestPrompt = normalizeText(value.miniQuest.prompt);
  const miniQuestReward = normalizeText(value.miniQuest.reward);

  if (!miniQuestTitle || !miniQuestPrompt || !miniQuestReward) {
    return null;
  }

  return {
    livingExhibit,
    placeMood,
    memoryWallSummary,
    voiceTourScript,
    visitorTips,
    miniQuest: {
      title: miniQuestTitle,
      prompt: miniQuestPrompt,
      reward: miniQuestReward,
    },
    sourcesUsed,
  };
}

export function isMuseumGenerationResponseBody(value: unknown): value is MuseumGenerationResponseBody {
  if (!isRecord(value)) {
    return false;
  }

  const generated = value.generated;
  const source = value.source;
  const provider = value.provider;
  const museum = normalizeMuseumPreview(value.museum);
  const microsoftIqLayer = value.microsoftIqLayer;
  const microsoftIqMode = value.microsoftIqMode;
  const groundingSources = toStringArray(value.groundingSources);
  const citations = toStringArray(value.citations);

  return (
    typeof generated === 'boolean' &&
    (source === 'foundry-iq' || source === 'fallback') &&
    (provider === 'foundry-iq' || provider === 'fallback') &&
    microsoftIqLayer === 'foundry-iq' &&
    (microsoftIqMode === 'live' || microsoftIqMode === 'prepared') &&
    Array.isArray(groundingSources) &&
    Array.isArray(citations) &&
    museum !== null
  );
}
