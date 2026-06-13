import type { Mood } from '@/types';

export type MemoryType = 'text' | 'photo' | 'voice';

export interface SavedMemory {
  id: string;
  placeId: string;
  placeName: string;
  type: MemoryType;
  title?: string;
  mood: Mood;
  text: string;
  photoCaption?: string;
  imageDataUrl?: string;
  voiceTranscript?: string;
  voiceRecordingId?: string;
  voiceDurationSeconds?: number;
  voiceMimeType?: string;
  createdAt: string;
}

const LOCAL_MEMORY_STORAGE_PREFIX = 'reality-archive:local-memories:';

function storageKey(placeId: string) {
  return `${LOCAL_MEMORY_STORAGE_PREFIX}${encodeURIComponent(placeId)}`;
}

function isSavedMemory(value: unknown): value is SavedMemory {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.placeId === 'string' &&
    typeof record.placeName === 'string' &&
    (record.type === 'text' || record.type === 'photo' || record.type === 'voice') &&
    typeof record.mood === 'string' &&
    typeof record.text === 'string' &&
    typeof record.createdAt === 'string'
  );
}

export function createSavedMemoryId() {
  return globalThis.crypto?.randomUUID?.() ?? `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatMemoryTypeLabel(type: MemoryType) {
  switch (type) {
    case 'photo':
      return 'Photo';
    case 'voice':
      return 'Voice';
    default:
      return 'Text';
  }
}

export function readLocalMemories(placeId: string) {
  if (typeof window === 'undefined') {
    return [] as SavedMemory[];
  }

  try {
    const raw = window.localStorage.getItem(storageKey(placeId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isSavedMemory)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return [];
  }
}

export function saveLocalMemory(memory: SavedMemory) {
  if (typeof window === 'undefined') {
    return [];
  }

  const current = readLocalMemories(memory.placeId).filter((item) => item.id !== memory.id);
  const next = [memory, ...current];
  window.localStorage.setItem(storageKey(memory.placeId), JSON.stringify(next));
  return next;
}

export function countLocalMemories(placeId: string) {
  return readLocalMemories(placeId).length;
}
