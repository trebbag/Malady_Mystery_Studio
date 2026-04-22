import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Button } from '@/components/ui/button';
import { rebuildClinicalPackage, fetchClinicalPackage } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function PacketsPage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const clinicalState = useRemoteData(() => fetchClinicalPackage(runId), [runId, refreshSignal]);

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Clinical package"
        title="Packets Page"
        description="Disease packet summary plus supporting fact table, teaching points, and visual anchors."
        actions={<Button variant="secondary" onClick={() => void rebuildClinicalPackage(runId, {}).then(() => refreshRun())}>Rebuild clinical package</Button>}
      />
      <ArtifactJsonCard title="Disease packet" value={clinicalState.data?.diseasePacket ?? {}} />
      <ArtifactJsonCard title="Fact table" value={clinicalState.data?.factTable ?? {}} />
      <ArtifactJsonCard title="Clinical teaching points" value={clinicalState.data?.clinicalTeachingPoints ?? {}} />
      <ArtifactJsonCard title="Visual anchor catalog" value={clinicalState.data?.visualAnchorCatalog ?? {}} />
    </SectionStack>
  );
}
