import { createId } from '../../../packages/shared-config/src/ids.mjs';

const SCHEMA_VERSION = '1.0.0';
const RUBRIC_VERSION = 'story-engine.v1';
const PANELIZATION_MINIMUM = 0.9;
const RENDER_READINESS_MINIMUM = 0.92;
const DETECTIVE_LEAD_NAME = process.env.MMS_DETECTIVE_LEAD_NAME ?? 'Detective Cyto Kine';
const DETECTIVE_DEPUTY_NAME = process.env.MMS_DETECTIVE_DEPUTY_NAME ?? 'Deputy Pip';
const DETECTIVE_PAIR = Object.freeze([DETECTIVE_LEAD_NAME, DETECTIVE_DEPUTY_NAME]);

const STORY_PROFILES = [
  {
    id: 'oncology',
    match: /(oncolog|tumor|liver|hepatobiliary)/i,
    locationLabel: 'liver dome',
    investigationSite: 'hepatic circulation and the liver surface',
    openingSetups: [
      'The detectives bicker over a glowing map at a lantern market that keeps rewarding whoever sounds most certain.',
      'At an interstellar bazaar, the detectives test a counterfeit compass that swings wildly toward the flashiest distraction.',
    ],
    sideJokes: [
      'The fake map glows brighter whenever someone pretends the route is obvious.',
      'The counterfeit compass insists the noisiest clue must be the right one.',
    ],
    openerLesson: 'The comedy sets up a later lesson about flashy clues versus the real culprit.',
    sidePlot: 'The unreliable navigation prop keeps tempting the detectives toward the wrong explanation.',
    firstClue: 'The detectives find weathered terrain and uneven reserve long before they see the hidden stronghold.',
    secondClue: 'A district of cells is building with its own reckless logic instead of following the organ’s normal rules.',
    thirdClue: 'A recurring marker signal keeps surfacing around the suspicious district, but the detectives treat it as a clue instead of a banner headline.',
    fourthClue: 'The suspicious territory behaves differently from the surrounding tissue when the detectives compare its flow patterns.',
    midpointReversal: 'The detectives stop treating the strange marker as the villain and realize it is evidence pointing toward a deeper hostile takeover.',
    finalImage: 'The detectives laugh beneath liver-shaped lanterns while the once-misleading prop finally points toward the truth.',
    motifTags: ['lantern-market', 'false-map', 'hidden-signal', 'liver-city'],
  },
  {
    id: 'infectious',
    match: /(infectious|pulmonary|pneumonia|lung)/i,
    locationLabel: 'alveolar quarter',
    investigationSite: 'airway entry points and the alveolar network',
    openingSetups: [
      'The detectives inspect a weather station whose fog machine keeps turning a drizzle into a dramatic storm warning.',
      'At a cloud-harvesting arcade, the detectives argue about whether every loud alarm means catastrophe.',
    ],
    sideJokes: [
      'The fog machine insists every puff of vapor deserves a full emergency soundtrack.',
      'The arcade weather siren treats a light mist as if it were the end of the galaxy.',
    ],
    openerLesson: 'The opener frames the difference between ordinary noise and a pattern that truly threatens breathing.',
    sidePlot: 'The exaggerated weather gadget keeps overstating the danger level until the detectives learn what a real crisis looks like.',
    firstClue: 'The patient’s cough, fever, and breathlessness arrive together as if a routine route has become hard to traverse.',
    secondClue: 'Inside the lungs, the detectives find air spaces filling with inflammatory clutter that crowds out normal gas exchange.',
    thirdClue: 'The detectives uncover a clinical pattern showing the body is mounting an infectious response, but they delay formal labels until the evidence stacks up.',
    fourthClue: 'Imaging finally shows that one region of lung is behaving like occupied territory instead of open breathing space.',
    midpointReversal: 'What looked like a vague flu-like disruption becomes a focused invasion with a specific stronghold in the lungs.',
    finalImage: 'The detectives reset the weather station so it finally shows the sky clearing instead of crying storm at every cloud.',
    motifTags: ['weather-station', 'fog-machine', 'airway-route', 'occupied-lung'],
  },
  {
    id: 'autoimmune',
    match: /(autoimmune|neuromuscular|myasthenia|signal)/i,
    locationLabel: 'signal bridge',
    investigationSite: 'neuromuscular junction checkpoints',
    openingSetups: [
      'The detectives test a relay bridge where every repeated crossing makes the lights flicker more dramatically.',
      'At a message-sorting depot, the detectives notice that repeated deliveries seem to arrive weaker each time.',
    ],
    sideJokes: [
      'The bridge attendant insists the lights are just being theatrical, even as they fade with repeated use.',
      'The depot clerk keeps blaming the messenger instead of the weakening relay.',
    ],
    openerLesson: 'The joke foreshadows a case where repetition exposes the real failure better than a single snapshot does.',
    sidePlot: 'The detectives keep returning to the unreliable relay system as a running joke about what happens when signals wear out.',
    firstClue: 'The weakness worsens with repeated effort, so the detectives know the case is about fading transmission rather than instant collapse.',
    secondClue: 'At the signal bridge, each repeat message loses force before it can fully reach the muscles waiting downstream.',
    thirdClue: 'The detectives uncover an immune clue aimed at the communication machinery, but they still treat it as evidence instead of a lecture title.',
    fourthClue: 'Associated imaging and testing reveal that the problem belongs to the communication checkpoint rather than the muscle fibers themselves.',
    midpointReversal: 'The detectives stop blaming the muscles and realize the true sabotage sits at the handoff between nerve and muscle.',
    finalImage: 'The relay bridge lights hold steady at last while the detectives tease the clerk for blaming the wrong courier.',
    motifTags: ['signal-bridge', 'fading-relay', 'false-courier', 'transmission-mystery'],
  },
  {
    id: 'metabolic',
    match: /(metabolic|endocrine|diabetic|ketoacidosis|fuel)/i,
    locationLabel: 'fuel district',
    investigationSite: 'circulating fuel routes and acid-balance checkpoints',
    openingSetups: [
      'The detectives inspect a fuel dock where a broken gauge keeps calling reserve mode a glorious shortcut.',
      'At a supply depot, the detectives catch an overeager vendor promising that emergency reserves can replace real planning forever.',
    ],
    sideJokes: [
      'The broken gauge keeps bragging about efficiency while the whole dock gets more unstable.',
      'The vendor treats crisis backup fuel as a clever life hack instead of a warning siren.',
    ],
    openerLesson: 'The opener sets up a story about emergency fuel strategies becoming dangerous when they take over the whole system.',
    sidePlot: 'The detectives keep mocking the gadget that mistakes crisis compensation for a healthy plan.',
    firstClue: 'The patient arrives dehydrated, exhausted, and increasingly unstable, suggesting a body running on a dangerous backup plan.',
    secondClue: 'Inside the fuel district, the detectives find reserve fuel pathways flooding the system and tipping the environment toward acid chaos.',
    thirdClue: 'Chemistry clues reveal a crisis pattern, but the detectives keep the textbook label in reserve until the chain is visible.',
    fourthClue: 'The full pattern of dehydration, acid imbalance, and runaway reserve fuel use finally locks the case together.',
    midpointReversal: 'What first seemed like a simple sugar problem becomes a whole-system fuel emergency with escalating acid consequences.',
    finalImage: 'The detectives recalibrate the fuel dock and stamp “emergency only” across the gauge that nearly caused the whole mess.',
    motifTags: ['fuel-dock', 'broken-gauge', 'reserve-mode', 'acid-balance'],
  },
];

/**
 * @param {number} value
 * @returns {number}
 */
function roundScore(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length >= 3);
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function calculateTextSimilarity(left, right) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

/**
 * @param {string} value
 * @returns {number}
 */
function hashString(value) {
  return Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0);
}

/**
 * @param {string} value
 * @returns {string}
 */
function toTitleCase(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

/**
 * @template T
 * @param {readonly T[]} values
 * @param {string} key
 * @returns {T}
 */
function selectVariant(values, key) {
  return values[hashString(key) % values.length];
}

/**
 * @param {any} diseasePacket
 * @returns {any}
 */
function selectStoryProfile(diseasePacket) {
  const category = diseasePacket.diseaseCategory ?? diseasePacket.canonicalDiseaseName;

  return STORY_PROFILES.find((profile) => profile.match.test(category)) ?? STORY_PROFILES[0];
}

/**
 * @param {string[]} values
 * @param {number} count
 * @returns {string[]}
 */
function takeDistinct(values, count) {
  /** @type {string[]} */
  const distinctValues = [];

  for (const value of values) {
    if (!value || distinctValues.includes(value)) {
      continue;
    }

    distinctValues.push(value);

    if (distinctValues.length === count) {
      break;
    }
  }

  return distinctValues;
}

/**
 * @param {ReadonlyArray<string>} values
 * @returns {string[]}
 */
function uniqueClaimIds(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0))];
}

