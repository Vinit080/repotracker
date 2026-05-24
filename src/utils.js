import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG } from './constants.js';

export async function writeJsonIfMissing(filePath, value) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  }
}

export async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function normalizeConfig(input = {}) {
  const roots = Array.isArray(input.roots)
    ? input.roots.map((root) => String(root).trim()).filter(Boolean)
    : DEFAULT_CONFIG.roots;

  const maxDepth = Number.isFinite(Number(input.maxDepth))
    ? Math.min(Math.max(Number(input.maxDepth), 1), 8)
    : DEFAULT_CONFIG.maxDepth;

  const githubPat = typeof input.githubPat === 'string' ? input.githubPat : DEFAULT_CONFIG.githubPat;
  const aiApiKey = typeof input.aiApiKey === 'string' ? input.aiApiKey : DEFAULT_CONFIG.aiApiKey;
  const wakatimeApiKey = typeof input.wakatimeApiKey === 'string' ? input.wakatimeApiKey : DEFAULT_CONFIG.wakatimeApiKey;

  return {
    roots: roots.length ? [...new Set(roots.map((root) => path.resolve(root)))] : DEFAULT_CONFIG.roots,
    maxDepth,
    githubPat,
    aiApiKey,
    wakatimeApiKey
  };
}

export async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

export function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  response.end(body);
}

export function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text)
  });
  response.end(text);
}
