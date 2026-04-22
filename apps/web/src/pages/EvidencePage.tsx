import { useState } from 'react';

import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recordContradictionResolution, fetchClinicalPackage } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function EvidencePage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const [claimId, setClaimId] = useState('');
  const [relatedClaimId, setRelatedClaimId] = useState('');
  const [status, setStatus] = useState('resolved');
  const [reason, setReason] = useState('Resolved during local evidence review.');
  const clinicalState = useRemoteData(() => fetchClinicalPackage(runId), [runId, refreshSignal]);

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Evidence"
        title="Evidence Page"
        description="Evidence graph, contradiction severity, and downstream trace coverage blockers."
      />
      {(clinicalState.data?.traceCoverage.blockers ?? []).map((blocker) => (
        <Alert key={blocker} tone="warning">{blocker}</Alert>
      ))}
      <ArtifactJsonCard title="Evidence graph" value={clinicalState.data?.evidenceGraph ?? {}} />
      <ArtifactJsonCard title="Trace coverage" value={clinicalState.data?.traceCoverage ?? {}} />
      <ArtifactJsonCard title="Contradiction resolutions" value={clinicalState.data?.contradictionResolutions ?? []} />
      <div className="rounded-2xl border border-black/10 bg-white/90 p-5 shadow-panel">
        <h2 className="font-display text-lg font-semibold text-shell-950">Resolve contradiction</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input placeholder="Claim id" value={claimId} onChange={(event) => setClaimId(event.target.value)} />
          <Input placeholder="Related claim id" value={relatedClaimId} onChange={(event) => setRelatedClaimId(event.target.value)} />
          <Input placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
          <Input placeholder="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="mt-4">
          <Button
            disabled={!claimId.trim() || !clinicalState.data}
            onClick={() => void recordContradictionResolution(claimId, {
              canonicalDiseaseName: clinicalState.data?.diseasePacket.canonicalDiseaseName,
              relatedClaimId: relatedClaimId || undefined,
              status,
              reason,
            }).then(() => refreshRun())}
          >
            Record contradiction resolution
          </Button>
        </div>
      </div>
    </SectionStack>
  );
}
