import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PORT, CONFIG_FILE, DATA_DIR, PUBLIC_DIR, MIME_TYPES, DEFAULT_CONFIG } from './constants.js';
import { writeJsonIfMissing, sendText, sendJson, readJson, writeJson, normalizeConfig } from './utils.js';
import { handleApi, handleUpgrade } from './routes/api.js';
import { scanRepos } from './git.js';
import notifier from 'node-notifier';
import { applySecurityHeaders, isAllowedHost, isAllowedOrigin, checkRateLimit, cleanupExpired, hashPassword } from './security.js';

// AI endpoints use the user's own API key — exempt from server-side rate limiting.
const AI_PATHS = new Set(['/api/standup', '/api/repos/aisync']);

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await writeJsonIfMissing(CONFIG_FILE, DEFAULT_CONFIG);
  await writeJsonIfMissing(path.join(DATA_DIR, 'repo-meta.json'), {});

  // C1 migration: hash any plaintext appPassword still in config.json
  const raw = await readJson(CONFIG_FILE, {});
  if (raw.appPassword && !raw.appPasswordHash) {
    console.log('\u2705 Migrating plaintext password to secure hash...');
    raw.appPasswordHash = hashPassword(raw.appPassword);
    delete raw.appPassword;
    await writeJson(CONFIG_FILE, raw);
  }
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
    // ── Security guards (applied before anything else) ─────────────────────────
    applySecurityHeaders(response);

    if (!isAllowedHost(request)) {
      sendText(response, 400, 'Bad Request: Invalid Host header');
      return;
    }

    if (!isAllowedOrigin(request)) {
      sendText(response, 403, 'Forbidden: Cross-origin request rejected');
      return;
    }

    // M6: ensureDataFiles is called once at startup — not per-request
    if (request.url?.startsWith('/api/')) {
      // ── Per-IP rate limiting (AI endpoints exempt) ────────────────────────
      const ip = request.socket.remoteAddress ?? 'unknown';
      const pathname = new URL(request.url, 'http://localhost').pathname;

      if (pathname === '/api/login') {
        if (!checkRateLimit('login', ip, 10, 60_000)) {
          sendJson(response, 429, { error: 'Too many login attempts. Try again later.' });
          return;
        }
      } else if (!AI_PATHS.has(pathname)) {
        if (!checkRateLimit('general', ip, 60, 60_000)) {
          sendJson(response, 429, { error: 'Too many requests. Try again later.' });
          return;
        }
      }

      await handleApi(request, response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    if (error.code === 'PAYLOAD_TOO_LARGE') {
      sendJson(response, 413, { error: 'Request body too large (max 1 MB)' });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: 'Internal server error' });
  }
});

async function runWorkerCycle() {
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
}

async function startBackgroundWorker() {
  await runWorkerCycle(); // L5: run immediately on boot, then every 60 minutes
  setInterval(runWorkerCycle, 60 * 60 * 1000);
}

server.listen(PORT, async () => {
  console.log(`RepoTracker running at http://localhost:${PORT}`);
  console.log(`Scanning roots from ${CONFIG_FILE}`);
  await ensureDataFiles(); // M6: run once at boot
  startBackgroundWorker();
  setInterval(cleanupExpired, 5 * 60 * 1000); // M7: prune stale rate-limit + session entries every 5 min
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

server.on('upgrade', (request, socket, head) => {
  if (!isAllowedHost(request) || !isAllowedOrigin(request)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  handleUpgrade(request, socket, head).catch(err => {
    console.error('WebSocket upgrade failed:', err);
    socket.destroy();
  });
});
