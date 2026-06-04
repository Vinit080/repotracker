# Changelog

All notable changes to RepoTracker will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

> Features merged to `main` but not yet tagged as a release.

### Planned
- Custom workflow pipelines (Setup → Test → Build → Commit in one click)
- Global dependency graph — force-directed cross-repo visualization
- Multi-tabbed Shelby Terminal

---

## [1.0.9] - 2026-06-04

### Fixed
- **Security**: Completely scrubbed sensitive environments variables (e.g. `LEMONSQUEEZY`) from spawned background processes (like git syncs).
- **Security**: Increased PBKDF2 iterations to 310,000 for password hashes and began hashing active session tokens in memory.
- **Security**: Enforced session or IPC token validation on the `/export` data dump endpoint.
- **Security**: Integrated DOMPurify to automatically sanitize AI-generated standup and markdown content in the frontend.
- **Security**: Added robust `javascript:` protocol stripping for GitHub repo links to prevent XSS.
- **Authentication**: Fixed a token extraction priority bug that was locking out users on the desktop Electron app when a local password was set.
- **Authentication**: Patched the Git remote workspace initialization so GitHub Personal Access Tokens are passed via `http.extraHeader` instead of being embedded in the `.git/config` remote URL.

---

## [1.0.8] - 2026-06-04

### Fixed
- **Preload Script**: Renamed `preload.js` to `preload.cjs` to fix Electron IPC and auto-update bindings in ESM mode.
- **Headless Mode**: Fixed `execFile` crash on boot.

---

## [1.0.7] - 2026-06-04

### Fixed
- **CI/CD Pipeline**: Configured `electron-builder` to publish releases with `releaseType: "release"` instead of the default `draft`. This ensures the public GitHub Releases API correctly serves the latest version to the landing page.

---

## [1.0.6] - 2026-06-04

### Fixed
- **CI/CD Pipeline**: Added `permissions: contents: write` to the GitHub Actions release workflow. This fixes the `403 Forbidden` error so `electron-builder` has the required permissions to publish the generated AppImage, executable, and DMG files to the GitHub Releases page.

---

## [1.0.5] - 2026-06-04

### Fixed
- **Linux Build**: Added email address to the `author` field in `package.json`, which is strictly required by `electron-builder` when generating the AppImage and its internal `.desktop` file.

---

## [1.0.4] - 2026-06-04

### Fixed
- **Linux Build**: Reverted static AppImage toolset (which was incompatible with the current `electron-builder` schema) and instead migrated the GitHub Actions runner from `ubuntu-latest` (Ubuntu 24.04) to `ubuntu-22.04` to permanently restore native FUSE 2 compatibility for AppImage generation.

---

## [1.0.3] - 2026-06-04

### Fixed
- **Linux Build**: Switched to the `electron-builder` static AppImage runtime toolset to permanently fix build failures and eliminate the `libfuse2` dependency on modern Linux distributions (like Ubuntu 24.04).

---

## [1.0.2] - 2026-06-04

### Fixed
- **Linux Build**: Fixed missing `libfuse2` dependency on `ubuntu-latest` preventing AppImage generation.

---

## [1.0.1] - 2026-06-04

### Fixed
- **Linux Build**: Fixed GitHub Actions failing on Ubuntu by explicitly defining `AppImage` as the Linux build target for `electron-builder`.

---

## [1.0.0] - 2026-06-04

The Security and Freedom Update.

### Added
- **API Health Endpoint**: New `GET /api/health` route for monitoring server status and uptime.
- **Graceful Shutdown**: Node.js server now handles SIGTERM/SIGINT gracefully, clearing intervals and cleanly closing the HTTP server.

### Changed
- **Free for Everyone**: Completely removed Lemon Squeezy integration, license validation logic, and upgrade modals. All "Pro" and "Team" features (AI review, AI standup, Team mode, Gist sync) are now 100% free and unlocked for all users.
- **AI Rate Limiting**: Added a dedicated 10 requests/minute rate limit bucket for all AI endpoints to prevent API abuse.
- **Session Security**: Active sessions now slide their TTL forward on each valid check, and `Secure` cookie flags are applied automatically when running outside of `localhost`.
- **Team Tokens**: Upgraded team invite token entropy from 192-bit to 256-bit and implemented `timingSafeEqual` for secure token revocation.

