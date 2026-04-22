/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function renderJson(value) {
  return escapeHtml(JSON.stringify(value, null, 2));
}

/**
 * @param {{ actor?: any | null, title: string, heading: string, body: string }} options
 * @returns {string}
 */
function renderLayout(options) {
  const actorBadge = options.actor
    ? `<p class="actor">Open local mode as <strong>${escapeHtml(options.actor.displayName)}</strong> in <code>${escapeHtml(options.actor.tenantId)}</code>.</p>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #1f2933;
        --muted: #52606d;
        --panel: #ffffff;
        --line: #d9e2ec;
        --accent: #0b7285;
        --bg: linear-gradient(180deg, #f4fbfc 0%, #f7f4ed 100%);
        --success: #0f766e;
        --warning: #b54708;
        --danger: #b42318;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background: var(--bg);
      }
      header, main { max-width: 86rem; margin: 0 auto; padding: 1.5rem; }
      header { padding-bottom: 0.5rem; }
      nav { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
      nav a { color: var(--accent); text-decoration: none; font-weight: 600; }
      .actor { color: var(--muted); margin: 0 0 1rem; }
      .surface {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 1rem;
        padding: 1rem 1.25rem;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
        margin-bottom: 1rem;
      }
      .grid { display: grid; gap: 1rem; }
      .grid.two { grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
      .grid.three { grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
      .mono { font-family: "SFMono-Regular", Menlo, monospace; }
      .tag {
        display: inline-block;
        border-radius: 999px;
        padding: 0.2rem 0.55rem;
        margin-right: 0.4rem;
        margin-bottom: 0.4rem;
        background: #e6f4f1;
        color: var(--success);
        font-size: 0.85rem;
      }
      .tag.warning { background: #fff2e8; color: var(--warning); }
      .tag.danger { background: #fef3f2; color: var(--danger); }
      .muted { color: var(--muted); }
      form { display: grid; gap: 0.75rem; }
      input, select, textarea, button {
        font: inherit;
        padding: 0.65rem 0.75rem;
        border-radius: 0.7rem;
        border: 1px solid var(--line);
      }
      textarea { min-height: 6rem; resize: vertical; }
      button {
        border: none;
        background: var(--accent);
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      button.secondary { background: #334e68; }
      button.warning { background: #9a3412; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
      pre { margin: 0; padding: 1rem; overflow: auto; background: #f8fafc; border-radius: 0.75rem; border: 1px solid var(--line); }
      details { border: 1px solid var(--line); border-radius: 0.75rem; padding: 0.75rem 1rem; background: #fbfdff; }
      summary { cursor: pointer; font-weight: 700; }
      .artifact-list { display: grid; gap: 0.75rem; }
      .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: end; }
      .stack { display: grid; gap: 0.5rem; }
      code { background: #eef2f6; padding: 0.1rem 0.35rem; border-radius: 0.35rem; }
      .section-head { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; flex-wrap: wrap; }
      .stats { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
      .stat { border: 1px solid var(--line); border-radius: 0.8rem; padding: 0.75rem 0.9rem; background: #fbfdff; }
      .stat strong { display: block; font-size: 1.25rem; margin-top: 0.2rem; }
    </style>
  </head>
  <body>
    <header>
      <nav><a href="/review">Review dashboard</a><a href="/intake">Intake</a></nav>
      <h1>${escapeHtml(options.heading)}</h1>
      ${actorBadge}
    </header>
    <main>${options.body}</main>
  </body>
</html>`;
}

/**
 * @param {string} status
 * @returns {string}
 */
function statusTag(status) {
  const normalized = status.toLowerCase();
  const className = normalized === 'failed' || normalized === 'rejected' || normalized === 'stale'
    ? 'danger'
    : (normalized === 'conditional-pass' || normalized === 'missing' ? 'warning' : '');
  return `<span class="tag${className ? ` ${className}` : ''}">${escapeHtml(status)}</span>`;
}

/**
 * @param {{ actor: any, workflowRuns: any[], projectsById: Map<string, any>, filters: Record<string, string>, runSummaries: Map<string, { exportCount: number, latestEvalStatus: string }> }} options
 * @returns {string}
 */
