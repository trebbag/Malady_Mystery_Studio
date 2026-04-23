import { ActivityFeed } from '@/components/ActivityFeed';
import { ArtifactDiffCard } from '@/components/ArtifactDiffCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { fetchAuditLogEntries, fetchClinicalPackage, fetchReviewRunView } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime, uniqueStrings } from '@/lib/utils';
import { useRunPageContext } from '@/pages/RunLayout';

export function GovernancePage() {
  const { runId, workflowRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const reviewState = useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);
  const clinicalState = useRemoteData(() => fetchClinicalPackage(runId), [runId, refreshSignal]);
  const auditState = useRemoteData(() => fetchAuditLogEntries(runId), [runId, refreshSignal]);
  const diffableArtifactTypes = uniqueStrings(workflowRun.artifacts.map((artifact) => artifact.artifactType));

  return (
    <SectionStack>
      <PageHeader eyebrow="Governance" title="Governance Page" description="Approval status, audit history, clinical blockers, and release gate state." />
      {reviewState.data?.pauseReason ? <Alert tone="warning">Clinical blocker: {reviewState.data.pauseReason}</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Review governance summary</CardTitle>
          <CardDescription>Track outstanding comments, assignments, and trace blockers before export.</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Metric label="Assignments" value={reviewState.data?.reviewAssignments.length ?? 0} />
            <Metric label="Open comments" value={reviewState.data?.reviewComments.filter((comment) => comment.status === 'open').length ?? 0} />
            <Metric label="Active work items" value={reviewState.data?.workItems.length ?? 0} />
            <Metric label="Review threads" value={reviewState.data?.reviewThreads.length ?? 0} />
            <Metric label="Trace blockers" value={clinicalState.data?.traceCoverage.blockers.length ?? 0} />
            <Metric label="Blocking contradictions" value={clinicalState.data?.traceCoverage.blockingContradictions ?? 0} />
          </div>
        </Card>
        <Card>
          <CardTitle>Assignment and comment feed</CardTitle>
          <CardDescription>Review ownership and unresolved notes stay visible alongside the audit log.</CardDescription>
          <div className="mt-4 space-y-3">
            {(reviewState.data?.reviewAssignments ?? []).map((assignment) => (
              <div key={assignment.id} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="text-sm font-semibold text-shell-950">{assignment.reviewRole} → {assignment.assigneeDisplayName}</p>
                <p className="text-xs text-slate-500">{assignment.status} • {formatDateTime(assignment.updatedAt)}</p>
                {assignment.notes ? <p className="mt-2 text-sm text-slate-700">{assignment.notes}</p> : null}
              </div>
            ))}
            {(reviewState.data?.reviewComments ?? []).map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="text-sm font-semibold text-shell-950">{comment.scopeType === 'artifact' ? comment.artifactType : 'Run note'} • {comment.status}</p>
                <p className="text-xs text-slate-500">{comment.reviewerDisplayName} • {formatDateTime(comment.updatedAt)}</p>
                <p className="mt-2 text-sm text-slate-700">{comment.body}</p>
              </div>
            ))}
            {(reviewState.data?.reviewAssignments.length ?? 0) === 0 && (reviewState.data?.reviewComments.length ?? 0) === 0 ? (
              <Alert tone="info">No review assignments or comments are stored for this run yet.</Alert>
            ) : null}
          </div>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>Queue-backed governance work</CardTitle>
          <CardDescription>Due dates and escalation state stay visible here even when the work originated from another queue surface.</CardDescription>
          <div className="mt-4 space-y-3">
            {(reviewState.data?.workItems ?? []).map((workItem) => (
              <div key={workItem.id} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="text-sm font-semibold text-shell-950">{workItem.workType} · {workItem.priority}</p>
                <p className="text-xs text-slate-500">
                  {workItem.status} · due {formatDateTime(workItem.dueAt)} · queue {workItem.queueName}
                </p>
                {workItem.notes?.length ? <p className="mt-2 text-sm text-slate-700">{workItem.notes[0]}</p> : null}
              </div>
            ))}
            {(reviewState.data?.workItems.length ?? 0) === 0 ? (
              <Alert tone="info">No queue-backed governance work is attached to this run.</Alert>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardTitle>Threaded review context</CardTitle>
          <CardDescription>Run and artifact-level discussion stays grouped here so governance decisions retain their back-and-forth context.</CardDescription>
          <div className="mt-4 space-y-3">
            {(reviewState.data?.reviewThreads ?? []).map((thread) => (
              <div key={thread.id} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="text-sm font-semibold text-shell-950">{thread.title}</p>
                <p className="text-xs text-slate-500">
                  {thread.scopeType}{thread.scopeId ? ` · ${thread.scopeId}` : ''} · {thread.status}
                </p>
                <p className="mt-2 text-sm text-slate-700">{thread.messages?.length ?? 0} messages</p>
              </div>
            ))}
            {(reviewState.data?.reviewThreads.length ?? 0) === 0 ? (
              <Alert tone="info">No review threads are attached to this run yet.</Alert>
            ) : null}
          </div>
        </Card>
      </div>
      <ArtifactDiffCard runId={runId} artifactTypes={diffableArtifactTypes} refreshToken={refreshSignal} />
      <ActivityFeed entries={auditState.data ?? []} />
    </SectionStack>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-shell-950">{value}</p>
    </div>
  );
}
