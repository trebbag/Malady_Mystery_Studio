import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import type { WorkflowArtifactListView, WorkflowRun } from '@/lib/types';

export function PipelineFlow({
  workflowRun,
  artifacts,
}: {
  workflowRun: WorkflowRun;
  artifacts: WorkflowArtifactListView | null;
}) {
  return (
    <Card>
      <CardTitle>Pipeline flow</CardTitle>
      <CardDescription>Run-wide stage and artifact inventory using the Figma pipeline shell structure.</CardDescription>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current stage</p>
          <p className="mt-2 text-lg font-semibold text-shell-950">{workflowRun.currentStage}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workflow state</p>
          <p className="mt-2 text-lg font-semibold text-shell-950">{workflowRun.state}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Artifacts</p>
          <p className="mt-2 text-lg font-semibold text-shell-950">{artifacts?.artifacts.length ?? workflowRun.artifacts.length}</p>
        </div>
      </div>
    </Card>
  );
}
