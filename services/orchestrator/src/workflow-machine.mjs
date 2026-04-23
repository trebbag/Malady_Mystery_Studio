import { readFile } from 'node:fs/promises';
import path from 'node:path';

import yaml from 'yaml';

import { findRepoRoot } from '../../../packages/shared-config/src/repo-paths.mjs';

const WORKFLOW_SCHEMA_VERSION = '1.0.0';

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} rootDir
 * @returns {Promise<any>}
 */
export async function loadWorkflowSpec(rootDir = findRepoRoot(import.meta.url)) {
  const workflowSpecPath = path.join(rootDir, 'services/orchestrator/workflow-state-machine.yaml');
  const fileContents = await readFile(workflowSpecPath, 'utf8');

  return yaml.parse(fileContents);
}

/**
 * @param {any} workflowSpec
 * @param {string} stageName
 * @returns {number}
 */
function getStageIndex(workflowSpec, stageName) {
  return workflowSpec.stageOrder.indexOf(stageName);
}

/**
 * @param {any} workflowSpec
 * @param {string} stageName
 * @returns {string | null}
 */
function getNextStage(workflowSpec, stageName) {
  const index = getStageIndex(workflowSpec, stageName);

  if (index === -1 || index + 1 >= workflowSpec.stageOrder.length) {
    return null;
  }

  return workflowSpec.stageOrder[index + 1];
}

/**
 * @param {string} stageName
 * @param {string} status
 * @param {string} timestamp
 * @param {string | undefined} [notes]
 * @returns {{ name: string, status: string, startedAt?: string, endedAt?: string, notes?: string }}
 */
function createStageRecord(stageName, status, timestamp, notes = undefined) {
  /** @type {{ name: string, status: string, startedAt?: string, endedAt?: string, notes?: string }} */
  const stageRecord = {
    name: stageName,
    status,
  };

  if (status === 'running') {
    stageRecord.startedAt = timestamp;
  }

  if (notes) {
    stageRecord.notes = notes;
  }

  return stageRecord;
}

/**
 * @param {ReadonlyArray<any>} stages
 * @param {string} stageName
 * @param {Partial<{ status: string, startedAt: string | undefined, endedAt: string | undefined, notes: string | undefined }>} updates
 * @returns {any[]}
 */
function updateStage(stages, stageName, updates) {
  return stages.map((stage) => {
    if (stage.name !== stageName) {
      return stage;
    }

    const nextStage = {
      ...stage,
      ...updates,
    };

    if (updates.startedAt === undefined) {
      delete nextStage.startedAt;
    }

    if (updates.endedAt === undefined) {
      delete nextStage.endedAt;
    }

    if (updates.notes === undefined) {
      delete nextStage.notes;
    }

    return nextStage;
  });
}

/**
 * @param {any[]} stages
 * @param {any} workflowSpec
 * @param {string} targetStage
 * @param {string} timestamp
 * @param {string | undefined} notes
 * @returns {any[]}
 */
function resetStagesFrom(stages, workflowSpec, targetStage, timestamp, notes) {
  const targetIndex = getStageIndex(workflowSpec, targetStage);

  return stages.map((stage) => {
    const stageIndex = getStageIndex(workflowSpec, stage.name);

    if (stageIndex < targetIndex) {
      return stage;
    }

    if (stage.name === targetStage) {
      return createStageRecord(stage.name, 'running', timestamp, notes);
    }

    return createStageRecord(stage.name, 'pending', timestamp);
  });
}

/**
 * @param {ReadonlyArray<any>} approvals
 * @param {{ role: string, reviewerId?: string, decision: string, comment?: string }} approvalUpdate
 * @param {string} timestamp
 * @returns {any[]}
 */
function upsertApproval(approvals, approvalUpdate, timestamp) {
  let foundRole = false;

  const nextApprovals = approvals.map((approval) => {
    if (approval.role !== approvalUpdate.role) {
      return approval;
    }

    foundRole = true;

    return {
      ...approval,
      comment: approvalUpdate.comment,
      decision: approvalUpdate.decision,
      reviewerId: approvalUpdate.reviewerId,
      timestamp,
    };
  });

  if (!foundRole) {
    nextApprovals.push({
      comment: approvalUpdate.comment,
      decision: approvalUpdate.decision,
      reviewerId: approvalUpdate.reviewerId,
      role: approvalUpdate.role,
      timestamp,
    });
  }

  return nextApprovals;
}

/**
 * @param {any} workflowRun
 * @returns {boolean}
 */
export function areRequiredApprovalsApproved(workflowRun) {
  return workflowRun.requiredApprovalRoles.every((/** @type {string} */ role) => workflowRun.approvals.some(
    (/** @type {{ role: string, decision: string }} */ approval) => approval.role === role && approval.decision === 'approved',
  ));
}

/**
 * @param {any} workflowSpec
 * @param {any} project
 * @param {string} workflowRunId
 * @param {string} timestamp
 * @param {{ diseaseName: string, audienceTier?: string, lengthProfile?: string, qualityProfile?: string, styleProfile?: string }} [inputOverrides]
 * @returns {any}
 */
