import { NavLink } from 'react-router-dom';

import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/StatusPill';
import type { DashboardRun } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function RunsList({
  runs,
  selectedRunId,
}: {
  runs: DashboardRun[];
  selectedRunId?: string;
}) {
  return (
    <Card className="bg-shell-900 text-white shadow-none">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <CardTitle className="text-white">Run Queue</CardTitle>
          <CardDescription className="text-slate-300">Current local workflow runs.</CardDescription>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
          {runs.length}
        </span>
      </div>
      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 md:max-h-none md:overflow-visible md:pr-0">
        {runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-5 text-sm leading-6 text-slate-300">
            No local runs yet. Create a disease run from the dashboard to populate this Make-style production queue.
          </div>
        ) : runs.map((run) => (
          <NavLink
            key={run.runId}
            to={`/runs/${encodeURIComponent(run.runId)}/review`}
            className={[
              'block rounded-2xl border px-4 py-3 transition',
              selectedRunId === run.runId
                ? 'border-accent-300 bg-accent-500/15'
                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{run.diseaseName}</p>
                <p className="text-xs text-slate-300">{run.projectTitle}</p>
              </div>
              <StatusPill label={run.latestEvalStatus} className="border-white/15 bg-white/10 text-white" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <StatusPill label={run.state} className="border-white/15 bg-white/10 text-white" />
              <span>{run.currentStage}</span>
              <span>{formatDateTime(run.updatedAt)}</span>
            </div>
          </NavLink>
        ))}
      </div>
    </Card>
  );
}
