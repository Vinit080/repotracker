import { api } from './api.js';
import { escapeHtml, escapeAttribute, renderChip, emptySmall } from './components.js';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  repos: [],
  config: null,
  query: '',
  filter: 'all',
  loading: false,
  timeline: []
};

// ─── DOM References ───────────────────────────────────────────────────────────
const el = {
  shell: document.querySelector('.shell'),
  wizard: document.querySelector('#wizard'),

  // Wizard
  wizardEl: document.querySelector('#wizard'),
  wizardStepLabel: document.querySelector('#wizardStepLabel'),
  wizardDots: document.querySelectorAll('.wizard-dot'),
  wizardSteps: document.querySelectorAll('.wizard-step'),
  // Step 1
  wizStep1Next: document.querySelector('#wizStep1Next'),
  wizName: document.querySelector('#wiz-name'),
  wizPw: document.querySelector('#wiz-pw'),
  wizPwConfirm: document.querySelector('#wiz-pw-confirm'),
  wizPwError: document.querySelector('#wizPwError'),
  wizSkipPwCheck: document.querySelector('#wizSkipPwCheck'),
  // Step 2
  wizStep2Back: document.querySelector('#wizStep2Back'),
  wizStep2Next: document.querySelector('#wizStep2Next'),
  wizStep2Skip: document.querySelector('#wizStep2Skip'),
  wizFolderList: document.querySelector('#wizFolderList'),
  wizAddFolderBtn: document.querySelector('#wizAddFolderBtn'),
  // Step 3
  wizStep3Back: document.querySelector('#wizStep3Back'),
  wizStep3Next: document.querySelector('#wizStep3Next'),
  wizStep3Skip: document.querySelector('#wizStep3Skip'),
  wizGhToken: document.querySelector('#wizGhToken'),
  wizVerifyBtn: document.querySelector('#wizVerifyBtn'),
  wizTokenStatus: document.querySelector('#wizTokenStatus'),
  // Step 4
  wizStep4Back: document.querySelector('#wizStep4Back'),
  wizFinishBtn: document.querySelector('#wizFinishBtn'),
  wizSkipAllBtn: document.querySelector('#wizSkipAllBtn'),
  wizAiKey: document.querySelector('#wizAiKey'),
  wizWakaKey: document.querySelector('#wizWakaKey'),

  // Auth
  authDialog: document.querySelector('#authDialog'),
  authForm: document.querySelector('#authForm'),
  authPasswordInput: document.querySelector('#authPasswordInput'),
  authGreeting: document.querySelector('#authGreeting'),

  // Update Banner
  systemUpdateBanner: document.querySelector('#systemUpdateBanner'),
  updateBannerText: document.querySelector('#updateBannerText'),
  applyUpdateBtn: document.querySelector('#applyUpdateBtn'),

  // Topbar
  scanButton: document.querySelector('#scanButton'),
  themeToggleBtn: document.querySelector('#themeToggleBtn'),
  feedbackBtn: document.querySelector('#feedbackBtn'),
  logoutBtn: document.querySelector('#logoutBtn'),

  // Repos tab
  scanMeta: document.querySelector('#scanMeta'),
  spotlight: document.querySelector('#spotlight'),
  metricsGrid: document.querySelector('#metricsGrid'),
  searchInput: document.querySelector('#searchInput'),
  filterRow: document.querySelector('#filterRow'),
  repoGrid: document.querySelector('#repoGrid'),
  resultCount: document.querySelector('#resultCount'),

  // Templates
  repoCardTemplate: document.getElementById('repoCardTemplate'),

  // Insights tab
  attentionList: document.querySelector('#attentionList'),
  languageList: document.querySelector('#languageList'),
  timelineList: document.querySelector('#timelineList'),
  todoList: document.querySelector('#todoList'),
  standupButton: document.querySelector('#standupButton'),
  standupDialog: document.querySelector('#standupDialog'),
  standupContent: document.querySelector('#standupContent'),

  // Feedback tab
  feedbackDialog: document.querySelector('#feedbackDialog'),
  feedbackForm: document.querySelector('#feedbackForm'),
  feedbackText: document.querySelector('#feedbackText'),

  // Settings tab
  rootsInput: document.querySelector('#rootsInput'),
  settingsBrowseBtn: document.querySelector('#settingsBrowseBtn'),
  depthInput: document.querySelector('#depthInput'),
  userNameInput: document.querySelector('#userNameInput'),
  patInput: document.querySelector('#patInput'),
  aiKeyInput: document.querySelector('#aiKeyInput'),
  wakaKeyInput: document.querySelector('#wakaKeyInput'),
  appPasswordInput: document.querySelector('#appPasswordInput'),
  saveSettingsButton: document.querySelector('#saveSettingsButton'),

  // Modals
  searchDialog: document.querySelector('#searchDialog'),
  globalSearchInput: document.querySelector('#globalSearchInput'),
  searchResults: document.querySelector('#searchResults'),
  cloneDialog: document.querySelector('#cloneDialog'),
  cloneDestSelect: document.querySelector('#cloneDestSelect'),
  confirmCloneButton: document.querySelector('#confirmCloneButton'),

  // Shelby Terminal
  shelbyTerminal: document.querySelector('#shelbyTerminal'),
  shelbyResizer: document.querySelector('#shelbyResizer'),
  shelbyStatus: document.querySelector('#shelbyStatus'),
  shelbyCloseBtn: document.querySelector('#shelbyCloseBtn'),
  shelbyAbortBtn: document.querySelector('#shelbyAbortBtn'),
};

// ─── Shelby Terminal ──────────────────────────────────────────────────────────
let activeShelbyTask = null;
let shelbyWs = null;
let shelbyTerminalInstance = null;
let shelbyFitAddon = null;

function initTerminal() {
  if (shelbyTerminalInstance) return;
  const container = document.getElementById('terminal-container');
  
  const style = getComputedStyle(document.documentElement);
  const bg = style.getPropertyValue('--bg-card').split(',')[0].replace('linear-gradient(145deg', '').replace('(', '').trim() || 'transparent'; // Fallback if parsing fails
  const text = style.getPropertyValue('--text').trim() || '#fdfdfd';
  const accent = style.getPropertyValue('--accent').trim() || '#ff66a3';

  shelbyTerminalInstance = new Terminal({
    theme: {
      background: 'transparent',
      foreground: text,
      cursor: accent,
      cursorAccent: '#000000',
      selectionBackground: 'rgba(255, 102, 163, 0.3)',
      black: '#1e212b',
      red: '#ff4a4a',
      green: '#4ade80',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: text
    },
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: 14,
    cursorBlink: true
  });
  shelbyFitAddon = new FitAddon.FitAddon();
  shelbyTerminalInstance.loadAddon(shelbyFitAddon);
  shelbyTerminalInstance.open(container);
  
  shelbyTerminalInstance.onData(data => {
    if (shelbyWs && shelbyWs.readyState === WebSocket.OPEN) {
      shelbyWs.send(data);
    }
  });

  window.addEventListener('resize', () => {
    if (!el.shelbyTerminal.classList.contains('hidden') && shelbyFitAddon) {
      shelbyFitAddon.fit();
      if (shelbyWs && shelbyWs.readyState === WebSocket.OPEN) {
        shelbyWs.send(JSON.stringify({ type: 'resize', cols: shelbyTerminalInstance.cols, rows: shelbyTerminalInstance.rows }));
      }
    }
  });
}

function openShelby(title, taskId) {
  el.shelbyStatus.textContent = `— ${title}`;
  el.shelbyTerminal.classList.remove('hidden');
  el.shelbyAbortBtn.classList.remove('hidden');
  activeShelbyTask = taskId;

  initTerminal();
  shelbyTerminalInstance.clear();
  // slightly delay fit to ensure DOM is updated
  setTimeout(() => { shelbyFitAddon.fit(); }, 50);

  if (shelbyWs) shelbyWs.close();

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  shelbyWs = new WebSocket(`${protocol}//${location.host}/api/tasks/stream?taskId=${taskId}`);

  shelbyWs.onopen = () => {
    shelbyWs.send(JSON.stringify({ type: 'resize', cols: shelbyTerminalInstance.cols, rows: shelbyTerminalInstance.rows }));
  };

  shelbyWs.onmessage = (e) => {
    shelbyTerminalInstance.write(e.data);
  };

  shelbyWs.onclose = () => {
    shelbyTerminalInstance.write('\r\n[Stream disconnected]\r\n');
    el.shelbyAbortBtn.classList.add('hidden');
    activeShelbyTask = null;
  };
}

if (el.shelbyCloseBtn) {
  el.shelbyCloseBtn.addEventListener('click', () => {
    el.shelbyTerminal.classList.add('hidden');
  });
}

// Resizer Logic
let isResizingShelby = false;
if (el.shelbyResizer) {
  el.shelbyResizer.addEventListener('mousedown', (e) => {
    isResizingShelby = true;
    document.body.style.cursor = 'ns-resize';
  });
}

window.addEventListener('mousemove', (e) => {
  if (!isResizingShelby) return;
  const newHeight = window.innerHeight - e.clientY;
  if (newHeight > 100 && newHeight < window.innerHeight - 100) {
    el.shelbyTerminal.style.height = `${newHeight}px`;
    if (shelbyFitAddon) {
      shelbyFitAddon.fit();
      if (shelbyWs && shelbyWs.readyState === WebSocket.OPEN) {
        shelbyWs.send(JSON.stringify({ type: 'resize', cols: shelbyTerminalInstance.cols, rows: shelbyTerminalInstance.rows }));
      }
    }
  }
});

window.addEventListener('mouseup', () => {
  if (isResizingShelby) {
    isResizingShelby = false;
    document.body.style.cursor = '';
  }
});

if (el.shelbyAbortBtn) {
  el.shelbyAbortBtn.addEventListener('click', async () => {
    if (activeShelbyTask) {
      el.shelbyAbortBtn.disabled = true;
      el.shelbyAbortBtn.textContent = 'Killing...';
      try {
        await api('/api/tasks/kill', { method: 'POST', body: JSON.stringify({ taskId: activeShelbyTask }) });
        shelbyTerminalInstance?.write('\r\n[Process killed by user]\r\n');
      } catch {
        showToast('Failed to kill process', 'error');
      }
      el.shelbyAbortBtn.textContent = 'Abort';
      el.shelbyAbortBtn.disabled = false;
      el.shelbyAbortBtn.classList.add('hidden');
    }
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

// ─── Self-Updater ─────────────────────────────────────────────────────────────
let _updateDownloadUrl = null; // stored for the button click handler

async function checkForAppUpdates() {
  try {
    const res = await api('/api/system/check-update');
    if (!res.updateAvailable) return;

    el.systemUpdateBanner.classList.remove('hidden');

    if (res.isExe) {
      // ── Packaged .exe: show a download link ───────────────────────────
      _updateDownloadUrl = res.downloadUrl;
      el.updateBannerText.textContent = `✨ RepoTracker ${res.latestVersion} is available! (you have ${res.currentVersion})`;
      if (el.applyUpdateBtn) {
        el.applyUpdateBtn.textContent = `Download ${res.latestVersion}`;
        el.applyUpdateBtn.dataset.exeUpdate = '1'; // flag for click handler
      }
    } else {
      // ── Git clone: show commit count and apply-update button ───────────────
      el.updateBannerText.textContent = `A new update for RepoTracker is available! (${res.commitsBehind} commit${res.commitsBehind !== 1 ? 's' : ''} behind)`;
      if (el.applyUpdateBtn) el.applyUpdateBtn.textContent = 'Update Now';
    }
  } catch (err) {
    console.error('Failed to check for system updates', err);
  }
}

el.applyUpdateBtn?.addEventListener('click', async () => {
  const btn = el.applyUpdateBtn;

  // ── .exe path: open GitHub Releases page in browser ─────────────────────────
  if (btn.dataset.exeUpdate === '1' && _updateDownloadUrl) {
    window.open(_updateDownloadUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // ── git-clone path: apply update server-side ─────────────────────────────
  const originalText = btn.textContent;
  btn.textContent = 'Updating...';
  btn.disabled = true;
  try {
    await api('/api/system/apply-update', { method: 'POST', body: JSON.stringify({}) });
    btn.textContent = 'Success!';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      alert('Update successful! Please restart your terminal/server to apply the changes.');
      location.reload();
    }, 500);
  } catch (err) {
    btn.textContent = originalText;
    btn.disabled = false;
    showToast('Failed to apply update.', 'error');
  }
});

// ─── Toast Notifications (L1: replaces all alert() calls) ────────────────────
const _toastQueue = [];
let _toastVisible = false;

function showToast(message, type = 'info') {
  _toastQueue.push({ message, type });
  if (!_toastVisible) _drainToast();
}

function _drainToast() {
  if (!_toastQueue.length) { _toastVisible = false; return; }
  _toastVisible = true;
  const { message, type } = _toastQueue.shift();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.remove(); _drainToast(); }, 320);
  }, type === 'error' ? 5000 : 3500);
}

