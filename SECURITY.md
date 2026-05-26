# Security Policy

## Overview

RepoTracker runs **entirely on your local machine** (`localhost:4177`). It never phones home, never transmits your code or credentials to any external server (except the APIs you explicitly configure), and has no cloud backend.

This document explains the threat model, what the app does with your system, and how to report vulnerabilities.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Active  |

---

## Threat Model

RepoTracker interacts with sensitive parts of your system. Here is exactly what it does and why:

### Filesystem Access
- **What**: Recursively scans directories you explicitly add via the folder browser.
- **Why**: To discover `.git` folders and compute repository health scores.
- **Scope**: Read-only scanning. Write access is limited to committing/pushing changes you explicitly trigger via the AI Git Sync feature.

### Shell Command Execution
- **What**: Executes `git` subcommands (`status`, `log`, `diff`, `commit`, `push`, `grep`) against your local repos.
- **Why**: All repository health, search, and sync features depend on Git output.
- **Protections**: All user-supplied inputs (repo paths, search queries, branch names) are validated and shell-escaped before execution. Direct shell string interpolation is never used.

### Terminal (Shelby)
- **What**: Spawns a real OS shell (`bash`/`cmd`) via `node-pty`, streamed over a local WebSocket.
- **Why**: To provide an integrated terminal experience inside the dashboard.
- **Scope**: Full shell access — equivalent to opening a terminal yourself. The terminal is only accessible from `localhost`.

### API Credentials
- **What**: Stores your GitHub PAT, Gemini API key, and WakaTime API key locally in a config file.
- **Why**: Required to call the respective APIs on your behalf.
- **Protections**: Credentials are never sent to the frontend JavaScript context. All API calls are proxied server-side. Keys are never logged.

### Authentication
- **What**: Session-based login to protect the dashboard from other users on the same machine.
- **Why**: Since the app can execute shell commands, unauthorized local access is a real threat.
- **Protections**: Passwords are hashed using **PBKDF2-SHA512** with a random salt. Session tokens are cryptographically random and time-limited.

---

## Network Security

RepoTracker is hardened against network-based attacks even though it runs locally:

| Attack Vector | Mitigation |
|---|---|
| DNS Rebinding | Strict `Host` header validation — only `localhost` and `127.0.0.1` accepted |
| CSRF | `Origin` header enforcement on all REST and WebSocket endpoints |
| Cross-Site WebSocket Hijacking (CSWSH) | Origin validation rejects requests from any non-localhost origin |
| Credential leakage | API keys never passed to frontend; all external calls are server-side only |
| Command injection | All shell inputs validated and escaped; no raw string interpolation |

---

## What RepoTracker Does NOT Do

- ❌ Does not transmit your source code to any server
- ❌ Does not collect analytics or usage data
- ❌ Does not auto-update without your explicit confirmation
- ❌ Does not store passwords in plaintext
- ❌ Does not expose any port to the network (localhost only)

---

## Auditing the Code

RepoTracker is fully open source. The security-critical files are:

| File | What to audit |
|---|---|
| `src/server.js` | Host/Origin validation, session handling, shell command execution |
| `src/auth.js` | PBKDF2 password hashing and session token generation |
| `src/git.js` | Shell escaping and input sanitization for git commands |
| `src/terminal.js` | WebSocket setup and node-pty spawning |

---

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public GitHub issue.**

Report it privately via:

**Email**: *(add your email here)*
**GitHub Private Vulnerability Reporting**: [Security Advisories](https://github.com/Vinit080/repotracker/security/advisories/new)

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (optional but appreciated)

You can expect an acknowledgment within **72 hours** and a fix or mitigation plan within **7 days** for critical issues.

---

## Dependencies

Key dependencies and their security implications:

| Package | Version | Purpose | Notes |
|---|---|---|---|
| `node-pty` | ^1.1.0 | Terminal spawning | Executes OS shell — kept up to date |
| `ws` | ^8.21.0 | WebSocket server | Terminal + real-time updates |
| `node-notifier` | ^10.0.1 | Desktop notifications | No network access |
| `puppeteer` | ^25.0.4 | Browser automation | Used for specific scraping tasks |

Enable [Dependabot alerts](https://github.com/Vinit080/repotracker/settings/security_analysis) to stay notified of CVEs in these dependencies.

---

*Last updated: May 2026*
