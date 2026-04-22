import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { fetchWorkflowArtifacts } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function WorkbooksPage() {
  const { runId } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const artifactsState = useRemoteData(
    () => fetchWorkflowArtifacts(runId, ['story-workbook', 'narrative-review-trace', 'qa-report'], true),
    [runId, refreshSignal],
  );

  return (
    <SectionStack>
      <PageHeader eyebrow="Narrative" title="Workbooks Page" description="Story workbook, narrative review trace, and the workbook-stage QA report." />
      {(artifactsState.data?.artifacts ?? []).map((artifact) => (
        <ArtifactJsonCard
          key={artifact.artifactId}
          title={`${artifact.artifactType} · ${artifact.artifactId}`}
          value={artifact.payload ?? {}}
        />
      ))}
    </SectionStack>
  );
}
