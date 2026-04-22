import { useState } from 'react';

import { AgentInspector } from '@/components/AgentInspector';
import { ReviewAssignmentsCard } from '@/components/ReviewAssignmentsCard';
import { ApprovalsCard } from '@/components/ApprovalsCard';
import { ComicPreview } from '@/components/ComicPreview';
import { EvalBoard } from '@/components/EvalBoard';
import { PageHeader } from '@/components/PageHeader';
import { ReviewCommentsCard } from '@/components/ReviewCommentsCard';
import { ErrorPanel, SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createReviewAssignment,
  createReviewComment,
  exportBundle,
  fetchLocalRuntimeView,
  fetchReviewRunView,
  fetchWorkflowArtifacts,
  resolveCanonicalization,
  runEvaluations,
  submitApproval,
} from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { uniqueStrings } from '@/lib/utils';
import { useRunPageContext } from '@/pages/RunLayout';

export function ReviewPage() {
  const { runId, workflowRun, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const [canonicalDiseaseName, setCanonicalDiseaseName] = useState('');
  const [resolutionReason, setResolutionReason] = useState('Local reviewer confirmed the intended disease.');
  const reviewRunState = useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);
  const runtimeViewState = useRemoteData(() => fetchLocalRuntimeView(), [refreshSignal]);
  const canonicalArtifactState = useRemoteData(
    () => fetchWorkflowArtifacts(runId, ['canonical-disease'], true),
    [runId, refreshSignal],
  );
  const exportDisabledReason = workflowRun.latestEvalStatus !== 'passed'
    ? 'Export requires a fresh passing eval run.'
    : undefined;
  const artifactTypes = uniqueStrings(workflowRun.artifacts.map((artifact) => artifact.artifactType));

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Review"
        title="Review Page"
        description="Primary run detail page for approvals, canonicalization interventions, eval reruns, and bundle readiness."
        actions={(
          <Button
            variant="secondary"
            disabled={Boolean(exportDisabledReason)}
            onClick={() => void exportBundle(runId, {}).then(() => refreshRun())}
          >
            Export bundle
          </Button>
        )}
      />

      {exportDisabledReason ? <Alert tone="warning">{exportDisabledReason}</Alert> : null}

      {workflowRun.currentStage === 'canonicalization' && workflowRun.state === 'failed' ? (
        <Card>
          <CardTitle>Canonicalization blocker</CardTitle>
          <CardDescription>This run cannot enter the clinical package stage until a reviewer confirms the intended disease.</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <Input value={canonicalDiseaseName} onChange={(event) => setCanonicalDiseaseName(event.target.value)} placeholder="Canonical disease name" />
            <Input value={resolutionReason} onChange={(event) => setResolutionReason(event.target.value)} placeholder="Resolution reason" />
            <Button
              disabled={!canonicalDiseaseName.trim()}
              onClick={() => void resolveCanonicalization(runId, {
                selectedCanonicalDiseaseName: canonicalDiseaseName,
                reason: resolutionReason,
              }).then(() => refreshRun())}
            >
              Resolve blocker
            </Button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
            {JSON.stringify(canonicalArtifactState.data?.artifacts?.[0]?.payload ?? {}, null, 2)}
          </pre>
        </Card>
      ) : null}

      {reviewRunState.error ? <ErrorPanel message={reviewRunState.error.message} /> : null}

      {reviewRunState.data ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-6">
            <ReviewAssignmentsCard
              assignments={reviewRunState.data.reviewAssignments}
              reviewRoles={workflowRun.requiredApprovalRoles}
              onCreate={async (payload) => {
                await createReviewAssignment(runId, payload);
                refreshRun();
              }}
              onComplete={async (assignment) => {
                await createReviewAssignment(runId, {
                  id: assignment.id,
                  reviewRole: assignment.reviewRole,
                  assigneeDisplayName: assignment.assigneeDisplayName,
                  assigneeId: assignment.assigneeId,
                  assigneeRoles: assignment.assigneeRoles,
                  status: 'completed',
                  notes: assignment.notes,
                });
                refreshRun();
              }}
            />
            <ReviewCommentsCard
              comments={reviewRunState.data.reviewComments}
              artifactTypes={artifactTypes}
              onCreate={async (payload) => {
                await createReviewComment(runId, payload);
                refreshRun();
              }}
              onResolve={async (comment) => {
                await createReviewComment(runId, {
                  id: comment.id,
                  scopeType: comment.scopeType,
                  artifactType: comment.artifactType,
                  artifactId: comment.artifactId,
                  fieldPath: comment.fieldPath,
                  severity: comment.severity,
                  status: 'resolved',
                  body: comment.body,
                  tags: comment.tags,
                });
                refreshRun();
              }}
            />
            <ApprovalsCard
              workflowRun={workflowRun}
              onSubmit={async (role, decision, comment) => {
                await submitApproval(runId, { role, decision, comment });
                refreshRun();
              }}
            />
            <EvalBoard
              evaluationSummary={reviewRunState.data.evaluationSummary}
              evaluations={reviewRunState.data.evaluationSummary.latestEvalRunId ? [{
                id: reviewRunState.data.evaluationSummary.latestEvalRunId,
                workflowRunId: runId,
                evaluatedAt: reviewRunState.data.evaluationSummary.evaluatedAt ?? '',
                summary: {
                  allThresholdsMet: Boolean(reviewRunState.data.evaluationSummary.allThresholdsMet),
                },
                familyResults: reviewRunState.data.evaluationSummary.familyStatuses,
              }] : []}
              onRun={async () => {
                await runEvaluations(runId);
                refreshRun();
              }}
            />
          </div>
          <div className="grid gap-6">
            <ComicPreview workflowRun={workflowRun} exportHistory={reviewRunState.data.exportHistory.entries} />
            <AgentInspector workflowRun={workflowRun} runtimeView={runtimeViewState.data} />
          </div>
        </div>
      ) : null}
    </SectionStack>
  );
}
