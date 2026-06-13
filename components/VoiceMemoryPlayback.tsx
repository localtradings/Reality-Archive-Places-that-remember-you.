'use client';

import { useEffect, useState } from 'react';
import { readVoiceRecording } from '@/lib/voice-memory-audio';

function formatDuration(seconds?: number) {
  if (!seconds) {
    return '';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function VoiceMemoryPlayback({
  recordingId,
  durationSeconds,
}: {
  recordingId: string;
  durationSeconds?: number;
}) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let isCancelled = false;

    readVoiceRecording(recordingId)
      .then((blob) => {
        if (isCancelled) {
          return;
        }

        if (!blob) {
          setLoadError('The saved recording is not available in this browser.');
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      })
      .catch(() => {
        if (!isCancelled) {
          setLoadError('The saved recording could not be loaded.');
        }
      });

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [recordingId]);

  if (loadError) {
    return <p className="archive-audio-error">{loadError}</p>;
  }

  if (!audioUrl) {
    return <p className="archive-audio-loading">Loading recording...</p>;
  }

  return (
    <div className="archive-audio-player">
      <audio controls preload="metadata" src={audioUrl}>
        Your browser does not support audio playback.
      </audio>
      {durationSeconds ? <span>{formatDuration(durationSeconds)}</span> : null}
    </div>
  );
}