/**
 * @param {any} diseasePacket
 * @returns {string[]}
 */
function buildInitialHypotheses(diseasePacket) {
  const differentialNames = diseasePacket.diagnostics.differentials.map(
    (/** @type {{ disease: string }} */ differential) => `Could this instead reflect ${differential.disease.toLowerCase()}?`,
  );
  const categoryHypothesis = `Is a hidden ${diseasePacket.diseaseCategory.toLowerCase()} process driving the instability?`;

  return takeDistinct([categoryHypothesis, ...differentialNames], 3);
}

/**
 * @param {any} diseasePacket
 * @returns {string}
 */
function summarizeSymptoms(diseasePacket) {
  const symptoms = takeDistinct(diseasePacket.presentation.commonSymptoms, 3);

  if (symptoms.length === 0) {
    return 'a subtle pattern of progressive symptoms';
  }

  if (symptoms.length === 1) {
    return symptoms[0];
  }

  if (symptoms.length === 2) {
    return `${symptoms[0]} and ${symptoms[1]}`;
  }

  return `${symptoms[0]}, ${symptoms[1]}, and ${symptoms[2]}`;
}

/**
 * @param {any} diseasePacket
 * @param {any} profile
 * @param {string[]} toneProfile
 * @returns {any}
 */
function createStoryWorkbook(diseasePacket, profile, toneProfile) {
  const firstLab = diseasePacket.diagnostics.labs[0];
  const firstImaging = diseasePacket.diagnostics.imaging[0];
  const firstTherapy = diseasePacket.management.definitiveTherapies[0];
  const fallbackClaimIds = diseasePacket.evidence.slice(0, 2).map((/** @type {{ claimId: string }} */ evidenceRecord) => evidenceRecord.claimId);
  const primaryPathophysiology = diseasePacket.pathophysiology[0] ?? {
    order: 1,
    event: 'Primary disease mechanism',
    mechanism: diseasePacket.clinicalSummary.keyMechanism,
    scale: 'tissue',
    linkedClaimIds: fallbackClaimIds,
  };
  const secondaryPathophysiology = diseasePacket.pathophysiology[1] ?? {
    order: 2,
    event: 'Clinical consequence',
    mechanism: diseasePacket.clinicalSummary.oneSentence,
    scale: 'organ',
    linkedClaimIds: primaryPathophysiology.linkedClaimIds ?? fallbackClaimIds,
  };
  const storyTitle = `The Hidden Signal Above the ${toTitleCase(profile.locationLabel)}`;
  const openingSetup = selectVariant(profile.openingSetups, diseasePacket.canonicalDiseaseName);
  const sideJokeSeed = selectVariant(profile.sideJokes, diseasePacket.canonicalDiseaseName);
  const patientPattern = summarizeSymptoms(diseasePacket);
  const treatmentAction = firstTherapy?.name
    ?? diseasePacket.management.acuteStabilization[0]
    ?? `Choose the reviewed disease-directed intervention for ${diseasePacket.canonicalDiseaseName}`;
  const treatmentMechanism = firstTherapy?.mechanismOfAction
    ?? diseasePacket.management.notes[0]
    ?? primaryPathophysiology.mechanism
    ?? diseasePacket.clinicalSummary.keyMechanism;
  const redHerrings = diseasePacket.diagnostics.differentials.length > 0
    ? diseasePacket.diagnostics.differentials.slice(0, 2).map((/** @type {{ disease: string, whyConsidered: string, whyLessLikely: string }} */ differential) => ({
      misleadingInterpretation: differential.disease,
      whyItSeemsPlausible: differential.whyConsidered,
      whyItFallsApart: differential.whyLessLikely,
    }))
    : [{
      misleadingInterpretation: 'A broader but incomplete mimic',
      whyItSeemsPlausible: diseasePacket.presentation.historyClues[0] ?? diseasePacket.clinicalSummary.patientExperienceSummary,
      whyItFallsApart: diseasePacket.diagnostics.diagnosticLogic[0] ?? 'The full evidence trail points to a more specific mechanism than the early symptoms suggested.',
    }];

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('swb'),
    diseasePacketId: diseasePacket.id,
    storyTitle,
    logline: `Two alien detectives investigate ${patientPattern}, descend toward the ${profile.locationLabel}, and discover that the case is being driven by a hidden mechanistic pattern rather than the flashiest early clue.`,
    toneProfile,
    openingHook: {
      setup: openingSetup,
      sideJokeSeed,
      whyItWorks: profile.openerLesson,
    },
    sidePlot: profile.sidePlot,
    caseQuestion: `What hidden process best explains the patient’s ${patientPattern} without jumping to the loudest possible answer?`,
    detectivePlan: {
      initialHypotheses: buildInitialHypotheses(diseasePacket),
      entryPlan: `Enter through the circulation, survey the ${profile.locationLabel}, and follow any clues that connect symptoms to mechanism.`,
      firstInvestigationSite: profile.investigationSite,
    },
    clueLadder: [
      {
        order: 1,
        clue: profile.firstClue,
        whyItMatters: diseasePacket.presentation.historyClues[0] ?? diseasePacket.clinicalSummary.patientExperienceSummary,
        discoveryMode: 'patient-history',
        linkedClaimIds: primaryPathophysiology.linkedClaimIds ?? [],
      },
      {
        order: 2,
        clue: profile.secondClue,
        whyItMatters: secondaryPathophysiology.mechanism,
        discoveryMode: 'inside-body',
        linkedClaimIds: secondaryPathophysiology.linkedClaimIds ?? primaryPathophysiology.linkedClaimIds ?? [],
      },
      {
        order: 3,
        clue: profile.thirdClue,
        whyItMatters: firstLab?.purpose ?? diseasePacket.diagnostics.diagnosticLogic[0],
        discoveryMode: 'lab',
        linkedClaimIds: firstLab?.claimIds ?? [],
      },
      {
        order: 4,
        clue: profile.fourthClue,
        whyItMatters: firstImaging?.expectedFinding ?? diseasePacket.diagnostics.diagnosticLogic[1] ?? diseasePacket.diagnostics.diagnosticLogic[0],
        discoveryMode: firstImaging ? 'imaging' : 'pathology',
        linkedClaimIds: firstImaging?.claimIds ?? diseasePacket.diagnostics.pathology[0]?.claimIds ?? [],
      },
    ],
    redHerrings,
    midpointReversal: profile.midpointReversal,
    grandReveal: {
      diagnosisName: diseasePacket.canonicalDiseaseName,
      revealLogic: `${diseasePacket.clinicalSummary.keyMechanism} Together, the clue ladder explains why the symptoms, investigative findings, and internal body behavior all fit the same culprit.`,
      recapPoints: [
        diseasePacket.presentation.historyClues[0] ?? 'The early symptoms were a fair clue, not random noise.',
        diseasePacket.pathophysiology[0]?.mechanism ?? diseasePacket.clinicalSummary.keyMechanism,
        diseasePacket.diagnostics.diagnosticLogic[0],
        diseasePacket.management.notes[0] ?? 'The resolution depends on treating the mechanism, not just the noise around it.',
      ],
    },
    treatmentShowdown: {
      clinicalAction: treatmentAction,
      mechanisticVisualization: treatmentMechanism,
      whyItResolvesTheConflict: `The climax works because the intervention targets the same hidden process the detectives uncovered rather than papering over the symptoms.`,
    },
    wrapUp: {
      closingScene: `Back at the opening location, the detectives replay the case and explain which clues mattered and which distractions only looked important.`,
      callbackToOpener: sideJokeSeed,
      finalImage: profile.finalImage,
    },
    teachingObjectives: takeDistinct([
      ...diseasePacket.educationalFocus.map((/** @type {string} */ focus) => `Understand ${focus}.`),
      `Explain how ${diseasePacket.clinicalSummary.keyMechanism.toLowerCase()} shapes the case.`,
      `Connect the reveal to the patient’s lived experience of ${patientPattern}.`,
    ], 4),
    forbiddenShortcuts: takeDistinct([
      `Do not name ${diseasePacket.canonicalDiseaseName} before the grand reveal.`,
      firstLab ? `Do not lead with ${firstLab.name} before the detectives discover why the clue matters.` : '',
      `Do not flatten ${firstTherapy?.name ?? 'the treatment climax'} into a generic fix without mechanism.`,
    ], 3),
  };
}

/**
 * @param {string} diagnosisName
 * @param {any} diseasePacket
 * @returns {string[]}
 */
