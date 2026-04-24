import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'yaml';

import {
  createSchemaRegistry,
  formatValidationErrors,
  getExamplePathForSchema,
  listContractFiles,
} from '../packages/shared-config/src/schema-registry.mjs';
import { findRepoRoot } from '../packages/shared-config/src/repo-paths.mjs';
import { createSeedDiseaseLibrary } from '../services/clinical-retrieval/src/disease-library.mjs';

const REQUIRED_FILES = [
  '.github/workflows/ci.yml',
  'AGENTS.md',
  'README.md',
  'api/openapi.yaml',
  'docs/backlog/milestone-plan.md',
  'docs/master-spec.md',
  'docs/repo-map.md',
  'docs/prompts/codex-plan.md',
  'evals/registry.yaml',
  'evals/thresholds.yaml',
  'package.json',
  'pnpm-workspace.yaml',
  'services/orchestrator/workflow-state-machine.yaml',
  'tsconfig.json',
];

const YAML_FILES = [
  '.github/workflows/ci.yml',
  'api/openapi.yaml',
  'evals/registry.yaml',
  'evals/thresholds.yaml',
  'services/orchestrator/workflow-state-machine.yaml',
];

const JSONL_DATASETS = [
  'evals/datasets/medical_accuracy_cases.jsonl',
  'evals/datasets/evidence_traceability_cases.jsonl',
  'evals/datasets/mystery_integrity_cases.jsonl',
  'evals/datasets/educational_sequencing_cases.jsonl',
  'evals/datasets/panelization_cases.jsonl',
  'evals/datasets/render_readiness_cases.jsonl',
  'evals/datasets/rendering_guide_quality_cases.jsonl',
  'evals/datasets/render_output_quality_cases.jsonl',
  'evals/datasets/governance_release_cases.jsonl',
];

/**
 * @param {string} filePath
 * @returns {Promise<unknown>}
 */
async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

/**
 * @param {string} filePath
 * @returns {Promise<unknown>}
 */
async function readYaml(filePath) {
  return yaml.parse(await readFile(filePath, 'utf8'));
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} node
 * @param {string[]} refs
 * @returns {void}
 */
function collectRefs(node, refs) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRefs(item, refs);
    }

    return;
  }

  if (!isRecord(node)) {
    return;
  }

  const ref = node.$ref;

  if (typeof ref === 'string') {
    refs.push(ref);
  }

  for (const value of Object.values(node)) {
    collectRefs(value, refs);
  }
}

/**
 * @param {string} rootDir
 * @param {string} relativePath
 * @returns {string}
 */
function resolveFromRoot(rootDir, relativePath) {
  return path.join(rootDir, relativePath);
}

/**
 * @param {string} rootDir
 * @returns {Promise<string[]>}
 */
async function validateOpenApi(rootDir) {
  const failures = [];
  const openApiPath = resolveFromRoot(rootDir, 'api/openapi.yaml');
  const openApi = await readYaml(openApiPath);
  /** @type {string[]} */
  const refs = [];

  collectRefs(openApi, refs);

  for (const ref of refs) {
    if (!ref.startsWith('../contracts/')) {
      continue;
    }

    const targetPath = path.resolve(path.dirname(openApiPath), ref);

    try {
      await readFile(targetPath, 'utf8');
    } catch (error) {
      failures.push(`OpenAPI reference missing target: ${ref} (${String(error)})`);
    }
  }

  return failures;
}

/**
 * @param {string} rootDir
 * @returns {Promise<string[]>}
 */
async function validateWorkflowSpec(rootDir) {
  const failures = [];
  const workflowPath = resolveFromRoot(rootDir, 'services/orchestrator/workflow-state-machine.yaml');
  const workflowSpec = await readYaml(workflowPath);

  if (!isRecord(workflowSpec)) {
    return ['Workflow spec is not a YAML object.'];
  }

  const stageOrder = workflowSpec.stageOrder;
  const states = workflowSpec.states;
  const events = workflowSpec.events;

  if (!Array.isArray(stageOrder) || stageOrder.length === 0) {
    failures.push('Workflow spec must define a non-empty stageOrder.');
  }

  if (!isRecord(states) || Object.keys(states).length === 0) {
    failures.push('Workflow spec must define at least one workflow state.');
  }

  if (!isRecord(events) || Object.keys(events).length === 0) {
    failures.push('Workflow spec must define workflow events.');
  }

  if (typeof workflowSpec.initialState !== 'string' || !isRecord(states) || !(workflowSpec.initialState in states)) {
    failures.push('Workflow spec initialState must exist in states.');
  }

  if (typeof workflowSpec.initialStage !== 'string' || !Array.isArray(stageOrder) || !stageOrder.includes(workflowSpec.initialStage)) {
    failures.push('Workflow spec initialStage must exist in stageOrder.');
  }

  if (Array.isArray(stageOrder) && !stageOrder.includes('review')) {
    failures.push('Workflow spec stageOrder must include review.');
  }

  if (Array.isArray(stageOrder) && !stageOrder.includes('export')) {
    failures.push('Workflow spec stageOrder must include export.');
  }

  if (isRecord(states) && isRecord(events)) {
    for (const [stateName, stateConfig] of Object.entries(states)) {
      if (!isRecord(stateConfig) || !Array.isArray(stateConfig.on)) {
        failures.push(`Workflow state ${stateName} must declare an "on" event list.`);
        continue;
      }

      for (const eventName of stateConfig.on) {
        if (typeof eventName !== 'string' || !(eventName in events)) {
          failures.push(`Workflow state ${stateName} references unknown event ${String(eventName)}.`);
        }
      }
    }
  }

  return failures;
}

