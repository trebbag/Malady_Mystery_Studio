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
  approveKnowledgePack,
  createReviewAssignment,
  createReviewComment,
  createReviewThread,
  createThreadMessage,
  exportBundle,
  fetchNotifications,
  fetchLocalRuntimeView,
  fetchRenderingGuideView,
  fetchReviewRunView,
  fetchWorkflowArtifacts,
  promoteKnowledgePack,
  regenerateKnowledgePack,
  regenerateRenderingGuide,
  resolveCanonicalization,
  runEvaluations,
  submitApproval,
  updateNotification,
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
  const [mentionsByThreadId, setMentionsByThreadId] = useState<Record<string, string>>({});
  const reviewRunState = useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);
  const renderingGuideState = useRemoteData(() => fetchRenderingGuideView(runId), [runId, refreshSignal]);
  const runtimeViewState = useRemoteData(() => fetchLocalRuntimeView(), [refreshSignal]);
  const notificationsState = useRemoteData(() => fetchNotifications(), [refreshSignal]);
  const canonicalArtifactState = useRemoteData(
    () => fetchWorkflowArtifacts(runId, ['canonical-disease'], true),
    [runId, refreshSignal],
  );
  const knowledgePackArtifactsState = useRemoteData(
    () => fetchWorkflowArtifacts(runId, ['disease-knowledge-pack', 'research-brief', 'knowledge-pack-build-report'], true),
    [runId, refreshSignal],
  );
  const latestKnowledgePack = knowledgePackArtifactsState.data?.artifacts
    ?.filter((artifact) => artifact.artifactType === 'disease-knowledge-pack')
    .at(-1)?.payload as Record<string, unknown> | undefined;
  const latestResearchBrief = knowledgePackArtifactsState.data?.artifacts
    ?.filter((artifact) => artifact.artifactType === 'research-brief')
    .at(-1)?.payload as Record<string, unknown> | undefined;
  const latestBuildReport = knowledgePackArtifactsState.data?.artifacts
    ?.filter((artifact) => artifact.artifactType === 'knowledge-pack-build-report')
    .at(-1)?.payload as Record<string, unknown> | undefined;
  const renderedAssetManifestPresent = workflowRun.artifacts.some((artifact) => artifact.artifactType === 'rendered-asset-manifest');
  const exportDisabledReason = workflowRun.pauseReason === 'provisional-knowledge-pack-review-required'
    ? 'Export stays blocked until the provisional disease knowledge pack is approved for this run or promoted.'
    : workflowRun.latestEvalStatus !== 'passed'
    ? 'Export requires a fresh passing eval run.'
    : (!renderedAssetManifestPresent
      ? 'Export requires rendered panel assets and a rendered asset manifest.'
      : undefined);
  const artifactTypes = uniqueStrings(workflowRun.artifacts.map((artifact) => artifact.artifactType));
  const unreadNotifications = (notificationsState.data ?? []).filter((notification) => notification.status === 'unread');
  const sourceOriginSummary = latestKnowledgePack && typeof latestKnowledgePack.sourceOrigins === 'object' && latestKnowledgePack.sourceOrigins
    ? Object.entries(latestKnowledgePack.sourceOrigins as Record<string, unknown>)
      .map(([origin, count]) => `${origin}:${String(count)}`)
      .join(', ')
    : 'seeded';

  const parseMentionDraft = (value: string) => uniqueStrings(
    value
      .split(',')
      .map((entry) => entry.trim().replace(/^@/, ''))
      .filter(Boolean),
  );

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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Open disease compilation</CardTitle>
                  <CardDescription>
                    Unknown diseases now compile into a run-scoped provisional knowledge pack. Review can approve the pack for this run or promote it for reuse.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={!latestKnowledgePack}
                    onClick={() => void regenerateKnowledgePack(runId).then(() => refreshRun())}
                  >
                    Rebuild pack
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!latestKnowledgePack || latestKnowledgePack.packStatus === 'promoted'}
                    onClick={() => void approveKnowledgePack(runId, {
                      decision: 'approved',
                      reason: 'Local reviewer approved the provisional pack for this run.',
                    }).then(() => refreshRun())}
                  >
                    Approve for run
                  </Button>
                  <Button
                    disabled={!latestKnowledgePack || latestKnowledgePack.packStatus === 'promoted'}
                    onClick={() => void promoteKnowledgePack(runId, {
                      reason: 'Local reviewer promoted the run-scoped pack into the governed library.',
                    }).then(() => refreshRun())}
                  >
                    Promote globally
                  </Button>
                </div>
              </div>
              {latestKnowledgePack ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pack status</p>
                      <p className="mt-2 text-sm font-medium text-shell-950">
                        {String(latestKnowledgePack.packStatus ?? 'seeded')} · {String(latestKnowledgePack.generationMode ?? 'seeded')}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        scope: {String(latestKnowledgePack.packScope ?? 'library')} · origins: {sourceOriginSummary}
                      </p>
                    </div>
                    {workflowRun.pauseReason === 'provisional-knowledge-pack-review-required' ? (
                      <Alert tone="warning">
                        This run rendered panels, but export is still blocked until the provisional disease pack is approved or promoted.
                      </Alert>
                    ) : null}
                  </div>
                  <div className="grid gap-3">
                    {latestResearchBrief ? (
                      <pre className="overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
                        {JSON.stringify(latestResearchBrief, null, 2)}
                      </pre>
                    ) : null}
                    {latestBuildReport ? (
                      <pre className="overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
                        {JSON.stringify(latestBuildReport, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </div>
              ) : (
                <Alert tone="info">This run is using an existing governed pack, so no provisional knowledge-pack review is required.</Alert>
              )}
            </Card>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>In-app reviewer notifications track mentions, assignments, and promotion-ready pack events.</CardDescription>
                </div>
                <p className="rounded-full bg-shell-950 px-3 py-1 text-xs font-semibold text-white">{unreadNotifications.length} unread</p>
              </div>
              <div className="mt-4 space-y-3">
                {unreadNotifications.map((notification) => (
                  <div key={notification.id} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-shell-950">{notification.notificationType}</p>
                        <p className="text-sm text-slate-700">{notification.message}</p>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => void updateNotification(notification.id, { status: 'read' }).then(() => refreshRun())}
                      >
                        Mark read
                      </Button>
                    </div>
                  </div>
                ))}
                {unreadNotifications.length === 0 ? <Alert tone="info">No unread notifications for the local operator.</Alert> : null}
              </div>
            </Card>
            <Card>
              <CardTitle>Cross-run work items</CardTitle>
              <CardDescription>Assignments now project onto queue-backed work items with due dates, escalation state, and linked reviewer threads.</CardDescription>
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
                        <p className="text-xs text-slate-500">
                          {thread.scopeType}{thread.scopeId ? ` · ${thread.scopeId}` : ''}
                          {thread.latestMessageAt ? ` · updated ${formatDateTime(thread.latestMessageAt)}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          unread {thread.unreadCount ?? 0} · open actions {thread.openActionCount ?? 0} · linked work items {(thread.linkedWorkItemIds ?? []).length}
                        </p>
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
                          {(message.mentions?.length ?? 0) > 0 ? <p className="mt-2 text-xs text-slate-500">mentions: {message.mentions?.join(', ')}</p> : null}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-3">
                      <Textarea
                        className="min-h-20"
                        placeholder="Add a threaded reply"
                        value={messageByThreadId[thread.id] ?? ''}
                        onChange={(event) => setMessageByThreadId((current) => ({ ...current, [thread.id]: event.target.value }))}
                      />
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <Input
                          value={mentionsByThreadId[thread.id] ?? ''}
                          onChange={(event) => setMentionsByThreadId((current) => ({ ...current, [thread.id]: event.target.value }))}
                          placeholder="@local-operator, @clinical-reviewer"
                        />
                        <Button
                          onClick={() => void createThreadMessage(thread.id, {
                            body: messageByThreadId[thread.id] || 'Local follow-up.',
                            mentions: parseMentionDraft(mentionsByThreadId[thread.id] ?? ''),
                          }).then(() => refreshRun())}
                        >
                          Reply
                        </Button>
                      </div>
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
                  <CardTitle>Rendered panel delivery</CardTitle>
                  <CardDescription>The primary product path now ends in rendered comic panels. The rendering guide remains a secondary support artifact for retries, QA, and manual reuse.</CardDescription>
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
                        <p className="text-xs text-slate-500">Secondary render support artifact · prompt and retry guidance ready</p>
                        <p className="mt-2 text-sm text-slate-700">
                          Use this guide when a panel needs manual regeneration or a reviewer wants the full OpenAI Image prompt set in one place.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert tone="warning">No rendering guide is attached to this run yet.</Alert>
                )}
                {renderingGuideState.data?.attachmentSummary.attachedRenderedAssetCount ? (
                  <Alert tone="info">
                    Rendered art is attached for {renderingGuideState.data.attachmentSummary.attachedRenderedAssetCount} panel assets.
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