### Fixed
- **Critical Crash**: Fixed an `ERR_MODULE_NOT_FOUND` crash in the `ai-autofix` route caused by a dead import of the removed `license.js` module.
- **Security**: Fixed a potential shell injection vector in the internal PTY polyfill by changing `shell: true` to `shell: false`.
- **Security**: Closed a CORS origin validation bypass that occurred when any `Authorization: Bearer` header was present.
- **Security**: Secured the `/export` endpoint with session validation to prevent unauthorized LAN access to full dashboard data.
- **Security**: Moved `/api/suggest-roots` behind the session auth guard to prevent local filesystem enumeration by unauthenticated clients.
- **Data Leaks**: Removed raw error messages (`err.message`) from client-facing responses in setup, clone, and Slack integration routes to prevent internal path leakage.
- **Memory/Resource Leaks**: Replaced `ipcRenderer.on` with `ipcRenderer.once` to prevent listener accumulation, and added a 20-page cap with a 15-second timeout to the GitHub repos pagination loop.
- **Code Cleanup**: Removed hardcoded Cloudflare Worker fallback URL, replaced scattered magic version strings with `npm_package_version`, and deleted the redundant legacy `/api/standup` route.

---

## [0.3.0] - 2026-05-29

The Insights & AI Update.

### Added
- **90-Day Contribution Graph**: Beautiful GitHub-style activity grid on the Insights & Timeline tab that automatically pulls local commit history across all repositories.
- **AI Standup Generator (Pro Feature)**: Analyzes the last 7 days of commits and uncommitted changes to generate a professional, formatted markdown standup summary instantly using AI.
- **Pro Tier Licensing**: Full integration with Lemon Squeezy API for License Key activation to securely unlock premium features.

### Changed
- **Security**: Hardened `.gitignore` to prevent tracking of `dist/`, `build/`, and generated `.exe` artifacts.

---

## [0.2.1] - 2026-05-29

### Added
- **Executable Distribution**: Set up GitHub Actions CI/CD to automatically compile and distribute cross-platform standalone executables (`.exe` for Windows, macOS, Linux).

---

## [0.2.0] - 2026-05-29

Major feature release. Production-ready with a full security audit pass.

### Added

#### AI Features *(Pro)*
- **AI Code Reviewer** — analyze uncommitted diffs for bugs, security issues, and quality problems before committing, powered by Gemini 1.5 Pro
- **AI Weekly Standup** — AI-generated standup report summarizing your last 7 days of commits across all repos
- **AI Git Sync** enhanced — improved diff summarization and commit message quality

#### GitHub Repository Browser *(Ecosystem Tab)*
- Browse all GitHub repositories (public + private) directly inside the app
- Visual `✓ Cloned` badge on repos already present locally
- One-click Clone button opens the clone dialog pre-filled with the repo URL
- Live search filter across all repos by name or description
- Shows language, star count, and fork status per repo

#### Gist Config Sync *(Pro)*
- `POST /api/config/sync-to-gist` — serialize settings (roots, depth, username) to a private GitHub Gist; secrets are never included
- `POST /api/config/restore-from-gist` — fetch and merge settings from any Gist ID onto a new machine
- Gist ID persisted in config; subsequent syncs update the same Gist rather than creating new ones

#### Smart Desktop Notifications
- Automatic alerts fired after every repo scan:
  - ❌ CI just failed (status changed to `failure` since last check)
  - ⚠️ Repo is 5+ commits behind remote
  - 🟡 Repo has 20+ uncommitted files
  - 💤 Repo is stale (no commits in 30+ days)
- Per-repo 1-hour cooldown prevents notification spam (state stored in `data/meta.json`)
- Works on Windows (PowerShell toast), macOS (AppleScript), Linux (`notify-send`)

#### Visual Branch Manager
- Create, checkout, merge, and delete branches directly from the repo card UI
- Branch name validated against `/^[a-zA-Z0-9._\-/]{1,100}$/` before any git operation
- Repo card branch chip updates immediately after checkout

