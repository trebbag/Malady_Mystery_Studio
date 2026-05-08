import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/PageHeader';
import { ErrorPanel, LoadingPanel } from '@/components/StatePanel';
import { StatusPill } from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { fetchDashboardView } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import type { DashboardRun } from '@/lib/types';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime, titleFromSlug } from '@/lib/utils';

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const refreshSignal = useRefreshSignal();
  const filters = useMemo(() => ({
    disease: searchParams.get('disease') ?? '',
    state: searchParams.get('state') ?? '',
    stage: searchParams.get('stage') ?? '',
    assignee: searchParams.get('assignee') ?? '',
    exportStatus: searchParams.get('exportStatus') ?? '',
    evalStatus: searchParams.get('evalStatus') ?? '',
    queueStatus: searchParams.get('queueStatus') ?? '',
    workType: searchParams.get('workType') ?? '',
    sort: searchParams.get('sort') ?? 'updated-desc',
  }), [searchParams]);
  const dashboardState = useRemoteData(
    () => fetchDashboardView(filters),
    [filters.disease, filters.state, filters.stage, filters.assignee, filters.exportStatus, filters.evalStatus, filters.queueStatus, filters.workType, filters.sort, refreshSignal],
  );

  const updateFilter = (name: string, value: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (value) {
      nextSearchParams.set(name, value);
    } else {
      nextSearchParams.delete(name);
    }

    setSearchParams(nextSearchParams);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Runs"
        title="Runs"
        description="A focused list of every local disease comic run, with the next action and blocker called out first."
        actions={<Button onClick={() => navigate('/review')}>Start another disease</Button>}
      />

      {dashboardState.loading ? <LoadingPanel rows={5} /> : null}
      {dashboardState.error ? <ErrorPanel message={dashboardState.error.message} /> : null}

      {dashboardState.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Total runs" value={dashboardState.data.stats.visibleRunCount} />
            <MetricCard label="Need review" value={dashboardState.data.stats.awaitingReviewCount + dashboardState.data.stats.blockedClinicalRunCount} />
            <MetricCard label="Overdue work" value={dashboardState.data.stats.overdueWorkItemCount} />
            <MetricCard label="Ready to export" value={dashboardState.data.stats.exportReadyCount} />
          </div>

          <Card>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-shell-950">Filter and sort</summary>
              <CardDescription className="mt-2">Keep this closed unless you are looking for a specific run or blocker type.</CardDescription>
              <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-9">
                <Input value={filters.disease} onChange={(event) => updateFilter('disease', event.target.value)} placeholder="Disease" />
                <Input value={filters.state} onChange={(event) => updateFilter('state', event.target.value)} placeholder="State" />
                <Input value={filters.stage} onChange={(event) => updateFilter('stage', event.target.value)} placeholder="Stage" />
                <Input value={filters.assignee} onChange={(event) => updateFilter('assignee', event.target.value)} placeholder="Assignee" />
                <Select value={filters.exportStatus} onChange={(event) => updateFilter('exportStatus', event.target.value)}>
                  <option value="">Any export state</option>
                  <option value="with-exports">With exports</option>
                  <option value="without-exports">Without exports</option>
                </Select>
                <Select value={filters.evalStatus} onChange={(event) => updateFilter('evalStatus', event.target.value)}>
                  <option value="">Any safety-check state</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="stale">Stale</option>
                  <option value="missing">Missing</option>
                </Select>
                <Select value={filters.queueStatus} onChange={(event) => updateFilter('queueStatus', event.target.value)}>
                  <option value="">Any queue state</option>
                  <option value="active">Active work</option>
                  <option value="overdue">Overdue work</option>
                </Select>
                <Select value={filters.workType} onChange={(event) => updateFilter('workType', event.target.value)}>
                  <option value="">Any work type</option>
                  <option value="run-review">Run review</option>
                  <option value="source-refresh">Source refresh</option>
                  <option value="contradiction-resolution">Contradiction resolution</option>
                  <option value="render-retry">Render retry</option>
                  <option value="ops-drill">Ops drill</option>
                </Select>
                <Select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}>
                  <option value="updated-desc">Recently updated</option>
                  <option value="disease-asc">Disease A-Z</option>
                  <option value="state-asc">State A-Z</option>
                  <option value="stage-asc">Stage A-Z</option>
                  <option value="exports-desc">Most exports</option>
                  <option value="eval-status">Safety-check status</option>
                </Select>
              </div>
            </details>
          </Card>

          <div className="grid gap-4">
            {dashboardState.data.runs.length === 0 ? (
              <Card>
                <CardTitle>No runs yet</CardTitle>
                <CardDescription>Start from Home by typing a disease or condition.</CardDescription>
                <div className="mt-4">
                  <Button onClick={() => navigate('/review')}>Start first disease</Button>
                </div>
              </Card>
            ) : dashboardState.data.runs.map((run) => (
              <RunListCard
                key={run.runId}
                run={run}
                onOpen={() => navigate(run.nextAction.targetPath)}
                onOverview={() => navigate(`/runs/${encodeURIComponent(run.runId)}/overview`)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function RunListCard({ run, onOpen, onOverview }: { run: DashboardRun; onOpen: () => void; onOverview: () => void }) {
  return (
    <Card className="bg-white/95">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{run.diseaseName}</CardTitle>
            <StatusPill label={run.activeStep} />
            {run.primaryBlocker ? <StatusPill label="blocked" /> : null}
          </div>
          <CardDescription className="mt-2">{run.friendlyStatus}</CardDescription>
          {run.primaryBlocker ? (
            <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {run.primaryBlocker}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            {run.projectTitle} · updated {formatDateTime(run.updatedAt)} · {titleFromSlug(run.latestEvalStatus)} safety checks · {run.activeWorkItemCount} open queue item(s) · {run.threadCount} thread(s)
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:min-w-52">
          <Button onClick={onOpen}>{run.nextAction.label}</Button>
          <Button variant="ghost" onClick={onOverview}>
            Open overview
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-white/85">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-shell-950">{value}</p>
    </Card>
  );
}
