export const creatorRunPageDefinitions = [
  { label: 'Overview', path: 'overview', description: 'Plain-language status, next action, blockers, and progress.' },
  { label: 'Medical Review', path: 'clinical-review', description: 'Agent-built medical dossier, disease packet, source issues, traceability, and approval controls.' },
  { label: 'Story & Panels', path: 'story-panel-plan', description: 'Mystery craft, panel order, page rhythm, and continuity readiness.' },
  { label: 'Guide Review', path: 'guide-review', description: 'Rendering guide, Cyto/Pip locks, visual references, and approval.' },
  { label: 'Render Panels', path: 'render-panels', description: 'Rendered panel status, retry state, QA, and render controls.' },
  { label: 'Export', path: 'export', description: 'Safety checks, package readiness, local delivery, and backup proof.' },
] as const;

export const runPageDefinitions = [
  { label: 'Pipeline', path: 'pipeline', description: 'Workflow stages, artifact status, and audit flow.' },
  { label: 'Review', path: 'review', description: 'Approvals, eval summary, and export readiness.' },
  { label: 'Packets', path: 'packets', description: 'Disease packet, fact table, teaching points, and anchors.' },
  { label: 'Evidence', path: 'evidence', description: 'Evidence graph, contradictions, and traceability blockers.' },
  { label: 'Workbooks', path: 'workbooks', description: 'Story workbook, narrative review trace, and QA.' },
  { label: 'Scenes', path: 'scenes', description: 'Scene-card sequencing and narrative beats.' },
  { label: 'Panels', path: 'panels', description: 'Panel plans, render prompts, rendered assets, lettering maps, and panel QA.' },
  { label: 'Rendering Guide', path: 'rendering-guide', description: 'Pre-render review gate for guide, visual references, prompts, lettering, and panel rendering.' },
  { label: 'Sources', path: 'sources', description: 'Governed source records and source review actions.' },
  { label: 'Governance', path: 'governance', description: 'Approvals, audit log, and clinical blocker state.' },
  { label: 'Evals', path: 'evals', description: 'Eval families, gate state, and rerun action.' },
  { label: 'Bundles', path: 'bundles', description: 'Release bundles, export history, and retrieval links.' },
] as const;
