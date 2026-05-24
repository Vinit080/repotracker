import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PORT, CONFIG_FILE, DATA_DIR, PUBLIC_DIR, MIME_TYPES, DEFAULT_CONFIG } from './constants.js';
import { writeJsonIfMissing, sendText, sendJson, readJson, normalizeConfig } from './utils.js';
import { handleApi } from './routes/api.js';
import { scanRepos } from './git.js';
import notifier from 'node-notifier';

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await writeJsonIfMissing(CONFIG_FILE, DEFAULT_CONFIG);
  await writeJsonIfMissing(path.join(DATA_DIR, 'repo-meta.json'), {});
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const cleanPath = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
  const filePath = path.resolve(PUBLIC_DIR, `.${cleanPath}`);

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const type = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': content.length });
    response.end(content);
  } catch {
    sendText(response, 404, 'Not found');
  }
}

const server = http.createServer(async (request, response) => {
  try {
    await ensureDataFiles();
    if (request.url?.startsWith('/api/')) {
      await handleApi(request, response);
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Internal server error' });
  }
});

async function startBackgroundWorker() {
  setInterval(async () => {
    try {
      const config = normalizeConfig(await readJson(CONFIG_FILE, DEFAULT_CONFIG));
      if (!config.roots.length) return;
      
      const meta = await readJson(path.join(DATA_DIR, 'repo-meta.json'), {});
      const scanData = await scanRepos(config, meta);
      
      const behindRepos = scanData.repos.filter(r => r.status.behind > 0);
      if (behindRepos.length > 0) {
        notifier.notify({
          title: 'RepoTracker Alert',
          message: `${behindRepos.length} repositories are behind their remote upstream!`,
          wait: false
        });
      }
    } catch (err) {
      console.error('Background worker error:', err);
    }
  }, 60 * 60 * 1000); // 60 minutes
}

server.listen(PORT, () => {
  console.log(`RepoTracker running at http://localhost:${PORT}`);
  console.log(`Scanning roots from ${CONFIG_FILE}`);
  startBackgroundWorker();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Another RepoTracker instance may already be running.`);
    console.error(`   To fix: run  npx kill-port ${PORT}  then try again.\n`);
    process.exit(1);
  } else {
    throw err;
  }
});
