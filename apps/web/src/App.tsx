import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RefreshProvider } from '@/lib/refresh-context';
import { ShellLayout } from '@/pages/ShellLayout';
import { RunLayout } from '@/pages/RunLayout';
import { BundlesPage } from '@/pages/BundlesPage';
import { EvalsPage } from '@/pages/EvalsPage';
import { EvidencePage } from '@/pages/EvidencePage';
import { GovernancePage } from '@/pages/GovernancePage';
import { PanelsPage } from '@/pages/PanelsPage';
import { PacketsPage } from '@/pages/PacketsPage';
import { PipelinePage } from '@/pages/PipelinePage';
import { ReviewDashboardPage } from '@/pages/ReviewDashboardPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { ScenesPage } from '@/pages/ScenesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SourcesPage } from '@/pages/SourcesPage';
import { WorkbooksPage } from '@/pages/WorkbooksPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/review" />} />
      <Route element={<ShellLayout />}>
        <Route path="/review" element={<ReviewDashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/runs/:runId" element={<RunLayout />}>
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="packets" element={<PacketsPage />} />
          <Route path="evidence" element={<EvidencePage />} />
          <Route path="workbooks" element={<WorkbooksPage />} />
          <Route path="scenes" element={<ScenesPage />} />
          <Route path="panels" element={<PanelsPage />} />
          <Route path="sources" element={<SourcesPage />} />
          <Route path="governance" element={<GovernancePage />} />
          <Route path="evals" element={<EvalsPage />} />
          <Route path="bundles" element={<BundlesPage />} />
          <Route index element={<Navigate replace to="review" />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RefreshProvider>
        <AppRoutes />
      </RefreshProvider>
    </BrowserRouter>
  );
}
