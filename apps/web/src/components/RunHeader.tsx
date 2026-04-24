import { Link } from 'react-router-dom';

import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/StatusPill';
import type { WorkflowRun } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function RunHeader({ workflowRun }: { workflowRun: WorkflowRun }) {
  const completedStages = workflowRun.stages.filter((stage) => ['passed', 'approved', 'completed'].includes(stage.status)).length;
  const progress = workflowRun.stages.length > 0 ? Math.round((completedStages / workflowRun.stages.length) * 100) : 0;
  const approvedRoles = workflowRun.approvals.filter((approval) => approval.decision === 'approved').length;
  const requiredRoles = workflowRun.requiredApprovalRoles.length;

  return (
    <Card className="figma-panel-stripe border-black/10 bg-white/90 shadow-none">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1.4fr_auto] xl:items-center">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={workflowRun.state} />
            <StatusPill label={workflowRun.currentStage} />
          </div>
          <div>
            <CardTitle className="text-2xl text-shell-950">{workflowRun.input.diseaseName}</CardTitle>
            <CardDescription>
              Run <code>{workflowRun.id}</code> for project <code>{workflowRun.projectId}</code>.
            </CardDescription>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <CommandMetric label="Progress" value={`${progress}%`} detail={`${completedStages}/${workflowRun.stages.length} stages`} />
          <CommandMetric label="Gate" value={workflowRun.currentStage} detail={workflowRun.pauseReason ?? 'No pause recorded'} />
          <CommandMetric label="Approvals" value={`${approvedRoles}/${requiredRoles}`} detail="required roles" />
          <CommandMetric label="Evals" value={workflowRun.latestEvalStatus ?? 'missing'} detail={workflowRun.latestEvalAt ? formatDateTime(workflowRun.latestEvalAt) : 'No eval run'} />
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Link className="rounded-xl bg-shell-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-shell-700" to={`/runs/${encodeURIComponent(workflowRun.id)}/review`}>
            Review
          </Link>
          <Link className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-shell-950 transition hover:bg-slate-50" to={`/runs/${encodeURIComponent(workflowRun.id)}/evals`}>
            Evals
          </Link>
        </div>
      </div>
    </Card>
  );
}

function CommandMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-l border-black/10 pl-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-shell-950">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}
