'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { ArchiveShell } from '@/components/ArchiveUI';
import { mockPlaces } from '@/data/mockPlaces';
import { fetchGeoapifyNearbyPlaces, searchGeoapifyPlacesByText, type GeoapifySearchCenter } from '@/lib/geoapify';
import { createSavedMemoryId, saveLocalMemory, type MemoryType } from '@/lib/local-memory';
import {
  buildTemporaryPlace,
  buildTemporaryPlaceId,
  readTemporaryPlace,
  storeTemporaryPlace,
  type GeoapifyNearbyPlace,
  type TemporaryPlaceOrigin,
} from '@/lib/place-archive';
import { readVisitedPlaces, recordVisitedPlace, visitedPlaceToPlace } from '@/lib/visited-places';
import { saveVoiceRecording } from '@/lib/voice-memory-audio';
import type { Mood, Place } from '@/types';

type PlaceOption = Place;

const memoryTypeLabels: Record<MemoryType, string> = {
  text: 'Text Memory',
  photo: 'Photo Memory',
  voice: 'Voice Memory',
};

const memoryTypeIcons: Record<MemoryType, ReactNode> = {
  text: <span aria-hidden="true">♧</span>,
  photo: <span aria-hidden="true">▧</span>,
  voice: <span aria-hidden="true">♩</span>,
};

const moodOptions: Mood[] = [
  'Calm',
  'Historic',
  'Romantic',
  'Colorful',
  'Spiritual',
  'Energetic',
  'Nostalgic',
  'Joyful',
  'Peaceful',
  'Reflective',
];

const rememberedCategories = ['Historic Street', 'Heritage House', 'Religious Landmark', 'Riverfront Walk', 'Cafe', 'Park', 'Museum', 'Neighborhood'] as const;
type RememberedCategory = (typeof rememberedCategories)[number];
type ManualCategory = '' | RememberedCategory;

const voiceMimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Unable to read the selected image.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function placeSourceLabel(place: PlaceOption | null) {
  if (!place) {
    return 'No place selected';
  }

  if (place.origin === 'geoapify') {
    return 'Nearby Place';
  }

  if (place.origin === 'search' || place.origin === 'manual') {
    return 'Remembered Place';
  }

  return place.category;
}

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function formatDistance(distanceMeters?: number) {
  if (typeof distanceMeters !== 'number' || Number.isNaN(distanceMeters)) {
    return 'Nearby';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function isRememberedCategory(value: string): value is RememberedCategory {
  return (rememberedCategories as readonly string[]).includes(value);
}

function upsertPlaceOption(options: PlaceOption[], place: PlaceOption) {
  return [place, ...options.filter((option) => option.id !== place.id)];
}

export function AddMemoryScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routePlaceId = searchParams.get('place');

  const [resolvedRoutePlace, setResolvedRoutePlace] = useState<PlaceOption | null>(null);
  const [visitedOptions, setVisitedOptions] = useState<PlaceOption[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [memoryType, setMemoryType] = useState<MemoryType>('text');
  const [memoryTitle, setMemoryTitle] = useState('');
  const [mood, setMood] = useState<Mood>('Calm');
  const [memoryText, setMemoryText] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fileError, setFileError] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualCategory, setManualCategory] = useState<ManualCategory>('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');
  const [nearbyCenter, setNearbyCenter] = useState<GeoapifySearchCenter | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<GeoapifyNearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [nearbyAttempt, setNearbyAttempt] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState('');
  const [voiceDurationSeconds, setVoiceDurationSeconds] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'requesting' | 'recording' | 'ready'>('idle');
  const [voiceError, setVoiceError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const manualControllerRef = useRef<AbortController | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);

  const placeOptions = useMemo(() => {
    const options = [...visitedOptions];
    if (resolvedRoutePlace && !options.some((option) => option.id === resolvedRoutePlace.id)) {
      options.unshift(resolvedRoutePlace);
    }
    return options;
  }, [resolvedRoutePlace, visitedOptions]);

  const selectedPlace = useMemo(() => {
    return placeOptions.find((option) => option.id === selectedPlaceId) ?? null;
  }, [placeOptions, selectedPlaceId]);

  useEffect(() => {
    setVisitedOptions(readVisitedPlaces().map(visitedPlaceToPlace));
  }, []);

  useEffect(() => {
    let nextPlace: PlaceOption | null = null;

    if (routePlaceId) {
      const visitedPlace = readVisitedPlaces().find((place) => place.id === routePlaceId);
      nextPlace =
        mockPlaces.find((place) => place.id === routePlaceId) ??
        readTemporaryPlace(routePlaceId) ??
        (visitedPlace ? visitedPlaceToPlace(visitedPlace) : null);
    }

    if (nextPlace) {
      setResolvedRoutePlace(nextPlace);
      setSelectedPlaceId(nextPlace.id);
      setMood(nextPlace.moods[0]);
      return;
    }

    setResolvedRoutePlace(null);

    if (routePlaceId) {
      setSelectedPlaceId('');
      setMood('Calm');
      return;
    }

    const visited = readVisitedPlaces().map(visitedPlaceToPlace);
    setVisitedOptions(visited);
    setSelectedPlaceId('');
    setMood('Calm');
  }, [routePlaceId]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setNearbyError('Nearby places are unavailable in this browser.');
      return;
    }

    let active = true;
    setNearbyError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active) {
          return;
        }

        setNearbyCenter({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        if (!active) {
          return;
        }

        setNearbyError('Allow location access to show nearby places here.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );

    return () => {
      active = false;
    };
  }, [nearbyAttempt]);

  useEffect(() => {
    if (!nearbyCenter) {
      setNearbyPlaces([]);
      setNearbyLoading(false);
      return;
    }

    const center = nearbyCenter;

    const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
    if (!geoapifyKey) {
      setNearbyPlaces([]);
      setNearbyLoading(false);
      setNearbyError('Add NEXT_PUBLIC_GEOAPIFY_API_KEY to load nearby places.');
      return;
    }

    const controller = new AbortController();

    async function loadNearbyPlaces() {
      try {
        setNearbyLoading(true);
        setNearbyError('');
        const places = await fetchGeoapifyNearbyPlaces({
          apiKey: geoapifyKey,
          center,
          radiusMeters: 6500,
          limit: 5,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setNearbyPlaces(places);
          setNearbyError(places.length === 0 ? 'No nearby places found.' : '');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setNearbyPlaces([]);
          setNearbyError(error instanceof Error ? error.message : 'Unable to load nearby places.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setNearbyLoading(false);
        }
      }
    }

    void loadNearbyPlaces();

    return () => {
      controller.abort();
    };
  }, [nearbyCenter]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
      }
      manualControllerRef.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (voicePreviewUrl) {
        URL.revokeObjectURL(voicePreviewUrl);
      }
    };
  }, [voicePreviewUrl]);

  useEffect(() => {
    if (memoryType !== 'photo') {
      setFileError('');
    }
  }, [memoryType]);

  function handleMemoryTypeChange(type: MemoryType) {
    if (voiceStatus === 'recording') {
      stopVoiceRecording();
    }
    setMemoryType(type);
    setFormError('');
    setFileError('');
  }

  function releaseVoiceStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearRecordingTimer() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function clearVoiceRecording() {
    if (voicePreviewUrl) {
      URL.revokeObjectURL(voicePreviewUrl);
    }
    setVoiceBlob(null);
    setVoicePreviewUrl('');
    setVoiceDurationSeconds(0);
    setVoiceStatus('idle');
    setVoiceError('');
  }

  async function startVoiceRecording() {
    setVoiceError('');

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Voice recording is not supported in this browser.');
      return;
    }

    clearVoiceRecording();
    setVoiceStatus('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordingChunksRef.current = [];
      const mimeType = voiceMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        releaseVoiceStream();
        const duration = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (blob.size === 0) {
          setVoiceStatus('idle');
          setVoiceError('No audio was captured. Please try recording again.');
          return;
        }

        const previewUrl = URL.createObjectURL(blob);
        setVoiceBlob(blob);
        setVoicePreviewUrl(previewUrl);
        setVoiceDurationSeconds(duration);
        setVoiceStatus('ready');
      };

      recorder.onerror = () => {
        clearRecordingTimer();
        releaseVoiceStream();
        setVoiceStatus('idle');
        setVoiceError('The recording stopped unexpectedly. Please try again.');
      };

      recordingStartedAtRef.current = Date.now();
      setVoiceDurationSeconds(0);
      recorder.start(250);
      setVoiceStatus('recording');
      recordingTimerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setVoiceDurationSeconds(seconds);
        if (seconds >= 120 && recorder.state === 'recording') {
          recorder.stop();
        }
      }, 500);
    } catch (error) {
      clearRecordingTimer();
      releaseVoiceStream();
      setVoiceStatus('idle');
      const errorName = error instanceof DOMException ? error.name : '';
      setVoiceError(
        errorName === 'NotAllowedError'
          ? 'Microphone access was not allowed. Enable it in your browser settings and try again.'
          : 'The microphone could not be started. Check that it is available and try again.',
      );
    }
  }

  function stopVoiceRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.stop();
    }
  }

  function selectPlace(place: PlaceOption) {
    setResolvedRoutePlace(place);
    setVisitedOptions((options) => upsertPlaceOption(options, place));
    setSelectedPlaceId(place.id);
    setMood(place.moods[0] ?? 'Calm');
    setFormError('');
  }

  function selectGeoapifyPlace(place: GeoapifyNearbyPlace, origin: TemporaryPlaceOrigin) {
    const temporaryPlaceId = buildTemporaryPlaceId({
      name: place.name,
      address: place.address,
      category: place.category,
      latitude: place.latitude,
      longitude: place.longitude,
      distanceMeters: place.distanceMeters,
    });
    const temporaryPlace = buildTemporaryPlace(
      {
        ...place,
        id: temporaryPlaceId,
      },
      origin,
    );

    storeTemporaryPlace(temporaryPlace);
    recordVisitedPlace(temporaryPlace);
    selectPlace(temporaryPlace);
  }

  async function handleManualAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    manualControllerRef.current?.abort();
    setManualError('');

    const name = manualName.trim();
    const address = manualAddress.trim();
    const category = manualCategory;

    if (!name || !address) {
      setManualError('Add both a place name and an address.');
      return;
    }

    if (!isRememberedCategory(category)) {
      setManualError('Choose a category.');
      return;
    }

    const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? '';
    if (!geoapifyKey) {
      setManualError('Add NEXT_PUBLIC_GEOAPIFY_API_KEY to resolve manual places.');
      return;
    }

    const controller = new AbortController();
    manualControllerRef.current = controller;

    try {
      setManualLoading(true);
      const geocodedPlaces = await searchGeoapifyPlacesByText({
        apiKey: geoapifyKey,
        text: `${name}, ${address}`,
        center: nearbyCenter ?? undefined,
        limit: 1,
        signal: controller.signal,
      });
      const geocodedPlace = geocodedPlaces[0];

      if (!geocodedPlace) {
        setManualError('Could not resolve that address. Try a more specific address.');
        return;
      }

      selectGeoapifyPlace(
        {
          id: '',
          name,
          address,
          category,
          latitude: geocodedPlace.latitude,
          longitude: geocodedPlace.longitude,
        },
        'manual',
      );
      setManualName('');
      setManualAddress('');
      setManualCategory('');
    } catch {
      if (!controller.signal.aborted) {
        setManualError('Manual add could not resolve that address right now.');
      }
    } finally {
      if (manualControllerRef.current === controller) {
        manualControllerRef.current = null;
        setManualLoading(false);
      }
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setFileError('');

    const trimmedText = memoryText.trim();
    if (memoryType !== 'voice' && !trimmedText) {
      setFormError('Write your memory before saving.');
      return;
    }

    if (!selectedPlace) {
      setFormError('Choose a visited place before saving a memory.');
      return;
    }

    if (memoryType === 'photo' && !photoDataUrl) {
      setFileError('Choose a photo before saving a photo memory.');
      return;
    }

    if (memoryType === 'voice' && !voiceBlob) {
      setVoiceError('Record a voice memory before saving.');
      return;
    }

    const memoryId = createSavedMemoryId();
    const memory = {
      id: memoryId,
      placeId: selectedPlace.id,
      placeName: selectedPlace.name,
      type: memoryType,
      title: memoryTitle.trim() || undefined,
      mood,
      text: trimmedText || 'Voice recording',
      createdAt: new Date().toISOString(),
      ...(memoryType === 'photo'
        ? {
            photoCaption: photoCaption.trim() || undefined,
            imageDataUrl: photoDataUrl,
          }
        : {}),
      ...(memoryType === 'voice'
        ? {
            voiceTranscript: trimmedText || undefined,
            voiceRecordingId: memoryId,
            voiceDurationSeconds,
            voiceMimeType: voiceBlob?.type || undefined,
          }
        : {}),
    };

    try {
      setIsSaving(true);
      if (memoryType === 'voice' && voiceBlob) {
        await saveVoiceRecording(memoryId, voiceBlob);
      }
      saveLocalMemory(memory);
      recordVisitedPlace(selectedPlace, selectedPlace.memoryCount + 1);
      router.replace('/museum');
    } catch {
      setFormError('Unable to save this memory right now. Please try again.');
      setIsSaving(false);
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoDataUrl('');
      setPhotoName('');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPhotoDataUrl(dataUrl);
      setPhotoName(file.name);
      setFileError('');
    } catch {
      setPhotoDataUrl('');
      setPhotoName('');
      setFileError('Could not read the selected image. Try another file.');
    }
  }

  const memoryLabel = memoryTypeLabels[memoryType].toLowerCase();

  return (
    <ArchiveShell hideTopbar className="archive-workspace--memory-reference">
      <section className="memory-reference-page">
        <div className="memory-reference-layout">
          <aside className="memory-place-panel">
            <div className="memory-place-panel__label">
              <span aria-hidden="true">♙</span>
              <p>Memory for</p>
            </div>

            <h2>{selectedPlace?.name ?? 'Choose a place'}</h2>
            <p className="memory-place-panel__address">
              {selectedPlace?.address ?? 'Add one manually or choose a nearby place before saving.'}
            </p>

            <span className="memory-place-panel__category">
              <span aria-hidden="true">▥</span>
              {placeSourceLabel(selectedPlace)}
            </span>

            <section className="memory-place-panel__chooser" aria-label="Choose a place for this memory">
              <div className="memory-place-panel__section-heading">
                <h3>Manual add</h3>
                <span>Place details</span>
              </div>

              <form onSubmit={handleManualAdd} className="memory-place-panel__manual-form">
                <label>
                  Place name
                  <input
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="e.g. Our old cafe"
                    required
                  />
                </label>
                <label>
                  Address / City
                  <input
                    value={manualAddress}
                    onChange={(event) => setManualAddress(event.target.value)}
                    placeholder="e.g. Iloilo City"
                    required
                  />
                </label>
                <label>
                  Category
                  <select
                    value={manualCategory}
                    onChange={(event) => {
                      const value = event.target.value;
                      setManualCategory(isRememberedCategory(value) ? value : '');
                    }}
                    required
                  >
                    <option value="">Select category</option>
                    {rememberedCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="memory-panel-action-button" disabled={manualLoading}>
                  {manualLoading ? 'Resolving...' : 'Use this place'}
                </button>
                {manualError ? <p className="memory-place-panel__note">{manualError}</p> : null}
              </form>

              <div className="memory-place-panel__section-heading">
                <h3>Nearby places</h3>
                <button type="button" onClick={() => setNearbyAttempt((attempt) => attempt + 1)}>
                  Refresh
                </button>
              </div>

              <div className="memory-place-panel__nearby-list" aria-live="polite" aria-busy={nearbyLoading}>
                {nearbyLoading ? (
                  <p className="memory-place-panel__note">Loading nearby places...</p>
                ) : nearbyPlaces.length > 0 ? (
                  nearbyPlaces.map((place) => {
                    const temporaryPlaceId = buildTemporaryPlaceId({
                      name: place.name,
                      address: place.address,
                      category: place.category,
                      latitude: place.latitude,
                      longitude: place.longitude,
                      distanceMeters: place.distanceMeters,
                    });
                    const isSelected = selectedPlaceId === temporaryPlaceId;

                    return (
                      <button
                        key={place.id}
                        type="button"
                        className={`memory-place-panel__nearby-card${isSelected ? ' is-selected' : ''}`}
                        onClick={() => selectGeoapifyPlace(place, 'geoapify')}
                      >
                        <span>
                          <strong>{place.name}</strong>
                          <small>{place.address}</small>
                        </span>
                        <em>{formatDistance(place.distanceMeters)}</em>
                      </button>
                    );
                  })
                ) : (
                  <p className="memory-place-panel__note">
                    {nearbyError || 'Nearby places will appear here after location is available.'}
                  </p>
                )}
              </div>
            </section>
          </aside>

          <form onSubmit={handleSave} className={`memory-composer memory-composer--${memoryType}`}>
            <h2>Create a memory</h2>
            <div className="memory-composer__rule" aria-hidden="true">
              <span />
              <i>◆</i>
              <span />
            </div>

            <div className="memory-type-tabs" role="tablist" aria-label="Memory type">
              {(Object.keys(memoryTypeLabels) as MemoryType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={memoryType === type}
                  className={`memory-paper-button${memoryType === type ? ' is-active' : ''}`}
                  onClick={() => handleMemoryTypeChange(type)}
                >
                  {memoryTypeIcons[type]}
                  {memoryTypeLabels[type]}
                </button>
              ))}
            </div>

            <div className="memory-composer__two-column">
              <label className="memory-reference-field">
                <span>Memory title</span>
                <small>Give this memory a short name.</small>
                <input
                  value={memoryTitle}
                  maxLength={80}
                  onChange={(event) => setMemoryTitle(event.target.value)}
                  placeholder={selectedPlace ? `e.g. A quiet afternoon at ${selectedPlace.name}` : 'e.g. A quiet afternoon'}
                />
              </label>

              <label className="memory-reference-field">
                <span>Mood</span>
                <small>How did this place make you feel?</small>
                <div className="memory-mood-select">
                  <span aria-hidden="true">☺</span>
                  <select value={mood} onChange={(event) => setMood(event.target.value as Mood)}>
                    {moodOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            {memoryType === 'photo' ? (
              <section className="memory-photo-fields" aria-label="Photo memory">
                <label className="memory-reference-field">
                  <span>Choose a photo</span>
                  <small>Add one image from this device.</small>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="memory-photo-input" />
                </label>

                <label className="memory-reference-field">
                  <span>Photo caption</span>
                  <small>Optional context for the image.</small>
                  <input
                    value={photoCaption}
                    maxLength={120}
                    onChange={(event) => setPhotoCaption(event.target.value)}
                    placeholder="A short caption for the photo"
                  />
                </label>

                {photoDataUrl ? (
                  <div className="memory-photo-selection">
                    <img src={photoDataUrl} alt={photoCaption || memoryTitle || 'Selected memory'} />
                    <div>
                      <span>{photoName || 'Selected image'}</span>
                      <button
                        type="button"
                        className="memory-paper-button"
                        onClick={() => {
                          setPhotoDataUrl('');
                          setPhotoName('');
                        }}
                      >
                        Remove photo
                      </button>
                    </div>
                  </div>
                ) : null}

                {fileError ? <p className="memory-reference-error">{fileError}</p> : null}
              </section>
            ) : null}

            {memoryType === 'voice' ? (
              <section className="memory-voice-recorder" aria-label="Voice recorder">
                <div className="memory-voice-recorder__status">
                  <span className={voiceStatus === 'recording' ? 'is-recording' : undefined} aria-hidden="true">●</span>
                  <div>
                    <strong>
                      {voiceStatus === 'requesting'
                        ? 'Waiting for microphone permission'
                        : voiceStatus === 'recording'
                          ? 'Recording'
                          : voiceStatus === 'ready'
                            ? 'Recording ready'
                            : 'Record your voice'}
                    </strong>
                    <small>Maximum recording length: 2 minutes.</small>
                  </div>
                  <time>{formatRecordingTime(voiceDurationSeconds)}</time>
                </div>

                <div className="memory-voice-recorder__actions">
                  {voiceStatus === 'recording' ? (
                    <button type="button" className="memory-paper-button" onClick={stopVoiceRecording}>
                      Stop recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="memory-paper-button"
                      onClick={startVoiceRecording}
                      disabled={voiceStatus === 'requesting'}
                    >
                      {voiceStatus === 'ready' ? 'Record again' : 'Start recording'}
                    </button>
                  )}
                  {voiceStatus === 'ready' ? (
                    <button type="button" className="memory-paper-button" onClick={clearVoiceRecording}>
                      Remove
                    </button>
                  ) : null}
                </div>

                {voicePreviewUrl ? (
                  <audio controls preload="metadata" src={voicePreviewUrl}>
                    Your browser does not support audio playback.
                  </audio>
                ) : null}

                {voiceError ? <p className="memory-reference-error">{voiceError}</p> : null}
              </section>
            ) : null}

            <label className="memory-reference-field memory-reference-field--story">
              <span>{memoryType === 'voice' ? 'Voice transcript' : 'Your memory'}</span>
              <small>
                {memoryType === 'voice'
                  ? 'Optional: add a written transcript for your recording.'
                  : 'Write the moment you want to keep.'}
              </small>
              <textarea
                rows={memoryType === 'text' ? 6 : 3}
                maxLength={500}
                value={memoryText}
                onChange={(event) => setMemoryText(event.target.value)}
                placeholder={
                  memoryType === 'voice'
                    ? 'Type what you would have said at this place...'
                    : 'Write about what happened, who you were with, or why this place matters...'
                }
              />
              <span className="memory-reference-counter">{memoryText.length} / 500 characters</span>
            </label>

            <p className="memory-save-note">
              <span aria-hidden="true">♧</span>
              This {memoryLabel} will be saved to {selectedPlace?.name ?? 'the selected place'}&apos;s archive.
            </p>

            {formError ? <p className="memory-reference-error memory-reference-error--form">{formError}</p> : null}

            <button type="submit" disabled={isSaving || !selectedPlace || voiceStatus === 'recording'} className="memory-keep-button memory-paper-button">
              <span aria-hidden="true">♧</span>
              {isSaving ? 'Saving memory...' : 'Keep this memory'}
            </button>
          </form>
        </div>
      </section>
    </ArchiveShell>
  );
}
