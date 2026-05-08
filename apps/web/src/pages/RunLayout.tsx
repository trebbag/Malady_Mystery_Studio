import { NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';

import { RunHeader } from '@/components/RunHeader';
import { ErrorPanel, LoadingPanel } from '@/components/StatePanel';
import { creatorRunPageDefinitions } from '@/lib/navigation';
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
      <div className="flex flex-wrap gap-2 rounded-[1.5rem] border border-sand-300/80 bg-cream-50/90 p-2 shadow-[0_18px_48px_rgba(16,35,51,0.08)]">
        {creatorRunPageDefinitions.map((page) => (
          <NavLink
            key={page.path}
            to={`/runs/${encodeURIComponent(runId)}/${page.path}`}
            className={({ isActive }) => [
              'rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition',
              isActive ? 'bg-shell-950 text-white shadow-[0_12px_24px_rgba(7,18,24,0.14)]' : 'text-slate-700 hover:bg-shell-950/5',
            ].join(' ')}
          >
            {page.label}
          </NavLink>
        ))}
        <NavLink
          to={`/runs/${encodeURIComponent(runId)}/advanced`}
          className={({ isActive }) => [
            'rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition',
            isActive ? 'bg-sand-200 text-shell-950' : 'text-slate-600 hover:bg-shell-950/5',
          ].join(' ')}
        >
          Advanced details
        </NavLink>
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
