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
    ? `<p class="actor">Signed in as <strong>${escapeHtml(options.actor.displayName)}</strong> (${escapeHtml(options.actor.id)}) in <code>${escapeHtml(options.actor.tenantId)}</code>.</p>`
    : '';
  const nav = options.actor
    ? `<nav><a href="/review">Review dashboard</a><a href="/intake">Intake</a><a href="/session/logout">Sign out</a></nav>`
    : `<nav><a href="/signin">Sign in</a></nav>`;

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
        --danger: #b42318;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        color: var(--ink);
        background: var(--bg);
      }
      header, main { max-width: 76rem; margin: 0 auto; padding: 1.5rem; }
      header { padding-bottom: 0.5rem; }
      nav { display: flex; gap: 1rem; margin-bottom: 1rem; }
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
      .danger { color: var(--danger); }
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
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
      pre { margin: 0; padding: 1rem; overflow: auto; background: #f8fafc; border-radius: 0.75rem; border: 1px solid var(--line); }
      details { border: 1px solid var(--line); border-radius: 0.75rem; padding: 0.75rem 1rem; background: #fbfdff; }
      summary { cursor: pointer; font-weight: 700; }
      .artifact-list { display: grid; gap: 0.75rem; }
      .muted { color: var(--muted); }
      .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
      .stack { display: grid; gap: 0.5rem; }
      code { background: #eef2f6; padding: 0.1rem 0.35rem; border-radius: 0.35rem; }
    </style>
  </head>
  <body>
    <header>
      ${nav}
      <h1>${escapeHtml(options.heading)}</h1>
      ${actorBadge}
    </header>
    <main>${options.body}</main>
  </body>
</html>`;
}

/**
 * @param {{ demoUsers: any[], redirectTo: string, demoPassword: string }} options
 * @returns {string}
 */
export function renderSignInPage(options) {
  const cards = options.demoUsers
    .map((user) => `<div class="surface">
      <h2>${escapeHtml(user.displayName)}</h2>
      <p class="muted mono">${escapeHtml(user.email)} · ${escapeHtml(user.tenantId)}</p>
      <div>${user.roles.map((/** @type {string} */ role) => `<span class="tag">${escapeHtml(role)}</span>`).join('')}</div>
    </div>`)
    .join('');

  return renderLayout({
    title: 'Sign in',
    heading: 'Developer Sign-in',
    body: `<section class="surface">
      <p>This starter flow now uses persisted tenants, users, and server-side sessions. Local password login remains available for development, and an OIDC assertion exchange endpoint is available for enterprise SSO wiring.</p>
      <p class="muted">After sign-in, you will be sent to <code>${escapeHtml(options.redirectTo)}</code>.</p>
      <form method="post" action="/session/login">
        <input type="hidden" name="redirectTo" value="${escapeHtml(options.redirectTo)}" />
        <label>Tenant slug
          <input name="tenantSlug" value="studio-demo" required />
        </label>
        <label>Email
          <input name="email" value="${escapeHtml(options.demoUsers[0]?.email ?? '')}" required />
        </label>
        <label>Password
          <input type="password" name="password" value="${escapeHtml(options.demoPassword)}" required />
        </label>
        <button type="submit">Sign in with local password</button>
      </form>
      <details>
        <summary>OIDC assertion exchange</summary>
        <form method="post" action="/session/oidc-exchange">
          <input type="hidden" name="redirectTo" value="${escapeHtml(options.redirectTo)}" />
          <label>Starter OIDC assertion
            <textarea name="idToken" placeholder="Paste the HS256 starter OIDC assertion here."></textarea>
          </label>
          <button class="secondary" type="submit">Exchange OIDC assertion</button>
        </form>
      </details>
      <p class="muted">Default demo password: <code>${escapeHtml(options.demoPassword)}</code>. Change it with <code>DEMO_LOCAL_PASSWORD</code> before sharing the environment.</p>
    </section>
    <section class="grid two">${cards}</section>`,
  });
}

/**
 * @param {{ actor: any, workflowRuns: any[], projectsById: Map<string, any> }} options
 * @returns {string}
 */
export function renderReviewDashboard(options) {
  const rows = options.workflowRuns
    .map((workflowRun) => {
      const project = options.projectsById.get(workflowRun.projectId);
      const diseaseName = workflowRun.input?.diseaseName ?? project?.input?.diseaseName ?? 'Unknown disease';
      return `<tr>
        <td><a href="/review/runs/${encodeURIComponent(workflowRun.id)}"><code>${escapeHtml(workflowRun.id)}</code></a></td>
        <td>${escapeHtml(project?.title ?? 'Untitled project')}</td>
        <td>${escapeHtml(diseaseName)}</td>
        <td>${escapeHtml(workflowRun.state)}</td>
        <td>${escapeHtml(workflowRun.currentStage)}</td>
        <td>${workflowRun.approvals.map((/** @type {{ role: string, decision: string }} */ approval) => `<span class="tag">${escapeHtml(approval.role)}:${escapeHtml(approval.decision)}</span>`).join('')}</td>
      </tr>`;
    })
    .join('');

  return renderLayout({
    actor: options.actor,
    title: 'Review dashboard',
    heading: 'Review Dashboard',
    body: `<section class="surface">
      <p>Inspect starter runs, resolve ambiguous disease intake, and record review approvals before export.</p>
      <div class="actions">
        <a href="/intake">Create another project</a>
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
            <th>Approvals</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6">No runs yet.</td></tr>'}</tbody>
      </table>
    </section>`,
  });
}

/**
 * @param {Array<{ artifactType: string, artifactId: string, artifact: any }>} artifacts
 * @returns {string}
 */
function renderArtifactSections(artifacts) {
  return artifacts
    .map((/** @type {{ artifactType: string, artifactId: string, artifact: any }} */ entry) => `<details>
      <summary>${escapeHtml(entry.artifactType)} · <code>${escapeHtml(entry.artifactId)}</code></summary>
      <pre>${renderJson(entry.artifact)}</pre>
    </details>`)
    .join('');
}

/**
 * @param {{ actor: any, project: any, workflowRun: any, artifacts: Array<{ artifactType: string, artifactId: string, artifact: any }>, auditLogs: any[], canonicalDisease: any | null, canResolveCanonicalization: boolean, approvableRoles: string[] }} options
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
    .map((/** @type {{ role: string, decision: string, reviewerId?: string, comment?: string }} */ approval) => `<tr>
      <td>${escapeHtml(approval.role)}</td>
      <td>${escapeHtml(approval.decision)}</td>
      <td>${escapeHtml(approval.reviewerId ?? 'pending')}</td>
      <td>${escapeHtml(approval.comment ?? '')}</td>
    </tr>`)
    .join('');

  const canonicalResolutionSection = options.canResolveCanonicalization && options.canonicalDisease
    && options.canonicalDisease.resolutionStatus !== 'resolved'
    ? `<section class="surface">
      <h2>Resolve canonicalization</h2>
      <p class="danger">${escapeHtml(options.canonicalDisease.notes ?? 'Reviewer resolution required before the run can continue.')}</p>
      <form method="post" action="/review/runs/${encodeURIComponent(options.workflowRun.id)}/canonicalization-resolution">
        <label>Confirm candidate or override with an approved disease name
          <input name="selectedCanonicalDiseaseName" value="${escapeHtml(options.canonicalDisease.candidateMatches?.[0]?.canonicalDiseaseName ?? '')}" required />
        </label>
        <label>Reason
          <textarea name="reason" required>${escapeHtml('Clinician reviewed the ambiguous intake and confirmed the intended disease.')}</textarea>
        </label>
        <button type="submit">Resolve and continue pipeline</button>
      </form>
      <div class="surface">
        <h3>Candidate matches</h3>
        <pre>${renderJson(options.canonicalDisease.candidateMatches ?? [])}</pre>
      </div>
    </section>`
    : '';

  const auditRows = options.auditLogs
    .map((/** @type {{ id: string, action: string, actorId: string, outcome: string, reason?: string, occurredAt: string }} */ entry) => `<tr>
      <td><code>${escapeHtml(entry.id)}</code></td>
      <td>${escapeHtml(entry.action)}</td>
      <td>${escapeHtml(entry.actorId)}</td>
      <td>${escapeHtml(entry.outcome)}</td>
      <td>${escapeHtml(entry.reason ?? '')}</td>
      <td>${escapeHtml(entry.occurredAt)}</td>
    </tr>`)
    .join('');

  return renderLayout({
    actor: options.actor,
    title: options.workflowRun.id,
    heading: `Run ${options.workflowRun.id}`,
    body: `<section class="grid two">
      <div class="surface stack">
        <h2>Run summary</h2>
        <div><strong>Project</strong>: ${escapeHtml(options.project.title)}</div>
        <div><strong>Disease</strong>: ${escapeHtml(options.workflowRun.input.diseaseName)}</div>
        <div><strong>Tenant</strong>: <code>${escapeHtml(options.workflowRun.tenantId ?? options.project.tenantId ?? 'tenant.demo')}</code></div>
        <div><strong>State</strong>: ${escapeHtml(options.workflowRun.state)}</div>
        <div><strong>Current stage</strong>: ${escapeHtml(options.workflowRun.currentStage)}</div>
        <div><strong>Required approvals</strong>: ${options.workflowRun.requiredApprovalRoles.map((/** @type {string} */ role) => `<span class="tag">${escapeHtml(role)}</span>`).join('')}</div>
      </div>
      <div class="surface stack">
        <h2>Stage timeline</h2>
        ${options.workflowRun.stages.map((/** @type {{ name: string, status: string, notes?: string }} */ stage) => `<div><strong>${escapeHtml(stage.name)}</strong>: ${escapeHtml(stage.status)}${stage.notes ? ` · ${escapeHtml(stage.notes)}` : ''}</div>`).join('')}
      </div>
    </section>

    ${canonicalResolutionSection}

    <section class="surface">
      <h2>Approvals</h2>
      <table>
        <thead><tr><th>Role</th><th>Decision</th><th>Reviewer</th><th>Comment</th></tr></thead>
        <tbody>${approvalSummary}</tbody>
      </table>
    </section>

    ${approvalForms ? `<section class="grid two">${approvalForms}</section>` : ''}

    <section class="surface">
      <h2>Artifacts</h2>
      <div class="artifact-list">${renderArtifactSections(options.artifacts)}</div>
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
      <p>Seed a starter project with disease, audience, length, quality, and style preferences.</p>
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
      <pre id="result">Submit the form to create a project in the signed-in tenant.</pre>
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