#### LemonSqueezy Licensing (Option A — Validate Once, Store Locally)
- `POST /api/license` — activates a license key via LS `/v1/licenses/activate`, consuming one activation slot
- `DELETE /api/license` — deactivates via LS `/v1/licenses/deactivate`, freeing the slot for use on another machine
- `GET /api/license` — read-only status check via LS `/v1/licenses/validate` (no slot consumed)
- Activation stores `licenseTier`, `licenseInstanceId`, `licenseActivatedAt` in `data/config.json`
- Offline fallback for `RT-PRO-XXXX` / `RT-TEAM-XXXX` format keys (dev/testing only)
- Full feature gate on AI routes, Gist sync, and Team Mode

#### Team Mode *(Team tier)*
- LAN dashboard sharing — bind to `0.0.0.0` with `npm run team` or `REPOTRACKER_TEAM=1`
- `GET /api/team/status` — returns team mode state, LAN URL, and active token count
- `POST /api/team/token` / `DELETE /api/team/token` — generate and revoke invite tokens
- Team tab shows live session status, shareable URL, and token management UI

#### Upgrade Modal (Context-Aware Paywall)
- Opens automatically when a free user attempts a Pro/Team feature
- Title, description, icon, price, and highlighted feature row update dynamically per feature
- Built-in license key input (collapsed `<details>`) — users can activate without leaving the modal
- Direct buy link routes to Pro or Team checkout based on the feature attempted

#### Activity Log
- `GET /api/activity` — returns recent events and aggregated weekly stats
- Tracks: repo scans, AI syncs, AI reviews, branch operations, terminal sessions, searches, Gist operations
- Relative timestamps correctly computed from millisecond epoch values

#### Environment Configuration
- `.env` file loaded automatically at startup using native Node.js (no `dotenv` dependency)
- All sensitive config now env-based: `LEMONSQUEEZY_API_KEY`, `PING_URL`, `PORT`, `REPOTRACKER_TEAM`
- `.env.example` committed as a safe template with all supported variables documented

### Fixed

#### Critical
- **API response shape mismatch** — `GET /api/repos` returns a plain array; frontend was reading `data.repos` (undefined), crashing the entire dashboard render with `Cannot read properties of undefined (reading 'length')`
- **`repo.status` undefined crash** — cloud/remote-only repos have no `status` object; 8 render functions (`renderMetrics`, `renderInsights`, `renderSpotlight`, `renderRepoCard`, `matchesFilter`) all crashed on `repo.status.dirtyCount`. Fixed with `?.` optional chaining and an explicit `!repo.status` guard in `matchesFilter`
- **`PUT /api/config` data loss bug** — saving Settings wiped `licenseTier`, `licenseInstanceId`, `licenseActivatedAt`, `licenseKey`, `teamTokens`, `pingOptIn`, `gistSyncId`. All fields now explicitly carried forward
- **`scanRepos()` not iterable** — `GET /api/repos` crashed with `TypeError: repos is not iterable` when `scanRepos()` returned a non-array. Fixed with `Array.isArray(rawRepos) ? rawRepos : []`
- **License activation using wrong LS endpoint** — previous code called `/v1/licenses/validate` (read-only check) for activation. Now correctly calls `/v1/licenses/activate` (consumes a slot) and `/v1/licenses/deactivate` (frees the slot)
- **11 missing API routes** — frontend called routes that returned 404: `team/status`, `team/token`, `activity`, `repos/ai-review`, `repos/branch`, `ping-optin`, `license` (POST/DELETE), `config/sync-to-gist`, `config/restore-from-gist`. All now implemented

#### Security
- **Shell injection** — `execAsync('npm install')` in auto-update replaced with `execFileAsync(npmCmd, ['install'])` — no shell string interpolation
- **WakaTime indefinite hang** — `AbortSignal.timeout(8000)` added to WakaTime fetch; returns a graceful timeout error instead of hanging