function relativeTime(timestamp) {
  if (!timestamp) return 'No commits yet';
  const targetDate = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.round((targetDate.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86_400_000);
  if (diffDays === 0) return 'today';
  if (Math.abs(diffDays) < 45) return relativeFormatter.format(diffDays, 'day');
  return relativeFormatter.format(Math.round(diffDays / 30), 'month');
}

function normalizeRemote(url) {
  if (!url) return '';
  if (url.startsWith('git@github.com:')) return `https://github.com/${url.replace('git@github.com:', '').replace(/\.git$/, '')}`;
  return url.replace(/\.git$/, '');
}

// ─── Config ───────────────────────────────────────────────────────────────────
async function loadConfig() {
  try {
    state.config = await api('/api/config');
    el.rootsInput.value = (state.config.roots || []).join('\n');
    el.depthInput.value = state.config.maxDepth || 4;
    el.userNameInput.value = state.config.userName || '';
    // C2: API keys arrive masked ('••• (saved)') or as empty string
    el.patInput.value = state.config.githubPat || '';
    el.aiKeyInput.value = state.config.aiApiKey || '';
    el.wakaKeyInput.value = state.config.wakatimeApiKey || '';
    // C2: password hash never arrives from server; use appPasswordSet boolean
    el.appPasswordInput.value = '';
    el.appPasswordInput.placeholder = state.config.appPasswordSet
      ? 'Password set \u2014 leave blank to keep, type to change'
      : 'Leave blank for no password';
    el.logoutBtn.classList.toggle('hidden', !state.config.appPasswordSet);
    return true;
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') {
      el.authGreeting.textContent = err.data?.userName ? `Welcome back, ${err.data.userName}` : 'Locked';
      el.shell.style.display = 'none';
      el.authDialog.showModal();
      return false;
    }
    console.error('loadConfig error:', err);
    return false;
  }
}

// ─── Scanning ─────────────────────────────────────────────────────────────────
async function scanRepos() {
  state.loading = true;
  el.scanButton.disabled = true;
  el.scanButton.textContent = 'Scanning...';
  el.scanMeta.textContent = 'Scanning folders and reading Git state...';

  try {
    const data = await api('/api/repos');
    // API returns a plain array of repos (not { repos: [...] })
    const repos = Array.isArray(data) ? data : (data.repos || []);
    state.repos = repos;
    if (data.roots)     state.config = { ...state.config, roots: data.roots, maxDepth: data.maxDepth };
    const scannedAt = data.scannedAt ? ` · ${dateFormatter.format(new Date(data.scannedAt))}` : '';
    el.scanMeta.textContent = `${repos.length} repos found${scannedAt}`;
    if (data.errors?.length) el.scanMeta.textContent += ` · ${data.errors.join('; ')}`;
    render();
    fetchGithubRepos();
    fetchTimeline();
    fetchTodos();
    fetchWakatimeStats();
    checkForAppUpdates();
    if (typeof populateEcosystemTab === 'function') populateEcosystemTab();
  } catch (err) {
    el.scanMeta.textContent = err.message;
    if (err.message === 'UNAUTHORIZED') {
      el.shell.style.display = 'none';
      el.authDialog.showModal();
    }
  } finally {
    state.loading = false;
    el.scanButton.disabled = false;
    el.scanButton.textContent = 'Scan repos';
  }
}

// ─── Render Helpers ───────────────────────────────────────────────────────────
function isStale(repo) {
  if (!repo.lastCommit?.timestamp) return true;
  return Date.now() - repo.lastCommit.timestamp > 30 * 86_400_000;
}

function matchesFilter(repo) {
  if (state.filter === 'all') return true;
  if (state.filter === 'pinned') return repo.pinned;

  // Cloud repos and repos with no local status don't apply to health filters
  if (repo.isCloud || !repo.status) return false;

  const map = {
    dirty:  repo.status.dirtyCount > 0,
    ahead:  repo.status.ahead > 0,
    behind: repo.status.behind > 0,
    stale:  isStale(repo),
    clean:  !repo.status.dirtyCount && !repo.status.ahead && !repo.status.behind,
    risk:   isStale(repo) || repo.status.behind > 10 || repo.status.dirtyCount > 10 || repo.github?.ci === 'failure'
  };
  return Boolean(map[state.filter]);
}

function matchesQuery(repo) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return [repo.name, repo.path, repo.branch, repo.remoteUrl, repo.note, ...(repo.tags || []), ...(repo.languages || []).map(l => l.name)]
    .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
}

function getVisibleRepos() {
  return state.repos
    .filter(r => matchesFilter(r) && matchesQuery(r))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      return a.name.localeCompare(b.name);
    });
}

function render() {
  const visible = getVisibleRepos();
  renderMetrics();
  renderSpotlight();
  renderInsights();
  renderRepos(visible);
  if (typeof populateEcosystemTab === 'function') populateEcosystemTab();
  el.resultCount.textContent = `${visible.length} shown`;
}

function renderMetrics() {
  const repos = state.repos;
  const items = [
    ['Total repos',     repos.length],
    ['Need attention',  repos.filter(r => r.health < 75 || r.status?.dirtyCount || r.status?.behind).length],
    ['Dirty worktrees', repos.filter(r => r.status?.dirtyCount > 0).length],
    ['Sync drift',      repos.filter(r => r.status?.ahead || r.status?.behind).length]
  ];
  el.metricsGrid.replaceChildren(...items.map(([label, value]) => {
    const card = document.createElement('article');
    card.className = 'metric';
    card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    return card;
  }));
}

function renderSpotlight() {
  const [repo] = [...state.repos].sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    return a.health - b.health || (b.status?.dirtyCount || 0) - (a.status?.dirtyCount || 0);
  });
  if (!repo) {
    el.spotlight.innerHTML = '<span class="muted">Spotlight appears after scanning.</span>';
    return;
  }
  const remote = normalizeRemote(repo.remoteUrl);
  el.spotlight.innerHTML = `
    <div>
      <p class="eyebrow">Spotlight</p>
      <h3>${escapeHtml(repo.name)}</h3>
      <p class="path" title="${escapeAttribute(repo.path)}">${escapeHtml(repo.path)}</p>
      <div class="chips">
        ${renderChip(`Health ${repo.health}`, repo.health < 70 ? 'danger' : repo.health < 86 ? 'warn' : '')}
        ${renderChip(repo.branch || 'detached', 'info')}
        ${repo.status?.dirtyCount ? renderChip(`${repo.status.dirtyCount} changed`, 'warn') : renderChip('clean')}
      </div>
    </div>
    <div>
      <p class="muted">${escapeHtml((repo.attention || []).join(' - '))}</p>
      <div class="card-actions">
        <button class="ghost" type="button" data-open-spotlight="${escapeAttribute(repo.path)}">Open folder</button>
        ${remote && /^https:\/\//.test(remote) ? `<a class="remote-link" href="${escapeAttribute(remote)}" target="_blank" rel="noreferrer">Remote</a>` : ''}
      </div>
    </div>
  `;
}

