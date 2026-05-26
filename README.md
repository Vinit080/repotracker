<div align="center">
  <h1>🚀 RepoTracker</h1>
  <p><strong>Your ultimate, intelligent local Git repository manager.</strong></p>
  <p>RepoTracker automatically discovers, monitors, and manages all your local Git repositories from a beautiful, lightning-fast dashboard. With AI-powered commit messages and WakaTime insights, staying on top of your code has never been easier.</p>
</div>

---

## ✨ Features

- **📡 Automatic Discovery**: Point RepoTracker at your root folders and it instantly maps every Git repository recursively.
- **🪄 Setup Wizard**: A beautiful, guided onboarding experience that seamlessly walks you through adding folders, creating passwords, and configuring API keys on your very first launch.
- **📂 Native Folder Browser**: Ditch the manual typing. Use the built-in OS dialog to seamlessly point RepoTracker at your code directories with zero typos.
- **❤️ Health Scoring**: Repositories are automatically scored based on uncommitted changes, unpushed commits, staleness, and branch health.
- **🤖 AI Git Sync**: Generate perfectly summarized commit messages instantly via Gemini AI and push changes with a single click.
- **📊 WakaTime Integration**: See exactly how much time you've spent coding in each repository over the last 7 days.
- **🔍 Global Search**: Fast `git grep` across all your local repositories at once, and easily find floating `TODO`s or `FIXME`s.
- **📟 Shelby Terminal**: A fully integrated, interactive slide-up terminal inside the dashboard powered by `xterm.js` and `node-pty`. Streams standard input/output over WebSockets for a true, real-time developer terminal experience directly in your browser.
- **⚡ Language-Agnostic Task Runner**: Automatically parses `package.json`, `Makefile`, `Taskfile.yml`, and `scripts/` directories to expose 1-click Quick Actions across Node.js, Python, C++, Go, and more.
- **💡 Direct Line Feedback**: Embedded, native feedback panel for users to send feature requests directly to the creators, powered silently by Formspree.
- **🔄 1-Click Auto-Updater**: RepoTracker securely polls GitHub and drops a beautiful banner when new features are released. Click "Update Now" and it automatically pulls the latest code and installs dependencies.
- **🛡️ Secure by Design**: Runs locally with enterprise-grade security. PBKDF2 hashed passwords, strict session tokens, and zero API credential leakage to the browser.
- **🔔 Smart Alerts**: A background worker continuously monitors your repos and sends desktop notifications if your code falls behind the remote upstream.

## 🚀 Getting Started

RepoTracker is designed to be completely zero-configuration to start.

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher)
- [Git](https://git-scm.com/) installed and available in your PATH

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Vinit080/repotracker.git
   cd repotracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open the Dashboard**
   Navigate to `http://localhost:4177` in your browser. The built-in onboarding screen will guide you through adding your code directories and API keys!

### Configuring your GitHub Token

To enable features like cloning and viewing GitHub Action statuses or PRs, you'll need to provide a Personal Access Token (PAT).

**Option 1: Fine-Grained Token (Recommended)**
Follow these steps to generate a secure, scoped token:
1. Go to your GitHub **Settings** > **Developer settings**.
2. Select **Personal access tokens** > **Fine-grained tokens**, then click **Generate new token**.
3. Name it "RepoTracker" and set the **Resource owner** to yourself.
4. Under **Repository access**, select **All repositories** (or specific repos if you prefer).
5. Under **Repository permissions**, find and set the following 5 permissions to **Read-only**:
   - Actions
   - Commit statuses
   - Contents
   - Issues
   - Pull Requests
6. Click **Generate token** and copy it immediately.

**Option 2: Classic Token**
Create a token and check the **`repo`** scope box.

*Paste your generated token into the Settings tab of the dashboard.*

## 🔒 Security First

Because RepoTracker interacts directly with your file system and executes shell commands, it was built with a highly defensive architecture:
- **No Plaintext Passwords**: Authentication relies on PBKDF2-SHA512 hashing and secure, time-limited cryptographic session tokens.
- **Sanitized Configurations**: Sensitive keys (GitHub PAT, Gemini Key) are never exposed to the frontend console.
- **Command Injection Prevention**: Strict validation and shell-escaping prevent malicious execution through URL cloning or regex searches.
- **Anti-DNS Rebinding / CSRF Guard**: Strictly allows only `localhost` access and enforces `Origin` and `Host` validations across all REST and WebSocket connections, fully neutralizing Cross-Site WebSocket Hijacking (CSWSH) and standard CSRF attacks.

## 🛠️ Technology Stack

- **Backend**: Node.js (Vanilla, zero heavy frameworks), `node-pty` for native OS terminal spawning, `node-notifier` for native OS alerts.
- **Frontend**: Vanilla JavaScript (ES6+), Semantic HTML5, `xterm.js` for robust terminal emulation, and a custom lightweight Glassmorphic CSS design system.
- **Integrations**: GitHub API, WakaTime API, Google Gemini Pro.

## 🤝 Collaborators & Contributors

A massive thank you to the brilliant minds who helped bring this project to life. Your contributions, reviews, and ideas made RepoTracker possible:

- **Vinzone** (Creator)
- **Shravan Sharma** ([Shravan403](https://github.com/Shravan403))
- **Soham Jarad** ([sohamjarad](https://github.com/sohamjarad))

---

<div align="center">
  <p>Built with ❤️ for developers who love to code.</p>
</div>
