# Ticket index

| Ticket | Milestone | Title | Depends on |
|---|---|---|---|
| `T001` | M0 | Scaffold the monorepo foundation | — |
| `T002` | M0 | Add CI and repository quality checks | T001 |
| `T003` | M0 | Implement contract validation tooling | T001 |
| `T004` | M0 | Define the workflow state machine and event model | T001, T003 |
| `T005` | M0 | Add auth, roles, and human approval stubs | T001, T004 |
| `T006` | M0 | Create project and workflow-run API skeleton | T001, T004, T005 |
| `T101` | M1 | Build disease intake UI/API path | T006 |
| `T102` | M1 | Implement disease canonicalization service interface | T101 |
| `T103` | M1 | Implement evidence registry and source objects | T102 |
| `T104` | M1 | Implement disease packet generation pipeline | T102, T103 |
| `T201` | M2 | Implement story workbook engine | T104 |
| `T202` | M2 | Implement educational sequencing guardrails | T201 |
| `T203` | M2 | Define novelty and memory service contract | T201 |
| `T204` | M2 | Capture narrative review traces and rubric scoring | T201, T202 |
| `T301` | M3 | Implement scene planner service | T201, T202 |
| `T302` | M3 | Implement panel director service | T301 |
| `T303` | M3 | Implement render prompt generator with lettering separation | T302 |
| `T304` | M3 | Build editorial review UI for scene and panel artifacts | T301, T302, T303, T005 |
| `T401` | M4 | Implement eval harness and dataset loaders | T104, T202, T302, T303 |
| `T402` | M4 | Implement release bundle assembly and export | T304, T401 |