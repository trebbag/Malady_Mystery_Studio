import { useState } from 'react';

import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { recordSourceDecision, fetchClinicalPackage, fetchSourceRecords } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function SourcesPage() {
  const { runId, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const clinicalState = useRemoteData(() => fetchClinicalPackage(runId), [runId, refreshSignal]);
  const canonicalDiseaseName = typeof clinicalState.data?.diseasePacket.canonicalDiseaseName === 'string'
    ? clinicalState.data.diseasePacket.canonicalDiseaseName
    : '';
  const sourcesState = useRemoteData(
    () => canonicalDiseaseName ? fetchSourceRecords(canonicalDiseaseName) : Promise.resolve([]),
    [canonicalDiseaseName, refreshSignal],
  );
  const [decisionBySourceId, setDecisionBySourceId] = useState<Record<string, string>>({});
  const [reasonBySourceId, setReasonBySourceId] = useState<Record<string, string>>({});

  return (
    <SectionStack>
      <PageHeader eyebrow="Sources" title="Sources Page" description="Governed source records and reviewer-driven source status changes." />
      <ArtifactJsonCard title="Governance summary" value={clinicalState.data?.sourceGovernance ?? {}} />
      {(sourcesState.data ?? []).map((sourceRecord) => {
        const sourceId = String(sourceRecord.id ?? '');

        return (
          <Card key={sourceId}>
            <CardTitle>{String(sourceRecord.sourceLabel ?? sourceId)}</CardTitle>
            <CardDescription>{String(sourceRecord.sourceUrl ?? 'No source URL recorded.')}</CardDescription>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-shell-950 p-4 text-xs text-slate-100">
              {JSON.stringify(sourceRecord, null, 2)}
            </pre>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <Input
                placeholder="Decision"
                value={decisionBySourceId[sourceId] ?? 'approved'}
                onChange={(event) => setDecisionBySourceId((current) => ({ ...current, [sourceId]: event.target.value }))}
              />
              <Input
                placeholder="Reason"
                value={reasonBySourceId[sourceId] ?? ''}
                onChange={(event) => setReasonBySourceId((current) => ({ ...current, [sourceId]: event.target.value }))}
              />
              <Button
                onClick={() => void recordSourceDecision(sourceId, {
                  canonicalDiseaseName,
                  decision: decisionBySourceId[sourceId] ?? 'approved',
                  reason: reasonBySourceId[sourceId] || undefined,
                }).then(() => refreshRun())}
              >
                Save decision
              </Button>
            </div>
          </Card>
        );
      })}
    </SectionStack>
  );
}
