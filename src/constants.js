import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const PUBLIC_DIR = path.join(__dirname, '..', 'public');
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
export const META_FILE = path.join(DATA_DIR, 'repo-meta.json');
export const PORT = Number(process.env.PORT || 4177);
export const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');

export const DEFAULT_CONFIG = {
  roots: [DEFAULT_ROOT],
  maxDepth: 4,
  githubPat: '',
  aiApiKey: '',
  wakatimeApiKey: '',
  appPassword: ''
};

export const SKIP_DIRS = new Set([
  '.git', '.hg', '.svn', '.next', '.nuxt', '.turbo', '.cache',
  'coverage', 'dist', 'build', 'out', 'node_modules', 'vendor',
  '.venv', 'venv', '__pycache__'
]);

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};
