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
    <Card className="border-shell-600 bg-shell-800/95 p-4 text-white shadow-none">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <CardTitle className="text-white">Current runs</CardTitle>
          <CardDescription className="text-slate-300">Pick up the next useful action.</CardDescription>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
          {runs.length}
        </span>
      </div>
      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 md:max-h-none md:overflow-visible md:pr-0">
        {runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-5 text-sm leading-6 text-slate-300">
            No local runs yet. Start with a disease name on Home.
          </div>
        ) : runs.map((run) => (
          <NavLink
            key={run.runId}
            to={`/runs/${encodeURIComponent(run.runId)}/overview`}
            className={[
              'block rounded-2xl border px-4 py-3 transition',
              selectedRunId === run.runId
                ? 'border-accent-300 bg-accent-500/15 shadow-[0_16px_36px_rgba(6,182,212,0.12)]'
                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{run.diseaseName}</p>
                <p className="text-xs text-slate-300">{run.projectTitle}</p>
              </div>
              <StatusPill label={run.activeStep} className="border-white/15 bg-white/10 text-white" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>{run.nextAction.label}</span>
              <span>{formatDateTime(run.updatedAt)}</span>
            </div>
            {run.primaryBlocker ? <p className="mt-2 text-xs text-amber-100">{run.primaryBlocker}</p> : null}
          </NavLink>
        ))}
      </div>
    </Card>
  );
}