function getEarlyLeakTerms(diagnosisName, diseasePacket) {
  const diagnosticNames = [
    ...diseasePacket.diagnostics.labs.map((/** @type {{ name: string }} */ item) => item.name),
    ...diseasePacket.diagnostics.imaging.map((/** @type {{ name: string }} */ item) => item.name),
    ...diseasePacket.diagnostics.pathology.map((/** @type {{ name: string }} */ item) => item.name),
  ];

  return takeDistinct([diagnosisName, ...(diseasePacket.aliases ?? []), ...diagnosticNames], 12);
}

/**
 * @param {any} workbook
 * @returns {{ location: string, text: string }[]}
 */
function collectEarlyBeatTexts(workbook) {
  return [
    { location: 'storyTitle', text: workbook.storyTitle },
    { location: 'logline', text: workbook.logline },
    { location: 'openingHook.setup', text: workbook.openingHook.setup },
    { location: 'openingHook.sideJokeSeed', text: workbook.openingHook.sideJokeSeed },
    { location: 'sidePlot', text: workbook.sidePlot },
    { location: 'caseQuestion', text: workbook.caseQuestion },
    ...workbook.detectivePlan.initialHypotheses.map((/** @type {string} */ text, /** @type {number} */ index) => ({
      location: `detectivePlan.initialHypotheses[${index}]`,
      text,
    })),
    ...workbook.clueLadder.slice(0, 2).map((/** @type {{ clue: string }} */ clue, /** @type {number} */ index) => ({
      location: `clueLadder[${index}].clue`,
      text: clue.clue,
    })),
  ];
}

/**
 * @param {any[]} findings
 * @param {string} category
 * @param {string} severity
 * @param {string} ruleId
 * @param {string} message
 * @param {string} evidence
 * @param {string | undefined} [recommendation]
 * @returns {void}
 */
function addFinding(findings, category, severity, ruleId, message, evidence, recommendation = undefined) {
  /** @type {any} */
  const finding = {
    category,
    severity,
    ruleId,
    message,
    evidence,
  };

  if (recommendation) {
    finding.recommendation = recommendation;
  }

  findings.push(finding);
}

/**
 * @param {any} workbook
 * @param {any} diseasePacket
 * @returns {{ score: number, findings: any[] }}
 */
export function reviewMysteryIntegrity(workbook, diseasePacket) {
  /** @type {any[]} */
  const findings = [];
  let score = 1;
  const diagnosisTerms = takeDistinct([workbook.grandReveal.diagnosisName, ...(diseasePacket.aliases ?? [])], 8);

  for (const beat of collectEarlyBeatTexts(workbook)) {
    const matchedDiagnosis = diagnosisTerms.find((term) => normalizeText(term) && normalizeText(beat.text).includes(normalizeText(term)));

    if (matchedDiagnosis) {
      addFinding(
        findings,
        'mystery-integrity',
        'blocking',
        'diagnosis-leak-before-reveal',
        `The workbook leaks the diagnosis in ${beat.location} before the reveal stage.`,
        `Matched term: ${matchedDiagnosis}`,
        'Replace the early beat with a clue, symptom pattern, or mechanistic observation.',
      );
      score -= 0.4;
      break;
    }
  }

  if (workbook.clueLadder.length < 3) {
    addFinding(
      findings,
      'mystery-integrity',
      'blocking',
      'insufficient-clue-ladder',
      'The workbook does not plant enough clues before the reveal.',
      `Only ${workbook.clueLadder.length} clue beats were generated.`,
      'Expand the clue ladder to at least three fair investigative beats.',
    );
    score -= 0.25;
  }

  if (workbook.redHerrings.length === 0) {
    addFinding(
      findings,
      'mystery-integrity',
      'blocking',
      'missing-red-herring',
      'The workbook lacks a plausible alternate interpretation.',
      'No red herrings were generated.',
      'Introduce at least one fair differential that later collapses under the evidence.',
    );
    score -= 0.2;
  }

  if (workbook.grandReveal.recapPoints.length < 3) {
    addFinding(
      findings,
      'mystery-integrity',
      'warning',
      'thin-reveal-recap',
      'The grand reveal recap is too thin to show why the mystery was fair.',
      `Only ${workbook.grandReveal.recapPoints.length} recap points were present.`,
      'Add a recap beat that explicitly reconnects early clues to the final diagnosis.',
    );
    score -= 0.1;
  }

  if (!workbook.treatmentShowdown.whyItResolvesTheConflict) {
    addFinding(
      findings,
      'mystery-integrity',
      'blocking',
      'treatment-not-climax',
      'The treatment beat does not resolve the central conflict mechanistically.',
      'No explicit causal resolution statement was present.',
      'Describe how the treatment interrupts or reverses the mechanism uncovered by the detectives.',
    );
    score -= 0.2;
  }

  return {
    score: roundScore(score),
    findings,
  };
}

/**
 * @param {any} workbook
 * @param {any} diseasePacket
 * @returns {{ score: number, findings: any[] }}
 */
export function reviewEducationalSequencing(workbook, diseasePacket) {
  /** @type {any[]} */
  const findings = [];
  let score = 1;
  const earlyDiagnosticTerms = getEarlyLeakTerms(workbook.grandReveal.diagnosisName, diseasePacket);
  const earlyBeats = collectEarlyBeatTexts(workbook);

  for (const beat of earlyBeats) {
    const matchedTerm = earlyDiagnosticTerms.find((term) => term !== workbook.grandReveal.diagnosisName && normalizeText(term) && normalizeText(beat.text).includes(normalizeText(term)));

    if (matchedTerm) {
      addFinding(
        findings,
        'educational-sequencing',
        'blocking',
        'pathognomonic-jargon-before-discovery',
        `The workbook introduces high-signal diagnostic jargon too early in ${beat.location}.`,
        `Matched term: ${matchedTerm}`,
        'Swap the term for a sensory or mechanistic clue until the detectives have earned the formal label.',
      );
      score -= 0.35;
      break;
    }
  }

  if (!['patient-history', 'exam', 'inside-body'].includes(workbook.clueLadder[0]?.discoveryMode ?? '')) {
    addFinding(
      findings,
      'educational-sequencing',
      'warning',
      'discovery-order-too-clinical',
      'The workbook starts with a diagnostic artifact instead of discovery or lived experience.',
      `First clue mode: ${workbook.clueLadder[0]?.discoveryMode ?? 'unknown'}`,
      'Open with patient experience or in-body discovery before formal diagnostics dominate.',
    );
    score -= 0.15;
  }

  if (workbook.grandReveal.recapPoints.length < 3) {
    addFinding(
      findings,
      'educational-sequencing',
      'warning',
      'recap-too-thin',
      'The final recap is too short to translate discovery beats back into clinical language.',
      `Recap count: ${workbook.grandReveal.recapPoints.length}`,
      'Add recap points that explain how the discovered clues map to the final diagnosis and treatment logic.',
    );
    score -= 0.1;
  }

  return {
    score: roundScore(score),
    findings,
  };
}

/**
 * @param {any} workbook
 * @param {{ workflowRunId?: string, canonicalDiseaseName: string, timestamp: string, motifTags?: string[] }} options
 * @returns {any}
 */
export function createStoryMemory(workbook, options) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('stm'),
    storyWorkbookId: workbook.id,
    workflowRunId: options.workflowRunId,
    canonicalDiseaseName: options.canonicalDiseaseName,
    storyTitle: workbook.storyTitle,
    openingSignature: workbook.openingHook.setup,
    twistSignature: workbook.midpointReversal,
    endingSignature: workbook.wrapUp.closingScene,
    clueSignatures: workbook.clueLadder.map((/** @type {{ clue: string }} */ clue) => clue.clue),
    motifTags: options.motifTags ?? workbook.toneProfile,
    generatedAt: options.timestamp,
  };
}

/**
 * @param {any} candidateMemory
 * @param {any[]} existingMemories
 * @returns {{ score: number, findings: any[] }}
 */
