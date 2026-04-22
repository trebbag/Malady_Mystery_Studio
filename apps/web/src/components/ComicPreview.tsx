import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/StatusPill';
import type { ExportHistoryEntry, WorkflowRun } from '@/lib/types';

export function ComicPreview({
  workflowRun,
  exportHistory,
}: {
  workflowRun: WorkflowRun;
  exportHistory: ExportHistoryEntry[];
}) {
  return (
    <Card>
      <CardTitle>Production package preview</CardTitle>
      <CardDescription>
        Truthful replacement for the Figma Make comic preview shell. This shows release readiness and bundle state, not a fake rendered comic.
      </CardDescription>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Release state</p>
          <div className="mt-2">
            <StatusPill label={workflowRun.state} />
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest eval</p>
          <div className="mt-2">
            <StatusPill label={workflowRun.latestEvalStatus ?? 'missing'} />
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bundles</p>
          <p className="mt-2 text-xl font-semibold text-shell-950">{exportHistory.length}</p>
        </div>
      </div>
    </Card>
  );
}
