import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/PageHeader';
import { ErrorPanel, LoadingPanel, SectionStack } from '@/components/StatePanel';
import { StatusPill } from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { fetchReviewQueue, updateWorkItem } from '@/lib/api';
import { useRefreshContext, useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime } from '@/lib/utils';

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const refreshContext = useRefreshContext();
  const refreshSignal = useRefreshSignal();
  const filters = useMemo(() => ({
    workType: searchParams.get('workType') ?? '',
    status: searchParams.get('status') ?? '',
    priority: searchParams.get('priority') ?? '',
    queueName: searchParams.get('queueName') ?? '',
    assignee: searchParams.get('assignee') ?? '',
  }), [searchParams]);
  const queueState = useRemoteData(
    () => fetchReviewQueue(filters),
    [filters.workType, filters.status, filters.priority, filters.queueName, filters.assignee, refreshSignal],
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

  const refreshAll = () => {
    refreshContext.refreshGlobal();
  };

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Queue"
        title="Review Queue"
        description="Cross-run operational queue for run review, source refresh, contradiction follow-up, render retry, and ops drill work."
      />

      <Card>
        <CardTitle>Queue filters</CardTitle>
        <CardDescription>Filter by work type, status, queue, assignee, and urgency.</CardDescription>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Select value={filters.workType} onChange={(event) => updateFilter('workType', event.target.value)}>
            <option value="">Any work type</option>
            <option value="run-review">Run review</option>
            <option value="source-refresh">Source refresh</option>
            <option value="contradiction-resolution">Contradiction resolution</option>
            <option value="render-retry">Render retry</option>
            <option value="ops-drill">Ops drill</option>
          </Select>
          <Select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">Any status</option>
            <option value="queued">Queued</option>
            <option value="in-progress">In progress</option>
            <option value="escalated">Escalated</option>
            <option value="completed">Completed</option>
          </Select>
          <Select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
            <option value="">Any priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Input value={filters.queueName} onChange={(event) => updateFilter('queueName', event.target.value)} placeholder="Queue name" />
          <Input value={filters.assignee} onChange={(event) => updateFilter('assignee', event.target.value)} placeholder="Assignee" />
        </div>
      </Card>

      {queueState.loading ? <LoadingPanel rows={6} /> : null}
      {queueState.error ? <ErrorPanel message={queueState.error.message} /> : null}

      {queueState.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Visible items" value={queueState.data.stats.visibleItemCount} />
            <MetricCard label="Overdue items" value={queueState.data.stats.overdueItemCount} />
            <MetricCard label="Escalated items" value={queueState.data.stats.escalatedItemCount} />
            <MetricCard label="Render retries" value={queueState.data.stats.renderRetryCount} />
            <MetricCard label="Source refresh" value={queueState.data.stats.sourceRefreshCount} />
          </div>

          <Card>
            <CardTitle>Active cross-run work</CardTitle>
            <CardDescription>Use this queue to move review, source-governance, and render follow-up across runs instead of one run page at a time.</CardDescription>
            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Disease</Th>
                    <Th>Work type</Th>
                    <Th>Status</Th>
                    <Th>Priority</Th>
                    <Th>Queue</Th>
                    <Th>Assignee</Th>
                    <Th>Due</Th>
                    <Th>Threads</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {queueState.data.items.map((item) => (
                    <tr key={item.workItemId}>
                      <Td>{item.diseaseName}</Td>
                      <Td>{item.workType}</Td>
                      <Td>
                        <div className="space-y-1">
                          <StatusPill label={item.status} />
                          {item.isOverdue ? (
                            <StatusPill
                              label="overdue"
                              className="border-amber-300 bg-amber-50 text-amber-800"
                            />
                          ) : null}
                        </div>
                      </Td>
                      <Td>{item.priority}</Td>
                      <Td>{item.queueName}</Td>
                      <Td>{item.assignedActorDisplayName ?? 'Unassigned'}</Td>
                      <Td>{formatDateTime(item.dueAt)}</Td>
                      <Td>{item.threadCount ?? 0}</Td>
                      <Td className="space-x-2 text-right">
                        {item.status !== 'completed' ? (
                          <Button
                            variant="secondary"
                            onClick={() => void updateWorkItem(item.workItemId, { status: 'in-progress' }).then(refreshAll)}
                          >
                            Start
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          onClick={() => navigate(`/runs/${encodeURIComponent(item.workflowRunId)}/review`)}
                        >
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
    </SectionStack>
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
