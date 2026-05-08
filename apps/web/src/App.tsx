import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RefreshProvider } from '@/lib/refresh-context';
import { ShellLayout } from '@/pages/ShellLayout';
import { RunLayout } from '@/pages/RunLayout';
import { BundlesPage } from '@/pages/BundlesPage';
import {
  CreatorAdvancedDetailsPage,
  CreatorClinicalReviewPage,
  CreatorExportPage,
  CreatorGuideReviewPage,
  CreatorRenderPanelsPage,
  CreatorRunOverviewPage,
  CreatorStoryPanelPlanPage,
  GlobalSourcesPage,
} from '@/pages/CreatorRunPages';
import { EvalsPage } from '@/pages/EvalsPage';
import { EvidencePage } from '@/pages/EvidencePage';
import { GovernancePage } from '@/pages/GovernancePage';
import { PanelsPage } from '@/pages/PanelsPage';
import { PacketsPage } from '@/pages/PacketsPage';
import { PipelinePage } from '@/pages/PipelinePage';
import { ReviewDashboardPage } from '@/pages/ReviewDashboardPage';
import { ReviewQueuePage } from '@/pages/ReviewQueuePage';
import { ReviewPage } from '@/pages/ReviewPage';
import { RenderingGuidePage } from '@/pages/RenderingGuidePage';
import { RunsPage } from '@/pages/RunsPage';
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
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/review/queue" element={<ReviewQueuePage />} />
        <Route path="/sources" element={<GlobalSourcesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/runs/:runId" element={<RunLayout />}>
          <Route path="overview" element={<CreatorRunOverviewPage />} />
          <Route path="clinical-review" element={<CreatorClinicalReviewPage />} />
          <Route path="story-panel-plan" element={<CreatorStoryPanelPlanPage />} />
          <Route path="guide-review" element={<CreatorGuideReviewPage />} />
          <Route path="render-panels" element={<CreatorRenderPanelsPage />} />
          <Route path="export" element={<CreatorExportPage />} />
          <Route path="advanced" element={<CreatorAdvancedDetailsPage />} />
          <Route path="advanced/pipeline" element={<PipelinePage />} />
          <Route path="advanced/review-console" element={<ReviewPage />} />
          <Route path="advanced/packets" element={<PacketsPage />} />
          <Route path="advanced/evidence" element={<EvidencePage />} />
          <Route path="advanced/workbooks" element={<WorkbooksPage />} />
          <Route path="advanced/scenes" element={<ScenesPage />} />
          <Route path="advanced/panels" element={<PanelsPage />} />
          <Route path="advanced/sources" element={<SourcesPage />} />
          <Route path="advanced/governance" element={<GovernancePage />} />
          <Route path="advanced/evals" element={<EvalsPage />} />
          <Route path="advanced/bundles" element={<BundlesPage />} />
          <Route path="pipeline" element={<Navigate replace to="../advanced/pipeline" />} />
          <Route path="review" element={<Navigate replace to="../overview" />} />
          <Route path="packets" element={<Navigate replace to="../advanced/packets" />} />
          <Route path="evidence" element={<Navigate replace to="../advanced/evidence" />} />
          <Route path="workbooks" element={<Navigate replace to="../advanced/workbooks" />} />
          <Route path="scenes" element={<Navigate replace to="../advanced/scenes" />} />
          <Route path="panels" element={<Navigate replace to="../advanced/panels" />} />
          <Route path="rendering-guide" element={<RenderingGuidePage />} />
          <Route path="sources" element={<Navigate replace to="../advanced/sources" />} />
          <Route path="governance" element={<Navigate replace to="../advanced/governance" />} />
          <Route path="evals" element={<Navigate replace to="../advanced/evals" />} />
          <Route path="bundles" element={<Navigate replace to="../advanced/bundles" />} />
          <Route index element={<Navigate replace to="overview" />} />
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
