import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CONFIG_FILE, META_FILE, DEFAULT_CONFIG } from '../constants.js';
import { readJson, writeJson, writeJsonIfMissing, normalizeConfig, readRequestJson, sendJson } from '../utils.js';
import { scanRepos, runGit } from '../git.js';

const execFileAsync = promisify(execFile);

export async function handleApi(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const config = normalizeConfig(await readJson(CONFIG_FILE, DEFAULT_CONFIG));

  if (request.method === 'POST' && requestUrl.pathname === '/api/login') {
    const body = await readRequestJson(request);
    if (!config.appPassword || body.password === config.appPassword) {
      sendJson(response, 200, { ok: true, token: config.appPassword });
    } else {
      sendJson(response, 401, { error: 'Incorrect password' });
    }
    return;
  }

  if (config.appPassword) {
    const authHeader = request.headers.authorization || '';
    if (authHeader !== `Bearer ${config.appPassword}`) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/config') {
    sendJson(response, 200, config);
    return;
  }

  if (request.method === 'PUT' && requestUrl.pathname === '/api/config') {
    const body = await readRequestJson(request);
    const updatedConfig = normalizeConfig({ ...config, ...body });
    await writeJson(CONFIG_FILE, updatedConfig);
    sendJson(response, 200, updatedConfig);
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

  if (request.method === 'POST' && requestUrl.pathname === '/api/github-proxy') {
    if (!config.githubPat) { sendJson(response, 401, { error: 'No GitHub PAT configured' }); return; }
    const body = await readRequestJson(request);
    try {
      const ghResponse = await fetch(`https://api.github.com${body.endpoint}`, {
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
    try {
      await fs.access(repoPath);
      const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      spawn(command, [repoPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      sendJson(response, 200, { opened: repoPath });
    } catch { sendJson(response, 404, { error: 'Repository path not found' }); }
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
    try {
      await fs.access(repoPath);
      const command = process.platform === 'win32' ? 'cmd.exe' : 'sh';
      const args = process.platform === 'win32' ? ['/c', 'start', 'cmd.exe', '/k', `npm run ${body.script}`] : ['-c', `npm run ${body.script}`];
      spawn(command, args, { cwd: repoPath, detached: true, stdio: 'ignore' }).unref();
      sendJson(response, 200, { ok: true });
    } catch { sendJson(response, 404, { error: 'Repository path not found' }); }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/setup') {
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
    try {
      await fs.access(repoPath);
      const command = process.platform === 'win32' ? 'cmd.exe' : 'sh';
      const winArgs = [
        '/c', 'start', 'cmd.exe', '/k',
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
      const args = process.platform === 'win32' ? winArgs : macArgs;
      spawn(command, args, { cwd: repoPath, detached: true, stdio: 'ignore' }).unref();
      sendJson(response, 200, { ok: true });
    } catch (e) { sendJson(response, 404, { error: 'Repository path not found: ' + e.message }); }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/search') {
    const body = await readRequestJson(request);
    const meta = await readJson(META_FILE, {});
    const scanData = await scanRepos(config, meta);
    const results = [];
    await Promise.all(scanData.repos.map(async (repo) => {
      try {
        const out = await runGit(repo.path, ['grep', '-n', '-i', '-I', body.query]);
        if (out) {
          out.split(/\r?\n/).forEach(line => {
             const parts = line.split(':');
             if (parts.length >= 3) results.push({ repo: repo.name, path: repo.path, file: parts[0], line: parts[1], content: parts.slice(2).join(':').trim() });
          });
        }
      } catch {}
    }));
    sendJson(response, 200, { results: results.slice(0, 100) });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/audit') {
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
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
      } catch {}
    }));
    sendJson(response, 200, { results: results.slice(0, 200) });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/repos/aisync') {
    if (!config.aiApiKey) { sendJson(response, 401, { error: 'No AI API Key configured' }); return; }
    const body = await readRequestJson(request);
    const repoPath = body.path ? path.resolve(body.path) : '';
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
    
    try {
      await fs.access(targetRoot);
      const targetPath = path.join(targetRoot, repoName);
      
      const command = process.platform === 'win32' ? 'cmd.exe' : 'sh';
      const winArgs = ['/c', 'start', 'cmd.exe', '/k', `echo Cloning ${repoName}... & git clone ${cloneUrl} "${targetPath}" & echo Done. You can close this window.`];
      const macArgs = ['-c', `echo "Cloning ${repoName}..."; git clone ${cloneUrl} "${targetPath}"; echo "Done."`];
      
      spawn(command, process.platform === 'win32' ? winArgs : macArgs, { cwd: targetRoot, detached: true, stdio: 'ignore' }).unref();
      sendJson(response, 200, { ok: true });
    } catch (e) {
      sendJson(response, 400, { error: 'Invalid root directory: ' + e.message });
    }
    return;
  }

  sendJson(response, 404, { error: 'Unknown API route' });
}
