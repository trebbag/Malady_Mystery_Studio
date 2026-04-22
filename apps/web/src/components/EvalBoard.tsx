import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/StatusPill';
import type { EvalRun, EvaluationSummaryView } from '@/lib/types';

export function EvalBoard({
  evaluationSummary,
  evaluations,
  onRun,
}: {
  evaluationSummary?: EvaluationSummaryView | null;
  evaluations: EvalRun[];
  onRun: () => Promise<void>;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle>Eval board</CardTitle>
          <CardDescription>Deterministic gate state for release readiness.</CardDescription>
        </div>
        <Button onClick={() => void onRun()}>Run evaluations</Button>
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={evaluationSummary?.latestEvalStatus ?? 'missing'} />
          <span className="text-sm text-slate-600">
            {evaluationSummary?.allThresholdsMet ? 'All thresholds met.' : 'Latest eval requires attention.'}
          </span>
        </div>
        {(evaluationSummary?.familyStatuses ?? []).map((familyResult) => (
          <div key={familyResult.family} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-shell-950">{familyResult.family}</h3>
                <p className="text-sm text-slate-500">
                  Threshold {familyResult.threshold ?? 'n/a'} · Gate {familyResult.releaseGate ?? 'n/a'}
                </p>
              </div>
              <StatusPill label={familyResult.status} />
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-500">Stored eval runs: {evaluations.length}</p>
      </div>
    </Card>
  );
}
