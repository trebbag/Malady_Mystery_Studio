# Commercial Production Specification
## Disease-to-Comic Clinical Mystery Platform
**Version:** 1.0 working draft  
**Date:** 2026-04-21  
**Primary audiences:** organizational leaders, product managers, engineering leads, software developers, prompt engineers, MLOps, clinical reviewers, security/compliance teams, and coding agents  
**Document purpose:** define the functional, technical, operational, and governance requirements for a production-grade application that accepts a human disease or condition and produces a medically accurate, narratively rich, panel-by-panel comic book package suitable for professional rendering and publication.

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Vision and Product Thesis](#2-vision-and-product-thesis)
- [3. Problem Statement](#3-problem-statement)
- [4. Product Goals, Non-Goals, and Success Criteria](#4-product-goals-non-goals-and-success-criteria)
- [5. Guiding Principles](#5-guiding-principles)
- [6. Intended Users and Stakeholders](#6-intended-users-and-stakeholders)
- [7. Product Scope](#7-product-scope)
- [8. High-Level Business and Operating Model](#8-high-level-business-and-operating-model)
- [9. End-to-End User Journeys](#9-end-to-end-user-journeys)
- [10. Functional Requirements Summary](#10-functional-requirements-summary)
- [11. Detailed Content Requirements](#11-detailed-content-requirements)
- [12. Product Features in Detail](#12-product-features-in-detail)
- [12.1 Disease canonicalization and intake](#121-disease-canonicalization-and-intake)
- [12.2 Clinical evidence assembly](#122-clinical-evidence-assembly)
- [12.3 Mystery workbook engine](#123-mystery-workbook-engine)
- [12.4 Scene planner](#124-scene-planner)
- [12.5 Panel director](#125-panel-director)
- [12.6 Dialogue and lettering engine](#126-dialogue-and-lettering-engine)
- [12.7 Render prompt engine](#127-render-prompt-engine)
- [12.8 QA and review console](#128-qa-and-review-console)
- [12.9 Export system](#129-export-system)
- [13. Functional Requirement Catalog](#13-functional-requirement-catalog)
- [14. Narrative System Specification](#14-narrative-system-specification)
- [15. Medical Content System Specification](#15-medical-content-system-specification)
- [16. Panelization and Visual Storytelling Specification](#16-panelization-and-visual-storytelling-specification)
- [17. Rendering Strategy and Image Model Constraints](#17-rendering-strategy-and-image-model-constraints)
- [18. Human Review and Editorial Workflow](#18-human-review-and-editorial-workflow)
- [19. Multi-Agent System Architecture](#19-multi-agent-system-architecture)
- [20. Detailed Agent Specifications](#20-detailed-agent-specifications)
- [21. Orchestration and Workflow Engine](#21-orchestration-and-workflow-engine)
- [22. System Architecture](#22-system-architecture)
- [23. Suggested Technology Stack](#23-suggested-technology-stack)
- [24. Data Model](#24-data-model)
- [25. API Design](#25-api-design)
- [26. UI / UX Requirements](#26-ui--ux-requirements)
- [27. Retrieval, Knowledge, and Source Governance](#27-retrieval-knowledge-and-source-governance)
- [28. Quality Assurance and Evaluation Framework](#28-quality-assurance-and-evaluation-framework)
- [29. Security, Privacy, and Compliance](#29-security-privacy-and-compliance)
- [30. Interoperability and Enterprise Integration](#30-interoperability-and-enterprise-integration)
- [31. Model and Prompt Management](#31-model-and-prompt-management)
- [32. Repository and Codebase Design for Real Developers and Coding Agents](#32-repository-and-codebase-design-for-real-developers-and-coding-agents)
- [33. DevSecOps, CI/CD, and Environment Strategy](#33-devsecops-cicd-and-environment-strategy)
- [34. Performance, Scalability, Reliability, and Cost](#34-performance-scalability-reliability-and-cost)
- [35. Observability and Analytics](#35-observability-and-analytics)
- [36. Governance and Editorial Operations](#36-governance-and-editorial-operations)
- [37. Staffing Plan and Organizational Readiness](#37-staffing-plan-and-organizational-readiness)
- [38. Risks and Mitigations](#38-risks-and-mitigations)
- [39. Release Plan](#39-release-plan)
- [40. Acceptance Criteria for “Production Ready”](#40-acceptance-criteria-for-production-ready)
- [41. Example End-to-End Artifact Bundle](#41-example-end-to-end-artifact-bundle)
- [42. Recommendations for First Build Order](#42-recommendations-for-first-build-order)
- [43. Final Strategic Recommendation](#43-final-strategic-recommendation)
- [44. External References Informing Architecture Assumptions](#44-external-references-informing-architecture-assumptions)
- [45. Normative Language and Requirement Traceability](#45-normative-language-and-requirement-traceability)
- [46. Non-Functional Requirement Catalog](#46-non-functional-requirement-catalog)
- [47. Service-Level Objectives and Error Budgets](#47-service-level-objectives-and-error-budgets)
- [48. Role and Permission Model](#48-role-and-permission-model)
- [49. Example Workflow Pseudocode](#49-example-workflow-pseudocode)
- [50. Event Schema Example](#50-event-schema-example)
- [51. Prompt Registry Contract](#51-prompt-registry-contract)
- [52. Data Retention, Archiving, and Deletion](#52-data-retention-archiving-and-deletion)
- [53. Disaster Recovery and Business Continuity](#53-disaster-recovery-and-business-continuity)
- [54. Abuse Prevention and Safety Controls](#54-abuse-prevention-and-safety-controls)
- [55. Evaluation Formula Example](#55-evaluation-formula-example)
- [56. Sample Test Strategy](#56-sample-test-strategy)
- [57. Build vs Buy Guidance](#57-build-vs-buy-guidance)
- [58. Commercial Readiness Checklist](#58-commercial-readiness-checklist)
- [59. Immediate Next Artifacts Recommended](#59-immediate-next-artifacts-recommended)
- [60. Closing Note](#60-closing-note)

---



## 1. Executive Summary

This platform is not a single “prompt app.” It is a full content-generation system with editorial safeguards. The product shall take a disease or condition as input and produce a complete comic-production package featuring two recurring alien detectives who investigate a patient case, enter the body, discover the mechanisms of disease from the inside, solve the mystery, and resolve the climax through treatment. The application must satisfy four standards simultaneously:

1. **Clinical standard:** provider-level medical accuracy, traceable evidence, and safe educational framing.
2. **Narrative standard:** a real mystery story with fair clues, reversals, escalating stakes, humor, whimsy, and emotionally satisfying resolution.
3. **Visual standard:** a page- and panel-level plan that is readable as comics storytelling and suitable for downstream image generation.
4. **Operational standard:** commercial-grade reliability, auditability, security, governance, observability, and extensibility.

The system shall be architected as a multi-stage, multi-agent pipeline with hard validation gates. A single giant prompt is explicitly out of scope as the core production method. Instead, the platform shall build a canonical disease packet, derive a clue ladder, construct a mystery workbook, generate scenes, expand those scenes into panel plans, create render-specific prompts, and pass every stage through medical, continuity, and production QA. Human review must be supported as a first-class workflow, not as an afterthought.

This specification is written to be implementable by:
- executive and operating leaders who need budget, risk, sequencing, and staffing clarity,
- product managers who need scope boundaries and acceptance criteria,
- developers and architects who need service boundaries, schemas, APIs, and deployment guidance,
- coding agents such as Codex that benefit from explicit structure, contracts, and normative requirements.

---

## 2. Vision and Product Thesis

### 2.1 Product vision

Create a franchise-scale educational storytelling platform that turns diseases into **fair mysteries with clinical truth**. Every generated comic should make clinicians trust the medicine, readers enjoy the story, and artists or image pipelines understand exactly what every panel must depict.

### 2.2 Product thesis

Medical education often fails because it begins with labels and terminology instead of observation, tension, and mechanism. This product reverses that order. It makes the learner feel what clinicians do in real practice: uncertainty first, clues next, synthesis last. The alien detectives function as a narrative bridge. Their outsider perspective allows readers to discover human physiology and pathology at the same time, turning ignorance into suspense rather than embarrassment.

### 2.3 Commercial thesis

A commercial product in this space can serve several markets:
- physician educators and medical schools,
- health systems creating patient or trainee education content,
- publishers and edtech companies,
- medical societies and board-prep providers,
- life sciences companies creating disease-mechanism education,
- creators building premium educational entertainment.

The platform should therefore be designed as a **B2B / B2B2C content operating system** with multi-tenant controls, review workflows, and export capabilities.

---

## 3. Problem Statement

The product must solve the following problems at once:

1. **Narrative problem:** educational content about disease is often dry, repetitive, and front-loads the answer.
2. **Medical problem:** generative systems often hallucinate or oversimplify clinically important details.
3. **Production problem:** prose summaries do not convert cleanly into panelized visual storytelling.
4. **Consistency problem:** recurring characters, franchise rules, and panel-level continuity are difficult to preserve across many generated stories.
5. **Commercial problem:** promising prototypes fail when they lack governance, traceability, security, and operational rigor.

The platform must therefore be capable of generating novelty without losing canon, making medicine dramatic without making it false, and scaling output without collapsing into template sameness.

---

## 4. Product Goals, Non-Goals, and Success Criteria

### 4.1 Primary goals

The product shall:
- accept a disease or condition and optional generation constraints,
- generate a medically accurate, mystery-driven comic production package,
- preserve recurring character canon and required story structure,
- produce page and panel descriptions optimized for image rendering,
- maintain evidence traceability for medically meaningful claims,
- support iterative human review and partial regeneration,
- provide enterprise-grade security, audit logging, and role-based workflow.

### 4.2 Secondary goals

The product should:
- support multiple audience tiers,
- support portfolio-scale generation across many diseases,
- support export into downstream rendering and publishing workflows,
- support analytics on story quality, medical quality, and cost.

### 4.3 Non-goals for initial production release

The first commercial production version should **not** be positioned as:
- a tool for diagnosing real patients,
- a substitute for clinician judgment,
- an autonomous bedside clinical decision support system,
- a fully automated publisher with zero human review,
- a universal EHR-integrated diagnosis assistant.

### 4.4 Success criteria

The product shall be considered successful when:
- clinicians judge the medical content as publication-ready with only minor edits,
- generated stories are rated as genuinely engaging mystery stories,
- panel descriptions can drive a rendering pipeline with low rework,
- outputs pass traceability and QA checks consistently,
- enterprise customers can configure role-based approvals and retain audit logs,
- the system can generate hundreds to thousands of cases without severe novelty collapse.

---

## 5. Guiding Principles

1. **Truth before cleverness.** Narrative devices must never override medical truth.
2. **Discovery before naming.** Findings should appear before labels whenever possible.
3. **Mechanism before memorization.** The story should teach why, not just what.
4. **Treatment is action.** Therapeutics must function as the final act, not an appendix.
5. **Every panel earns its place.** No filler, no flipbook repetition.
6. **Canon with variation.** Same franchise, different stories.
7. **Auditability by design.** Every clinically meaningful statement should be traceable.
8. **Humans remain in the loop.** Clinical and editorial review must remain first-class.
9. **Model-agnostic architecture.** Do not couple business logic to a single model vendor.
10. **PHI minimization.** Default workflow should not require patient-identifiable data.

---

## 6. Intended Users and Stakeholders

### 6.1 Core user personas

**A. Medical educator / physician author**  
Needs: medically accurate stories, editable outputs, evidence traceability, curriculum alignment, exportable teaching assets.

**B. Clinical reviewer**  
Needs: precise fact checking, source traceability, comment workflow, approval controls, change diffs.

**C. Story editor / franchise lead**  
Needs: tone consistency, character continuity, novelty protection, control over pacing and reveal order.

**D. Art director / prompt engineer**  
Needs: clean panel specs, continuity anchors, render prompt control, separate lettering plans, consistent character bibles.

**E. Product / operations manager**  
Needs: throughput metrics, cost predictability, approval SLAs, portfolio tracking, incident logs.

**F. Enterprise buyer / organizational leader**  
Needs: risk boundaries, security posture, deployment options, governance, ROI clarity, roadmap credibility.

### 6.2 Internal platform stakeholders

- Product management
- Engineering
- Clinical content board
- Security/compliance
- Design
- MLOps / platform engineering
- QA / evaluation team
- Customer success
- Legal / licensing

---

## 7. Product Scope

### 7.1 In scope

The production-ready platform shall cover:
- disease input and canonicalization,
- clinical knowledge assembly,
- mystery plot generation,
- scene generation,
- page/panel planning,
- render prompt generation,
- dialogue and caption generation,
- medical QA,
- continuity QA,
- human review/approval workflows,
- export and asset packaging,
- tenant administration,
- observability and analytics.

### 7.2 Optional enterprise modules

These may be included in later phases or enterprise plans:
- PHI-ready case ingestion,
- EHR launch and context import,
- institution-specific style guides,
- collaborative writer room workflows,
- multilingual generation,
- publication CMS integration,
- rights management and licensing rules.

### 7.3 Explicitly out of scope for v1

- autonomous diagnosis of real patients,
- treatment recommendations for live care,
- fully automatic release without human approval,
- direct image generation in the same transaction path as story creation,
- unrestricted user-uploaded patient records without compliance controls.

---

## 8. High-Level Business and Operating Model

### 8.1 Product packaging

Recommended packaging:
- **Creator / Studio tier:** disease-name input, no PHI, exportable scripts/panel plans.
- **Team / Editorial tier:** collaboration, approvals, asset library, brand/style controls.
- **Enterprise / Health System tier:** SSO, audit, custom deployment, private knowledge packs, optional secure integrations.

### 8.2 Revenue models

Possible models:
- per-seat plus generation credits,
- subscription with monthly generation quotas,
- enterprise annual license,
- premium clinical review services,
- API usage for publishers and edtech vendors.

### 8.3 Operating model assumptions

A serious commercial product will require:
- a clinical editorial board,
- structured content governance,
- a secure software development lifecycle,
- runtime cost controls,
- customer support and incident response.

---

## 9. End-to-End User Journeys

### 9.1 Journey A: Standard disease-to-comic generation

1. User enters disease name and optional generation constraints.
2. System canonicalizes disease and retrieves clinical knowledge.
3. System builds disease packet and clue ladder.
4. Story architecture agent generates mystery workbook.
5. User optionally reviews or edits workbook.
6. System generates scene outline.
7. System expands scenes to pages and panels.
8. System generates render prompts and lettering map.
9. QA services score medical accuracy, continuity, and narrative integrity.
10. User reviews flagged issues.
11. User approves export package.
12. Assets are exported to rendering pipeline and publication workspace.

### 9.2 Journey B: Editorial revision

1. Editor opens generated project.
2. Editor sees disease facts, story workbook, scene list, panel grid, and QA report.
3. Editor requests selective regeneration (for example: opening scene, reveal, treatment climax, page 12 panels 2-4).
4. System re-runs only impacted stages, preserving unaffected content.
5. Diff viewer shows semantic and textual changes.
6. Reviewer re-approves.

### 9.3 Journey C: Clinical review

1. Clinician opens project in review mode.
2. Sidebar shows every medically meaningful statement with evidence links.
3. Reviewer comments inline or marks hard errors.
4. System blocks release until all severity-1 and severity-2 issues are resolved.
5. Final approval signature is stored with audit metadata.

### 9.4 Journey D: Enterprise secure workflow (future/optional)

1. Authorized user launches app from EHR or secure portal.
2. De-identified or minimum-necessary case context is imported.
3. System uses institutional guardrails and style packs.
4. Review and export remain within tenant boundary.
5. Audit logs and retention policies apply.

---

## 10. Functional Requirements Summary

This section states the top-level product requirements. Detailed technical implementations appear later.

### 10.1 Input and project setup requirements

- The system shall accept a disease or condition as minimum input.
- The system shall support aliases, synonyms, and common abbreviations.
- The system shall support optional constraints: audience, length, humor level, mystery intensity, art style, educational focus, treatment depth, and diagnostic complexity.
- The system shall create a unique project record for every generation run.
- The system shall preserve all inputs, versions, agent outputs, and review actions in project history.

### 10.2 Disease knowledge requirements

- The system shall construct a structured disease packet before story generation begins.
- The disease packet shall include symptoms, signs, pathophysiology, diagnostics, management, patient experience, complications, and mechanisms of action of therapy.
- The system shall distinguish common, atypical, suggestive, confirmatory, and rare-but-important findings.
- The disease packet shall be traceable to sources and versioned.

### 10.3 Story generation requirements

- The system shall enforce the recurring franchise invariants.
- The system shall generate a strong mystery workbook before writing scenes.
- The diagnosis shall not be revealed prematurely.
- The story shall include fair clues, at least one reversal, escalation, reveal, treatment climax, and a closing callback to the opener.
- The system shall vary openings, red herrings, twists, entry routes, and treatment metaphors across stories.

### 10.4 Panelization requirements

- The system shall generate page and panel plans from scenes.
- Each panel shall have a clear purpose.
- The system shall prevent redundant adjacent panels unless repetition is intentional for comedic, dramatic, or explanatory effect.
- The system shall preserve spatial clarity across scale transitions (patient room -> body entry -> organ -> tissue -> cell -> molecule).

### 10.5 Render preparation requirements

- The system shall generate art prompts separately from dialogue/captions/labels.
- The system shall maintain a character bible for recurring detectives and recurring props/devices.
- The system shall generate negative prompts and continuity anchors where relevant.
- The system shall optimize panel descriptions for image generation accuracy and visual consistency.

### 10.6 Review and QA requirements

- Every project shall pass medical QA before final export.
- Every project shall pass continuity and panel economy QA before final export.
- Users shall be able to regenerate selectively.
- The system shall provide human-readable QA rationales.

### 10.7 Administration requirements

- The platform shall support organizations, users, teams, roles, and permissions.
- The platform shall support audit logs, project ownership, export history, and retention settings.
- Enterprise tenants shall have isolation guarantees and configurable integrations.

---

## 11. Detailed Content Requirements

### 11.1 Franchise story invariants

Every generated comic shall include all of the following:
1. a playful opening with a side plot or tonal hook,
2. a scene where a doctor reaches out for help,
3. a presenting complaint scene that is clinically fair but not immediately diagnostic,
4. a planning scene,
5. a shrinking-entry sequence into the patient,
6. an investigation arc revealing anatomy, physiology, and pathology through clues,
7. a grand reveal integrating all evidence,
8. a treatment-driven action climax,
9. a wrap-up that echoes the opening.

### 11.2 Story quality requirements

Every story shall also:
- be action-forward rather than static,
- be funny and whimsical without becoming frivolous,
- contain genuine mystery logic rather than only exposition,
- include at least one meaningful twist or reinterpretation of evidence,
- maintain emotional coherence with the patient’s experience.

### 11.3 Educational quality requirements

Every story shall:
- reveal clinical terms after visual or mechanistic discovery when possible,
- connect symptoms to mechanism,
- connect tests to what they measure,
- connect treatment to mechanism of action,
- leave the reader with a coherent, clinician-level mental model.

### 11.4 Distinctiveness requirements

The system shall maintain a novelty ledger across prior stories and avoid excessive reuse of:
- opening gags,
- clue sequences,
- reveal structures,
- settings,
- action choreography,
- running jokes,
- villain metaphors,
- treatment climax metaphors.

---

## 12. Product Features in Detail

## 12.1 Disease canonicalization and intake

The intake subsystem shall:
- accept disease name, synonym, or colloquial descriptor,
- resolve to a canonical concept identifier,
- display ambiguity if multiple diseases match,
- allow a user to confirm or override,
- assign a disease class (infectious, oncologic, autoimmune, metabolic, neurologic, etc.),
- determine likely scales of explanation (organ-centric, molecular, immune, vascular, genetic, etc.),
- determine whether additional review intensity is needed (for example: high-risk oncology, rare disease, pediatric content, pregnancy-related conditions).

Outputs:
- `canonical_disease`
- `disease_class`
- `scope_profile`
- `risk_profile`
- `generation_brief`

## 12.2 Clinical evidence assembly

The clinical assembly subsystem shall:
- gather and normalize disease knowledge,
- de-duplicate facts,
- identify contradictions,
- rank evidence importance,
- build a chronology of disease progression,
- identify visual anchors and clinically meaningful sites of investigation,
- produce a structured evidence graph.

Outputs:
- `disease_packet`
- `fact_table`
- `evidence_graph`
- `clinical_teaching_points`
- `visual_anchor_catalog`

## 12.3 Mystery workbook engine

The story architect subsystem shall generate a mandatory workbook including:
- case question,
- surface mystery,
- hidden disease engine,
- stakes,
- opening side plot,
- initial differentials,
- clue ladder,
- red herrings,
- midpoint reversal,
- escalation beat,
- reveal chain,
- treatment showdown,
- callback ending,
- teaching objectives,
- spoiler controls.

The workbook must be approved internally before scene writing begins.

## 12.4 Scene planner

The scene planner shall:
- translate workbook beats into scenes,
- assign each scene a dramatic function and teaching objective,
- track time, setting, and body scale,
- set entry and exit states for continuity,
- estimate page and panel budget,
- flag scenes that are too static, too dense, or too repetitive.

## 12.5 Panel director

The panel director shall:
- break each scene into beats and panels,
- assign camera framing, subject emphasis, action phase, and clue value,
- ensure progression rather than repetition,
- maintain spatial clarity and body geography,
- mark candidate splash pages, reveal pages, and rapid-action sequences.

## 12.6 Dialogue and lettering engine

The dialogue subsystem shall:
- preserve distinct character voices,
- keep balloons readable,
- avoid exposition overload,
- support staged reveal of terminology,
- separate narrative captions from art prompts,
- generate optional clinician-note sidebars for educational editions.

## 12.7 Render prompt engine

The render subsystem shall:
- convert panel specs into image-generation-ready prompts,
- include continuity anchors,
- use style and composition descriptors,
- separate art instructions from lettering,
- add negative prompts,
- support per-panel aspect ratio and image count,
- support retries and alternate formulations if initial renderability confidence is low.

## 12.8 QA and review console

The platform shall include:
- medical QA dashboard,
- narrative QA dashboard,
- continuity QA dashboard,
- prompt/render readiness dashboard,
- approval queue,
- issue severity levels,
- comment threads,
- selective regeneration tools,
- diff view across versions.

## 12.9 Export system

The platform shall export:
- full project dossier in human-readable form,
- structured JSON package,
- scene cards,
- page/panel plans,
- render prompts,
- lettering map,
- source evidence pack,
- QA report,
- optionally CSV/JSON for batch rendering.

---

## 13. Functional Requirement Catalog

This catalog uses MUST/SHOULD/MAY language. “Must” items are required for production launch unless explicitly deferred.

### 13.1 Intake and project management

**FR-INT-001** The system MUST accept a disease or condition string as primary input.  
**FR-INT-002** The system MUST preserve the original user-entered input and the canonicalized disease separately.  
**FR-INT-003** The system MUST support additional generation parameters without requiring them.  
**FR-INT-004** The system MUST create immutable project versions for each major generation event.  
**FR-INT-005** The system SHOULD allow a user to branch a project into alternate story directions.  
**FR-INT-006** The system MUST support project status states: draft, generating, review-required, approved, exported, archived.

### 13.2 Disease and evidence modeling

**FR-EVD-001** The system MUST build a disease packet before generating scenes.  
**FR-EVD-002** The disease packet MUST include evidence traceability for medically meaningful claims.  
**FR-EVD-003** The system MUST mark contradictory or uncertain evidence.  
**FR-EVD-004** The system SHOULD score evidence confidence and freshness.  
**FR-EVD-005** The system MUST identify clinically relevant scales of explanation.  
**FR-EVD-006** The system MUST generate a patient-experience timeline.

### 13.3 Story architecture

**FR-STY-001** The system MUST enforce all recurring franchise invariants.  
**FR-STY-002** The system MUST generate a mystery workbook prior to scene generation.  
**FR-STY-003** The system MUST prevent explicit diagnosis naming before the reveal stage unless the disease inherently requires early naming for coherence.  
**FR-STY-004** The system MUST include at least one red herring or fair alternate interpretation unless explicitly disabled.  
**FR-STY-005** The system MUST make treatment part of the climax.  
**FR-STY-006** The system SHOULD expose “why this clue appears now” reasoning to reviewers.  
**FR-STY-007** The system MUST support selective regeneration at workbook, scene, and panel levels.

### 13.4 Scene and panel planning

**FR-PNL-001** The system MUST break scenes into panels with explicit story purpose.  
**FR-PNL-002** Each panel MUST include location, scale, characters, action, clue state, framing, mood, and render prompt metadata.  
**FR-PNL-003** The system MUST detect likely adjacent panel redundancy.  
**FR-PNL-004** The system MUST preserve continuity of character placement, props, injuries, lab specimens, and body route.  
**FR-PNL-005** The system SHOULD recommend page turns and splash pages.  
**FR-PNL-006** The system MUST support a page budget or panel budget constraint.

### 13.5 Rendering preparation

**FR-RND-001** The system MUST output art prompts separately from dialogue and captions.  
**FR-RND-002** The system MUST maintain reusable character and asset bibles.  
**FR-RND-003** The system MUST support negative prompts and exclusions.  
**FR-RND-004** The system SHOULD support multiple render-target profiles if the image model changes.  
**FR-RND-005** The system MUST label panels that are high-risk for poor renderability and suggest simplifications.

### 13.6 Review, approval, and audit

**FR-RVW-001** The system MUST block export when high-severity medical QA issues remain unresolved.  
**FR-RVW-002** The system MUST store reviewer identity, timestamps, diffs, and decisions.  
**FR-RVW-003** The system MUST support inline comments and project-level notes.  
**FR-RVW-004** The system SHOULD support compare views between generations.  
**FR-RVW-005** The system MUST retain an audit trail suitable for enterprise review.

### 13.7 Administration

**FR-ADM-001** The platform MUST support organizations, tenants, users, teams, and roles.  
**FR-ADM-002** The platform MUST support SSO for enterprise customers.  
**FR-ADM-003** The platform SHOULD support configurable approval workflows by tenant.  
**FR-ADM-004** The platform MUST support usage metering and billing events.  
**FR-ADM-005** The platform MUST support retention and export policies.

---

## 14. Narrative System Specification

### 14.1 Narrative architecture

The system should treat each comic as having three intertwined structures:

1. **Case structure** — patient problem, symptoms, workup, diagnosis, treatment.
2. **Mystery structure** — unknown culprit, clues, false leads, revelation.
3. **Adventure structure** — alien detectives, body exploration, action sequences, escalating danger.

All three structures must align. For example, if the disease is an immune-mediated disorder, the adventure arc should naturally move through immune cell behavior, tissue injury, and consequences, rather than forcing a generic chase scene.

### 14.2 Mystery fairness standard

A generated story is “fair” only if:
- the major clues appear before the reveal,
- the reader could plausibly re-interpret earlier scenes after the reveal,
- the solution is not hidden behind an arbitrary fact never introduced,
- red herrings are plausible but not deceitful.

### 14.3 Tone management

Tone must balance:
- whimsy,
- suspense,
- respect for illness,
- wonder at physiology,
- clarity during explanation,
- emotional landing at resolution.

The platform shall include tone constraints so that comedy does not trivialize suffering or death, especially in oncology, pediatrics, pregnancy, severe neurologic disease, or terminal illness.

### 14.4 Detective characterization

The two alien detectives must have:
- stable names and appearance descriptors (configurable by franchise owner),
- distinct reasoning styles,
- distinct comedic rhythms,
- repeatable speech patterns and emotional tendencies,
- stable device toolkit and investigative methodology.

One detective may skew impulsive, imaginative, visual, or intuitive; the other may skew methodical, skeptical, or analytical. The platform shall not flatten them into interchangeable exposition vessels.

---

## 15. Medical Content System Specification

### 15.1 Disease packet schema

Each disease packet shall include:

- canonical identifier
- synonyms and aliases
- definition
- disease class
- relevant anatomy
- baseline physiology
- pathophysiology chain
- risk factors
- epidemiologic notes where instructionally relevant
- common presentations
- atypical presentations
- temporal progression
- exam findings
- laboratory features
- imaging features
- pathology/histology
- differential diagnoses
- definitive/confirmatory features
- severity/staging, if applicable
- complications
- management options
- mechanism of treatment
- patient lived experience
- clinician pitfalls and diagnostic traps
- visual anchors
- prohibited simplifications
- evidence sources and confidence

### 15.2 Medical reasoning requirements

The clinical reasoning layer shall:
- identify what the patient feels before clinicians know why,
- map symptoms to mechanism,
- map tests to what they detect,
- map treatments to what they interrupt or reverse,
- distinguish correlation from causation,
- surface common misdiagnoses and missed clues.

### 15.3 Time-scale modeling

The system shall explicitly model disease time scale:
- hyperacute,
- acute,
- subacute,
- chronic,
- relapsing-remitting,
- progressive,
- episodic,
- treatment-responsive,
- treatment-resistant,
- terminal/complicated.

This time-scale model must influence plot structure. A stroke, asthma exacerbation, autoimmune disease, cancer, and inherited metabolic disorder should not have the same pacing.

### 15.4 Multi-scale depiction

The app must decide which scales are most pedagogically and visually important:
- patient experience
- bedside / clinic
- organ system
- tissue microenvironment
- cellular actors
- molecular signals
- therapeutic intervention

Not every disease requires the same level of molecular detail. The system must choose the minimum scale necessary for faithful explanation.

### 15.5 Clinical source governance

All medically meaningful output must be grounded in curated sources, internally approved datasets, or reviewed knowledge packs. Unverified model improvisation is not acceptable for clinical claims.

The platform should maintain:
- source metadata,
- source freshness,
- source hierarchy,
- contradiction notes,
- reviewer overrides,
- per-tenant preferred source policies.

---

## 16. Panelization and Visual Storytelling Specification

### 16.1 Panel purpose taxonomy

Each panel shall be tagged with one or more of:
- establish setting,
- advance action,
- reveal clue,
- explain mechanism,
- show reaction,
- orient scale/location,
- introduce red herring,
- escalate danger,
- deliver humor beat,
- resolve tension,
- recap logic.

### 16.2 Panel anti-patterns

The panel planner must detect and avoid:
- same camera distance repeated without new information,
- redundant reaction shots,
- repeated “walking through vessel” panels with no new clue,
- exposition panels that visually do nothing,
- abrupt scale jumps without orientation,
- overstuffed panels with too many simultaneous ideas,
- scenes that are effectively prose paragraphs chopped into rectangles.

### 16.3 Scale transition rules

When moving between scales, the system shall include orientation panels or cues. Examples:
- patient room -> shrinking chamber -> bloodstream entry,
- bloodstream -> organ vasculature -> tissue interstitium,
- tissue -> cell membrane -> intracellular pathway,
- bedside lab report -> internal molecular counterpart.

### 16.4 Visual continuity rules

The platform shall maintain continuity of:
- detective appearance and attire,
- gadgets and portal device,
- evidence objects,
- environment damage,
- clothing and lab coats in external scenes,
- patient demographics and physical presentation (if depicted),
- disease markers after discovery,
- treatment effects over time.

### 16.5 Teaching visuals

The system should include “beautifully explanatory” panels, such as:
- cross-section views,
- comparative healthy-vs-pathologic reveals,
- magnified clue panels,
- dynamic mechanism panels,
- synchronized bedside/internal panels.

---

## 17. Rendering Strategy and Image Model Constraints

### 17.1 Rendering approach

The product should treat image generation as a **downstream production stage** rather than the source of truth. The upstream pipeline must resolve story, medicine, composition, and continuity first.

### 17.2 Current model assumptions (as of April 2026)

The default product path now ends at a compiled rendering guide rather than in-app provider execution. External tools may still be used downstream, so the platform keeps prompt-fitting guidance for currently relevant targets. Google documents Nano Banana 2 as Gemini 3.1 Flash Image Preview, the high-efficiency counterpart to Gemini 3 Pro Image, optimized for speed and high-volume image generation. Google’s developer guide lists it as a preview model with a 128k input / 32k output context window and a January 2025 knowledge cutoff. Google’s model card states that it can support clear text and localized text rendering in some use cases, but also notes limitations with small text, long paragraphs, character consistency, and occasional left/right spatial confusion. These facts mean the system should preserve a separate lettering and continuity layer, avoid depending on the model to invent or remember medical truth, and emit provider-fitted prompt blocks inside the rendering guide instead of treating provider execution as the source of truth. [R1][R2][R3]

### 17.3 Practical render requirements derived from model behavior

Because current official guidance says the model can generate legible text in some formats but struggles with small text and long paragraphs, the platform shall:
- treat speech balloons and teaching captions as separate overlay assets by default,
- avoid asking the image model to embed dense educational text,
- generate panel art with either no text or only minimal nonessential diegetic text,
- use structured panel inputs and continuity anchors instead of long free-form story dumps.

Because the model card notes imperfect character consistency and occasional spatial confusion, the platform shall:
- maintain locked character sheets,
- include explicit subject counts and identity anchors,
- favor one panel per request over batch narrative prompts for important pages,
- run continuity QA after art generation. [R2][R4]

### 17.4 Prompt engineering requirements

The render subsystem shall:
- use concise but specific prompt templates,
- preserve hierarchy of content: subject -> action -> setting -> composition -> style -> exclusions,
- avoid ambiguous directional language unless anchored by composition,
- support alternate prompt strategies for failed renders,
- store prompt template versions and output quality metrics.

### 17.5 Render target abstraction

Even if Nano Banana 2 is an initial external image target, the application must abstract rendering so that another model can be swapped in later with minimal business-logic change, and so that the rendering guide remains the stable handoff contract regardless of which external tool is used.

The render target profile should include:
- input limits,
- supported aspect ratios,
- text rendering characteristics,
- consistency strengths/weaknesses,
- moderation behavior,
- latency targets,
- cost per image,
- retry policy.

---

## 18. Human Review and Editorial Workflow

### 18.1 Review stages

Minimum review stages:
1. Workbook review
2. Medical review
3. Scene/panel review
4. Final export review

### 18.2 Reviewer roles

- **Clinical reviewer:** approves factual correctness.
- **Story editor:** approves mystery quality, tone, pacing.
- **Art/prompt reviewer:** approves panel clarity and render readiness.
- **Compliance/admin reviewer:** for enterprise or PHI-enabled flows.

### 18.3 Review UX requirements

The interface shall provide:
- side-by-side evidence and output,
- severity levels,
- inline comments,
- change requests,
- regenerate buttons at section/page/panel granularity,
- approval signature capture,
- history and diffing.

### 18.4 Release gate

A project MUST NOT reach final export if:
- any severity-1 medical issue is open,
- there is no evidence trace for a clinically material claim,
- the panel plan contains unresolved continuity errors of severity 1 or 2,
- the treatment depiction materially misrepresents mechanism or standard care.

---

## 19. Multi-Agent System Architecture

### 19.1 Why multi-agent

A production-grade system must decompose the task. The application needs different reasoning modes:
- taxonomic normalization,
- evidence retrieval,
- clinical synthesis,
- mystery construction,
- franchise voice management,
- page/panel planning,
- render prompt generation,
- QA.

One model turn is insufficiently controllable and insufficiently auditable for this requirement set.

### 19.2 Agent roster

Recommended agents:

1. Input Canonicalization Agent
2. Clinical Retrieval Agent
3. Clinical Synthesis Agent
4. Differential and Clue Agent
5. Pedagogy Agent
6. Story Architect Agent
7. Franchise Canon Agent
8. Novelty Agent
9. Scene Planner Agent
10. Panel Director Agent
11. Dialogue Agent
12. Render Prompt Agent
13. Medical QA Agent
14. Continuity QA Agent
15. Release Gate Agent
16. Export Assembly Agent

### 19.3 Agent interface contract

Every agent must declare:
- name
- version
- inputs
- outputs
- dependencies
- prompt template version
- tool permissions
- expected schema
- acceptance criteria
- retry policy
- failure classes
- trace metadata

### 19.4 Agent governance rules

- Agents shall not silently invent missing required fields.
- Agents shall return structured output against a schema.
- Agent outputs shall be validated before downstream use.
- Downstream agents may enrich but must not overwrite validated clinical facts without explicit diff and re-review.
- All agent decisions shall be attributable to a run ID.

---

## 20. Detailed Agent Specifications

### 20.1 Input Canonicalization Agent

**Purpose:** normalize disease input and determine scope.  
**Inputs:** raw disease string, optional constraints.  
**Tools:** medical terminology resolver, alias map, curated ontology.  
**Outputs:** canonical concept, disease class, ambiguity flags, scope profile.  
**Acceptance criteria:** canonical mapping confidence above threshold or explicit ambiguity state.  
**Failure modes:** ambiguous acronym, misspelling, overly broad syndrome label.

### 20.2 Clinical Retrieval Agent

**Purpose:** assemble source-backed facts.  
**Inputs:** canonical disease.  
**Tools:** curated medical corpus, search/grounding, internal source registry.  
**Outputs:** normalized fact list, source list, freshness score.  
**Acceptance criteria:** required disease packet sections populated or explicitly marked unavailable.  
**Failure modes:** conflicting guidelines, sparse rare-disease evidence, outdated sources.

### 20.3 Clinical Synthesis Agent

**Purpose:** convert retrieved facts into a coherent disease packet and mechanistic chain.  
**Inputs:** fact list, source metadata.  
**Outputs:** disease packet, chronology, complication graph, treatment mechanism map.  
**Acceptance criteria:** internal logical consistency and evidence trace completeness.

### 20.4 Differential and Clue Agent

**Purpose:** derive the fair mystery skeleton.  
**Inputs:** disease packet.  
**Outputs:** presenting complaint variants, differential field, clue ladder, reveal chain, red herrings.  
**Acceptance criteria:** diagnosis is not revealed too early; clue order is fair and pedagogically sound.

### 20.5 Pedagogy Agent

**Purpose:** decide explanation order and jargon timing.  
**Inputs:** disease packet, clue ladder, audience tier.  
**Outputs:** teaching objective map, terms-to-delay list, explanation sequence.  
**Acceptance criteria:** reader can learn physiology and pathology through staged discovery.

### 20.6 Story Architect Agent

**Purpose:** build the mystery/adventure plot.  
**Inputs:** clue ladder, pedagogy map, franchise rules.  
**Outputs:** workbook, opener, side plot, midpoint reversal, climax, ending callback.  
**Acceptance criteria:** complete mystery structure and franchise compliance.

### 20.7 Franchise Canon Agent

**Purpose:** preserve recurring character voice, appearance, devices, and franchise motifs.  
**Inputs:** story workbook, canon bible.  
**Outputs:** canon-compliance annotations, character behavior constraints.  
**Acceptance criteria:** detectives remain distinct and stable.

### 20.8 Novelty Agent

**Purpose:** prevent formula fatigue.  
**Inputs:** current workbook, archive embeddings, prior story metadata.  
**Outputs:** novelty score, collision warnings, alternate suggestions.  
**Acceptance criteria:** similarity below configured thresholds.

### 20.9 Scene Planner Agent

**Purpose:** map workbook beats to scenes.  
**Inputs:** approved workbook.  
**Outputs:** scene cards with dramatic purpose, teaching objective, estimated panels.  
**Acceptance criteria:** all required beats represented; page budget plausible.

### 20.10 Panel Director Agent

**Purpose:** convert scenes to page/panel plan.  
**Inputs:** scene cards, canon constraints, visual anchors.  
**Outputs:** panel specs, page structure, composition notes.  
**Acceptance criteria:** panel economy, continuity, scale readability.

### 20.11 Dialogue Agent

**Purpose:** create dialogue, captions, and labels.  
**Inputs:** panel specs, character voice bible, pedagogy map.  
**Outputs:** lettering map, dialogue script, caption script.  
**Acceptance criteria:** readable balloon density, distinct voice, no spoilery labels too early.

### 20.12 Render Prompt Agent

**Purpose:** create image-model-ready prompts.  
**Inputs:** panel specs, art style profile, character bible.  
**Outputs:** render prompts, negative prompts, continuity anchors.  
**Acceptance criteria:** prompt completeness and renderability score above threshold.

### 20.13 Medical QA Agent

**Purpose:** validate medical truth.  
**Inputs:** disease packet, scenes, panels, dialogue.  
**Outputs:** issue list, severity, evidence gaps, confidence score.  
**Acceptance criteria:** zero severity-1 issues for pass.

### 20.14 Continuity QA Agent

**Purpose:** validate visual and narrative continuity.  
**Inputs:** scene/panel plan, character bible, prompt set.  
**Outputs:** continuity issues, redundancy score, panel economy score.  
**Acceptance criteria:** issues below configured thresholds.

### 20.15 Release Gate Agent

**Purpose:** aggregate QA and determine release state.  
**Inputs:** all QA reports, reviewer decisions.  
**Outputs:** pass/fail, required actions, final checklist.  
**Acceptance criteria:** hard gate policy satisfied.

### 20.16 Export Assembly Agent

**Purpose:** package approved outputs.  
**Inputs:** approved project artifacts.  
**Outputs:** human-readable dossier, JSON bundle, export metadata.  
**Acceptance criteria:** schema-valid export, complete artifact set.

---

## 21. Orchestration and Workflow Engine

### 21.1 Orchestration pattern

The system shall use a **stateful workflow engine** rather than synchronous chained HTTP calls. The workflow engine should support:
- step retries,
- durable execution,
- partial reruns,
- idempotency,
- compensation logic,
- human approval pauses,
- event emission.

Suitable implementation styles include Temporal-style durable workflows or a queue-based orchestrator with explicit state transitions.

### 21.2 Workflow stages

Recommended stages:
1. `PROJECT_CREATED`
2. `DISEASE_CANONICALIZED`
3. `EVIDENCE_ASSEMBLED`
4. `DISEASE_PACKET_READY`
5. `WORKBOOK_READY`
6. `WORKBOOK_APPROVED`
7. `SCENES_READY`
8. `PANELS_READY`
9. `DIALOGUE_READY`
10. `RENDER_PROMPTS_READY`
11. `QA_PENDING`
12. `QA_FAILED` or `QA_PASSED`
13. `REVIEW_PENDING`
14. `APPROVED_FOR_EXPORT`
15. `EXPORTED`

### 21.3 Selective regeneration

The workflow engine MUST support re-running only impacted downstream stages. Examples:
- changing a treatment mechanism invalidates reveal, climax, panel specs, and dialogue after the affected point,
- changing an opening joke should not invalidate clinical evidence,
- fixing one panel’s composition should not require a full story rerun.

### 21.4 Event model

Core events should include:
- `project.created`
- `disease.canonicalized`
- `evidence.packet.created`
- `workbook.created`
- `scene.plan.created`
- `panel.plan.created`
- `qa.issue.raised`
- `review.comment.added`
- `project.approved`
- `export.completed`

---

## 22. System Architecture

### 22.1 Top-level architecture

Recommended major components:

1. **Web application / client**
2. **API gateway / backend-for-frontend**
3. **Auth and organization service**
4. **Project service**
5. **Workflow orchestration service**
6. **Agent runtime service**
7. **Knowledge service**
8. **Prompt registry service**
9. **QA / evaluation service**
10. **Rendering preparation service**
11. **Asset storage service**
12. **Analytics and observability service**
13. **Billing / metering service**
14. **Admin/configuration service**

### 22.2 Reference deployment topology

- Web app served via CDN
- Stateless API services in containers
- Durable workflow engine cluster
- Queue / event bus
- Relational database for transactional data
- Object storage for artifacts
- Vector store for retrieval and novelty memory
- Search index for project/discovery
- Secrets manager
- Central log and trace stack
- Metrics / alerting stack
- Optional private inference gateway for enterprise tenants

### 22.3 Suggested service boundaries

**Web app**  
Project UI, review UI, admin UI, generation dashboard, diff views.

**API gateway / BFF**  
Session management, request aggregation, permission checks.

**Project service**  
Project CRUD, versions, statuses, ownership.

**Knowledge service**  
Medical source ingestion, normalization, evidence graph, retrieval APIs.

**Workflow service**  
Long-running orchestration and step state.

**Agent runtime**  
Prompt execution, tool calling, response validation, retries.

**Prompt registry**  
Prompt templates, versions, target-model compatibility.

**QA service**  
Automated evaluations and issue generation.

**Render prep service**  
Panel prompt generation, art package assembly, optional external render job submission.

**Asset service**  
Stores exports, panel JSON, reviewer attachments, rendered images.

**Admin service**  
Tenant settings, style packs, role policies, approval workflows.

---

## 23. Suggested Technology Stack

This section describes a pragmatic reference stack, not a mandatory single-vendor prescription.

### 23.1 Frontend

- React / Next.js or equivalent
- TypeScript
- component library with accessible design system
- real-time updates via WebSocket or SSE for long-running workflows

### 23.2 Backend

- TypeScript (Node.js) or Python for APIs
- Python recommended for knowledge processing, ML tooling, and evaluation pipeline
- gRPC or internal REST between services
- schema validation at service boundaries

### 23.3 Datastores

- PostgreSQL for transactional core data
- Object storage (S3/GCS/Azure Blob) for artifacts and exports
- Vector database for retrieval, novelty memory, and semantic search
- Redis for caching / ephemeral coordination
- Optional graph DB if evidence relationships become complex enough to justify it

### 23.4 Workflow and async processing

- Durable workflow engine or queue-backed orchestration
- Message broker / event streaming for lifecycle events
- worker pools for agent execution and QA

### 23.5 Infrastructure

- Kubernetes or managed container platform
- IaC via Terraform or Pulumi
- secrets in managed KMS-backed vault
- CI/CD with signed artifacts and environment promotion

### 23.6 Observability

- OpenTelemetry traces
- centralized logs
- metrics dashboards
- alerting for latency, cost, failure rate, and QA regressions

### 23.7 Model integration layer

Use a vendor abstraction layer so the system can:
- switch between reasoning models and image models,
- route requests by cost/latency/quality policy,
- apply structured-output schemas consistently,
- capture per-model eval metrics and fallbacks.

---

## 24. Data Model

### 24.1 Core entities

Recommended core entities:

- Organization
- User
- Team
- RoleAssignment
- Project
- ProjectVersion
- GenerationBrief
- DiseaseConcept
- DiseasePacket
- EvidenceFact
- EvidenceSource
- StoryWorkbook
- SceneCard
- PagePlan
- PanelSpec
- DialogueScript
- RenderPrompt
- CharacterBible
- StyleProfile
- QAReport
- ReviewComment
- ApprovalDecision
- ExportBundle
- UsageEvent
- AuditLog

### 24.2 Relational schema sketch

#### `projects`
- id
- organization_id
- created_by
- title
- raw_input_disease
- canonical_disease_id
- status
- current_version_id
- created_at
- updated_at

#### `project_versions`
- id
- project_id
- parent_version_id
- version_number
- generation_config_json
- workflow_state
- created_by
- created_at

#### `disease_packets`
- id
- project_version_id
- canonical_disease_id
- packet_json
- evidence_confidence
- source_set_hash
- approved_by
- approved_at

#### `story_workbooks`
- id
- project_version_id
- workbook_json
- novelty_score
- canon_score
- approved_by
- approved_at

#### `panel_specs`
- id
- project_version_id
- scene_id
- page_number
- panel_number
- spec_json
- continuity_group_id
- renderability_score

#### `qa_reports`
- id
- project_version_id
- qa_type
- report_json
- severity_1_count
- severity_2_count
- pass_fail
- generated_at

### 24.3 JSON schema example: `PanelSpec`

```json
{
  "panel_id": "p12_03",
  "page_number": 12,
  "panel_number": 3,
  "scene_id": "scene_07",
  "story_function": "clue_reveal",
  "beat_goal": "Detectives discover abnormal protein signal accumulating near hepatocyte-like villain cells.",
  "medical_objective": "Introduce biomarker visually before naming it.",
  "location": "liver sinusoid, peri-tumoral region",
  "body_scale": "microvascular to cellular",
  "characters_present": [
    "detective_a",
    "detective_b",
    "tumor_cell_cluster",
    "mysterious_marker_particles"
  ],
  "action_summary": "The detectives hover behind a branching sinusoid wall as glowing particles stream from a malignant cell cluster into the blood.",
  "clue_revealed": "Unexpected secreted marker entering circulation",
  "camera_framing": "medium-wide cinematic shot",
  "camera_angle": "slightly low angle from behind the detectives",
  "composition_notes": "Marker trail forms an S-curve that leads the eye from left foreground to right background cluster.",
  "lighting_mood": "ominous bioluminescent amber against dusky maroon tissue tones",
  "humor_or_tension_note": "Light banter, high suspicion",
  "render_prompt": "Cinematic comic-book panel...",
  "negative_prompt": "no text, no duplicate detectives, no extra limbs, no mislabeled anatomy",
  "overlay_text": {
    "captions": [],
    "dialogue": [],
    "labels": []
  },
  "continuity_anchors": [
    "detective_a teal visor intact",
    "detective_b copper satchel on left hip",
    "portal residue absent",
    "marker particles seen previously only as faint serum sparkles"
  ],
  "acceptance_checks": [
    "anatomy consistent with liver sinusoid",
    "scale transition readable",
    "marker not named yet",
    "no speech balloon exceeds 20 words"
  ]
}
```

### 24.4 Artifact storage policy

All major generated artifacts shall be stored as immutable versioned blobs with metadata:
- prompt template version
- model version
- source hash
- reviewer signatures
- QA scores
- generation timestamps
- tenant and environment

---

## 25. API Design

### 25.1 External product APIs

Representative endpoints:

- `POST /v1/projects`
- `GET /v1/projects/{projectId}`
- `POST /v1/projects/{projectId}/generate`
- `POST /v1/projects/{projectId}/regenerate`
- `GET /v1/projects/{projectId}/versions/{versionId}`
- `GET /v1/projects/{projectId}/workbook`
- `GET /v1/projects/{projectId}/scenes`
- `GET /v1/projects/{projectId}/panels`
- `GET /v1/projects/{projectId}/qa`
- `POST /v1/projects/{projectId}/reviews/comments`
- `POST /v1/projects/{projectId}/approvals`
- `POST /v1/projects/{projectId}/exports`

### 25.2 Example request: create project

```json
POST /v1/projects
{
  "title": "Hepatocellular Carcinoma Case Comic",
  "disease_input": "HCC",
  "generation_profile": {
    "audience": "clinician",
    "panel_budget": 120,
    "humor_level": "medium",
    "mystery_complexity": "high",
    "art_style": "cinematic whimsical sci-fi comic",
    "allow_differential_discussion": true
  }
}
```

### 25.3 Example request: selective regeneration

```json
POST /v1/projects/{projectId}/regenerate
{
  "target": "scene_range",
  "scene_ids": ["scene_01", "scene_02"],
  "reason": "Opening needs stronger humor and better callback setup",
  "preserve": [
    "disease_packet",
    "clue_ladder",
    "diagnosis_reveal_logic"
  ]
}
```

### 25.4 Internal service APIs

Internal services should prefer strongly typed contracts with JSON schema or Protocol Buffers. All requests and responses must carry:
- trace ID
- project ID
- version ID
- tenant ID
- schema version

---

## 26. UI / UX Requirements

### 26.1 Core workspaces

The product shall provide at minimum:

1. **Project Setup**
2. **Evidence Workspace**
3. **Workbook Workspace**
4. **Scene & Page Planner**
5. **Panel Board**
6. **Dialogue / Lettering Editor**
7. **QA Dashboard**
8. **Review / Approval Console**
9. **Export Manager**
10. **Admin Console**

### 26.2 Evidence Workspace requirements

- disease packet viewer
- evidence table
- chronology map
- anatomy/physiology notes
- reviewer comments
- source freshness indicators

### 26.3 Workbook Workspace requirements

- visual display of mystery ladder
- side plot and callback viewer
- red herring controls
- spoiler timing controls
- novelty warnings
- canon compliance warnings

### 26.4 Panel Board requirements

- page thumbnails
- panel cards
- camera/scale metadata
- render prompt preview
- continuity anchors
- issue flags
- per-panel regenerate and edit controls

### 26.5 QA dashboard requirements

- pass/fail status by dimension
- issue severity filters
- drill-down into exact sentence/panel/problem
- evidence-linked correction suggestions
- review assignee and due date

### 26.6 Accessibility

The UI should meet accessible design standards:
- keyboard navigation
- semantic structure
- contrast compliance
- screen-reader-aware controls
- reduced motion options

---

## 27. Retrieval, Knowledge, and Source Governance

### 27.1 Source policy

The platform must define an approved source hierarchy for medical facts. Example tiers:
1. regulatory / specialty society guidelines
2. standard textbooks / curated clinical references
3. high-quality review articles
4. primary literature when needed
5. tenant-provided approved content packs

### 27.2 Source ingestion pipeline

The source ingestion subsystem should:
- import content,
- normalize metadata,
- chunk and embed source segments,
- preserve citation context,
- assign disease/topic tags,
- deprecate outdated or superseded content,
- support reviewer approval.

### 27.3 Evidence graph

Each fact should be modeled as:
- claim text,
- claim type,
- certainty level,
- source references,
- contradicted by / supported by relationships,
- disease-stage applicability,
- patient subgroup applicability.

### 27.4 Traceability requirement

Every clinically meaningful narrative statement must be traceable back to one or more evidence nodes or explicit reviewer-approved overrides.

---

## 28. Quality Assurance and Evaluation Framework

### 28.1 Evaluation dimensions

Each output version shall be scored on:
- medical accuracy
- evidence traceability
- mystery integrity
- narrative quality
- educational clarity
- franchise compliance
- novelty
- panel economy
- continuity
- render readiness

### 28.2 QA severity classes

**Severity 1:** dangerous or materially false medical content, major continuity break, export blocker.  
**Severity 2:** significant educational or narrative defect, must be corrected before publication.  
**Severity 3:** quality issue that can ship internally but not ideally for flagship publication.  
**Severity 4:** cosmetic or optimization suggestion.

### 28.3 Automated evals

The system should implement:
- schema conformance tests,
- clue-before-reveal tests,
- diagnosis leak detection,
- treatment-mechanism consistency checks,
- repeated-panel similarity checks,
- character voice drift checks,
- evidence coverage checks,
- terminology timing checks,
- render prompt completeness checks.

### 28.4 Human evals

Human reviewers should rate:
- clinical trustworthiness,
- mystery satisfaction,
- clarity of learning arc,
- visual storytelling quality,
- franchise charm,
- distinctiveness.

### 28.5 Golden set

Maintain a golden evaluation set of diseases across classes:
- infectious
- autoimmune
- oncologic
- cardiovascular
- endocrine/metabolic
- neurologic
- pediatric
- emergency/acute care
- chronic progressive disease
- rare disease

The golden set shall be rerun on every material model or prompt change.

### 28.6 Release thresholds

Example thresholds for production release:
- 100% schema-valid outputs
- 0 severity-1 issues
- <= 1 severity-2 medical issue per 20 projects in golden set
- >= 90% reviewer agreement on diagnosis fairness
- >= 85% reviewer agreement on panel clarity
- >= 95% traceability coverage for medically material claims

---

## 29. Security, Privacy, and Compliance

### 29.1 Default privacy posture

The platform should be designed to work **without PHI by default**. Disease-name input alone does not require patient-identifiable data. This should be the standard configuration for creator and many institutional workflows.

### 29.2 PHI-enabled mode

If the product later accepts patient context, then:
- only minimum necessary data should be ingested,
- PHI fields must be classified and access-controlled,
- encrypted storage and transport are mandatory,
- audit logs must capture access and export actions,
- retention and deletion policies must be configurable,
- de-identification tooling should be available.

### 29.3 HIPAA considerations

HHS states that the HIPAA Security Rule sets administrative, physical, and technical safeguards for electronic protected health information, and the Privacy Rule governs how protected health information may be used and disclosed, including the minimum necessary principle. If the product is used by covered entities or business associates with ePHI, the architecture, contracts, and operations must be designed accordingly rather than added later. [R5][R6]

### 29.4 Regulatory boundary

The product should be positioned initially as an educational content generation system, not as clinical decision support for live patient care. FDA’s January 2026 clinical decision support guidance distinguishes certain non-device decision support software functions from device-regulated functions and clarifies that software used by patients or caregivers, or software functions that meet the device definition, remain subject to digital health policies. Product, marketing, UI copy, and customer contracts must preserve the educational boundary unless a regulated product strategy is intentionally pursued. [R7]

### 29.5 Secure development baseline

NIST’s SSDF recommends integrating secure software development practices into the SDLC, and NIST’s SSDF AI community profile extends that baseline to AI model development. OWASP ASVS provides a practical basis for web application security verification. The platform should adopt these as engineering baselines for both software and AI workflow governance. [R8][R9][R10]

### 29.6 Security controls

The production system shall include:
- SSO / SAML / OIDC for enterprise,
- MFA for privileged roles,
- RBAC and optionally ABAC,
- encryption in transit and at rest,
- tenant isolation,
- environment separation,
- secrets management,
- dependency and container scanning,
- SBOM generation,
- vulnerability disclosure process,
- rate limiting and abuse controls,
- prompt injection and malicious content testing,
- DLP where PHI mode is enabled,
- immutable audit logs for critical actions.

### 29.7 Logging policy

Logs must be:
- structured,
- redacted for sensitive data,
- correlated with trace IDs,
- access-controlled,
- retained per policy,
- exportable for enterprise audits.

---

## 30. Interoperability and Enterprise Integration

### 30.1 EHR integration stance

EHR integration is optional and should not be a dependency for v1. However, the architecture should support future integration without redesign.

### 30.2 Standards approach

If EHR integration is added, use standards-based patterns. HL7’s current published SMART App Launch specification is version 2.2.0, based on FHIR R4, and defines patterns for capability discovery, scopes, token handling, and app launch context. This makes SMART on FHIR the preferred integration route for launching securely from compliant EHR systems. [R11][R12]

### 30.3 Integration modes

Possible modes:
- standalone app with manual input,
- secure file upload of de-identified case brief,
- launch-from-EHR with patient context,
- institution-specific content pack import,
- LMS / CMS export.

### 30.4 Data exchange boundaries

The app should keep:
- clinical facts,
- narrative artifacts,
- review metadata,
- exported assets

as separable domains so that PHI-bearing and non-PHI-bearing workflows can be segregated when needed.

---

## 31. Model and Prompt Management

### 31.1 Model routing strategy

Use a model router that chooses among:
- high-reasoning models for workbook and clinical synthesis,
- lower-cost high-volume models for structured transforms and formatting,
- dedicated image models for rendering,
- optional embedding models for retrieval and novelty memory.

### 31.2 Structured outputs

Where supported, the agent runtime should require structured outputs against explicit JSON schemas. Google’s structured-output docs note that streamed chunks can be valid partial JSON strings that concatenate into a final object, which is useful for long-running structured generations and progressive UI updates. [R13]

### 31.3 Prompt registry

All prompts shall be stored as versioned artifacts with:
- prompt template ID
- model target compatibility
- schema version
- instructions
- test cases
- rollback status
- owner
- change log

### 31.4 Prompt design rules

- prompts must be concise and explicit,
- prompts must not combine too many unrelated goals,
- stage-specific prompts should be preferred over monolithic prompts,
- clinical prompts must require evidence-bound responses,
- story prompts must consume structured upstream artifacts rather than re-derive facts.

Google’s prompt guidance emphasizes clear, specific instructions and iterative prompt refinement, which aligns with this staged design. [R4]

### 31.5 Context packing

The context builder shall:
- include only relevant disease facts,
- include canon snippets,
- include novelty constraints,
- include prior scene/panel context for continuity,
- exclude irrelevant history to reduce prompt drift and cost.

---

## 32. Repository and Codebase Design for Real Developers and Coding Agents

### 32.1 Repository structure

A monorepo is recommended initially for speed and contract cohesion.

```text
/apps
  /web
  /api
  /worker
/services
  /project-service
  /workflow-service
  /knowledge-service
  /agent-runtime
  /qa-service
  /render-prep-service
  /admin-service
/packages
  /contracts
  /schemas
  /prompt-registry
  /evals
  /ui-kit
  /domain-model
  /authz
  /logging
/infrastructure
  /terraform
  /k8s
  /monitoring
/docs
  /adr
  /runbooks
  /playbooks
  /compliance
```

### 32.2 Contract-first development

Developers and coding agents shall implement against:
- shared JSON schemas,
- typed API contracts,
- event definitions,
- test fixtures,
- acceptance criteria.

### 32.3 Coding standards

- strict typing
- explicit schema validation
- no hidden mutation of upstream artifacts
- idempotent workflow steps
- testable pure transformations where possible
- runtime feature flags
- prompt and model versions logged on every generation step

### 32.4 ADRs

Maintain Architecture Decision Records for:
- workflow engine selection,
- vector store selection,
- model routing strategy,
- PHI-enabled architecture,
- tenant isolation design,
- export format strategy,
- render model abstraction.

### 32.5 Local development

The repo should provide:
- seeded demo disease packs,
- mock agent responses,
- golden fixtures,
- one-command local stack startup,
- test data that contains no PHI,
- local evaluation commands.

---

## 33. DevSecOps, CI/CD, and Environment Strategy

### 33.1 Environments

Minimum environments:
- local
- dev
- staging
- production

Optional:
- regulated enterprise staging
- dedicated tenant sandboxes

### 33.2 CI pipeline

Every change should run:
- linting
- unit tests
- schema validation
- contract tests
- prompt template tests
- workflow simulation tests
- golden set smoke evals
- security scanning
- SBOM generation

### 33.3 CD strategy

Use staged promotion:
- merge to main -> dev deploy
- approved release candidate -> staging
- production deploy only after golden set and canary metrics pass

### 33.4 Feature flags

Use feature flags for:
- new prompt templates
- new models
- new QA thresholds
- enterprise integration modules
- PHI mode
- experimental novelty algorithms

### 33.5 Incident response

Runbooks must cover:
- model outage or degraded quality,
- retrieval/source corruption,
- billing or quota exhaustion,
- queue backlog,
- prompt regression,
- security incident,
- audit-log integrity issue.

---

## 34. Performance, Scalability, Reliability, and Cost

### 34.1 Performance targets

Suggested targets for v1:
- project creation API p95 < 500 ms
- first generation status update < 3 s
- standard disease-to-workbook completion < 2 min median
- full project package completion < 8 min median for default size
- selective panel regeneration < 60 s median

These are planning targets, not guaranteed SLAs, and depend on model/provider behavior.

### 34.2 Reliability targets

- core app availability: 99.9% monthly target
- no durable workflow state loss
- idempotent retries for generation stages
- backup and restore tested quarterly
- export bundle integrity checks on write and read

### 34.3 Scalability assumptions

The system should scale across:
- concurrent generation projects,
- batch curriculum generation,
- large artifact storage,
- high-volume retrieval queries,
- render-prompt export workloads.

### 34.4 Cost controls

The platform should implement:
- per-stage token and cost budgets,
- model routing by job class,
- caching of disease packets,
- context minimization,
- parallelization only where it lowers end-to-end cost or latency,
- tenant quotas and spend alerts,
- pre-generation cost estimate.

### 34.5 Degradation strategy

When providers are degraded:
- keep user project state durable,
- retry non-terminal stages,
- fall back to lower-cost or alternate models when quality permits,
- notify users of generation status with clear traceability.

---

## 35. Observability and Analytics

### 35.1 Observability requirements

Every workflow run shall emit:
- trace ID
- tenant ID
- project/version IDs
- agent name/version
- model name/version
- latency
- cost estimate
- token usage
- pass/fail outcome
- retry count
- QA scores

### 35.2 Product analytics

Track:
- generation start-to-finish completion rate
- selective regeneration rate
- panel count distributions
- review rejection reasons
- clinical QA failure frequency by disease class
- renderability failure rate
- user satisfaction by story stage
- cost per approved export

### 35.3 Quality drift monitoring

The system should alert on:
- rising diagnosis leaks,
- declining novelty scores,
- increased panel redundancy,
- evidence trace gaps,
- rising clinical correction rate after deployment,
- model-output schema failure spikes.

---

## 36. Governance and Editorial Operations

### 36.1 Clinical governance board

A commercial platform of this kind should establish:
- specialty reviewers,
- escalation path for disputed content,
- source policy ownership,
- update policy for evolving clinical guidance,
- sign-off criteria for publication classes.

### 36.2 Franchise governance

The franchise owner should control:
- detective names and appearance,
- recurring props,
- approved humor boundaries,
- visual style packs,
- banned motifs,
- tone rules by disease sensitivity class.

### 36.3 Content lifecycle

States:
- prototype
- internal draft
- clinical review
- editorial review
- approved
- published
- deprecated
- superseded

### 36.4 Change management

Changes to prompts, models, or source sets that affect medical meaning must trigger:
- golden set rerun
- reviewer sign-off
- version note
- rollback option

---

## 37. Staffing Plan and Organizational Readiness

### 37.1 Minimum core team for commercial build

- Product lead
- Engineering manager / technical lead
- 2-4 backend/full-stack engineers
- 1 frontend engineer
- 1 platform/MLOps engineer
- 1 prompt engineer / AI systems designer
- 1 clinical content lead
- 2+ part-time clinician reviewers
- 1 QA/evals engineer
- shared security/compliance and design support

### 37.2 Expanded team for scale

- additional specialty reviewers
- art director / comics editor
- customer success
- solutions engineer for enterprise
- data engineer for source ingestion
- operations manager for publication workflows

---

## 38. Risks and Mitigations

### 38.1 Medical hallucination risk

**Risk:** false or oversimplified medical content.  
**Mitigation:** curated sources, evidence graph, medical QA, clinician review, release gate.

### 38.2 Formula fatigue risk

**Risk:** stories feel repetitive across diseases.  
**Mitigation:** novelty ledger, archive similarity checks, style variation controls, human editorial tuning.

### 38.3 Visual inconsistency risk

**Risk:** recurring detectives drift across panels or projects.  
**Mitigation:** character bible, reference asset packs, continuity QA, render-target abstraction.

### 38.4 Regulatory drift risk

**Risk:** product messaging or features move toward regulated clinical decision support.  
**Mitigation:** legal review, feature boundary control, educational-only mode by default, enterprise governance.

### 38.5 Security/privacy risk

**Risk:** future PHI workflows are bolted on unsafely.  
**Mitigation:** design data domain boundaries now; keep PHI mode isolated and configurable.

### 38.6 Vendor lock-in risk

**Risk:** dependence on one model or API.  
**Mitigation:** model abstraction layer, prompt registry, structured contracts, eval-based routing.

### 38.7 Cost overrun risk

**Risk:** multi-agent pipeline becomes too expensive.  
**Mitigation:** caching, low-cost transform models, targeted regeneration, context packing, budget gates.

---

## 39. Release Plan

### 39.1 Phase 0: Architecture and validation

Deliver:
- disease packet schema
- workbook schema
- panel spec schema
- workflow skeleton
- golden set
- prompt registry
- initial QA framework

### 39.2 Phase 1: Internal alpha

Deliver:
- disease input to full dossier
- human-readable export
- panel plan
- basic review console
- no PHI
- limited disease library

### 39.3 Phase 2: Production beta

Deliver:
- multi-tenant auth
- approvals
- analytics
- cost controls
- selective regeneration
- render-target profiles
- audit logs
- support playbooks

### 39.4 Phase 3: Commercial GA

Deliver:
- enterprise admin
- SSO
- stronger eval automation
- export integrations
- billing
- support SLAs
- formal governance and documentation

### 39.5 Phase 4: Enterprise clinical content platform

Deliver:
- optional EHR integration
- private knowledge packs
- secure deployment options
- advanced policy engine
- institution-specific templates

---

## 40. Acceptance Criteria for “Production Ready”

A production-ready release shall require all of the following:

### 40.1 Functional acceptance

- end-to-end generation from disease to panel package works reliably,
- selective regeneration works without corrupting unrelated artifacts,
- review workflow blocks unapproved release,
- exports are complete and schema-valid.

### 40.2 Clinical acceptance

- medical review board signs off on golden set thresholds,
- zero unresolved severity-1 medical defects,
- evidence traceability meets target coverage,
- treatment depictions are mechanistically correct.

### 40.3 Technical acceptance

- services are deployable via CI/CD,
- observability and audit logs are active,
- backup/restore is tested,
- security controls meet internal baseline.

### 40.4 Operational acceptance

- support runbooks exist,
- cost dashboards exist,
- incident process exists,
- ownership for prompts, sources, and review policies is assigned.

### 40.5 Commercial acceptance

- terms, privacy posture, and regulatory boundary are documented,
- pricing and metering work,
- enterprise access controls exist,
- onboarding materials exist.

---

## 41. Example End-to-End Artifact Bundle

The final approved project bundle should include:

1. `project_manifest.json`
2. `disease_packet.json`
3. `evidence_sources.json`
4. `story_workbook.json`
5. `scene_cards.json`
6. `page_plan.json`
7. `panel_specs.json`
8. `dialogue_script.json`
9. `lettering_map.json`
10. `render_prompts.json`
11. `qa_report_medical.json`
12. `qa_report_continuity.json`
13. `qa_report_narrative.json`
14. `human_readable_dossier.md` or `.docx`
15. optional rendered asset manifest

Example `project_manifest.json`:

```json
{
  "project_id": "proj_01HZZ...",
  "version_id": "ver_0007",
  "title": "Mystery of the Quiet Signal",
  "canonical_disease": {
    "id": "disease_hcc",
    "name": "Hepatocellular carcinoma"
  },
  "generation_profile": {
    "audience": "clinician",
    "panel_budget": 120,
    "art_style": "cinematic whimsical sci-fi comic"
  },
  "artifacts": {
    "disease_packet": "s3://.../disease_packet.json",
    "story_workbook": "s3://.../story_workbook.json",
    "panel_specs": "s3://.../panel_specs.json"
  },
  "qa": {
    "medical_pass": true,
    "continuity_pass": true,
    "narrative_pass": true
  },
  "approvals": [
    {
      "role": "clinical_reviewer",
      "user_id": "usr_123",
      "timestamp": "2026-04-21T18:00:00Z"
    }
  ]
}
```

---

## 42. Recommendations for First Build Order

To reduce risk, the engineering team should build in this order:

1. Shared contracts and schemas
2. Project/version model
3. Disease packet builder
4. Workbook generator
5. Scene planner
6. Panel director
7. QA framework
8. Review console
9. Render prompt export
10. Tenant/admin/billing features

This order is preferable because:
- it establishes the truth-bearing core before visual polish,
- it lets the team validate educational value before render integration,
- it makes later model swaps or UI changes cheaper.

---

## 43. Final Strategic Recommendation

Build this product as an **editorially governed generation platform**, not as a novelty demo. The market value is not “AI makes comics.” The value is: **clinically reliable mystery-story generation with production-ready panel direction and auditable quality control**.

The core moat will come from:
- carefully designed schemas and workflow decomposition,
- clinically curated knowledge assembly,
- mystery-specific generation logic,
- strong franchise control,
- panel-aware rendering preparation,
- rigorous QA and review operations.

If those layers are built well, the platform can become more than a single app. It can become a reusable engine for medically grounded narrative education across comics, animation, interactive learning, and beyond.

---

## 44. External References Informing Architecture Assumptions

**[R1]** Google AI for Developers. *Gemini 3.1 Flash Image Preview.*  
**[R2]** Google DeepMind. *Gemini 3.1 Flash Image Model Card.*  
**[R3]** Google AI for Developers. *Gemini 3 Developer Guide.*  
**[R4]** Google AI for Developers. *Prompt design strategies.*  
**[R5]** HHS. *Summary of the HIPAA Security Rule.*  
**[R6]** HHS. *Summary of the HIPAA Privacy Rule.*  
**[R7]** FDA. *Clinical Decision Support Software Guidance for Industry and Food and Drug Administration Staff (January 2026).*  
**[R8]** NIST. *Secure Software Development Framework (SSDF) Version 1.1.*  
**[R9]** NIST. *Secure Software Development Framework project page / SP 800-218A AI community profile.*  
**[R10]** OWASP. *Application Security Verification Standard (ASVS).*  
**[R11]** HL7. *SMART App Launch v2.2.0 Overview.*  
**[R12]** HL7. *FHIR R4 specification.*  
**[R13]** Google AI for Developers. *Structured outputs.*

For a publication-grade business requirements package, the next best companion artifacts would be:
1. an OpenAPI specification,
2. JSON Schemas for all core artifacts,
3. a workflow state machine definition,
4. a golden-set evaluation plan,
5. a clinical governance SOP,
6. a prompt registry template,
7. a repository bootstrap plan.



## 45. Normative Language and Requirement Traceability

This document uses the following normative terms:

- **MUST / SHALL**: mandatory for the referenced scope.
- **SHOULD**: strongly recommended unless there is a documented exception.
- **MAY**: optional capability.
- **Production blocker**: any unresolved issue that prevents GA release or export.

Every requirement implemented from this document should be traceable in a requirement matrix with:
- requirement ID,
- owning team,
- linked schema/API/workflow component,
- implementation status,
- test coverage reference,
- operational owner.

---

## 46. Non-Functional Requirement Catalog

### 46.1 Performance and latency

**NFR-PERF-001** The system MUST support asynchronous generation for long-running jobs.  
**NFR-PERF-002** The UI MUST present job progress and partial artifacts when available.  
**NFR-PERF-003** The system MUST support queue backpressure without losing workflow state.  
**NFR-PERF-004** The system SHOULD provide preflight cost/latency estimates before generation begins.  
**NFR-PERF-005** The system MUST not block unrelated tenant workloads because of one tenant’s batch job.

### 46.2 Reliability

**NFR-REL-001** Durable workflow state MUST survive service restarts.  
**NFR-REL-002** Artifact generation steps MUST be idempotent by project version and stage key.  
**NFR-REL-003** Retryable failures MUST be distinguishable from terminal failures.  
**NFR-REL-004** The platform MUST preserve prior approved versions even if regeneration fails.  
**NFR-REL-005** Exports MUST be checksummed and verifiable.

### 46.3 Scalability

**NFR-SCL-001** The system MUST support horizontal worker scaling.  
**NFR-SCL-002** The knowledge retrieval layer MUST support cacheable disease-packet reuse.  
**NFR-SCL-003** The platform SHOULD support batch generation APIs for curriculum-scale workloads.  
**NFR-SCL-004** Large tenants MUST be isolated from each other at rate-limit and queue levels.

### 46.4 Security

**NFR-SEC-001** All external and internal network traffic carrying sensitive data MUST use TLS.  
**NFR-SEC-002** Secrets MUST be stored in a managed secrets system, never in source control.  
**NFR-SEC-003** Privileged actions MUST require elevated role membership and audit logging.  
**NFR-SEC-004** All production containers/images MUST undergo vulnerability scanning before release.  
**NFR-SEC-005** The system MUST support emergency credential rotation and key revocation.  
**NFR-SEC-006** The platform SHOULD support WAF, rate limiting, and abuse detection at ingress.

### 46.5 Privacy

**NFR-PRV-001** The default workflow MUST minimize collection of personal data.  
**NFR-PRV-002** PHI-enabled mode MUST classify and tag sensitive fields.  
**NFR-PRV-003** The system MUST support data deletion and retention policies by tenant.  
**NFR-PRV-004** Audit logs containing sensitive context MUST be access-controlled and redacted appropriately.

### 46.6 Maintainability

**NFR-MTN-001** Shared schemas MUST be versioned and backward-compatibility rules documented.  
**NFR-MTN-002** Prompt templates MUST be stored outside code where practical and version-controlled.  
**NFR-MTN-003** Core domain transformations SHOULD be deterministic where possible.  
**NFR-MTN-004** Each service MUST publish health checks, version info, and dependency readiness signals.

### 46.7 Observability

**NFR-OBS-001** All services MUST emit structured logs with correlation IDs.  
**NFR-OBS-002** All workflow stages MUST emit latency and failure metrics.  
**NFR-OBS-003** Model requests MUST record provider, model, prompt version, token counts, and estimated cost.  
**NFR-OBS-004** Review decisions MUST be queryable for audit and analytics.

### 46.8 Usability

**NFR-USE-001** The review experience MUST make it easy to understand why the system believes a fact or story choice is valid.  
**NFR-USE-002** Selective regeneration controls MUST be understandable to non-engineers.  
**NFR-USE-003** The system SHOULD offer concise summaries for leaders and deep detail for specialists from the same project data.

---

## 47. Service-Level Objectives and Error Budgets

### 47.1 Recommended initial SLOs

| Service / capability | Target SLO | Notes |
|---|---:|---|
| Core web/API availability | 99.9% monthly | Excludes planned maintenance windows |
| Project read/write availability | 99.95% monthly | Backed by relational DB HA plan |
| Workflow state durability | 99.99% preservation | No accepted loss of approved versions |
| Export bundle retrieval | 99.9% monthly | Cached via CDN where applicable |
| Internal QA completion success | 99% of completed runs | Excludes provider outage events |

### 47.2 Error budget policy

If a critical SLO burns >50% of its monthly error budget within the first 10 days of the month:
- non-essential feature launches should pause,
- incident review should identify top failure modes,
- remediation work should be prioritized ahead of experimental prompting changes.

---

## 48. Role and Permission Model

### 48.1 Base roles

- Org Owner
- Org Admin
- Product Editor
- Clinical Reviewer
- Story Editor
- Art/Prompt Reviewer
- Viewer
- Billing Admin
- Compliance Auditor

### 48.2 Example permission matrix

| Action | Owner | Admin | Editor | Clinical Reviewer | Story Editor | Art Reviewer | Viewer |
|---|---|---|---|---|---|---|---|
| Create project | Yes | Yes | Yes | Optional | Optional | Optional | No |
| Edit disease brief | Yes | Yes | Yes | No | No | No | No |
| Approve medical QA | Yes | Optional | No | Yes | No | No | No |
| Approve story | Yes | Optional | Optional | No | Yes | No | No |
| Approve render prompts | Yes | Optional | Optional | No | No | Yes | No |
| Export final bundle | Yes | Yes | Optional | No | No | No | No |
| Manage users | Yes | Yes | No | No | No | No | No |
| View audit logs | Yes | Yes | Optional | Optional | Optional | Optional | No |

### 48.3 Permissioning requirements

- permissions MUST be enforceable server-side,
- UI visibility alone is insufficient,
- every approval action MUST verify current role membership at execution time,
- enterprise tenants SHOULD be able to define custom approval chains.

---

## 49. Example Workflow Pseudocode

```python
def run_project_generation(project_id: str, version_id: str) -> None:
    brief = load_generation_brief(project_id, version_id)

    canonical = run_agent("input_canonicalization", brief)
    save_stage("DISEASE_CANONICALIZED", canonical)

    evidence = run_agent("clinical_retrieval", canonical)
    packet = run_agent("clinical_synthesis", evidence)
    validate_schema("DiseasePacket", packet)
    save_stage("DISEASE_PACKET_READY", packet)

    clues = run_agent("differential_and_clue", packet)
    pedagogy = run_agent("pedagogy", {"packet": packet, "clues": clues})
    workbook = run_agent("story_architect", {
        "packet": packet,
        "clues": clues,
        "pedagogy": pedagogy
    })
    canon_checked = run_agent("franchise_canon", workbook)
    novelty = run_agent("novelty", canon_checked)

    if novelty["collision_risk"] == "high":
        workbook = regenerate_with_variation(workbook, novelty)

    validate_schema("StoryWorkbook", workbook)
    save_stage("WORKBOOK_READY", workbook)

    wait_for_optional_human_review("WORKBOOK_READY")

    scenes = run_agent("scene_planner", workbook)
    panels = run_agent("panel_director", scenes)
    dialogue = run_agent("dialogue", panels)
    prompts = run_agent("render_prompt", {
        "panels": panels,
        "dialogue": dialogue
    })

    medical_qa = run_agent("medical_qa", {
        "packet": packet,
        "scenes": scenes,
        "panels": panels,
        "dialogue": dialogue
    })
    continuity_qa = run_agent("continuity_qa", {
        "panels": panels,
        "prompts": prompts
    })

    release = run_agent("release_gate", {
        "medical_qa": medical_qa,
        "continuity_qa": continuity_qa
    })

    if not release["pass"]:
        save_stage("QA_FAILED", release)
        notify_reviewers(project_id, version_id, release)
        return

    export = run_agent("export_assembly", {
        "packet": packet,
        "workbook": workbook,
        "scenes": scenes,
        "panels": panels,
        "dialogue": dialogue,
        "prompts": prompts
    })
    save_stage("EXPORTED", export)
```

This pseudocode is illustrative only. In production, each stage should be durable, idempotent, observable, and resumable.

---

## 50. Event Schema Example

```json
{
  "event_id": "evt_01J...",
  "event_type": "qa.issue.raised",
  "tenant_id": "org_123",
  "project_id": "proj_456",
  "version_id": "ver_003",
  "stage": "MEDICAL_QA",
  "timestamp": "2026-04-21T18:42:19Z",
  "actor": {
    "type": "system",
    "id": "medical_qa_agent_v3"
  },
  "payload": {
    "issue_id": "issue_998",
    "severity": 1,
    "category": "treatment_mismatch",
    "summary": "Panel 84 implies curative therapy in a condition where therapy is only disease-modifying."
  },
  "trace_id": "trc_abc123"
}
```

---

## 51. Prompt Registry Contract

A prompt registry entry should minimally include:

```json
{
  "prompt_id": "story_architect_v12",
  "owner_team": "ai-systems",
  "purpose": "Generate the mystery workbook from a validated disease packet",
  "compatible_models": [
    "reasoning_model_family_a",
    "reasoning_model_family_b"
  ],
  "input_schema": "StoryArchitectInput@v3",
  "output_schema": "StoryWorkbook@v5",
  "template_text": "...",
  "test_cases": [
    "golden_hcc",
    "golden_asthma",
    "golden_ms"
  ],
  "safety_constraints": [
    "no early diagnosis naming",
    "no unsupported medical claims"
  ],
  "rollback_to": "story_architect_v11",
  "status": "active"
}
```

Registry features should include:
- owner approval,
- staged rollout,
- canary by tenant,
- rollback,
- test evidence,
- diff view between prompt versions.

---

## 52. Data Retention, Archiving, and Deletion

### 52.1 Artifact classes

Artifacts should be classified as:
- operational logs,
- workflow metadata,
- content artifacts,
- source caches,
- review records,
- billing/metering records,
- PHI-bearing records (if enabled).

### 52.2 Retention policy design

Retention should be configurable by tenant and artifact class. Example defaults:
- workflow logs: 30-90 days
- audit logs: 1-7 years depending on enterprise policy
- approved content artifacts: retained until deletion request or policy expiry
- temporary provider responses/cache: short-lived
- PHI-bearing input data: minimum necessary retention only

### 52.3 Deletion workflow

Deletion must:
- soft-delete project access immediately,
- enqueue hard-delete jobs by artifact class,
- preserve immutable audit records only where legally required,
- confirm downstream object deletion and search index removal,
- provide deletion status to the requesting admin.

---

## 53. Disaster Recovery and Business Continuity

### 53.1 Recovery objectives

Suggested targets:
- RPO for transactional metadata: < 15 minutes
- RTO for core project workspace: < 4 hours
- RTO for non-critical analytics: < 24 hours

### 53.2 DR requirements

- multi-AZ database deployment
- artifact store replication or versioned redundancy
- workflow state backup
- infrastructure-as-code recovery runbooks
- periodic restore tests
- tenant communication templates for incidents

### 53.3 Continuity mode

In a partial outage, the system should degrade gracefully:
- allow project viewing even if generation is paused,
- queue new generation requests rather than losing them,
- prevent false “success” states during provider outages.

---

## 54. Abuse Prevention and Safety Controls

### 54.1 Threats to anticipate

- prompt injection through uploaded or tenant-provided content
- attempts to generate unsafe or disallowed medical misinformation
- abuse of the platform for unauthorized patient-data processing
- extraction or scraping of licensed source material
- denial-of-wallet through excessive batch jobs

### 54.2 Controls

- input validation and content classification
- tenant and user rate limits
- provider-side and app-side safety policy checks
- prompt isolation between source text and system instructions
- budget caps
- anomaly detection on batch usage
- content moderation escalation path

### 54.3 Human override policy

Human reviewers may override automated blockers only with:
- documented reason,
- role-based permission,
- audit entry,
- optional second approver for clinical or compliance-critical overrides.

---

## 55. Evaluation Formula Example

The platform should compute dimensioned scores rather than a single opaque pass/fail.

Example composite score:

```text
overall_quality_score =
  0.30 * medical_accuracy_score +
  0.15 * evidence_traceability_score +
  0.15 * mystery_integrity_score +
  0.10 * narrative_quality_score +
  0.10 * educational_clarity_score +
  0.10 * continuity_score +
  0.05 * novelty_score +
  0.05 * render_readiness_score
```

Hard blockers should override composite scores:
- any severity-1 issue = fail
- diagnosis leak before allowed stage = fail
- missing evidence for critical medical claim = fail

---

## 56. Sample Test Strategy

### 56.1 Unit tests

- schema validation
- deterministic transformations
- scoring logic
- permission checks
- diff engine logic

### 56.2 Integration tests

- project creation to workflow kickoff
- evidence retrieval to packet creation
- selective regeneration invalidation graph
- approval gating
- export completeness

### 56.3 End-to-end tests

- golden diseases across classes
- multi-reviewer approval flow
- failed QA -> correction -> pass
- tenant isolation
- cost-budget enforcement

### 56.4 Adversarial tests

- malformed disease input
- conflicting evidence sources
- prompt injection attempts in source text
- attempts to force early reveal
- unrealistic panel budget constraints
- large-batch generation spikes

---

## 57. Build vs Buy Guidance

### 57.1 Build in-house

Prefer in-house ownership for:
- domain schemas
- workflow engine integration
- review workflows
- QA logic
- prompt registry
- clinical governance tooling
- franchise canon system

### 57.2 Buy or outsource selectively

Consider managed vendors or third-party services for:
- auth/SSO
- billing
- object storage/CDN
- observability platform
- vector DB (if managed service fits security requirements)
- external rendering providers

### 57.3 Never outsource without governance

Do not outsource:
- final medical truth validation,
- release gating policy,
- source policy ownership,
- brand/franchise canon authority.

---

## 58. Commercial Readiness Checklist

Before launch, confirm:
- pricing model approved,
- legal terms reviewed,
- privacy documentation completed,
- source licensing confirmed,
- clinical review process staffed,
- on-call rotations defined,
- sales/demo environment available,
- security questionnaire package prepared,
- customer onboarding materials written,
- internal KPI dashboard live.

---

## 59. Immediate Next Artifacts Recommended

This document should be followed by these implementation-grade artifacts, in order:

1. **Domain schema pack**  
   JSON schemas for Project, DiseasePacket, StoryWorkbook, SceneCard, PanelSpec, QAReport, ReviewDecision, ExportBundle.

2. **OpenAPI / service contract pack**  
   External REST APIs and internal service contracts.

3. **Workflow state machine definition**  
   Durable orchestration stages, retries, invalidation graph, human approval pauses.

4. **Prompt registry starter set**  
   Initial prompt templates for each agent with test fixtures.

5. **Golden-set eval harness**  
   At least 15-25 diseases with rubric-driven review forms and expected failure checks.

6. **Clinical governance SOP**  
   Reviewer responsibilities, escalation paths, source update cadence, release gate rules.

7. **Repository bootstrap plan**  
   Monorepo structure, package boundaries, CI/CD templates, local dev script, seed data.

---

## 60. Closing Note

The key design decision is simple but profound: this product should be built as a **governed content factory**, not a text box on top of a model. The educational promise, the mystery-story quality, the medical credibility, and the commercial viability all depend on that distinction.

If the platform gets the schemas, workflow, quality gates, and governance right, the creative surface can improve continuously as models improve. If it skips those foundations, better models will only produce faster, harder-to-audit chaos.


## 61. Reference URLs

- **[R1]** Google AI for Developers. *Gemini 3.1 Flash Image Preview.*  
  https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image-preview

- **[R2]** Google DeepMind. *Gemini 3.1 Flash Image Model Card.*  
  https://deepmind.google/models/model-cards/gemini-3-1-flash-image/

- **[R3]** Google AI for Developers. *Gemini 3 Developer Guide.*  
  https://ai.google.dev/gemini-api/docs/gemini-3

- **[R4]** Google AI for Developers. *Prompt design strategies.*  
  https://ai.google.dev/gemini-api/docs/prompting-strategies

- **[R5]** HHS. *Summary of the HIPAA Security Rule.*  
  https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html

- **[R6]** HHS. *Summary of the HIPAA Privacy Rule.*  
  https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html

- **[R7]** FDA. *Clinical Decision Support Software Guidance for Industry and Food and Food and Drug Administration Staff (January 2026).*  
  https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software

- **[R8]** NIST. *Secure Software Development Framework (SSDF) Version 1.1.*  
  https://csrc.nist.gov/pubs/sp/800/218/final

- **[R9]** NIST. *Secure Software Development Framework project page / SP 800-218A AI community profile.*  
  https://csrc.nist.gov/projects/ssdf

- **[R10]** OWASP. *Application Security Verification Standard (ASVS).*  
  https://owasp.org/www-project-application-security-verification-standard/

- **[R11]** HL7. *SMART App Launch v2.2.0 Overview.*  
  https://hl7.org/fhir/smart-app-launch/

- **[R12]** HL7. *FHIR R4 specification.*  
  https://www.hl7.org/fhir/R4/

- **[R13]** Google AI for Developers. *Structured outputs.*  
  https://ai.google.dev/gemini-api/docs/structured-output