/**
 * @param {any} knowledgePack
 * @returns {string[]}
 */
function validatePromotedKnowledgePackSemantics(knowledgePack) {
  const failures = [];
  const label = knowledgePack.canonicalDiseaseName ?? knowledgePack.id ?? 'unknown knowledge pack';
  const sources = Array.isArray(knowledgePack.sourceCatalog) ? knowledgePack.sourceCatalog : [];
  const claims = Array.isArray(knowledgePack.evidence) ? knowledgePack.evidence : [];
  const claimIds = new Set(claims.map((/** @type {any} */ claim) => claim.claimId).filter(Boolean));
  const sourceIds = new Set(sources.map((/** @type {any} */ source) => source.id).filter(Boolean));
  const evidenceSourceIds = new Set(claims.map((/** @type {any} */ claim) => claim.sourceId).filter(Boolean));

  if (sources.length === 0) {
    failures.push(`${label}: promoted packs require at least one governed source record.`);
  }

  for (const source of sources) {
    if (source.defaultApprovalStatus !== 'approved' && evidenceSourceIds.has(source.id)) {
      failures.push(`${label}: source ${source.id ?? 'unknown'} must be approved before it can support promoted-pack claims.`);
    }

    if (source.defaultApprovalStatus === 'suspended' && evidenceSourceIds.has(source.id)) {
      failures.push(`${label}: suspended source ${source.id ?? 'unknown'} cannot support promoted-pack claims.`);
    }

    if (!source.primaryOwnerRole || !source.backupOwnerRole) {
      failures.push(`${label}: source ${source.id ?? 'unknown'} must declare primary and backup owner roles.`);
    }

    if (!Number.isInteger(source.refreshCadenceDays) || source.refreshCadenceDays <= 0) {
      failures.push(`${label}: source ${source.id ?? 'unknown'} must declare a positive refresh cadence.`);
    }

    if (!source.nextReviewDueAt) {
      failures.push(`${label}: source ${source.id ?? 'unknown'} must declare nextReviewDueAt.`);
    }
  }

  if (claims.length === 0) {
    failures.push(`${label}: promoted packs require claim-level evidence.`);
  }

  for (const claim of claims) {
    if (!claim.claimId || !claim.claimText || !claim.sourceId) {
      failures.push(`${label}: every evidence claim must include claimId, claimText, and sourceId.`);
      continue;
    }

    if (!sourceIds.has(claim.sourceId)) {
      failures.push(`${label}: evidence claim ${claim.claimId} references missing source ${claim.sourceId}.`);
    }
  }

  for (const sectionName of ['pathophysiology', 'clinicalTeachingPoints', 'visualAnchors']) {
    const section = Array.isArray(knowledgePack[sectionName]) ? knowledgePack[sectionName] : [];

    for (const item of section) {
      const linkedClaimIds = Array.isArray(item.linkedClaimIds) ? item.linkedClaimIds : [];

      if (linkedClaimIds.length === 0) {
        failures.push(`${label}: ${sectionName} item ${item.title ?? item.event ?? item.anchorId ?? 'unknown'} must link to evidence claims.`);
      }

      for (const linkedClaimId of linkedClaimIds) {
        if (!claimIds.has(linkedClaimId)) {
          failures.push(`${label}: ${sectionName} item references missing claim ${linkedClaimId}.`);
        }
      }
    }
  }

  return failures;
}

/**
 * @param {string} rootDir
 * @param {Awaited<ReturnType<typeof createSchemaRegistry>>} schemaRegistry
 * @returns {{ failures: string[], validatedKnowledgePacks: number, promotedKnowledgePacks: number }}
 */
