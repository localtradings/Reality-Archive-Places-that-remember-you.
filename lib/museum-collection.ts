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

function joinShortList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

export function buildLocalPlaceSummary(payload: MuseumGenerationRequestPayload): MuseumPlaceSummary {
  const localMemoryCount = payload.memories.filter((memory) => memory.origin === 'local').length;
  const photoCount = payload.memories.filter((memory) => memory.photoCaption).length;
  const voiceCount = payload.memories.filter((memory) => memory.voiceTranscript).length;
  const mood = payload.place.moods[0] ?? 'Calm';
  const firstMemory = firstMeaningful(payload.memories.map((memory) => memory.text));
  const firstPhotoCaption = firstMeaningful(payload.memories.map((memory) => memory.photoCaption));
  const firstVoiceTranscript = firstMeaningful(payload.memories.map((memory) => memory.voiceTranscript));
  const memoryTypes = joinShortList(
    [
      localMemoryCount > 0 ? `${localMemoryCount} saved ${localMemoryCount === 1 ? 'memory' : 'memories'}` : '',
      photoCount > 0 ? `${photoCount} photo ${photoCount === 1 ? 'caption' : 'captions'}` : '',
      voiceCount > 0 ? `${voiceCount} voice ${voiceCount === 1 ? 'transcript' : 'transcripts'}` : '',
    ].filter((value) => value.length > 0),
  );
  const story =
    payload.memories.length > 0
      ? [
          `${payload.place.name} becomes a ${mood.toLowerCase()} exhibit in your living museum, held by the details you saved about this ${payload.place.category.toLowerCase()}.`,
          payload.place.description,
          firstMemory ? `The story begins with this memory: ${firstMemory}` : '',
          firstPhotoCaption ? `A photo adds this visual note: ${firstPhotoCaption}` : '',
          firstVoiceTranscript ? `A voice memory adds this spoken detail: ${firstVoiceTranscript}` : '',
          memoryTypes ? `Together, ${memoryTypes} shape the way this place is remembered.` : '',
        ]
          .filter((part) => part.length > 0)
          .join(' ')
      : `${payload.place.name} is saved in your living museum as a ${mood.toLowerCase()} ${payload.place.category.toLowerCase()}. ${payload.place.description} The exhibit is waiting for its first personal memory, so the story stays open until you add text, a photo, or a voice note.`;

  return {
    placeId: payload.place.id,
    title: payload.place.name,
    summary: story,
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
