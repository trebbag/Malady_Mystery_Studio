const REVIEWED_AT = '2026-04-21T00:00:00Z';

/**
 * @returns {Record<string, any>}
 */
export function createSeedDiseaseLibrary() {
  return {
    hcc: {
      canonicalDiseaseName: 'Hepatocellular carcinoma',
      aliases: [
        'hcc',
        'hepatocellular carcinoma',
        'primary liver cancer',
      ],
      ontologyId: 'ICD-10-CM:C22.0',
      diseaseCategory: 'solid tumor / hepatobiliary oncology',
      educationalFocus: [
        'liver physiology',
        'tumor biology',
        'diagnostic markers',
        'stage-aware treatment',
      ],
      clinicalSummary: {
        oneSentence: 'Hepatocellular carcinoma is a primary liver malignancy that often arises in chronically injured liver tissue and may present with subtle constitutional or abdominal symptoms.',
        keyMechanism: 'Malignant transformation of hepatocytes within a chronically damaged liver creates a focal tumor whose behavior reflects both cancer biology and liver reserve.',
        timeScale: 'often evolves over months to years on top of chronic liver disease',
        patientExperienceSummary: 'Patients may notice fatigue, abdominal discomfort, weight loss, or decompensation clues rather than a single dramatic early symptom.',
      },
      physiologyPrerequisites: [
        {
          topic: 'basic liver structure and blood supply',
          whyItMatters: 'Readers need to understand why local vascular behavior and organ reserve matter to the story.',
        },
        {
          topic: 'hepatic synthetic and metabolic function',
          whyItMatters: 'The detective work depends on understanding why a tumor in the liver affects markers, symptoms, and treatment choice.',
        },
      ],
      pathophysiology: [
        {
          order: 1,
          event: 'chronic liver injury creates a pro-carcinogenic environment',
          mechanism: 'Inflammation, regeneration, and genomic injury increase malignant transformation risk.',
          scale: 'organ',
          linkedClaimIds: ['clm.hcc.001'],
        },
        {
          order: 2,
          event: 'a malignant hepatocyte clone expands into a focal tumor',
          mechanism: 'Autonomous growth distorts normal architecture and competes with surrounding tissue.',
          scale: 'cellular',
          linkedClaimIds: ['clm.hcc.002'],
        },
        {
          order: 3,
          event: 'tumor growth alters local vascular behavior and hepatic reserve',
          mechanism: 'Expansion changes perfusion and contributes to liver dysfunction or mass-effect findings.',
          scale: 'tissue',
          linkedClaimIds: ['clm.hcc.003'],
        },
      ],
      presentation: {
        commonSymptoms: ['fatigue', 'weight loss', 'right upper quadrant discomfort'],
        commonSigns: ['hepatomegaly', 'cachexia in advanced disease', 'jaundice when liver dysfunction is present'],
        historyClues: ['background chronic liver disease may be present', 'symptoms are often nonspecific early'],
        physicalExamClues: ['liver edge fullness can coexist with chronic liver disease stigmata'],
        complications: ['vascular invasion', 'liver decompensation', 'metastatic spread'],
        typicalTimecourse: 'often insidious until surveillance or progressive symptoms reveal the lesion',
      },
      diagnostics: {
        labs: [
          {
            name: 'liver panel',
            purpose: 'characterize hepatic function and injury pattern',
            expectedFinding: 'may show injury or dysfunction but is not diagnostic by itself',
            claimIds: ['clm.hcc.004'],
          },
          {
            name: 'alpha-fetoprotein',
            purpose: 'supportive tumor marker when elevated in the right context',
            expectedFinding: 'may be elevated in some cases and should be treated as a clue rather than a universal rule',
            claimIds: ['clm.hcc.005'],
          },
        ],
        imaging: [
          {
            name: 'multiphasic liver imaging',
            purpose: 'characterize lesion behavior and vascular pattern',
            expectedFinding: 'arterial enhancement with washout may support diagnosis in context',
            claimIds: ['clm.hcc.006'],
          },
        ],
        pathology: [
          {
            name: 'tumor histology',
            expectedFinding: 'malignant hepatocellular features when tissue is required',
            claimIds: ['clm.hcc.007'],
          },
        ],
        diagnosticLogic: [
          'Interpret the lesion in the setting of chronic liver disease risk.',
          'Use imaging behavior, clinical context, and selected biomarkers together.',
          'Avoid treating one biomarker as a stand-alone diagnosis.',
        ],
        differentials: [
          {
            disease: 'cholangiocarcinoma',
            whyConsidered: 'another primary liver malignancy can produce focal lesions and systemic symptoms',
            whyLessLikely: 'pattern of imaging behavior and hepatocellular biology can point away from biliary-origin malignancy',
          },
          {
            disease: 'metastatic liver disease',
            whyConsidered: 'liver lesions may reflect spread from an extrahepatic cancer',
            whyLessLikely: 'clinical context and lesion behavior may support a primary hepatocellular tumor instead',
          },
        ],
      },
      management: {
        acuteStabilization: [
          'stabilize bleeding, pain, or decompensation when present',
          'address urgent complications of liver dysfunction as clinically indicated',
        ],
        definitiveTherapies: [
          {
            name: 'surgical or locoregional therapy',
            mechanismOfAction: 'remove or destroy tumor tissue in selected localized disease contexts',
            whenUsed: 'selected early or localized disease with adequate liver reserve',
            claimIds: ['clm.hcc.008'],
          },
          {
            name: 'systemic therapy',
            mechanismOfAction: 'target tumor survival pathways or tumor-associated angiogenesis depending on regimen',
            whenUsed: 'advanced or unresectable disease contexts',
            claimIds: ['clm.hcc.009'],
          },
        ],
        monitoring: [
          'stage disease carefully',
          'follow liver function and treatment response',
          'monitor for recurrence or progression',
        ],
        notes: [
          'management is both stage-aware and liver-function-aware',
        ],
      },
      evidence: [
        {
          claimId: 'clm.hcc.001',
          claimText: 'Chronic liver injury increases HCC risk.',
          sourceType: 'guideline',
          sourceLabel: 'Approved hepatology source',
          sourceLocator: 'section risk and pathogenesis',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Adult hepatology education baseline',
        },
        {
          claimId: 'clm.hcc.002',
          claimText: 'HCC reflects malignant transformation of hepatocytes.',
          sourceType: 'review',
          sourceLabel: 'Approved oncology review',
          sourceLocator: 'pathology overview',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism explanation',
        },
        {
          claimId: 'clm.hcc.003',
          claimText: 'Tumor growth changes local perfusion and tissue architecture.',
          sourceType: 'review',
          sourceLabel: 'Approved radiology review',
          sourceLocator: 'imaging-pathology correlation',
          confidence: 0.95,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Panel and scene planning',
        },
        {
          claimId: 'clm.hcc.004',
          claimText: 'Liver tests may be abnormal in HCC but are not diagnostic by themselves.',
          sourceType: 'guideline',
          sourceLabel: 'Approved hepatology source',
          sourceLocator: 'diagnostic assessment',
          confidence: 0.95,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic logic',
        },
        {
          claimId: 'clm.hcc.005',
          claimText: 'AFP may be elevated in HCC but is not universally elevated.',
          sourceType: 'guideline',
          sourceLabel: 'Approved hepatology source',
          sourceLocator: 'tumor markers',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Educational clue handling',
        },
        {
          claimId: 'clm.hcc.006',
          claimText: 'Multiphasic imaging behavior helps identify HCC in the right clinical context.',
          sourceType: 'guideline',
          sourceLabel: 'Approved liver imaging reference',
          sourceLocator: 'radiographic diagnostic criteria',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic pathway',
        },
        {
          claimId: 'clm.hcc.007',
          claimText: 'Histology can confirm malignant hepatocellular features when tissue is needed.',
          sourceType: 'reference',
          sourceLabel: 'Approved pathology reference',
          sourceLocator: 'histopathology overview',
          confidence: 0.94,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Pathology discussion',
        },
        {
          claimId: 'clm.hcc.008',
          claimText: 'Localized HCC may be treated with surgery or locoregional therapy when clinically appropriate.',
          sourceType: 'guideline',
          sourceLabel: 'Approved hepatobiliary oncology source',
          sourceLocator: 'localized treatment recommendations',
          confidence: 0.96,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Treatment showdown planning',
        },
        {
          claimId: 'clm.hcc.009',
          claimText: 'Advanced unresectable HCC may require systemic therapy tailored to disease context.',
          sourceType: 'guideline',
          sourceLabel: 'Approved hepatobiliary oncology source',
          sourceLocator: 'advanced disease management',
          confidence: 0.96,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Treatment showdown planning',
        },
      ],
    },
    mg: {
      canonicalDiseaseName: 'Myasthenia gravis',
      aliases: [
        'myasthenia gravis',
        'autoimmune myasthenia gravis',
      ],
      ontologyId: 'ICD-10-CM:G70.00',
      diseaseCategory: 'autoimmune neuromuscular junction disorder',
      educationalFocus: [
        'neuromuscular transmission',
        'fatigable weakness',
        'receptor-targeted autoimmunity',
      ],
      clinicalSummary: {
        oneSentence: 'Myasthenia gravis is an autoimmune disorder of the neuromuscular junction that causes fluctuating fatigable weakness.',
        keyMechanism: 'Autoantibodies impair neuromuscular transmission, so repeated muscle use reveals the weakness more than fixed structural damage does.',
        timeScale: 'often evolves over weeks to months with fluctuating severity',
        patientExperienceSummary: 'Patients often notice eyelid drooping, double vision, chewing fatigue, or limb weakness that worsens with use and improves with rest.',
      },
      physiologyPrerequisites: [
        {
          topic: 'neuromuscular junction signaling',
          whyItMatters: 'The story depends on showing transmission failure rather than muscle destruction.',
        },
      ],
      pathophysiology: [
        {
          order: 1,
          event: 'autoantibodies target neuromuscular junction proteins',
          mechanism: 'Antibody-mediated disruption reduces efficient signal transmission from nerve to muscle.',
          scale: 'molecular',
          linkedClaimIds: ['clm.mg.001'],
        },
        {
          order: 2,
          event: 'repeated use exposes transmission failure',
          mechanism: 'Signal safety margin falls with exertion, leading to fatigable weakness.',
          scale: 'cellular',
          linkedClaimIds: ['clm.mg.002'],
        },
      ],
      presentation: {
        commonSymptoms: ['ptosis', 'diplopia', 'fatigable chewing or speech difficulty', 'proximal weakness'],
        commonSigns: ['variable ocular weakness', 'fatigable limb weakness'],
        historyClues: ['symptoms worsen with use and later in the day', 'rest may temporarily improve weakness'],
        physicalExamClues: ['strength may decline with repeated effort testing'],
        complications: ['bulbar weakness', 'respiratory compromise in myasthenic crisis'],
        typicalTimecourse: 'fluctuating weakness with exertional worsening is characteristic',
      },
      diagnostics: {
        labs: [
          {
            name: 'acetylcholine receptor antibody testing',
            purpose: 'support immune-mediated neuromuscular junction disease',
            expectedFinding: 'often positive in generalized disease',
            claimIds: ['clm.mg.003'],
          },
        ],
        imaging: [
          {
            name: 'chest imaging for thymic disease',
            purpose: 'evaluate associated thymic abnormalities',
            expectedFinding: 'may identify thymic hyperplasia or thymoma',
            claimIds: ['clm.mg.004'],
          },
        ],
        pathology: [
          {
            name: 'electrodiagnostic correlation',
            expectedFinding: 'supports transmission disorder rather than primary muscle destruction',
            claimIds: ['clm.mg.005'],
          },
        ],
        diagnosticLogic: [
          'Look for fluctuating fatigable weakness rather than fixed sensory loss.',
          'Use antibody and electrodiagnostic data to confirm impaired transmission.',
        ],
        differentials: [
          {
            disease: 'Lambert-Eaton myasthenic syndrome',
            whyConsidered: 'also causes weakness through impaired neuromuscular signaling',
            whyLessLikely: 'clinical pattern and antibody findings can point toward MG instead',
          },
        ],
      },
      management: {
        acuteStabilization: [
          'assess respiratory and bulbar status when symptoms are severe',
        ],
        definitiveTherapies: [
          {
            name: 'symptomatic acetylcholinesterase inhibition',
            mechanismOfAction: 'improves acetylcholine availability at the neuromuscular junction',
            whenUsed: 'symptom control in appropriate patients',
            claimIds: ['clm.mg.006'],
          },
          {
            name: 'immunomodulatory therapy',
            mechanismOfAction: 'reduces autoimmune attack on neuromuscular junction targets',
            whenUsed: 'persistent or generalized disease depending on severity and context',
            claimIds: ['clm.mg.007'],
          },
        ],
        monitoring: [
          'follow fluctuating weakness, swallowing, and respiratory symptoms',
        ],
        notes: [
          'treatment should reflect mechanism-driven transmission failure',
        ],
      },
      evidence: [
        {
          claimId: 'clm.mg.001',
          claimText: 'MG commonly reflects autoantibody-mediated neuromuscular junction dysfunction.',
          sourceType: 'guideline',
          sourceLabel: 'Approved neuromuscular source',
          sourceLocator: 'disease mechanism overview',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism baseline',
        },
        {
          claimId: 'clm.mg.002',
          claimText: 'Fatigable weakness is a core clinical pattern in MG.',
          sourceType: 'review',
          sourceLabel: 'Approved neurology review',
          sourceLocator: 'clinical presentation',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Presentation baseline',
        },
        {
          claimId: 'clm.mg.003',
          claimText: 'Acetylcholine receptor antibodies can support the diagnosis of MG.',
          sourceType: 'guideline',
          sourceLabel: 'Approved neuromuscular source',
          sourceLocator: 'diagnostic testing',
          confidence: 0.96,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic evaluation',
        },
        {
          claimId: 'clm.mg.004',
          claimText: 'Chest imaging can assess for thymic disease associated with MG.',
          sourceType: 'review',
          sourceLabel: 'Approved neurology review',
          sourceLocator: 'associated thymic findings',
          confidence: 0.94,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Associated disease evaluation',
        },
        {
          claimId: 'clm.mg.005',
          claimText: 'Electrodiagnostic studies can support impaired neuromuscular transmission.',
          sourceType: 'reference',
          sourceLabel: 'Approved neurology reference',
          sourceLocator: 'electrodiagnostic interpretation',
          confidence: 0.95,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic confirmation',
        },
        {
          claimId: 'clm.mg.006',
          claimText: 'Acetylcholinesterase inhibition can provide symptomatic improvement in MG.',
          sourceType: 'guideline',
          sourceLabel: 'Approved neuromuscular source',
          sourceLocator: 'symptomatic management',
          confidence: 0.96,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism-based treatment',
        },
        {
          claimId: 'clm.mg.007',
          claimText: 'Immunomodulatory therapy is used to reduce autoimmune activity in generalized MG.',
          sourceType: 'guideline',
          sourceLabel: 'Approved neuromuscular source',
          sourceLocator: 'immunotherapy recommendations',
          confidence: 0.96,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism-based treatment',
        },
      ],
    },
    cap: {
      canonicalDiseaseName: 'Community-acquired pneumonia',
      aliases: [
        'community-acquired pneumonia',
        'pneumonia',
      ],
      ontologyId: 'ICD-10-CM:J18.9',
      diseaseCategory: 'infectious pulmonary disease',
      educationalFocus: [
        'alveolar infection',
        'respiratory symptoms',
        'severity-aware antimicrobial treatment',
      ],
      clinicalSummary: {
        oneSentence: 'Community-acquired pneumonia is an infectious process involving the lung parenchyma that commonly causes cough, fever, and dyspnea.',
        keyMechanism: 'Infection and inflammation fill alveolar spaces, impairing gas exchange and driving respiratory symptoms.',
        timeScale: 'often evolves over days with systemic and respiratory complaints',
        patientExperienceSummary: 'Patients commonly notice cough, fever, shortness of breath, pleuritic pain, or fatigue as the lungs become inflamed.',
      },
      physiologyPrerequisites: [
        {
          topic: 'alveolar gas exchange',
          whyItMatters: 'Readers need to see why inflammatory filling of alveoli causes dyspnea and oxygenation problems.',
        },
      ],
      pathophysiology: [
        {
          order: 1,
          event: 'pathogens seed the lower respiratory tract',
          mechanism: 'Microbial invasion triggers a local inflammatory response.',
          scale: 'organ',
          linkedClaimIds: ['clm.cap.001'],
        },
        {
          order: 2,
          event: 'alveoli fill with inflammatory material',
          mechanism: 'Exudate and cellular debris impair ventilation and gas exchange.',
          scale: 'tissue',
          linkedClaimIds: ['clm.cap.002'],
        },
      ],
      presentation: {
        commonSymptoms: ['cough', 'fever', 'dyspnea', 'pleuritic chest pain'],
        commonSigns: ['tachypnea', 'focal crackles', 'hypoxemia in more severe cases'],
        historyClues: ['acute respiratory complaints', 'infectious prodrome may be present'],
        physicalExamClues: ['focal lung findings can localize the process'],
        complications: ['respiratory failure', 'sepsis', 'parapneumonic effusion'],
        typicalTimecourse: 'typically acute over days',
      },
      diagnostics: {
        labs: [
          {
            name: 'basic infectious and inflammatory labs',
            purpose: 'assess severity and systemic response',
            expectedFinding: 'may show inflammatory response but should be interpreted with the clinical picture',
            claimIds: ['clm.cap.003'],
          },
        ],
        imaging: [
          {
            name: 'chest radiography',
            purpose: 'support diagnosis of parenchymal infection',
            expectedFinding: 'infiltrate or consolidation consistent with pneumonia',
            claimIds: ['clm.cap.004'],
          },
        ],
        pathology: [
          {
            name: 'microbiologic correlation when needed',
            expectedFinding: 'helps identify the infectious cause in selected cases',
            claimIds: ['clm.cap.005'],
          },
        ],
        diagnosticLogic: [
          'Combine respiratory symptoms, physical findings, and imaging.',
          'Consider severity and host factors when selecting diagnostics and therapy.',
        ],
        differentials: [
          {
            disease: 'pulmonary edema',
            whyConsidered: 'shortness of breath and imaging abnormalities can overlap',
            whyLessLikely: 'infectious symptoms and focal inflammatory findings support pneumonia instead',
          },
        ],
      },
      management: {
        acuteStabilization: [
          'support oxygenation and hemodynamics according to severity',
        ],
        definitiveTherapies: [
          {
            name: 'severity-aware antimicrobial therapy',
            mechanismOfAction: 'targets the infectious cause while source control comes from immune recovery and ventilation support',
            whenUsed: 'after clinical assessment of likely pathogens and severity',
            claimIds: ['clm.cap.006'],
          },
        ],
        monitoring: [
          'follow respiratory status and response to treatment',
        ],
        notes: [
          'treatment should acknowledge severity context and suspected cause',
        ],
      },
      evidence: [
        {
          claimId: 'clm.cap.001',
          claimText: 'CAP is an infectious process involving lung parenchyma.',
          sourceType: 'guideline',
          sourceLabel: 'Approved pneumonia guideline',
          sourceLocator: 'definition and pathogenesis',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Baseline disease model',
        },
        {
          claimId: 'clm.cap.002',
          claimText: 'Alveolar inflammation impairs gas exchange in pneumonia.',
          sourceType: 'review',
          sourceLabel: 'Approved pulmonary review',
          sourceLocator: 'physiology of pneumonia',
          confidence: 0.95,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism baseline',
        },
        {
          claimId: 'clm.cap.003',
          claimText: 'Laboratory findings should be interpreted in clinical context and are not sufficient alone.',
          sourceType: 'guideline',
          sourceLabel: 'Approved pneumonia guideline',
          sourceLocator: 'diagnostic evaluation',
          confidence: 0.94,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic workup',
        },
        {
          claimId: 'clm.cap.004',
          claimText: 'Chest imaging supports the diagnosis of pneumonia when correlated with clinical findings.',
          sourceType: 'guideline',
          sourceLabel: 'Approved pneumonia guideline',
          sourceLocator: 'radiographic diagnosis',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic workup',
        },
        {
          claimId: 'clm.cap.005',
          claimText: 'Microbiologic testing is selected based on severity and clinical need.',
          sourceType: 'review',
          sourceLabel: 'Approved pulmonary review',
          sourceLocator: 'microbiologic testing',
          confidence: 0.92,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Selected diagnostic escalation',
        },
        {
          claimId: 'clm.cap.006',
          claimText: 'Antimicrobial treatment for CAP should reflect severity and likely pathogen coverage.',
          sourceType: 'guideline',
          sourceLabel: 'Approved pneumonia guideline',
          sourceLocator: 'antimicrobial treatment',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Treatment baseline',
        },
      ],
    },
    pe: {
      canonicalDiseaseName: 'Pulmonary embolism',
      aliases: [
        'pulmonary embolism',
        'pe',
        'acute pulmonary embolism',
      ],
      ontologyId: 'ICD-10-CM:I26.99',
      diseaseCategory: 'cardiopulmonary thromboembolic disease',
      educationalFocus: [
        'venous thromboembolism',
        'ventilation-perfusion mismatch',
        'right-heart strain and risk-based treatment',
      ],
      clinicalSummary: {
        oneSentence: 'Pulmonary embolism is obstruction of the pulmonary arterial circulation by thromboembolic material that can impair gas exchange and strain the right ventricle.',
        keyMechanism: 'A venous clot travels to the pulmonary circulation, where it blocks blood flow, increases dead-space ventilation, and can raise right-sided cardiac afterload.',
        timeScale: 'often presents abruptly over minutes to hours',
        patientExperienceSummary: 'Patients may suddenly develop dyspnea, pleuritic chest pain, tachycardia, lightheadedness, or unexplained hypoxemia.',
      },
      physiologyPrerequisites: [
        {
          topic: 'pulmonary circulation and ventilation-perfusion matching',
          whyItMatters: 'Readers need to understand why blocked perfusion causes dyspnea even when the airways are open.',
        },
        {
          topic: 'right ventricular afterload',
          whyItMatters: 'The severity arc depends on explaining why a large embolus can destabilize the heart as well as the lungs.',
        },
      ],
      pathophysiology: [
        {
          order: 1,
          event: 'venous thrombosis forms and embolizes to the pulmonary arteries',
          mechanism: 'Clot migration abruptly blocks part of the pulmonary vascular bed.',
          scale: 'vascular',
          linkedClaimIds: ['clm.pe.001'],
        },
        {
          order: 2,
          event: 'perfusion falls while ventilation persists',
          mechanism: 'Dead-space ventilation and hypoxemia emerge because blood flow no longer matches alveolar ventilation.',
          scale: 'organ',
          linkedClaimIds: ['clm.pe.002'],
        },
        {
          order: 3,
          event: 'right-heart strain can develop when clot burden is significant',
          mechanism: 'Acute pulmonary vascular obstruction increases right ventricular afterload and may reduce forward flow.',
          scale: 'whole-body',
          linkedClaimIds: ['clm.pe.003'],
        },
      ],
      presentation: {
        commonSymptoms: ['sudden dyspnea', 'pleuritic chest pain', 'lightheadedness', 'hemoptysis in some cases'],
        commonSigns: ['tachycardia', 'tachypnea', 'hypoxemia', 'hemodynamic instability in higher-risk disease'],
        historyClues: ['immobility, recent surgery, or prior VTE can raise suspicion', 'symptom onset is often abrupt'],
        physicalExamClues: ['respiratory distress can be present despite a relatively clear lung exam'],
        complications: ['right ventricular failure', 'shock', 'recurrent embolization'],
        typicalTimecourse: 'acute onset over minutes to hours',
      },
      diagnostics: {
        labs: [
          {
            name: 'D-dimer in selected low- or intermediate-risk evaluation',
            purpose: 'help exclude thromboembolism when pretest probability allows',
            expectedFinding: 'abnormality is nonspecific and must be interpreted with pretest probability',
            claimIds: ['clm.pe.004'],
          },
        ],
        imaging: [
          {
            name: 'CT pulmonary angiography',
            purpose: 'identify embolic obstruction in the pulmonary arteries',
            expectedFinding: 'filling defects consistent with pulmonary emboli when the diagnosis is present',
            claimIds: ['clm.pe.005'],
          },
        ],
        pathology: [
          {
            name: 'right-heart and severity assessment',
            expectedFinding: 'risk stratification depends on hemodynamic status and evidence of right ventricular strain',
            claimIds: ['clm.pe.006'],
          },
        ],
        diagnosticLogic: [
          'Start with pretest probability rather than treating every dyspnea complaint the same way.',
          'Use imaging and severity markers together to separate low-risk from higher-risk embolism.',
        ],
        differentials: [
          {
            disease: 'pneumonia',
            whyConsidered: 'both can present with dyspnea, pleuritic discomfort, and abnormal oxygenation',
            whyLessLikely: 'sudden onset, thrombotic risk factors, and vascular imaging findings may point toward embolism instead',
          },
          {
            disease: 'acute coronary syndrome',
            whyConsidered: 'chest pain, dyspnea, and instability can overlap',
            whyLessLikely: 'pulmonary vascular imaging or right-heart strain can redirect the workup',
          },
        ],
      },
      management: {
        acuteStabilization: [
          'support oxygenation and perfusion while assessing severity',
          'escalate rapidly when hemodynamic compromise or major right-heart strain is present',
        ],
        definitiveTherapies: [
          {
            name: 'anticoagulation',
            mechanismOfAction: 'prevents clot extension and supports endogenous clot resolution',
            whenUsed: 'first-line treatment for most confirmed pulmonary emboli when bleeding risk allows',
            claimIds: ['clm.pe.007'],
          },
          {
            name: 'reperfusion therapy in selected high-risk cases',
            mechanismOfAction: 'reduces clot burden when obstructive physiology creates major instability',
            whenUsed: 'selected hemodynamically significant pulmonary embolism',
            claimIds: ['clm.pe.008'],
          },
        ],
        monitoring: [
          'follow oxygenation, hemodynamics, and signs of right-heart strain',
          'reassess bleeding risk and long-term anticoagulation planning',
        ],
        notes: [
          'treatment intensity should match embolic risk and hemodynamic impact',
        ],
      },
      evidence: [
        {
          claimId: 'clm.pe.001',
          claimText: 'Pulmonary embolism usually reflects thromboembolic obstruction of the pulmonary arterial circulation.',
          sourceType: 'guideline',
          sourceLabel: 'Approved thrombosis guideline',
          sourceLocator: 'definition and pathogenesis',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Baseline disease model',
        },
        {
          claimId: 'clm.pe.002',
          claimText: 'Pulmonary embolism creates ventilation-perfusion mismatch and can impair oxygenation.',
          sourceType: 'review',
          sourceLabel: 'Approved cardiopulmonary review',
          sourceLocator: 'physiologic consequences',
          confidence: 0.95,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism baseline',
        },
        {
          claimId: 'clm.pe.003',
          claimText: 'Higher clot burden can cause right ventricular strain and hemodynamic compromise.',
          sourceType: 'guideline',
          sourceLabel: 'Approved thrombosis guideline',
          sourceLocator: 'severity and risk stratification',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Severity framing',
        },
        {
          claimId: 'clm.pe.004',
          claimText: 'D-dimer must be interpreted in the context of pretest probability and is not specific for PE.',
          sourceType: 'guideline',
          sourceLabel: 'Approved thrombosis guideline',
          sourceLocator: 'diagnostic pathway',
          confidence: 0.96,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic workup',
        },
        {
          claimId: 'clm.pe.005',
          claimText: 'CT pulmonary angiography can identify embolic filling defects in the pulmonary arteries.',
          sourceType: 'guideline',
          sourceLabel: 'Approved thrombosis guideline',
          sourceLocator: 'imaging diagnosis',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic workup',
        },
        {
          claimId: 'clm.pe.006',
          claimText: 'Risk assessment in PE includes hemodynamics and right ventricular strain assessment.',
          sourceType: 'review',
          sourceLabel: 'Approved cardiopulmonary review',
          sourceLocator: 'risk physiology',
          confidence: 0.94,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Severity framing',
        },
        {
          claimId: 'clm.pe.007',
          claimText: 'Anticoagulation is the mainstay of therapy for most confirmed pulmonary emboli.',
          sourceType: 'guideline',
          sourceLabel: 'Approved thrombosis guideline',
          sourceLocator: 'treatment recommendations',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Treatment baseline',
        },
        {
          claimId: 'clm.pe.008',
          claimText: 'Selected high-risk pulmonary embolism may require reperfusion therapy.',
          sourceType: 'guideline',
          sourceLabel: 'Approved thrombosis guideline',
          sourceLocator: 'advanced treatment escalation',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Treatment escalation',
        },
      ],
    },
    pancreatitis: {
      canonicalDiseaseName: 'Acute pancreatitis',
      aliases: [
        'acute pancreatitis',
        'pancreatitis',
      ],
      ontologyId: 'ICD-10-CM:K85.90',
      diseaseCategory: 'inflammatory gastrointestinal emergency',
      educationalFocus: [
        'pancreatic enzyme activation',
        'sterile inflammation and systemic effects',
        'supportive care and complication monitoring',
      ],
      clinicalSummary: {
        oneSentence: 'Acute pancreatitis is an inflammatory injury of the pancreas caused by premature enzyme activation that can range from localized pain to systemic illness.',
        keyMechanism: 'Digestive enzyme activation inside the pancreas triggers local autodigestion, inflammation, third spacing, and sometimes multi-organ stress.',
        timeScale: 'usually evolves over hours to days',
        patientExperienceSummary: 'Patients often present with severe epigastric pain, nausea, vomiting, and progressive discomfort that can radiate to the back.',
      },
      physiologyPrerequisites: [
        {
          topic: 'pancreatic exocrine enzyme handling',
          whyItMatters: 'The detective story depends on showing why enzymes that should aid digestion become damaging when activated too early.',
        },
      ],
      pathophysiology: [
        {
          order: 1,
          event: 'injury triggers premature pancreatic enzyme activation',
          mechanism: 'Activated enzymes damage pancreatic tissue instead of remaining safely compartmentalized.',
          scale: 'cellular',
          linkedClaimIds: ['clm.pan.001'],
        },
        {
          order: 2,
          event: 'local pancreatic inflammation expands into surrounding tissue and the systemic circulation',
          mechanism: 'Inflammation causes edema, pain, fluid shifts, and sometimes organ dysfunction.',
          scale: 'organ',
          linkedClaimIds: ['clm.pan.002'],
        },
      ],
      presentation: {
        commonSymptoms: ['epigastric pain', 'pain radiating to the back', 'nausea', 'vomiting'],
        commonSigns: ['abdominal tenderness', 'tachycardia', 'volume depletion in more severe cases'],
        historyClues: ['biliary disease or alcohol exposure may be relevant depending on context', 'pain often escalates quickly'],
        physicalExamClues: ['significant epigastric tenderness can dominate the exam'],
        complications: ['necrosis', 'fluid collections', 'organ dysfunction'],
        typicalTimecourse: 'acute inflammatory presentation over hours to days',
      },
      diagnostics: {
        labs: [
          {
            name: 'pancreatic enzymes and metabolic labs',
            purpose: 'support diagnosis and evaluate inflammatory severity or complications',
            expectedFinding: 'elevated pancreatic enzymes support diagnosis in the correct pain syndrome',
            claimIds: ['clm.pan.003'],
          },
        ],
        imaging: [
          {
            name: 'abdominal imaging when clinically indicated',
            purpose: 'look for gallstones, complications, or alternative diagnoses',
            expectedFinding: 'imaging is guided by severity, uncertainty, and complication concern rather than reflex use in every case',
            claimIds: ['clm.pan.004'],
          },
        ],
        pathology: [
          {
            name: 'etiology assessment',
            expectedFinding: 'workup should search for common triggers and severity features',
            claimIds: ['clm.pan.005'],
          },
        ],
        diagnosticLogic: [
          'Diagnose acute pancreatitis from characteristic pain plus supportive laboratory or imaging evidence.',
          'Do not confuse routine imaging triage with the core diagnosis itself.',
        ],
        differentials: [
          {
            disease: 'biliary colic or cholecystitis',
            whyConsidered: 'upper abdominal pain and nausea can overlap substantially',
            whyLessLikely: 'pancreatic enzyme elevation and the broader inflammatory picture can point toward pancreatitis instead',
          },
        ],
      },
      management: {
        acuteStabilization: [
          'provide aggressive early supportive care with fluids, pain control, and monitoring',
        ],
        definitiveTherapies: [
          {
            name: 'cause-directed management with supportive care',
            mechanismOfAction: 'limits physiologic stress while the triggering problem and complications are addressed',
            whenUsed: 'throughout the acute episode with escalation for complications',
            claimIds: ['clm.pan.006'],
          },
        ],
        monitoring: [
          'watch for organ dysfunction, local complications, and failure to improve',
        ],
        notes: [
          'supportive care and severity reassessment are central to good outcomes',
        ],
      },
      evidence: [
        {
          claimId: 'clm.pan.001',
          claimText: 'Acute pancreatitis reflects premature pancreatic enzyme activation and inflammatory injury.',
          sourceType: 'guideline',
          sourceLabel: 'Approved pancreatitis guideline',
          sourceLocator: 'pathogenesis overview',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Baseline disease model',
        },
        {
          claimId: 'clm.pan.002',
          claimText: 'Local pancreatic inflammation can create systemic effects and volume shifts.',
          sourceType: 'review',
          sourceLabel: 'Approved GI review',
          sourceLocator: 'systemic inflammatory consequences',
          confidence: 0.94,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism baseline',
        },
        {
          claimId: 'clm.pan.003',
          claimText: 'Diagnosis combines characteristic abdominal pain with supportive pancreatic enzyme elevation or imaging evidence.',
          sourceType: 'guideline',
          sourceLabel: 'Approved pancreatitis guideline',
          sourceLocator: 'diagnostic criteria',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic workup',
        },
        {
          claimId: 'clm.pan.004',
          claimText: 'Imaging in acute pancreatitis is guided by uncertainty, severity, and complication concern.',
          sourceType: 'review',
          sourceLabel: 'Approved abdominal imaging review',
          sourceLocator: 'imaging role and timing',
          confidence: 0.93,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic escalation',
        },
        {
          claimId: 'clm.pan.005',
          claimText: 'Initial evaluation should identify etiology and risk features, including biliary triggers when relevant.',
          sourceType: 'guideline',
          sourceLabel: 'Approved pancreatitis guideline',
          sourceLocator: 'etiology assessment',
          confidence: 0.96,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Cause finding',
        },
        {
          claimId: 'clm.pan.006',
          claimText: 'Supportive care with fluids, analgesia, and complication monitoring is central to acute pancreatitis management.',
          sourceType: 'guideline',
          sourceLabel: 'Approved pancreatitis guideline',
          sourceLocator: 'supportive management',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Treatment baseline',
        },
      ],
    },
    dka: {
      canonicalDiseaseName: 'Diabetic ketoacidosis',
      aliases: [
        'diabetic ketoacidosis',
        'dka',
      ],
      ontologyId: 'ICD-10-CM:E10.10',
      diseaseCategory: 'endocrine/metabolic emergency',
      educationalFocus: [
        'insulin deficiency',
        'ketosis and acidosis',
        'fluid and electrolyte management',
      ],
      clinicalSummary: {
        oneSentence: 'Diabetic ketoacidosis is an acute metabolic emergency caused by insulin deficiency with ketosis, acidosis, and dehydration.',
        keyMechanism: 'Insulin deficiency drives unchecked lipolysis and ketone production while osmotic diuresis worsens dehydration and electrolyte disruption.',
        timeScale: 'often evolves over hours to days',
        patientExperienceSummary: 'Patients may develop polyuria, polydipsia, nausea, abdominal pain, fatigue, and progressive dehydration before the metabolic pattern becomes obvious.',
      },
      physiologyPrerequisites: [
        {
          topic: 'insulin-mediated glucose utilization',
          whyItMatters: 'The story depends on showing why lack of insulin triggers both hyperglycemia and ketone production.',
        },
      ],
      pathophysiology: [
        {
          order: 1,
          event: 'insulin deficiency and counterregulatory hormones rise',
          mechanism: 'The body cannot use glucose effectively and shifts toward fat breakdown.',
          scale: 'whole-body',
          linkedClaimIds: ['clm.dka.001'],
        },
        {
          order: 2,
          event: 'ketone production and osmotic diuresis accelerate',
          mechanism: 'Ketosis causes acidosis while hyperglycemia worsens dehydration and electrolyte loss.',
          scale: 'molecular',
          linkedClaimIds: ['clm.dka.002'],
        },
      ],
      presentation: {
        commonSymptoms: ['polyuria', 'polydipsia', 'nausea', 'abdominal pain', 'fatigue'],
        commonSigns: ['dehydration', 'tachypnea', 'altered mental status in more severe cases'],
        historyClues: ['progressive insulin deficiency or missed insulin', 'intercurrent illness may trigger the episode'],
        physicalExamClues: ['dry mucous membranes', 'Kussmaul respirations'],
        complications: ['severe electrolyte derangement', 'cerebral edema in selected contexts', 'shock'],
        typicalTimecourse: 'rapidly progressive metabolic decompensation over hours to days',
      },
      diagnostics: {
        labs: [
          {
            name: 'metabolic panel and ketone assessment',
            purpose: 'confirm hyperglycemia, acidosis, and ketosis while monitoring electrolytes',
            expectedFinding: 'anion gap metabolic acidosis with ketosis and clinically important electrolyte shifts',
            claimIds: ['clm.dka.003'],
          },
        ],
        imaging: [],
        pathology: [
          {
            name: 'trigger evaluation',
            expectedFinding: 'identify precipitating illness or insulin interruption when present',
            claimIds: ['clm.dka.004'],
          },
        ],
        diagnosticLogic: [
          'Treat DKA as a combined metabolic and volume/electrolyte emergency.',
          'Confirm ketosis and acidosis rather than reducing the problem to glucose alone.',
        ],
        differentials: [
          {
            disease: 'hyperosmolar hyperglycemic state',
            whyConsidered: 'both can present with severe hyperglycemia and dehydration',
            whyLessLikely: 'prominent ketosis and acidosis support DKA instead',
          },
        ],
      },
      management: {
        acuteStabilization: [
          'replace fluids and correct electrolytes while monitoring closely',
        ],
        definitiveTherapies: [
          {
            name: 'insulin therapy with electrolyte management',
            mechanismOfAction: 'turns off ketone production while coordinated electrolyte replacement prevents treatment-related harm',
            whenUsed: 'after initial assessment and fluid resuscitation planning',
            claimIds: ['clm.dka.005'],
          },
        ],
        monitoring: [
          'track glucose, anion gap, potassium, and clinical recovery',
        ],
        notes: [
          'potassium strategy is part of treatment, not an optional add-on',
        ],
      },
      evidence: [
        {
          claimId: 'clm.dka.001',
          claimText: 'Insulin deficiency drives the core metabolic changes in DKA.',
          sourceType: 'guideline',
          sourceLabel: 'Approved endocrine emergency source',
          sourceLocator: 'pathophysiology overview',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism baseline',
        },
        {
          claimId: 'clm.dka.002',
          claimText: 'Ketosis, acidosis, dehydration, and electrolyte shifts are core features of DKA.',
          sourceType: 'guideline',
          sourceLabel: 'Approved endocrine emergency source',
          sourceLocator: 'metabolic derangement',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Mechanism baseline',
        },
        {
          claimId: 'clm.dka.003',
          claimText: 'DKA diagnosis depends on confirming ketosis and acidosis alongside hyperglycemia.',
          sourceType: 'guideline',
          sourceLabel: 'Approved endocrine emergency source',
          sourceLocator: 'diagnostic criteria',
          confidence: 0.97,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Diagnostic workup',
        },
        {
          claimId: 'clm.dka.004',
          claimText: 'Clinicians should evaluate for precipitating illness or insulin interruption in DKA.',
          sourceType: 'review',
          sourceLabel: 'Approved endocrine review',
          sourceLocator: 'common triggers',
          confidence: 0.93,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Cause finding',
        },
        {
          claimId: 'clm.dka.005',
          claimText: 'Treatment requires fluids, insulin, and careful electrolyte management including potassium strategy.',
          sourceType: 'guideline',
          sourceLabel: 'Approved endocrine emergency source',
          sourceLocator: 'management algorithm',
          confidence: 0.98,
          lastReviewedAt: REVIEWED_AT,
          applicability: 'Treatment baseline',
        },
      ],
    },
  };
}

export const AMBIGUOUS_INPUTS = {
  mg: [
    {
      canonicalDiseaseName: 'Myasthenia gravis',
      ontologyId: 'ICD-10-CM:G70.00',
      matchType: 'ambiguous-suggestion',
    },
    {
      canonicalDiseaseName: 'Magnesium-related disorder',
      ontologyId: 'SNOMED-CT:190855004',
      matchType: 'ambiguous-suggestion',
    },
  ],
};
