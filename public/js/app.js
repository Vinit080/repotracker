import { api } from './api.js';
import { escapeHtml, escapeAttribute, renderChip, emptySmall } from './components.js';

const state = {
  repos: [],
  config: null,
  query: '',
  filter: 'all',
  loading: false
};

const elements = {
  scanButton: document.querySelector('#scanButton'),
  saveSettingsButton: document.querySelector('#saveSettingsButton'),
  rootsInput: document.querySelector('#rootsInput'),
  depthInput: document.querySelector('#depthInput'),
  searchInput: document.querySelector('#searchInput'),
  filterRow: document.querySelector('#filterRow'),
  metricsGrid: document.querySelector('#metricsGrid'),
  spotlight: document.querySelector('#spotlight'),
  repoGrid: document.querySelector('#repoGrid'),
  resultCount: document.querySelector('#resultCount'),
  scanMeta: document.querySelector('#scanMeta'),
  attentionList: document.querySelector('#attentionList'),
  languageList: document.querySelector('#languageList'),
  timelineList: document.querySelector('#timelineList'),
  todoList: document.querySelector('#todoList'),
  repoCardTemplate: document.querySelector('#repoCardTemplate'),
  patInput: document.querySelector('#patInput'),
  aiKeyInput: document.querySelector('#aiKeyInput'),
  wakaKeyInput: document.querySelector('#wakaKeyInput'),
  standupButton: document.querySelector('#standupButton'),
  standupDialog: document.querySelector('#standupDialog'),
  standupContent: document.querySelector('#standupContent'),
  searchDialog: document.querySelector('#searchDialog'),
  globalSearchInput: document.querySelector('#globalSearchInput'),
  searchResults: document.querySelector('#searchResults'),
  cloneDialog: document.querySelector('#cloneDialog'),
  cloneDestSelect: document.querySelector('#cloneDestSelect'),
  confirmCloneButton: document.querySelector('#confirmCloneButton'),
  authDialog: document.querySelector('#authDialog'),
  authForm: document.querySelector('#authForm'),
  authPasswordInput: document.querySelector('#authPasswordInput'),
  appPasswordInput: document.querySelector('#appPasswordInput')
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto'
});

function relativeTime(timestamp) {
  if (!timestamp) {
    return 'No commits yet';
  }

  const diffDays = Math.round((timestamp - Date.now()) / 86_400_000);
  if (Math.abs(diffDays) < 1) {
    return 'today';
  }
  if (Math.abs(diffDays) < 45) {
    return relativeFormatter.format(diffDays, 'day');
  }

  const diffMonths = Math.round(diffDays / 30);
  return relativeFormatter.format(diffMonths, 'month');
}

function normalizeRemote(remoteUrl) {
  if (!remoteUrl) return '';
  if (remoteUrl.startsWith('git@github.com:')) return `https://github.com/${remoteUrl.replace('git@github.com:', '').replace(/\.git$/, '')}`;
  return remoteUrl.replace(/\.git$/, '');
}

async function loadConfig() {
  try {
    state.config = await api('/api/config');
    elements.rootsInput.value = state.config.roots.join('\n');
    elements.depthInput.value = state.config.maxDepth;
    elements.patInput.value = state.config.githubPat || '';
    elements.aiKeyInput.value = state.config.aiApiKey || '';
    elements.wakaKeyInput.value = state.config.wakatimeApiKey || '';
    elements.appPasswordInput.value = state.config.appPassword || '';
    return true;
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') {
      elements.authDialog.showModal();
    }
    return false;
  }
}

async function scanRepos() {
  state.loading = true;
  elements.scanButton.disabled = true;
  elements.scanButton.textContent = 'Scanning...';
  elements.scanMeta.textContent = 'Scanning folders and reading Git state...';

  try {
    const data = await api('/api/repos');
    state.repos = data.repos;
    state.config = {
      roots: data.roots,
      maxDepth: data.maxDepth
    };
    elements.scanMeta.textContent = `${data.repos.length} repos scanned at ${dateFormatter.format(new Date(data.scannedAt))}`;
    if (data.errors?.length) {
      elements.scanMeta.textContent += ` - ${data.errors.join('; ')}`;
    }
    render();
    fetchGithubRepos();
    fetchTimeline();
    fetchTodos();
    fetchWakatimeStats();
  } catch (error) {
    elements.scanMeta.textContent = error.message;
    if (error.message === 'UNAUTHORIZED') {
      elements.scanMeta.textContent = 'App locked. Please enter your password.';
      elements.authDialog.showModal();
    }
  } finally {
    state.loading = false;
    elements.scanButton.disabled = false;
    elements.scanButton.textContent = 'Scan repos';
  }
}

