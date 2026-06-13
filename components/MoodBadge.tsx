import type { Mood } from '@/types';

export function MoodBadge({ mood }: { mood: Mood }) {
  return <span className={`ra-mood ra-mood--${mood}`}>{mood}</span>;
}
