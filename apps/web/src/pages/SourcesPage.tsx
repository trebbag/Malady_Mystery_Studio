import { useState } from 'react';

import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  assignSourceOwnership,
  createSourceRefreshTask,
  fetchClinicalPackage,
  fetchReviewRunView,
  fetchSourceCatalog,
  recordSourceDecision,
} from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime } from '@/lib/utils';
import { useRunPageContext } from '@/pages/RunLayout';

export function SourcesPage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const clinicalState = useRemoteData(() => fetchClinicalPackage(runId), [runId, refreshSignal]);
  const reviewState = useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);
  const canonicalDiseaseName = typeof clinicalState.data?.diseasePacket.canonicalDiseaseName === 'string'
    ? clinicalState.data.diseasePacket.canonicalDiseaseName
    : '';
  const sourcesState = useRemoteData(() => fetchSourceCatalog(), [refreshSignal]);
  const [decisionBySourceId, setDecisionBySourceId] = useState<Record<string, string>>({});
  const [reasonBySourceId, setReasonBySourceId] = useState<Record<string, string>>({});
  const [primaryOwnerRoleBySourceId, setPrimaryOwnerRoleBySourceId] = useState<Record<string, string>>({});
  const [backupOwnerRoleBySourceId, setBackupOwnerRoleBySourceId] = useState<Record<string, string>>({});
  const sourceRefreshItems = (reviewState.data?.workItems ?? []).filter((workItem) => workItem.workType === 'source-refresh');
  const visibleSources = (sourcesState.data ?? []).filter((sourceRecord) => (
    !canonicalDiseaseName || String(sourceRecord.canonicalDiseaseName ?? '') === canonicalDiseaseName
  ));

  return (
    <SectionStack>
      <PageHeader eyebrow="Sources" title="Sources Page" description="Governed source records and reviewer-driven source status changes." />
      <ArtifactJsonCard title="Governance summary" value={clinicalState.data?.sourceGovernance ?? {}} />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Visible sources" value={String(visibleSources.length)} />
        <Metric label="Refresh tasks" value={String(sourceRefreshItems.length)} />
        <Metric
          label="Blocked sources"
          value={String(visibleSources.filter((sourceRecord) => String(sourceRecord.freshnessState ?? '') === 'blocked').length)}
        />
        <Metric
          label="Stale sources"
          value={String(visibleSources.filter((sourceRecord) => String(sourceRecord.freshnessState ?? '') === 'stale').length)}
        />
      </div>
      {sourceRefreshItems.length > 0 ? (
        <Card>
          <CardTitle>Refresh queue context</CardTitle>
          <CardDescription>These queue-backed work items were created from source freshness, suspension, contradiction, or supersession state.</CardDescription>
          <div className="mt-4 space-y-3">
            {sourceRefreshItems.map((workItem) => (
              <div key={workItem.id} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-shell-950">{workItem.subjectId}</p>
                    <p className="text-xs text-slate-500">
                      {workItem.status} · {workItem.priority} · due {formatDateTime(workItem.dueAt)}
                    </p>
                  </div>
                  {workItem.status === 'escalated' ? <Alert tone="warning">Escalated</Alert> : null}
                </div>
                {workItem.notes?.length ? <p className="mt-2 text-sm text-slate-700">{workItem.notes[0]}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {visibleSources.map((sourceRecord) => {
        const sourceId = String(sourceRecord.id ?? '');
        const refreshTask = sourceRefreshItems.find((workItem) => workItem.subjectId === sourceId);

        return (
          <Card key={sourceId}>
            <CardTitle>{String(sourceRecord.sourceLabel ?? sourceId)}</CardTitle>
            <CardDescription>{String(sourceRecord.sourceUrl ?? 'No source URL recorded.')}</CardDescription>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Metric label="Freshness" value={String(sourceRecord.freshnessState ?? sourceRecord.freshnessStatus ?? 'unknown')} />
              <Metric label="Approval" value={String(sourceRecord.approvalStatus ?? 'unknown')} />
              <Metric label="Impacted runs" value={String(sourceRecord.impactedRunCount ?? 0)} />
              <Metric label="Open refresh tasks" value={String(sourceRecord.openRefreshTaskCount ?? 0)} />
            </div>
            {refreshTask ? (
              <Alert tone={refreshTask.status === 'escalated' ? 'warning' : 'info'}>
                Refresh queue item: {refreshTask.status} · due {formatDateTime(refreshTask.dueAt)}
              </Alert>
            ) : null}
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
              {JSON.stringify(sourceRecord, null, 2)}
            </pre>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <Input
                placeholder="Decision"
                value={decisionBySourceId[sourceId] ?? 'approved'}
                onChange={(event) => setDecisionBySourceId((current) => ({ ...current, [sourceId]: event.target.value }))}
              />
              <Input
                placeholder="Reason"
                value={reasonBySourceId[sourceId] ?? ''}
                onChange={(event) => setReasonBySourceId((current) => ({ ...current, [sourceId]: event.target.value }))}
              />
              <Button
                onClick={() => void recordSourceDecision(sourceId, {
                  canonicalDiseaseName,
                  decision: decisionBySourceId[sourceId] ?? 'approved',
                  reason: reasonBySourceId[sourceId] || undefined,
                }).then(() => refreshRun())}
              >
                Save decision
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="Primary owner role"
                value={primaryOwnerRoleBySourceId[sourceId] ?? String(sourceRecord.primaryOwnerRole ?? 'Clinical Reviewer')}
                onChange={(event) => setPrimaryOwnerRoleBySourceId((current) => ({ ...current, [sourceId]: event.target.value }))}
              />
              <Input
                placeholder="Backup owner role"
                value={backupOwnerRoleBySourceId[sourceId] ?? String(sourceRecord.backupOwnerRole ?? 'Product Editor')}
                onChange={(event) => setBackupOwnerRoleBySourceId((current) => ({ ...current, [sourceId]: event.target.value }))}
              />
              <Button
                variant="secondary"
                onClick={() => void assignSourceOwnership(sourceId, {
                  canonicalDiseaseName,
                  primaryOwnerRole: primaryOwnerRoleBySourceId[sourceId] ?? String(sourceRecord.primaryOwnerRole ?? 'Clinical Reviewer'),
                  backupOwnerRole: backupOwnerRoleBySourceId[sourceId] ?? String(sourceRecord.backupOwnerRole ?? 'Product Editor'),
                }).then(() => refreshRun())}
              >
                Save owners
              </Button>
            </div>
            <div className="mt-4">
              <Button
                variant="ghost"
                onClick={() => void createSourceRefreshTask(sourceId, {
                  canonicalDiseaseName,
                  workflowRunId: runId,
                  reason: reasonBySourceId[sourceId] || undefined,
                }).then(() => refreshRun())}
              >
                Create refresh task
              </Button>
            </div>
          </Card>
        );
      })}
    </SectionStack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-shell-950">{value}</p>
    </div>
  );
}
