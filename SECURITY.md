# Security Policy

## Overview

RepoTracker runs **entirely on your local machine** (`localhost:4177`). It never phones home, never transmits your source code or credentials to any external server (except the APIs you explicitly configure), and has no cloud backend.

This document explains the threat model, what the app does with your system, and how to report vulnerabilities.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | ✅ Active — current release |
| 0.1.x   | ⚠️ Security fixes only |

---

## Threat Model

RepoTracker interacts with sensitive parts of your development environment. Here is exactly what it does and why:

### Filesystem Access
- **What**: Recursively scans directories you explicitly add via the folder browser.
- **Why**: To discover `.git` folders and compute repository health scores.
- **Scope**: Read-only scanning. Write access is limited to committing/pushing changes you explicitly trigger via the UI.
- **Guard**: All file paths are resolved with `path.resolve()` and verified to be inside your configured root directories before any read or write operation. Path traversal attacks (`../../etc/passwd`) are blocked at the route level.

### Shell Command Execution
- **What**: Executes `git` subcommands (`status`, `log`, `diff`, `commit`, `push`, `grep`, `checkout`, `branch`, `merge`) against your local repos.
- **Why**: All repository health, search, sync, and branch management features depend on Git output.
- **Protections**:
  - All user-supplied inputs (repo paths, branch names, search queries) are validated against strict allowlists before being passed to `execFileAsync`.
  - Branch names are validated against `/^[a-zA-Z0-9._\-/]{1,100}$/` before any git operation.
  - `execAsync` with `shell: true` (string interpolation) is **never used anywhere in the codebase**.
  - `npm install` in the auto-updater uses `execFileAsync(npmCmd, ['install'])` — not shell exec.
  - Desktop notifications use `execFileAsync('powershell', ['-NoProfile', '-Command', ...])` with arguments as an array — never a concatenated string.

### Terminal (Shelby)
- **What**: Spawns a real OS shell (`bash`/`powershell`) via `node-pty`, streamed over a local WebSocket.
- **Why**: To provide an integrated terminal experience inside the dashboard.
- **Scope**: Full shell access — equivalent to opening a terminal yourself. Accessible from `localhost` only. The WebSocket origin is validated to prevent CSWSH attacks.

### API Credentials
- **What**: Stores your GitHub PAT, Gemini API key, WakaTime API key, and LemonSqueezy license key locally in `data/config.json`.
- **Protections**:
  - Credentials are **never sent to the frontend JavaScript context**.
  - All external API calls are proxied server-side — the browser never sees raw keys.
  - `GET /api/config` returns masked sentinels (`••• (saved)`) for all secrets. The raw value is never in any HTTP response body.
  - Keys are never written to log files.
  - `data/config.json` and `data/` are listed in `.gitignore` — secrets are never committed to version control.

### Authentication
- **What**: Session-based login to protect the dashboard from other local users.
- **Why**: Since the app can execute shell commands, unauthorized local access is a genuine threat on shared machines.
- **Protections**:
  - Passwords hashed using **PBKDF2-SHA512** with a cryptographically random salt (100,000 iterations).
  - Session tokens are cryptographically random (256-bit), time-limited to 7 days.
  - Sessions are persisted to disk (`data/sessions.json`) so server restarts don't invalidate active sessions.
  - Login endpoint rate-limited to 10 attempts/60 seconds per IP.
  - `data/sessions.json` is gitignored.

### License Key Storage
- **What**: LemonSqueezy license key stored in `data/config.json`, alongside `licenseTier`, `licenseInstanceId`, and `licenseActivatedAt`.
- **Protections**:
  - The raw key is masked in all API responses — only `licenseKeySet: Boolean` and `licenseTier` are sent to the browser.
  - License validation is done server-side via the LemonSqueezy API — the key never touches browser JavaScript.
  - Activation consumes one LemonSqueezy slot; deactivation frees it for use on another machine.

---

## Network Security

