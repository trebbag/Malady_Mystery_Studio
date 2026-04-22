import { EvalBoard } from '@/components/EvalBoard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { fetchEvaluations, fetchReviewRunView, runEvaluations } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function EvalsPage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const evaluationsState = useRemoteData(() => fetchEvaluations(runId), [runId, refreshSignal]);
  const reviewState = useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);

  return (
    <SectionStack>
      <PageHeader eyebrow="Evaluations" title="Evals Page" description="Eval family details, latest run status, and rerun action." />
      <EvalBoard
        evaluationSummary={reviewState.data?.evaluationSummary}
        evaluations={evaluationsState.data ?? []}
        onRun={async () => {
          await runEvaluations(runId);
          refreshRun();
        }}
      />
    </SectionStack>
  );
}
