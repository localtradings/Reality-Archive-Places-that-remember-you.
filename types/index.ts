export type Mood = 'Historic' | 'Calm' | 'Romantic' | 'Colorful' | 'Spiritual' | 'Energetic';

export interface MemoryEntry {
  id: string;
  title: string;
  author: string;
  note: string;
  tag: string;
}

export interface MuseumPreview {
  livingExhibit: string;
  placeMood: string;
  memoryWallSummary: string;
  voiceTourScript: string[];
  visitorTips: string[];
  miniQuest: {
    title: string;
    prompt: string;
    reward: string;
  };
  sourcesUsed: string[];
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  category: string;
  description: string;
  memoryCount: number;
  moods: Mood[];
  memories: MemoryEntry[];
  museum: MuseumPreview;
  coordinates?: Coordinates;
  origin?: 'mock' | 'geoapify' | 'search' | 'manual';
}
