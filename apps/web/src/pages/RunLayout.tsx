import { NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';

import { RunHeader } from '@/components/RunHeader';
import { ErrorPanel, LoadingPanel } from '@/components/StatePanel';
import { runPageDefinitions } from '@/lib/navigation';
import { useRefreshContext, useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { fetchWorkflowRun } from '@/lib/api';
import type { WorkflowRun } from '@/lib/types';

export interface RunPageContextValue {
  runId: string;
  workflowRun: WorkflowRun;
  refreshRun: () => void;
}

export function useRunPageContext() {
  return useOutletContext<RunPageContextValue>();
}

export function RunLayout() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId ?? '';
  const refreshContext = useRefreshContext();
  const refreshSignal = useRefreshSignal(runId);
  const workflowRunState = useRemoteData(() => fetchWorkflowRun(runId), [runId, refreshSignal]);

  if (workflowRunState.loading) {
    return <LoadingPanel rows={6} />;
  }

  if (workflowRunState.error || !workflowRunState.data) {
    return <ErrorPanel message={workflowRunState.error?.message ?? 'Workflow run could not be loaded.'} />;
  }

  return (
    <div className="space-y-6">
      <RunHeader workflowRun={workflowRunState.data} />
      <div className="flex flex-wrap gap-2 rounded-2xl border border-black/10 bg-white/70 p-2">
        {runPageDefinitions.map((page) => (
          <NavLink
            key={page.path}
            to={`/runs/${encodeURIComponent(runId)}/${page.path}`}
            className={({ isActive }) => [
              'rounded-xl px-4 py-3 text-sm transition',
              isActive ? 'bg-shell-950 text-white' : 'text-slate-700 hover:bg-black/5',
            ].join(' ')}
          >
            {page.label}
          </NavLink>
        ))}
      </div>
      <Outlet
        context={{
          runId,
          workflowRun: workflowRunState.data,
          refreshRun: () => refreshContext.refreshRun(runId),
        }}
      />
    </div>
  );
}