function renderInsights() {
  const attention = [...state.repos]
    .filter(r => r.health < 85 || r.status?.dirtyCount || r.status?.behind)
    .slice(0, 6);

  el.attentionList.replaceChildren(
    ...(attention.length
      ? attention.map(r => {
        const d = document.createElement('div');
        d.className = 'attention-item';
        d.innerHTML = `<span>${escapeHtml(r.name)}</span><strong>${r.health}</strong>`;
        return d;
      })
      : [emptySmall('Everything looks calm.')])
  );

  const langCounts = new Map();
  for (const r of state.repos) {
    for (const l of (r.languages || [])) {
      langCounts.set(l.name, (langCounts.get(l.name) || 0) + 1);
    }
  }
  const langItems = [...langCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  el.languageList.replaceChildren(
    ...(langItems.length
      ? langItems.map(([lang, count]) => {
        const d = document.createElement('div');
        d.className = 'language-pill';
        d.innerHTML = `<span>${escapeHtml(lang)}</span><strong>${count}</strong>`;
        return d;
      })
      : [emptySmall('No language data yet.')])
  );
}

function renderRepos(repos) {
  if (!repos.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = state.repos.length
      ? 'No repositories match the current view.'
      : 'No Git repositories found. Add a root folder in Settings and scan.';
    el.repoGrid.replaceChildren(empty);
    return;
  }
  el.repoGrid.replaceChildren(...repos.map(repo => {
    const fragment = renderRepoCard(repo);
    // Wire new feature buttons after the card is built
    if (!repo.isRemoteOnly) {
      const aiRevBtn = fragment.querySelector('.ai-review-button');
      // P6: use licenseKeySet, not the masked key string, to detect if AI is configured
      if (aiRevBtn && repo.status?.dirtyCount > 0 && state.config?.aiApiKey && state.config.aiApiKey !== '') {
        wireAiReviewButton(aiRevBtn, repo);
      }
      const branchBtn = fragment.querySelector('.branch-button');
      if (branchBtn) wireBranchButton(branchBtn, repo);
    }
    return fragment;
  }));
}

function renderRepoCard(repo) {
  const fragment = el.repoCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.repo-card');
  const title = fragment.querySelector('h4');
  const pathText = fragment.querySelector('.path');
  const pinButton = fragment.querySelector('.pin-button');
  const ring = fragment.querySelector('.health-ring');
  const ringText = fragment.querySelector('.health-ring span');
  
  ring.addEventListener('click', () => {
    document.getElementById('healthInfoDialog').showModal();
  });
  const chips = fragment.querySelector('.chips');
  const ghStats = fragment.querySelector('.github-stats');
  const wakaStats = fragment.querySelector('.wakatime-stats');
  const statusLine = fragment.querySelector('.status-line');
  const commitLine = fragment.querySelector('.commit-line');
  const tagInput = fragment.querySelector('.tag-editor input');
  const note = fragment.querySelector('.note');
  const openButton = fragment.querySelector('.open-button');
  const remoteLink = fragment.querySelector('.remote-link');
  const qaDropdown = fragment.querySelector('.quick-actions-dropdown');
  const qaMenu = qaDropdown?.querySelector('.dropdown-menu');
  const auditBtn = fragment.querySelector('.audit-button');
  const setupBtn = fragment.querySelector('.setup-button');
  const aisyncBtn = fragment.querySelector('.aisync-button');
  const shelbyBtn = fragment.querySelector('.shelby-pro-btn');
  const cloneBtn = fragment.querySelector('.clone-button');

  title.textContent = repo.name;
  pathText.textContent = repo.path;
  pathText.title = repo.path;
  pinButton.classList.toggle('active', repo.pinned);
  ring.style.setProperty('--score', `${repo.health}%`);
  ringText.textContent = repo.health;

  chips.innerHTML = [
    repo.isRemoteOnly ? renderChip('☁️ Cloud', 'info') : '',
    !repo.isRemoteOnly ? renderChip(repo.branch || 'detached', 'info') : '',
    repo.status?.dirtyCount ? renderChip(`${repo.status.dirtyCount} changed`, 'warn') : (!repo.isRemoteOnly ? renderChip('clean') : ''),
    repo.status?.ahead  ? renderChip(`ahead ${repo.status.ahead}`, 'warn') : '',
    repo.status?.behind ? renderChip(`behind ${repo.status.behind}`, 'danger') : '',
    ...(repo.tags || []).map(tag => renderChip(tag))
  ].join('');

  // GitHub stats
  if (repo.github) {
    ghStats.classList.remove('hidden');
    const ci = repo.github.ci === 'failure' ? '<span class="chip danger">CI Failing</span>'
      : repo.github.ci === 'success' ? '<span class="chip info">CI Passing</span>' : '';
    ghStats.innerHTML = `<div class="gh-metrics">
      <span class="gh-stat" title="Stars">★ ${Number(repo.github.stars) || 0}</span>
      <span class="gh-stat" title="Open Issues">⨀ ${Number(repo.github.issues) || 0}</span>
      <span class="gh-stat" title="Pull Requests">⎇ ${Number(repo.github.prs) || 0}</span>
      ${ci}
    </div>`;
  }

  // WakaTime stats
  if (repo.wakatime) {
    wakaStats.classList.remove('hidden');
    wakaStats.innerHTML = `<span>⏱ ${repo.wakatime.hours}h this week</span>`;
  }

  const langText = (repo.languages || []).map(l => l.name).join(', ') || 'No language signal';
  if (repo.isRemoteOnly) {
    statusLine.innerHTML = `<span>${escapeHtml(langText)}</span><span>Remote Repository</span>`;
    commitLine.innerHTML = `<span>Not downloaded</span><span></span>`;
  } else {
    statusLine.innerHTML = `<span>${escapeHtml(langText)}</span><span>${Number(repo.commitCount) || 0} commits</span>`;
    commitLine.innerHTML = repo.lastCommit
      ? `<span title="${escapeAttribute(repo.lastCommit.subject)}">${escapeHtml(repo.lastCommit.hash)} ${escapeHtml(repo.lastCommit.subject)}</span><span>${relativeTime(repo.lastCommit.timestamp)}</span>`
      : '<span>No commits yet</span><span></span>';
  }

  tagInput.value = (repo.tags || []).join(', ');
  // M4 Contract: notes are stored raw and must only be rendered via .value or .textContent, never via innerHTML
  note.value = repo.note || '';

  // Quick actions (Shelby)
  if (repo.scripts?.length && qaDropdown && qaMenu) {
    qaDropdown.classList.remove('hidden');
    qaMenu.innerHTML = repo.scripts.map((s, i) => 
      `<button type="button" class="dropdown-item" data-idx="${i}">
         <span class="muted">[${escapeHtml(s.runner)}]</span> ${escapeHtml(s.name)}
       </button>`
    ).join('');
    
    qaMenu.querySelectorAll('.dropdown-item').forEach(btn => {
      btn.addEventListener('click', async e => {
        qaDropdown.removeAttribute('open');
        const idx = btn.getAttribute('data-idx');
        const scriptObj = repo.scripts[idx];
        try {
          const res = await api('/api/repos/action', { method: 'POST', body: JSON.stringify({ path: repo.path, scriptCmd: scriptObj.cmd }) });
          openShelby(scriptObj.cmd, res.taskId);
        }
        catch (err) { showToast(`Failed to start: ${err.message}`, 'error'); }
      });
    });
  }

  // Pin
  pinButton.addEventListener('click', () => updateRepoMeta(repo, { pinned: !repo.pinned }));

  // Note
  note.addEventListener('change', () => updateRepoMeta(repo, { note: note.value }));

  // Tags
  tagInput.addEventListener('change', () => {
    const tags = tagInput.value.split(',').map(t => t.trim()).filter(Boolean);
    updateRepoMeta(repo, { tags });
  });

  if (repo.isRemoteOnly) {
    setupBtn.classList.add('hidden');
    auditBtn.classList.add('hidden');
    openButton.classList.add('hidden');
    cloneBtn.classList.remove('hidden');
    cloneBtn.addEventListener('click', () => {
      const roots = state.config?.roots || [];
      if (roots.length === 0) {
        showToast('Please configure at least one folder in Settings to clone repositories into.', 'warn');
        return;
      }
      el.cloneDestSelect.innerHTML = roots
        .map(r => `<option value="${escapeAttribute(r)}">${escapeHtml(r)}</option>`).join('');
      el.confirmCloneButton.onclick = async () => {
        el.confirmCloneButton.disabled = true;
        el.confirmCloneButton.textContent = 'Cloning...';
        try {
          const res = await api('/api/repos/clone', { method: 'POST', body: JSON.stringify({ root: el.cloneDestSelect.value, url: repo.remoteUrl, name: repo.name }) });
          el.cloneDialog.close();
          openShelby(`Clone ${repo.name}`, res.taskId);
        } catch (e) { showToast('Clone failed: ' + e.message, 'error'); }
        finally { el.confirmCloneButton.disabled = false; el.confirmCloneButton.textContent = 'Clone'; }
      };
      el.cloneDialog.showModal();
    });
  } else {
    // L3: only show Audit button when repo has a package.json (scripts !== null)
    if (!repo.scripts) auditBtn.classList.add('hidden');

    setupBtn.addEventListener('click', async () => {
      try {
        const res = await api('/api/repos/setup', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
        openShelby('Auto-Setup', res.taskId);
      } catch (err) { showToast(`Auto-setup failed: ${err.message}`, 'error'); }
    });

    shelbyBtn.classList.remove('hidden');
    shelbyBtn.addEventListener('click', async () => {
      try {
        const res = await api('/api/repos/terminal', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
        openShelby('Terminal', res.taskId);
      } catch (err) { showToast(`Failed to start: ${err.message}`, 'error'); }
    });

    auditBtn.addEventListener('click', async () => {
      auditBtn.textContent = 'Auditing...';
      try {
        const res = await api('/api/repos/audit', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
        const v = res.metadata?.vulnerabilities;
        if (v && (v.high > 0 || v.critical > 0)) {
          showToast(`⚠️ Vulnerabilities in ${repo.name}! High: ${v.high}, Critical: ${v.critical}`, 'warn');
        } else {
          showToast(`✅ Audit passed for ${repo.name} — no high/critical issues.`, 'success');
        }
      } catch (err) { showToast(`Audit failed: ${err.message}`, 'error'); }
      finally { auditBtn.textContent = 'Audit'; }
    });

    if (repo.status?.dirtyCount > 0) {
      aisyncBtn.classList.remove('hidden');
      aisyncBtn.classList.add('accent');
      aisyncBtn.addEventListener('click', async () => {
        aisyncBtn.disabled = true;
        aisyncBtn.textContent = 'Syncing...';
        try {
          const res = await api('/api/repos/aisync', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
          showToast(`✅ Synced! Commit: "${res.message}"`, 'success');
          scanRepos();
        } catch (err) { showToast(`AI Sync failed: ${err.message}`, 'error'); }
        finally { aisyncBtn.disabled = false; aisyncBtn.textContent = 'AI Sync 🪄'; }
      });
    }

    openButton.addEventListener('click', () => {
      api('/api/repos/open', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
    });
  }

  // M3: validate remote is a real https:// URL before assigning to href
  let remote = repo.remoteUrl;
  if (remote && remote.startsWith('git@github.com:')) {
    remote = 'https://github.com/' + remote.slice(15).replace(/\.git$/, '');
  }
  if (remote && /^https:\/\//.test(remote)) {
    remoteLink.href = remote;
  } else {
    remoteLink.classList.add('hidden');
  }

  card.dataset.path = repo.path;
  return fragment;
}

// ─── Repo Meta (pin/note/tags) ────────────────────────────────────────────────
async function updateRepoMeta(repo, patch) {
  const next = { path: repo.path, pinned: repo.pinned, note: repo.note, tags: repo.tags, ...patch };
  await api('/api/repos/meta', { method: 'PATCH', body: JSON.stringify(next) });
  Object.assign(repo, next);
  render();
}

// ─── Open Repo Folder ─────────────────────────────────────────────────────────
async function openRepo(repoPath) {
  await api('/api/repos/open', { method: 'POST', body: JSON.stringify({ path: repoPath }) });
}

// ─── Save Settings ────────────────────────────────────────────────────────────
async function saveSettings(event) {
  if (event) event.preventDefault();
  const roots = el.rootsInput.value.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
  const maxDepth = parseInt(el.depthInput.value, 10) || 4;
  const userName = el.userNameInput.value.trim();
  const githubPat = el.patInput.value.trim();
  const aiApiKey = el.aiKeyInput.value.trim();
  const wakatimeApiKey = el.wakaKeyInput.value.trim();
  const appPassword = el.appPasswordInput.value.trim();

  // L2: Only trigger a scan when the filesystem-affecting settings change
  const rootsChanged = JSON.stringify(roots) !== JSON.stringify(state.config?.roots || []);
  const depthChanged = maxDepth !== (state.config?.maxDepth || 4);
  const shouldRescan = rootsChanged || depthChanged;

  el.saveSettingsButton.textContent = 'Saving...';
  el.saveSettingsButton.disabled = true;

  try {
    state.config = await api('/api/config', {
      method: 'PUT',
      body: JSON.stringify({ roots, maxDepth, userName, githubPat, aiApiKey, wakatimeApiKey, appPassword })
    });
    // Update password-related UI after save
    el.appPasswordInput.value = '';
    el.appPasswordInput.placeholder = state.config.appPasswordSet
      ? 'Password set \u2014 leave blank to keep, type to change'
      : 'Leave blank for no password';
    if (appPassword) {
      // After setting a new password, the user gets a new session token on next login.
      await _refreshSession(appPassword);
      el.logoutBtn.classList.remove('hidden');
    } else if (!state.config.appPasswordSet) {
      el.logoutBtn.classList.add('hidden');
    }
    el.saveSettingsButton.textContent = 'Saved!';
    showToast('Settings saved.', 'success');
    setTimeout(() => { el.saveSettingsButton.textContent = 'Save and scan'; el.saveSettingsButton.disabled = false; }, 2000);
    if (shouldRescan) await scanRepos();
  } catch (err) {
    showToast('Failed to save settings: ' + err.message, 'error');
    el.saveSettingsButton.textContent = 'Save and scan';
    el.saveSettingsButton.disabled = false;
  }
}

/** After changing the password, get a fresh session token silently. */
async function _refreshSession(newPassword) {
  try {
    await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
  } catch { /* ignore */ }
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
async function fetchTimeline() {
  try {
    const commits = await api('/api/timeline');
    state.timeline = commits;
    el.timelineList.replaceChildren(...commits.map(c => {
      const d = document.createElement('div');
      d.className = 'timeline-item';
      d.innerHTML = `
        <div class="timeline-meta"><strong>${escapeHtml(c.repoName)}</strong> <span class="muted">${relativeTime(c.timestamp)}</span></div>
        <div class="timeline-subject" title="${escapeAttribute(c.subject)}">${escapeHtml(c.subject)}</div>
        <div class="timeline-author muted">${escapeHtml(c.author)}</div>
      `;
      return d;
    }));
    if (!commits.length) el.timelineList.replaceChildren(emptySmall('No commits in history.'));
  } catch { el.timelineList.replaceChildren(emptySmall('Could not load timeline.')); }
}

// ─── TODOs ────────────────────────────────────────────────────────────────────
async function fetchTodos() {
  try {
    const data = await api('/api/todos');
    const todos = data.results || [];
    el.todoList.replaceChildren(...todos.map(t => {
      const d = document.createElement('div');
      d.className = 'timeline-item';
      d.style.cursor = 'pointer';
      d.onclick = () => openRepo(t.path);
      d.innerHTML = `
        <div class="timeline-meta"><strong>${escapeHtml(t.repo)}</strong> <span class="muted">${escapeHtml(t.file)}:${escapeHtml(t.line)}</span></div>
        <div class="timeline-subject" style="font-family:monospace;white-space:normal" title="${escapeAttribute(t.content)}">${escapeHtml(t.content)}</div>
      `;
      return d;
    }));
    if (!todos.length) el.todoList.replaceChildren(emptySmall('No TODOs found! 🎉'));
  } catch { el.todoList.replaceChildren(emptySmall('Could not load TODOs.')); }
}

// ─── GitHub Repos ─────────────────────────────────────────────────────────────
async function fetchGithubRepos() {
  if (!state.config?.githubPat) return;
  try {
    const data = await api('/api/github/repos');
    if (!Array.isArray(data)) return;
    for (const ghRepo of data) {
      const local = state.repos.find(r => {
        if (!r.remoteUrl) return false;
        const n = s => s.toLowerCase().replace(/\.git$/, '');
        return n(r.remoteUrl) === n(ghRepo.clone_url) || n(r.remoteUrl) === n(ghRepo.ssh_url) || n(r.remoteUrl).includes(ghRepo.full_name.toLowerCase());
      });
      const ghData = { stars: ghRepo.stargazers_count || 0, issues: ghRepo.open_issues_count || 0, prs: 0, ci: null };
      if (local) {
        local.github = ghData;
      } else {
        state.repos.push({
          name: ghRepo.name, path: `Remote: ${ghRepo.full_name}`, remoteUrl: ghRepo.clone_url,
          pinned: false, health: 100, status: { dirtyCount: 0, ahead: 0, behind: 0 },
          tags: [], languages: ghRepo.language ? [{ name: ghRepo.language }] : [],
          attention: [], isRemoteOnly: true, github: ghData
        });
      }
    }
    state.repos.sort((a, b) => a.isRemoteOnly ? 1 : b.isRemoteOnly ? -1 : 0);
    render();
  } catch (e) { console.warn('GitHub fetch failed:', e); }
}

// ─── WakaTime ─────────────────────────────────────────────────────────────────
async function fetchWakatimeStats() {
  if (!state.config?.wakatimeApiKey) return;
  try {
    const data = await api('/api/wakatime');
    // L6: guard against unexpected response shape (e.g. WakaTime API error object)
    if (!Array.isArray(data?.data)) {
      console.warn('WakaTime: unexpected response', data?.error || data);
      return;
    }
    const projects = {};
    for (const day of data.data) {
      for (const p of (day.projects || [])) projects[p.name] = (projects[p.name] || 0) + p.total_seconds;
    }
    for (const repo of state.repos) {
      if (projects[repo.name]) repo.wakatime = { hours: (projects[repo.name] / 3600).toFixed(1) };
    }
    render();
  } catch (e) { console.warn('WakaTime fetch failed:', e); }
}

// ─── Global Search ────────────────────────────────────────────────────────────
let searchTimeout;
el.globalSearchInput.addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (!q) { el.searchResults.innerHTML = ''; return; }
  searchTimeout = setTimeout(async () => {
    el.searchResults.innerHTML = '<span class="muted">Searching...</span>';
    try {
      const res = await api('/api/search', { method: 'POST', body: JSON.stringify({ query: q }) });
      if (res.results?.length) {
        el.searchResults.innerHTML = res.results.map(r => `
          <div style="border-bottom:1px solid rgba(255,255,255,.1);padding:8px 0;cursor:pointer" data-open="${escapeAttribute(r.path)}">
            <div style="font-size:.8rem;color:var(--accent)">${escapeHtml(r.repo)} — ${escapeHtml(r.file)}:${escapeHtml(r.line)}</div>
            <div style="font-family:monospace;font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.content)}</div>
          </div>`).join('');
      } else {
        el.searchResults.innerHTML = '<span class="muted">No results found.</span>';
      }
    } catch { el.searchResults.innerHTML = '<span class="muted">Error searching.</span>'; }
  }, 300);
});

// ─── Event Listeners ──────────────────────────────────────────────────────────

// Scan button
el.scanButton.addEventListener('click', scanRepos);

// Save settings
el.saveSettingsButton.addEventListener('click', saveSettings);

// Inline search
el.searchInput.addEventListener('input', e => { state.query = e.target.value; render(); });

// Filter buttons
el.filterRow.addEventListener('click', e => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  state.filter = btn.dataset.filter;
  el.filterRow.querySelectorAll('.filter').forEach(f => f.classList.toggle('active', f === btn));
  render();
});

// Tab navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });
    btn.classList.add('active');
    const pane = document.getElementById(btn.dataset.target);
    pane.classList.remove('hidden');
    pane.classList.add('active');
  });
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    el.searchDialog.showModal();
    el.globalSearchInput.focus();
  } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    el.searchInput.focus();
  }
});

