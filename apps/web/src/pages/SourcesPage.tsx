import { useState } from 'react';

import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  assignSourceOwnership,
  createSourceRefreshTask,
  fetchClinicalPackage,
  fetchReviewRunView,
  fetchSourceRefreshCalendar,
  fetchSourceOps,
  recordSourceDecision,
  updateWorkItem,
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
  const [freshnessFilter, setFreshnessFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [openRefreshOnly, setOpenRefreshOnly] = useState(false);
  const sourcesState = useRemoteData(
    () => fetchSourceOps({
      disease: canonicalDiseaseName,
      freshnessState: freshnessFilter,
      approvalStatus: approvalFilter,
      ownerRole: ownerFilter,
      openRefreshOnly,
    }),
    [canonicalDiseaseName, freshnessFilter, approvalFilter, ownerFilter, String(openRefreshOnly), refreshSignal],
  );
  const calendarState = useRemoteData(() => fetchSourceRefreshCalendar(), [refreshSignal]);
  const [decisionBySourceId, setDecisionBySourceId] = useState<Record<string, string>>({});
  const [reasonBySourceId, setReasonBySourceId] = useState<Record<string, string>>({});
  const [supersededBySourceId, setSupersededBySourceId] = useState<Record<string, string>>({});
  const [primaryOwnerRoleBySourceId, setPrimaryOwnerRoleBySourceId] = useState<Record<string, string>>({});
  const [backupOwnerRoleBySourceId, setBackupOwnerRoleBySourceId] = useState<Record<string, string>>({});
  const sourceRefreshItems = sourcesState.data?.workItems ?? (reviewState.data?.workItems ?? []).filter((workItem) => workItem.workType === 'source-refresh');
  const visibleSources = sourcesState.data?.sourceRecords ?? [];

  return (
    <SectionStack>
      <PageHeader eyebrow="Sources" title="Sources Page" description="Governed source records and reviewer-driven source status changes." />
      <ArtifactJsonCard title="Governance summary" value={clinicalState.data?.sourceGovernance ?? {}} />
      <Card>
        <CardTitle>Source ops filters</CardTitle>
        <CardDescription>Filter across promoted library sources and run-scoped provisional sources by owner, freshness, status, and open refresh burden.</CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Select value={freshnessFilter} onChange={(event) => setFreshnessFilter(event.target.value)}>
            <option value="">Any freshness</option>
            <option value="current">Current</option>
            <option value="aging">Aging</option>
            <option value="stale">Stale</option>
            <option value="blocked">Blocked</option>
          </Select>
          <Select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)}>
            <option value="">Any approval</option>
            <option value="approved">Approved</option>
            <option value="conditional">Conditional</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Input value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} placeholder="Owner role" />
          <Button variant={openRefreshOnly ? 'primary' : 'secondary'} onClick={() => setOpenRefreshOnly((value) => !value)}>
            {openRefreshOnly ? 'Showing open refresh' : 'Open refresh only'}
          </Button>
          <Button variant="ghost" onClick={() => {
            setFreshnessFilter('');
            setApprovalFilter('');
            setOwnerFilter('');
            setOpenRefreshOnly(false);
          }}>
            Clear
          </Button>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Visible sources" value={String(sourcesState.data?.summary.visibleSourceCount ?? visibleSources.length)} />
        <Metric label="Open refresh" value={String(sourcesState.data?.summary.openRefreshTaskCount ?? sourceRefreshItems.length)} />
        <Metric label="Blocked" value={String(sourcesState.data?.summary.blockedSourceCount ?? 0)} />
        <Metric label="Promoted diseases" value={String(sourcesState.data?.summary.promotedDiseaseCount ?? 0)} />
      </div>
      {calendarState.data ? (
        <Card>
          <CardTitle>Source refresh calendar</CardTitle>
          <CardDescription>Local owner due-date proof across governed and run-scoped sources.</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <Metric label="Tracked sources" value={String(calendarState.data.summary.totalSourceCount)} />
            <Metric label="Due soon" value={String(calendarState.data.summary.dueSoonCount)} />
            <Metric label="Overdue" value={String(calendarState.data.summary.overdueCount)} />
            <Metric label="Ownerless" value={String(calendarState.data.summary.ownerlessCount)} />
            <Metric label="Open work" value={String(calendarState.data.summary.openRefreshWorkCount)} />
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {calendarState.data.items.slice(0, 8).map((item) => (
              <div key={item.sourceId} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-shell-950">{item.sourceLabel}</p>
                    <p className="text-xs text-slate-500">{item.canonicalDiseaseName}</p>
                  </div>
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{item.bucket}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Owner: {item.primaryOwnerRole || 'ownerless'} · backup: {item.backupOwnerRole || 'ownerless'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Due {formatDateTime(item.nextReviewDueAt)} · {item.daysUntilDue} days · {item.openRefreshWorkItemIds.length} open queue items
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
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
                value={decisionBySourceId[sourceId] ?? 'refresh-review-date'}
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
                  decision: decisionBySourceId[sourceId] ?? 'refresh-review-date',
                  reason: reasonBySourceId[sourceId] || undefined,
                  supersededBy: supersededBySourceId[sourceId] || undefined,
                }).then(() => refreshRun())}
              >
                Save decision
              </Button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
              <Input
                placeholder="Superseded-by source id"
                value={supersededBySourceId[sourceId] ?? ''}
                onChange={(event) => setSupersededBySourceId((current) => ({ ...current, [sourceId]: event.target.value }))}
              />
              <Button
                variant="secondary"
                onClick={() => void recordSourceDecision(sourceId, {
                  canonicalDiseaseName,
                  decision: 'refresh-review-date',
                  reason: reasonBySourceId[sourceId] || 'Reviewer marked the source refreshed in local source ops.',
                }).then(() => refreshRun())}
              >
                Mark refreshed
              </Button>
              <Button
                variant="secondary"
                onClick={() => void recordSourceDecision(sourceId, {
                  canonicalDiseaseName,
                  decision: 'suspended',
                  reason: reasonBySourceId[sourceId] || 'Reviewer suspended the source pending refresh or replacement.',
                }).then(() => refreshRun())}
              >
                Suspend
              </Button>
              <Button
                variant="secondary"
                disabled={!supersededBySourceId[sourceId]}
                onClick={() => void recordSourceDecision(sourceId, {
                  canonicalDiseaseName,
                  decision: 'superseded',
                  reason: reasonBySourceId[sourceId] || 'Reviewer marked this source superseded.',
                  supersededBy: supersededBySourceId[sourceId],
                }).then(() => refreshRun())}
              >
                Mark superseded
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
              {refreshTask ? (
                <Button
                  variant="secondary"
                  onClick={() => void updateWorkItem(refreshTask.id, { status: 'completed' }).then(() => refreshRun())}
                >
                  Resolve refresh work
                </Button>
              ) : null}
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
