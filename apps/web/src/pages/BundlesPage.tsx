import { useMemo, useState } from 'react';

import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { exportBundle, fetchExports, fetchReleaseBundle } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { useRunPageContext } from '@/pages/RunLayout';

export function BundlesPage() {
  const { runId, workflowRun, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const exportsState = useRemoteData(() => fetchExports(runId), [runId, refreshSignal]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const releaseId = selectedReleaseId ?? exportsState.data?.[0]?.releaseId ?? null;
  const bundleState = useRemoteData(
    () => releaseId ? fetchReleaseBundle(releaseId) : Promise.resolve(null),
    [releaseId, refreshSignal],
  );
  const exportDisabledReason = workflowRun.latestEvalStatus !== 'passed'
    ? 'Export is blocked until the latest eval run is fresh and passing.'
    : undefined;
  const bundleLinks = useMemo(() => ({
    bundleIndex: releaseId ? `/api/v1/release-bundles/${encodeURIComponent(releaseId)}/index` : null,
    evidencePack: releaseId ? `/api/v1/release-bundles/${encodeURIComponent(releaseId)}/evidence-pack` : null,
  }), [releaseId]);

  return (
    <SectionStack>
      <PageHeader
        eyebrow="Bundles"
        title="Bundles Page"
        description="Export history, release bundles, and retrieval links for bundle index and evidence pack artifacts."
        actions={<Button disabled={Boolean(exportDisabledReason)} onClick={() => void exportBundle(runId, {}).then(() => refreshRun())}>Export bundle</Button>}
      />
      {exportDisabledReason ? <Alert tone="warning">{exportDisabledReason}</Alert> : null}
      <Card>
        <CardTitle>Export history</CardTitle>
        <CardDescription>Local release bundle activity for the selected run.</CardDescription>
        <div className="mt-4 space-y-3">
          {(exportsState.data ?? []).map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="block w-full rounded-2xl border border-black/10 bg-slate-50 p-4 text-left transition hover:bg-slate-100"
              onClick={() => setSelectedReleaseId(entry.releaseId)}
            >
              <div className="font-medium text-shell-950">{entry.releaseId}</div>
              <div className="text-sm text-slate-500">{entry.status}</div>
            </button>
          ))}
        </div>
      </Card>
      <ArtifactJsonCard title="Selected release bundle" value={bundleState.data ?? {}} />
      {releaseId ? (
        <Card>
          <CardTitle>Bundle retrieval</CardTitle>
          <CardDescription>These links resolve against the local backend and object store.</CardDescription>
          <div className="mt-4 flex flex-wrap gap-3">
            {bundleLinks.bundleIndex ? <a href={bundleLinks.bundleIndex} className="rounded-xl bg-shell-950 px-4 py-2 text-sm font-semibold text-white">Open bundle index</a> : null}
            {bundleLinks.evidencePack ? <a href={bundleLinks.evidencePack} className="rounded-xl bg-shell-800 px-4 py-2 text-sm font-semibold text-white">Open evidence pack</a> : null}
          </div>
        </Card>
      ) : null}
    </SectionStack>
  );
}
