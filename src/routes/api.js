import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { CONFIG_FILE, META_FILE, DEFAULT_CONFIG } from '../constants.js';
import { readJson, writeJson, writeJsonIfMissing, normalizeConfig, readRequestJson, sendJson, sanitizeConfigForResponse } from '../utils.js';
import { scanRepos, runGit } from '../git.js';
import { hashPassword, verifyPassword, createSession, isValidSession } from '../security.js';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const activeTasks = new Map(); // taskId -> child_process

// ── Security helpers ──────────────────────────────────────────────────────────

/** Ensure a resolved path is inside one of the user's configured root dirs. */
function isPathWithinRoots(resolvedPath, roots) {
  return roots.some(root => {
    const r = path.resolve(root);
    return resolvedPath === r || resolvedPath.startsWith(r + path.sep);
  });
}

/** Only allow https:// clone URLs and reject shell metacharacters. */
function isValidHttpsUrl(url) {
  try {
    if (/["'$`\\]/.test(url)) return false;
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Repo names must be simple filesystem-safe strings (no shell meta-chars). */
function isValidRepoName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(name);
}

/** Validate a git-grep query: reject null bytes and excessive length. */
function sanitizeSearchQuery(query) {
  if (typeof query !== 'string') return null;
  if (query.includes('\0')) return null;
  if (query.length > 200) return null;
  return query;
}

export async function handleApi(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const config = normalizeConfig(await readJson(CONFIG_FILE, DEFAULT_CONFIG));

  // M1: Enforce Content-Type on state-changing requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const ct = request.headers['content-type'] || '';
    if (!ct.startsWith('application/json')) {
      sendJson(response, 415, { error: 'Content-Type must be application/json' });
      return;
    }
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/suggest-roots') {
    const home = os.homedir();
    const commonPaths = [
      path.join(home, 'Projects'),
      path.join(home, 'source', 'repos'),
      path.join(home, 'Documents', 'GitHub'),
      path.join(home, 'Development'),
      path.join(home, 'Code'),
      path.join(home, 'workspace'),
      path.join(home, 'Documents'),
      path.join(home, 'Desktop')
    ];

    const existingPaths = [];
    for (const p of commonPaths) {
      try {
        if ((await fs.stat(p)).isDirectory()) existingPaths.push(p);
      } catch (e) { }
    }
    sendJson(response, 200, { suggestions: existingPaths });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/login') {
    const body = await readRequestJson(request);

    // C1: Backward-compat migration — hash any remaining plaintext password
    if (config.appPassword && !config.appPasswordHash) {
      const hashed = hashPassword(config.appPassword);
      const migrated = normalizeConfig({ ...config, appPasswordHash: hashed });
      delete migrated.appPassword;
      await writeJson(CONFIG_FILE, migrated);
      config.appPasswordHash = hashed;
    }

    if (!config.appPasswordHash) {
      // No password configured — issue a session token so the client has one
      sendJson(response, 200, { ok: true, token: createSession() });
    } else if (verifyPassword(body.password ?? '', config.appPasswordHash)) {
      sendJson(response, 200, { ok: true, token: createSession() });
    } else {
      sendJson(response, 401, { error: 'Incorrect password' });
    }
    return;
  }

  // C1/H2: Session-based auth — raw password is never sent after login
  if (config.appPasswordHash) {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!isValidSession(token)) {
      sendJson(response, 401, { error: 'Unauthorized', userName: config.userName || '' });
      return;
    }
  }

  // C2: Return sanitized config — never expose raw API keys or password hash
  if (request.method === 'GET' && requestUrl.pathname === '/api/config') {
    sendJson(response, 200, sanitizeConfigForResponse(config));
    return;
  }

  // H1: Pick only known keys from the request body; handle masked sentinels
  if (request.method === 'PUT' && requestUrl.pathname === '/api/config') {
    const body = await readRequestJson(request);
    const MASK = '\u2022\u2022\u2022 (saved)';

    // Sensitive fields: keep existing value when client sends the mask sentinel
    const githubPat      = body.githubPat      === MASK ? config.githubPat      : (typeof body.githubPat      === 'string' ? body.githubPat      : config.githubPat);
    const aiApiKey       = body.aiApiKey        === MASK ? config.aiApiKey       : (typeof body.aiApiKey        === 'string' ? body.aiApiKey        : config.aiApiKey);
    const wakatimeApiKey = body.wakatimeApiKey  === MASK ? config.wakatimeApiKey : (typeof body.wakatimeApiKey  === 'string' ? body.wakatimeApiKey  : config.wakatimeApiKey);

    // Password: empty = keep existing; non-empty = hash and store new
    let { appPasswordHash } = config;
    if (typeof body.appPassword === 'string' && body.appPassword !== '') {
      appPasswordHash = hashPassword(body.appPassword);
    }
    // Explicit clear: frontend sends clearPassword: true
    if (body.clearPassword === true) appPasswordHash = '';

    const updatedConfig = normalizeConfig({
      roots:          body.roots,
      maxDepth:       body.maxDepth,
      userName:       body.userName,
      githubPat,
      aiApiKey,
      wakatimeApiKey,
      appPasswordHash
    });
    await writeJson(CONFIG_FILE, updatedConfig);
    sendJson(response, 200, sanitizeConfigForResponse(updatedConfig));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/repos') {
    const meta = await readJson(META_FILE, {});
    sendJson(response, 200, await scanRepos(config, meta));
    return;
  }

  if (request.method === 'PATCH' && requestUrl.pathname === '/api/repos/meta') {
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
    if (!repoPath) {
      sendJson(response, 400, { error: 'Missing repo path' });
      return;
    }
    if (!isPathWithinRoots(repoPath, config.roots)) {
      sendJson(response, 403, { error: 'Path outside configured roots' });
      return;
    }
    const meta = await readJson(META_FILE, {});
    meta[repoPath] = {
      ...(meta[repoPath] || {}),
      pinned: typeof body.pinned === 'boolean' ? body.pinned : Boolean(meta[repoPath]?.pinned),
      note: typeof body.note === 'string' ? body.note.slice(0, 800) : meta[repoPath]?.note || '',
      tags: Array.isArray(body.tags) ? body.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 12) : meta[repoPath]?.tags || []
    };
    await writeJson(META_FILE, meta);
    sendJson(response, 200, meta[repoPath]);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/timeline') {
    const meta = await readJson(META_FILE, {});
    const scanData = await scanRepos(config, meta);
    const allCommits = [];
    await Promise.all(scanData.repos.map(async (repo) => {
      const logs = await runGit(repo.path, ['log', '-10', '--format=%h%x09%ct%x09%s%x09%an']);
      if (logs) {
        logs.split(/\r?\n/).forEach(line => {
          const [hash, timestamp, subject, author] = line.split('\t');
          if (hash && timestamp) {
            allCommits.push({ repoName: repo.name, repoPath: repo.path, hash, timestamp: Number(timestamp) * 1000, subject, author });
          }
        });
      }
    }));
    allCommits.sort((a, b) => b.timestamp - a.timestamp);
    sendJson(response, 200, allCommits.slice(0, 50));
    return;
  }

  // M2: github-proxy restricted to GET + safe endpoint allowlist
  if (request.method === 'POST' && requestUrl.pathname === '/api/github-proxy') {
    if (!config.githubPat) { sendJson(response, 401, { error: 'No GitHub PAT configured' }); return; }
    const body = await readRequestJson(request);
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
    const ALLOWED_ENDPOINT = /^\/repos\/[^/]+\/[^/]+(\/(commits|issues|pulls|actions\/runs)(\/.*)?)?(\?.*)?$|^\/user(\/repos)?(\?.*)?$/;
    if (!ALLOWED_ENDPOINT.test(endpoint)) {
      sendJson(response, 400, { error: 'GitHub endpoint not allowed' });
      return;
    }
    try {
      const ghResponse = await fetch(`https://api.github.com${endpoint}`, {
        method: 'GET', // Force read-only
        headers: { 'Authorization': `Bearer ${config.githubPat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'RepoTracker' }
      });
      const data = await ghResponse.json();
      sendJson(response, ghResponse.status, data);
    } catch (err) { sendJson(response, 500, { error: err.message }); }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/open') {
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
    if (!repoPath || !isPathWithinRoots(repoPath, config.roots)) {
      sendJson(response, 403, { error: 'Path outside configured roots' });
      return;
    }
    try {
      await fs.access(repoPath);
      const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawn(command, [repoPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      sendJson(response, 200, { opened: repoPath });
    } catch { sendJson(response, 404, { error: 'Repository path not found' }); }
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/system/check-update') {
    try {
      await execFileAsync('git', ['fetch'], { cwd: process.cwd() });
      const { stdout } = await execFileAsync('git', ['rev-list', '--count', 'HEAD..origin/main'], { cwd: process.cwd() });
      const commitsBehind = parseInt(stdout.trim(), 10) || 0;
      sendJson(response, 200, { updateAvailable: commitsBehind > 0, commitsBehind });
    } catch (err) {
      sendJson(response, 500, { error: 'Failed to check for updates' });
    }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/system/apply-update') {
    try {
      await execFileAsync('git', ['pull'], { cwd: process.cwd() });
      await execFileAsync('npm', ['install'], { cwd: process.cwd(), shell: true });
      sendJson(response, 200, { ok: true });
      setTimeout(() => process.exit(0), 1000);
    } catch (err) {
      sendJson(response, 500, { error: 'Failed to apply update: ' + err.message });
    }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/dialog/folder') {
    try {
      let selectedPath = '';
      if (process.platform === 'win32') {
        const psCmd = `Add-Type -AssemblyName System.windows.forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq 'OK') { Write-Output $f.SelectedPath }`;
        const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCmd]);
        selectedPath = stdout.trim();
      } else if (process.platform === 'darwin') {
        const { stdout } = await execFileAsync('osascript', ['-e', 'POSIX path of (choose folder)']);
        selectedPath = stdout.trim();
      } else {
        const { stdout } = await execFileAsync('zenity', ['--file-selection', '--directory']);
        selectedPath = stdout.trim();
      }
      if (selectedPath) {
        sendJson(response, 200, { path: selectedPath });
      } else {
        sendJson(response, 200, { path: '', canceled: true });
      }
    } catch (err) {
      sendJson(response, 500, { error: 'Failed to open dialog' });
    }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/standup') {
    if (!config.aiApiKey) { sendJson(response, 401, { error: 'No AI API Key configured' }); return; }
    const body = await readRequestJson(request);
    const prompt = `You are an AI assistant. Summarize the following git commits from the past 7 days into a professional "Weekly Standup" report. Commits:\n${JSON.stringify(body.commits)}`;
    try {
      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${config.aiApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await aiResponse.json();
      if (data.error) throw new Error(data.error.message);
      const report = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      sendJson(response, 200, { report });
    } catch (err) { sendJson(response, 500, { error: err.message }); }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/action') {
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
    const scriptCmd = body.scriptCmd; // New parameter passed from frontend

    if (!repoPath || !isPathWithinRoots(repoPath, config.roots)) {
      sendJson(response, 403, { error: 'Path outside configured roots' });
      return;
    }
    if (!scriptCmd || typeof scriptCmd !== 'string') {
      sendJson(response, 400, { error: 'Missing or invalid script command' });
      return;
    }

    try {
      await fs.access(repoPath);
      const taskId = randomBytes(16).toString('hex');
      const command = process.platform === 'win32' ? 'cmd.exe' : 'sh';
      const args = process.platform === 'win32' ? ['/c', scriptCmd] : ['-c', scriptCmd];
      
      const child = spawn(command, args, { cwd: repoPath, shell: false });
      activeTasks.set(taskId, child);

      child.on('exit', () => {
        setTimeout(() => activeTasks.delete(taskId), 10000); // keep around for 10s so stream can finish
      });

      sendJson(response, 200, { taskId });
    } catch { sendJson(response, 404, { error: 'Repository path not found' }); }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/setup') {
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
    if (!repoPath || !isPathWithinRoots(repoPath, config.roots)) {
      sendJson(response, 403, { error: 'Path outside configured roots' });
      return;
    }
    try {
      await fs.access(repoPath);
      const taskId = randomBytes(16).toString('hex');
      const command = process.platform === 'win32' ? 'cmd.exe' : 'sh';
      const winArgs = [
        '/c',
        'echo Pulling latest code... & git pull & ' +
        'if exist package.json (echo. & echo Installing NPM dependencies... & npm install) & ' +
        'if exist requirements.txt (echo. & echo Installing Python dependencies... & pip install -r requirements.txt) & ' +
        'if exist Cargo.toml (echo. & echo Fetching Cargo dependencies... & cargo fetch) & ' +
        'if exist go.mod (echo. & echo Downloading Go modules... & go mod download)'
      ];
      const macArgs = [
        '-c',
        `echo "Pulling latest code..."; git pull; ` +
        `if [ -f package.json ]; then echo "\\nInstalling NPM dependencies..."; npm install; fi; ` +
        `if [ -f requirements.txt ]; then echo "\\nInstalling Python dependencies..."; pip install -r requirements.txt; fi; ` +
        `if [ -f Cargo.toml ]; then echo "\\nFetching Cargo dependencies..."; cargo fetch; fi; ` +
        `if [ -f go.mod ]; then echo "\\nDownloading Go modules..."; go mod download; fi`
      ];
      
      const child = spawn(command, process.platform === 'win32' ? winArgs : macArgs, { cwd: repoPath, shell: false });
      activeTasks.set(taskId, child);

      child.on('exit', () => {
        setTimeout(() => activeTasks.delete(taskId), 10000);
      });

      sendJson(response, 200, { taskId });
    } catch (e) { sendJson(response, 404, { error: 'Repository path not found: ' + e.message }); }
    return;
  }

  // Shelby Terminal: Stream logs via Server-Sent Events (SSE)
  if (request.method === 'GET' && requestUrl.pathname === '/api/tasks/stream') {
    const taskId = requestUrl.searchParams.get('taskId');
    const child = activeTasks.get(taskId);
    if (!child) {
      sendJson(response, 404, { error: 'Task not found or expired' });
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const sendChunk = (data) => {
      const text = data.toString().replace(/\r?\n/g, '\\n');
      response.write(`data: ${text}\n\n`);
    };

    child.stdout.on('data', sendChunk);
    child.stderr.on('data', sendChunk);

    child.on('exit', (code) => {
      response.write(`event: exit\ndata: ${code}\n\n`);
      response.end();
    });
    
    request.on('close', () => {
      child.stdout.removeListener('data', sendChunk);
      child.stderr.removeListener('data', sendChunk);
    });
    return;
  }

  // Shelby Terminal: Kill task
  if (request.method === 'POST' && requestUrl.pathname === '/api/tasks/kill') {
    const body = await readRequestJson(request);
    const child = activeTasks.get(body.taskId);
    if (child) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', child.pid, '/f', '/t']);
        } else {
          process.kill(-child.pid); // Kill process group
        }
      } catch (e) {
        child.kill();
      }
      activeTasks.delete(body.taskId);
      sendJson(response, 200, { ok: true });
    } else {
      sendJson(response, 404, { error: 'Task not found' });
    }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/search') {
    const body = await readRequestJson(request);
    const query = sanitizeSearchQuery(body.query);
    if (!query) {
      sendJson(response, 400, { error: 'Invalid or missing search query' });
      return;
    }
    const meta = await readJson(META_FILE, {});
    const scanData = await scanRepos(config, meta);
    const results = [];
    await Promise.all(scanData.repos.map(async (repo) => {
      try {
        const out = await runGit(repo.path, ['grep', '-n', '-i', '-I', '-e', query]);
        if (out) {
          out.split(/\r?\n/).forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 3) results.push({ repo: repo.name, path: repo.path, file: parts[0], line: parts[1], content: parts.slice(2).join(':').trim() });
          });
        }
      } catch { }
    }));
    sendJson(response, 200, { results: results.slice(0, 100) });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/audit') {
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
    if (!repoPath || !isPathWithinRoots(repoPath, config.roots)) {
      sendJson(response, 403, { error: 'Path outside configured roots' });
      return;
    }
    try {
      const { stdout } = await execFileAsync('npm', ['audit', '--json'], { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 });
      sendJson(response, 200, JSON.parse(stdout));
    } catch (err) {
      if (err.stdout) sendJson(response, 200, JSON.parse(err.stdout));
      else sendJson(response, 500, { error: err.message });
    }
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/todos') {
    const meta = await readJson(META_FILE, {});
    const scanData = await scanRepos(config, meta);
    const results = [];
    await Promise.all(scanData.repos.map(async (repo) => {
      try {
        const out = await runGit(repo.path, ['grep', '-n', '-i', '-E', 'TODO:|FIXME:|HACK:']);
        if (out) {
          out.split(/\r?\n/).forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 3) {
              results.push({
                repo: repo.name,
                path: repo.path,
                file: parts[0],
                line: parts[1],
                content: parts.slice(2).join(':').trim()
              });
            }
          });
        }
      } catch { }
    }));
    sendJson(response, 200, { results: results.slice(0, 200) });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/aisync') {
    if (!config.aiApiKey) { sendJson(response, 401, { error: 'No AI API Key configured' }); return; }
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
    if (!repoPath || !isPathWithinRoots(repoPath, config.roots)) {
      sendJson(response, 403, { error: 'Path outside configured roots' });
      return;
    }
    try {
      await fs.access(repoPath);
      // Get combined diff (unstaged + staged)
      const diff1 = await runGit(repoPath, ['diff']);
      const diff2 = await runGit(repoPath, ['diff', '--staged']);
      const combinedDiff = (diff1 + '\n' + diff2).trim();

      if (!combinedDiff) {
        sendJson(response, 400, { error: 'No changes to commit' });
        return;
      }

      const prompt = `Write a concise 1-line professional git commit message for these changes. Return ONLY the commit message string, no quotes or markdown formatting.\n\nDiff:\n${combinedDiff.slice(0, 10000)}`;

      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${config.aiApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await aiResponse.json();
      if (data.error) throw new Error(data.error.message);

      const message = (data.candidates?.[0]?.content?.parts?.[0]?.text || 'Auto-sync changes').trim();

      await runGit(repoPath, ['add', '-A']);
      await runGit(repoPath, ['commit', '-m', message]);
      await runGit(repoPath, ['push']);

      sendJson(response, 200, { ok: true, message });
    } catch (err) { sendJson(response, 500, { error: err.message }); }
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/wakatime') {
    if (!config.wakatimeApiKey) { sendJson(response, 401, { error: 'No WakaTime API Key configured' }); return; }
    try {
      const auth = Buffer.from(config.wakatimeApiKey).toString('base64');
      const wakaRes = await fetch(`https://wakatime.com/api/v1/users/current/stats/last_7_days`, { headers: { 'Authorization': `Basic ${auth}` } });
      const data = await wakaRes.json();
      sendJson(response, wakaRes.status, data);
    } catch (err) { sendJson(response, 500, { error: err.message }); }
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/github/repos') {
    if (!config.githubPat) { sendJson(response, 401, { error: 'No GitHub PAT configured' }); return; }
    try {
      const ghResponse = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=100`, {
        headers: { 'Authorization': `Bearer ${config.githubPat}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'RepoTracker' }
      });
      const data = await ghResponse.json();
      sendJson(response, ghResponse.status, data);
    } catch (err) { sendJson(response, 500, { error: err.message }); }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/clone') {
    const body = await readRequestJson(request);
    const targetRoot = body.root ? path.resolve(body.root) : '';
    const cloneUrl = body.url;
    const repoName = body.name;

    if (!targetRoot || !cloneUrl || !repoName) {
      sendJson(response, 400, { error: 'Missing root, url, or name' });
      return;
    }
    if (!isValidHttpsUrl(cloneUrl)) {
      sendJson(response, 400, { error: 'Clone URL must use the https:// scheme' });
      return;
    }
    if (!isValidRepoName(repoName)) {
      sendJson(response, 400, { error: 'Invalid repository name' });
      return;
    }
    if (!isPathWithinRoots(targetRoot, config.roots)) {
      sendJson(response, 403, { error: 'Target root is outside configured roots' });
      return;
    }

    try {
      await fs.access(targetRoot);
      const targetPath = path.join(targetRoot, repoName);

      const command = process.platform === 'win32' ? 'cmd.exe' : 'sh';
      // H4: URL is quoted in the shell string; repoName is validated alphanumeric
      const winArgs = ['/c', 'start', 'cmd.exe', '/k', `echo Cloning... & git clone "${cloneUrl}" "${targetPath}" & echo Done. You can close this window.`];
      const macArgs = ['-c', `git clone "${cloneUrl}" "${targetPath}" && echo "Done."`];

      spawn(command, process.platform === 'win32' ? winArgs : macArgs, { cwd: targetRoot, detached: true, stdio: 'ignore' }).unref();
      sendJson(response, 200, { ok: true });
    } catch (e) {
      sendJson(response, 400, { error: 'Invalid root directory: ' + e.message });
    }
    return;
  }

  sendJson(response, 404, { error: 'Unknown API route' });
}
