import { NavLink, useParams } from 'react-router-dom';

import { RunsList } from '@/components/RunsList';
import type { DashboardRun } from '@/lib/types';

export function Sidebar({ runs }: { runs: DashboardRun[] }) {
  const params = useParams<{ runId: string }>();

  return (
    <aside className="flex w-full max-w-none flex-col gap-6 border-b border-white/10 bg-shell-950 px-5 py-6 text-white shadow-[24px_0_80px_rgba(7,18,24,0.16)] md:min-h-screen md:max-w-[19rem] md:border-b-0 md:border-r">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-300">Malady Mystery Studio</p>
        <h1 className="font-display text-2xl font-semibold">Local creator workspace</h1>
        <p className="text-sm leading-6 text-slate-300">
          Start a disease, approve the safety gates, render panels, and export local files.
        </p>
      </div>

      <nav className="space-y-2">
        <NavLink
          to="/review"
          className={({ isActive }) => [
            'block rounded-2xl px-4 py-3 text-sm font-semibold transition',
            isActive ? 'bg-shell-700 text-white ring-1 ring-shell-600' : 'bg-white/5 text-slate-200 hover:bg-white/10',
          ].join(' ')}
        >
          Home
        </NavLink>
        <NavLink
          to="/runs"
          className={({ isActive }) => [
            'block rounded-2xl px-4 py-3 text-sm font-semibold transition',
            isActive ? 'bg-shell-700 text-white ring-1 ring-shell-600' : 'bg-white/5 text-slate-200 hover:bg-white/10',
          ].join(' ')}
        >
          Runs
        </NavLink>
        <NavLink
          to="/review/queue"
          className={({ isActive }) => [
            'block rounded-2xl px-4 py-3 text-sm font-semibold transition',
            isActive ? 'bg-shell-700 text-white ring-1 ring-shell-600' : 'bg-white/5 text-slate-200 hover:bg-white/10',
          ].join(' ')}
        >
          Queue
        </NavLink>
        <NavLink
          to="/sources"
          className={({ isActive }) => [
            'block rounded-2xl px-4 py-3 text-sm font-semibold transition',
            isActive ? 'bg-shell-700 text-white ring-1 ring-shell-600' : 'bg-white/5 text-slate-200 hover:bg-white/10',
          ].join(' ')}
        >
          Sources
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => [
            'block rounded-2xl px-4 py-3 text-sm font-semibold transition',
            isActive ? 'bg-shell-700 text-white ring-1 ring-shell-600' : 'bg-white/5 text-slate-200 hover:bg-white/10',
          ].join(' ')}
        >
          Settings
        </NavLink>
      </nav>

      <RunsList runs={runs} selectedRunId={params.runId} />
    </aside>
  );
}
