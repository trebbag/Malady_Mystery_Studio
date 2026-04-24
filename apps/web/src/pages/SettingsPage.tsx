import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { fetchLocalOpsStatus, fetchLocalRuntimeView, runRestoreSmoke } from '@/lib/api';
import { useRefreshContext, useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime } from '@/lib/utils';

export function SettingsPage() {
  const refreshContext = useRefreshContext();
  const refreshSignal = useRefreshSignal();
  const runtimeState = useRemoteData(() => fetchLocalRuntimeView(), [refreshSignal]);
  const localOpsState = useRemoteData(() => fetchLocalOpsStatus(), [refreshSignal]);

  return (
    <SectionStack>
      <PageHeader eyebrow="Local runtime" title="Settings Page" description="Read-only local runtime metadata, command inventory, and readiness snapshot." />
      {runtimeState.data?.localStoragePolicy ? (
        <Card>
          <CardTitle>Active local storage policy</CardTitle>
          <CardDescription>
            The app is configured to keep metadata in SQLite and generated files in the local filesystem object store.
          </CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-shell-950">Metadata</p>
              <p className="mt-2 text-sm text-slate-700">{runtimeState.data.localStoragePolicy.metadataStore}</p>
              <p className="mt-1 text-xs text-slate-500">{runtimeState.data.localStoragePolicy.dbFilePath}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-shell-950">Files and artifacts</p>
              <p className="mt-2 text-sm text-slate-700">{runtimeState.data.localStoragePolicy.objectStore}</p>
              <p className="mt-1 text-xs text-slate-500">{runtimeState.data.localStoragePolicy.objectStoreDir}</p>
            </div>
          </div>
          <Alert tone="success">
            Files stay local. Postgres usage: {runtimeState.data.localStoragePolicy.postgresUsage}; managed object storage: {runtimeState.data.localStoragePolicy.managedObjectStorageUsage}.
          </Alert>
        </Card>
      ) : null}
      {localOpsState.data ? (
        <Card>
          <CardTitle>Local operational proof</CardTitle>
          <CardDescription>
            Backup, restore-smoke, delivery mirror, and object-store stats are all local filesystem checks for this phase.
          </CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <LocalOpsMetric label="Object-store files" value={String(localOpsState.data.storage.objectCount)} detail={`${localOpsState.data.storage.byteLength} bytes`} />
            <LocalOpsMetric label="Backup root" value={localOpsState.data.storage.backupRootDir} detail={localOpsState.data.latestBackup ? `Latest: ${formatDateTime(localOpsState.data.latestBackup.createdAt)}` : 'No backup detected yet.'} />
            <LocalOpsMetric label="Latest restore smoke" value={localOpsState.data.latestRestoreSmoke?.status ?? 'not-run'} detail={localOpsState.data.latestRestoreSmoke ? formatDateTime(localOpsState.data.latestRestoreSmoke.completedAt) : 'Run one before pilot rehearsal.'} />
            <LocalOpsMetric label="Latest delivery mirror" value={localOpsState.data.latestDeliveryMirror?.status ?? 'not-run'} detail={localOpsState.data.latestDeliveryMirror?.deliveryDir ?? localOpsState.data.storage.deliveryRootDir} />
            <LocalOpsMetric label="Mirror verification" value={localOpsState.data.latestDeliveryVerification?.status ?? 'not-run'} detail={localOpsState.data.latestDeliveryVerification ? `${localOpsState.data.latestDeliveryVerification.verifiedFileCount} files verified` : 'Verify a local mirror after export.'} />
          </div>
          {localOpsState.data.latestRestoreSmoke ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <LocalOpsMetric
                label="Schema validation"
                value={`${localOpsState.data.latestRestoreSmoke.stats.schemaValidatedArtifactCount} checked`}
                detail={`${localOpsState.data.latestRestoreSmoke.stats.schemaValidationFailureCount} failures`}
              />
              <LocalOpsMetric
                label="Object references"
                value={`${localOpsState.data.latestRestoreSmoke.stats.objectReferenceCount - localOpsState.data.latestRestoreSmoke.stats.missingObjectReferenceCount}/${localOpsState.data.latestRestoreSmoke.stats.objectReferenceCount}`}
                detail="artifact files found in scratch restore"
              />
              <LocalOpsMetric
                label="Delivery checks"
                value={`${localOpsState.data.latestRestoreSmoke.stats.deliveryVerificationCount}`}
                detail={`${localOpsState.data.latestRestoreSmoke.stats.failedDeliveryVerificationCount} failed verifications`}
              />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void runRestoreSmoke().then(() => refreshContext.refreshGlobal())}>Run restore smoke</Button>
            <span className="text-sm text-slate-500">Creates a backup snapshot, restores into scratch storage, validates local integrity, and records an ops-drill work item.</span>
          </div>
          {localOpsState.data.opsDrillWorkItems.length > 0 ? (
            <Alert tone="info">
              Ops-drill work items: {localOpsState.data.opsDrillWorkItems.length}. Latest local proof generated at {formatDateTime(localOpsState.data.generatedAt)}.
            </Alert>
          ) : null}
        </Card>
      ) : null}
      {runtimeState.data?.externalElements ? (
        <Card>
          <CardTitle>ClinicalEducation external elements</CardTitle>
          <CardDescription>
            Compatibility surface for the previous app: OpenAI key/vector-store status, canon paths, and local pipeline controls.
          </CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-shell-950">OpenAI runtime</p>
              <p className="mt-2 text-sm text-slate-700">Research model: {runtimeState.data.externalElements.openAi.researchModel}</p>
              <p className="text-sm text-slate-700">Render model: {runtimeState.data.externalElements.openAi.renderModel}</p>
              <p className="text-sm text-slate-700">Provider: {runtimeState.data.externalElements.openAi.renderProvider}</p>
              <p className="mt-2 text-xs text-slate-500">
                API key: {runtimeState.data.externalElements.openAi.apiKeyConfigured ? 'configured' : 'missing'} · KB vector store: {runtimeState.data.externalElements.openAi.knowledgeBaseVectorStoreConfigured ? 'configured' : 'missing'}
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-shell-950">Canon files</p>
              <p className="mt-2 text-xs text-slate-500">Root: {runtimeState.data.externalElements.canon.root}</p>
              <p className="text-xs text-slate-500">Character bible: {runtimeState.data.externalElements.canon.characterBiblePath}</p>
              <p className="text-xs text-slate-500">Style bible: {runtimeState.data.externalElements.canon.seriesStyleBiblePath}</p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4 md:col-span-2">
              <p className="text-sm font-semibold text-shell-950">Legacy pipeline knobs</p>
              <p className="mt-2 text-sm text-slate-700">
                Mode: {runtimeState.data.externalElements.pipeline.mode} · Max concurrent runs: {runtimeState.data.externalElements.pipeline.maxConcurrentRuns} · Retention keep-last: {runtimeState.data.externalElements.pipeline.retentionKeepLast}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Fake delay: {runtimeState.data.externalElements.pipeline.fakeStepDelayMs}ms · KB0 timeout: {runtimeState.data.externalElements.pipeline.kb0TimeoutMs}ms · A/B timeout: {runtimeState.data.externalElements.pipeline.stepAbAgentTimeoutMs}ms · C timeout: {runtimeState.data.externalElements.pipeline.stepCAgentTimeoutMs}ms · Deck-spec timeout: {runtimeState.data.externalElements.pipeline.stepCDeckSpecTimeoutMs}ms
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Agent isolation: {runtimeState.data.externalElements.pipeline.agentIsolationMode || 'default child-process isolation'}
              </p>
            </div>
          </div>
          <Alert tone="info">
            Source compatibility: {runtimeState.data.externalElements.clinicalEducationCompatibility.sourceProjectLabel}. Secrets stay backend-only and are never exposed to the frontend bundle.
          </Alert>
        </Card>
      ) : null}
      <ArtifactJsonCard title="Local runtime view" value={runtimeState.data ?? {}} />
      <ArtifactJsonCard title="Local ops status" value={localOpsState.data ?? {}} />
    </SectionStack>
  );
}

function LocalOpsMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-shell-950">{value}</p>
      <p className="mt-1 break-words text-xs text-slate-500">{detail}</p>
    </div>
  );
}