function getMetrics(repos) {
  return {
    total: repos.length,
    pinned: repos.filter((repo) => repo.pinned).length,
    dirty: repos.filter((repo) => repo.status.dirtyCount > 0).length,
    sync: repos.filter((repo) => repo.status.ahead || repo.status.behind).length,
    healthy: repos.filter((repo) => repo.health >= 85).length,
    attention: repos.filter((repo) => repo.health < 75 || repo.status.dirtyCount || repo.status.behind).length
  };
}

function isStale(repo) {
  if (!repo.lastCommit?.timestamp) {
    return true;
  }

  return Date.now() - repo.lastCommit.timestamp > 30 * 86_400_000;
}

function matchesFilter(repo) {
  const filterMap = {
    all: true,
    pinned: repo.pinned,
    dirty: repo.status.dirtyCount > 0,
    ahead: repo.status.ahead > 0,
    behind: repo.status.behind > 0,
    stale: isStale(repo),
    clean: repo.status.dirtyCount === 0 && repo.status.ahead === 0 && repo.status.behind === 0,
    risk: isStale(repo) || repo.status.behind > 10 || repo.status.dirtyCount > 10 || (repo.github && repo.github.ci === 'failure')
  };

  return Boolean(filterMap[state.filter]);
}

function matchesQuery(repo) {
  const query = state.query.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [
    repo.name,
    repo.path,
    repo.branch,
    repo.remoteUrl,
    repo.note,
    ...repo.tags,
    ...repo.languages.map((language) => language.name)
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function getVisibleRepos() {
  return state.repos.filter((repo) => matchesFilter(repo) && matchesQuery(repo));
}

function render() {
  const visibleRepos = getVisibleRepos();
  renderMetrics();
  renderSpotlight();
  renderInsights();
  renderRepos(visibleRepos);
  if (elements.resultCount) elements.resultCount.textContent = `${visibleRepos.length} shown`;
}

function renderMetrics() {
  const metrics = getMetrics(state.repos);
  const items = [
    ['Total repos', metrics.total],
    ['Need attention', metrics.attention],
    ['Dirty worktrees', metrics.dirty],
    ['Sync drift', metrics.sync]
  ];

  elements.metricsGrid.replaceChildren(
    ...items.map(([label, value]) => {
      const card = document.createElement('article');
      card.className = 'metric';
      card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      return card;
    })
  );
}

function renderSpotlight() {
  const [repo] = [...state.repos].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return Number(b.pinned) - Number(a.pinned);
    }
    return a.health - b.health || b.status.dirtyCount - a.status.dirtyCount;
  });

  if (!repo) {
    elements.spotlight.innerHTML = '<span class="muted">Spotlight appears after scanning.</span>';
    return;
  }

  const remote = normalizeRemote(repo.remoteUrl);
  elements.spotlight.innerHTML = `
    <div>
      <p class="eyebrow">Spotlight</p>
      <h3>${escapeHtml(repo.name)}</h3>
      <p class="path" title="${escapeHtml(repo.path)}">${escapeHtml(repo.path)}</p>
      <div class="chips">
        ${renderChip(`Health ${repo.health}`, repo.health < 70 ? 'danger' : repo.health < 86 ? 'warn' : '')}
        ${renderChip(repo.branch || 'detached', 'info')}
        ${repo.status.dirtyCount ? renderChip(`${repo.status.dirtyCount} changed`, 'warn') : renderChip('clean')}
      </div>
    </div>
    <div>
      <p class="muted">${escapeHtml(repo.attention.join(' - '))}</p>
      <div class="card-actions">
        <button class="ghost" type="button" data-open="${escapeAttribute(repo.path)}">Open folder</button>
        ${remote ? `<a class="remote-link" href="${escapeAttribute(remote)}" target="_blank" rel="noreferrer">Remote</a>` : ''}
      </div>
    </div>
  `;
}

