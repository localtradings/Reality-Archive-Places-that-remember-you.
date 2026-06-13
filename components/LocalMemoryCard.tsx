import { MoodBadge } from '@/components/MoodBadge';
import { VoiceMemoryPlayback } from '@/components/VoiceMemoryPlayback';
import { formatMemoryTypeLabel, type SavedMemory } from '@/lib/local-memory';

function formatSavedAt(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return 'Saved locally';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function LocalMemoryCard({ memory }: { memory: SavedMemory }) {
  return (
    <article className="torn-paper torn-paper-light memory-note-card text-left">
      <div className="archive-card-meta">
        <div className="archive-chip-row">
          <span className="museum-plaque">
            {formatMemoryTypeLabel(memory.type)}
          </span>
          <MoodBadge mood={memory.mood} />
        </div>
        <span>{formatSavedAt(memory.createdAt)}</span>
      </div>

      <p className="archive-kicker">{memory.placeName}</p>
      {memory.title ? <h3 className="memory-note-card__title">{memory.title}</h3> : null}
      <p className="whitespace-pre-wrap">{memory.text}</p>

      {memory.type === 'photo' && memory.imageDataUrl ? (
        <div className="archive-photo-preview">
          <img src={memory.imageDataUrl} alt={memory.photoCaption || memory.text} />
        </div>
      ) : null}

      {memory.photoCaption ? (
        <p>
          <span>Caption:</span> {memory.photoCaption}
        </p>
      ) : null}

      {memory.type === 'voice' ? (
        <div className="ink-panel archive-voice-note">
          <div className="ra-wave">
            <span className="h-3" />
            <span className="h-5" />
            <span className="h-8" />
            <span className="h-4" />
            <span className="h-6" />
            <span className="h-3" />
            <span className="h-7" />
            <span className="h-4" />
          </div>
          {memory.voiceRecordingId ? (
            <VoiceMemoryPlayback
              recordingId={memory.voiceRecordingId}
              durationSeconds={memory.voiceDurationSeconds}
            />
          ) : null}
          <p>{memory.voiceTranscript || memory.text}</p>
        </div>
      ) : null}
    </article>
  );
}
