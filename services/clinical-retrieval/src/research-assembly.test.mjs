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
