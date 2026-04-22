import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/StatusPill';
import type { WorkflowRun } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function RunHeader({ workflowRun }: { workflowRun: WorkflowRun }) {
  return (
    <Card className="bg-gradient-to-r from-shell-950 via-shell-900 to-shell-800 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={workflowRun.state} className="border-white/10 bg-white/10 text-white" />
            <StatusPill label={workflowRun.currentStage} className="border-white/10 bg-white/10 text-white" />
            {workflowRun.latestEvalStatus ? (
              <StatusPill label={workflowRun.latestEvalStatus} className="border-white/10 bg-white/10 text-white" />
            ) : null}
          </div>
          <div>
            <CardTitle className="text-2xl text-white">{workflowRun.input.diseaseName}</CardTitle>
            <CardDescription className="text-slate-300">
              Run <code>{workflowRun.id}</code> for project <code>{workflowRun.projectId}</code>.
            </CardDescription>
          </div>
        </div>
        <div className="space-y-2 text-sm text-slate-300">
          <div>Updated {formatDateTime(workflowRun.updatedAt)}</div>
          {workflowRun.pauseReason ? <div>Pause reason: {workflowRun.pauseReason}</div> : null}
        </div>
      </div>
    </Card>
  );
}
