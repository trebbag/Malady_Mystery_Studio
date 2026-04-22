import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/PageHeader';
import { ErrorPanel, LoadingPanel } from '@/components/StatePanel';
import { StatusPill } from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { createProject, fetchDashboardView, startWorkflowRun } from '@/lib/api';
import { useRefreshContext, useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime } from '@/lib/utils';

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
  const filters = useMemo(() => ({
    disease: searchParams.get('disease') ?? '',
    state: searchParams.get('state') ?? '',
    stage: searchParams.get('stage') ?? '',
    assignee: searchParams.get('assignee') ?? '',
    exportStatus: searchParams.get('exportStatus') ?? '',
    evalStatus: searchParams.get('evalStatus') ?? '',
    sort: searchParams.get('sort') ?? 'updated-desc',
  }), [searchParams]);
  const dashboardState = useRemoteData(() => fetchDashboardView(filters), [filters.disease, filters.state, filters.stage, filters.assignee, filters.exportStatus, filters.evalStatus, filters.sort, refreshSignal]);

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
    navigate(`/runs/${encodeURIComponent(workflowRun.id)}/review`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Local review"
        title="Review Dashboard"
        description="Primary local shell for run selection, workflow initiation, and at-a-glance gate health."
      />

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Card>
          <CardTitle>Run filters</CardTitle>
          <CardDescription>Drive the review queue by disease, stage, export presence, and eval state.</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
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
              <option value="">Any eval state</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="stale">Stale</option>
              <option value="missing">Missing</option>
            </Select>
            <Select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}>
              <option value="updated-desc">Recently updated</option>
              <option value="disease-asc">Disease A-Z</option>
              <option value="state-asc">State A-Z</option>
              <option value="stage-asc">Stage A-Z</option>
              <option value="exports-desc">Most exports</option>
              <option value="eval-status">Eval status</option>
            </Select>
          </div>
        </Card>

        <Card>
          <CardTitle>Start local run</CardTitle>
          <CardDescription>Replaces the older `/intake` page as the main workflow entry point.</CardDescription>
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
            <Button disabled={!createState.diseaseName.trim()} onClick={() => void handleCreateRun()}>
              Create project and start workflow
            </Button>
          </div>
        </Card>
      </div>

      {dashboardState.loading ? <LoadingPanel rows={5} /> : null}
      {dashboardState.error ? <ErrorPanel message={dashboardState.error.message} /> : null}
      {dashboardState.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <MetricCard label="Visible runs" value={dashboardState.data.stats.visibleRunCount} />
            <MetricCard label="Clinical blockers" value={dashboardState.data.stats.blockedClinicalRunCount} />
            <MetricCard label="Awaiting review" value={dashboardState.data.stats.awaitingReviewCount} />
            <MetricCard label="Assigned runs" value={dashboardState.data.stats.assignedRunCount} />
            <MetricCard label="Open comments" value={dashboardState.data.stats.openCommentCount} />
            <MetricCard label="Stale evals" value={dashboardState.data.stats.staleEvalCount} />
            <MetricCard label="Export ready" value={dashboardState.data.stats.exportReadyCount} />
          </div>

          <Card>
            <CardTitle>Active review queue</CardTitle>
            <CardDescription>Every row is wired to live run/project/eval/export data. No placeholder demo values remain.</CardDescription>
            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Disease</Th>
                    <Th>Project</Th>
                    <Th>State</Th>
                    <Th>Stage</Th>
                    <Th>Assignees</Th>
                    <Th>Comments</Th>
                    <Th>Eval</Th>
                    <Th>Exports</Th>
                    <Th>Updated</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {dashboardState.data.runs.map((run) => (
                    <tr key={run.runId}>
                      <Td>{run.diseaseName}</Td>
                      <Td>{run.projectTitle}</Td>
                      <Td><StatusPill label={run.state} /></Td>
                      <Td>{run.currentStage}</Td>
                      <Td>{run.assignees.length > 0 ? run.assignees.join(', ') : 'Unassigned'}</Td>
                      <Td>{run.openCommentCount}</Td>
                      <Td><StatusPill label={run.latestEvalStatus} /></Td>
                      <Td>{run.exportCount}</Td>
                      <Td>{formatDateTime(run.updatedAt)}</Td>
                      <Td className="text-right">
                        <Button variant="secondary" onClick={() => navigate(`/runs/${encodeURIComponent(run.runId)}/review`)}>
                          Open run
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
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
