import assert from 'node:assert/strict';
import test from 'node:test';

import { createResearchAssemblyService } from './research-assembly.mjs';

test('research assembly can compile a provisional knowledge pack through the injected compiler', async () => {
  const service = createResearchAssemblyService({
    compiler: (/** @type {{ workflowRun: any, workflowInput: any, canonicalDisease: any }} */ { workflowRun, workflowInput, canonicalDisease }) => ({
      researchBrief: {
        schemaVersion: '1.0.0',
        id: 'rbr.test.001',
        tenantId: workflowRun.tenantId,
        workflowRunId: workflowRun.id,
        rawDiseaseInput: workflowInput.diseaseName,
        normalizedDiseaseInput: 'langerhans cell histiocytosis',
        targetCanonicalDiseaseName: canonicalDisease.canonicalDiseaseName,
        audienceTier: workflowInput.audienceTier,
        lengthProfile: 'standard',
        qualityProfile: 'commercial-grade',
        styleProfile: 'alien-detective-clinical-mystery',
        researchIntent: 'Compile a provisional knowledge pack.',
        allowedDomains: ['pubmed.ncbi.nlm.nih.gov'],
        createdAt: '2026-04-23T12:00:00Z',
      },
      sourceHarvest: {
        schemaVersion: '1.0.0',
        id: 'shr.test.001',
        tenantId: workflowRun.tenantId,
        workflowRunId: workflowRun.id,
        targetCanonicalDiseaseName: canonicalDisease.canonicalDiseaseName,
        sources: [
          {
            sourceId: 'src.test.001',
            sourceLabel: 'PubMed review',
            sourceType: 'review',
            origin: 'agent-web',
            sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/example',
            retrievedAt: '2026-04-23T12:00:00Z',
            captureMethod: 'responses-web-search',
            status: 'provisional',
          },
        ],
        droppedSources: [],
        generatedAt: '2026-04-23T12:00:00Z',
      },
      knowledgePack: {
        schemaVersion: '1.0.0',
        id: 'kp.test.001',
        canonicalDiseaseName: canonicalDisease.canonicalDiseaseName,
        packStatus: 'provisional',
        packScope: 'run',
        generationMode: 'agent-generated',
        derivedFromRunId: workflowRun.id,
        sourceOrigins: {
          seeded: 0,
          'user-doc': 0,
          'agent-web': 1,
        },
        aliases: [workflowInput.diseaseName],
        ontologyId: 'prov:langerhans-cell-histiocytosis',
        diseaseCategory: 'provisional-research-needed',
        educationalFocus: ['immune dysregulation'],
        clinicalSummary: {
          oneSentence: 'Rare clonal immune-cell disease.',
          patientExperienceSummary: 'Symptoms vary by organ involvement.',
          keyMechanism: 'Pathologic Langerhans-cell accumulation damages tissue.',
          timeScale: 'variable',
        },
        physiologyPrerequisites: [],
        pathophysiology: [],
        presentation: {},
        diagnostics: {},
        management: {},
        evidence: [
          {
            claimId: 'clm.test.001',
            claimText: 'Pathologic Langerhans-cell accumulation damages tissue.',
            sourceId: 'src.test.001',
            sourceType: 'review',
            sourceLabel: 'PubMed review',
            sourceLocator: 'discussion',
            confidence: 0.81,
          },
        ],
        sourceCatalog: [
          {
            id: 'src.test.001',
            canonicalDiseaseName: canonicalDisease.canonicalDiseaseName,
            sourceLabel: 'PubMed review',
            sourceType: 'review',
            sourceTier: 'tenant-pack',
            origin: 'agent-web',
            retrievedAt: '2026-04-23T12:00:00Z',
            captureMethod: 'responses-web-search',
            reviewState: 'provisional',
            defaultApprovalStatus: 'conditional',
            owner: 'clinical-governance',
            primaryOwnerRole: 'Clinical Reviewer',
            backupOwnerRole: 'Product Editor',
            refreshCadenceDays: 180,
            governanceNotes: [],
            topics: ['immune dysregulation'],
            sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/example',
            lastReviewedAt: '2026-04-23T12:00:00Z',
          },
        ],
        clinicalTeachingPoints: [],
        visualAnchors: [],
        evidenceRelationships: [],
        generatedAt: '2026-04-23T12:00:00Z',
        generatedBy: 'research-assembly-agent',
      },
      buildReport: {
        schemaVersion: '1.0.0',
        id: 'kbr.test.001',
        tenantId: workflowRun.tenantId,
        workflowRunId: workflowRun.id,
        targetCanonicalDiseaseName: canonicalDisease.canonicalDiseaseName,
        status: 'ready',
        claimCount: 1,
        sourceCount: 1,
        blockingIssues: [],
        warnings: ['Rare disease review is still provisional.'],
        missingEvidenceAreas: [],
        fitForStoryContinuation: true,
        generatedAt: '2026-04-23T12:00:00Z',
      },
      responseSources: [],
    }),
  });

  const compiled = await service.compileProvisionalKnowledgePack({
    workflowRun: {
      id: 'run.test.001',
      tenantId: 'tenant.local',
    },
    workflowInput: {
      diseaseName: 'Langerhans cell histiocytosis',
      audienceTier: 'provider-education',
    },
    canonicalDisease: {
      canonicalDiseaseName: 'Langerhans Cell Histiocytosis',
      resolutionStatus: 'new-disease',
    },
  });

  assert.equal(compiled.knowledgePack.packStatus, 'provisional');
  assert.equal(compiled.knowledgePack.packScope, 'run');
  assert.equal(compiled.buildReport.fitForStoryContinuation, true);
  assert.equal(compiled.sourceHarvest.sources.length, 1);
});

