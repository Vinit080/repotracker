import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import util from 'node:util';
import { WORKSPACE_DIR, CONFIG_FILE, ACTIVITY_FILE, META_FILE } from './constants.js';
import { readJson, writeJson } from './utils.js';

const execFileAsync = util.promisify(execFile);

// Helper to run git commands in the workspace dir
async function gitCmd(args, env = {}) {
  const git = process.platform === 'win32' ? 'git.exe' : 'git';
  return execFileAsync(git, args, { cwd: WORKSPACE_DIR, env: { ...process.env, ...env } });
}

/**
 * Ensures the workspace repository is cloned and configured.
 */
export async function initWorkspace(repoUrl, githubPat, userName) {
  if (!repoUrl || !githubPat || !userName) throw new Error('Missing repo URL, PAT, or username');
  
  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`${userName}:${githubPat}`).toString('base64')}`;

  try {
    const stat = await fs.stat(WORKSPACE_DIR);
    if (stat.isDirectory()) {
      // Already cloned, update the remote URL to ensure it doesn't contain a leaked PAT
      await gitCmd(['remote', 'set-url', 'origin', repoUrl]);
      return;
    }
  } catch (e) {
    // Doesn't exist, proceed to clone
  }

  const parentDir = path.dirname(WORKSPACE_DIR);
  await fs.mkdir(parentDir, { recursive: true });
  
  const git = process.platform === 'win32' ? 'git.exe' : 'git';
  await execFileAsync(git, ['-c', `http.extraHeader=${authHeader}`, 'clone', repoUrl, WORKSPACE_DIR], { cwd: parentDir });
  
  // Set local git config for commits
  await gitCmd(['config', 'user.name', userName]);
  await gitCmd(['config', 'user.email', `${userName}@repotracker.local`]);
}

/**
 * Syncs the local data to the shared workspace repository.
 * Uses a user-scoped directory approach to avoid merge conflicts.
 */
export async function syncWorkspace(config) {
  if (!config.workspaceRepo || !config.githubPat || !config.userName) {
    return { error: 'Workspace not configured properly.' };
  }

  const { userName, githubPat } = config;
  const userDir = path.join(WORKSPACE_DIR, 'data', userName);
  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`${userName}:${githubPat}`).toString('base64')}`;

  try {
    // 1. Pull latest from remote
    try {
      await gitCmd(['-c', `http.extraHeader=${authHeader}`, 'pull', '--rebase', 'origin', 'main']);
    } catch (e) {
      console.warn('[Sync] Pull failed or branch missing. If empty repo, continuing...', e.message);
    }

    // 2. Read local state
    const localActivity = await readJson(ACTIVITY_FILE, []);
    const localMeta = await readJson(META_FILE, {});

    // 3. Write local state to our user-scoped folder in the workspace
    await fs.mkdir(userDir, { recursive: true });
    await writeJson(path.join(userDir, 'activity.json'), localActivity);
    await writeJson(path.join(userDir, 'repo-meta.json'), localMeta);

    // 4. Commit and push
    await gitCmd(['add', '.']);
    
    // Check if there are changes to commit
    const { stdout: status } = await gitCmd(['status', '--porcelain']);
    if (status.trim()) {
      await gitCmd(['commit', '-m', `sync: update state for ${userName}`]);
      await gitCmd(['-c', `http.extraHeader=${authHeader}`, 'push', 'origin', 'HEAD:main']);
    }

    return { ok: true, syncedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[Sync Error]', err);
    return { error: 'Failed to sync workspace: ' + err.message };
  }
}

/**
 * Reads the aggregated state of all team members from the workspace.
 */
export async function getWorkspaceState() {
  const dataDir = path.join(WORKSPACE_DIR, 'data');
  let aggregatedActivity = [];
  let aggregatedMeta = {};

  try {
    const users = await fs.readdir(dataDir);
    for (const user of users) {
      const userPath = path.join(dataDir, user);
      const stat = await fs.stat(userPath);
      if (!stat.isDirectory()) continue;

      const userActivity = await readJson(path.join(userPath, 'activity.json'), []);
      const userMeta = await readJson(path.join(userPath, 'repo-meta.json'), {});

      // Add username to activity events so UI knows who did what
      const taggedActivity = userActivity.map(event => ({ ...event, user }));
      aggregatedActivity = aggregatedActivity.concat(taggedActivity);

      // Add username to meta object keys to avoid path collisions
      for (const [repoPath, meta] of Object.entries(userMeta)) {
        aggregatedMeta[`${user}::${repoPath}`] = { ...meta, user };
      }
    }
  } catch (err) {
    // If directory doesn't exist, return empty (e.g., first run)
  }

  // Sort activity by timestamp descending
  aggregatedActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    activity: aggregatedActivity,
    meta: aggregatedMeta
  };
}
