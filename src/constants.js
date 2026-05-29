import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const PUBLIC_DIR = path.join(__dirname, '..', 'public');
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
export const META_FILE = path.join(DATA_DIR, 'repo-meta.json');
export const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');
export const INSTALL_ID_FILE = path.join(DATA_DIR, 'install.json');
export const PORT = Number(process.env.PORT || 4177);
export const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');

// Team mode: bind to all interfaces so LAN teammates can connect
export const TEAM_MODE = process.env.REPOTRACKER_TEAM === '1' || process.argv.includes('--team');
export const BIND_HOST = TEAM_MODE ? '0.0.0.0' : '127.0.0.1';

// Anonymous opt-in install counter (no repos, no paths, no personal data)
export const PING_URL = process.env.PING_URL || 'https://lucky-dream-377a.coolboychakane08.workers.dev/count';

export const DEFAULT_CONFIG = {
  roots: [],
  maxDepth: 4,
  userName: '',
  githubPat: '',
  aiApiKey: '',
  wakatimeApiKey: '',
  appPasswordHash: '', // stored as "salt:hash" via PBKDF2, never plaintext
  onboardingComplete: false,
  gistSyncId: '',
  lastGistSync: null,
  licenseKey: '',           // LemonSqueezy UUID or RT-PRO-... offline key
  licenseTier: '',          // 'pro' | 'team' | '' — set during activation
  licenseInstanceId: null,  // LS instance ID — needed to deactivate and free the slot
  licenseActivatedAt: null, // ISO timestamp of activation
  teamTokens: [],     // [{ token, label, createdAt }] invite links for team mode
  pingOptIn: null,    // null=not asked, true=opted in, false=opted out
};

export const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', '.next', '.nuxt', '.turbo', '.cache',
  'coverage', 'dist', 'build', 'out', 'node_modules', 'vendor',
  '.venv', 'venv', '__pycache__'
]);

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon'
};