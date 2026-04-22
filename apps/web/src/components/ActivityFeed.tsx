import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/StatusPill';
import type { AuditLogEntry } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function ActivityFeed({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <Card>
      <CardTitle>Activity feed</CardTitle>
      <CardDescription>Workflow and governance audit events for the selected run.</CardDescription>
      <div className="mt-4 space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No audit events recorded yet.</p>
        ) : entries.map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-black/10 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={entry.outcome} />
              <span className="text-sm font-medium text-shell-950">{entry.action}</span>
              <span className="text-xs text-slate-500">{formatDateTime(entry.occurredAt)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{entry.reason ?? 'No free-text reason recorded.'}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
