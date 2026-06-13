import { Suspense } from 'react';
import { ArchiveShell, TornPaperCard } from '@/components/ArchiveUI';
import { MuseumExperience } from '@/components/MuseumExperience';

function MuseumRouteFallback() {
  return (
    <ArchiveShell>
      <TornPaperCard tone="light" className="archive-page-label">
        <p className="archive-kicker">AI Living Museum</p>
        <h1>Preparing your museum preview.</h1>
        <p>The archive is loading, and the museum preview will appear here once the place and its memories are ready.</p>
      </TornPaperCard>
    </ArchiveShell>
  );
}

export default function MuseumPage() {
  return (
    <Suspense fallback={<MuseumRouteFallback />}>
      <MuseumExperience />
    </Suspense>
  );
}
