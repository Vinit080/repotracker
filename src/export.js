/**
 * RepoTracker — Dashboard HTML Snapshot Exporter
 *
 * Generates a self-contained, zero-dependency HTML file that renders
 * the current RepoTracker dashboard state. No server needed to view it.
 *
 * Shareable on: GitHub Pages, Notion, email, Slack — anywhere.
 */

/**
 * Export a snapshot of the current dashboard state as a standalone HTML file.
 * @param {object} scanData   - { repos, commits }
 * @param {object} config     - sanitized config (userName, etc.)
 * @returns {string}          - complete HTML document (UTF-8)
 */
export function generateDashboardExport(scanData, config) {
  const { repos = [] } = scanData;
  const local = repos.filter(r => !r.isCloud);
  const avgHealth = local.length
    ? Math.round(local.reduce((s, r) => s + (r.health ?? 0), 0) / local.length)
    : 0;
  const dirty = local.filter(r => r.status?.dirtyCount > 0).length;
  const behind = local.filter(r => r.status?.behind > 0).length;
  const clean = local.filter(r => r.status?.dirtyCount === 0 && r.status?.behind === 0).length;
  const spotlight = [...local].sort((a, b) => (b.health ?? 0) - (a.health ?? 0))[0];
  const attention = local.filter(r => (r.attention || []).length > 0).slice(0, 6);
  const now = new Date().toLocaleString();
  const user = config?.userName ? `${config.userName}'s` : 'Team';

  const healthColor = (h) => h >= 80 ? '#22c55e' : h >= 60 ? '#f59e0b' : '#ef4444';

  const repoCards = local.slice(0, 30).map(repo => {
    const h = repo.health ?? 0;
    const col = healthColor(h);
    const branch = repo.branch ? `<span style="background:#1e293b;padding:2px 8px;border-radius:99px;font-size:11px;">${escHtml(repo.branch)}</span>` : '';
    const dirty_chip = repo.status?.dirtyCount > 0 ? `<span style="background:#78350f22;color:#f59e0b;padding:2px 8px;border-radius:99px;font-size:11px;">${repo.status.dirtyCount} changed</span>` : '';
    const behind_chip = repo.status?.behind > 0 ? `<span style="background:#7f1d1d22;color:#ef4444;padding:2px 8px;border-radius:99px;font-size:11px;">behind ${repo.status.behind}</span>` : '';
    return `
    <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:15px;">${escHtml(repo.name)}</div>
          <div style="color:#64748b;font-size:11px;font-family:monospace;">${escHtml(repo.path)}</div>
        </div>
        <div style="width:44px;height:44px;border-radius:50%;border:3px solid ${col};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:${col};">${h}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${branch}${dirty_chip}${behind_chip}</div>
      ${repo.lastCommit ? `<div style="color:#64748b;font-size:11px;">${escHtml(repo.lastCommit.subject)}</div>` : ''}
    </div>`;
  }).join('\n');

  const attentionRows = attention.map(r =>
    `<div style="padding:8px 12px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;">
       <span>${escHtml(r.name)}</span>
       <span style="color:#64748b;font-size:12px;">${(r.attention || []).join(' · ')}</span>
     </div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(user)} RepoTracker Dashboard — ${now}</title>
  <meta name="description" content="RepoTracker dashboard snapshot — ${local.length} repositories, avg health ${avgHealth}%">
  <meta property="og:title" content="${escHtml(user)} RepoTracker Dashboard">
  <meta property="og:description" content="${local.length} repos tracked · avg health ${avgHealth}% · ${dirty} dirty · ${behind} behind">
  <meta property="og:type" content="website">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#020817;color:#e2e8f0;font-family:'Inter',sans-serif;min-height:100vh;padding:32px 24px}
    .metric{background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;text-align:center}
    .metric span{display:block;color:#64748b;font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
    .metric strong{font-size:2.5rem;font-weight:900}
  </style>
</head>
<body>
  <div style="max-width:1100px;margin:0 auto;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:16px;">
      <div>
        <p style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">Dashboard Snapshot</p>
        <h1 style="font-size:2rem;font-weight:900;background:linear-gradient(90deg,#e2e8f0,#6366f1);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">${escHtml(user)} Repositories</h1>
        <p style="color:#64748b;font-size:13px;margin-top:4px;">Generated ${now} · Powered by <a href="https://github.com/Vinit080/repotracker" style="color:#6366f1;">RepoTracker</a></p>
      </div>
      <div style="text-align:right;">
        <div style="font-size:3rem;font-weight:900;color:${healthColor(avgHealth)};">${avgHealth}%</div>
        <div style="color:#64748b;font-size:12px;">avg ecosystem health</div>
      </div>
    </div>

    <!-- Metrics -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px;">
      <div class="metric"><span>Total Repos</span><strong>${local.length}</strong></div>
      <div class="metric"><span>Clean</span><strong style="color:#22c55e;">${clean}</strong></div>
      <div class="metric"><span>Dirty</span><strong style="color:#f59e0b;">${dirty}</strong></div>
      <div class="metric"><span>Behind</span><strong style="color:#ef4444;">${behind}</strong></div>
      <div class="metric"><span>Avg Health</span><strong style="color:${healthColor(avgHealth)};">${avgHealth}%</strong></div>
    </div>

    ${spotlight ? `
    <!-- Spotlight -->
    <div style="background:linear-gradient(135deg,#1e1b4b,#0f172a);border:1px solid #312e81;border-radius:16px;padding:24px;margin-bottom:32px;">
      <p style="color:#818cf8;font-size:12px;font-weight:700;letter-spacing:.08em;margin-bottom:4px;">⭐ SPOTLIGHT</p>
      <h2 style="font-size:1.4rem;font-weight:800;">${escHtml(spotlight.name)}</h2>
      <p style="color:#64748b;font-size:12px;margin-top:4px;">Health: ${spotlight.health}% · ${escHtml(spotlight.branch || '')} · ${spotlight.status?.dirtyCount ?? 0} changes</p>
    </div>` : ''}

    <!-- Attention Queue -->
    ${attention.length ? `
    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:12px;">⚠️ Attention Queue</h2>
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
        ${attentionRows}
      </div>
    </div>` : ''}

    <!-- Repo Grid -->
    <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px;">All Repositories</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:48px;">
      ${repoCards}
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px;border-top:1px solid #1e293b;color:#475569;font-size:12px;">
      <a href="https://github.com/Vinit080/repotracker" style="color:#6366f1;text-decoration:none;font-weight:600;">⭐ Star RepoTracker on GitHub</a>
      &nbsp;·&nbsp; Generated by RepoTracker v0.2.0
    </div>
  </div>
</body>
</html>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
