import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import notifier from 'node-notifier';
import { SKIP_DIRS } from './constants.js';

const execFileAsync = promisify(execFile);

export async function findGitRepos(root, maxDepth) {
  const repos = [];
  const resolvedRoot = path.resolve(root);

  async function walk(currentPath, depth) {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch { return; }

    if (entries.some((entry) => entry.name === '.git')) {
      repos.push(currentPath);
      return;
    }

    if (depth >= maxDepth) return;

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
        .map((entry) => walk(path.join(currentPath, entry.name), depth + 1))
    );
  }

  await walk(resolvedRoot, 0);
  return repos;
}

export async function runGit(repoPath, args, timeout = 3500) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, ...args], {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    return stdout.trim();
  } catch { return ''; }
}

function parseStatus(statusText) {
  const lines = statusText.split(/\r?\n/).filter(Boolean);
  const header = lines[0] || '';
  const changes = lines.slice(1);
  const aheadMatch = header.match(/ahead (\d+)/);
  const behindMatch = header.match(/behind (\d+)/);
  const counts = { added: 0, modified: 0, deleted: 0, renamed: 0, untracked: 0, conflicted: 0 };

  for (const line of changes) {
    const index = line[0] || ' ';
    const worktree = line[1] || ' ';
    if (line.startsWith('??')) { counts.untracked += 1; continue; }
    if (index === 'U' || worktree === 'U' || (index === 'A' && worktree === 'A')) { counts.conflicted += 1; }
    for (const marker of [index, worktree]) {
      if (marker === 'A') counts.added += 1;
      if (marker === 'M') counts.modified += 1;
      if (marker === 'D') counts.deleted += 1;
      if (marker === 'R') counts.renamed += 1;
    }
  }

  return {
    ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
    behind: behindMatch ? Number(behindMatch[1]) : 0,
    dirtyCount: changes.length,
    counts
  };
}

function parseLastCommit(lastCommitText) {
  if (!lastCommitText) return null;
  const [hash, timestamp, ...subjectParts] = lastCommitText.split('\t');
  return {
    hash,
    subject: subjectParts.join('\t') || 'No commit message',
    timestamp: Number(timestamp) * 1000
  };
}

async function detectLanguages(repoPath) {
  const extensionMap = {
    '.js': 'JavaScript', '.jsx': 'React', '.ts': 'TypeScript', '.tsx': 'React TS',
    '.css': 'CSS', '.scss': 'SCSS', '.html': 'HTML', '.py': 'Python',
    '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.kt': 'Kotlin',
    '.cs': 'C#', '.php': 'PHP', '.rb': 'Ruby', '.swift': 'Swift',
    '.dart': 'Dart', '.vue': 'Vue', '.svelte': 'Svelte', '.md': 'Markdown'
  };
  const counts = new Map();
  let inspected = 0;

  async function walk(currentPath, depth) {
    if (depth > 3 || inspected > 350) return;
    let entries;
    try { entries = await fs.readdir(currentPath, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (inspected > 350) return;
      const nextPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(nextPath, depth + 1);
        continue;
      }
      inspected += 1;
      const language = extensionMap[path.extname(entry.name).toLowerCase()];
      if (language) counts.set(language, (counts.get(language) || 0) + 1);
    }
  }

  await walk(repoPath, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
}

function calculateHealth({ status, remoteUrl, lastCommit }) {
  let score = 100;
  score -= Math.min(status.dirtyCount * 4, 30);
  score -= Math.min(status.ahead * 6, 18);
  score -= Math.min(status.behind * 8, 24);
  if (!remoteUrl) score -= 10;
  if (lastCommit?.timestamp) {
    const daysSinceCommit = Math.floor((Date.now() - lastCommit.timestamp) / 86_400_000);
    if (daysSinceCommit > 30) score -= 20;
    else if (daysSinceCommit > 7) score -= 10;
  } else score -= 20;
  return Math.max(0, Math.min(100, score));
}

function deriveAttention(status, health, lastCommit) {
  const items = [];
  if (status.counts.conflicted) items.push('Resolve conflicts');
  if (status.behind) items.push(`Pull ${status.behind} behind`);
  if (status.ahead) items.push(`Push ${status.ahead} ahead`);
  if (status.dirtyCount) items.push(`Review ${status.dirtyCount} change${status.dirtyCount === 1 ? '' : 's'}`);
  if (lastCommit?.timestamp && Math.floor((Date.now() - lastCommit.timestamp) / 86_400_000) > 30) {
    items.push('Stale for 30+ days');
  }
  if (health >= 90 && !items.length) items.push('Looks calm');
  return items;
}

export async function summarizeRepo(repoPath, meta = {}) {
  const [branch, remoteUrl, upstream, statusText, commitCountText, lastCommitText] = await Promise.all([
    runGit(repoPath, ['branch', '--show-current']),
    runGit(repoPath, ['config', '--get', 'remote.origin.url']),
    runGit(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']),
    runGit(repoPath, ['status', '--porcelain=v1', '-b']),
    runGit(repoPath, ['rev-list', '--count', 'HEAD']),
    runGit(repoPath, ['log', '-1', '--format=%h%x09%ct%x09%s'])
  ]);
  const status = parseStatus(statusText);
  const lastCommit = parseLastCommit(lastCommitText);
  const languages = await detectLanguages(repoPath);
  const health = calculateHealth({ status, remoteUrl, lastCommit });
  
  let pkgScripts = null;
  try {
    const pkgText = await fs.readFile(path.join(repoPath, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgText);
    pkgScripts = pkg.scripts ? Object.keys(pkg.scripts) : [];
  } catch {}

  return {
    path: repoPath,
    name: path.basename(repoPath),
    branch: branch || 'detached',
    remoteUrl,
    upstream,
    commitCount: Number(commitCountText) || 0,
    lastCommit,
    languages,
    status,
    health,
    scripts: pkgScripts,
    attention: deriveAttention(status, health, lastCommit),
    pinned: Boolean(meta.pinned),
    note: meta.note || '',
    tags: Array.isArray(meta.tags) ? meta.tags : []
  };
}

export async function scanRepos(config, meta) {
  const repoPaths = new Set();
  const errors = [];
  for (const root of config.roots) {
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) { errors.push(`${root} is not a directory`); continue; }
      const found = await findGitRepos(root, config.maxDepth);
      found.forEach((repoPath) => repoPaths.add(path.resolve(repoPath)));
    } catch { errors.push(`Could not read ${root}`); }
  }

  const repos = await Promise.all([...repoPaths].sort((a, b) => a.localeCompare(b)).map((repoPath) => summarizeRepo(repoPath, meta[repoPath])));
  repos.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.health - b.health || a.name.localeCompare(b.name));

  const highRiskRepos = repos.filter((r) => r.health < 60 || r.status.behind > 10 || r.status.dirtyCount > 15);
  if (highRiskRepos.length > 0) {
    notifier.notify({
      title: 'RepoTracker Risk Alert',
      message: `${highRiskRepos.length} repos need attention (e.g. ${highRiskRepos[0].name})`,
      sound: true
    });
  }

  return {
    scannedAt: new Date().toISOString(),
    roots: config.roots,
    maxDepth: config.maxDepth,
    errors,
    repos
  };
}
