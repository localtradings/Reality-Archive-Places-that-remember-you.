import { Suspense } from 'react';
import { AddMemoryScreen } from '@/components/AddMemoryScreen';
import { ArchiveShell, TornPaperCard } from '@/components/ArchiveUI';

export default function AddMemoryPage() {
  return (
    <Suspense
      fallback={
        <ArchiveShell hideTopbar className="archive-workspace--memory-reference">
          <TornPaperCard tone="light" className="archive-page-label">
            <p className="archive-kicker">Add memory</p>
            <h1>Loading memory form.</h1>
            <p>Preparing the place-aware memory capture flow.</p>
          </TornPaperCard>
        </ArchiveShell>
      }
    >
      <AddMemoryScreen />
    </Suspense>
  );
}