function renderInsights() {
  const attentionItems = [...state.repos]
    .filter((repo) => repo.health < 85 || repo.status.dirtyCount || repo.status.behind)
    .slice(0, 6);
  const languageCounts = new Map();

  for (const repo of state.repos) {
    for (const language of repo.languages) {
      languageCounts.set(language.name, (languageCounts.get(language.name) || 0) + 1);
    }
  }

  elements.attentionList.replaceChildren(
    ...(attentionItems.length
      ? attentionItems.map((repo) => {
        const item = document.createElement('div');
        item.className = 'attention-item';
        item.innerHTML = `<span>${escapeHtml(repo.name)}</span><strong>${repo.health}</strong>`;
        return item;
      })
      : [emptySmall('Everything scanned looks calm.')])
  );

  elements.languageList.replaceChildren(
    ...([...languageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([language, count]) => {
        const item = document.createElement('div');
        item.className = 'language-pill';
        item.innerHTML = `<span>${escapeHtml(language)}</span><strong>${count}</strong>`;
        return item;
      }))
  );

  if (!languageCounts.size) {
    elements.languageList.replaceChildren(emptySmall('No language data yet.'));
  }
}

function renderRepos(repos) {
  if (!repos.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = state.repos.length ? 'No repositories match the current view.' : 'No Git repositories found yet. Add a root folder and scan.';
    elements.repoGrid.replaceChildren(empty);
    return;
  }

  elements.repoGrid.replaceChildren(...repos.map(renderRepoCard));
}