// M4: Scope data-open handler to known containers only (not the whole document)
el.spotlight.addEventListener('click', e => {
  const opener = e.target.closest('[data-open-spotlight]');
  if (opener) openRepo(opener.dataset.openSpotlight);
});
el.searchResults.addEventListener('click', e => {
  const opener = e.target.closest('[data-open]');
  if (opener) openRepo(opener.dataset.open);
});

// Auth dialog — prevent escape closing it
el.authDialog.addEventListener('cancel', e => e.preventDefault());

// Login form
el.authForm.addEventListener('submit', async e => {
  e.preventDefault();
  const password = el.authPasswordInput.value;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      el.authDialog.close();
      el.shell.style.display = '';
      el.authPasswordInput.value = '';
      if (await loadConfig()) await scanRepos();
    } else {
      showToast('Incorrect password', 'error');
      el.authPasswordInput.value = '';
    }
  } catch { showToast('Login error. Is the server running?', 'error'); }
});

// Logout
el.logoutBtn.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST', body: JSON.stringify({}) });
  location.reload();
});

// ─── Feedback Form ────────────────────────────────────────────────────────────
el.feedbackBtn.addEventListener('click', () => {
  el.feedbackDialog.classList.remove('hidden');
  el.feedbackText.value = '';
  el.feedbackText.focus();
});

