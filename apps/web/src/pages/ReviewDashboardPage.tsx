import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/PageHeader';
import { ErrorPanel, LoadingPanel } from '@/components/StatePanel';
import { StatusPill } from '@/components/StatusPill';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createProject, fetchDashboardView, startWorkflowRun } from '@/lib/api';
import { useRefreshContext, useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime, titleFromSlug } from '@/lib/utils';

const defaultCreateState = {
  diseaseName: '',
  title: '',
  audienceTier: 'provider-education',
  lengthProfile: 'standard-issue',
  qualityProfile: 'pilot',
  styleProfile: 'whimsical-mystery',
};

export function ReviewDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const refreshContext = useRefreshContext();
  const refreshSignal = useRefreshSignal();
  const [createState, setCreateState] = useState(defaultCreateState);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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

  const handleCreateRun = async () => {
    setCreateError(null);
    setIsCreating(true);

    try {
      const project = await createProject({
        diseaseName: createState.diseaseName,
        title: createState.title || undefined,
        audienceTier: createState.audienceTier,
        lengthProfile: createState.lengthProfile,
        qualityProfile: createState.qualityProfile,
        styleProfile: createState.styleProfile,
      });
      const workflowRun = await startWorkflowRun({ projectId: project.id });

      refreshContext.refreshGlobal();
      navigate(`/runs/${encodeURIComponent(workflowRun.id)}/overview`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'The disease run could not be started.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Home"
        title="Make a disease comic"
        description="Start with a disease, then follow one guided path: clinical review, guide approval, panel rendering, final checks, and export."
        actions={<Button variant="secondary" onClick={() => navigate('/review/queue')}>Open review queue</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-accent-200 bg-accent-50/90">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-shell-700">Start here</p>
          <CardTitle className="mt-2 text-2xl">Create a new disease run</CardTitle>
          <CardDescription>Type any disease or condition. The local pipeline will build a provisional or governed clinical package, then guide you through the review gates.</CardDescription>
          <div className="mt-4 grid gap-3">
            <Input
              placeholder="Disease or condition"
              value={createState.diseaseName}
              onChange={(event) => setCreateState((current) => ({ ...current, diseaseName: event.target.value }))}
            />
            <Input
              placeholder="Optional project title"
              value={createState.title}
              onChange={(event) => setCreateState((current) => ({ ...current, title: event.target.value }))}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Select value={createState.audienceTier} onChange={(event) => setCreateState((current) => ({ ...current, audienceTier: event.target.value }))}>
                <option value="provider-education">Provider education</option>
                <option value="patient-friendly">Patient friendly</option>
              </Select>
              <Select value={createState.lengthProfile} onChange={(event) => setCreateState((current) => ({ ...current, lengthProfile: event.target.value }))}>
                <option value="standard-issue">Standard issue</option>
                <option value="double-issue">Double issue</option>
              </Select>
            </div>
            <Button disabled={!createState.diseaseName.trim() || isCreating} onClick={() => void handleCreateRun()}>
              {isCreating ? 'Starting run...' : 'Start disease run'}
            </Button>
            {createError ? <Alert tone="critical">{createError}</Alert> : null}
            <div className="rounded-2xl border border-black/10 bg-white/75 p-4">
              <p className="text-sm font-semibold text-shell-950">What happens after you start?</p>
              <ol className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                <li>1. The app builds a clinical package from governed or provisional local evidence.</li>
                <li>2. You approve the clinical foundation and visual guide before rendering.</li>
                <li>3. Panels render, safety checks run, and the finished files export locally.</li>
              </ol>
            </div>
            {isCreating ? <Alert tone="info">Starting the local disease run. You will be taken to the run overview when it is ready.</Alert> : null}
          </div>
        </Card>

        <Card>
          <CardTitle>Continue where you left off</CardTitle>
          <CardDescription>The app now chooses one next action for each run instead of asking you to pick from internal pipeline pages.</CardDescription>
          <div className="mt-4 grid gap-3">
            {dashboardState.data?.runs.slice(0, 3).map((run) => (
              <button
                key={run.runId}
                type="button"
                className="rounded-2xl border border-black/10 bg-slate-50 p-4 text-left transition hover:bg-white hover:shadow-panel"
                onClick={() => navigate(run.nextAction.targetPath)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-shell-950">{run.diseaseName}</p>
                    <p className="mt-1 text-sm text-slate-600">{run.friendlyStatus}</p>
                  </div>
                  <StatusPill label={run.activeStep} />
                </div>
                <p className="mt-3 text-sm font-semibold text-shell-950">Next: {run.nextAction.label}</p>
                {run.primaryBlocker ? <p className="mt-1 text-sm text-amber-800">{run.primaryBlocker}</p> : null}
              </button>
            ))}
            {dashboardState.data && dashboardState.data.runs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-black/10 bg-slate-50 p-4 text-sm text-slate-600">
                No runs yet. Start with a disease name on the left.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      {dashboardState.loading ? <LoadingPanel rows={5} /> : null}
      {dashboardState.error ? <ErrorPanel message={dashboardState.error.message} /> : null}
      {dashboardState.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Runs" value={dashboardState.data.stats.visibleRunCount} />
            <MetricCard label="Need review" value={dashboardState.data.stats.awaitingReviewCount + dashboardState.data.stats.blockedClinicalRunCount} />
            <MetricCard label="Overdue work" value={dashboardState.data.stats.overdueWorkItemCount} />
            <MetricCard label="Export ready" value={dashboardState.data.stats.exportReadyCount} />
          </div>

          <Card>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-shell-950">Filter and sort runs</summary>
              <CardDescription className="mt-2">Use filters only when the run list gets long.</CardDescription>
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

          <Card>
            <CardTitle>All runs</CardTitle>
            <CardDescription>Each run shows the current step, plain-language status, and the next useful action.</CardDescription>
            <div className="mt-4 grid gap-3">
              {dashboardState.data.runs.map((run) => (
                <div key={run.runId} className="grid gap-4 rounded-2xl border border-black/10 bg-slate-50 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-shell-950">{run.diseaseName}</p>
                      <StatusPill label={run.activeStep} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{run.friendlyStatus}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {run.projectTitle} · updated {formatDateTime(run.updatedAt)} · {titleFromSlug(run.latestEvalStatus)} safety checks · {run.activeWorkItemCount} open queue item(s)
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(run.nextAction.targetPath)}>
                    {run.nextAction.label}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
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