#### High
- **AI button always visible on free accounts** — `state.config.aiApiKey` after sanitization returns `'••• (saved)'` (always truthy). Button now checks `licenseKeySet` boolean instead of the masked string
- **License key exposure** — `sanitizeConfigForResponse()` now masks the license key and exposes only `licenseKeySet: Boolean`, `licenseTier`, `licenseInstanceId`, `licenseActivatedAt` — the raw key never reaches the browser
- **`updateLicenseUI()` guessing tier from masked key** — was checking if key starts with `RT-TEAM`. Now reads `licenseTier` from config (set by server during activation)
- **`revokeLicenseBtn` missing loading state** — button now shows `'Deactivating…'` and is disabled during the API call
- **Activity log timestamps showing year 2054** — `Math.floor(entry.ts / 1000)` was dividing milliseconds to seconds before passing to `relativeTime()` (which expects milliseconds). Division removed

#### Terminal
- **Shelby Terminal hardcoded to `bash` on Mac/Linux** — now reads `process.env.SHELL` so zsh, fish, and other shells work natively on macOS and Linux. Falls back to `bash` if `$SHELL` is unset

#### Pomodoro
- **Tab title not restored on dialog close** — closing the Pomodoro dialog while a session was paused left `document.title` set to `'25:00 — FOCUS | RepoTracker'`. Dialog `close` event now always clears the interval, resets `_pomoRunning`, and restores the original title

### Changed
- `src/license.js` — full redesign: `activate()` / `deactivate()` / `validate()` async functions using correct LS API endpoints
- `src/utils.js` — `normalizeConfig()` now preserves `licenseTier`, `licenseInstanceId`, `licenseActivatedAt`; `sanitizeConfigForResponse()` exposes these three fields (safe to send to browser)
- `src/constants.js` — `DEFAULT_CONFIG` updated with `licenseTier`, `licenseInstanceId`, `licenseActivatedAt` fields
- Upgrade modal rebuilt: dynamic title/desc/icon/price/feature row highlighting per feature; includes built-in license key input
- Ecosystem tab expanded from 2 panels to 3 (languages, health metrics, GitHub browser)

---

## [0.1.0] - 2026-05-26

Initial public release.

### Added

#### Core Dashboard
- Automatic recursive Git repository discovery from user-defined root folders
- Repository health scoring (0–100) based on uncommitted changes, unpushed commits, staleness, and remote divergence
- Setup wizard for first-run onboarding (root folders, app password, API keys)
- Native OS folder browser dialog (zero manual path typing)

#### AI Git Sync
- Gemini AI-powered commit message generation from uncommitted diffs
- One-click stage → commit → push workflow with live terminal feedback

#### Shelby Terminal
- Fully interactive embedded terminal powered by `xterm.js` and `node-pty`
- Real-time bidirectional I/O over WebSocket
- Slide-up panel UX integrated into the dashboard

#### Repository Tools
- Global `git grep` search across all repos simultaneously
- Floating TODO/FIXME scanner
- Language-agnostic Quick Actions — auto-parses `package.json`, `Makefile`, `Taskfile.yml`, `scripts/`
- WakaTime integration for per-repo coding time over the last 7 days
- Embedded feedback panel

#### Security
- PBKDF2-SHA512 password hashing (100,000 iterations, random salt)
- Cryptographically random, time-limited session tokens
- Strict `localhost`-only access with `Host` and `Origin` header validation
- DNS-rebinding and CSRF/CSWSH protection
- All API credentials stored server-side only

### Technical Stack
- **Backend**: Vanilla Node.js (ES Modules), `node-pty`, `ws`
- **Frontend**: Vanilla JavaScript (ES6+), `xterm.js`, custom CSS design system
- **Integrations**: GitHub API, WakaTime API, Google Gemini Pro, LemonSqueezy

---

## Version Guide

| Bump | When to use |
|---|---|
| Patch `0.2.x` | Bug fixes, security patches, minor UI tweaks |
| Minor `0.x.0` | New features, non-breaking additions |
| Major `x.0.0` | Breaking changes, architecture overhauls |

---

[Unreleased]: https://github.com/Vinit080/repotracker/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/Vinit080/repotracker/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Vinit080/repotracker/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/Vinit080/repotracker/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/Vinit080/repotracker/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Vinit080/repotracker/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Vinit080/repotracker/releases/tag/v0.1.0
