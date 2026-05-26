# Changelog

All notable changes to RepoTracker will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

> Features and fixes merged to `main` but not yet tagged as a release.

### Planned
- Multi-tabbed Shelby Terminal
- AI Code Reviewer (pre-commit diff analysis via Gemini)
- Visual Git Branch Manager
- Secret Scanner (pre-commit credential detection)

---

## [0.1.0] - 2026-05-26

Initial public release of RepoTracker.

### Added

#### Core Dashboard
- Automatic recursive Git repository discovery from user-defined root folders
- Repository health scoring based on uncommitted changes, unpushed commits, branch staleness, and remote divergence
- Smart desktop notifications when repos fall behind their upstream remote
- 1-click auto-updater that polls GitHub for new releases and pulls + reinstalls automatically

#### AI Git Sync
- Gemini AI-powered commit message generation from uncommitted diffs
- One-click stage, commit, and push workflow from the dashboard

#### Shelby Terminal
- Fully interactive embedded terminal powered by `xterm.js` and `node-pty`
- Real-time bidirectional I/O streamed over WebSocket
- Slide-up panel UX integrated directly into the dashboard

#### Repository Tools
- Native OS folder browser dialog (zero manual path typing)
- Global `git grep` search across all local repositories simultaneously
- Floating TODO / FIXME scanner across all repos
- Language-agnostic Quick Actions: auto-parses `package.json`, `Makefile`, `Taskfile.yml`, and `scripts/` for 1-click task execution (Node.js, Python, Go, C++, and more)

#### Insights
- WakaTime integration showing per-repository coding time over the last 7 days

#### Feedback
- Embedded native feedback panel (powered by Formspree) for feature requests

#### Security
- PBKDF2-SHA512 password hashing with random salt
- Cryptographically random, time-limited session tokens
- Strict `localhost`-only access with `Host` and `Origin` header validation
- Anti-DNS rebinding and CSRF/CSWSH protection
- All API credentials stored server-side only — never exposed to frontend

### Technical Stack
- **Backend**: Vanilla Node.js (ES Modules), `node-pty`, `ws`, `node-notifier`
- **Frontend**: Vanilla JavaScript (ES6+), `xterm.js`, custom Glassmorphic CSS design system
- **Integrations**: GitHub API, WakaTime API, Google Gemini Pro

---

## Version Guide

| Bump | When to use |
|---|---|
| Patch `0.1.x` | Bug fixes, security patches, minor UI tweaks |
| Minor `0.x.0` | New features, non-breaking additions |
| Major `x.0.0` | Breaking changes, architecture overhauls (e.g. Tauri migration) |

---

[Unreleased]: https://github.com/Vinit080/repotracker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Vinit080/repotracker/releases/tag/v0.1.0