export function compareStoryMemories(candidateMemory, existingMemories) {
  /** @type {any[]} */
  const findings = [];
  let highestOpeningSimilarity = 0;
  let highestTwistSimilarity = 0;
  let highestEndingSimilarity = 0;

  for (const existingMemory of existingMemories) {
    highestOpeningSimilarity = Math.max(
      highestOpeningSimilarity,
      calculateTextSimilarity(candidateMemory.openingSignature, existingMemory.openingSignature ?? ''),
    );
    highestTwistSimilarity = Math.max(
      highestTwistSimilarity,
      calculateTextSimilarity(candidateMemory.twistSignature, existingMemory.twistSignature ?? ''),
    );
    highestEndingSimilarity = Math.max(
      highestEndingSimilarity,
      calculateTextSimilarity(candidateMemory.endingSignature, existingMemory.endingSignature ?? ''),
    );
  }

  if (highestOpeningSimilarity >= 0.72) {
    addFinding(
      findings,
      'novelty',
      'warning',
      'novelty-opening-overlap',
      'The new workbook opener overlaps noticeably with a prior franchise memory.',
      `Opening similarity reached ${highestOpeningSimilarity.toFixed(2)}.`,
      'Change the setting prop or comedic setup while preserving the clue logic.',
    );
  }

  if (highestTwistSimilarity >= 0.72) {
    addFinding(
      findings,
      'novelty',
      'warning',
      'novelty-twist-overlap',
      'The midpoint reversal is too close to a prior story memory.',
      `Twist similarity reached ${highestTwistSimilarity.toFixed(2)}.`,
      'Vary what the detectives misinterpret and how they correct course.',
    );
  }

  if (highestEndingSimilarity >= 0.72) {
    addFinding(
      findings,
      'novelty',
      'warning',
      'novelty-ending-overlap',
      'The wrap-up callback overlaps with a prior franchise memory.',
      `Ending similarity reached ${highestEndingSimilarity.toFixed(2)}.`,
      'Change the callback prop, emotional landing, or final visual echo.',
    );
  }

  return {
    score: roundScore(1 - Math.max(highestOpeningSimilarity, highestTwistSimilarity, highestEndingSimilarity) * 0.4),
    findings,
  };
}

/**
 * @param {any} workbook
 * @returns {{ score: number, findings: any[] }}
 */
export function reviewFranchiseCompliance(workbook) {
  /** @type {any[]} */
  const findings = [];
  let score = 1;

  if (!workbook.openingHook?.setup || !workbook.wrapUp?.callbackToOpener) {
    addFinding(
      findings,
      'franchise-compliance',
      'blocking',
      'missing-open-close-loop',
      'The workbook does not clearly close the opener callback loop.',
      'Opening hook or callback beat is missing.',
      'Ensure the wrap-up explicitly echoes the opener through the side joke, prop, or emotional turn.',
    );
    score -= 0.35;
  }

  if (!workbook.sidePlot || !workbook.midpointReversal) {
    addFinding(
      findings,
      'franchise-compliance',
      'warning',
      'thin-detective-adventure-thread',
      'The recurring detective adventure thread is thinner than expected.',
      'Side plot or midpoint reversal is under-specified.',
      'Strengthen the adventure/comedy thread so the franchise voice survives the medical explanation.',
    );
    score -= 0.15;
  }

  if (!workbook.treatmentShowdown?.mechanisticVisualization) {
    addFinding(
      findings,
      'franchise-compliance',
      'blocking',
      'missing-treatment-climax',
      'The workbook does not make treatment the visual climax of the mystery.',
      'Treatment visualization is missing.',
      'Describe the treatment as an action beat that resolves the mechanism uncovered in the reveal.',
    );
    score -= 0.25;
  }

  return {
    score: roundScore(score),
    findings,
  };
}

/**
 * @param {any} workbook
 * @param {any} diseasePacket
 * @returns {number}
 */
function calculateMedicalAccuracyScore(workbook, diseasePacket) {
  const validClaimIds = new Set(diseasePacket.evidence.map((/** @type {{ claimId: string }} */ record) => record.claimId));
  const linkedClaimIds = workbook.clueLadder.flatMap((/** @type {{ linkedClaimIds?: string[] }} */ clue) => clue.linkedClaimIds ?? []);

  if (linkedClaimIds.length === 0) {
    return 0.9;
  }

  const validCount = linkedClaimIds.filter((/** @type {string} */ claimId) => validClaimIds.has(claimId)).length;
  return roundScore(0.9 + (validCount / linkedClaimIds.length) * 0.1);
}

/**
 * @param {any} workbook
 * @returns {number}
 */
function calculatePanelizationReadiness(workbook) {
  const discoveryModes = new Set(workbook.clueLadder.map((/** @type {{ discoveryMode: string }} */ clue) => clue.discoveryMode));
  let score = 0.9;

  if (discoveryModes.size >= 3) {
    score += 0.05;
  }

  if (workbook.midpointReversal && workbook.treatmentShowdown?.mechanisticVisualization) {
    score += 0.03;
  }

  return roundScore(score);
}

/**
 * @param {any} workbook
 * @returns {number}
 */
function calculateRenderReadiness(workbook) {
  let score = 0.92;

  if (workbook.openingHook?.setup && workbook.wrapUp?.finalImage) {
    score += 0.03;
  }

  if (workbook.treatmentShowdown?.mechanisticVisualization) {
    score += 0.02;
  }

  return roundScore(score);
}

/**
 * @param {string} bodyScale
 * @returns {number}
 */
function getScaleRank(bodyScale) {
  return {
    'external-world': 0,
    'whole-body': 1,
    organ: 2,
    tissue: 3,
    cellular: 4,
    molecular: 5,
  }[bodyScale] ?? 0;
}

/**
 * @param {any} workbook
 * @param {any} diseasePacket
 * @returns {any[]}
 */
