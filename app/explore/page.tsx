import { Suspense } from 'react';
import { ExploreDiscovery } from '@/components/ExploreDiscovery';
import { ArchiveShell, TornPaperCard } from '@/components/ArchiveUI';

function ExploreFallback() {
  return (
    <ArchiveShell className="archive-workspace--explore-reference" hideTopbar>
      <TornPaperCard tone="light" className="archive-page-label archive-page-label--explore">
        <p className="archive-kicker">Explore</p>
        <h1>Loading nearby and remembered places.</h1>
        <p>Preparing the map, search, and manual place tools.</p>
      </TornPaperCard>
    </ArchiveShell>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreFallback />}>
      <ExploreDiscovery />
    </Suspense>
  );
}
