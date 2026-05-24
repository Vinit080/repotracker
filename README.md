# 🚀 RepoTracker — Personal Git Mission Control

RepoTracker is a **local-first**, zero-cloud personal dashboard for every Git repository on your machine. Point it at your code folders and it instantly surfaces health scores, sync drift, dirty worktrees, and action items — all in a beautiful dark-mode UI with no subscription, no telemetry, and no data leaving your computer.

![RepoTracker Dashboard](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![Local First](https://img.shields.io/badge/data-local--only-pink)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🏠 **Local-First & Private** | All data stored in `data/` on your machine. Never uploaded anywhere. |
| 🔒 **App Password Lock** | Optional password protection — locks the entire UI and all APIs. |
| ☁️ **GitHub Cloud Sync** | Fetch your remote repos, stars, open issues, CI status. 1-click clone to local. |
| 🤖 **AI Standup Generator** | Reads your git logs and generates a professional weekly standup report via Gemini. |
| 🪄 **1-Click AI Sync** | Auto-generates a commit message, commits, and pushes dirty worktrees with one button. |
| ⏱️ **WakaTime Integration** | Shows real editor hours per repo from your WakaTime account. |
| 🔍 **Global Code Search** | `Ctrl+K` palette — searches repo names AND source code across all projects instantly. |
| 📝 **TODO Aggregator** | Collects every `TODO:`, `FIXME:`, and `HACK:` across all repos into one action queue. |
| 🔔 **Background Notifications** | Native desktop alerts when repos fall behind their remote upstream. |
| ⚡ **Quick Actions** | Run npm scripts, `Pull & Setup` (git pull + install deps), and `npm audit` from the card. |
| 🎨 **Smart Theme** | Glassmorphic dark/light mode with full system preference detection. |

---

## 🛠️ Setup

### Prerequisites
- **Node.js** v20 or higher
- **Git** available on your PATH

### Install & Run

```bash
git clone https://github.com/yourusername/repotracker.git
cd repotracker
npm install
npm start
```

Then open **http://localhost:4177** in your browser.

On first launch, RepoTracker will show an **onboarding screen** to configure your code folders. It will also auto-detect common developer directories (e.g. `~/Projects`, `~/Documents/GitHub`) and pre-fill them for you.

---

## ⚙️ Configuration

All settings live in the **Settings tab** in the UI. Everything is stored locally in `data/config.json` (gitignored — your secrets never leave your machine).

### Root Folders
Absolute paths to folders where you keep your code, one per line. RepoTracker scans these recursively up to the configured depth.

```
C:\Users\Name\Projects
C:\Work\Repos
```

### Optional Integrations

| Key | Where to get it | Unlocks |
|---|---|---|
| **GitHub PAT** | [github.com/settings/tokens](https://github.com/settings/tokens) — `repo` scope | Cloud repos, stars, CI status, clone |
| **Gemini API Key** | [aistudio.google.com](https://aistudio.google.com/app/apikey) | AI Standup, AI Sync |
| **WakaTime Key** | [wakatime.com/settings/api-key](https://wakatime.com/settings/api-key) | Hours-per-repo time tracking |

### App Access Password
Set a password in Settings to lock the dashboard behind a login screen. The password is stored in `data/config.json` (local only). To unlock from another browser session, enter the password on the lock screen.

---

## 📁 Project Structure

```
repotracker/
├── src/
│   ├── server.js          # HTTP server entry point
│   ├── git.js             # Git scanning & repo analysis
│   ├── utils.js           # JSON helpers, config normalization
│   ├── constants.js       # Port, paths, MIME types, defaults
│   └── routes/
│       └── api.js         # All /api/* route handlers
├── public/
│   ├── index.html         # Single-page app shell
│   ├── styles.css         # Design system & all styles
│   └── js/
│       ├── app.js         # Main frontend logic
│       ├── api.js         # Fetch wrapper with auth
│       └── components.js  # Shared render helpers
└── data/                  # Gitignored — created at runtime
    ├── config.json        # Your settings & API keys
    └── repo-meta.json     # Pinned repos, notes, tags
```

---

## 🔒 Security Notes

- `data/config.json` is **gitignored** by default — your API keys and password will never be committed.
- The App Password is stored in plaintext locally (it protects the web UI, not the file system).
- All GitHub/Gemini/WakaTime API calls are proxied through the local Node.js server — your keys are never exposed to the browser.

---

<p align="center">
  <i>Built with Vanilla JS, CSS, and Node.js — no framework, no bundler, no build step.</i>
</p>
