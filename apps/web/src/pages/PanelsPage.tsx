import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { fetchWorkflowArtifacts } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function PanelsPage() {
  const { runId } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const artifactsState = useRemoteData(
    () => fetchWorkflowArtifacts(
      runId,
      ['panel-plan', 'render-prompt', 'rendering-guide', 'lettering-map', 'qa-report', 'render-job', 'render-attempt', 'rendered-asset', 'rendered-asset-manifest'],
      true,
    ),
    [runId, refreshSignal],
  );

  return (
    <SectionStack>
      <PageHeader eyebrow="Panels" title="Panels Page" description="Panel plans, provider-fitted render prompts, the master rendering guide, and optional attached art artifacts." />
      {(artifactsState.data?.artifacts ?? []).map((artifact) => (
        <ArtifactJsonCard key={artifact.artifactId} title={`${artifact.artifactType} · ${artifact.artifactId}`} value={artifact.payload ?? {}} />
      ))}
    </SectionStack>
  );
}
