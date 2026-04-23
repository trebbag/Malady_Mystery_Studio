import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { fetchLocalRuntimeView } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';

export function SettingsPage() {
  const refreshSignal = useRefreshSignal();
  const runtimeState = useRemoteData(() => fetchLocalRuntimeView(), [refreshSignal]);

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
      {runtimeState.data?.managedRuntimeReadiness ? (
        <Card>
          <CardTitle>Optional managed runtime dry-run readiness</CardTitle>
          <CardDescription>
            These checks are retained for future portability only. They are not required for the active local-storage product path.
          </CardDescription>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {runtimeState.data.managedRuntimeReadiness.checks.map((check) => (
              <div key={check.name} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-shell-950">{check.name}</p>
                <p className="text-xs text-slate-500">{check.current} → {check.target}</p>
                <p className="mt-2 text-sm text-slate-700">{check.status}</p>
                {check.status === 'blocked-awaiting-credentials' ? (
                  <p className="mt-2 text-xs text-slate-500">Needs: {check.requiredEnv.join(', ')}</p>
                ) : null}
              </div>
            ))}
          </div>
          <Alert tone={['configured', 'ready-locally'].includes(runtimeState.data.managedRuntimeReadiness.status) ? 'success' : 'warning'}>
            Optional managed status: {runtimeState.data.managedRuntimeReadiness.status}. Local storage remains the active runtime; dry runs remain available through {runtimeState.data.managedRuntimeReadiness.localOnlyCommands.join(' and ')}.
          </Alert>
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
    </SectionStack>
  );
}
