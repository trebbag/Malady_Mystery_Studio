# Initial risk register

| Risk | Why it matters | Likelihood | Impact | Early mitigation |
|---|---|---:|---:|---|
| Medical hallucination | Undermines trust and safety | Medium | Very high | source traceability, clinical review, medical evals |
| Diagnosis revealed too early | Damages mystery format | High | High | sequencing guardrails, mystery evals |
| Repetitive stories | Weakens franchise value | High | Medium | novelty memory service, archive-aware prompts |
| Panel redundancy or jumpiness | Makes comics unreadable | Medium | High | panelization rubric, scene-to-panel contracts |
| Render output inconsistency | Breaks continuity and production flow | High | Medium | character bible, continuity anchors, render QA |
| Hidden prompt drift | Creates hard-to-debug regressions | Medium | High | prompt registry, versioning, prompt change review |
| Review bottlenecks | Human review becomes the delivery constraint | Medium | High | scoped review surfaces, triage queues, release bundles |
| Security/privacy leakage | Especially important if patient-like data is introduced later | Low/Medium | Very high | data classification, least privilege, audit logs |
