import { Suspense } from 'react';
import { ArchiveShell, TornPaperCard } from '@/components/ArchiveUI';
import { MuseumCollection } from '@/components/MuseumCollection';

function MuseumCollectionFallback() {
  return (
    <ArchiveShell hideTopbar className="archive-workspace--museum-reference">
      <TornPaperCard tone="light" className="archive-page-label">
        <h1>Preparing your living museum.</h1>
        <p>The archive is loading the places you explored.</p>
      </TornPaperCard>
    </ArchiveShell>
  );
}

export default function MuseumPage() {
  return (
    <Suspense fallback={<MuseumCollectionFallback />}>
      <MuseumCollection />
    </Suspense>
  );
}