el.feedbackForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = el.feedbackText.value.trim();
  if (!text) return;

  const submitBtn = el.feedbackForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';

  // REPLACE THESE WITH YOUR ACTUAL FORMSPREE IDs
  const FORMSPREE_ID_1 = 'mzdwjekj';
  const FORMSPREE_ID_2 = 'mpqnydqy';
  const FORMSPREE_ID_3 = 'mlgvpbqq';

  try {
    const promises = [];
    if (FORMSPREE_ID_1 && FORMSPREE_ID_1 !== 'YOUR_FORMSPREE_ID_1') {
      promises.push(fetch(`https://formspree.io/f/${FORMSPREE_ID_1}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      }));
    }
    if (FORMSPREE_ID_2 && FORMSPREE_ID_2 !== 'YOUR_FORMSPREE_ID_2') {
      promises.push(fetch(`https://formspree.io/f/${FORMSPREE_ID_2}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      }));
    }
    if (FORMSPREE_ID_3 && FORMSPREE_ID_3 !== 'YOUR_FORMSPREE_ID_3') {
      promises.push(fetch(`https://formspree.io/f/${FORMSPREE_ID_3}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      }));
    }

    if (promises.length === 0) {
      showToast('Formspree IDs are not configured in code.', 'error');
    } else {
      await Promise.all(promises);
      showToast('Suggestion sent successfully!', 'success');
      el.feedbackDialog.classList.add('hidden');
    }
  } catch (err) {
    showToast('Failed to send suggestion.', 'error');
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Send Suggestion';
});

// ─── Dialog Pickers ───────────────────────────────────────────────────────────
async function handleFolderBrowse(textareaElement) {
  try {
    const res = await api('/api/dialog/folder', { method: 'POST', body: JSON.stringify({}) });
    if (res.path) {
      const current = textareaElement.value;
      textareaElement.value = current ? current.replace(/[\r\n]+$/, '') + '\n' + res.path : res.path;
      showToast('Folder added', 'success');
    }
  } catch (e) {
    if (e.message !== 'Canceled') showToast('Browse failed: ' + e.message, 'error');
  }
}

el.settingsBrowseBtn.addEventListener('click', () => handleFolderBrowse(el.rootsInput));


// ── Onboarding Wizard ────────────────────────────────────────────────────────

/** All transient wizard state — discarded after completeWizard() is called. */
const wizard = {
  step: 1,
  password: '',   // non-empty only if user set one (and it matched confirmation)
  roots: [],      // [{ path }]
  githubToken: '', // only set if wizard.githubUser !== null
  githubUser: null, // { login, name } — set by successful verification
  aiKey: '',
  wakaKey: '',
};

/** Update progress dots and step label. */
function goToStep(n, back = false) {
  el.wizardSteps.forEach(s => {
    s.classList.remove('active', 'slide-back');
  });
  el.wizardDots.forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === n);
    dot.classList.toggle('done', i + 1 < n);
  });
  const target = document.querySelector(`#wizardStep${n}`);
  if (target) {
    if (back) target.classList.add('slide-back');
    target.classList.add('active');
  }
  el.wizardStepLabel.textContent = `Step ${n} of 4`;
  wizard.step = n;
}

/** Render the folder chip list for step 2. */
function renderWizFolders() {
  el.wizFolderList.replaceChildren(
    ...wizard.roots.map(({ path }) => {
      const chip = document.createElement('div');
      chip.className = 'wizard-folder-chip';
      chip.innerHTML = `
        <span style="font-size:1.1rem">📁</span>
        <span class="folder-path" title="${escapeAttribute(path)}">${escapeHtml(path)}</span>
        <span class="folder-count">(added)</span>
        <button class="wizard-folder-remove" type="button" aria-label="Remove folder">✕</button>
      `;
      chip.querySelector('.wizard-folder-remove').addEventListener('click', () => {
        wizard.roots = wizard.roots.filter(r => r.path !== path);
        renderWizFolders();
      });
      return chip;
    })
  );
}

/** Show the wizard and optionally pre-populate root suggestions. */
async function showWizard() {
  el.wizard.classList.add('active');
  el.shell.style.display = 'none';
  // Pre-populate suggestions as auto-added folders on step 2
  try {
    const res = await api('/api/suggest-roots');
    if (res.suggestions?.length) {
      wizard.roots = res.suggestions.map(p => ({ path: p }));
      renderWizFolders();
    }
  } catch { /* no suggestions — fine */ }
}

/** Single exit point — called by Finish and all Skip paths. */
async function completeWizard() {
  // Disable all finish/skip buttons to prevent double-submit
  [el.wizFinishBtn, el.wizSkipAllBtn].forEach(b => { if (b) b.disabled = true; });

  const roots = wizard.roots.map(r => r.path);
  const userName = el.wizName?.value.trim() || '';
  // Only save a GitHub token if it was successfully verified
  const githubPat = wizard.githubUser ? wizard.githubToken : '';
  const aiApiKey = wizard.aiKey;
  // Capture ping opt-in from wizard checkbox
  const pingOptIn = document.getElementById('wizPingOptIn')?.checked === true;
  if (pingOptIn !== (state.config?.pingOptIn === true)) {
    api('/api/ping-optin', { method: 'POST', body: JSON.stringify({ optIn: pingOptIn }) }).catch(() => {});
  }
  const wakatimeApiKey = wizard.wakaKey;
  const appPassword = wizard.password;

  const payload = {
    ...state.config,
    roots,
    ...(userName ? { userName } : {}),
    ...(githubPat ? { githubPat } : {}),
    ...(aiApiKey ? { aiApiKey } : {}),
    ...(wakatimeApiKey ? { wakatimeApiKey } : {}),
    ...(appPassword ? { appPassword } : {}),
    onboardingComplete: true,  // must-fix: prevents infinite loop on skip
  };

  try {
    state.config = await api('/api/config', { method: 'PUT', body: JSON.stringify(payload) });
    // Sync settings panel fields
    el.userNameInput.value = state.config.userName || '';
    el.rootsInput.value = (state.config.roots || []).join('\n');
    el.patInput.value = state.config.githubPat || '';
    el.aiKeyInput.value = state.config.aiApiKey || '';
    el.wakaKeyInput.value = state.config.wakatimeApiKey || '';
    if (appPassword) {
      await _refreshSession(appPassword);
      el.logoutBtn.classList.remove('hidden');
    }
    // Enter the dashboard
    el.wizard.classList.remove('active');
    el.shell.style.display = '';
    await scanRepos();
  } catch (err) {
    showToast('Setup failed: ' + err.message, 'error');
    [el.wizFinishBtn, el.wizSkipAllBtn].forEach(b => { if (b) b.disabled = false; });
  }
}

// ── Wizard event listeners ────────────────────────────────────────────────────

// Step 1 — password validation
el.wizPw?.addEventListener('input', validatePwFields);
el.wizPwConfirm?.addEventListener('input', validatePwFields);
el.wizSkipPwCheck?.addEventListener('change', validatePwFields);

function validatePwFields() {
  const pw = el.wizPw.value;
  const confirm = el.wizPwConfirm.value;
  const skipping = el.wizSkipPwCheck.checked;
  el.wizPwError.textContent = '';
  if (skipping) {
    el.wizPw.value = '';
    el.wizPwConfirm.value = '';
    el.wizStep1Next.disabled = false;
    return;
  }
  if (pw && confirm && pw !== confirm) {
    el.wizPwError.textContent = 'Passwords do not match.';
    el.wizStep1Next.disabled = true;
    return;
  }
  el.wizStep1Next.disabled = false;
}

el.wizStep1Next?.addEventListener('click', () => {
  const pw = el.wizPw.value;
  const confirm = el.wizPwConfirm.value;
  const skipping = el.wizSkipPwCheck.checked;

  if (!skipping && pw && pw !== confirm) {
    el.wizPwError.textContent = 'Passwords do not match.';
    return;
  }
  if (!skipping && pw && !confirm) {
    el.wizPwError.textContent = 'Please confirm your password.';
    return;
  }

  wizard.password = (!skipping && pw === confirm) ? pw : '';
  goToStep(2);
});

// Step 2 — folder management
el.wizStep2Back?.addEventListener('click', () => goToStep(1, true));

el.wizAddFolderBtn?.addEventListener('click', async () => {
  try {
    const res = await api('/api/dialog/folder', { method: 'POST', body: JSON.stringify({}) });
    if (res.path && !wizard.roots.find(r => r.path === res.path)) {
      wizard.roots.push({ path: res.path });
      renderWizFolders();
    }
  } catch (e) {
    if (e.message !== 'Canceled') showToast('Browse failed: ' + e.message, 'error');
  }
});

el.wizStep2Next?.addEventListener('click', () => goToStep(3));
el.wizStep2Skip?.addEventListener('click', () => goToStep(3));

// Step 3 — GitHub token verification
el.wizStep3Back?.addEventListener('click', () => goToStep(2, true));

el.wizVerifyBtn?.addEventListener('click', async () => {
  const token = el.wizGhToken.value.trim();
  if (!token) {
    el.wizTokenStatus.className = 'wizard-token-status error';
    el.wizTokenStatus.textContent = 'Please paste a token first.';
    return;
  }
  el.wizVerifyBtn.disabled = true;
  el.wizVerifyBtn.textContent = 'Verifying...';
  el.wizTokenStatus.className = 'wizard-token-status';
  el.wizTokenStatus.textContent = '';

  try {
    const res = await api('/api/verify-github-token', { method: 'POST', body: JSON.stringify({ token }) });
    if (res.ok) {
      wizard.githubToken = token;
      wizard.githubUser = { login: res.login, name: res.name };
      el.wizTokenStatus.className = 'wizard-token-status success';
      el.wizTokenStatus.textContent = `✅ Token verified — connected as @${res.login}`;
    } else {
      wizard.githubToken = '';
      wizard.githubUser = null;
      el.wizTokenStatus.className = 'wizard-token-status error';
      el.wizTokenStatus.textContent = `❌ ${res.error || 'Token verification failed'}`;
    }
  } catch (err) {
    wizard.githubToken = '';
    wizard.githubUser = null;
    el.wizTokenStatus.className = 'wizard-token-status error';
    el.wizTokenStatus.textContent = `❌ ${err.message}`;
  } finally {
    el.wizVerifyBtn.disabled = false;
    el.wizVerifyBtn.textContent = 'Verify';
  }
});

el.wizStep3Next?.addEventListener('click', () => {
  const currentInput = el.wizGhToken.value.trim();
  if (currentInput !== wizard.githubToken) {
    wizard.githubToken = '';
    wizard.githubUser = null;
  }
  goToStep(4);
});
el.wizStep3Skip?.addEventListener('click', () => {
  wizard.githubToken = '';
  wizard.githubUser = null;
  goToStep(4);
});

// Step 4 — power-up keys
el.wizStep4Back?.addEventListener('click', () => goToStep(3, true));

el.wizFinishBtn?.addEventListener('click', () => {
  wizard.aiKey = el.wizAiKey?.value.trim() || '';
  wizard.wakaKey = el.wizWakaKey?.value.trim() || '';
  completeWizard();
});

el.wizSkipAllBtn?.addEventListener('click', () => {
  wizard.aiKey = '';
  wizard.wakaKey = '';
  completeWizard();
});

// AI Standup
el.standupButton.addEventListener('click', async () => {
  el.standupDialog.showModal();
  el.standupContent.textContent = 'Generating your AI Standup...';
  try {
    const res = await api('/api/standup', { method: 'POST', body: JSON.stringify({ commits: state.timeline }) });
    el.standupContent.textContent = res.report;
  } catch (err) { el.standupContent.textContent = `Error: ${err.message}`; }
});

// Theme toggle
document.getElementById('themeToggleBtn').addEventListener('click', () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    || (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: light)').matches);
  const next = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('repo_theme', next);
});

// ─── AI Code Reviewer ─────────────────────────────────────────────────────────
function wireAiReviewButton(btn, repo) {
  btn.classList.remove('hidden');
  btn.addEventListener('click', async () => {
    const dialog = document.getElementById('aiReviewDialog');
    const content = document.getElementById('aiReviewContent');
    content.textContent = '🤖 Analyzing your changes with Gemini...';
    dialog.showModal();
    btn.disabled = true;
    try {
      const res = await api('/api/repos/ai-review', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
      content.textContent = res.review;
    } catch (err) {
      content.textContent = `❌ Review failed: ${err.message}`;
    } finally { btn.disabled = false; }
  });
}

// ─── Branch Manager ───────────────────────────────────────────────────────────
let _branchManagerRepo = null;
function wireBranchButton(btn, repo) {
  btn.classList.remove('hidden');
  btn.addEventListener('click', () => openBranchManager(repo));
}
async function openBranchManager(repo) {
  _branchManagerRepo = repo;
  document.getElementById('branchManagerRepoName').textContent = repo.name;
  document.getElementById('branchManagerDialog').showModal();
  await refreshBranchList(repo.path);
}
async function refreshBranchList(repoPath) {
  const list = document.getElementById('branchList');
  list.innerHTML = '<span class="muted">Loading branches...</span>';
  try {
    const res = await api(`/api/repos/branches?path=${encodeURIComponent(repoPath)}`);
    list.replaceChildren(...res.branches.map(b => {
      const d = document.createElement('div');
      d.className = 'attention-item';
      d.style.cssText = 'padding:10px 12px;align-items:center;gap:8px;';
      d.innerHTML = `
        <span style="flex:1;font-weight:${b.isCurrent?'700':'400'};color:${b.isCurrent?'var(--accent)':'var(--text)'};font-family:monospace;">
          ${b.isCurrent ? '● ' : ''}${escapeHtml(b.name)}${b.isRemote?` <span style="color:var(--muted);font-size:0.78rem;">[remote]</span>`:''}
        </span>
        <span class="muted" style="font-size:0.8rem;">${escapeHtml(b.date||'')}</span>
        ${!b.isRemote&&!b.isCurrent?`
          <button class="ghost" style="font-size:0.78rem;padding:3px 8px;" data-action="checkout" data-branch="${escapeAttribute(b.name)}">Checkout</button>
          <button class="ghost" style="font-size:0.78rem;padding:3px 8px;color:var(--warn);" data-action="merge" data-branch="${escapeAttribute(b.name)}">Merge</button>
          <button class="ghost" style="font-size:0.78rem;padding:3px 8px;color:var(--danger);" data-action="delete" data-branch="${escapeAttribute(b.name)}">Delete</button>
        `:''}
      `;
      d.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const origText = btn.textContent;
          btn.disabled = true; btn.textContent = '...';
          try {
            await api('/api/repos/branch', { method: 'POST', body: JSON.stringify({ path: repoPath, action: btn.dataset.action, branch: btn.dataset.branch }) });
            showToast(`✅ ${btn.dataset.action} → ${btn.dataset.branch}`, 'success');
            await refreshBranchList(repoPath);
            if (btn.dataset.action !== 'delete') scanRepos();
          } catch (err) { showToast(`Failed: ${err.message}`, 'error'); btn.disabled = false; btn.textContent = origText; }
        });
      });
      return d;
    }));
    if (!res.branches.length) list.innerHTML = '<span class="muted">No branches found.</span>';
  } catch (err) { list.innerHTML = `<span class="muted">Error: ${escapeHtml(err.message)}</span>`; }
}
document.getElementById('createBranchBtn')?.addEventListener('click', async () => {
  if (!_branchManagerRepo) return;
  const name = document.getElementById('newBranchInput')?.value.trim();
  const from = document.getElementById('newBranchFrom')?.value.trim();
  if (!name) { showToast('Enter a branch name', 'warn'); return; }
  try {
    await api('/api/repos/branch', { method: 'POST', body: JSON.stringify({ path: _branchManagerRepo.path, action: 'create', branch: name, from: from||undefined }) });
    showToast(`✅ Created branch: ${name}`, 'success');
    document.getElementById('newBranchInput').value = '';
    document.getElementById('newBranchFrom').value = '';
    await refreshBranchList(_branchManagerRepo.path);
  } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
});

// ─── Pomodoro Timer ───────────────────────────────────────────────────────────
const POMO_PHASES = [
  {label:'FOCUS',dur:25*60,color:'var(--accent)'},{label:'SHORT BREAK',dur:5*60,color:'var(--success)'},
  {label:'FOCUS',dur:25*60,color:'var(--accent)'},{label:'SHORT BREAK',dur:5*60,color:'var(--success)'},
  {label:'FOCUS',dur:25*60,color:'var(--accent)'},{label:'SHORT BREAK',dur:5*60,color:'var(--success)'},
  {label:'FOCUS',dur:25*60,color:'var(--accent)'},{label:'LONG BREAK',dur:15*60,color:'var(--info)'},
];
let _pomoPhase=0,_pomoSecs=POMO_PHASES[0].dur,_pomoRunning=false,_pomoInterval=null;
function updatePomodoroUI(){
  const p=POMO_PHASES[_pomoPhase];
  const m=String(Math.floor(_pomoSecs/60)).padStart(2,'0'),s=String(_pomoSecs%60).padStart(2,'0');
  const timeEl=document.getElementById('pomodoroTime'),phaseEl=document.getElementById('pomodoroPhase'),cycleEl=document.getElementById('pomodoroCycle'),startEl=document.getElementById('pomodoroStartBtn');
  if(timeEl)timeEl.textContent=`${m}:${s}`;
  if(phaseEl){phaseEl.textContent=p.label;phaseEl.style.color=p.color;}
  if(cycleEl)cycleEl.textContent=`Session ${Math.min(Math.floor(_pomoPhase/2)+1,4)} of 4`;
  if(startEl)startEl.textContent=_pomoRunning?'⏸ Pause':'▶ Start';
  document.title=_pomoRunning?`${m}:${s} — ${p.label} | RepoTracker`:'RepoTracker — Git Mission Control';
  [1,2,3,4].forEach(i=>{const d=document.getElementById(`pomoDot${i}`);if(d)d.style.background=i*2-2<_pomoPhase?'var(--accent)':'var(--border)';});
}
document.getElementById('pomodoroStartBtn')?.addEventListener('click',()=>{
  if(_pomoRunning){clearInterval(_pomoInterval);_pomoRunning=false;}else{
    _pomoRunning=true;
    _pomoInterval=setInterval(()=>{
      _pomoSecs--;
      if(_pomoSecs<=0){
        clearInterval(_pomoInterval);_pomoRunning=false;
        const f=POMO_PHASES[_pomoPhase];
        if(Notification.permission==='granted')new Notification(`RepoTracker — ${f.label} complete!`,{body:_pomoPhase%2===0?'Time for a break 🎉':'Back to work! 💪',icon:'/logo.svg'});
        _pomoPhase=(_pomoPhase+1)%POMO_PHASES.length;
        _pomoSecs=POMO_PHASES[_pomoPhase].dur;
      }
      updatePomodoroUI();
    },1000);
  }
  updatePomodoroUI();
});
document.getElementById('pomodoroResetBtn')?.addEventListener('click',()=>{
  clearInterval(_pomoInterval);_pomoRunning=false;_pomoPhase=0;_pomoSecs=POMO_PHASES[0].dur;
  document.title='RepoTracker — Git Mission Control';updatePomodoroUI();
});
document.getElementById('pomodoroDialog')?.addEventListener('close',()=>{
  // Always clear the interval and reset title on dialog close (even if running — user dismissed it)
  clearInterval(_pomoInterval);
  _pomoRunning=false;
  document.title='RepoTracker — Git Mission Control';
  updatePomodoroUI();
});
document.getElementById('pomodoroBtn')?.addEventListener('click',()=>{
  if(Notification.permission==='default')Notification.requestPermission();
  document.getElementById('pomodoroDialog').showModal();updatePomodoroUI();
});

// ─── Gist Config Sync ─────────────────────────────────────────────────────────
document.getElementById('gistSyncBtn')?.addEventListener('click',async()=>{
  const btn=document.getElementById('gistSyncBtn'),status=document.getElementById('gistSyncStatus');
  btn.disabled=true;btn.textContent='Syncing...';
  try{
    const res=await api('/api/config/sync-to-gist',{method:'POST',body:JSON.stringify({})});
    status.textContent=`✅ Synced at ${new Date(res.syncedAt).toLocaleTimeString()}`;
    const g=document.getElementById('gistIdInput');if(g)g.value=res.gistId;
    showToast('Config synced to GitHub Gist! ☁️','success');
  }catch(err){showToast('Gist sync failed: '+err.message,'error');}
  finally{btn.disabled=false;btn.textContent='☁️ Sync to Gist';}
});
document.getElementById('gistRestoreBtn')?.addEventListener('click',async()=>{
  const gistId=document.getElementById('gistIdInput')?.value.trim();
  if(!gistId){showToast('Enter a Gist ID first','warn');return;}
  const btn=document.getElementById('gistRestoreBtn');btn.disabled=true;btn.textContent='Restoring...';
  try{
    const res=await api('/api/config/restore-from-gist',{method:'POST',body:JSON.stringify({gistId})});
    showToast(`✅ Config restored — ${res.restored.roots.length} roots`,'success');
    await loadConfig();await scanRepos();
  }catch(err){showToast('Restore failed: '+err.message,'error');}
  finally{btn.disabled=false;btn.textContent='⬇️ Restore from Gist';}
});

// ─── Activity / Team Tab ──────────────────────────────────────────────────────
const EVENT_LABELS={'repo_scan':'🔍 Repo Scan','ai_sync':'🤖 AI Sync','ai_review':'🔍 AI Review','terminal_open':'💻 Terminal','search':'🔎 Search','standup':'📋 Standup','clone':'📥 Clone','branch_op':'🌿 Branch Op','gist_sync':'☁️ Gist Sync','gist_restore':'⬇️ Gist Restore'};
async function loadTeamTab(){
  try{
    const res=await api('/api/activity');
    const stats=res.weeklyStats||{},activity=res.activity||[];
    const statCards=[{label:'AI Syncs',key:'ai_sync',icon:'🤖'},{label:'AI Reviews',key:'ai_review',icon:'🔍'},{label:'Searches',key:'search',icon:'🔎'},{label:'Terminal Sessions',key:'terminal_open',icon:'💻'},{label:'Scans',key:'repo_scan',icon:'📡'},{label:'Branch Ops',key:'branch_op',icon:'🌿'}];
    const statsEl=document.getElementById('activityStats');
    if(statsEl)statsEl.replaceChildren(...statCards.map(c=>{const el=document.createElement('article');el.className='metric';el.innerHTML=`<span>${c.icon} ${c.label}</span><strong>${stats[c.key]||0}</strong>`;return el;}));
    const logEl=document.getElementById('activityLog');
    if(logEl){
      if(!activity.length){logEl.innerHTML='<span class="muted">No activity recorded yet.</span>';}else{
        logEl.replaceChildren(...activity.map(entry=>{
          const d=document.createElement('div');d.className='timeline-item';
          d.innerHTML=`<div class="timeline-meta"><strong>${escapeHtml(EVENT_LABELS[entry.event]||entry.event)}</strong> <span class="muted">${relativeTime(entry.ts||0)}</span></div>${entry.repoName?`<div class="muted" style="font-size:0.82rem;">${escapeHtml(entry.repoName)}</div>`:''}`;return d;
        }));
      }
    }
  }catch(err){console.warn('Activity fetch failed:',err);}
}
document.querySelectorAll('.tab-btn[data-target="tab-team"]').forEach(b=>b.addEventListener('click',loadTeamTab));

// ─── Ecosystem Tab ────────────────────────────────────────────────────────────
function populateEcosystemTab(){
  if(!state.repos||!state.repos.length)return;
  const repos=state.repos.filter(r=>!r.isCloud);
  const frameworkMap=new Map();
  for(const repo of repos)for(const lang of(repo.languages||[]))frameworkMap.set(lang.name,(frameworkMap.get(lang.name)||0)+1);
  const frameworkEl=document.getElementById('frameworkList');
  if(frameworkEl){
    const sorted=[...frameworkMap.entries()].sort((a,b)=>b[1]-a[1]);
    frameworkEl.replaceChildren(...sorted.map(([name,count])=>{
      const p=document.createElement('div');
      p.style.cssText='display:inline-flex;align-items:center;gap:6px;background:color-mix(in srgb,var(--accent) 12%,var(--bg-card));border:1px solid color-mix(in srgb,var(--accent) 25%,transparent);border-radius:99px;padding:6px 14px;font-size:0.85rem;font-weight:600;';
      p.innerHTML=`<span>${escapeHtml(name)}</span><span style="color:var(--accent);">${count}</span>`;return p;
    }));
    if(!sorted.length)frameworkEl.innerHTML='<span class="muted">Scan repos to see framework usage.</span>';
  }
  const withPkg=repos.filter(r=>r.scripts!==null).length,highRisk=repos.filter(r=>r.health<60).length;
  const metricsEl=document.getElementById('ecosystemMetrics');
  if(metricsEl){
    const items=[['Node.js Repos',withPkg],['High Risk Repos',highRisk],['Total Tracked',repos.length],['Languages Detected',frameworkMap.size]];
    metricsEl.replaceChildren(...items.map(([label,value])=>{const c=document.createElement('article');c.className='metric';c.innerHTML=`<span>${label}</span><strong>${value}</strong>`;return c;}));
  }
}
document.querySelectorAll('.tab-btn[data-target="tab-ecosystem"]').forEach(b=>b.addEventListener('click',populateEcosystemTab));

// ─── Star Nudge Banner ────────────────────────────────────────────────────────
function maybeShowStarNudge(){
  if(localStorage.getItem('rt_star_dismissed'))return;
  const count=parseInt(localStorage.getItem('rt_scan_count')||'0',10)+1;
  localStorage.setItem('rt_scan_count',String(count));
  if(count===3)setTimeout(()=>document.getElementById('starNudgeBanner')?.classList.remove('hidden'),2000);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  const savedTheme = localStorage.getItem('repo_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  el.scanMeta.textContent = 'Connecting to server...';
  const ok = await loadConfig();
  if (!ok) return;
  // Pre-populate Gist ID field if already synced
  if (state.config?.gistSyncId) {
    const g = document.getElementById('gistIdInput'); if (g) g.value = state.config.gistSyncId;
    const gs = document.getElementById('gistSyncStatus');
    if (gs && state.config.lastGistSync) gs.textContent = `Last synced: ${new Date(state.config.lastGistSync).toLocaleString()}`;
  }
  if (!state.config.onboardingComplete) {
    await showWizard();
  } else {
    el.scanMeta.textContent = 'Ready. Click Scan repos to refresh.';
    el.wizard.classList.remove('active');
    el.shell.style.display = '';
    await scanRepos();
    maybeShowStarNudge();
  }
})();

// Close custom dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.quick-actions-dropdown')) {
    document.querySelectorAll('.quick-actions-dropdown[open]').forEach(d => d.removeAttribute('open'));
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// INVESTOR-READY FEATURES — Sprint 1-4
// ══════════════════════════════════════════════════════════════════════════════

// ── Sprint 1: Pro License ──────────────────────────────────────────────────────
function updateLicenseUI() {
  // Use licenseTier from config (set by server during activation) — no key-format guessing needed
  const hasKey  = Boolean(state.config?.licenseKeySet);
  const tier    = state.config?.licenseTier || state.tier || 'core';
  const isTeam  = tier === 'team';
  const tierLabel = document.getElementById('licenseTierLabel');
  const activeRow = document.getElementById('licenseActiveRow');
  const input     = document.getElementById('licenseKeyInput');
  if (activeRow)  activeRow.classList.toggle('hidden', !hasKey);
  if (tierLabel)  tierLabel.textContent = isTeam ? 'Team' : 'Pro';
  if (input && !hasKey) input.value = '';
  // Also update state.tier for feature gates
  if (hasKey) state.tier = tier;
}

document.getElementById('activateLicenseBtn')?.addEventListener('click', async () => {
  const input = document.getElementById('licenseKeyInput');
  const key = input?.value?.trim();
  if (!key) { showToast('Enter a license key first', 'error'); return; }
  const btn = document.getElementById('activateLicenseBtn');
  btn.textContent = 'Activating…'; btn.disabled = true;
  try {
    const res = await api('/api/license', { method: 'POST', body: JSON.stringify({ key }) });
    // Update state with tier returned from server (set by LemonSqueezy API)
    state.tier = res.tier || 'pro';
    state.config = {
      ...state.config,
      licenseKeySet: true,
      licenseKey: '••• (saved)',
      licenseTier: res.tier || 'pro',
      licenseInstanceId: res.instanceId || null,
    };
    updateLicenseUI();
    showToast(`✅ ${res.tier === 'team' ? 'Team' : 'Pro'} license activated on this machine!`, 'success');
  } catch (err) { showToast(`❌ ${err.message}`, 'error'); }
  finally { btn.textContent = 'Activate'; btn.disabled = false; }
});

document.getElementById('revokeLicenseBtn')?.addEventListener('click', async () => {
  if (!confirm('Remove license key from this machine?\n\nYour activation slot will be freed so you can activate on another machine.')) return;
  const btn = document.getElementById('revokeLicenseBtn');
  btn.textContent = 'Deactivating…'; btn.disabled = true;
  try {
    await api('/api/license', { method: 'DELETE' });
    state.tier = 'free';
    state.config = { ...state.config, licenseKeySet: false, licenseKey: '', licenseTier: 'core', licenseInstanceId: null };
    updateLicenseUI();
    showToast('License deactivated. Activation slot freed — you can now activate on another machine.', 'info');
  } catch (err) { showToast(`❌ ${err.message}`, 'error'); }
  finally { btn.textContent = 'Remove License'; btn.disabled = false; }
});

// ── Sprint 2: Team Status + Banner ─────────────────────────────────────────────
async function checkTeamStatus() {
  try {
    const status = await api('/api/team/status');
    const banner = document.getElementById('teamModeBanner');
    const urlEl = document.getElementById('teamModeUrl');
    const copyBtn = document.getElementById('copyTeamUrlBtn');

    if (status.teamMode && status.teamUrl) {
      if (banner) { banner.classList.remove('hidden'); }
      if (urlEl) urlEl.textContent = status.teamUrl;
      copyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(status.teamUrl).then(() => showToast('Team URL copied!', 'success'));
      }, { once: true });
    }

    // Refresh team tokens list in settings
    renderTeamTokens(status);
  } catch { /* silent — server might be in solo mode */ }
}

