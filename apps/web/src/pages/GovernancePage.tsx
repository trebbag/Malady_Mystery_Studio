import { ActivityFeed } from '@/components/ActivityFeed';
import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { fetchAuditLogEntries, fetchClinicalPackage, fetchReviewRunView } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function GovernancePage() {
  const { runId } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const reviewState = useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);
  const clinicalState = useRemoteData(() => fetchClinicalPackage(runId), [runId, refreshSignal]);
  const auditState = useRemoteData(() => fetchAuditLogEntries(runId), [runId, refreshSignal]);

  return (
    <SectionStack>
      <PageHeader eyebrow="Governance" title="Governance Page" description="Approval status, audit history, clinical blockers, and release gate state." />
      <ArtifactJsonCard title="Review run view" value={reviewState.data ?? {}} />
      <ArtifactJsonCard title="Clinical blockers" value={{
        pauseReason: reviewState.data?.pauseReason,
        traceCoverage: clinicalState.data?.traceCoverage,
      }} />
      <ActivityFeed entries={auditState.data ?? []} />
    </SectionStack>
  );
}
