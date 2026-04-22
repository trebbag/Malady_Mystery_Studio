import { useMemo, useState } from 'react';

import { ErrorPanel, LoadingPanel } from '@/components/StatePanel';
import { Alert } from '@/components/ui/alert';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, Td, Th } from '@/components/ui/table';
import { fetchArtifactDiff } from '@/lib/api';
import { useRemoteData } from '@/lib/use-remote-data';
import { formatDateTime, toPrettyJson, uniqueStrings } from '@/lib/utils';

interface ArtifactDiffCardProps {
  runId: string;
  artifactTypes: string[];
  refreshToken: unknown;
}

export function ArtifactDiffCard({ runId, artifactTypes, refreshToken }: ArtifactDiffCardProps) {
  const availableArtifactTypes = useMemo(() => uniqueStrings(artifactTypes), [artifactTypes]);
  const [artifactType, setArtifactType] = useState(availableArtifactTypes[0] ?? '');
  const [leftArtifactId, setLeftArtifactId] = useState('');
  const [rightArtifactId, setRightArtifactId] = useState('');
  const diffState = useRemoteData(
    () => artifactType
      ? fetchArtifactDiff(runId, artifactType, {
        leftArtifactId: leftArtifactId || undefined,
        rightArtifactId: rightArtifactId || undefined,
      })
      : Promise.resolve(null),
    [runId, artifactType, leftArtifactId, rightArtifactId, refreshToken],
  );

  return (
    <Card className="grid gap-4">
      <div>
        <CardTitle>Artifact compare</CardTitle>
        <CardDescription>Inspect stored JSON changes across artifact versions before re-approval.</CardDescription>
      </div>

      {availableArtifactTypes.length === 0 ? <Alert tone="info">No artifact history is available for this run yet.</Alert> : null}

      {availableArtifactTypes.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            value={artifactType}
            onChange={(event) => {
              setArtifactType(event.target.value);
              setLeftArtifactId('');
              setRightArtifactId('');
            }}
          >
            {availableArtifactTypes.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>
          <Select value={leftArtifactId} onChange={(event) => setLeftArtifactId(event.target.value)}>
            <option value="">Auto previous version</option>
            {diffState.data?.availableArtifacts.map((artifact) => (
              <option key={artifact.artifactId} value={artifact.artifactId}>
                {artifact.artifactId} • {formatDateTime(artifact.createdAt)}
              </option>
            ))}
          </Select>
          <Select value={rightArtifactId} onChange={(event) => setRightArtifactId(event.target.value)}>
            <option value="">Auto latest version</option>
            {diffState.data?.availableArtifacts.map((artifact) => (
              <option key={artifact.artifactId} value={artifact.artifactId}>
                {artifact.artifactId} • {formatDateTime(artifact.createdAt)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {diffState.loading ? <LoadingPanel rows={2} /> : null}
      {diffState.error ? <ErrorPanel message={diffState.error.message} /> : null}

      {diffState.data && diffState.data.comparisonStatus === 'insufficient-history' ? (
        <Alert tone="warning">Create another version of {diffState.data.artifactType} to unlock compare mode.</Alert>
      ) : null}

      {diffState.data && diffState.data.comparisonStatus === 'diff-available' ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Changed" value={diffState.data.summary.changedCount} />
            <Metric label="Added" value={diffState.data.summary.addedCount} />
            <Metric label="Removed" value={diffState.data.summary.removedCount} />
            <Metric label="Total" value={diffState.data.summary.changeCount} />
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Path</Th>
                <Th>Change</Th>
                <Th>Before</Th>
                <Th>After</Th>
              </tr>
            </thead>
            <tbody>
              {diffState.data.changes.map((change) => (
                <tr key={`${change.path}:${change.changeType}`}>
                  <Td>{change.path}</Td>
                  <Td>{change.changeType}</Td>
                  <Td className="max-w-[18rem] whitespace-pre-wrap break-words text-xs text-slate-600">{change.before === undefined ? '—' : toPrettyJson(change.before)}</Td>
                  <Td className="max-w-[18rem] whitespace-pre-wrap break-words text-xs text-slate-600">{change.after === undefined ? '—' : toPrettyJson(change.after)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : null}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-shell-950">{value}</p>
    </div>
  );
}
