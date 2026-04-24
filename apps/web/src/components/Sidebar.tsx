import { NavLink, useLocation, useParams } from 'react-router-dom';

import { RunsList } from '@/components/RunsList';
import type { DashboardRun } from '@/lib/types';
import { runPageDefinitions } from '@/lib/navigation';

export function Sidebar({ runs }: { runs: DashboardRun[] }) {
  const location = useLocation();
  const params = useParams<{ runId: string }>();

  return (
    <aside className="flex w-full max-w-none flex-col gap-6 border-b border-white/10 bg-shell-950 px-5 py-6 text-white md:min-h-screen md:max-w-[23rem] md:border-b-0 md:border-r">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-300">Disease Comic Platform</p>
        <h1 className="font-display text-2xl font-semibold">Local Production Shell</h1>
        <p className="text-sm text-slate-300">
          Built from the Figma Make shell, but grounded in the platform’s real review, governance, eval, and export state.
        </p>
      </div>

      <nav className="space-y-2">
        <NavLink
          to="/review"
          className={({ isActive }) => [
            'block rounded-2xl px-4 py-3 text-sm transition',
            isActive ? 'bg-white text-shell-950' : 'bg-white/5 text-white hover:bg-white/10',
          ].join(' ')}
        >
          Review dashboard
        </NavLink>
        <NavLink
          to="/review/queue"
          className={({ isActive }) => [
            'block rounded-2xl px-4 py-3 text-sm transition',
            isActive ? 'bg-white text-shell-950' : 'bg-white/5 text-white hover:bg-white/10',
          ].join(' ')}
        >
          Review queue
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => [
            'block rounded-2xl px-4 py-3 text-sm transition',
            isActive ? 'bg-white text-shell-950' : 'bg-white/5 text-white hover:bg-white/10',
          ].join(' ')}
        >
          Local settings
        </NavLink>
      </nav>

      <RunsList runs={runs} selectedRunId={params.runId} />

      {params.runId ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Run pages</p>
          <div className="grid gap-2">
            {runPageDefinitions.map((page) => {
              const target = `/runs/${encodeURIComponent(params.runId ?? '')}/${page.path}`;
              const selected = location.pathname === target;

              return (
                <NavLink
                  key={page.path}
                  to={target}
                  className={[
                    'rounded-xl px-4 py-3 text-sm transition',
                    selected ? 'bg-accent-500/15 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  ].join(' ')}
                >
                  <div className="font-medium">{page.label}</div>
                  <div className="mt-1 text-xs text-slate-400">{page.description}</div>
                </NavLink>
              );
            })}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
