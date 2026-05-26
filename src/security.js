/**
 * security.js — Rate limiting, security headers, Host-guard, CSRF,
 *               password hashing (PBKDF2), and session management.
 * Zero external dependencies — Node.js built-ins only.
 */

import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

// ── Password Hashing (PBKDF2-SHA512, 100 000 iterations) ─────────────────────

/**
 * Hash a plaintext password and return a storable "salt:hash" string.
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a plaintext password against a stored "salt:hash" string.
 * Uses timingSafeEqual to prevent timing attacks.
 * @param {string} password
 * @param {string} stored  — "salt:hash" from config
 * @returns {boolean}
 */
export function verifyPassword(password, stored) {
  try {
    const [salt, storedHash] = stored.split(':');
    if (!salt || !storedHash) return false;
    const derived = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
    return timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

// ── Session Store ─────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const _sessions = new Map(); // token → expiresAt (ms)

/**
 * Create a new cryptographically random session token, valid for 7 days.
 * @returns {string}
 */
export function createSession() {
  const token = randomBytes(32).toString('hex');
  _sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

/**
 * Validate a session token — returns true if valid and not expired.
 * Removes the token if it has expired.
 * @param {string} token
 * @returns {boolean}
 */
export function isValidSession(token) {
  if (!token) return false;
  const exp = _sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    _sessions.delete(token);
    return false;
  }
  return true;
}

// ── Periodic Cleanup ──────────────────────────────────────────────────────────

/**
 * Remove expired rate-limit windows and expired session tokens.
 * Call on a periodic interval (e.g. every 5 minutes) to prevent
 * the Maps growing without bound on long-running processes (M7).
 */
export function cleanupExpired() {
  const now = Date.now();
  // Rate-limit windows older than 2 minutes are safe to drop
  for (const [key, entry] of _windows) {
    if (now - entry.windowStart > 120_000) _windows.delete(key);
  }
  // Expired session tokens
  for (const [token, exp] of _sessions) {
    if (now > exp) _sessions.delete(token);
  }
}

// ── Rate Limiting (fixed-window counter per IP) ───────────────────────────────

const _windows = new Map(); // key: `${limiterKey}:${ip}` → { count, windowStart }

/**
 * Check whether the given IP has exceeded the rate limit for the named bucket.
 * Returns true (allow) or false (reject).
 *
 * @param {string} limiterKey  Logical bucket name (e.g. 'general', 'login')
 * @param {string} ip          Client IP address
 * @param {number} maxRequests Maximum requests allowed within the window
 * @param {number} windowMs    Window size in milliseconds
 */
export function checkRateLimit(limiterKey, ip, maxRequests, windowMs) {
  const key = `${limiterKey}:${ip}`;
  const now = Date.now();
  let entry = _windows.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { count: 0, windowStart: now };
  }

  entry.count += 1;
  _windows.set(key, entry);
  return entry.count <= maxRequests;
}

// ── Security Response Headers ─────────────────────────────────────────────────

/**
 * Attach security-relevant HTTP response headers to every response.
 * Must be called before writeHead / sendJson / sendText.
 * @param {import('node:http').ServerResponse} response
 */
export function applySecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://formspree.io"
  );
}

// ── Host / DNS-rebinding Guard ────────────────────────────────────────────────

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Returns true if the Host header is a safe localhost variant.
 * Rejects arbitrary hostnames to prevent DNS-rebinding attacks.
 * @param {import('node:http').IncomingMessage} request
 */
export function isAllowedHost(request) {
  const rawHost = request.headers.host || '';
  const host = rawHost.replace(/:\d+$/, '').toLowerCase();
  return ALLOWED_HOSTS.has(host);
}

// ── CSRF / Origin Guard ───────────────────────────────────────────────────────

/**
 * For non-GET/HEAD requests, verify the Origin header (when present) belongs
 * to localhost. Browsers always send Origin on cross-origin state-changing
 * requests, preventing CSRF without a token.
 * @param {import('node:http').IncomingMessage} request
 */
export function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true; // same-origin curl / non-browser clients / simple navigations

  try {
    const { hostname } = new URL(origin);
    return ALLOWED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}
