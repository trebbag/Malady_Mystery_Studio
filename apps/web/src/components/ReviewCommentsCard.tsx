import { useMemo, useState } from 'react';

import type { ReviewComment } from '@/lib/types';
import { formatDateTime, uniqueStrings } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ReviewCommentsCardProps {
  comments: ReviewComment[];
  artifactTypes: string[];
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
  onResolve: (comment: ReviewComment) => Promise<void>;
}

export function ReviewCommentsCard({
  comments,
  artifactTypes,
  onCreate,
  onResolve,
}: ReviewCommentsCardProps) {
  const normalizedArtifactTypes = useMemo(() => uniqueStrings(artifactTypes), [artifactTypes]);
  const [scopeType, setScopeType] = useState<'run' | 'artifact'>('run');
  const [artifactType, setArtifactType] = useState(normalizedArtifactTypes[0] ?? '');
  const [fieldPath, setFieldPath] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [body, setBody] = useState('');

  const handleSubmit = async () => {
    await onCreate({
      scopeType,
      artifactType: scopeType === 'artifact' ? artifactType : undefined,
      fieldPath: fieldPath || undefined,
      severity,
      status: 'open',
      body,
    });
    setBody('');
    setFieldPath('');
  };

  return (
    <Card className="grid gap-4">
      <div>
        <CardTitle>Review comments</CardTitle>
        <CardDescription>Store inline notes and run-level review comments with reviewer identity and timestamps.</CardDescription>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={scopeType} onChange={(event) => setScopeType(event.target.value as 'run' | 'artifact')}>
            <option value="run">Run note</option>
            <option value="artifact">Artifact comment</option>
          </Select>
          <Select
            value={artifactType}
            disabled={scopeType !== 'artifact' || normalizedArtifactTypes.length === 0}
            onChange={(event) => setArtifactType(event.target.value)}
          >
            {normalizedArtifactTypes.length === 0 ? <option value="">No artifact history</option> : null}
            {normalizedArtifactTypes.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>
          <Input
            value={fieldPath}
            onChange={(event) => setFieldPath(event.target.value)}
            placeholder="Optional field path"
          />
          <Select value={severity} onChange={(event) => setSeverity(event.target.value as 'info' | 'warning' | 'critical')}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </Select>
        </div>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Describe the issue or note the reviewer wants preserved."
        />
        <div className="flex justify-end">
          <Button
            disabled={!body.trim() || (scopeType === 'artifact' && !artifactType)}
            onClick={() => void handleSubmit()}
          >
            Add review comment
          </Button>
        </div>
      </div>

      {comments.length === 0 ? <Alert tone="info">No review comments are stored for this run yet.</Alert> : null}

      <div className="grid gap-3">
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-2xl border border-black/10 bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-shell-950">
                  {comment.scopeType === 'artifact' ? `${comment.artifactType} comment` : 'Run note'}
                </p>
                <p className="text-xs text-slate-500">
                  {comment.reviewerDisplayName} • {comment.severity} • {comment.status} • {formatDateTime(comment.updatedAt)}
                </p>
              </div>
              {comment.status === 'open' ? (
                <Button
                  variant="secondary"
                  onClick={() => void onResolve(comment)}
                >
                  Resolve
                </Button>
              ) : null}
            </div>
            {comment.fieldPath ? <p className="mt-2 text-xs text-slate-500">Field path: {comment.fieldPath}</p> : null}
            <p className="mt-3 text-sm leading-6 text-slate-700">{comment.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
