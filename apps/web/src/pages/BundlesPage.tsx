import { useMemo, useState } from 'react';

import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import {
  exportBundle,
  fetchExports,
  fetchReleaseBundle,
  fetchReviewRunView,
  fetchRenderedPanelQaDecisions,
  getReleaseBundleRenderingGuideUrl,
  mirrorReleaseBundleLocal,
  recordRenderedPanelQaDecision,
  verifyReleaseBundleLocalMirror,
} from '@/lib/api';
import type { LocalDeliveryMirror, LocalDeliveryVerification, RenderedPanelQaDecision } from '@/lib/types';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime } from '@/lib/utils';
import { useRunPageContext } from '@/pages/RunLayout';

export function BundlesPage() {
  const { runId, workflowRun, refreshRun } = useRunPageContext();
  const refreshSignal = useRefreshSignal(runId);
  const exportsState = useRemoteData(() => fetchExports(runId), [runId, refreshSignal]);
  const reviewState = useRemoteData(() => fetchReviewRunView(runId), [runId, refreshSignal]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [mirrorResult, setMirrorResult] = useState<LocalDeliveryMirror | null>(null);
  const [verificationResult, setVerificationResult] = useState<LocalDeliveryVerification | null>(null);
  const [qaDecisionResult, setQaDecisionResult] = useState<RenderedPanelQaDecision | null>(null);
  const releaseId = selectedReleaseId ?? exportsState.data?.[0]?.releaseId ?? null;
  const bundleState = useRemoteData(
    () => releaseId ? fetchReleaseBundle(releaseId) : Promise.resolve(null),
    [releaseId, refreshSignal],
  );
  const renderedAssetManifestId = bundleState.data?.renderedAssetManifestId;
  const qaDecisionState = useRemoteData(
    () => renderedAssetManifestId ? fetchRenderedPanelQaDecisions(renderedAssetManifestId) : Promise.resolve([]),
    [renderedAssetManifestId ?? '', refreshSignal],
  );
  const exportDisabledReason = workflowRun.latestEvalStatus !== 'passed'
    ? 'Export is blocked until the latest eval run is fresh and passing.'
    : (!workflowRun.artifacts.some((artifact) => artifact.artifactType === 'rendered-asset-manifest')
      ? 'Export is blocked until rendered panel assets and a rendered asset manifest exist for this run.'
      : undefined);
  const renderedManifestLink = renderedAssetManifestId
    ? `/api/v1/artifacts/rendered-asset-manifest/${encodeURIComponent(renderedAssetManifestId)}`
    : undefined;
  const bundleLinks = useMemo(() => ({
    bundleIndex: releaseId ? `/api/v1/release-bundles/${encodeURIComponent(releaseId)}/index` : null,
    evidencePack: releaseId ? `/api/v1/release-bundles/${encodeURIComponent(releaseId)}/evidence-pack` : null,
    renderingGuide: releaseId ? getReleaseBundleRenderingGuideUrl(releaseId) : null,
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
      {reviewState.data?.renderingGuide ? (
        <Card>
          <CardTitle>Rendered-panel bundle readiness</CardTitle>
          <CardDescription>The default release path exports rendered panels. The rendering guide remains a secondary prompt and retry artifact.</CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label="Guide id" value={reviewState.data.renderingGuide.id} />
            <Metric label="Guide updated" value={formatDateTime(reviewState.data.renderingGuide.generatedAt)} />
            <Metric label="Attached render manifest" value={renderedAssetManifestId ?? 'none'} />
          </div>
        </Card>
      ) : null}
      <ArtifactJsonCard title="Selected release bundle" value={bundleState.data ?? {}} />
      {releaseId ? (
        <Card>
          <CardTitle>Bundle retrieval</CardTitle>
          <CardDescription>These links resolve against the local backend and object store.</CardDescription>
          <div className="mt-4 flex flex-wrap gap-3">
            {bundleLinks.bundleIndex ? <a href={bundleLinks.bundleIndex} className="rounded-xl bg-shell-950 px-4 py-2 text-sm font-semibold text-white">Open bundle index</a> : null}
            {bundleLinks.evidencePack ? <a href={bundleLinks.evidencePack} className="rounded-xl bg-shell-800 px-4 py-2 text-sm font-semibold text-white">Open evidence pack</a> : null}
            {bundleLinks.renderingGuide ? <a href={bundleLinks.renderingGuide} className="rounded-xl bg-shell-900 px-4 py-2 text-sm font-semibold text-white">Open rendering guide</a> : null}
            {renderedManifestLink ? <a href={renderedManifestLink} className="rounded-xl bg-shell-700 px-4 py-2 text-sm font-semibold text-white">Open rendered asset manifest</a> : null}
            <Button
              variant="secondary"
              onClick={() => void mirrorReleaseBundleLocal(releaseId).then((result) => {
                setMirrorResult(result);
                refreshRun();
              })}
            >
              Mirror locally
            </Button>
            <Button
              variant="secondary"
              onClick={() => void verifyReleaseBundleLocalMirror(releaseId).then((result) => {
                setVerificationResult(result);
                refreshRun();
              })}
            >
              Verify mirror
            </Button>
            {renderedAssetManifestId ? (
              <Button
                variant="secondary"
                onClick={() => void recordRenderedPanelQaDecision(renderedAssetManifestId, {
                  decision: bundleState.data?.qualitySummary?.renderOutputQuality === 1 ? 'approved' : 'structural-only',
                  notes: 'Local pilot QA checklist recorded from the Bundles page. Stub assets remain structural-only unless replaced by live gpt-image-2 output.',
                }).then((result) => {
                  setQaDecisionResult(result);
                  refreshRun();
                })}
              >
                Record panel QA
              </Button>
            ) : null}
          </div>
          {mirrorResult ? (
            <Alert tone={mirrorResult.status === 'mirrored' ? 'success' : 'warning'}>
              Local mirror {String(mirrorResult.status)} at {String(mirrorResult.deliveryDir)}.
            </Alert>
          ) : null}
          {verificationResult ? (
            <Alert tone={verificationResult.status === 'passed' ? 'success' : 'warning'}>
              Local mirror verification {verificationResult.status}: {verificationResult.verifiedFileCount} files verified, {verificationResult.failedFileCount} failed.
            </Alert>
          ) : null}
          {qaDecisionResult ? (
            <Alert tone={qaDecisionResult.decision === 'rejected' ? 'warning' : 'success'}>
              Rendered-panel QA recorded as {qaDecisionResult.decision}.
            </Alert>
          ) : null}
          {qaDecisionState.data?.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {qaDecisionState.data.map((decision) => (
                <div key={decision.id} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-shell-950">{decision.decision}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(decision.createdAt)} · {decision.reviewerId}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    Cyto/Pip/style/anatomy/lettering/text/provenance checks: {Object.values(decision.checklist).filter(Boolean).length}/9
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
    </SectionStack>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-shell-950">{value}</p>
    </div>
  );
}
