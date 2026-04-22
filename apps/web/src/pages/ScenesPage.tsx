import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { fetchWorkflowArtifacts } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function ScenesPage() {
  const { runId } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const artifactsState = useRemoteData(() => fetchWorkflowArtifacts(runId, ['scene-card'], true), [runId, refreshSignal]);

  return (
    <SectionStack>
      <PageHeader eyebrow="Scenes" title="Scenes Page" description="Ordered scene-card artifacts generated from the story workbook." />
      {(artifactsState.data?.artifacts ?? []).map((artifact) => (
        <ArtifactJsonCard key={artifact.artifactId} title={artifact.artifactId} value={artifact.payload ?? {}} />
      ))}
    </SectionStack>
  );
}
