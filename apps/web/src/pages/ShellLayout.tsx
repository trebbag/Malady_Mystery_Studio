import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/components/Sidebar';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { fetchDashboardView } from '@/lib/api';

export function ShellLayout() {
  const refreshSignal = useRefreshSignal();
  const dashboardState = useRemoteData(() => fetchDashboardView(), [refreshSignal]);

  return (
    <div className="min-h-screen bg-shell-gradient">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col lg:flex-row">
        <Sidebar runs={dashboardState.data?.runs ?? []} />
        <main className="flex-1 px-6 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
