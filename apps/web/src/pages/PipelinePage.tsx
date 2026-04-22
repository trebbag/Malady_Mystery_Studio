import { ActivityFeed } from '@/components/ActivityFeed';
import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { PipelineFlow } from '@/components/PipelineFlow';
import { SectionStack } from '@/components/StatePanel';
import { StageTimeline } from '@/components/StageTimeline';
import { useRunPageContext } from '@/pages/RunLayout';
import { fetchAuditLogEntries, fetchWorkflowArtifacts } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';

export function PipelinePage() {
  const { runId, workflowRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const auditState = useRemoteData(() => fetchAuditLogEntries(runId), [runId, refreshSignal]);
  const artifactState = useRemoteData(() => fetchWorkflowArtifacts(runId, [], false), [runId, refreshSignal]);

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Pipeline"
        title="Pipeline Page"
        description="Workflow stage history, audit activity, and artifact inventory aligned to the Figma pipeline shell."
      />
      <PipelineFlow workflowRun={workflowRun} artifacts={artifactState.data} />
      <StageTimeline stages={workflowRun.stages} />
      <ActivityFeed entries={auditState.data ?? []} />
      <ArtifactJsonCard title="Artifact inventory" value={artifactState.data ?? { artifacts: [] }} />
    </SectionStack>
  );
}