function createSceneCards(workbook, diseasePacket) {
  const clueOne = workbook.clueLadder[0];
  const clueTwo = workbook.clueLadder[1] ?? workbook.clueLadder[0];
  const clueThree = workbook.clueLadder[2] ?? workbook.clueLadder[1] ?? workbook.clueLadder[0];
  const clueFour = workbook.clueLadder[3] ?? workbook.clueLadder[2] ?? workbook.clueLadder[1] ?? workbook.clueLadder[0];
  const primaryPathophysiology = diseasePacket.pathophysiology[0];
  const fallbackCoreClaimIds = uniqueClaimIds([
    ...(clueOne?.linkedClaimIds ?? []),
    ...(primaryPathophysiology?.linkedClaimIds ?? []),
  ]);
  const fallbackInvestigationClaimIds = uniqueClaimIds([
    ...(clueTwo?.linkedClaimIds ?? []),
    ...(clueThree?.linkedClaimIds ?? []),
    ...(primaryPathophysiology?.linkedClaimIds ?? []),
  ]);
  const fallbackRevealClaimIds = uniqueClaimIds([
    ...(clueThree?.linkedClaimIds ?? []),
    ...(clueFour?.linkedClaimIds ?? []),
  ]);
  const fallbackTreatmentClaimIds = uniqueClaimIds([
    ...(diseasePacket.management.definitiveTherapies[0]?.claimIds ?? []),
    ...(clueFour?.linkedClaimIds ?? []),
  ]);
  const commonOutputs = ['panel-plan', 'render-prompt', 'lettering-map'];
  /** @type {Record<string, string[]>} */
  const defaultClaimIdsByAct = {
    opener: fallbackCoreClaimIds,
    'case-intake': fallbackCoreClaimIds,
    planning: fallbackInvestigationClaimIds,
    entry: fallbackCoreClaimIds,
    investigation: fallbackInvestigationClaimIds,
    reveal: fallbackRevealClaimIds,
    treatment: fallbackTreatmentClaimIds,
    'wrap-up': uniqueClaimIds([
      ...fallbackRevealClaimIds,
      ...fallbackTreatmentClaimIds,
    ]),
  };
  const sceneDefinitions = [
    {
      act: 'opener',
      title: 'False Signals in the Opening Bazaar',
      sceneType: 'franchise comedy opener',
      goal: 'Hook the reader with franchise charm while foreshadowing the clue logic.',
      location: 'opening bazaar and diagnostic dispatch kiosk',
      bodyScale: 'external-world',
      dramaticQuestion: 'What kind of clue would fool the detectives if they chased style over substance?',
      beats: [
        {
          beatGoal: workbook.openingHook.setup,
          storyFunction: 'hook',
        },
        {
          beatGoal: workbook.sidePlot,
          storyFunction: 'side-plot seed',
        },
        {
          beatGoal: 'Route the detectives toward the new case before the joke fully resolves.',
          storyFunction: 'case handoff',
        },
      ],
      requiredMedicalTruths: [
        workbook.openingHook.whyItWorks,
        diseasePacket.clinicalSummary.patientExperienceSummary,
      ],
    },
    {
      act: 'case-intake',
      title: 'Symptoms at the Threshold',
      sceneType: 'presenting complaint briefing',
      goal: 'Translate the patient experience into the case question and initial stakes.',
      location: 'clinic briefing bay and diagnostic console',
      bodyScale: 'whole-body',
      dramaticQuestion: workbook.caseQuestion,
      beats: [
        {
          beatGoal: `Present the patient’s main pattern of ${summarizeSymptoms(diseasePacket)} without naming the diagnosis.`,
          storyFunction: 'case setup',
          clueRevealed: clueOne?.clue ?? '',
          linkedClaimIds: clueOne?.linkedClaimIds ?? [],
        },
        {
          beatGoal: 'Show why the symptoms could still point in more than one direction.',
          storyFunction: 'fair uncertainty',
        },
        {
          beatGoal: 'Escalate the need for internal investigation.',
          storyFunction: 'stakes',
        },
      ],
      requiredMedicalTruths: takeDistinct([
        diseasePacket.clinicalSummary.patientExperienceSummary,
        ...(diseasePacket.presentation.historyClues ?? []),
      ], 2),
    },
    {
      act: 'planning',
      title: 'Choosing the First Route',
      sceneType: 'detective planning huddle',
      goal: 'Translate the case question into a fair investigative plan.',
      location: 'mission planning table',
      bodyScale: 'external-world',
      dramaticQuestion: 'Which route into the body is most likely to surface the first meaningful clue?',
      beats: [
        {
          beatGoal: workbook.detectivePlan.initialHypotheses[0] ?? 'Frame the most likely hidden process.',
          storyFunction: 'hypothesis',
        },
        {
          beatGoal: workbook.detectivePlan.initialHypotheses[1] ?? 'Pressure-test an alternate explanation.',
          storyFunction: 'alternate interpretation',
        },
        {
          beatGoal: workbook.detectivePlan.entryPlan,
          storyFunction: 'mission launch',
        },
      ],
      requiredMedicalTruths: takeDistinct([
        diseasePacket.diagnostics.diagnosticLogic[0],
        diseasePacket.diagnostics.diagnosticLogic[1] ?? diseasePacket.diagnostics.diagnosticLogic[0],
      ], 2),
    },
    {
      act: 'entry',
      title: 'Crossing Into the Case',
      sceneType: 'body entry sequence',
      goal: 'Shift from external mystery framing into embodied investigation.',
      location: workbook.detectivePlan.firstInvestigationSite,
      bodyScale: clueOne?.discoveryMode === 'inside-body' ? 'organ' : 'whole-body',
      dramaticQuestion: 'What does the environment show before the culprit fully reveals itself?',
      beats: [
        {
          beatGoal: 'Enter the investigative environment and orient the reader to the new scale.',
          storyFunction: 'transition',
        },
        {
          beatGoal: clueOne?.clue ?? 'Notice the first meaningful anomaly.',
          storyFunction: 'clue introduction',
          clueRevealed: clueOne?.clue ?? '',
          linkedClaimIds: clueOne?.linkedClaimIds ?? [],
        },
        {
          beatGoal: clueOne?.whyItMatters ?? 'Explain why the first anomaly matters.',
          storyFunction: 'clue interpretation',
          linkedClaimIds: clueOne?.linkedClaimIds ?? [],
        },
      ],
      requiredMedicalTruths: takeDistinct([
        diseasePacket.pathophysiology[0]?.mechanism ?? diseasePacket.clinicalSummary.keyMechanism,
        diseasePacket.presentation.physicalExamClues[0] ?? diseasePacket.clinicalSummary.oneSentence,
      ], 2),
    },
    {
      act: 'investigation',
      title: 'Following the Hidden Pattern',
      sceneType: 'deep investigation sequence',
      goal: 'Escalate the clue ladder without surrendering the diagnosis too early.',
      location: 'internal clue corridor',
      bodyScale: 'tissue',
      dramaticQuestion: 'Which clues belong to the culprit, and which are only noise around it?',
      beats: [
        {
          beatGoal: clueTwo?.clue ?? 'Develop the second clue.',
          storyFunction: 'clue escalation',
          clueRevealed: clueTwo?.clue ?? '',
          linkedClaimIds: clueTwo?.linkedClaimIds ?? [],
        },
        {
          beatGoal: clueThree?.clue ?? 'Introduce the laboratory or mechanism clue.',
          storyFunction: 'clue comparison',
          clueRevealed: clueThree?.clue ?? '',
          linkedClaimIds: clueThree?.linkedClaimIds ?? [],
        },
        {
          beatGoal: workbook.midpointReversal,
          storyFunction: 'midpoint reversal',
        },
      ],
      requiredMedicalTruths: takeDistinct([
        clueTwo?.whyItMatters ?? diseasePacket.pathophysiology[1]?.mechanism ?? diseasePacket.clinicalSummary.keyMechanism,
        clueThree?.whyItMatters ?? diseasePacket.diagnostics.diagnosticLogic[0],
      ], 2),
    },
    {
      act: 'reveal',
      title: 'The Clues Agree at Last',
      sceneType: 'grand reveal',
      goal: 'Make the diagnosis feel earned by reconnecting the entire clue chain.',
      location: 'reveal chamber at the heart of the pathology',
      bodyScale: 'organ',
      dramaticQuestion: 'How do the clues finally point to one coherent culprit?',
      beats: [
        {
          beatGoal: clueFour?.clue ?? 'Surface the final confirming clue.',
          storyFunction: 'confirming clue',
          clueRevealed: clueFour?.clue ?? '',
          linkedClaimIds: clueFour?.linkedClaimIds ?? [],
        },
        {
          beatGoal: workbook.grandReveal.revealLogic,
          storyFunction: 'diagnosis reveal',
        },
        {
          beatGoal: workbook.grandReveal.recapPoints[0] ?? 'Recap why the earlier clues were fair.',
          storyFunction: 'fairness recap',
        },
      ],
      requiredMedicalTruths: takeDistinct(workbook.grandReveal.recapPoints, 3),
    },
    {
      act: 'treatment',
      title: 'Mechanism Against Mechanism',
      sceneType: 'treatment climax',
      goal: 'Resolve the conflict through a mechanistically meaningful intervention.',
      location: 'treatment corridor and conflict center',
      bodyScale: 'tissue',
      dramaticQuestion: 'What action actually resolves the hidden conflict?',
      beats: [
        {
          beatGoal: workbook.treatmentShowdown.clinicalAction,
          storyFunction: 'clinical action',
        },
        {
          beatGoal: workbook.treatmentShowdown.mechanisticVisualization,
          storyFunction: 'mechanistic clash',
        },
        {
          beatGoal: workbook.treatmentShowdown.whyItResolvesTheConflict,
          storyFunction: 'resolution',
        },
      ],
      requiredMedicalTruths: takeDistinct([
        workbook.treatmentShowdown.whyItResolvesTheConflict,
        diseasePacket.management.notes[0] ?? diseasePacket.management.monitoring[0],
      ], 2),
    },
    {
      act: 'wrap-up',
      title: 'The Callback Lands',
      sceneType: 'closing callback',
      goal: 'Close the opener loop and translate the case into a memorable takeaway.',
      location: 'return to the opening bazaar',
      bodyScale: 'external-world',
      dramaticQuestion: 'What did the detectives learn about clues, truth, and timing?',
      beats: [
        {
          beatGoal: workbook.wrapUp.closingScene,
          storyFunction: 'emotional landing',
        },
        {
          beatGoal: workbook.wrapUp.callbackToOpener,
          storyFunction: 'callback payoff',
        },
        {
          beatGoal: workbook.wrapUp.finalImage,
          storyFunction: 'final image',
        },
      ],
      requiredMedicalTruths: takeDistinct([
        workbook.teachingObjectives[0] ?? diseasePacket.clinicalSummary.oneSentence,
        workbook.teachingObjectives[1] ?? diseasePacket.clinicalSummary.keyMechanism,
      ], 2),
    },
  ];

  return sceneDefinitions.map((sceneDefinition, index) => ({
    schemaVersion: SCHEMA_VERSION,
    id: createId('scn'),
    storyWorkbookId: workbook.id,
    sceneOrder: index + 1,
    act: sceneDefinition.act,
    title: sceneDefinition.title,
    sceneType: sceneDefinition.sceneType,
    goal: sceneDefinition.goal,
    location: sceneDefinition.location,
    bodyScale: sceneDefinition.bodyScale,
    dramaticQuestion: sceneDefinition.dramaticQuestion,
    beats: sceneDefinition.beats.map((/** @type {any} */ beat, /** @type {number} */ beatIndex) => {
      const fallbackClaimIds = defaultClaimIdsByAct[sceneDefinition.act] ?? fallbackCoreClaimIds;
      const linkedClaimIds = Array.isArray(beat.linkedClaimIds) && beat.linkedClaimIds.length > 0
        ? uniqueClaimIds(beat.linkedClaimIds)
        : fallbackClaimIds;
      /** @type {any} */
      const beatRecord = {
        order: beatIndex + 1,
        beatGoal: beat.beatGoal,
        storyFunction: beat.storyFunction,
      };

      if (typeof beat.clueRevealed === 'string' && beat.clueRevealed) {
        beatRecord.clueRevealed = beat.clueRevealed;
      }

      if (linkedClaimIds.length > 0) {
        beatRecord.linkedClaimIds = linkedClaimIds;
      }

      return beatRecord;
    }),
    requiredMedicalTruths: sceneDefinition.requiredMedicalTruths,
    outputs: commonOutputs,
  }));
}