async function generateTeamToken() {
  const label = prompt('Label for this token (e.g. teammate\'s name):');
  if (!label) return;
  try {
    const res = await api('/api/team/token', { method: 'POST', body: JSON.stringify({ label }) });
    showToast(`✅ Token generated for ${res.token.label}`, 'success');
    // Show token in a prompt so user can copy it
    const tokenStr = `${res.token.token}`;
    const msg = `Share this token with ${res.token.label}:\n\n${tokenStr}\n\n(Copy it now — it won't be shown again)`;
    alert(msg);
    await checkTeamStatus();
  } catch (err) { showToast(`❌ ${err.message}`, 'error'); }
}

function renderTeamTokens(status) {
  const list = document.getElementById('teamTokensList');
  const empty = document.getElementById('teamTokensEmpty');
  if (!list) return;
  list.innerHTML = '';
  // We can only show count/label, not the raw token (stored server-side)
  if (!status?.tokenCount) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  // Token details come from /api/config teamTokens field — show labels
  const tokens = state.config?.teamTokens || [];
  tokens.forEach((t, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1e293b;';
    row.innerHTML = `<span>${escapeHtml(t.label)} <span class="muted" style="font-size:0.75rem;">${relativeTime(Math.floor(new Date(t.createdAt||0).getTime()/1000))}</span></span>
      <button class="ghost" style="padding:2px 8px;font-size:0.75rem;color:var(--danger);" data-token="${escapeAttribute(t.token)}">Revoke</button>`;
    row.querySelector('button')?.addEventListener('click', async (e) => {
      await api('/api/team/token', { method: 'DELETE', body: JSON.stringify({ token: e.target.dataset.token }) });
      // Update local state
      state.config.teamTokens = state.config.teamTokens?.filter(tok => tok.token !== e.target.dataset.token);
      renderTeamTokens({ tokenCount: state.config.teamTokens?.length });
      showToast('Token revoked.', 'info');
    });
    list.appendChild(row);
  });
}

