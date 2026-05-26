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
async function checkForAppUpdates() {
  try {
    const res = await api('/api/system/check-update');
    if (res.updateAvailable) {
      el.systemUpdateBanner.classList.remove('hidden');
      el.updateBannerText.textContent = `A new update for RepoTracker is available! (${res.commitsBehind} commits behind)`;
    }
  } catch (err) {
    console.error('Failed to check for system updates', err);
  }
}

el.applyUpdateBtn?.addEventListener('click', async () => {
  const btn = el.applyUpdateBtn;
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
    state.repos = data.repos;
    state.config = { ...state.config, roots: data.roots, maxDepth: data.maxDepth };
    el.scanMeta.textContent = `${data.repos.length} repos found · ${dateFormatter.format(new Date(data.scannedAt))}`;
    if (data.errors?.length) el.scanMeta.textContent += ` · ${data.errors.join('; ')}`;
    render();
    fetchGithubRepos();
    fetchTimeline();
    fetchTodos();
    fetchWakatimeStats();
    checkForAppUpdates();
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

  // Cloud repos have no local status, so they don't apply to health filters
  if (repo.isCloud) return false;

  const map = {
    dirty: repo.status.dirtyCount > 0,
    ahead: repo.status.ahead > 0,
    behind: repo.status.behind > 0,
    stale: isStale(repo),
    clean: !repo.status.dirtyCount && !repo.status.ahead && !repo.status.behind,
    risk: isStale(repo) || repo.status.behind > 10 || repo.status.dirtyCount > 10 || repo.github?.ci === 'failure'
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
  el.resultCount.textContent = `${visible.length} shown`;
}

function renderMetrics() {
  const repos = state.repos;
  const items = [
    ['Total repos', repos.length],
    ['Need attention', repos.filter(r => r.health < 75 || r.status.dirtyCount || r.status.behind).length],
    ['Dirty worktrees', repos.filter(r => r.status.dirtyCount > 0).length],
    ['Sync drift', repos.filter(r => r.status.ahead || r.status.behind).length]
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
    return a.health - b.health || b.status.dirtyCount - a.status.dirtyCount;
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
        ${repo.status.dirtyCount ? renderChip(`${repo.status.dirtyCount} changed`, 'warn') : renderChip('clean')}
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
    .filter(r => r.health < 85 || r.status.dirtyCount || r.status.behind)
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
  el.repoGrid.replaceChildren(...repos.map(renderRepoCard));
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
    repo.status.dirtyCount ? renderChip(`${repo.status.dirtyCount} changed`, 'warn') : (!repo.isRemoteOnly ? renderChip('clean') : ''),
    repo.status.ahead ? renderChip(`ahead ${repo.status.ahead}`, 'warn') : '',
    repo.status.behind ? renderChip(`behind ${repo.status.behind}`, 'danger') : '',
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

    if (repo.status.dirtyCount > 0) {
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

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  // Restore saved theme
  const savedTheme = localStorage.getItem('repo_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  // M5: Show a loading indicator while the initial config fetch is in-flight
  el.scanMeta.textContent = 'Connecting to server...';

  const ok = await loadConfig();
  if (!ok) return; // auth dialog is now showing

  if (!state.config.onboardingComplete) {
    // New user (or user who skipped before this flag existed) — show wizard
    await showWizard();
  } else {
    // Returning user — show dashboard and scan
    el.scanMeta.textContent = 'Ready. Click Scan repos to refresh.';
    el.wizard.classList.remove('active');
    el.shell.style.display = '';
    await scanRepos();
  }
})();

// Close custom dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.quick-actions-dropdown')) {
    document.querySelectorAll('.quick-actions-dropdown[open]').forEach(dropdown => {
      dropdown.removeAttribute('open');
    });
  }
});