/**
 * @param {any[]} sceneCards
 * @returns {{ score: number, findings: any[] }}
 */
export function reviewSceneCards(sceneCards) {
  /** @type {any[]} */
  const findings = [];
  let score = 1;

  if (sceneCards[0]?.act !== 'opener') {
    addFinding(
      findings,
      'franchise-compliance',
      'blocking',
      'missing-opening-scene',
      'The scene plan does not begin with an opener scene.',
      `First act was ${sceneCards[0]?.act ?? 'missing'}.`,
      'Start the ordered scene list with an explicit opener.',
    );
    score -= 0.3;
  }

  if (sceneCards[sceneCards.length - 1]?.act !== 'wrap-up') {
    addFinding(
      findings,
      'franchise-compliance',
      'blocking',
      'missing-wrap-up-scene',
      'The scene plan does not end with a wrap-up scene.',
      `Last act was ${sceneCards[sceneCards.length - 1]?.act ?? 'missing'}.`,
      'Close the ordered scene list with a wrap-up callback scene.',
    );
    score -= 0.3;
  }

  const revealIndex = sceneCards.findIndex((/** @type {{ act: string }} */ sceneCard) => sceneCard.act === 'reveal');
  const treatmentIndex = sceneCards.findIndex((/** @type {{ act: string }} */ sceneCard) => sceneCard.act === 'treatment');

  if (revealIndex === -1 || treatmentIndex === -1 || treatmentIndex <= revealIndex) {
    addFinding(
      findings,
      'mystery-integrity',
      'blocking',
      'missing-reveal-then-treatment-order',
      'Reveal and treatment scenes are not ordered correctly.',
      `Reveal index: ${revealIndex}, treatment index: ${treatmentIndex}.`,
      'Ensure the treatment climax follows the reveal rather than replacing it.',
    );
    score -= 0.25;
  }

  return {
    score: roundScore(score),
    findings,
  };
}

/**
 * @param {string} act
 * @param {number} panelOrder
 * @returns {string[]}
 */
function getCharactersForAct(act, panelOrder) {
  if (act === 'case-intake') {
    return [...DETECTIVE_PAIR, panelOrder === 1 ? 'doctor' : 'patient'];
  }

  if (act === 'opener') {
    return [...DETECTIVE_PAIR, 'shopkeeper'];
  }

  return [...DETECTIVE_PAIR];
}

/**
 * @param {string} act
 * @param {number} panelOrder
 * @returns {{ cameraFraming: string, cameraAngle: string, lightingMood: string }}
 */
function getPanelVisualProfile(act, panelOrder) {
  const framingByOrder = ['wide shot', 'medium shot', 'close-up'];
  const angleByOrder = ['straight-on', 'over-the-shoulder', 'slightly low angle'];
  /** @type {Record<string, string>} */
  const lightingByAct = {
    opener: 'playful and curious',
    'case-intake': 'clinical but tense',
    planning: 'focused and anticipatory',
    entry: 'awe with unease',
    investigation: 'tightening tension',
    reveal: 'charged clarity',
    treatment: 'kinetic and urgent',
    'wrap-up': 'warm release',
  };

  return {
    cameraFraming: framingByOrder[(panelOrder - 1) % framingByOrder.length],
    cameraAngle: angleByOrder[(panelOrder - 1) % angleByOrder.length],
    lightingMood: lightingByAct[act] ?? 'clear readable drama',
  };
}

/**
 * @param {any} sceneCard
 * @param {any} beat
 * @param {number} panelOrder
 * @returns {string[]}
 */
function buildContinuityAnchors(sceneCard, beat, panelOrder) {
  return takeDistinct([
    'same two recurring alien detectives',
    'case tablet hologram',
    sceneCard.location,
    sceneCard.bodyScale,
    beat.clueRevealed ?? '',
    panelOrder === 1 ? 'entry-direction continuity' : 'reader eye-line continuity',
  ], 6);
}

/**
 * @param {any} sceneCard
 * @param {number} startPage
 * @returns {any}
 */
function createPanelPlan(sceneCard, startPage) {
  const panels = sceneCard.beats.map((/** @type {any} */ beat, /** @type {number} */ beatIndex) => {
    const panelOrder = beatIndex + 1;
    const visualProfile = getPanelVisualProfile(sceneCard.act, panelOrder);
    const continuityAnchors = buildContinuityAnchors(sceneCard, beat, panelOrder);

    /** @type {any} */
    const panelRecord = {
      panelId: createId('pnl'),
      order: panelOrder,
      pageNumber: startPage,
      storyFunction: beat.storyFunction,
      beatGoal: beat.beatGoal,
      medicalObjective: sceneCard.requiredMedicalTruths[beatIndex] ?? sceneCard.requiredMedicalTruths[0] ?? sceneCard.goal,
      location: sceneCard.location,
      bodyScale: sceneCard.bodyScale,
      charactersPresent: getCharactersForAct(sceneCard.act, panelOrder),
      actionSummary: beat.beatGoal,
      continuityAnchors,
      cameraFraming: visualProfile.cameraFraming,
      cameraAngle: visualProfile.cameraAngle,
      compositionNotes: `Stage ${beat.storyFunction} with readable geography and enough empty space for later lettering.`,
      lightingMood: visualProfile.lightingMood,
      humorOrTensionNote: sceneCard.act === 'opener' || sceneCard.act === 'wrap-up'
        ? 'Lean into franchise charm without undermining the case.'
        : 'Keep tension rising while preserving clarity.',
      renderIntent: `Deliver a ${beat.storyFunction} panel that preserves ${sceneCard.bodyScale} readability and the clue hierarchy.`,
      acceptanceChecks: takeDistinct([
        'panel purpose is immediately readable',
        'body scale is legible',
        beat.clueRevealed ? 'clue lands visually without text-heavy exposition' : '',
        'composition leaves room for separate lettering',
      ], 4),
    };

    if (typeof beat.clueRevealed === 'string' && beat.clueRevealed) {
      panelRecord.clueRevealed = beat.clueRevealed;
    }

    if (Array.isArray(beat.linkedClaimIds) && beat.linkedClaimIds.length > 0) {
      panelRecord.linkedClaimIds = beat.linkedClaimIds;
    }

    return panelRecord;
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('ppl'),
    sceneId: sceneCard.id,
    pageRange: {
      startPage,
      endPage: startPage,
    },
    panels,
  };
}

/**
 * @param {any[]} sceneCards
 * @returns {any[]}
 */
function createPanelPlans(sceneCards) {
  let nextPage = 1;

  return sceneCards.map((sceneCard) => {
    const panelPlan = createPanelPlan(sceneCard, nextPage);
    nextPage = panelPlan.pageRange.endPage + 1;
    return panelPlan;
  });
}

/**
 * @param {any[]} panelPlans
 * @returns {{ score: number, findings: any[] }}
 */
export function reviewPanelPlans(panelPlans) {
  /** @type {any[]} */
  const findings = [];
  let score = 1;

  for (const panelPlan of panelPlans) {
    const storyFunctions = new Set(panelPlan.panels.map((/** @type {{ storyFunction: string }} */ panel) => panel.storyFunction));

    if (storyFunctions.size < Math.min(2, panelPlan.panels.length)) {
      addFinding(
        findings,
        'franchise-compliance',
        'warning',
        'panel-purpose-variety-low',
        'A panel plan reuses the same story function too often.',
        `Panel plan ${panelPlan.id} only used ${storyFunctions.size} distinct story functions.`,
        'Vary the panel purposes so action, clue delivery, and reaction remain readable.',
      );
      score -= 0.08;
    }

    for (let index = 1; index < panelPlan.panels.length; index += 1) {
      const previousPanel = panelPlan.panels[index - 1];
      const currentPanel = panelPlan.panels[index];

      if (
        previousPanel.location === currentPanel.location
        && previousPanel.bodyScale === currentPanel.bodyScale
        && previousPanel.cameraFraming === currentPanel.cameraFraming
        && previousPanel.cameraAngle === currentPanel.cameraAngle
      ) {
        addFinding(
          findings,
          'mystery-integrity',
          'warning',
          'flipbook-repetition-risk',
          'Adjacent panels repeat the same staging without enough new information.',
          `Panel pair ${previousPanel.panelId} -> ${currentPanel.panelId} shares location, scale, framing, and angle.`,
          'Change framing, action phase, or scale so the scene progresses visually.',
        );
        score -= 0.12;
      }

      if (Math.abs(getScaleRank(previousPanel.bodyScale) - getScaleRank(currentPanel.bodyScale)) >= 4) {
        addFinding(
          findings,
          'mystery-integrity',
          'blocking',
          'disorienting-scale-jump',
          'Adjacent panels jump too far in scale without an orienting transition.',
          `Panel pair ${previousPanel.panelId} -> ${currentPanel.panelId} jumps from ${previousPanel.bodyScale} to ${currentPanel.bodyScale}.`,
          'Insert an orienting panel or use an intermediate scale transition.',
        );
        score -= 0.22;
      }
    }
  }

  return {
    score: roundScore(score),
    findings,
  };
}

/**
 * @param {any} panel
 * @param {any} storyWorkbook
 * @param {any} diseasePacket
 * @param {{ styleProfile?: string }} options
 * @returns {any}
 */
function createRenderPrompt(panel, storyWorkbook, diseasePacket, options) {
  const styleLocks = takeDistinct([
    ...(storyWorkbook.toneProfile ?? []),
    options.styleProfile ?? '',
    'felt detective characters in accurate 3D animated anatomy environments',
    'clear panel staging',
    'empty space reserved for lettering',
  ], 5);
  const leadDetectivePresent = panel.charactersPresent.includes(DETECTIVE_LEAD_NAME);
  const deputyDetectivePresent = panel.charactersPresent.includes(DETECTIVE_DEPUTY_NAME);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('rpr'),
    panelId: panel.panelId,
    modelFamily: 'openai-gpt-image-2',
    aspectRatio: panel.storyFunction === 'diagnosis reveal' ? '16:9' : '4:3',
    positivePrompt: `Create a high-fidelity comic-book panel illustration. Scene and background: ${panel.location} at ${panel.bodyScale} scale. Subject and action: ${panel.actionSummary}. Key medical details: ${panel.medicalObjective}. Story purpose: ${panel.storyFunction}. Camera and composition: ${panel.cameraFraming}, ${panel.cameraAngle}, ${panel.compositionNotes}. Lighting: ${panel.lightingMood}. Keep ${panel.renderIntent.toLowerCase()} while preserving medical clarity and no visible text.`,
    negativePrompt: 'no speech bubbles, no captions, no labels, no medical chart overlays, no large text blocks, no duplicate characters, no anatomy contradictions, no generic sci-fi background, no illegible signage',
    continuityAnchors: panel.continuityAnchors,
    linkedClaimIds: panel.linkedClaimIds ?? [],
    characterLocks: takeDistinct([
      leadDetectivePresent ? `${DETECTIVE_LEAD_NAME} is the felt lead investigator with a HUD visor, evidence vial, calm noir reasoning, and precise clinical pattern recognition.` : '',
      deputyDetectivePresent ? `${DETECTIVE_DEPUTY_NAME} is the felt field deputy with a micro-scanner, earnest curiosity, and action-forward learner questions.` : '',
      panel.charactersPresent.includes('doctor') ? 'Doctor remains human-scale and visually distinct from the detectives.' : '',
    ], 3),
    anatomyLocks: takeDistinct([
      `Preserve ${diseasePacket.diseaseCategory} logic in the environment.`,
      panel.medicalObjective,
      panel.clueRevealed ? `Show clue: ${panel.clueRevealed}` : '',
    ], 4),
    styleLocks,
    textLayerPolicy: {
      renderVisibleText: false,
      letteringHandledSeparately: true,
      notes: 'Dialogue, captions, labels, and teaching copy must be applied in the separate lettering map.',
    },
  };
}

