import { Outlet } from 'react-router-dom';

import { Sidebar } from '@/components/Sidebar';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { fetchDashboardView } from '@/lib/api';

export function ShellLayout() {
  const refreshSignal = useRefreshSignal();
  const dashboardState = useRemoteData(() => fetchDashboardView(), [refreshSignal]);

  return (
    <div className="min-h-screen bg-creator-canvas">
      <div className="mx-auto flex min-h-screen max-w-[1720px] flex-col md:flex-row">
        <Sidebar runs={dashboardState.data?.runs ?? []} />
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8 lg:px-12 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
