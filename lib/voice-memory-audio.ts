const DATABASE_NAME = 'reality-archive-audio';
const DATABASE_VERSION = 1;
const STORE_NAME = 'voice-recordings';

interface VoiceRecordingRecord {
  id: string;
  blob: Blob;
  savedAt: string;
}

function openAudioDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Audio storage is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open audio storage.'));
  });
}

export async function saveVoiceRecording(id: string, blob: Blob) {
  const database = await openAudioDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({
      id,
      blob,
      savedAt: new Date().toISOString(),
    } satisfies VoiceRecordingRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the voice recording.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Voice recording storage was cancelled.'));
  });

  database.close();
}

export async function readVoiceRecording(id: string) {
  const database = await openAudioDatabase();

  const recording = await new Promise<VoiceRecordingRecord | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as VoiceRecordingRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Unable to load the voice recording.'));
  });

  database.close();
  return recording?.blob ?? null;
}