/**
 * @param {any[]} panelPlans
 * @param {any} storyWorkbook
 * @param {any} diseasePacket
 * @param {{ styleProfile?: string }} options
 * @returns {any[]}
 */
function createRenderPrompts(panelPlans, storyWorkbook, diseasePacket, options) {
  return panelPlans.flatMap((/** @type {any} */ panelPlan) => panelPlan.panels.map(
    (/** @type {any} */ panel) => createRenderPrompt(panel, storyWorkbook, diseasePacket, options),
  ));
}

/**
 * @param {any} sceneCard
 * @param {any} panelPlan
 * @param {any} storyWorkbook
 * @returns {any}
 */
function createLetteringMap(sceneCard, panelPlan, storyWorkbook) {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('ltm'),
    panelPlanId: panelPlan.id,
    entries: panelPlan.panels.map((/** @type {any} */ panel, /** @type {number} */ panelIndex) => {
      /** @type {any} */
      const letteringEntry = {
        entryId: createId('lte'),
        panelId: panel.panelId,
        order: panelIndex + 1,
        layerType: panel.storyFunction.includes('reveal') ? 'caption' : 'dialogue',
        text: panel.storyFunction.includes('reveal')
          ? storyWorkbook.grandReveal.diagnosisName
          : panel.storyFunction.includes('clue')
            ? `Track this clue carefully: ${panel.beatGoal}`
            : panel.beatGoal,
        placement: panel.storyFunction.includes('reveal')
          ? 'top caption band'
          : panelIndex === 0
            ? 'upper-left balloon cluster'
            : panelIndex === panelPlan.panels.length - 1
              ? 'right-side stacked balloons'
              : 'lower-third caption',
        purpose: panel.storyFunction.includes('reveal')
          ? 'Name the diagnosis only after the reveal scene earns it.'
          : `Support the ${panel.storyFunction} beat without embedding text in the art prompt.`,
        spoilerLevel: sceneCard.act === 'reveal' || sceneCard.act === 'treatment'
          ? panel.storyFunction.includes('reveal') ? 'reveal-only' : 'guarded'
          : 'safe',
      };
      const speaker = panel.storyFunction.includes('reveal')
        ? ''
        : panel.charactersPresent.includes(DETECTIVE_LEAD_NAME)
          ? panelIndex % 2 === 0 ? DETECTIVE_LEAD_NAME : DETECTIVE_DEPUTY_NAME
          : panel.charactersPresent[0];

      if (speaker) {
        letteringEntry.speaker = speaker;
      }

      if (Array.isArray(panel.linkedClaimIds) && panel.linkedClaimIds.length > 0) {
        letteringEntry.linkedClaimIds = panel.linkedClaimIds;
      }

      return letteringEntry;
    }),
  };
}

/**
 * @param {any[]} sceneCards
 * @param {any[]} panelPlans
 * @param {any} storyWorkbook
 * @returns {any[]}
 */
function createLetteringMaps(sceneCards, panelPlans, storyWorkbook) {
  return panelPlans.map((panelPlan, index) => createLetteringMap(sceneCards[index], panelPlan, storyWorkbook));
}

/**
 * @param {any[]} renderPrompts
 * @param {any[]} letteringMaps
 * @returns {{ score: number, findings: any[] }}
 */
export function reviewRenderPrompts(renderPrompts, letteringMaps) {
  /** @type {any[]} */
  const findings = [];
  let score = 1;

  if (letteringMaps.length === 0) {
    addFinding(
      findings,
      'franchise-compliance',
      'blocking',
      'missing-lettering-map',
      'Render prompts were generated without a separate lettering payload.',
      'No lettering-map artifacts were present.',
      'Generate lettering maps or dialogue payloads separately from the art prompts.',
    );
    score -= 0.3;
  }

  for (const renderPrompt of renderPrompts) {
    if (!renderPrompt.textLayerPolicy?.letteringHandledSeparately || renderPrompt.textLayerPolicy.renderVisibleText) {
      addFinding(
        findings,
        'franchise-compliance',
        'blocking',
        'text-layer-separation-broken',
        'A render prompt attempts to handle visible text inside the art layer.',
        `Render prompt ${renderPrompt.id} has invalid text layer policy.`,
        'Set renderVisibleText to false and handle lettering in the separate overlay artifact.',
      );
      score -= 0.25;
    }

    if ((renderPrompt.continuityAnchors ?? []).length < 2) {
      addFinding(
        findings,
        'franchise-compliance',
        'warning',
        'missing-continuity-anchors',
        'A render prompt is too thin on continuity anchors.',
        `Render prompt ${renderPrompt.id} only supplied ${renderPrompt.continuityAnchors?.length ?? 0} continuity anchors.`,
        'Include recurring character, prop, and environment anchors.',
      );
      score -= 0.08;
    }

    if ((renderPrompt.anatomyLocks ?? []).length < 2) {
      addFinding(
        findings,
        'mystery-integrity',
        'warning',
        'missing-anatomy-locks',
        'A render prompt is not specific enough about anatomy or mechanism.',
        `Render prompt ${renderPrompt.id} only supplied ${renderPrompt.anatomyLocks?.length ?? 0} anatomy locks.`,
        'Describe the disease-specific environment or mechanism explicitly.',
      );
      score -= 0.08;
    }
  }

  return {
    score: roundScore(score),
    findings,
  };
}

