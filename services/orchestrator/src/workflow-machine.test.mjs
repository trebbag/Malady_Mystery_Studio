import assert from 'node:assert/strict';
import test from 'node:test';

import { createId } from '../../../packages/shared-config/src/ids.mjs';
import { applyWorkflowEvent, createDraftWorkflowRun, loadWorkflowSpec } from './workflow-machine.mjs';

const workflowSpec = await loadWorkflowSpec();
const baseProject = {
  id: 'prj.demo.001',
  input: {
    diseaseName: 'hepatocellular carcinoma',
    audienceTier: 'provider-education',
  },
};
const initialTimestamp = '2026-04-21T00:00:00Z';

test('createDraftWorkflowRun seeds the starter stage and approvals', () => {
  const workflowRun = createDraftWorkflowRun(workflowSpec, baseProject, 'run.demo.001', initialTimestamp);

  assert.equal(workflowRun.state, 'draft');
  assert.equal(workflowRun.currentStage, 'intake');
  assert.equal(workflowRun.requiredApprovalRoles.length, 3);
  assert.equal(workflowRun.stages.length, workflowSpec.stageOrder.length);
  assert.deepEqual(
    workflowRun.approvals.map((/** @type {{ decision: string }} */ approval) => approval.decision),
    ['pending', 'pending', 'pending'],
  );
});

test('workflow stages advance through research assembly and render execution before review', () => {
  let workflowRun = createDraftWorkflowRun(workflowSpec, baseProject, 'run.demo.002', initialTimestamp);

  ({ workflowRun } = applyWorkflowEvent(
    workflowSpec,
    workflowRun,
    {
      eventType: 'START_RUN',
      actor: {
        type: 'user',
        id: 'starter',
      },
    },
    createId('evt'),
    '2026-04-21T00:00:01Z',
  ));

  for (let index = 0; index < 9; index += 1) {
    const timestamp = `2026-04-21T00:00:${String(index + 2).padStart(2, '0')}Z`;
    ({ workflowRun } = applyWorkflowEvent(
      workflowSpec,
      workflowRun,
      {
        eventType: 'STAGE_PASSED',
        actor: {
          type: 'system',
          id: `stage-${index}`,
        },
      },
      createId('evt'),
      timestamp,
    ));
  }

  assert.equal(workflowRun.state, 'review');
  assert.equal(workflowRun.currentStage, 'review');
  assert.equal(
    workflowRun.stages.find((/** @type {{ name: string, status: string }} */ stage) => stage.name === 'research-assembly')?.status,
    'passed',
  );
  assert.equal(
    workflowRun.stages.find((/** @type {{ name: string, status: string }} */ stage) => stage.name === 'render-prep')?.status,
    'passed',
  );
  assert.equal(
    workflowRun.stages.find((/** @type {{ name: string, status: string }} */ stage) => stage.name === 'render-execution')?.status,
    'passed',
  );
  assert.equal(
    workflowRun.stages.find((/** @type {{ name: string, status: string }} */ stage) => stage.name === 'review')?.status,
    'running',
  );
});

test('invalid transitions are rejected', () => {
  const workflowRun = createDraftWorkflowRun(workflowSpec, baseProject, 'run.demo.003', initialTimestamp);

  assert.throws(
    () => applyWorkflowEvent(
      workflowSpec,
      workflowRun,
      {
        eventType: 'APPROVALS_COMPLETED',
        actor: {
          type: 'system',
          id: 'approval-gate',
        },
      },
      createId('evt'),
      '2026-04-21T00:00:02Z',
    ),
    /not allowed/,
  );
});

test('approval completion requires all configured reviewer roles', () => {
  let workflowRun = createDraftWorkflowRun(workflowSpec, baseProject, 'run.demo.004', initialTimestamp);

  ({ workflowRun } = applyWorkflowEvent(
    workflowSpec,
    workflowRun,
    {
      eventType: 'START_RUN',
      actor: {
        type: 'user',
        id: 'starter',
      },
    },
    createId('evt'),
    '2026-04-21T00:00:01Z',
  ));

  for (let index = 0; index < 9; index += 1) {
    const timestamp = `2026-04-21T00:00:${String(index + 10).padStart(2, '0')}Z`;
    ({ workflowRun } = applyWorkflowEvent(
      workflowSpec,
      workflowRun,
      {
        eventType: 'STAGE_PASSED',
        actor: {
          type: 'system',
          id: `stage-${index}`,
        },
      },
      createId('evt'),
      timestamp,
    ));
  }

  for (const role of ['clinical', 'editorial', 'product']) {
    ({ workflowRun } = applyWorkflowEvent(
      workflowSpec,
      workflowRun,
      {
        eventType: 'RECORD_APPROVAL',
        actor: {
          type: 'user',
          id: `${role}-reviewer`,
        },
        payload: {
          role,
          reviewerId: `${role}-reviewer`,
          decision: 'approved',
        },
      },
      createId('evt'),
      `2026-04-21T00:01:${role.length}0Z`,
    ));
  }

  ({ workflowRun } = applyWorkflowEvent(
    workflowSpec,
    workflowRun,
    {
      eventType: 'APPROVALS_COMPLETED',
      actor: {
        type: 'system',
        id: 'approval-gate',
      },
    },
    createId('evt'),
    '2026-04-21T00:02:00Z',
  ));

  assert.equal(workflowRun.state, 'approved');
  assert.equal(workflowRun.currentStage, 'export');
});
