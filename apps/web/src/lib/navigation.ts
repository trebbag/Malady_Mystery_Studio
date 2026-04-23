export const runPageDefinitions = [
  { label: 'Pipeline', path: 'pipeline', description: 'Workflow stages, artifact status, and audit flow.' },
  { label: 'Review', path: 'review', description: 'Approvals, eval summary, and export readiness.' },
  { label: 'Packets', path: 'packets', description: 'Disease packet, fact table, teaching points, and anchors.' },
  { label: 'Evidence', path: 'evidence', description: 'Evidence graph, contradictions, and traceability blockers.' },
  { label: 'Workbooks', path: 'workbooks', description: 'Story workbook, narrative review trace, and QA.' },
  { label: 'Scenes', path: 'scenes', description: 'Scene-card sequencing and narrative beats.' },
  { label: 'Panels', path: 'panels', description: 'Panel plans, render prompts, lettering maps, and panel QA.' },
  { label: 'Rendering Guide', path: 'rendering-guide', description: 'Master handoff guide for Nano Banana Pro and Genspark AI Slides.' },
  { label: 'Sources', path: 'sources', description: 'Governed source records and source review actions.' },
  { label: 'Governance', path: 'governance', description: 'Approvals, audit log, and clinical blocker state.' },
  { label: 'Evals', path: 'evals', description: 'Eval families, gate state, and rerun action.' },
  { label: 'Bundles', path: 'bundles', description: 'Release bundles, export history, and retrieval links.' },
] as const;
