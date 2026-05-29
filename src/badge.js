/**
 * RepoTracker — SVG Health Badge Generator
 *
 * Produces shields.io-style badges embeddable in any README or webpage.
 * Pure SVG — zero external dependencies, works offline.
 *
 * Usage (when running in Team Mode on a VPS):
 *   <img src="http://team.example.com:4177/badge/health.svg?path=/repos/myapp">
 */

const COLORS = {
  great:   '#22c55e', // green  — score ≥ 80
  good:    '#f59e0b', // amber  — score ≥ 60
  poor:    '#ef4444', // red    — score <  60
  unknown: '#6b7280', // grey   — no data
};

function scoreColor(score) {
  if (typeof score !== 'number') return COLORS.unknown;
  if (score >= 80) return COLORS.great;
  if (score >= 60) return COLORS.good;
  return COLORS.poor;
}

/**
 * Generates a shields.io-style flat badge SVG.
 * @param {string} label  - left label text
 * @param {string} value  - right value text
 * @param {string} color  - right panel fill color (hex)
 */
function flatBadge(label, value, color) {
  const lw = label.length * 6.5 + 10;
  const vw = value.length * 6.5 + 10;
  const tw = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${tw}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
    <rect width="${tw}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${lw / 2}" y="14">${label}</text>
    <text x="${lw + vw / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${lw + vw / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

/**
 * Generate a health-score badge for a repo.
 * @param {object|null} repo  - repo data from the scan, or null if not found
 */
export function healthBadge(repo) {
  if (!repo) return flatBadge('RepoTracker', 'unknown', COLORS.unknown);
  const score = repo.health ?? 0;
  const label = 'health';
  const value = `${score}%`;
  return flatBadge(label, value, scoreColor(score));
}

/**
 * Generate a repo status badge (clean / dirty / behind / ahead).
 * @param {object|null} repo  - repo data from the scan
 */
export function statusBadge(repo) {
  if (!repo) return flatBadge('RepoTracker', 'unknown', COLORS.unknown);
  let value = 'clean';
  let color = COLORS.great;
  if (repo.status?.behind > 0)      { value = 'behind';  color = COLORS.poor; }
  else if (repo.status?.ahead > 0)  { value = 'ahead';   color = COLORS.good; }
  else if (repo.status?.dirtyCount > 0) { value = 'dirty'; color = COLORS.good; }
  return flatBadge('repo', value, color);
}

/**
 * Generate an ecosystem summary badge (N repos, avg health).
 * @param {object[]} repos  - full repos array
 */
export function ecosystemBadge(repos) {
  if (!repos?.length) return flatBadge('RepoTracker', 'no repos', COLORS.unknown);
  const avg = Math.round(repos.reduce((s, r) => s + (r.health ?? 0), 0) / repos.length);
  return flatBadge('ecosystem', `${repos.length} repos · ${avg}%`, scoreColor(avg));
}
