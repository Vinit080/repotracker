# 🚀 RepoTracker: Personal Git Mission Control

RepoTracker is a hyper-fast, local-first personal dashboard for your software engineering projects. It scans the folders on your machine, reads your Git statuses, and turns your disparate repositories into a centralized **Mission Control** view.

With a beautiful, glassmorphic "Black-Pink" dark mode theme, RepoTracker instantly surfaces health scores, sync drift, dirty worktrees, and action items across your entire workstation.

---

## ✨ Features

- **🏠 Local-First & Secure**: Scans local folders for Git repos. Your data never leaves your machine. Features an "App Password" security lock to prevent unauthorized access.
- **☁️ Cloud Sync**: Connects to the GitHub API to fetch your remote repositories alongside your local ones. Shows GitHub stats (stars, issues, CI status) and supports 1-click local cloning.
- **🤖 AI Standups & AI Sync**: Integrates with Google Gemini to automatically read your git commit logs and generate a professional weekly standup report. Also features **1-Click AI Sync** to automatically generate a commit message, commit, and push dirty worktrees.
- **⏱️ WakaTime Tracking**: Pulls real-time coding metrics to show exactly how many hours you spent in the editor for each specific repository.
- **🔍 Global Code Search**: A lightning-fast `Ctrl+K` unified search bar that filters your repo cards AND instantly searches code inside your project files simultaneously.
- **📝 Global TODO Aggregation**: Automatically aggregates `TODO:`, `FIXME:`, and `HACK:` comments across *all* your projects into a centralized "Action Items" queue.
- **🔔 Background Notifications**: Runs a silent background worker that sends native Windows desktop notifications if any of your repositories fall behind their remote upstream.
- **⚡ Quick Actions**: Run NPM scripts, pull the latest code, auto-install dependencies, and run security audits directly from the dashboard.

---

## 🛠️ Setup & Installation

Follow these simple steps to get your personal Mission Control up and running.

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **Git** (Accessible from your command line)

### 2. Clone and Install
Clone this repository to your local machine and install the required dependencies (like `node-notifier` for desktop alerts):

```bash
git clone https://github.com/yourusername/repotracker.git
cd repotracker
npm install
```

### 3. Start the Server
Boot up the local Node.js server. The server needs to remain running in the background to serve the dashboard and process background notifications.

```bash
npm start
```

### 4. Launch the Dashboard
Open your favorite web browser and navigate to:
```text
http://localhost:4177
```

---

## ⚙️ Configuration & API Keys

When you first launch RepoTracker, navigate to the **Settings** tab. Here you can configure everything securely. All configuration data is stored locally in the `.gitignore`'d `data/` directory.

### Root Folders (Required)
Add the absolute paths to the folders where you keep your code (e.g., `C:\Users\Name\Projects`). RepoTracker will recursively scan these folders to find your Git repositories.

### Integrations (Optional but Recommended)
Unlock the full power of RepoTracker by adding these API keys:
- **GitHub PAT:** Generate a Personal Access Token to fetch your remote repositories, CI statuses, and enable 1-click cloning.
- **Gemini AI Key:** Add a Google Gemini API key to unlock "AI Standups" and the "1-Click AI Sync" auto-commit features.
- **WakaTime Key:** Add your WakaTime Secret API Key to see time-tracking metrics directly on your repository cards.

### App Access Password
To ensure your local dashboard remains completely private, you can set an **App Access Password**. This encrypts access to the UI and all backend APIs.

---

<p align="center">
  <i>Built with Vanilla JS, CSS, and Node.js for maximum performance.</i>
</p>