| Attack Vector | Mitigation |
|---|---|
| DNS Rebinding | Strict `Host` header validation — only `localhost`, `127.0.0.1`, `::1`, and RFC-1918 LAN IPs (Team Mode only) are accepted |
| CSRF | `Origin` header enforcement on all REST and WebSocket endpoints |
| Cross-Site WebSocket Hijacking | Origin validation rejects any non-localhost origin |
| Credential leakage | API keys masked in all responses; all external calls are server-side only |
| Command injection | All shell inputs validated with allowlist regex; `execAsync` with shell interpolation is never used |
| Path traversal | All paths resolved with `path.resolve()` and verified inside configured roots before access |
| Brute force login | Rate limiter: 10 attempts/60s on `/api/login`, 5 attempts/15min on `/api/verify-github-token` |
| General abuse | 60 req/min per-IP rate limiter on all general API routes |
| XSS via repo data | Content-Security-Policy header blocks inline scripts; `escapeHtml()` applied to all user-controlled data rendered via `innerHTML` |
| Malicious updates | Auto-update verifies Git remote URL matches the official repository before pulling |
| LAN exposure | All endpoints are `localhost`-only by default. Team Mode (`0.0.0.0`) must be explicitly enabled via env var |

---

## What RepoTracker Does NOT Do

- ❌ Does not transmit your source code to any server
- ❌ Does not collect analytics or usage data without explicit opt-in
- ❌ Does not auto-update without your explicit confirmation click
- ❌ Does not store passwords in plaintext
- ❌ Does not expose any port to the network (localhost only, unless Team Mode is explicitly enabled)
- ❌ Does not send secrets (API keys, license keys) to the browser or frontend
- ❌ Does not create outbound connections without explicit user action
- ❌ Does not use `eval()`, `new Function()`, or dynamic code execution anywhere

### Anonymous Install Ping (Opt-In Only)
If you opt in during the setup wizard, a single anonymous ping is sent to a Cloudflare Worker counter. It contains **only** `{ version, platform }` — no IP address is stored, no user identifiers, no repo names, nothing personal. You can opt out at any time in **Settings → Privacy**.

---

## Auditing the Code

RepoTracker is fully open source. The security-critical files are:

| File | What to audit |
|---|---|
| `src/server.js` | `.env` loading, Host/Origin validation, rate limiting, CSP headers, request routing |
| `src/security.js` | PBKDF2 hashing implementation, session token generation & persistence, rate limiting |
| `src/routes/api.js` | All 37 API route handlers, path traversal guards, WebSocket/PTY spawning, license feature gates |
| `src/git.js` | Shell escaping and input sanitization for all git subcommands |
| `src/license.js` | License key activation lifecycle — LS `/activate`, `/deactivate`, `/validate` calls |
| `src/notify.js` | Desktop notification dispatch — PowerShell/AppleScript/notify-send with array arguments |
| `src/utils.js` | `sanitizeConfigForResponse()` — the function that determines what reaches the browser |

---

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public GitHub issue.**

Report it privately via:

**GitHub Private Vulnerability Reporting**: [Security Advisories](https://github.com/Vinit080/repotracker/security/advisories/new)

Please include:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Your suggested fix (optional but appreciated)

You can expect an acknowledgment within **72 hours** and a fix or mitigation plan within **7 days** for critical issues.

---

## Dependencies

| Package | Version | Purpose | Security notes |
|---|---|---|---|
| `node-pty` | ^1.1.0 | Terminal spawning | Executes OS shell — kept up to date; only spawned from authenticated routes |
| `ws` | ^8.21.0 | WebSocket server | Terminal + real-time updates; origin validated on every connection |
| `xterm` | ^5.3.0 | Frontend terminal emulator | Browser-only, no network access |

Enable [Dependabot alerts](https://github.com/Vinit080/repotracker/settings/security_analysis) on your fork to stay notified of CVEs in these dependencies.

---

*Last updated: May 2026 — v0.2.0*