/**
 * @param {any} workbookQaReport
 * @param {string} workflowRunId
 * @param {{ score: number, findings: any[] }} sceneReview
 * @param {{ score: number, findings: any[] }} panelReview
 * @param {{ score: number, findings: any[] }} renderReview
 * @param {string} timestamp
 * @returns {any}
 */
export function createWorkflowQaReportFromVisualReviews(
  workbookQaReport,
  workflowRunId,
  sceneReview,
  panelReview,
  renderReview,
  timestamp,
) {
  const panelizationScore = roundScore((sceneReview.score * 0.35) + (panelReview.score * 0.65));
  const renderReadinessScore = renderReview.score;
  const findings = [
    ...sceneReview.findings,
    ...panelReview.findings,
    ...renderReview.findings,
  ];
  const blockingIssues = findings
    .filter((/** @type {{ severity: string }} */ finding) => finding.severity === 'blocking')
    .map((/** @type {{ message: string }} */ finding) => finding.message);
  const warnings = findings
    .filter((/** @type {{ severity: string }} */ finding) => finding.severity === 'warning')
    .map((/** @type {{ message: string }} */ finding) => finding.message);
  let verdict = blockingIssues.length > 0 ? 'fail' : warnings.length > 0 ? 'conditional-pass' : 'pass';

  if (panelizationScore < PANELIZATION_MINIMUM || renderReadinessScore < RENDER_READINESS_MINIMUM) {
    verdict = 'fail';
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('qar'),
    subjectType: 'workflow-run',
    subjectId: workflowRunId,
    scores: {
      medicalAccuracy: workbookQaReport.scores.medicalAccuracy,
      mysteryIntegrity: workbookQaReport.scores.mysteryIntegrity,
      educationalSequencing: workbookQaReport.scores.educationalSequencing,
      panelization: panelizationScore,
      renderReadiness: renderReadinessScore,
    },
    blockingIssues,
    warnings: takeDistinct([
      ...workbookQaReport.warnings,
      ...warnings,
    ], 12),
    verdict,
    reviewers: [
      {
        role: 'editorial',
        reviewerId: 'story-engine.visual-review',
        decision: verdict === 'fail' ? 'rejected' : 'commented',
        comment: 'Automated scene, panel, and render checks generated.',
        timestamp,
      },
    ],
    createdAt: timestamp,
  };
}

/**
 * @param {any} reviewTrace
 * @param {any} workbook
 * @param {any} diseasePacket
 * @param {string} timestamp
 * @returns {any}
 */
export function createQaReportFromNarrativeReviewTrace(reviewTrace, workbook, diseasePacket, timestamp) {
  const blockingIssues = reviewTrace.findings
    .filter((/** @type {{ severity: string }} */ finding) => finding.severity === 'blocking')
    .map((/** @type {{ message: string }} */ finding) => finding.message);
  const warnings = reviewTrace.findings
    .filter((/** @type {{ severity: string }} */ finding) => finding.severity === 'warning')
    .map((/** @type {{ message: string }} */ finding) => finding.message);

  warnings.push('Panelization and render-readiness scores remain workbook-stage projections until downstream artifacts are generated.');

  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId('qar'),
    subjectType: 'story-workbook',
    subjectId: workbook.id,
    scores: {
      medicalAccuracy: calculateMedicalAccuracyScore(workbook, diseasePacket),
      mysteryIntegrity: reviewTrace.scores.mysteryIntegrity,
      educationalSequencing: reviewTrace.scores.educationalSequencing,
      panelization: calculatePanelizationReadiness(workbook),
      renderReadiness: calculateRenderReadiness(workbook),
    },
    blockingIssues,
    warnings: takeDistinct(warnings, 8),
    verdict: reviewTrace.verdict,
    reviewers: [
      {
        role: 'editorial',
        reviewerId: 'story-engine.auto-review',
        decision: reviewTrace.verdict === 'fail' ? 'rejected' : 'commented',
        comment: 'Automated workbook narrative review trace generated.',
        timestamp,
      },
    ],
    createdAt: timestamp,
  };
}

export class StoryEngineService {
  /**
   * @param {any} diseasePacket
   * @param {{ audienceTier?: string, styleProfile?: string, workflowRunId?: string, existingStoryMemories?: any[], timestamp: string }} options
   * @returns {{ storyWorkbook: any, storyMemory: any, narrativeReviewTrace: any, qaReport: any }}
   */
  generateStoryWorkbookPackage(diseasePacket, options) {
    const profile = selectStoryProfile(diseasePacket);
    const styleTone = options.styleProfile
      ? options.styleProfile.split('-')
      : ['whimsical', 'mystery', 'clinical wonder'];
    const toneProfile = takeDistinct([...styleTone, 'mystery', 'adventure'], 4);
    const storyWorkbook = createStoryWorkbook(diseasePacket, profile, toneProfile);
    const storyMemory = createStoryMemory(storyWorkbook, {
      workflowRunId: options.workflowRunId,
      canonicalDiseaseName: diseasePacket.canonicalDiseaseName,
      timestamp: options.timestamp,
      motifTags: profile.motifTags,
    });

    const mysteryReview = reviewMysteryIntegrity(storyWorkbook, diseasePacket);
    const sequencingReview = reviewEducationalSequencing(storyWorkbook, diseasePacket);
    const noveltyReview = compareStoryMemories(storyMemory, options.existingStoryMemories ?? []);
    const franchiseReview = reviewFranchiseCompliance(storyWorkbook);
    const findings = [
      ...mysteryReview.findings,
      ...sequencingReview.findings,
      ...noveltyReview.findings,
      ...franchiseReview.findings,
    ];
    const blockingFindingCount = findings.filter((/** @type {{ severity: string }} */ finding) => finding.severity === 'blocking').length;
    const warningFindingCount = findings.filter((/** @type {{ severity: string }} */ finding) => finding.severity === 'warning').length;
    const verdict = blockingFindingCount > 0 ? 'fail' : warningFindingCount > 0 ? 'conditional-pass' : 'pass';
    const narrativeReviewTrace = {
      schemaVersion: SCHEMA_VERSION,
      id: createId('nrt'),
      subjectType: 'story-workbook',
      subjectId: storyWorkbook.id,
      rubricVersion: RUBRIC_VERSION,
      scores: {
        mysteryIntegrity: mysteryReview.score,
        educationalSequencing: sequencingReview.score,
        novelty: noveltyReview.score,
        franchiseCompliance: franchiseReview.score,
      },
      findings,
      verdict,
      createdAt: options.timestamp,
    };
    const qaReport = createQaReportFromNarrativeReviewTrace(
      narrativeReviewTrace,
      storyWorkbook,
      diseasePacket,
      options.timestamp,
    );

    return {
      storyWorkbook,
      storyMemory,
      narrativeReviewTrace,
      qaReport,
    };
  }

  /**
   * @param {any} diseasePacket
   * @param {any} storyWorkbook
   * @param {any} workbookQaReport
   * @param {{ workflowRunId: string, styleProfile?: string, timestamp: string }} options
   * @returns {{ sceneCards: any[], panelPlans: any[], renderPrompts: any[], letteringMaps: any[], qaReport: any }}
   */
  generateVisualPlanningPackage(diseasePacket, storyWorkbook, workbookQaReport, options) {
    const sceneCards = createSceneCards(storyWorkbook, diseasePacket);
    const panelPlans = createPanelPlans(sceneCards);
    const renderPrompts = createRenderPrompts(panelPlans, storyWorkbook, diseasePacket, {
      styleProfile: options.styleProfile,
    });
    const letteringMaps = createLetteringMaps(sceneCards, panelPlans, storyWorkbook);
    const sceneReview = reviewSceneCards(sceneCards);
    const panelReview = reviewPanelPlans(panelPlans);
    const renderReview = reviewRenderPrompts(renderPrompts, letteringMaps);
    const qaReport = createWorkflowQaReportFromVisualReviews(
      workbookQaReport,
      options.workflowRunId,
      sceneReview,
      panelReview,
      renderReview,
      options.timestamp,
    );

    return {
      sceneCards,
      panelPlans,
      renderPrompts,
      letteringMaps,
      qaReport,
    };
  }
}

export function createStoryEngineService() {
  return new StoryEngineService();
}
