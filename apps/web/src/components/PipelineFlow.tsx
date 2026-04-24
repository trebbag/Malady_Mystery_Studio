import { FigmaMakeStageDeck } from '@/components/FigmaMakeFrame';
import type { WorkflowArtifactListView, WorkflowRun } from '@/lib/types';

export function PipelineFlow({
  workflowRun,
  artifacts,
}: {
  workflowRun: WorkflowRun;
  artifacts: WorkflowArtifactListView | null;
}) {
  return <FigmaMakeStageDeck workflowRun={workflowRun} artifacts={artifacts} />;
}
