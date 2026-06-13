import type { MemoryEntry } from '@/types';

export function MemoryCard({ memory }: { memory: MemoryEntry }) {
  return (
    <article className="torn-paper torn-paper-light memory-note-card text-left">
      <div className="archive-card-meta">
        <span className="museum-plaque">{memory.tag}</span>
        <span>By {memory.author}</span>
      </div>
      <h3>{memory.title}</h3>
      <p>{memory.note}</p>
    </article>
  );
}
