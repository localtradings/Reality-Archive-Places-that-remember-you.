import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const screenSource = readFileSync(new URL('../components/AddMemoryScreen.tsx', import.meta.url), 'utf8');
const memorySource = readFileSync(new URL('../lib/local-memory.ts', import.meta.url), 'utf8');
const cardSource = readFileSync(new URL('../components/LocalMemoryCard.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('memory page uses the approved reference layout and one primary action', () => {
  assert.match(screenSource, /<ArchiveShell[^>]*hideTopbar/);
  assert.match(screenSource, /className="memory-reference-page"/);
  assert.match(screenSource, /text: 'Text Memory'/);
  assert.match(screenSource, /photo: 'Photo Memory'/);
  assert.match(screenSource, /voice: 'Voice Memory'/);
  assert.match(screenSource, /Keep this memory/);
  assert.doesNotMatch(screenSource, /Preview archive/);
  assert.doesNotMatch(screenSource, /Open museum/);
  assert.doesNotMatch(screenSource, /This note stays local/);
});

test('saved memories support an optional title without invalidating older entries', () => {
  assert.match(memorySource, /title\?: string;/);
  assert.doesNotMatch(memorySource, /typeof record\.title === 'string' &&/);
});

test('memory page removes place switching and offers ten moods', () => {
  assert.doesNotMatch(screenSource, /Change place/);
  assert.doesNotMatch(screenSource, /handlePlaceChange/);
  for (const mood of ['Calm', 'Historic', 'Romantic', 'Colorful', 'Spiritual', 'Energetic', 'Nostalgic', 'Joyful', 'Peaceful', 'Reflective']) {
    assert.match(screenSource, new RegExp(`'${mood}'`));
  }
});

test('voice memories expose recording controls and persisted playback', () => {
  assert.match(screenSource, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(screenSource, /new MediaRecorder/);
  assert.match(screenSource, /Start recording/);
  assert.match(screenSource, /Stop recording/);
  assert.match(screenSource, /voiceRecordingId/);
  assert.match(memorySource, /voiceRecordingId\?: string;/);
  assert.match(memorySource, /voiceDurationSeconds\?: number;/);
  assert.match(cardSource, /VoiceMemoryPlayback/);
});

test('desktop memory layout uses paper texture and locks to the viewport', () => {
  assert.match(stylesSource, /\.memory-paper-button/);
  assert.match(stylesSource, /background-image:\s*var\(--archive-paper-surface\)/);
  assert.match(stylesSource, /archive-workspace--memory-reference[^}]*height:\s*100svh/s);
  assert.match(stylesSource, /archive-bg:has\(\.archive-workspace--memory-reference\)[^}]*overflow:\s*hidden/s);
});