document.getElementById('generateTeamTokenBtn')?.addEventListener('click', generateTeamToken);

// ── Sprint 3: Export Dashboard ──────────────────────────────────────────────────
document.getElementById('exportDashboardBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('exportDashboardBtn');
  btn.textContent = '⏳ Exporting...'; btn.disabled = true;
  try {
    const res = await fetch('/export', { credentials: 'include' });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repotracker-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Dashboard exported!', 'success');
  } catch (err) { showToast(`Export failed: ${err.message}`, 'error'); }
  finally { btn.textContent = '📤 Export'; btn.disabled = false; }
});

// ── Sprint 4: Ping Opt-In (wired from wizard) ──────────────────────────────────
// The ping checkbox is in wizard step 1 — we save the preference when wizard completes.
// The actual ping happens server-side on boot. We just need to record the opt-in.
const _wizPingCheck = document.getElementById('wizPingOptIn');
if (_wizPingCheck) {
  // Pre-check if already opted in (page reload after wizard)
  _wizPingCheck.checked = state.config?.pingOptIn === true;
}

// ── Boot: check team status on load ───────────────────────────────────────────
checkTeamStatus();
updateLicenseUI();

// ── UPGRADE MODAL WIRING ──────────────────────────────────────────────────────
const FEATURE_META = {
  ai_review:  { name: 'AI Code Reviewer',   desc: 'Analyze diffs for bugs & security issues before committing.',  tier: 'Pro',  price: '$29' },
  ai_sync:    { name: 'AI Git Sync',         desc: 'Generate perfect commit messages with Gemini AI.',              tier: 'Pro',  price: '$29' },
  gist_sync:  { name: 'Cloud Config Sync',   desc: 'Sync your settings to a private GitHub Gist across machines.', tier: 'Pro',  price: '$29' },
  badges:     { name: 'Health Badges',        desc: 'Embed live repo health badges in any README.',                  tier: 'Pro',  price: '$29' },
  export:     { name: 'Dashboard Export',     desc: 'Download a self-contained HTML snapshot of your dashboard.',   tier: 'Pro',  price: '$29' },
  pomodoro:   { name: 'Pomodoro Timer',       desc: 'Deep-work focus sessions with desktop notifications.',          tier: 'Pro',  price: '$29' },
  team_mode:  { name: 'Team Mode',            desc: 'Share your dashboard with teammates over your local network.',  tier: 'Team', price: '$79' },
  lan_dashboard: { name: 'LAN Dashboard',     desc: 'Broadcast your dashboard to up to 5 teammates on LAN.',       tier: 'Team', price: '$79' },
  team_standup:  { name: 'Team Standup',      desc: 'AI-generated standup visible to your whole team.',              tier: 'Team', price: '$79' },
};

function showUpgradeModal(feature, upgradeUrl) {
  const modal = document.getElementById('upgradeModal');
  if (!modal) return;

  const meta = FEATURE_META[feature] || { name: 'This feature', desc: 'Unlock powerful developer tools.', tier: 'Pro', price: '$29' };
  const isTeam = meta.tier === 'Team';
  const buyUrl = upgradeUrl || (isTeam ? 'https://repotracker.lemonsqueezy.com/buy/team' : 'https://repotracker.lemonsqueezy.com/buy/pro');

  // Update modal header dynamically
  const titleEl = document.getElementById('upgradeModalTitle');
  const descEl  = document.getElementById('upgradeModalDesc');
  const priceEl = document.getElementById('upgradeModalPrice');
  const tierEl  = document.getElementById('upgradeModalTier');
  const buyBtn  = document.getElementById('upgradeModalBtn');
  const iconEl  = document.getElementById('upgradeModalIcon');

  if (titleEl) titleEl.textContent = `Upgrade to ${meta.tier}`;
  if (descEl)  descEl.textContent  = `${meta.name} — ${meta.desc}`;
  if (priceEl) priceEl.textContent = `${meta.price} one-time`;
  if (tierEl)  tierEl.textContent  = meta.tier;
  if (buyBtn)  buyBtn.href         = buyUrl;
  if (iconEl)  iconEl.textContent  = isTeam ? '👥' : '✨';

  // Highlight the relevant feature row
  document.querySelectorAll('.upgrade-feature-row').forEach(row => {
    row.style.background = row.dataset.feature === feature
      ? 'color-mix(in srgb,var(--accent) 14%,transparent)'
      : 'color-mix(in srgb,var(--accent) 6%,transparent)';
    row.style.borderColor = row.dataset.feature === feature
      ? 'color-mix(in srgb,var(--accent) 40%,transparent)'
      : 'color-mix(in srgb,var(--accent) 15%,transparent)';
  });

  modal.showModal();
}

document.getElementById('upgradeModalClose')?.addEventListener('click', () => {
  document.getElementById('upgradeModal')?.close();
});

// Global handler: intercept any unhandled requiresUpgrade errors
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.requiresUpgrade) {
    e.preventDefault();
    showUpgradeModal(e.reason.feature, e.reason.upgradeUrl);
  }
});

// Export showUpgradeModal globally so any catch block can call it
window.showUpgradeModal = showUpgradeModal;

// ══════════════════════════════════════════════════════════════════════════════
// FIX #5 — UX: Keyboard shortcuts, team self-test, better error handling
// ══════════════════════════════════════════════════════════════════════════════

// ── Keyboard Shortcuts ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // ? = show shortcuts help
  if (e.key === '?' && !e.target.matches('input,textarea,select')) {
    showToast(
      '⌨️  Shortcuts: S=Scan · F=Filter · T=Terminal · B=Branch · ?=Help',
      'info', 5000
    );
    return;
  }
  if (e.target.matches('input,textarea,select,dialog *')) return;
  // S = scan repos
  if (e.key === 's' || e.key === 'S') { scanRepos(); return; }
  // F = focus filter
  if (e.key === 'f' || e.key === 'F') {
    const f = document.getElementById('filterInput') || document.querySelector('input[type="search"]');
    f?.focus(); return;
  }
  // Escape = close any open dialog
  if (e.key === 'Escape') {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
  }
});

// ── Team Mode Self-Test ─────────────────────────────────────────────────────────
// When Team Mode banner is shown, do a quick connectivity test and update indicator
async function runTeamSelfTest(teamUrl) {
  const banner = document.getElementById('teamModeBanner');
  if (!banner) return;
  try {
    const res = await fetch(`${teamUrl}/api/team/ping`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        banner.style.background = 'linear-gradient(90deg,#065f46,#047857)';
        showToast('✅ Team Mode active — teammates can connect!', 'success');
      }
    }
  } catch {
    banner.style.background = 'linear-gradient(90deg,#7f1d1d,#991b1b)';
    showToast('⚠️ Team URL unreachable — check your firewall or LAN settings', 'error', 6000);
  }
}

// Augment checkTeamStatus to also run self-test
const _origCheckTeamStatus = checkTeamStatus;
// eslint-disable-next-line no-global-assign
window._teamSelfTestRan = false;
const _wrappedCheckTeam = async () => {
  try {
    const status = await api('/api/team/status');
    if (status.teamMode && status.teamUrl && !window._teamSelfTestRan) {
      window._teamSelfTestRan = true;
      setTimeout(() => runTeamSelfTest(status.teamUrl), 1500);
    }
  } catch {}
};
_wrappedCheckTeam();

// ── Better error handler for Pro gate catches ──────────────────────────────────
// Any catch block that does showToast(err.message) should also check for upgrade
function handleApiError(err, defaultMsg) {
  if (err.requiresUpgrade) {
    showUpgradeModal(err.feature, err.upgradeUrl);
    return;
  }
  showToast(err.message || defaultMsg, 'error');
}
window.handleApiError = handleApiError;

// Clear "Unknown API route" error if present on boot
if (el.scanMeta && el.scanMeta.textContent.includes('Unknown API route')) {
    el.scanMeta.textContent = 'Ready to scan.';
}

// --- Dropdown Menu Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const dropdownMenu = document.getElementById('dropdownMenu');
  
  if (menuToggleBtn && dropdownMenu) {
    menuToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('visible');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && !menuToggleBtn.contains(e.target)) {
        dropdownMenu.classList.remove('visible');
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const navUpgradeBtn = document.getElementById('navUpgradeBtn');
  if (navUpgradeBtn && typeof showUpgradeModal === 'function') {
    navUpgradeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showUpgradeModal();
    });
  }
});
// ── Navbar Hamburger Dropdown ─────────────────────────────────────────────
(function() {
  const menuBtn = document.getElementById('menuToggleBtn');
  const menu    = document.getElementById('dropdownMenu');
  const upgradeModal = document.getElementById('upgradeModal');

  if (!menuBtn || !menu) return;

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== menuBtn) {
      menu.classList.remove('open');
    }
  });

  // Close when pressing Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu.classList.remove('open');
  });

  // Close menu after any item click
  menu.addEventListener('click', () => {
    setTimeout(() => menu.classList.remove('open'), 120);
  });

  // Wire up Pro upgrade modal
  const upgradeBtn = document.getElementById('navUpgradeBtn');
  if (upgradeBtn && upgradeModal) {
    upgradeBtn.addEventListener('click', () => upgradeModal.showModal());
  }

  // Wire up license activation
  const activateBtn = document.getElementById('activateLicenseBtn');
  const licenseInput = document.getElementById('licenseKeyInput');
  const licenseError = document.getElementById('licenseKeyError');
  if (activateBtn && licenseInput) {
    activateBtn.addEventListener('click', async () => {
      const key = licenseInput.value.trim();
      if (!key) { licenseError.textContent = 'Please enter a license key.'; licenseError.style.display = 'block'; return; }
      activateBtn.disabled = true;
      activateBtn.textContent = 'Activating...';
      try {
        const res = await fetch('/api/license', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
        const data = await res.json();
        if (data.ok) {
          licenseError.style.display = 'none';
          activateBtn.textContent = '✓ Activated!';
          setTimeout(() => upgradeModal.close(), 1200);
        } else {
          licenseError.textContent = data.error || 'Invalid license key.';
          licenseError.style.display = 'block';
          activateBtn.disabled = false;
          activateBtn.textContent = 'Activate License';
        }
      } catch {
        licenseError.textContent = 'Network error — please try again.';
        licenseError.style.display = 'block';
        activateBtn.disabled = false;
        activateBtn.textContent = 'Activate License';
      }
    });
  }
})();
// ── Team Tab Live Status ──────────────────────────────────────────────────
(function pollTeamStatus() {
  const dot  = document.getElementById('teamStatusDot');
  const text = document.getElementById('teamStatusText');
  const row  = document.getElementById('teamUrlRow');
  const inp  = document.getElementById('teamShareUrl');
  const copyBtn = document.getElementById('copyTeamShareUrl');

  async function check() {
    try {
      const res = await fetch('/api/team/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'self-check' }) });
      if (res.ok) {
        if (dot)  { dot.style.background = '#22c55e'; }
        if (text) { text.innerHTML = '<strong style="color:#22c55e">Team Mode Active</strong> — sharing on your network'; }
        if (row)  { row.style.display = 'flex'; row.classList.remove('hidden'); }
        if (inp)  { inp.value = location.origin; }
      } else { setInactive(); }
    } catch { setInactive(); }
  }

  function setInactive() {
    if (dot)  { dot.style.background = 'var(--muted)'; }
    if (text) { text.innerHTML = 'Not active — start with <strong>npm run team</strong>'; }
    if (row)  { row.classList.add('hidden'); }
  }

  if (copyBtn && inp) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(inp.value).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 2000);
      });
    });
  }

  check();
  setInterval(check, 30000);
})();

