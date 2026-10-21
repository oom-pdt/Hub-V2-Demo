// Galaxis Hub demo — app shell: sidebar navigation, page header and workspace switcher.

const CURRENT_USER_ID = 'm-a1';

const NAV_ITEMS = [
  { page: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { page: 'organisation', label: 'Organisation', icon: 'building-2' },
  { page: 'team', label: 'Team & Access', icon: 'users' },
  { page: 'integrations', label: 'Integrations', icon: 'blocks' },
  // Not in Figma: Leads appears only inside a client workspace with an active CRM (V2 feature).
  { page: 'leads', label: 'Leads', icon: 'contact', show: () => !isAgency() && !!activeCrm(state.ctx) }
];

function renderShell() {
  renderSidebar();
  renderHeader();
}

function renderSidebar() {
  const nav = NAV_ITEMS.filter(n => !n.show || n.show()).map(n => `
    <button type="button" class="nav-item ${state.page === n.page || (n.page === 'leads' && state.page === 'lead') ? 'active' : ''}" onclick="navigate('${n.page}')" title="${esc(n.label)}">
      <i data-lucide="${n.icon}"></i><span>${esc(n.label)}</span>
    </button>`).join('');
  document.getElementById('sidebar').innerHTML = `
    <div class="sidebar-logo">g<span class="logo-text">alaxis</span></div>
    <nav class="sidebar-nav" aria-label="Main">${nav}</nav>`;
}

function renderHeader() {
  const def = screens[state.page] || {};
  const ws = currentWs();
  const title = def.title ? def.title() : '';
  const desc = def.desc ? def.desc() : '';
  const user = memberById(CURRENT_USER_ID);
  document.getElementById('page-header').innerHTML = `
    <div>
      <h1 class="h-page">${esc(title)}</h1>
      ${desc ? `<div class="page-desc">${esc(desc)}</div>` : ''}
    </div>
    <div class="page-header-right">
      <div class="menu-anchor">
        <button type="button" class="ws-trigger" data-popover-trigger onclick="toggleWsPanel(event)" aria-haspopup="listbox">
          <span class="dot ${ws ? 'dot-green' : 'dot-blue'}" style="width:10px;height:10px"></span>
          <span>${esc(ws ? ws.name : 'My Workspace')}</span>
          ${ws && state.persona === 'client' ? '<span class="chip" style="height:18px">Client view</span>' : ''}
          <i data-lucide="chevron-down" class="chev"></i>
        </button>
        <div class="ws-panel" id="ws-panel" onclick="event.stopPropagation()"></div>
      </div>
      <div class="menu-anchor">
        <button type="button" class="avatar-btn" onclick="toggleMenu('user-menu', event)" aria-label="Account"><i data-lucide="user"></i></button>
        <div class="menu" id="user-menu" onclick="event.stopPropagation()">
          <div style="padding:10px"><div class="t-bold">${esc(user.name)}</div><div class="t-caption t-muted">${esc(user.email)}</div><div class="t-caption t-muted" style="margin-top:4px">${esc(roleById(user.roleId).name)} · ${esc(AGENCY_ORG.name)}</div></div>
          <div class="menu-sep"></div>
          <button type="button" class="menu-item" onclick="closeAllPopovers(); switchWorkspace(null)"><i data-lucide="home"></i>Go to My Workspace</button>
        </div>
      </div>
    </div>`;
}

// ---------- Workspace switcher (V1 behaviour, Figma "Workspace Dropdown") ----------
state.ui.wsSearch = '';

// Workspaces the signed-in agency user can see. V1 spec: assignment decides what appears in the switcher.
function visibleWorkspaces() {
  const me = memberById(CURRENT_USER_ID);
  const all = activeWorkspaces();
  return me.workspaces.includes('*') ? all : all.filter(w => me.workspaces.includes(w.id));
}

function wsActiveCampaigns(ws) {
  if (typeof workspaceCampaignCount === 'function') return workspaceCampaignCount(ws.id);
  return wsAdAccounts(ws.id).length ? 5 + (ws.seed * 7) % 36 : 0;
}

function toggleWsPanel(ev) {
  ev.stopPropagation();
  const panel = document.getElementById('ws-panel');
  const open = !panel.classList.contains('open');
  closeAllPopovers();
  if (!open) return;
  state.ui.wsSearch = '';
  panel.innerHTML = `
    <div class="h-card" style="margin-bottom:12px">Select Workspace</div>
    <div class="search"><input class="input" id="ws-search" placeholder="Search" oninput="state.ui.wsSearch = this.value; renderWsList()"><i data-lucide="search"></i></div>
    <div id="ws-list"></div>`;
  panel.classList.add('open');
  renderWsList();
  document.getElementById('ws-search').focus();
}

function renderWsList() {
  const term = state.ui.wsSearch.trim().toLowerCase();
  const list = visibleWorkspaces().filter(w => !term || w.name.toLowerCase().includes(term));
  const agencyMatch = !term || 'my workspace agency'.includes(term);
  const tick = '<i data-lucide="check" style="margin-left:auto;color:var(--primary)"></i>';
  const agencyRow = agencyMatch ? `
    <div class="ws-section-label">Agency</div>
    <button type="button" class="ws-option ${isAgency() ? 'current' : ''}" onclick="pickWorkspace(null)">
      <span class="avatar" style="background:var(--primary);color:#fff"><i data-lucide="building-2"></i></span>
      <span><div class="ws-name">My Workspace</div><div class="ws-meta">Agency Dashboard · ${activeWorkspaces().length} Client Workspaces</div></span>
      ${isAgency() ? tick : ''}
    </button>` : '';
  const rows = list.map(w => {
    const plats = wsPlatforms(w.id).length;
    return `<button type="button" class="ws-option ${state.ctx === w.id ? 'current' : ''}" onclick="pickWorkspace('${w.id}')">
      <span class="avatar">${esc(initials(w.name))}</span>
      <span><div class="ws-name">${esc(w.name)}</div><div class="ws-meta">${wsActiveCampaigns(w)} Active Campaigns • ${plats} Platform${plats === 1 ? '' : 's'}</div></span>
      ${state.ctx === w.id ? tick : ''}
    </button>`;
  }).join('');
  renderRegion('ws-list', `${agencyRow}
    <div class="ws-section-label">Client (${list.length})</div>
    <div class="ws-list">${rows || `<div class="empty" style="padding:20px">No client workspace found matching “${esc(state.ui.wsSearch)}”.</div>`}</div>`);
}

function pickWorkspace(id) {
  closeAllPopovers();
  if (id === state.ctx) return;
  switchWorkspace(id);
}

// Jump into a client workspace from anywhere (e.g. "Go to workspace" links).
function openWorkspace(id, page = 'dashboard', params = {}) {
  state.ctx = id;
  navigate(page, params);
}
