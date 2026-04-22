import { useState } from 'react';

import type { ReviewAssignment } from '@/lib/types';
import { formatDateTime, uniqueStrings } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ReviewAssignmentsCardProps {
  assignments: ReviewAssignment[];
  reviewRoles: string[];
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
  onComplete: (assignment: ReviewAssignment) => Promise<void>;
}

export function ReviewAssignmentsCard({
  assignments,
  reviewRoles,
  onCreate,
  onComplete,
}: ReviewAssignmentsCardProps) {
  const normalizedRoles = uniqueStrings(reviewRoles.length > 0 ? reviewRoles : ['clinical', 'editorial', 'art']);
  const [reviewRole, setReviewRole] = useState(normalizedRoles[0] ?? 'clinical');
  const [assigneeDisplayName, setAssigneeDisplayName] = useState('Local Operator');
  const [status, setStatus] = useState<'queued' | 'in-progress'>('queued');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    await onCreate({
      reviewRole,
      assigneeDisplayName,
      status,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      notes: notes || undefined,
    });
    setNotes('');
    setDueAt('');
  };

  return (
    <Card className="grid gap-4">
      <div>
        <CardTitle>Review assignments</CardTitle>
        <CardDescription>Track who owns the next review pass for each role before export.</CardDescription>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={reviewRole} onChange={(event) => setReviewRole(event.target.value)}>
            {normalizedRoles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </Select>
          <Input
            value={assigneeDisplayName}
            onChange={(event) => setAssigneeDisplayName(event.target.value)}
            placeholder="Assignee name"
          />
          <Select value={status} onChange={(event) => setStatus(event.target.value as 'queued' | 'in-progress')}>
            <option value="queued">Queued</option>
            <option value="in-progress">In progress</option>
          </Select>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </div>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Capture why this review is being assigned or what needs attention."
        />
        <div className="flex justify-end">
          <Button disabled={!assigneeDisplayName.trim()} onClick={() => void handleSubmit()}>
            Save assignment
          </Button>
        </div>
      </div>

      {assignments.length === 0 ? <Alert tone="info">No assignments are stored for this run yet.</Alert> : null}

      <div className="grid gap-3">
        {assignments.map((assignment) => (
          <div key={assignment.id} className="rounded-2xl border border-black/10 bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-shell-950">{assignment.reviewRole} review</p>
                <p className="text-xs text-slate-500">
                  {assignment.assigneeDisplayName} • {assignment.status} • updated {formatDateTime(assignment.updatedAt)}
                </p>
              </div>
              {assignment.status !== 'completed' ? (
                <Button variant="secondary" onClick={() => void onComplete(assignment)}>
                  Mark complete
                </Button>
              ) : null}
            </div>
            {assignment.dueAt ? <p className="mt-2 text-xs text-slate-500">Due: {formatDateTime(assignment.dueAt)}</p> : null}
            {assignment.notes ? <p className="mt-3 text-sm leading-6 text-slate-700">{assignment.notes}</p> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