// ── License Status on Load ────────────────────────────────────────────────
async function checkLicenseStatus() {
  try {
    const res  = await fetch('/api/license/status');
    if (!res.ok) return;
    const data = await res.json();
    const tier = data.tier || 'free';
    state.tier = tier;
    
    if (state.config) {
      state.config.licenseTier = tier;
    }
    
    const btn = document.getElementById('navUpgradeBtn');
    if (btn && tier !== 'free') {
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        ${tier.toLowerCase() === 'team' ? '✓ Team Active' : '✓ Pro Active'}`;
      btn.style.color = '#22c55e';
    }
    
    if (typeof updateLicenseUI === 'function') {
      updateLicenseUI();
    }
  } catch { /* silent */ }
}
checkLicenseStatus();

// ── License Activation Modal ───────────────────────────────────────────────
(function initLicenseModal() {
  const modal = document.getElementById('upgradeModal');
  const navBtn = document.getElementById('navUpgradeBtn');
  const activateBtn = document.getElementById('activateLicenseBtn');
  const licenseInput = document.getElementById('licenseKeyInput');

  if (navBtn && modal) {
    navBtn.addEventListener('click', () => {
      document.getElementById('dropdownMenu')?.classList.remove('show');
      modal.showModal();
    });
  }

  if (activateBtn && licenseInput) {
    activateBtn.addEventListener('click', async () => {
      const key = licenseInput.value.trim();
      if (!key) {
        showToast('Please enter a license key', 'warn');
        return;
      }
      activateBtn.disabled = true;
      activateBtn.textContent = 'Activating...';
      try {
        const res = await api('/api/license/activate', {
          method: 'POST',
          body: JSON.stringify({ licenseKey: key })
        });
        showToast(`✅ Activated ${res.tier} License!`, 'success');
        modal.close();
        checkLicenseStatus(); // re-check to update UI
      } catch (err) {
        showToast(`Activation failed: ${err.message}`, 'error');
      } finally {
        activateBtn.disabled = false;
        activateBtn.textContent = 'Activate';
      }
    });
  }
})();
// ── Wizard Token Type Tab Switcher ────────────────────────────────────────
(function() {
  const tabs = document.querySelectorAll('.wiz-token-tab');
  const panelClassic = document.getElementById('wizPanelClassic');
  const panelFine    = document.getElementById('wizPanelFinegrained');
  const tokenInput   = document.getElementById('wizGhToken');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const isClassic = tab.dataset.tab === 'classic';
      panelClassic.classList.toggle('hidden', !isClassic);
      panelFine.classList.toggle('hidden', isClassic);

      // Update placeholder to match chosen token type
      if (tokenInput) {
        tokenInput.placeholder = isClassic ? 'ghp_...' : 'github_pat_...';
      }

      // Clear any previous status
      const status = document.getElementById('wizTokenStatus');
      if (status) { status.textContent = ''; status.className = 'wizard-token-status'; }
    });
  });
})();

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 2 — GitHub Repository Browser (Ecosystem Tab)
// ══════════════════════════════════════════════════════════════════════════════

let _ghRepos = [];       // all repos from GitHub
let _localPaths = [];    // repo paths scanned locally (basenames for comparison)

/** Render one GitHub repo row */
function renderGhRepoRow(repo) {
  // Determine if this repo is already cloned locally
  const isLocal = _localPaths.some(p =>
    p.toLowerCase() === repo.name.toLowerCase() ||
    p.toLowerCase() === repo.full_name.toLowerCase().replace('/', '_')
  );

  const row = document.createElement('div');
  row.dataset.repoName = repo.full_name.toLowerCase();
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:11px 20px;border-bottom:1px solid var(--border);transition:background 0.1s;';
  row.addEventListener('mouseenter', () => row.style.background = 'var(--panel-strong)');
  row.addEventListener('mouseleave', () => row.style.background = '');

  const left = document.createElement('div');
  left.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;flex:1;';

  // Visibility icon
  const visIcon = repo.private
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" title="Private"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" title="Public"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

  const info = document.createElement('div');
  info.style.cssText = 'min-width:0;flex:1;';
  info.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      ${visIcon}
      <a href="${repo.html_url}" target="_blank" rel="noopener" style="font-size:13.5px;font-weight:600;color:var(--primary);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;" title="${repo.full_name}">${repo.full_name}</a>
      ${repo.language ? `<span style="font-size:11px;padding:1px 7px;border-radius:99px;background:var(--panel-strong);color:var(--muted);border:1px solid var(--border);">${repo.language}</span>` : ''}
      ${repo.fork ? `<span style="font-size:11px;padding:1px 7px;border-radius:99px;background:#fef3c7;color:#92400e;">fork</span>` : ''}
    </div>
    ${repo.description ? `<p style="font-size:12px;color:var(--muted);margin:3px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px;">${repo.description}</p>` : ''}
  `;

  left.appendChild(info);

  const right = document.createElement('div');
  right.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:12px;';

  // Star count
  if (repo.stargazers_count > 0) {
    right.innerHTML += `<span style="font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:3px;">⭐ ${repo.stargazers_count.toLocaleString()}</span>`;
  }

  if (isLocal) {
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:11.5px;padding:3px 10px;border-radius:99px;background:#d1fae5;color:#065f46;font-weight:600;white-space:nowrap;';
    badge.textContent = '✓ Cloned';
    right.appendChild(badge);
  } else {
    const cloneBtn = document.createElement('button');
    cloneBtn.className = 'btn-sm';
    cloneBtn.style.cssText = 'padding:5px 12px;font-size:12px;white-space:nowrap;';
    cloneBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Clone`;
    cloneBtn.addEventListener('click', () => {
      // Pre-fill clone dialog and open it
      const roots = state.config?.roots || [];
      if (!roots.length) { showToast('Configure at least one folder in Settings first.', 'warn'); return; }
      el.cloneDestSelect.innerHTML = roots.map(r => `<option value="${r}">${r}</option>`).join('');
      el.cloneDialog.showModal();
      el.confirmCloneButton.onclick = async () => {
        const dest = el.cloneDestSelect.value;
        if (!dest) return;
        el.confirmCloneButton.disabled = true;
        el.confirmCloneButton.textContent = 'Cloning…';
        try {
          const res = await api('/api/repos/clone', {
            method: 'POST',
            body: JSON.stringify({ root: dest, url: repo.clone_url, name: repo.name }),
          });
          el.cloneDialog.close();
          openShelby(`Clone ${repo.name}`, res.taskId);
          // Mark as cloned
          _localPaths.push(repo.name);
          cloneBtn.replaceWith((() => {
            const b = document.createElement('span');
            b.style.cssText = 'font-size:11.5px;padding:3px 10px;border-radius:99px;background:#d1fae5;color:#065f46;font-weight:600;';
            b.textContent = '✓ Cloning…';
            return b;
          })());
        } catch (err) {
          showToast(`Clone failed: ${err.message}`, 'error');
          el.confirmCloneButton.disabled = false;
          el.confirmCloneButton.textContent = 'Clone';
        }
      };
    });
    right.appendChild(cloneBtn);
  }

  row.appendChild(left);
  row.appendChild(right);
  return row;
}

/** Render the GitHub repo list, applying search filter */
function renderGhRepoList(filter = '') {
  const list = document.getElementById('ghRepoList');
  const badge = document.getElementById('ghRepoBadge');
  if (!list) return;

  const q = filter.toLowerCase().trim();
  const filtered = q ? _ghRepos.filter(r => r.full_name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)) : _ghRepos;

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = `<div style="padding:32px;text-align:center;"><p class="muted" style="font-size:13px;">No repositories match "${filter}"</p></div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach(r => frag.appendChild(renderGhRepoRow(r)));
  list.appendChild(frag);

  if (badge) {
    badge.style.display = '';
    const clonedCount = _ghRepos.filter(r => _localPaths.some(p => p.toLowerCase() === r.name.toLowerCase())).length;
    badge.textContent = `${_ghRepos.length} repos · ${clonedCount} cloned`;
  }
}

/** Load GitHub repos from API and render */
async function loadGhRepos(forceRefresh = false) {
  const loading = document.getElementById('ghRepoLoading');
  const empty   = document.getElementById('ghRepoEmpty');
  const errEl   = document.getElementById('ghRepoError');
  const list    = document.getElementById('ghRepoList');
  if (!list) return;

  if (loading) loading.style.display = 'block';
  if (empty)   empty.style.display = 'none';
  if (errEl)   errEl.style.display = 'none';
  list.innerHTML = '';

  try {
    const repos = await api('/api/github/repos');
    _ghRepos = repos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    // Build list of locally known repo names from current state
    _localPaths = (state.repos || []).map(r => r.name);

    if (loading) loading.style.display = 'none';
    renderGhRepoList(document.getElementById('ghRepoSearch')?.value || '');
  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (err.message?.toLowerCase().includes('pat') || err.message?.includes('401')) {
      if (empty) empty.style.display = 'block';
    } else {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = `⚠ ${err.message}`; }
    }
  }
}

// Wire search filter
document.getElementById('ghRepoSearch')?.addEventListener('input', e => {
  renderGhRepoList(e.target.value);
});

// Wire refresh button
document.getElementById('ghRepoRefreshBtn')?.addEventListener('click', () => loadGhRepos(true));

// Load when Ecosystem tab becomes active
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.target === 'tab-ecosystem' && _ghRepos.length === 0) {
      loadGhRepos();
    }
    if (btn.dataset.target === 'tab-insights') {
      loadInsights();
    }
  });
});

// ── INSIGHTS & AI STANDUP ──────────────────────────────────────────────────
let _insightsLoaded = false;
async function loadInsights() {
  if (_insightsLoaded) return;
  try {
    const res = await api('/api/insights/activity');
    const graph = document.getElementById('contributionGraph');
    if (graph) {
      graph.innerHTML = '';
      
      const today = new Date();
      const days = [];
      for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }
      
      const counts = Object.values(res);
      const maxCount = counts.length ? Math.max(...counts) : 1;
      
      for (const day of days) {
        const count = res[day] || 0;
        const cell = document.createElement('div');
        cell.title = `${count} commits on ${day}`;
        cell.style.width = '12px';
        cell.style.height = '12px';
        cell.style.borderRadius = '2px';
        
        if (count === 0) {
          cell.style.background = 'var(--border)';
        } else {
          const intensity = Math.max(0.3, Math.min(1, count / maxCount));
          if (intensity <= 0.3) cell.style.background = 'color-mix(in srgb, var(--accent) 30%, transparent)';
          else if (intensity <= 0.6) cell.style.background = 'color-mix(in srgb, var(--accent) 60%, transparent)';
          else if (intensity <= 0.85) cell.style.background = 'color-mix(in srgb, var(--accent) 85%, transparent)';
          else cell.style.background = 'var(--accent)';
        }
        graph.appendChild(cell);
      }
    }
    _insightsLoaded = true;
  } catch (err) {
    console.error('Failed to load insights', err);
  }
}

const standupBtn = document.getElementById('standupButton');
if (standupBtn) {
  standupBtn.addEventListener('click', async () => {
    if (!state.tier || state.tier === 'free') {
      document.getElementById('upgradeModal').showModal();
      return;
    }
    
    standupBtn.disabled = true;
    standupBtn.textContent = 'Generating... (This takes a few seconds)';
    
    try {
      const res = await api('/api/ai/standup', { method: 'POST' });
      const dialog = document.getElementById('standupDialog');
      const content = document.getElementById('standupContent');
      
      // Basic markdown to HTML
      let html = res.standup
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
        .replace(/\\n/g, '<br>');
        
      content.innerHTML = `<div style="font-family: inherit; line-height: 1.6; color: var(--text);">${html}</div>`;
      dialog.showModal();
    } catch (err) {
      showToast(err.message, 'error');
      if (err.message.includes('API Key')) {
        document.querySelector('[data-target="tab-settings"]').click();
      }
    } finally {
      standupBtn.disabled = false;
      standupBtn.textContent = 'Generate AI Standup';
    }
  });
}