export function createDraftWorkflowRun(workflowSpec, project, workflowRunId, timestamp, inputOverrides = undefined) {
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    id: workflowRunId,
    projectId: project.id,
    input: {
      ...project.input,
      ...inputOverrides,
    },
    state: workflowSpec.initialState,
    currentStage: workflowSpec.initialStage,
    requiredApprovalRoles: [...workflowSpec.requiredApprovalRoles],
    stages: workflowSpec.stageOrder.map((/** @type {string} */ stageName) => createStageRecord(stageName, 'pending', timestamp)),
    artifacts: [
      {
        artifactType: 'project',
        artifactId: project.id,
        status: 'approved',
      },
    ],
    approvals: workflowSpec.requiredApprovalRoles.map((/** @type {string} */ role) => ({
      role,
      decision: 'pending',
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * @param {any} workflowSpec
 * @param {any} workflowRun
 * @param {{ eventType: string, actor: { type: string, id: string }, payload?: Record<string, unknown>, notes?: string }} eventInput
 * @param {string} eventId
 * @param {string} timestamp
 * @returns {{ event: any, workflowRun: any }}
 */
export function applyWorkflowEvent(workflowSpec, workflowRun, eventInput, eventId, timestamp) {
  const eventConfig = workflowSpec.events[eventInput.eventType];

  if (!eventConfig) {
    throw new Error(`Unknown workflow event: ${eventInput.eventType}`);
  }

  const allowedEvents = workflowSpec.states[workflowRun.state]?.on ?? [];

  if (!allowedEvents.includes(eventInput.eventType)) {
    throw new Error(`Event ${eventInput.eventType} is not allowed while workflow run is ${workflowRun.state}.`);
  }

  const payload = isRecord(eventInput.payload) ? eventInput.payload : {};
  let nextState = eventConfig.targetState ?? workflowRun.state;
  let nextStage = eventConfig.targetStage ?? workflowRun.currentStage;
  let nextStages = structuredClone(workflowRun.stages);
  let nextApprovals = structuredClone(workflowRun.approvals);

  switch (eventInput.eventType) {
    case 'START_RUN': {
      nextStages = updateStage(
        nextStages,
        workflowSpec.initialStage,
        {
          endedAt: undefined,
          notes: eventInput.notes,
          startedAt: timestamp,
          status: 'running',
        },
      );
      nextStage = workflowSpec.initialStage;
      break;
    }
    case 'STAGE_PASSED': {
      const currentStage = workflowRun.currentStage;
      const upcomingStage = getNextStage(workflowSpec, currentStage);

      if (!upcomingStage) {
        throw new Error(`Stage ${currentStage} does not have a configured next stage.`);
      }

      nextStages = updateStage(
        nextStages,
        currentStage,
        {
          endedAt: timestamp,
          notes: eventInput.notes,
          startedAt: workflowRun.stages.find((/** @type {any} */ stage) => stage.name === currentStage)?.startedAt,
          status: 'passed',
        },
      );
      nextStages = updateStage(
        nextStages,
        upcomingStage,
        {
          endedAt: undefined,
          notes: undefined,
          startedAt: timestamp,
          status: 'running',
        },
      );
      nextStage = upcomingStage;
      nextState = upcomingStage === 'review' ? 'review' : 'running';
      break;
    }
    case 'ENTER_REVIEW': {
      const currentStage = workflowRun.currentStage;

      nextStages = updateStage(
        nextStages,
        currentStage,
        {
          endedAt: timestamp,
          notes: eventInput.notes,
          startedAt: workflowRun.stages.find((/** @type {any} */ stage) => stage.name === currentStage)?.startedAt,
          status: 'passed',
        },
      );
      nextStages = updateStage(
        nextStages,
        'review',
        {
          endedAt: undefined,
          notes: undefined,
          startedAt: timestamp,
          status: 'running',
        },
      );
      nextStage = 'review';
      nextState = 'review';
      break;
    }
    case 'STAGE_FAILED': {
      nextStages = updateStage(
        nextStages,
        workflowRun.currentStage,
        {
          endedAt: timestamp,
          notes: eventInput.notes,
          startedAt: workflowRun.stages.find((/** @type {any} */ stage) => stage.name === workflowRun.currentStage)?.startedAt,
          status: 'failed',
        },
      );
      break;
    }
    case 'REQUEST_REVIEW': {
      nextStages = updateStage(
        nextStages,
        workflowRun.currentStage,
        {
          endedAt: timestamp,
          notes: eventInput.notes,
          startedAt: workflowRun.stages.find((/** @type {any} */ stage) => stage.name === workflowRun.currentStage)?.startedAt,
          status: 'blocked',
        },
      );
      break;
    }
    case 'RETRY_STAGE': {
      nextStages = updateStage(
        nextStages,
        workflowRun.currentStage,
        {
          endedAt: undefined,
          notes: eventInput.notes,
          startedAt: timestamp,
          status: 'running',
        },
      );
      break;
    }
    case 'RESUME_STAGE': {
      nextStages = updateStage(
        nextStages,
        workflowRun.currentStage,
        {
          endedAt: undefined,
          notes: eventInput.notes,
          startedAt: timestamp,
          status: 'running',
        },
      );
      break;
    }
    case 'RECORD_APPROVAL': {
      if (typeof payload.role !== 'string' || typeof payload.decision !== 'string') {
        throw new Error('Approval events require payload.role and payload.decision.');
      }

      nextApprovals = upsertApproval(
        nextApprovals,
        {
          role: payload.role,
          reviewerId: typeof payload.reviewerId === 'string' ? payload.reviewerId : undefined,
          decision: payload.decision,
          comment: typeof payload.comment === 'string' ? payload.comment : undefined,
        },
        timestamp,
      );
      nextStage = 'review';
      break;
    }
    case 'APPROVALS_COMPLETED': {
      const approvalSnapshot = {
        ...workflowRun,
        approvals: nextApprovals,
      };

      if (!areRequiredApprovalsApproved(approvalSnapshot)) {
        throw new Error('Cannot complete approvals while required reviewer roles are still pending.');
      }

      nextStages = updateStage(
        nextStages,
        'review',
        {
          endedAt: timestamp,
          notes: eventInput.notes,
          startedAt: workflowRun.stages.find((/** @type {any} */ stage) => stage.name === 'review')?.startedAt,
          status: 'passed',
        },
      );
      nextStage = 'export';
      break;
    }
    case 'REJECT_TO_STAGE': {
      if (typeof payload.targetStage !== 'string') {
        throw new Error('Review rejection requires payload.targetStage.');
      }

      const targetStage = payload.targetStage;

      if (targetStage === 'review' || targetStage === 'export' || getStageIndex(workflowSpec, targetStage) === -1) {
        throw new Error(`Review rejection target stage is invalid: ${targetStage}`);
      }

      nextStages = updateStage(
        nextStages,
        'review',
        {
          endedAt: timestamp,
          notes: eventInput.notes,
          startedAt: workflowRun.stages.find((/** @type {any} */ stage) => stage.name === 'review')?.startedAt,
          status: 'blocked',
        },
      );
      nextStages = resetStagesFrom(nextStages, workflowSpec, targetStage, timestamp, eventInput.notes);
      nextStage = targetStage;
      break;
    }
    case 'START_EXPORT': {
      nextStages = updateStage(
        nextStages,
        'export',
        {
          endedAt: undefined,
          notes: eventInput.notes,
          startedAt: timestamp,
          status: 'running',
        },
      );
      nextStage = 'export';
      break;
    }
    case 'EXPORT_COMPLETED': {
      nextStages = updateStage(
        nextStages,
        'export',
        {
          endedAt: timestamp,
          notes: eventInput.notes,
          startedAt: workflowRun.stages.find((/** @type {any} */ stage) => stage.name === 'export')?.startedAt,
          status: 'passed',
        },
      );
      nextStage = 'export';
      break;
    }
    case 'CANCEL_RUN': {
      nextStages = updateStage(
        nextStages,
        workflowRun.currentStage,
        {
          endedAt: timestamp,
          notes: eventInput.notes,
          startedAt: workflowRun.stages.find((/** @type {any} */ stage) => stage.name === workflowRun.currentStage)?.startedAt,
          status: 'blocked',
        },
      );
      break;
    }
    case 'REOPEN_REVIEW': {
      nextStages = updateStage(
        nextStages,
        'review',
        {
          endedAt: undefined,
          notes: eventInput.notes,
          startedAt: timestamp,
          status: 'running',
        },
      );
      nextStages = updateStage(
        nextStages,
        'export',
        {
          endedAt: undefined,
          notes: undefined,
          startedAt: undefined,
          status: 'pending',
        },
      );
      nextStage = 'review';
      break;
    }
    default:
      throw new Error(`Unhandled workflow event: ${eventInput.eventType}`);
  }

  const nextWorkflowRun = {
    ...workflowRun,
    state: nextState,
    currentStage: nextStage,
    stages: nextStages,
    approvals: nextApprovals,
    updatedAt: timestamp,
    lastEventId: eventId,
  };

  /** @type {any} */
  const workflowEvent = {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    id: eventId,
    workflowRunId: workflowRun.id,
    eventType: eventInput.eventType,
    actor: eventInput.actor,
    stateTransition: {
      fromState: workflowRun.state,
      toState: nextWorkflowRun.state,
      fromStage: workflowRun.currentStage,
      toStage: nextWorkflowRun.currentStage,
    },
    occurredAt: timestamp,
    payload,
  };

  if (eventInput.notes) {
    workflowEvent.notes = eventInput.notes;
  }

  return {
    event: workflowEvent,
    workflowRun: nextWorkflowRun,
  };
}