function renderRepoCard(repo) {
  const fragment = elements.repoCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.repo-card');
  const title = fragment.querySelector('h4');
  const pathText = fragment.querySelector('.path');
  const pinButton = fragment.querySelector('.pin-button');
  const ring = fragment.querySelector('.health-ring');
  const ringText = fragment.querySelector('.health-ring span');
  const chips = fragment.querySelector('.chips');
  const ghStats = fragment.querySelector('.github-stats');
  const wakaStats = fragment.querySelector('.wakatime-stats');
  const statusLine = fragment.querySelector('.status-line');
  const commitLine = fragment.querySelector('.commit-line');
  const tagInput = fragment.querySelector('.tag-editor input');
  const note = fragment.querySelector('.note');
  const openButton = fragment.querySelector('.open-button');
  const remoteLink = fragment.querySelector('.remote-link');
  const qaSelect = fragment.querySelector('.quick-actions-select');
  const auditBtn = fragment.querySelector('.audit-button');
  const setupBtn = fragment.querySelector('.setup-button');
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
    ...repo.tags.map((tag) => renderChip(tag))
  ].join('');

  if (repo.github) {
    ghStats.classList.remove('hidden');
    const ciBadge = repo.github.ci === 'failure' ? '<span class="chip danger">CI Failing</span>' : (repo.github.ci === 'success' ? '<span class="chip info">CI Passing</span>' : '');
    ghStats.innerHTML = `
      <div class="gh-metrics">
        <span title="Stars" class="gh-stat">★ ${repo.github.stars}</span>
        <span title="Issues" class="gh-stat">⨀ ${repo.github.issues}</span>
        <span title="Pull Requests" class="gh-stat">⎇ ${repo.github.prs}</span>
        ${ciBadge}
      </div>
    `;
  } else {
    ghStats.classList.add('hidden');
  }

  const languageText = repo.languages.map((language) => language.name).join(', ') || 'No language signal';
  if (repo.isRemoteOnly) {
    statusLine.innerHTML = `<span>${escapeHtml(languageText)}</span><span>Remote Repository</span>`;
    commitLine.innerHTML = `<span>Not downloaded</span><span></span>`;
  } else {
    statusLine.innerHTML = `<span>${escapeHtml(languageText)}</span><span>${repo.commitCount} commits</span>`;
    commitLine.innerHTML = repo.lastCommit
      ? `<span title="${escapeAttribute(repo.lastCommit.subject)}">${escapeHtml(repo.lastCommit.hash)} ${escapeHtml(repo.lastCommit.subject)}</span><span>${relativeTime(repo.lastCommit.timestamp)}</span>`
      : '<span>No commits yet</span><span></span>';
  }

  tagInput.value = repo.tags.join(', ');
  note.value = repo.note || '';

  if (repo.scripts && repo.scripts.length > 0) {
    qaSelect.classList.remove('hidden');
    qaSelect.innerHTML = '<option value="">Quick Actions...</option>' + repo.scripts.map(s => `<option value="${escapeAttribute(s)}">npm run ${escapeHtml(s)}</option>`).join('');
  }

  qaSelect.addEventListener('change', async (e) => {
    const script = e.target.value;
    if (script) {
      qaSelect.value = '';
      try {
        await api('/api/repos/action', { method: 'POST', body: JSON.stringify({ path: repo.path, script }) });
      } catch (err) {
        alert(`Failed to start: ${err.message}`);
      }
    }
  });

  if (repo.isRemoteOnly) {
    setupBtn.classList.add('hidden');
    auditBtn.classList.add('hidden');
    openButton.classList.add('hidden');
    cloneBtn.classList.remove('hidden');
    
    cloneBtn.addEventListener('click', () => {
      elements.cloneDestSelect.innerHTML = state.config.roots.map(r => `<option value="${escapeAttribute(r)}">${escapeHtml(r)}</option>`).join('');
      elements.confirmCloneButton.onclick = async () => {
        elements.confirmCloneButton.disabled = true;
        elements.confirmCloneButton.textContent = 'Cloning...';
        try {
          await api('/api/repos/clone', {
            method: 'POST',
            body: JSON.stringify({ root: elements.cloneDestSelect.value, url: repo.remoteUrl, name: repo.name })
          });
          elements.cloneDialog.close();
          alert(`Started cloning ${repo.name}! A terminal window should appear.`);
        } catch (e) {
          alert('Clone failed: ' + e.message);
        } finally {
          elements.confirmCloneButton.disabled = false;
          elements.confirmCloneButton.textContent = 'Clone';
        }
      };
      elements.cloneDialog.showModal();
    });
  } else {
    setupBtn.addEventListener('click', async () => {
      try {
        await api('/api/repos/setup', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
        alert(`Auto-setup started for ${repo.name}. A terminal window has been opened.`);
      } catch (err) {
        alert(`Auto-setup failed: ${err.message}`);
      }
    });

    auditBtn.addEventListener('click', async () => {
      auditBtn.textContent = 'Auditing...';
      try {
        const res = await api('/api/repos/audit', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
        const vulns = res.metadata?.vulnerabilities;
        if (vulns && (vulns.high > 0 || vulns.critical > 0)) {
           alert(`Vulnerabilities in ${repo.name}! High: ${vulns.high}, Critical: ${vulns.critical}`);
        } else {
           alert(`Audit passed for ${repo.name} - no high/critical issues.`);
        }
      } catch (err) {
        alert(`Audit failed: ${err.message}`);
      } finally {
        auditBtn.textContent = 'Audit';
      }
    });

    if (repo.status.dirtyCount > 0) {
      aisyncBtn.classList.remove('hidden');
      aisyncBtn.classList.add('accent'); // make it pink
      aisyncBtn.addEventListener('click', async () => {
        aisyncBtn.disabled = true;
        aisyncBtn.textContent = 'Syncing...';
        try {
          const res = await api('/api/repos/aisync', { method: 'POST', body: JSON.stringify({ path: repo.path }) });
          alert(`Successfully synced! Commit message: "${res.message}"`);
          scanRepos(); // refresh to clear dirty state
        } catch (err) {
          alert(`AI Sync failed: ${err.message}`);
        } finally {
          aisyncBtn.disabled = false;
          aisyncBtn.textContent = 'AI Sync 🪄';
        }
      });
    }

    openButton.addEventListener('click', () => openRepo(repo.path));
  }

  const remote = normalizeRemote(repo.remoteUrl);
  if (remote) {
    remoteLink.href = remote;
  } else {
    remoteLink.classList.add('hidden');
  }

  card.dataset.path = repo.path;
  return fragment;
}

async function updateRepoMeta(repo, patch) {
  const next = {
    path: repo.path,
    pinned: repo.pinned,
    note: repo.note,
    tags: repo.tags,
    ...patch
  };

  await api('/api/repos/meta', {
    method: 'PATCH',
    body: JSON.stringify(next)
  });

  Object.assign(repo, next);
  render();
}

async function openRepo(repoPath) {
  await api('/api/repos/open', {
    method: 'POST',
    body: JSON.stringify({ path: repoPath })
  });
}

async function saveSettings(event) {
  if (event) event.preventDefault();
  const roots = elements.rootsInput.value.split(/\r?\n/).map((root) => root.trim()).filter(Boolean);
  const maxDepth = Number(elements.depthInput.value) || 4;
  const githubPat = elements.patInput.value.trim();
  const aiApiKey = elements.aiKeyInput.value.trim();
  const wakatimeApiKey = elements.wakaKeyInput.value.trim();
  const appPassword = elements.appPasswordInput.value.trim();
  try {
    state.config = await api('/api/config', {
      method: 'PUT',
      body: JSON.stringify({ roots, maxDepth, githubPat, aiApiKey, wakatimeApiKey, appPassword })
    });
    // Update local token immediately if we just changed the password
    if (appPassword) {
      localStorage.setItem('repo_auth', appPassword);
    } else {
      localStorage.removeItem('repo_auth');
    }
    await scanRepos();
  } catch (err) {
    alert('Failed to save settings: ' + err.message);
  }
}

async function fetchTimeline() {
  try {
    const commits = await api('/api/timeline');
    state.timeline = commits;
    elements.timelineList.replaceChildren(
      ...commits.map(commit => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
          <div class="timeline-meta"><strong>${escapeHtml(commit.repoName)}</strong> <span class="muted">${relativeTime(commit.timestamp)}</span></div>
          <div class="timeline-subject" title="${escapeAttribute(commit.subject)}">${escapeHtml(commit.subject)}</div>
          <div class="timeline-author muted">${escapeHtml(commit.author)}</div>
        `;
        return item;
      })
    );
  } catch (e) {
    elements.timelineList.replaceChildren(emptySmall('Could not load timeline.'));
  }
}

async function fetchTodos() {
  try {
    const data = await api('/api/todos');
    const todos = data.results || [];
    elements.todoList.replaceChildren(
      ...todos.map(todo => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.style.cursor = 'pointer';
        item.onclick = () => openRepo(todo.path);
        item.innerHTML = `
          <div class="timeline-meta"><strong>${escapeHtml(todo.repo)}</strong> <span class="muted">${escapeHtml(todo.file)}:${escapeHtml(todo.line)}</span></div>
          <div class="timeline-subject" style="font-family: monospace; white-space: normal;" title="${escapeAttribute(todo.content)}">${escapeHtml(todo.content)}</div>
        `;
        return item;
      })
    );
    if (todos.length === 0) {
      elements.todoList.replaceChildren(emptySmall('No Action Items found! 🎉'));
    }
  } catch (e) {
    elements.todoList.replaceChildren(emptySmall('Could not load Action Items.'));
  }
}

async function fetchGithubRepos() {
  if (!state.config?.githubPat) return;

  try {
    const data = await api('/api/github/repos');
    if (!Array.isArray(data)) return;

    for (const ghRepo of data) {
      // Find if we already have it locally
      const localRepo = state.repos.find(r => {
        if (!r.remoteUrl) return false;
        const normLocal = r.remoteUrl.toLowerCase().replace(/\.git$/, '');
        const normRemote = ghRepo.clone_url.toLowerCase().replace(/\.git$/, '');
        const normSsh = ghRepo.ssh_url.toLowerCase().replace(/\.git$/, '');
        return normLocal === normRemote || normLocal === normSsh || normLocal.includes(ghRepo.full_name.toLowerCase());
      });

      if (localRepo) {
        localRepo.github = {
          stars: ghRepo.stargazers_count || 0,
          issues: ghRepo.open_issues_count || 0,
          prs: 0,
          ci: null
        };
      } else {
        // It's a remote-only repo
        state.repos.push({
          name: ghRepo.name,
          path: `Remote: ${ghRepo.full_name}`,
          remoteUrl: ghRepo.clone_url,
          pinned: false,
          health: 100, // placeholder
          status: { dirtyCount: 0, ahead: 0, behind: 0 },
          tags: [],
          languages: ghRepo.language ? [{ name: ghRepo.language }] : [],
          attention: [],
          isRemoteOnly: true,
          github: {
            stars: ghRepo.stargazers_count || 0,
            issues: ghRepo.open_issues_count || 0,
            prs: 0,
            ci: null
          }
        });
      }
    }
    
    // Sort to keep local repos generally above remote repos, but respect other sorts
    state.repos.sort((a, b) => {
      if (a.isRemoteOnly !== b.isRemoteOnly) return a.isRemoteOnly ? 1 : -1;
      return 0;
    });

    render();
  } catch (e) {
    console.warn('Failed to fetch github repos', e);
  }
}

async function fetchWakatimeStats() {
  if (!state.config?.wakatimeApiKey) return;
  try {
    const data = await api('/api/wakatime');
    const projects = {};
    if (data.data) {
      for (const day of data.data) {
        for (const proj of day.projects) {
          projects[proj.name] = (projects[proj.name] || 0) + proj.total_seconds;
        }
      }
    }
    for (const repo of state.repos) {
      const match = projects[repo.name];
      if (match) {
        repo.wakatime = { hours: (match / 3600).toFixed(1) };
      }
    }
    render();
  } catch (e) {
    console.warn('Failed to fetch wakatime', e);
  }
}

elements.standupButton.addEventListener('click', async () => {
  elements.standupDialog.showModal();
  elements.standupContent.textContent = 'Generating your AI Standup. This might take a few seconds...';
  try {
    const response = await api('/api/standup', {
      method: 'POST',
      body: JSON.stringify({ commits: state.timeline || [] })
    });
    elements.standupContent.textContent = response.report;
  } catch (err) {
    elements.standupContent.textContent = `Error: ${err.message}`;
  }
});

let searchTimeout;
elements.globalSearchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  if (!query) {
    elements.searchResults.innerHTML = '';
    return;
  }
  searchTimeout = setTimeout(async () => {
    elements.searchResults.innerHTML = '<span class="muted">Searching...</span>';
    try {
      const res = await api('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query })
      });
      if (res.results && res.results.length) {
        elements.searchResults.innerHTML = res.results.map(r => `
          <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 8px 0; cursor: pointer;" data-open="${escapeAttribute(r.path)}">
            <div style="font-size: 0.8rem; color: var(--accent);">${escapeHtml(r.repo)} - ${escapeHtml(r.file)}:${escapeHtml(r.line)}</div>
            <div style="font-family: monospace; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(r.content)}</div>
          </div>
        `).join('');
      } else {
        elements.searchResults.innerHTML = '<span class="muted">No results found.</span>';
      }
    } catch (err) {
      elements.searchResults.innerHTML = '<span class="muted">Error searching.</span>';
    }
  }, 300);
});

elements.scanButton.addEventListener('click', scanRepos);
elements.saveSettingsButton.addEventListener('click', saveSettings);
elements.searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  render();
});
elements.filterRow.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) {
    return;
  }

  state.filter = button.dataset.filter;
  elements.filterRow.querySelectorAll('.filter').forEach((filter) => {
    filter.classList.toggle('active', filter === button);
  });
  render();
});
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    elements.searchDialog.showModal();
    elements.globalSearchInput.focus();
  } else if (event.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    event.preventDefault();
    elements.searchInput.focus();
  }
});
document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open]');
  if (opener) {
    openRepo(opener.dataset.open);
  }
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
  });
});

elements.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = elements.authPasswordInput.value;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('repo_auth', data.token);
      elements.authDialog.close();
      elements.authPasswordInput.value = '';
      if (await loadConfig()) {
        await scanRepos();
      }
    } else {
      alert('Incorrect password');
      elements.authPasswordInput.value = '';
    }
  } catch (err) {
    alert('Login error');
  }
});

(async () => {
  const savedTheme = localStorage.getItem('repo_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light' || (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: light)').matches);
    const newTheme = isLight ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('repo_theme', newTheme);
  });

  if (await loadConfig()) {
    await scanRepos();
  }
})();