test('research assembly falls back to a local fixture pack when no API key is configured', async () => {
  const service = createResearchAssemblyService({
    apiKey: '',
  });
  const compiled = await service.compileProvisionalKnowledgePack({
    workflowRun: {
      id: 'run.test.002',
      tenantId: 'tenant.local',
    },
    workflowInput: {
      diseaseName: 'Unseeded condition',
      audienceTier: 'provider-education',
    },
    canonicalDisease: {
      canonicalDiseaseName: 'Unseeded Condition',
      resolutionStatus: 'new-disease',
    },
  });

  assert.equal(compiled.knowledgePack.packStatus, 'provisional');
  assert.equal(compiled.knowledgePack.generationMode, 'local-fixture');
  assert.equal(compiled.knowledgePack.sourceOrigins['local-fixture'], 1);
  assert.equal(compiled.sourceHarvest.sources[0].origin, 'local-fixture');
  assert.equal(compiled.buildReport.fitForStoryContinuation, true);
  assert.match(compiled.buildReport.warnings.join(' '), /No OpenAI API key/u);
});

test('research assembly reuses the ClinicalEducation vector store when configured', async () => {
  /** @type {any} */
  let requestBody;
  const service = createResearchAssemblyService({
    apiKey: 'sk-test',
    model: 'gpt-test',
    knowledgeBaseVectorStoreId: 'vs_clinical_education_test',
    allowedDomains: ['pubmed.ncbi.nlm.nih.gov'],
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body ?? '{}'));

      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          knowledgePack: {
            canonicalDiseaseName: 'Vector Store Disease',
            aliases: ['Vector Store Disease'],
            ontologyId: 'prov:vector-store-disease',
            diseaseCategory: 'provisional-research-needed',
            educationalFocus: ['source-grounded provisional assembly'],
            clinicalSummary: {
              oneSentence: 'A provisional pack can use the ClinicalEducation vector store.',
              patientExperienceSummary: 'Patient details remain reviewer-gated.',
              keyMechanism: 'Mechanism remains source-backed.',
              timeScale: 'variable',
            },
            physiologyPrerequisites: [],
            pathophysiology: [],
            presentation: {},
            diagnostics: {},
            management: {},
            evidence: [
              {
                claimId: 'clm.vector.001',
                claimText: 'Vector store context can support provisional claims.',
                sourceId: 'src.vector.001',
                sourceType: 'reference',
                sourceLabel: 'ClinicalEducation vector store',
                sourceLocator: 'file search result',
                confidence: 0.8,
                certaintyLevel: 'guarded',
                claimType: 'governance',
                diseaseStageApplicability: 'general',
                patientSubgroupApplicability: 'general',
                importanceRank: 1,
              },
            ],
            sourceCatalog: [
              {
                id: 'src.vector.001',
                canonicalDiseaseName: 'Vector Store Disease',
                sourceLabel: 'ClinicalEducation vector store',
                sourceType: 'reference',
                sourceTier: 'tenant-pack',
                origin: 'user-doc',
                retrievedAt: '2026-04-23T12:00:00Z',
                captureMethod: 'responses-file-search',
                reviewState: 'provisional',
                defaultApprovalStatus: 'conditional',
                owner: 'clinical-governance',
                primaryOwnerRole: 'Clinical Reviewer',
                backupOwnerRole: 'Product Editor',
                refreshCadenceDays: 180,
                governanceNotes: [],
                topics: ['source-grounded provisional assembly'],
                sourceUrl: 'openai-vector-store://vs_clinical_education_test',
                lastReviewedAt: '2026-04-23T12:00:00Z',
              },
            ],
            clinicalTeachingPoints: [],
            visualAnchors: [],
            evidenceRelationships: [],
          },
          buildReport: {
            status: 'ready',
            warnings: [],
            blockingIssues: [],
            missingEvidenceAreas: [],
            fitForStoryContinuation: true,
          },
        }),
        output: [],
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    },
  });

  const compiled = await service.compileProvisionalKnowledgePack({
    workflowRun: {
      id: 'run.test.003',
      tenantId: 'tenant.local',
    },
    workflowInput: {
      diseaseName: 'Vector store disease',
      audienceTier: 'provider-education',
    },
    canonicalDisease: {
      canonicalDiseaseName: 'Vector Store Disease',
      resolutionStatus: 'new-disease',
    },
  });

  assert.equal(compiled.researchBrief.knowledgeBaseVectorStoreConfigured, true);
  assert.deepEqual(compiled.researchBrief.researchTooling, ['openai-file-search', 'openai-web-search']);
  assert.deepEqual(requestBody.tools.map((/** @type {any} */ tool) => tool.type), ['file_search', 'web_search']);
  assert.deepEqual(requestBody.tools[0].vector_store_ids, ['vs_clinical_education_test']);
  assert.equal(requestBody.include.includes('output[*].file_search_call.search_results'), true);
  assert.equal(compiled.sourceHarvest.sources[0].captureMethod, 'responses-file-search');
});
