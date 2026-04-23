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
import { Textarea } from '@/components/ui/textarea';
import {
  createReviewAssignment,
  createReviewComment,
  createReviewThread,
  createThreadMessage,
  exportBundle,
  fetchRenderingGuideView,
  fetchLocalRuntimeView,
  fetchReviewRunView,
  fetchWorkflowArtifacts,
  regenerateRenderingGuide,
  resolveCanonicalization,
  runEvaluations,
  submitApproval,
  updateWorkItem,
} from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime, uniqueStrings } from '@/lib/utils';
import { useRunPageContext } from '@/pages/RunLayout';

export function ReviewPage() {
  const { runId, workflowRun, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const [canonicalDiseaseName, setCanonicalDiseaseName] = useState('');
  const [resolutionReason, setResolutionReason] = useState('Local reviewer confirmed the intended disease.');
  const [threadTitle, setThreadTitle] = useState('Run review thread');
  const [threadScopeType, setThreadScopeType] = useState('run');
  const [messageByThreadId, setMessageByThreadId] = useState<Record<string, string>>({});
  const reviewRunState = useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);
  const renderingGuideState = useRemoteData(() => fetchRenderingGuideView(runId), [runId, refreshSignal]);
  const runtimeViewState = useRemoteData(() => fetchLocalRuntimeView(), [refreshSignal]);
  const canonicalArtifactState = useRemoteData(
    () => fetchWorkflowArtifacts(runId, ['canonical-disease'], true),
    [runId, refreshSignal],
  );
  const exportDisabledReason = workflowRun.latestEvalStatus !== 'passed'
    ? 'Export requires a fresh passing eval run.'
    : (!reviewRunState.data?.renderingGuide
      ? 'Export requires a current rendering guide for external handoff.'
      : undefined);
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
            <Card>
              <CardTitle>Cross-run work items</CardTitle>
              <CardDescription>Assignments now project onto queue-backed work items with due dates and escalation state.</CardDescription>
              <div className="mt-4 space-y-3">
                {(reviewRunState.data.workItems ?? []).map((workItem) => (
                  <div key={workItem.id} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-shell-950">{workItem.workType} · {workItem.priority}</p>
                        <p className="text-xs text-slate-500">{workItem.queueName} · due {formatDateTime(workItem.dueAt)}</p>
                        {workItem.notes?.length ? <p className="mt-2 text-sm text-slate-700">{workItem.notes[0]}</p> : null}
                      </div>
                      <div className="flex gap-2">
                        {workItem.status !== 'completed' ? (
                          <Button
                            variant="secondary"
                            onClick={() => void updateWorkItem(workItem.id, { status: 'in-progress' }).then(() => refreshRun())}
                          >
                            Start
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          onClick={() => void updateWorkItem(workItem.id, { status: 'completed' }).then(() => refreshRun())}
                        >
                          Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {(reviewRunState.data.workItems?.length ?? 0) === 0 ? (
                  <Alert tone="info">No queue-backed work items are attached to this run yet.</Alert>
                ) : null}
              </div>
            </Card>
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Review threads</CardTitle>
                  <CardDescription>Threaded reviewer conversation replaces one-off notes when a run needs back-and-forth decisions.</CardDescription>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void createReviewThread(runId, { title: threadTitle, scopeType: threadScopeType }).then(() => refreshRun())}
                >
                  Create thread
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
                <Input value={threadTitle} onChange={(event) => setThreadTitle(event.target.value)} placeholder="Thread title" />
                <Input value={threadScopeType} onChange={(event) => setThreadScopeType(event.target.value)} placeholder="Scope type" />
              </div>
              <div className="mt-4 space-y-4">
                {(reviewRunState.data.reviewThreads ?? []).map((thread) => (
                  <div key={thread.id} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-shell-950">{thread.title}</p>
                        <p className="text-xs text-slate-500">{thread.scopeType}{thread.scopeId ? ` · ${thread.scopeId}` : ''}</p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => void createThreadMessage(thread.id, {
                          body: messageByThreadId[thread.id] || 'Marked resolved from the local review page.',
                          resolutionNote: 'Resolved in local review.',
                        }).then(() => refreshRun())}
                      >
                        Resolve thread
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(thread.messages ?? []).map((message) => (
                        <div key={message.id} className="rounded-xl border border-black/10 bg-white p-3">
                          <p className="text-xs text-slate-500">{message.authorDisplayName} · {formatDateTime(message.updatedAt)}</p>
                          <p className="mt-1 text-sm text-slate-800">{message.body}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                      <Textarea
                        className="min-h-20"
                        placeholder="Add a threaded reply"
                        value={messageByThreadId[thread.id] ?? ''}
                        onChange={(event) => setMessageByThreadId((current) => ({ ...current, [thread.id]: event.target.value }))}
                      />
                      <Button
                        onClick={() => void createThreadMessage(thread.id, {
                          body: messageByThreadId[thread.id] || 'Local follow-up.',
                        }).then(() => refreshRun())}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="grid gap-6">
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Rendering guide delivery</CardTitle>
                  <CardDescription>The active product path ends at a provider-fitted handoff guide. External rendered art can still be attached later, but it is now secondary.</CardDescription>
                </div>
                <Button variant="secondary" onClick={() => void regenerateRenderingGuide(runId).then(() => refreshRun())}>
                  Regenerate guide
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {reviewRunState.data.renderingGuide ? (
                  <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-shell-950">{reviewRunState.data.renderingGuide.id}</p>
                        <p className="text-xs text-slate-500">Guide-first export path · markdown handoff ready</p>
                        <p className="mt-2 text-sm text-slate-700">
                          Panel prompts are now fitted for Nano Banana Pro and Genspark AI Slides, with one panel per slide and separate lettering overlays.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert tone="warning">No rendering guide is attached to this run yet.</Alert>
                )}
                {renderingGuideState.data?.attachmentSummary.attachedRenderedAssetCount ? (
                  <Alert tone="info">
                    Optional external art is attached for {renderingGuideState.data.attachmentSummary.attachedRenderedAssetCount} panel assets.
                  </Alert>
                ) : null}
              </div>
            </Card>
            <ComicPreview workflowRun={workflowRun} exportHistory={reviewRunState.data.exportHistory.entries} />
            <AgentInspector workflowRun={workflowRun} runtimeView={runtimeViewState.data} />
          </div>
        </div>
      ) : null}
    </SectionStack>
  );
}