function validateKnowledgePacks(rootDir, schemaRegistry) {
  const failures = [];
  const diseaseLibrary = createSeedDiseaseLibrary(rootDir);
  const knowledgePacks = Object.values(diseaseLibrary);
  let promotedKnowledgePacks = 0;

  for (const knowledgePack of knowledgePacks) {
    const result = schemaRegistry.validateBySchemaId('contracts/disease-knowledge-pack.schema.json', knowledgePack);

    if (!result.valid) {
      failures.push(`Knowledge pack validation failed for ${knowledgePack.canonicalDiseaseName ?? knowledgePack.id}\n${formatValidationErrors(result.errors)}`);
      continue;
    }

    if (knowledgePack.packStatus === 'promoted') {
      promotedKnowledgePacks += 1;
      failures.push(...validatePromotedKnowledgePackSemantics(knowledgePack));
    }
  }

  return {
    failures,
    validatedKnowledgePacks: knowledgePacks.length,
    promotedKnowledgePacks,
  };
}

/**
 * @param {string} rootDir
 * @returns {Promise<{ failures: string[], stats: Record<string, number> }>}
 */
export async function validateRepoPack(rootDir = findRepoRoot(import.meta.url)) {
  const failures = [];

  for (const relativePath of REQUIRED_FILES) {
    try {
      await readFile(resolveFromRoot(rootDir, relativePath), 'utf8');
    } catch (error) {
      failures.push(`Missing required file: ${relativePath} (${String(error)})`);
    }
  }

  for (const relativePath of YAML_FILES) {
    try {
      await readYaml(resolveFromRoot(rootDir, relativePath));
    } catch (error) {
      failures.push(`YAML parse failed for ${relativePath}: ${String(error)}`);
    }
  }

  failures.push(...await validateOpenApi(rootDir));
  failures.push(...await validateWorkflowSpec(rootDir));

  const schemaRegistry = await createSchemaRegistry(rootDir);
  const contractFiles = await listContractFiles(rootDir);
  let validatedExamples = 0;

  for (const schemaPath of contractFiles) {
    const examplePath = getExamplePathForSchema(schemaPath);

    try {
      const example = await readJson(examplePath);
      const schemaId = `contracts/${path.basename(schemaPath)}`;
      const result = schemaRegistry.validateBySchemaId(schemaId, example);

      if (!result.valid) {
        failures.push(`Schema validation failed for ${path.relative(rootDir, examplePath)}\n${formatValidationErrors(result.errors)}`);
      } else {
        validatedExamples += 1;
      }
    } catch (error) {
      failures.push(`Unable to validate example for ${path.basename(schemaPath)}: ${String(error)}`);
    }
  }

  const knowledgePackValidation = validateKnowledgePacks(rootDir, schemaRegistry);
  failures.push(...knowledgePackValidation.failures);

  const evaluationSchemaId = 'contracts/evaluation-case.schema.json';
  let datasetRows = 0;

  for (const relativePath of JSONL_DATASETS) {
    try {
      const contents = await readFile(resolveFromRoot(rootDir, relativePath), 'utf8');
      const lines = contents.split('\n').filter((line) => line.trim().length > 0);

      if (lines.length === 0) {
        failures.push(`Dataset has no rows: ${relativePath}`);
        continue;
      }

      for (const line of lines) {
        const result = schemaRegistry.validateBySchemaId(evaluationSchemaId, JSON.parse(line));

        if (!result.valid) {
          failures.push(`Dataset validation failed for ${relativePath}\n${formatValidationErrors(result.errors)}`);
          break;
        }

        datasetRows += 1;
      }
    } catch (error) {
      failures.push(`Unable to validate dataset ${relativePath}: ${String(error)}`);
    }
  }

  return {
    failures,
    stats: {
      datasetsValidated: JSONL_DATASETS.length,
      exampleArtifactsValidated: validatedExamples,
      knowledgePacksValidated: knowledgePackValidation.validatedKnowledgePacks,
      promotedKnowledgePacksValidated: knowledgePackValidation.promotedKnowledgePacks,
      schemaFilesLoaded: schemaRegistry.schemaIds.length,
      workflowConfigsParsed: YAML_FILES.length,
      workflowRowsValidated: datasetRows,
    },
  };
}

async function main() {
  const { failures, stats } = await validateRepoPack();

  if (failures.length > 0) {
    console.error('VALIDATION FAILED');

    for (const failure of failures) {
      console.error(`- ${failure}`);
    }

    process.exit(1);
  }

  console.log('VALIDATION PASSED');
  console.log(`Loaded ${stats.schemaFilesLoaded} contract schemas.`);
  console.log(`Validated ${stats.exampleArtifactsValidated} example artifacts.`);
  console.log(`Validated ${stats.knowledgePacksValidated} governed knowledge packs (${stats.promotedKnowledgePacksValidated} promoted).`);
  console.log(`Validated ${stats.workflowRowsValidated} eval dataset rows.`);
  console.log(`Parsed ${stats.workflowConfigsParsed} YAML configs.`);
}

const executedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executedAsScript) {
  await main();
}
