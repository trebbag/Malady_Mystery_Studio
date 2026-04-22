import { ArtifactJsonCard } from '@/components/ArtifactJsonCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionStack } from '@/components/StatePanel';
import { fetchLocalRuntimeView } from '@/lib/api';
import { useRefreshSignal } from '@/lib/refresh-context';
import { useRemoteData } from '@/lib/use-remote-data';

export function SettingsPage() {
  const refreshSignal = useRefreshSignal();
  const runtimeState = useRemoteData(() => fetchLocalRuntimeView(), [refreshSignal]);

  return (
    <SectionStack>
      <PageHeader eyebrow="Local runtime" title="Settings Page" description="Read-only local runtime metadata, command inventory, and readiness snapshot." />
      <ArtifactJsonCard title="Local runtime view" value={runtimeState.data ?? {}} />
    </SectionStack>
  );
}
