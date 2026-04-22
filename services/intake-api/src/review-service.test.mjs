import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countOpenReviewComments,
  diffJsonValues,
  isActiveReviewAssignment,
  isOpenReviewComment,
  matchesAssignmentFilter,
  summarizeAssignmentDisplayNames,
  summarizeJsonDiff,
} from './review-service.mjs';

test('review comment helpers classify unresolved items correctly', () => {
  assert.equal(isOpenReviewComment({ status: 'open' }), true);
  assert.equal(isOpenReviewComment({ status: 'resolved' }), false);
  assert.equal(countOpenReviewComments([
    { status: 'open' },
    { status: 'note' },
    { status: 'open' },
  ]), 2);
});

test('review assignment helpers summarize active assignees', () => {
  const assignments = [
    {
      assigneeDisplayName: 'Local Operator',
      assigneeId: 'local-operator',
      reviewRole: 'clinical',
      status: 'queued',
    },
    {
      assigneeDisplayName: 'Guest Reviewer',
      assigneeId: 'guest-reviewer',
      reviewRole: 'art',
      status: 'completed',
    },
    {
      assigneeDisplayName: 'Local Operator',
      assigneeId: 'local-operator',
      reviewRole: 'editorial',
      status: 'in-progress',
    },
  ];

  assert.equal(isActiveReviewAssignment(assignments[0]), true);
  assert.equal(isActiveReviewAssignment(assignments[1]), false);
  assert.deepEqual(summarizeAssignmentDisplayNames(assignments), ['Local Operator']);
  assert.equal(matchesAssignmentFilter(assignments, 'local'), true);
  assert.equal(matchesAssignmentFilter(assignments, 'art'), true);
  assert.equal(matchesAssignmentFilter(assignments, 'missing'), false);
});

test('json diffing identifies added, removed, and changed paths', () => {
  const changes = diffJsonValues(
    {
      revealPlan: {
        diagnosisTiming: 'final page turn',
      },
      sceneOutline: [
        {
          linkedClaimIds: ['clm.hcc.001'],
        },
      ],
    },
    {
      revealPlan: {
        diagnosisTiming: 'final reveal spread',
      },
      sceneOutline: [
        {
          linkedClaimIds: ['clm.hcc.001', 'clm.hcc.006'],
        },
      ],
      qaNotes: ['keep clue placement fair'],
    },
  );

  assert.deepEqual(changes, [
    {
      path: 'qaNotes',
      changeType: 'added',
      after: ['keep clue placement fair'],
    },
    {
      path: 'revealPlan.diagnosisTiming',
      changeType: 'changed',
      before: 'final page turn',
      after: 'final reveal spread',
    },
    {
      path: 'sceneOutline[0].linkedClaimIds[1]',
      changeType: 'added',
      after: 'clm.hcc.006',
    },
  ]);
  assert.deepEqual(summarizeJsonDiff(changes), {
    changeCount: 3,
    addedCount: 2,
    removedCount: 0,
    changedCount: 1,
  });
});
