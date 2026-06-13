import type { SavedMemory } from '@/lib/local-memory';
import type { MuseumGenerationRequestPayload } from '@/lib/museum-generation';

export type MuseumCollectionMode = 'local' | 'prepared' | 'live';
export type MuseumCollectionProvider = 'local' | 'foundry-iq';

export interface MuseumPlaceSummary {
  placeId: string;
  title: string;
  summary: string;
  mood: string;
  memoryHighlights: string[];
  citations: string[];
}

export interface MuseumCollectionSummaryResponse {
  mode: MuseumCollectionMode;
  provider: MuseumCollectionProvider;
  places: MuseumPlaceSummary[];
  sourceChunkCount?: number;
  documentsUploaded?: number;
  reason?: string;
}

function firstMeaningful(values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? '';
}

export function buildLocalPlaceSummary(payload: MuseumGenerationRequestPayload): MuseumPlaceSummary {
  const localMemoryCount = payload.memories.filter((memory) => memory.origin === 'local').length;
  const photoCount = payload.memories.filter((memory) => memory.photoCaption).length;
  const voiceCount = payload.memories.filter((memory) => memory.voiceTranscript).length;
  const mood = payload.place.moods[0] ?? 'Calm';
  const firstMemory = firstMeaningful(payload.memories.map((memory) => memory.text));
  const summaryParts = [
    `${payload.place.name} is a ${payload.place.category.toLowerCase()} in your personal archive.`,
    payload.place.description,
    localMemoryCount > 0
      ? `You added ${localMemoryCount} local ${localMemoryCount === 1 ? 'memory' : 'memories'} for this place.`
      : 'No personal memories have been added yet.',
    photoCount > 0 ? `${photoCount} photo ${photoCount === 1 ? 'caption adds' : 'captions add'} visual context.` : '',
    voiceCount > 0 ? `${voiceCount} voice ${voiceCount === 1 ? 'transcript adds' : 'transcripts add'} spoken context.` : '',
  ].filter((part) => part.length > 0);

  return {
    placeId: payload.place.id,
    title: payload.place.name,
    summary: summaryParts.join(' '),
    mood,
    memoryHighlights: [
      firstMemory || 'This exhibit is waiting for your first saved memory.',
      `Archive mood: ${payload.place.moods.join(', ') || mood}.`,
      `Sources include place metadata${payload.memories.length > 0 ? ' and saved memories' : ''}.`,
    ],
    citations: [`archive://${payload.place.id}/place-metadata`],
  };
}

export function buildLocalCollectionSummary(payloads: MuseumGenerationRequestPayload[]): MuseumCollectionSummaryResponse {
  return {
    mode: 'local',
    provider: 'local',
    places: payloads.map(buildLocalPlaceSummary),
    reason: 'Local summaries are generated in the browser from saved archive data.',
  };
}

export function countPayloadMemories(payloads: MuseumGenerationRequestPayload[]) {
  return payloads.reduce((total, payload) => total + payload.memories.length, 0);
}

export function summarizeSavedMemoryCounts(memories: SavedMemory[]) {
  return {
    text: memories.filter((memory) => memory.type === 'text').length,
    photo: memories.filter((memory) => memory.type === 'photo').length,
    voice: memories.filter((memory) => memory.type === 'voice').length,
  };
}