export function renderReviewDashboard(options) {
  const rows = options.workflowRuns
    .map((workflowRun) => {
      const project = options.projectsById.get(workflowRun.projectId);
      const diseaseName = workflowRun.input?.diseaseName ?? project?.input?.diseaseName ?? 'Unknown disease';
      const summary = options.runSummaries.get(workflowRun.id) ?? {
        exportCount: 0,
        latestEvalStatus: 'missing',
      };
      return `<tr>
        <td><a href="/review/runs/${encodeURIComponent(workflowRun.id)}"><code>${escapeHtml(workflowRun.id)}</code></a></td>
        <td>${escapeHtml(project?.title ?? 'Untitled project')}</td>
        <td>${escapeHtml(diseaseName)}</td>
        <td>${statusTag(workflowRun.state)}</td>
        <td>${statusTag(workflowRun.currentStage)}</td>
        <td>${statusTag(summary.latestEvalStatus)}</td>
        <td>${summary.exportCount}</td>
        <td>${escapeHtml(workflowRun.updatedAt)}</td>
      </tr>`;
    })
    .join('');

  return renderLayout({
    actor: options.actor,
    title: 'Local Review Dashboard',
    heading: 'Local Review Dashboard',
    body: `<section class="surface">
      <p>Inspect full local runs, resolve canonicalization blockers, run deterministic evals, and export release bundles once the latest eval passes.</p>
      <form method="get" action="/review" class="grid three">
        <label>Disease
          <input name="disease" value="${escapeHtml(options.filters.disease ?? '')}" placeholder="Filter by disease" />
        </label>
        <label>Workflow state
          <select name="state">
            <option value="">All</option>
            ${['draft', 'running', 'review', 'approved', 'exported', 'failed', 'cancelled'].map((value) => `<option value="${escapeHtml(value)}"${options.filters.state === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
          </select>
        </label>
        <label>Current stage
          <select name="stage">
            <option value="">All</option>
            ${['intake', 'canonicalization', 'disease-packet', 'story-workbook', 'scene-planning', 'panel-planning', 'render-prep', 'review', 'export'].map((value) => `<option value="${escapeHtml(value)}"${options.filters.stage === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
          </select>
        </label>
        <label>Export status
          <select name="exportStatus">
            <option value="">All</option>
            <option value="with-exports"${options.filters.exportStatus === 'with-exports' ? ' selected' : ''}>with exports</option>
            <option value="without-exports"${options.filters.exportStatus === 'without-exports' ? ' selected' : ''}>without exports</option>
          </select>
        </label>
        <label>Latest eval status
          <select name="evalStatus">
            <option value="">All</option>
            ${['missing', 'passed', 'failed', 'stale'].map((value) => `<option value="${escapeHtml(value)}"${options.filters.evalStatus === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
          </select>
        </label>
        <label>Sort
          <select name="sort">
            ${[
              ['updated-desc', 'updated newest'],
              ['disease-asc', 'disease A-Z'],
              ['state-asc', 'state'],
              ['stage-asc', 'stage'],
              ['exports-desc', 'exports'],
              ['eval-status', 'eval status'],
            ].map(([value, label]) => `<option value="${escapeHtml(value)}"${(options.filters.sort ?? 'updated-desc') === value ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        </label>
        <div class="actions">
          <button type="submit">Apply filters</button>
          <a href="/review">Reset</a>
        </div>
      </form>
    </section>
    <section class="surface">
      <div class="stats">
        <div class="stat"><span class="muted">Visible runs</span><strong>${options.workflowRuns.length}</strong></div>
        <div class="stat"><span class="muted">Blocked clinical runs</span><strong>${options.workflowRuns.filter((workflowRun) => workflowRun.pauseReason === 'clinical-governance-blocked' || workflowRun.pauseReason === 'clinical-governance-review-required').length}</strong></div>
        <div class="stat"><span class="muted">Awaiting review</span><strong>${options.workflowRuns.filter((workflowRun) => workflowRun.state === 'review').length}</strong></div>
        <div class="stat"><span class="muted">Stale evals</span><strong>${options.workflowRuns.filter((workflowRun) => (options.runSummaries.get(workflowRun.id)?.latestEvalStatus ?? 'missing') === 'stale').length}</strong></div>
        <div class="stat"><span class="muted">Export ready</span><strong>${options.workflowRuns.filter((workflowRun) => workflowRun.state === 'approved' && (options.runSummaries.get(workflowRun.id)?.latestEvalStatus ?? 'missing') === 'passed').length}</strong></div>
      </div>
    </section>
    <section class="surface">
      <table>
        <thead>
          <tr>
            <th>Run</th>
            <th>Project</th>
            <th>Disease</th>
            <th>State</th>
            <th>Stage</th>
            <th>Latest eval</th>
            <th>Exports</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8">No runs match the current filters.</td></tr>'}</tbody>
      </table>
    </section>`,
  });
}

/**
 * @param {Array<{ title: string, description?: string, artifacts: Array<{ artifactType: string, artifactId: string, artifact: any }> }>} groups
 * @returns {string}
 */
function renderArtifactGroups(groups) {
  return groups
    .map((group) => `<section class="surface">
      <div class="section-head">
        <h2>${escapeHtml(group.title)}</h2>
        ${group.description ? `<span class="muted">${escapeHtml(group.description)}</span>` : ''}
      </div>
      <div class="artifact-list">
        ${group.artifacts.length > 0
          ? group.artifacts.map((entry) => `<details>
            <summary>${escapeHtml(entry.artifactType)} · <code>${escapeHtml(entry.artifactId)}</code></summary>
            <pre>${renderJson(entry.artifact)}</pre>
          </details>`).join('')
          : '<p class="muted">No artifacts in this section yet.</p>'}
      </div>
    </section>`)
    .join('');
}

/**
 * @param {{ artifactType: string, itemCount: number, linkedItemCount: number, validItemCount: number, missingLinkCount: number, invalidLinkCount: number, coverageScore: number }[]} summaries
 * @returns {string}
 */
function renderTraceCoverageTable(summaries) {
  return `<table>
    <thead><tr><th>Artifact</th><th>Items</th><th>Linked</th><th>Valid</th><th>Missing</th><th>Invalid</th><th>Coverage</th></tr></thead>
    <tbody>${summaries.map((summary) => `<tr>
      <td>${escapeHtml(summary.artifactType)}</td>
      <td>${summary.itemCount}</td>
      <td>${summary.linkedItemCount}</td>
      <td>${summary.validItemCount}</td>
      <td>${summary.missingLinkCount}</td>
      <td>${summary.invalidLinkCount}</td>
      <td>${summary.coverageScore.toFixed(2)}</td>
    </tr>`).join('') || '<tr><td colspan="7">No downstream trace coverage artifacts are available yet.</td></tr>'}</tbody>
  </table>`;
}

/**
 * @param {{ actor: any, project: any, workflowRun: any, artifactGroups: Array<{ title: string, description?: string, artifacts: Array<{ artifactType: string, artifactId: string, artifact: any }> }>, auditLogs: any[], canonicalDisease: any | null, canResolveCanonicalization: boolean, approvableRoles: string[], clinicalPackage: any | null, latestEvalRun: any | null, latestEvalStatus: string, exportHistory: any[] }} options
 * @returns {string}
 */
export function renderReviewRunPage(options) {
  const approvalForms = options.workflowRun.requiredApprovalRoles
    .filter((/** @type {string} */ role) => options.approvableRoles.includes(role))
    .map((/** @type {string} */ role) => `<form method="post" action="/review/runs/${encodeURIComponent(options.workflowRun.id)}/approvals" class="surface">
      <input type="hidden" name="role" value="${escapeHtml(role)}" />
      <label>Decision for <strong>${escapeHtml(role)}</strong>
        <select name="decision">
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
      </label>
      <label>Comment
        <textarea name="comment" placeholder="Explain the review decision."></textarea>
      </label>
      <button type="submit">Submit ${escapeHtml(role)} review</button>
    </form>`)
    .join('');

  const approvalSummary = options.workflowRun.approvals
    .map((/** @type {{ role: string, decision: string, reviewerId?: string, comment?: string, timestamp?: string }} */ approval) => `<tr>
      <td>${escapeHtml(approval.role)}</td>
      <td>${statusTag(approval.decision)}</td>
      <td>${escapeHtml(approval.reviewerId ?? 'pending')}</td>
      <td>${escapeHtml(approval.comment ?? '')}</td>
      <td>${escapeHtml(approval.timestamp ?? '')}</td>
    </tr>`)
    .join('');

  const canonicalResolutionSection = options.canResolveCanonicalization && options.canonicalDisease
    && options.canonicalDisease.resolutionStatus !== 'resolved'
    ? `<section class="surface">
      <h2>Resolve canonicalization</h2>
      <p class="muted">${escapeHtml(options.canonicalDisease.notes ?? 'Reviewer resolution required before the run can continue.')}</p>
      <form method="post" action="/review/runs/${encodeURIComponent(options.workflowRun.id)}/canonicalization-resolution">
        <label>Confirm candidate or override with an approved disease name
          <input name="selectedCanonicalDiseaseName" value="${escapeHtml(options.canonicalDisease.candidateMatches?.[0]?.canonicalDiseaseName ?? '')}" required />
        </label>
        <label>Reason
          <textarea name="reason" required>${escapeHtml('Local reviewer confirmed the intended disease before resuming the pipeline.')}</textarea>
        </label>
        <button type="submit">Resolve and continue pipeline</button>
      </form>
      <details>
        <summary>Candidate matches</summary>
        <pre>${renderJson(options.canonicalDisease.candidateMatches ?? [])}</pre>
      </details>
    </section>`
    : '';

  const auditRows = options.auditLogs
    .map((entry) => `<tr>
      <td><code>${escapeHtml(entry.id)}</code></td>
      <td>${escapeHtml(entry.action)}</td>
      <td>${escapeHtml(entry.actorId)}</td>
      <td>${statusTag(entry.outcome)}</td>
      <td>${escapeHtml(entry.reason ?? '')}</td>
      <td>${escapeHtml(entry.occurredAt)}</td>
    </tr>`)
    .join('');

  const sourceRows = (options.clinicalPackage?.sourceRecords ?? [])
    .map((/** @type {any} */ sourceRecord) => `<tr>
      <td><code>${escapeHtml(sourceRecord.id)}</code></td>
      <td>${escapeHtml(sourceRecord.sourceLabel)}</td>
      <td>${escapeHtml(sourceRecord.sourceType)}</td>
      <td>${statusTag(sourceRecord.approvalStatus)}</td>
      <td>${statusTag(sourceRecord.freshnessStatus)}</td>
      <td>${statusTag(sourceRecord.contradictionStatus)}</td>
    </tr>`)
    .join('');

  const exportRows = options.exportHistory
    .map((exportEntry) => `<tr>
      <td><code>${escapeHtml(exportEntry.releaseId)}</code></td>
      <td>${escapeHtml(exportEntry.exportedAt)}</td>
      <td>${escapeHtml(exportEntry.exportedBy)}</td>
      <td>${escapeHtml(exportEntry.evalRunId ?? 'n/a')}</td>
      <td><a href="/api/v1/release-bundles/${encodeURIComponent(exportEntry.releaseId)}">bundle</a> · <a href="/api/v1/release-bundles/${encodeURIComponent(exportEntry.releaseId)}/index">index</a> · <a href="/api/v1/release-bundles/${encodeURIComponent(exportEntry.releaseId)}/evidence-pack">evidence pack</a></td>
    </tr>`)
    .join('');

  const contradictionRows = (options.clinicalPackage?.evidenceRelationships ?? [])
    .map((/** @type {any} */ relationship) => `<tr>
      <td><code>${escapeHtml(relationship.edgeId)}</code></td>
      <td>${escapeHtml(relationship.fromClaimId)}</td>
      <td>${escapeHtml(relationship.relationshipType)}</td>
      <td>${escapeHtml(relationship.toClaimId)}</td>
      <td>${statusTag(relationship.status)}</td>
      <td>${escapeHtml(relationship.notes ?? '')}</td>
    </tr>`)
    .join('');

  const governanceRows = (options.clinicalPackage?.governanceDecisions ?? [])
    .map((/** @type {any} */ decision) => `<tr>
      <td><code>${escapeHtml(decision.id)}</code></td>
      <td>${escapeHtml(decision.sourceId)}</td>
      <td>${statusTag(decision.decision)}</td>
      <td>${escapeHtml(decision.decidedBy)}</td>
      <td>${escapeHtml(decision.occurredAt)}</td>
      <td>${escapeHtml(decision.reason ?? '')}</td>
    </tr>`)
    .join('');

  const contradictionResolutionRows = (options.clinicalPackage?.contradictionResolutions ?? [])
    .map((/** @type {any} */ resolution) => `<tr>
      <td><code>${escapeHtml(resolution.id)}</code></td>
      <td>${escapeHtml(resolution.claimId)}</td>
      <td>${escapeHtml(resolution.relatedClaimId ?? '')}</td>
      <td>${statusTag(resolution.status)}</td>
      <td>${escapeHtml(resolution.resolvedBy)}</td>
      <td>${escapeHtml(resolution.occurredAt)}</td>
    </tr>`)
    .join('');

  const sourceDecisionForms = (options.clinicalPackage?.sourceRecords ?? [])
    .map((/** @type {any} */ sourceRecord) => `<form method="post" action="/review/runs/${encodeURIComponent(options.workflowRun.id)}/source-records/${encodeURIComponent(sourceRecord.id)}/governance-decisions" class="surface">
      <h3>${escapeHtml(sourceRecord.sourceLabel)}</h3>
      <p class="muted"><code>${escapeHtml(sourceRecord.id)}</code> · ${escapeHtml(sourceRecord.sourceType)}</p>
      <label>Decision
        <select name="decision">
          <option value="approved">approve</option>
          <option value="conditional">conditionally approve</option>
          <option value="suspended">suspend</option>
          <option value="refresh-review-date">refresh review date</option>
        </select>
      </label>
      <label>Reason
        <textarea name="reason" placeholder="Record why this source should change governance state."></textarea>
      </label>
      <button type="submit">Record source decision</button>
    </form>`)
    .join('');

  const contradictionForms = (options.clinicalPackage?.evidenceRelationships ?? [])
    .filter((/** @type {any} */ relationship) => relationship.relationshipType === 'contradicts')
    .map((/** @type {any} */ relationship) => `<form method="post" action="/review/runs/${encodeURIComponent(options.workflowRun.id)}/evidence-records/${encodeURIComponent(relationship.fromClaimId)}/contradiction-resolutions" class="surface">
      <h3>${escapeHtml(relationship.fromClaimId)} ↔ ${escapeHtml(relationship.toClaimId)}</h3>
      <input type="hidden" name="relatedClaimId" value="${escapeHtml(relationship.toClaimId)}" />
      <label>Status
        <select name="status">
          ${['open', 'monitor', 'blocking', 'resolved'].map((/** @type {string} */ value) => `<option value="${escapeHtml(value)}"${relationship.status === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}
        </select>
      </label>
      <label>Reason
        <textarea name="reason" placeholder="Explain how this contradiction should now be treated.">${escapeHtml(relationship.notes ?? '')}</textarea>
      </label>
      <button type="submit">Record contradiction status</button>
    </form>`)
    .join('');

  const traceCoverage = options.clinicalPackage?.traceCoverage ?? null;
  const clinicalSummary = options.clinicalPackage?.diseasePacket?.clinicalSummary ?? null;

  return renderLayout({
    actor: options.actor,
    title: options.workflowRun.id,
    heading: `Run ${options.workflowRun.id}`,
    body: `<section class="grid two">
      <div class="surface stack">
        <h2>Run summary</h2>
        <div><strong>Project</strong>: ${escapeHtml(options.project.title)}</div>
        <div><strong>Disease</strong>: ${escapeHtml(options.workflowRun.input.diseaseName)}</div>
        <div><strong>Tenant</strong>: <code>${escapeHtml(options.workflowRun.tenantId ?? options.project.tenantId ?? 'tenant.local')}</code></div>
        <div><strong>State</strong>: ${statusTag(options.workflowRun.state)}</div>
        <div><strong>Current stage</strong>: ${statusTag(options.workflowRun.currentStage)}</div>
        <div><strong>Pause reason</strong>: ${options.workflowRun.pauseReason ? statusTag(options.workflowRun.pauseReason) : '<span class="muted">none</span>'}</div>
        <div><strong>Latest eval</strong>: ${statusTag(options.latestEvalStatus)}</div>
      </div>
      <div class="surface stack">
        <h2>Stage timeline</h2>
        ${options.workflowRun.stages.map((/** @type {{ name: string, status: string, notes?: string }} */ stage) => `<div><strong>${escapeHtml(stage.name)}</strong>: ${escapeHtml(stage.status)}${stage.notes ? ` · ${escapeHtml(stage.notes)}` : ''}</div>`).join('')}
      </div>
    </section>

    <section class="surface">
      <h2>Run actions</h2>
      <div class="grid two">
        <form method="post" action="/review/runs/${encodeURIComponent(options.workflowRun.id)}/clinical-package/rebuild">
          <p class="muted">Rebuild the clinical package after source or contradiction governance changes and invalidate downstream story artifacts.</p>
          <label>Reason
            <textarea name="reason">Rebuild the clinical package after local governance edits.</textarea>
          </label>
          <button class="warning" type="submit">Rebuild clinical package</button>
        </form>
        <form method="post" action="/review/runs/${encodeURIComponent(options.workflowRun.id)}/evaluations">
          <p class="muted">Run the deterministic local eval harness against the latest artifacts.</p>
          <button type="submit">Run evaluations</button>
        </form>
        <form method="post" action="/review/runs/${encodeURIComponent(options.workflowRun.id)}/exports">
          <label>Export version
            <input name="version" value="${escapeHtml(`${options.workflowRun.id}-local`)}" />
          </label>
          <button class="secondary" type="submit">Export bundle</button>
        </form>
      </div>
    </section>

    ${canonicalResolutionSection}

    ${options.clinicalPackage ? `<section class="surface">
      <div class="section-head">
        <h2>Clinical package summary</h2>
        <span>${statusTag(options.clinicalPackage.diseasePacket.evidenceSummary.governanceVerdict)}</span>
      </div>
      <div class="grid two">
        <div class="stack">
          <div><strong>Canonical disease</strong>: ${escapeHtml(options.clinicalPackage.diseasePacket.canonicalDiseaseName)}</div>
          <div><strong>Freshness</strong>: ${statusTag(options.clinicalPackage.diseasePacket.evidenceSummary.freshnessStatus)}</div>
          <div><strong>Contradictions</strong>: ${options.clinicalPackage.diseasePacket.evidenceSummary.contradictionCount}</div>
          <div><strong>Blocking contradictions</strong>: ${options.clinicalPackage.diseasePacket.evidenceSummary.blockingContradictions}</div>
        </div>
        <div class="stack">
          <div><strong>One sentence</strong>: ${escapeHtml(clinicalSummary?.oneSentence ?? '')}</div>
          <div><strong>Patient experience</strong>: ${escapeHtml(clinicalSummary?.patientExperienceSummary ?? '')}</div>
          <div><strong>Key mechanism</strong>: ${escapeHtml(clinicalSummary?.keyMechanism ?? '')}</div>
        </div>
      </div>
    </section>` : ''}

    <section class="surface">
      <h2>Approvals</h2>
      <table>
        <thead><tr><th>Role</th><th>Decision</th><th>Reviewer</th><th>Comment</th><th>Timestamp</th></tr></thead>
        <tbody>${approvalSummary || '<tr><td colspan="5">No approvals yet.</td></tr>'}</tbody>
      </table>
    </section>

    ${approvalForms ? `<section class="grid two">${approvalForms}</section>` : ''}

    <section class="surface">
      <div class="section-head">
        <h2>Latest eval report</h2>
        <span>${statusTag(options.latestEvalStatus)}</span>
      </div>
      ${options.latestEvalRun
        ? `<pre>${renderJson(options.latestEvalRun)}</pre>`
        : '<p class="muted">No eval run has been recorded yet for this workflow run.</p>'}
    </section>

    <section class="surface">
      <h2>Governed source records</h2>
      <table>
        <thead><tr><th>ID</th><th>Source</th><th>Type</th><th>Approval</th><th>Freshness</th><th>Contradiction</th></tr></thead>
        <tbody>${sourceRows || '<tr><td colspan="6">No governed source records available for this run yet.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="surface">
      <h2>Source governance decisions</h2>
      <table>
        <thead><tr><th>ID</th><th>Source</th><th>Decision</th><th>Actor</th><th>Occurred at</th><th>Reason</th></tr></thead>
        <tbody>${governanceRows || '<tr><td colspan="6">No source governance decisions recorded yet.</td></tr>'}</tbody>
      </table>
    </section>

    ${sourceDecisionForms ? `<section class="grid two">${sourceDecisionForms}</section>` : ''}

    <section class="surface">
      <h2>Contradiction status</h2>
      <table>
        <thead><tr><th>Edge</th><th>From claim</th><th>Relation</th><th>To claim</th><th>Status</th><th>Notes</th></tr></thead>
        <tbody>${contradictionRows || '<tr><td colspan="6">No contradiction edges were generated for this clinical package.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="surface">
      <h2>Contradiction resolutions</h2>
      <table>
        <thead><tr><th>ID</th><th>Claim</th><th>Related claim</th><th>Status</th><th>Actor</th><th>Occurred at</th></tr></thead>
        <tbody>${contradictionResolutionRows || '<tr><td colspan="6">No contradiction resolutions recorded yet.</td></tr>'}</tbody>
      </table>
    </section>

    ${contradictionForms ? `<section class="grid two">${contradictionForms}</section>` : ''}

    ${renderArtifactGroups(options.artifactGroups)}

    <section class="surface">
      <div class="section-head">
        <h2>Downstream trace coverage</h2>
        ${traceCoverage ? statusTag(traceCoverage.verdict) : ''}
      </div>
      ${traceCoverage ? `<div class="grid two">
        <div class="stack">
          <div><strong>Score</strong>: ${traceCoverage.score.toFixed(2)}</div>
          <div><strong>Valid claims</strong>: ${traceCoverage.validClaimCount}</div>
          <div><strong>Suspended sources</strong>: ${traceCoverage.suspendedSourceCount}</div>
          <div><strong>Stale sources</strong>: ${traceCoverage.staleSourceCount}</div>
          <div><strong>Blocking contradictions</strong>: ${traceCoverage.blockingContradictions}</div>
        </div>
        <div class="stack">
          <strong>Blockers</strong>
          ${traceCoverage.blockers.length > 0 ? traceCoverage.blockers.map((/** @type {string} */ blocker) => `<span>${escapeHtml(blocker)}</span>`).join('') : '<span class="muted">No traceability blockers are active.</span>'}
        </div>
      </div>
      ${renderTraceCoverageTable(traceCoverage.artifactSummaries)}`
        : '<p class="muted">Trace coverage is not available until the clinical package is generated.</p>'}
    </section>

    <section class="surface">
      <h2>Export history</h2>
      <table>
        <thead><tr><th>Release</th><th>Exported at</th><th>Actor</th><th>Eval run</th><th>Artifacts</th></tr></thead>
        <tbody>${exportRows || '<tr><td colspan="5">No exports yet.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="surface">
      <h2>Audit log</h2>
      <table>
        <thead><tr><th>ID</th><th>Action</th><th>Actor</th><th>Outcome</th><th>Reason</th><th>Occurred at</th></tr></thead>
        <tbody>${auditRows || '<tr><td colspan="6">No audit entries yet.</td></tr>'}</tbody>
      </table>
    </section>`,
  });
}

/**
 * @param {{ actor: any }} options
 * @returns {string}
 */
export function renderIntakePage(options) {
  return renderLayout({
    actor: options.actor,
    title: 'Disease Intake',
    heading: 'Disease Intake',
    body: `<section class="surface">
      <p>Seed a local project with disease, audience, length, quality, and style preferences.</p>
      <form id="intake-form">
        <label>Disease name <input name="diseaseName" value="hepatocellular carcinoma" required /></label>
        <label>Audience tier
          <select name="audienceTier">
            <option value="provider-education">provider-education</option>
            <option value="student-education">student-education</option>
            <option value="patient-friendly">patient-friendly</option>
          </select>
        </label>
        <label>Length profile
          <select name="lengthProfile">
            <option value="standard-issue">standard-issue</option>
            <option value="short-case">short-case</option>
            <option value="double-issue">double-issue</option>
          </select>
        </label>
        <label>Quality profile
          <select name="qualityProfile">
            <option value="pilot">pilot</option>
            <option value="draft">draft</option>
            <option value="flagship">flagship</option>
          </select>
        </label>
        <label>Style profile
          <select name="styleProfile">
            <option value="whimsical-mystery">whimsical-mystery</option>
            <option value="cinematic-sci-fi">cinematic-sci-fi</option>
            <option value="playful-detective">playful-detective</option>
          </select>
        </label>
        <button type="submit">Create project</button>
      </form>
      <pre id="result">Submit the form to create a local project.</pre>
    </section>
    <script>
      const form = document.getElementById('intake-form');
      const result = document.getElementById('result');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        const response = await fetch('/api/v1/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        result.textContent = JSON.stringify(await response.json(), null, 2);
      });
    </script>`,
  });
}
