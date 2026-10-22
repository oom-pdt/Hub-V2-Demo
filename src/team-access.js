// Galaxis Hub demo — Team & Access: Members / Teams / Roles & Permissions / Client Organisation (agency) / Agency (client workspace).
// Ports V1 agency team + roles, client users + primary contact, workspace creation and agency access; adds the Figma-only
// Teams, Deactivate/Remove, Duplicate role, Archive organisation and seat usage. Every global here is prefixed `team`,
// except `permissionCatalogue`, which data.js refers to by name.

// ---------- Permission catalogue (Figma "Create Role" frame 6461:21738 + V1 permission ids) ----------
// scope: 'agency' groups only appear on agency roles. V1 ids (perm-*) are kept as ids so nothing from V1 is lost:
// perm-ws-view / perm-ws-create / perm-ws-client / perm-ws-agency / perm-ad-map live in the Agency group,
// perm-team-invite is "Invite Members" and perm-team-role is "Create Roles".
const permissionCatalogue = [
  { id: 'organisation', name: 'Organisation', desc: 'Manage your organisation details', subgroups: [
    { name: 'Company Information', perms: [
      { id: 'org.view', title: 'View Organisation', desc: 'View your organisation’s profile, business information, and brand details.' },
      { id: 'org.edit', title: 'Editing Organisation', desc: 'Update your organisation’s profile, business information, and general details.' },
      { id: 'org.brand', title: 'Manage Brand Identity', desc: 'Update your organisation’s logos, colours, typography, and other brand information.' }
    ] }
  ] },
  { id: 'org-management', name: 'Organisation Management', desc: 'Manage your organisation details', subgroups: [
    { name: 'Members', perms: [
      { id: 'members.view', title: 'View Members', desc: 'View members in your organisation and their assigned teams and roles.' },
      { id: 'perm-team-invite', title: 'Invite Members', desc: 'Invite new members to join your organisation.' },
      { id: 'members.edit', title: 'Edit Members', desc: 'Update a member’s team, role, or account details.' },
      { id: 'members.deactivate', title: 'Deactivate Members', desc: 'Temporarily suspend a member’s access without removing their account.' },
      { id: 'members.remove', title: 'Remove Members', desc: 'Remove a member from your organisation and revoke their access.' }
    ] },
    { name: 'Teams', perms: [
      { id: 'teams.view', title: 'View Teams', desc: 'View your teams, their members, and assigned product access.' },
      { id: 'teams.create', title: 'Create Teams', desc: 'Create new teams and define which products they can access.' },
      { id: 'teams.edit', title: 'Edit Teams', desc: 'Update team details, members, and team settings.' },
      { id: 'teams.products', title: 'Management Product Access', desc: 'Choose which connected products and services a team can access.' },
      { id: 'teams.delete', title: 'Delete Teams', desc: 'Delete teams that are no longer in use and prevent further access through the team.' }
    ] },
    { name: 'Roles & Permissions', perms: [
      { id: 'roles.view', title: 'View Roles', desc: 'View the roles available in your organisation and the access they provide.' },
      { id: 'perm-team-role', title: 'Create Roles', desc: 'Create custom roles for different responsibilities within your organisation.' },
      { id: 'roles.edit', title: 'Edit Roles', desc: 'Update a role’s details and assigned permissions.' },
      { id: 'roles.duplicate', title: 'Duplicate Roles', desc: 'Create a new role by copying the configuration of an existing role.' },
      { id: 'roles.configure', title: 'Configure Permissions', desc: 'Define what a role can view, create, edit, or manage across your organisation and connected products.' },
      { id: 'roles.delete', title: 'Delete Roles', desc: 'Delete roles that are no longer in use.' }
    ] }
  ] },
  { id: 'integrations', name: 'Integrations', desc: 'Connect and manage products and external services across your organisation.', subgroups: [
    { name: 'Products', perms: [
      { id: 'integ.view', title: 'View Integrations', desc: 'View the products and external services connected to your organisation.' },
      { id: 'integ.open', title: 'Open Product', desc: 'Access active product platform in your organisation.' },
      { id: 'integ.connect', title: 'Connect Integrations', desc: 'Connect an available product or external service to your organisation.' },
      { id: 'integ.activate', title: 'Activate Integrations', desc: 'Activate connected product in your organisation.' },
      { id: 'integ.disable', title: 'Disable Integrations', desc: 'Temporarily disable a product from your organisation without disconnecting it.' },
      { id: 'integ.disconnect', title: 'Disconnect Integrations', desc: 'Remove a connected product or service from your organisation.' }
    ] }
  ] },
  // Figma lists "Agency 0/5" in the side panel but has no detail frame: filled from V1's agency permissions.
  { id: 'agency', name: 'Agency', scope: 'agency', desc: 'Manage client workspaces, agency access and ad account linking.', subgroups: [
    { name: 'Client Workspaces', perms: [
      { id: 'perm-ws-view', title: 'View Assigned Workspaces', desc: 'View the client workspaces this member is assigned to.' },
      { id: 'perm-ws-create', title: 'Create Workspaces', desc: 'Create new client organisations and their workspaces.' },
      { id: 'perm-ws-client', title: 'Manage Clients in Workspaces', desc: 'Invite and manage client members inside client workspaces.' },
      { id: 'perm-ws-agency', title: 'Assign & Unassign Agency Members', desc: 'Give or revoke agency members’ access to client workspaces.' }
    ] },
    { name: 'Ad Accounts', perms: [
      { id: 'perm-ad-map', title: 'Link & Unlink Ad Accounts', desc: 'Link Google and Meta ad accounts to client workspaces, or unlink them.' }
    ] }
  ] },
  // Figma lists "Settings 0/5" with no detail frame: [PLACEHOLDER] permissions until design confirms them.
  { id: 'settings', name: 'Settings', desc: 'Manage workspace settings. [PLACEHOLDER — not yet designed]', subgroups: [
    { name: 'Workspace Settings', perms: [
      { id: 'settings.view', title: 'View Settings', desc: 'View workspace settings. [PLACEHOLDER]' },
      { id: 'settings.edit', title: 'Edit Settings', desc: 'Update general workspace settings. [PLACEHOLDER]' },
      { id: 'settings.notifications', title: 'Manage Notifications', desc: 'Choose which alerts and emails the workspace sends. [PLACEHOLDER]' },
      { id: 'settings.billing', title: 'Manage Billing', desc: 'Update billing details and invoices. [PLACEHOLDER]' },
      { id: 'settings.security', title: 'Manage Security', desc: 'Manage sign-in and security policies. [PLACEHOLDER]' }
    ] }
  ] }
];

function teamPermGroups(scope) { return permissionCatalogue.filter(g => !g.scope || g.scope === scope); }
function teamGroupPermIds(g) { return g.subgroups.flatMap(sg => sg.perms.map(p => p.id)); }
function teamAllPermIds(scope) { return teamPermGroups(scope).flatMap(teamGroupPermIds); }
function teamPermById(id) { for (const g of permissionCatalogue) for (const sg of g.subgroups) { const p = sg.perms.find(x => x.id === id); if (p) return p; } return null; }
// Does a role grant a permission? Locked roles hold '*'.
function teamRoleHas(role, permId) { return !!role && (role.perms.includes('*') || role.perms.includes(permId)); }

// Seed sensible permissions for the non-locked roles (only where none are set yet).
(function teamSeedRolePerms() {
  const view = ['org.view', 'members.view', 'teams.view', 'roles.view', 'integ.view', 'integ.open'];
  const seed = {
    'r-a-am':       [...view, 'perm-ws-view', 'perm-ws-client', 'perm-ad-map', 'perm-team-invite', 'members.edit'],
    'r-a-seolead':  [...view, 'perm-ws-view', 'teams.edit', 'teams.products'],
    'r-a-pl':       [...view, 'perm-ws-view', 'perm-ws-client', 'perm-team-invite', 'members.edit', 'teams.create', 'teams.edit', 'teams.products'],
    'r-a-analyst':  ['org.view', 'members.view', 'integ.view', 'integ.open', 'perm-ws-view', 'perm-ws-client'],
    'r-a-viewer':   ['org.view', 'perm-ws-view'],
    'r-c-admin':    teamAllPermIds('client').filter(id => !['roles.delete', 'settings.billing', 'settings.security'].includes(id)),
    'r-c-hom':      [...view, 'org.edit', 'org.brand', 'perm-team-invite', 'members.edit', 'teams.create', 'teams.edit', 'teams.products', 'integ.connect', 'integ.activate'],
    'r-c-mexec':    [...view, 'org.brand'],
    'r-c-hor':      [...view, 'perm-team-invite', 'members.edit', 'teams.edit'],
    'r-c-exec':     [...view],
    'r-c-sales':    ['org.view', 'members.view', 'integ.view', 'integ.open'],
    'r-c-employee': ['org.view', 'integ.view', 'integ.open']
  };
  roles.forEach(r => { if (!r.locked && (!r.perms || !r.perms.length) && seed[r.id]) r.perms = [...seed[r.id]]; });
})();

// ---------- State ----------
state.ui.teamSearch = {};
state.ui.teamFilters = {};
state.ui.teamQueue = {};          // wsId -> [agency member ids] queued for access (V1 pending assignments)
state.ui.teamRoleDraft = null;
state.flags.teamEmpty = {};       // tab -> true shows the empty state

const TEAM_SEATS_TOTAL = 20;      // [PLACEHOLDER] seat allowance per client workspace
const TEAM_INDUSTRIES = ['Digital Media', 'Education', 'F&B', 'Finance', 'Healthcare', 'Logistics', 'Manufacturing', 'Professional Services', 'Property', 'Retail', 'Technology', 'Videography', 'Other'];

function teamScope() { return isAgency() ? 'agency' : 'client'; }
function teamToday() { return toDateInput(new Date()); }
function teamTabs() {
  const tabs = [
    { id: 'members', label: 'Members', icon: 'users' },
    { id: 'teams', label: 'Teams', icon: 'users-round' },
    { id: 'roles', label: 'Roles & Permissions', icon: 'key-round' }
  ];
  if (isAgency()) tabs.push({ id: 'clients', label: 'Client Organisation', icon: 'building-2' });
  // V1 rule: agency access governance is hidden from client users.
  else if (state.persona !== 'client') tabs.push({ id: 'agency', label: 'Agency', icon: 'building-2' });
  return tabs;
}
function teamTab() {
  const t = state.params.tab;
  return teamTabs().some(x => x.id === t) ? t : 'members';
}
function teamEditing() {
  const e = state.params.edit;
  if (!e || teamTab() !== 'roles') return false;
  if (e === 'new') return true;
  const r = roleById(e);
  return !!r && r.org === teamScope();
}
function teamGoTab(tab) { navigate('team', { tab }); }

// Members in this org, roles in this scope.
function teamOrgMembers(org = currentOrgId()) { return members.filter(m => m.org === org); }
function teamOrgTeams(org = currentOrgId()) { return teams.filter(t => t.org === org); }
function teamScopeRoles(scope = teamScope()) { return roles.filter(r => r.org === scope); }
// Lowest role (V1: deleting a role downgrades its members to Viewer). Client equivalent: Employee.
function teamLowestRole(scope, excludeId) {
  const pref = roles.find(r => r.id === (scope === 'agency' ? 'r-a-viewer' : 'r-c-employee') && r.id !== excludeId);
  if (pref) return pref;
  const list = teamScopeRoles(scope).filter(r => r.id !== excludeId);
  return list.filter(r => !r.locked).pop() || list.pop() || null;
}
// Products this org can hand out (connected workspace products plus whatever its teams and members already use).
function teamOrgProducts(org = currentOrgId()) {
  const ids = new Set();
  if (org === 'agency') products.filter(p => p.provider === 'oom').forEach(p => ids.add(p.id));
  else Object.entries(wsProducts(org)).forEach(([pid, s]) => { if (s.status !== 'disabled') ids.add(pid); });
  teamOrgTeams(org).forEach(t => t.products.forEach(p => ids.add(p)));
  teamOrgMembers(org).forEach(m => (m.products || []).forEach(p => ids.add(p)));
  if (!ids.size) products.filter(p => p.provider === 'oom').forEach(p => ids.add(p.id));
  return products.filter(p => ids.has(p.id));
}
function teamNameFromEmail(email) {
  const local = String(email).split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
  return local ? local.replace(/\b\w/g, c => c.toUpperCase()) : 'Pending User';
}
function teamWsAgencyMembers(wsId) {
  return members.filter(m => m.org === 'agency' && m.status !== 'deactivated' && (m.workspaces || []).some(w => w === '*' || w === wsId));
}

// ---------- Shared bits: card header, search, filters ----------
function teamSetSearch(tab, v) {
  state.ui.teamSearch[tab] = v;
  if (state.pagers[`team-${tab}`]) state.pagers[`team-${tab}`].page = 1;
  teamRefresh();
}
function teamSearchBox(tab, placeholder = 'Search') {
  return `<div class="search team-search"><input class="input" placeholder="${esc(placeholder)}" value="${esc(state.ui.teamSearch[tab] || '')}" oninput="teamSetSearch('${tab}', this.value)" aria-label="${esc(placeholder)}"><i data-lucide="search"></i></div>`;
}
function teamFilterState(tab) { return state.ui.teamFilters[tab] || (state.ui.teamFilters[tab] = {}); }
function teamFilterCount(tab) { return Object.values(teamFilterState(tab)).reduce((n, a) => n + a.length, 0); }
function teamFilterGroups(tab) {
  const org = currentOrgId();
  const opt = (list, id, label) => list.map(x => [x[id], x[label]]);
  const productOpts = opt(teamOrgProducts(org), 'id', 'name');
  if (tab === 'members') return [
    { key: 'team', label: 'Team', options: [...opt(teamOrgTeams(org), 'id', 'name'), ['none', 'No team']] },
    { key: 'role', label: 'Assigned Role', options: opt(teamScopeRoles(), 'id', 'name') },
    { key: 'status', label: 'Status', options: [['active', 'Active'], ...(isAgency() ? [] : [['awaiting', 'Awaiting approval']]), ['pending', 'Pending Invite'], ['inactive', 'Inactive'], ['deactivated', 'Deactivated']] },
    { key: 'product', label: 'Product Access', options: productOpts }
  ];
  if (tab === 'teams') return [
    { key: 'status', label: 'Status', options: [['active', 'Active'], ['inactive', 'Inactive']] },
    { key: 'product', label: 'Product Access', options: productOpts }
  ];
  if (tab === 'roles') return [{ key: 'product', label: 'Product Access', options: productOpts }];
  if (tab === 'clients') {
    const inds = [...new Set(workspaces.map(w => w.industry).filter(Boolean))].sort();
    return [
      { key: 'status', label: 'Status', options: [['active', 'Active'], ['inactive', 'Inactive'], ['archived', 'Archived']] },
      { key: 'industry', label: 'Industry', options: inds.map(i => [i, i]) }
    ];
  }
  if (tab === 'agency') return [
    { key: 'role', label: 'Role', options: opt(teamScopeRoles('agency'), 'id', 'name') },
    { key: 'team', label: 'Team', options: opt(teamOrgTeams('agency'), 'id', 'name') }
  ];
  return [];
}
function teamFilterPanelHtml(tab) {
  const f = teamFilterState(tab);
  return `<div class="row-between team-filter-head"><span class="h-card">Filter</span><button type="button" class="t-link" onclick="teamFilterClear('${tab}')">Clear Filter</button></div>
    ${teamFilterGroups(tab).map(g => {
      const sel = f[g.key] || [];
      return `<div class="filter-group"><div class="filter-group-title">${esc(g.label)}</div><div class="filter-options team-filter-options">
        <label class="check"><input type="checkbox" ${sel.length ? '' : 'checked'} onchange="teamFilterToggle('${tab}','${g.key}','__all')">All</label>
        ${g.options.map(([v, l]) => `<label class="check"><input type="checkbox" ${sel.includes(v) ? 'checked' : ''} onchange="teamFilterToggle('${tab}','${g.key}','${q(v)}')">${esc(l)}</label>`).join('')}
      </div></div>`;
    }).join('')}`;
}
function teamFilterButton(tab) {
  const n = teamFilterCount(tab);
  return `<div class="menu-anchor">
    <button type="button" class="icon-btn" data-popover-trigger onclick="toggleMenu('team-filter-${tab}', event)" aria-label="Filter"><i data-lucide="list-filter"></i><span class="count" id="team-filter-count-${tab}" ${n ? '' : 'hidden'}>${n}</span></button>
    <div class="filter-panel" id="team-filter-${tab}" onclick="event.stopPropagation()">${teamFilterPanelHtml(tab)}</div></div>`;
}
function teamFilterToggle(tab, key, v) {
  const f = teamFilterState(tab);
  const sel = f[key] || (f[key] = []);
  if (v === '__all') f[key] = [];
  else if (sel.includes(v)) f[key] = sel.filter(x => x !== v);
  else sel.push(v);
  teamFilterChanged(tab);
}
function teamFilterClear(tab) { state.ui.teamFilters[tab] = {}; teamFilterChanged(tab); }
function teamFilterChanged(tab) {
  renderRegion(`team-filter-${tab}`, teamFilterPanelHtml(tab));
  const c = document.getElementById(`team-filter-count-${tab}`);
  const n = teamFilterCount(tab);
  if (c) { c.textContent = n; c.hidden = !n; }
  if (state.pagers[`team-${tab}`]) state.pagers[`team-${tab}`].page = 1;
  teamRefresh();
}
// accessors: { key: item => value | [values] }
function teamApplyFilters(list, tab, accessors) {
  const f = teamFilterState(tab);
  return list.filter(item => Object.entries(f).every(([k, sel]) => {
    if (!sel.length || !accessors[k]) return true;
    const v = accessors[k](item);
    return Array.isArray(v) ? v.some(x => sel.includes(x)) : sel.includes(v);
  }));
}
function teamCardHead(title, tab, button, searchPh) {
  return `<div class="team-card-head"><h2 class="team-card-title">${esc(title)}</h2>
    <div class="row team-card-tools">${tab ? teamSearchBox(tab, searchPh) : ''}${button || ''}${tab ? teamFilterButton(tab) : ''}</div></div>`;
}

// Searchable checkbox list (Invite: assigned workspaces, Create Team: add members, Assign Members, Add Member).
// The selection lives in state.ui[key]; itemsFn returns [{ id, label, sub, disabled, checked, tag }].
const teamChecklists = {};
function teamChecklist(key, itemsFn, placeholder) {
  teamChecklists[key] = { itemsFn, search: '' };
  return `<div class="team-checklist">
    <div class="row"><div class="search grow"><input class="input" placeholder="${esc(placeholder)}" oninput="teamChecklistSearch('${key}', this.value)" aria-label="${esc(placeholder)}"><i data-lucide="search"></i></div>
      <span class="team-selected-count" id="team-cl-${key}-count">${(state.ui[key] || []).length} Selected</span></div>
    <div class="team-checklist-list" id="team-cl-${key}">${teamChecklistItems(key)}</div></div>`;
}
function teamChecklistItems(key) {
  const c = teamChecklists[key];
  const sel = state.ui[key] || [];
  const s = c.search.trim().toLowerCase();
  const items = c.itemsFn().filter(i => !s || `${i.label} ${i.sub || ''}`.toLowerCase().includes(s));
  if (!items.length) return `<div class="team-checklist-empty">${s ? 'No matches found.' : 'Nothing to select.'}</div>`;
  return items.map(i => `<label class="team-check-row ${i.disabled ? 'disabled' : ''}">
      <input type="checkbox" ${(i.checked ?? sel.includes(i.id)) ? 'checked' : ''} ${i.disabled ? 'disabled' : ''} onchange="teamChecklistToggle('${key}','${q(i.id)}', this.checked)">
      <span class="grow"><span class="team-check-label">${esc(i.label)}</span>${i.sub ? `<span class="cell-sub">${esc(i.sub)}</span>` : ''}</span>${i.tag || ''}</label>`).join('');
}
function teamChecklistSearch(key, v) { teamChecklists[key].search = v; renderRegion(`team-cl-${key}`, teamChecklistItems(key)); }
function teamChecklistToggle(key, id, on) {
  const sel = state.ui[key] || (state.ui[key] = []);
  state.ui[key] = on ? [...new Set([...sel, id])] : sel.filter(x => x !== id);
  const c = document.getElementById(`team-cl-${key}-count`);
  if (c) c.textContent = `${state.ui[key].length} Selected`;
  if (key === 'teamFormAssign') renderRegion('team-assign-chips', teamAssignChips());
}

function teamFieldError(id, msg) {
  const input = document.getElementById(id);
  const err = document.getElementById(`${id}-err`);
  if (input) input.classList.toggle('invalid', !!msg);
  if (err) err.textContent = msg || '';
  if (msg && input) input.focus();
  return !msg;
}
function teamField(label, inner, { req, id, hint } = {}) {
  return `<div class="field"><label class="field-label" ${id ? `for="${id}"` : ''}>${esc(label)}${req ? '<span class="req">*</span>' : ''}</label>${inner}
    ${id ? `<div class="field-error" id="${id}-err"></div>` : ''}${hint ? `<div class="field-hint">${hint}</div>` : ''}</div>`;
}

// ---------- Screen ----------
function teamRender() {
  if (teamEditing()) return teamRenderRoleEditor();
  const tab = teamTab();
  const tabs = teamTabs().map(t => `<button type="button" role="tab" aria-selected="${t.id === tab}" class="page-tab ${t.id === tab ? 'active' : ''}" onclick="teamGoTab('${t.id}')"><i data-lucide="${t.icon}"></i>${esc(t.label)}</button>`).join('');
  return `<div class="team-page">
    ${isAgency() ? '' : teamSeatCard()}
    <div class="page-tabs team-tabs" role="tablist">${tabs}</div>
    ${teamTabBody(tab)}</div>`;
}
function teamTabBody(tab) {
  if (tab === 'members') return `<section class="card team-card">${teamCardHead('Members', 'members', `<button type="button" class="btn btn-primary" onclick="teamOpenMemberModal()"><i data-lucide="user-plus"></i>Invite Member</button>`)}<div id="team-region">${teamRegionHtml()}</div></section>`;
  if (tab === 'teams') return `<section class="card team-card">${teamCardHead('Team', 'teams', `<button type="button" class="btn btn-primary" onclick="teamOpenTeamModal()"><i data-lucide="user-plus"></i>Create Team</button>`)}<div id="team-region">${teamRegionHtml()}</div></section>`;
  if (tab === 'roles') return `<section class="card team-card">${teamCardHead('Roles & Permissions', 'roles', `<button type="button" class="btn btn-primary" onclick="teamOpenRoleEditor('new')"><i data-lucide="plus"></i>Create Role</button>`)}<div id="team-region">${teamRegionHtml()}</div></section>`;
  if (tab === 'clients') return `<section class="card team-card">${teamCardHead('Client Organisation', 'clients', `<button type="button" class="btn btn-primary" onclick="teamOpenAddOrg('new')"><i data-lucide="user-plus"></i>Add Organisation</button>`)}<div id="team-region">${teamRegionHtml()}</div></section>`;
  if (tab === 'agency') return teamAgencyTab();
  return '';
}
function teamRegionHtml() {
  const tab = teamTab();
  return { members: teamMembersTable, teams: teamTeamsTable, roles: teamRolesTable, clients: teamClientsGrid, agency: teamAgencyTable }[tab]();
}
function teamRefresh() {
  if (teamEditing()) return;
  renderRegion('team-region', teamRegionHtml());
}
function teamTable(table, head, rows, total, emptyHtml) {
  return `<div class="table-wrap team-table-wrap"><table class="table team-table"><thead><tr>${head}</tr></thead>
    <tbody>${rows || `<tr><td class="table-empty" colspan="12">${emptyHtml}</td></tr>`}</tbody></table></div>
    ${paginationBar(table, total, 'teamRefresh')}`;
}

// ---------- Seat usage (client workspace, Figma "Agency" frame) ----------
function teamSeatCard() {
  const ws = currentWs();
  const list = teamOrgMembers(ws.id);
  const active = list.filter(m => m.status === 'active').length;
  const pending = list.filter(m => m.status === 'pending').length;
  const inactive = list.filter(m => m.status === 'inactive' || m.status === 'deactivated').length;
  const awaiting = list.filter(m => m.status === 'awaiting').length;   // CRM contacts not invited yet: no seat until approved
  const used = active + pending + inactive;
  const pct = Math.min(100, Math.round(used / TEAM_SEATS_TOTAL * 100));
  return `<section class="card team-seat-card" aria-label="Seat usage">
    <div class="row-between"><h2 class="team-seat-name">${esc(ws.name)}</h2><div class="team-seat-count">${used} / ${TEAM_SEATS_TOTAL} Seats Used</div></div>
    <div class="progress team-seat-bar" role="progressbar" aria-valuenow="${used}" aria-valuemin="0" aria-valuemax="${TEAM_SEATS_TOTAL}"><span style="width:${pct}%"></span></div>
    <div class="legend team-seat-legend">
      <span><span class="dot dot-green-strong"></span>${active} Active Member${active === 1 ? '' : 's'}</span>
      <span><span class="dot team-dot-link"></span>${pending} Pending Invite${pending === 1 ? '' : 's'}</span>
      <span><span class="dot dot-grey"></span>${inactive} Inactive Member${inactive === 1 ? '' : 's'}</span>
      ${awaiting ? `<span><span class="dot dot-orange"></span>${awaiting} Awaiting approval (no seat until invited)</span>` : ''}
    </div></section>`;
}

// ---------- Members ----------
function teamMembersList() {
  if (state.flags.teamEmpty.members) return [];
  let list = teamOrgMembers();
  const s = (state.ui.teamSearch.members || '').trim().toLowerCase();
  if (s) list = list.filter(m => `${m.name} ${m.email}`.toLowerCase().includes(s));
  list = teamApplyFilters(list, 'members', { team: m => m.teamId || 'none', role: m => m.roleId, status: m => m.status, product: m => m.products || [] });
  return applySort(list, 'team-members', {
    name: m => m.name.toLowerCase(), team: m => teamById(m.teamId)?.name || '~', role: m => roleById(m.roleId)?.name || '~',
    status: m => m.status, products: m => (m.products || []).length, ws: m => (m.workspaces || []).includes('*') ? 999 : (m.workspaces || []).length
  });
}
function teamWsSummary(m) {
  const ids = m.workspaces || [];
  if (ids.includes('*')) return '<span class="team-ws-all">All workspaces</span>';
  const names = ids.map(wsById).filter(w => w && !w.archived).map(w => w.name);
  if (!names.length) return '<span class="t-muted"><em>Unassigned</em></span>';
  const more = names.length > 2 ? ` <span class="t-muted" title="${esc(names.slice(2).join(', '))}">+${names.length - 2} more</span>` : '';
  return `<span class="team-ws-names">${esc(names.slice(0, 2).join(', '))}</span>${more}`;
}
function teamMembersTable() {
  const T = 'team-members';
  const all = teamMembersList();
  const page = paginate(all, T);
  const agency = isAgency();
  const head = `<th>${sortHeader(T, 'name', 'Name & Email', 'teamRefresh')}</th><th>${sortHeader(T, 'team', 'Team', 'teamRefresh')}</th>
    <th>${sortHeader(T, 'role', 'Assigned Role', 'teamRefresh')}</th><th>${sortHeader(T, 'status', 'Status', 'teamRefresh')}</th>
    ${agency ? `<th>${sortHeader(T, 'ws', 'Assigned Workspaces', 'teamRefresh')}</th>` : ''}
    <th>${sortHeader(T, 'products', 'Product Access', 'teamRefresh')}</th><th>Activity</th><th class="team-th-action">Action</th>`;
  const rows = page.map(m => {
    const self = m.id === CURRENT_USER_ID;
    const items = [{ label: 'Edit', icon: 'pencil', onClick: `teamOpenMemberModal('${m.id}')` }];
    // Agency CRM contacts wait for the account manager's approval before they are invited (crm.js).
    if (m.status === 'awaiting') items.push({ label: 'Approve & send invite', icon: 'send', onClick: `crmApproveContact('${m.id}')` });
    if (m.status === 'pending') items.push({ label: 'Resend Invite', icon: 'send', onClick: `teamResendInvite('${m.id}')` });
    if (m.status !== 'awaiting') items.push(m.status === 'deactivated'
      ? { label: 'Reactivate', icon: 'user-check', onClick: `teamReactivateMember('${m.id}')` }
      : { label: 'Deactivate', icon: 'user-x', onClick: `teamConfirmDeactivate('${m.id}')`, disabled: self });
    items.push('sep', { label: self ? 'Remove (you)' : 'Remove', icon: 'trash-2', danger: true, disabled: self, onClick: `teamConfirmRemove('${m.id}')` });
    const role = roleById(m.roleId);
    return `<tr class="${m.status === 'deactivated' ? 'team-row-muted' : ''}">
      <td><div class="team-name">${esc(m.name)}${m.isPrimary && !agency ? '<span class="team-primary-badge" title="Primary Contact for this workspace"><i data-lucide="star"></i>Primary Contact</span>' : ''}${self ? '<span class="chip team-you">You</span>' : ''}</div><div class="cell-sub">${esc(m.email)}</div></td>
      <td>${esc(teamById(m.teamId)?.name || '—')}</td>
      <td>${esc(role?.name || '—')}${!agency && m.canManage ? '<div class="cell-sub">Can manage members</div>' : ''}</td>
      <td>${statusDot(m.status)}${m.status === 'awaiting' ? '<div class="cell-sub">From agency CRM · not invited yet</div>' : ''}</td>
      ${agency ? `<td class="team-ws-cell">${teamWsSummary(m)}</td>` : ''}
      <td>${productChips(m.products)}</td>
      <td>${esc(m.lastActive || '-')}<div class="cell-sub">${esc(m.lastProduct || '-')}</div></td>
      <td class="team-td-action">${rowMenu(`team-m-${m.id}`, items)}</td></tr>`;
  }).join('');
  const filtered = (state.ui.teamSearch.members || '').trim() || teamFilterCount('members');
  const empty = filtered && !state.flags.teamEmpty.members
    ? emptyState('search-x', 'No members match your search or filters', 'Try a different name or clear the filters.')
    : emptyState('users', 'No members yet', 'Invite your first team member to get started.');
  return teamTable(T, head, rows, all.length, empty);
}

function teamResendInvite(id) { const m = memberById(id); if (m) showToast(`Invitation resent to ${m.email}`, 'send'); }
function teamReactivateMember(id) {
  const m = memberById(id);
  if (!m) return;
  m.status = 'active';
  teamRefresh();
  showToast(`${m.name} has been reactivated`, 'user-check');
}
function teamConfirmDeactivate(id) {
  const m = memberById(id);
  if (!m) return;
  if (id === CURRENT_USER_ID) { showToast('You can’t deactivate your own account', 'triangle-alert'); return; }
  confirmDialog({
    title: 'Deactivate Team Member?',
    text: `This member will no longer have access to your organisation. You can reactivate them at any time.${m.isPrimary ? ' They are the Primary Contact, so this workspace will have no Primary Contact until you set another.' : ''}`,
    confirmLabel: 'Deactivate', icon: 'user-x',
    onConfirm: () => { m.status = 'deactivated'; teamRefresh(); showToast(`${m.name} has been deactivated`, 'user-x'); }
  });
}
function teamConfirmRemove(id) {
  const m = memberById(id);
  if (!m) return;
  if (id === CURRENT_USER_ID) { showToast('You can’t remove yourself from the organisation', 'triangle-alert'); return; }
  confirmDialog({
    title: 'Remove Team Member?',
    text: 'This will permanently remove the member from your organisation and revoke their access. This action cannot be undone.',
    confirmLabel: 'Remove', danger: true, icon: 'trash-2',
    onConfirm: () => {
      const i = members.indexOf(m);
      if (i >= 0) members.splice(i, 1);
      if (!isAgency()) rerender(); else teamRefresh();   // client: seat card counts change too
      showToast(`${m.name} has been removed`, 'trash-2');
    }
  });
}

// Invite / Edit member (Figma "Invite Team Member" / "Edit Team Member"; V1 quick invite, Manage User Access, client user modal).
function teamOpenMemberModal(id) {
  const m = id ? memberById(id) : null;
  const agency = isAgency();
  const org = currentOrgId();
  const lowest = teamLowestRole(teamScope());
  const roleId = m ? m.roleId : lowest?.id;
  const ws = m?.workspaces || [];
  state.ui.teamFormWs = ws.includes('*') ? activeWorkspaces().map(w => w.id) : ws.filter(x => wsById(x));
  const teamOpts = `<option value="">No team</option>${teamOrgTeams(org).map(t => `<option value="${t.id}" ${m?.teamId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}`;
  const roleOpts = teamScopeRoles().map(r => `<option value="${r.id}" ${r.id === roleId ? 'selected' : ''}>${esc(r.name)}${r.locked ? ' (system)' : ''}</option>`).join('');
  const locked = !!roleById(roleId)?.locked;
  const other = !agency ? wsPrimaryContact(org) : null;
  const primaryHint = other && other.id !== m?.id
    ? `Only 1 Primary Contact per workspace. Currently: ${esc(other.email)}. Turning this on switches it.`
    : 'Only 1 Primary Contact per workspace.';
  const body = `
    ${teamField('Member Email', `<input class="input" id="team-f-email" type="email" placeholder="name@example.com" value="${esc(m?.email || '')}" ${m ? 'disabled' : ''} autocomplete="off">`, { req: true, id: 'team-f-email' })}
    <div class="grid-2 team-form-2">
      ${teamField('Team', `<select class="select" id="team-f-team">${teamOpts}</select>`)}
      ${teamField('Role', `<select class="select" id="team-f-role" onchange="teamFormRoleChange()">${roleOpts}</select>`)}
    </div>
    ${agency ? `<div class="field">
        <span class="field-label">Assigned Workspaces</span>
        <div class="banner banner-info team-all-ws" id="team-f-allws" ${locked ? '' : 'hidden'}><i data-lucide="info"></i><span class="banner-text">This system role has access to every client workspace, including new ones.</span></div>
        <div id="team-f-wslist" ${locked ? 'hidden' : ''}>${teamChecklist('teamFormWs', () => activeWorkspaces().map(w => ({ id: w.id, label: w.name, sub: w.industry })), 'Search workspaces')}</div>
        <div class="field-hint">Assigned workspaces decide which clients appear in this member’s workspace switcher.</div>
      </div>` : `
      <div class="team-toggle-row"><div><div class="t-bold">Manage members</div><div class="field-hint">View workspace analytics is always on. Turn this on to let them invite and edit members.</div></div>
        <label class="toggle"><input type="checkbox" id="team-f-manage" ${m?.canManage ? 'checked' : ''}><span></span></label></div>
      <div class="team-toggle-row"><div><div class="t-bold">Set as Primary Contact</div><div class="field-hint">${primaryHint}</div></div>
        <label class="toggle"><input type="checkbox" id="team-f-primary" ${m?.isPrimary ? 'checked' : ''}><span></span></label></div>`}`;
  openModal({
    title: m ? 'Edit Team Member' : 'Invite Team Member',
    desc: m ? 'Update their team, role and access settings.' : 'Invite a team member and assign their team and role.',
    body,
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: m ? 'Save Changes' : 'Send Invite', kind: 'primary', onClick: () => teamSaveMember(id) }]
  });
}
function teamFormRoleChange() {
  const locked = !!roleById(document.getElementById('team-f-role').value)?.locked;
  const all = document.getElementById('team-f-allws');
  const list = document.getElementById('team-f-wslist');
  if (all) all.hidden = !locked;
  if (list) list.hidden = locked;
}
function teamSaveMember(id) {
  const org = currentOrgId();
  const agency = isAgency();
  const existing = id ? memberById(id) : null;
  const email = document.getElementById('team-f-email').value.trim();
  if (!existing) {
    if (!email) return teamFieldError('team-f-email', 'Member email is required.');
    if (!isEmail(email)) return teamFieldError('team-f-email', 'Enter a valid email address, e.g. name@example.com.');
    if (members.some(x => x.org === org && x.email.toLowerCase() === email.toLowerCase())) return teamFieldError('team-f-email', 'This email already belongs to a member of this organisation.');
  }
  const teamId = document.getElementById('team-f-team').value || null;
  const roleId = document.getElementById('team-f-role').value;
  const team = teamById(teamId);
  const m = existing || { id: uid('m'), org, name: teamNameFromEmail(email), email, status: 'pending', lastActive: null, lastProduct: null, products: [] };
  if (!existing || existing.teamId !== teamId) m.products = team ? [...team.products] : (existing ? m.products : []);
  m.teamId = teamId;
  m.roleId = roleId;
  if (agency) m.workspaces = roleById(roleId)?.locked ? ['*'] : [...(state.ui.teamFormWs || [])];
  else {
    m.canManage = document.getElementById('team-f-manage').checked;
    const primary = document.getElementById('team-f-primary').checked;
    // V1 strict single Primary Contact: setting one clears every other primary in this workspace.
    if (primary) members.forEach(x => { if (x.org === org) x.isPrimary = false; });
    m.isPrimary = primary;
  }
  if (!existing) members.push(m);
  if (!agency) rerender(); else teamRefresh();
  showToast(existing ? `Access updated for ${m.name}` : `Invitation sent to ${email}`, existing ? 'check-circle' : 'send');
}

// ---------- Teams ----------
function teamTeamsList() {
  if (state.flags.teamEmpty.teams) return [];
  let list = teamOrgTeams();
  const s = (state.ui.teamSearch.teams || '').trim().toLowerCase();
  if (s) list = list.filter(t => t.name.toLowerCase().includes(s));
  list = teamApplyFilters(list, 'teams', { status: t => t.status, product: t => t.products });
  return applySort(list, 'team-teams', { name: t => t.name.toLowerCase(), members: t => teamTeamMembers(t.id).length, status: t => t.status, products: t => t.products.length, created: t => t.createdAt });
}
function teamTeamMembers(teamId) { return members.filter(m => m.teamId === teamId); }
function teamTeamsTable() {
  const T = 'team-teams';
  const all = teamTeamsList();
  const head = `<th>${sortHeader(T, 'name', 'Team', 'teamRefresh')}</th><th>${sortHeader(T, 'members', 'Members', 'teamRefresh')}</th><th>${sortHeader(T, 'status', 'Status', 'teamRefresh')}</th>
    <th>${sortHeader(T, 'products', 'Product Access', 'teamRefresh')}</th><th>${sortHeader(T, 'created', 'Created', 'teamRefresh')}</th><th class="team-th-action">Action</th>`;
  const rows = paginate(all, T).map(t => `<tr>
      <td><button type="button" class="team-link-cell" onclick="teamOpenTeamMembers('${t.id}')">${esc(t.name)}</button></td>
      <td>${teamTeamMembers(t.id).length}</td><td>${statusDot(t.status)}</td><td>${productChips(t.products)}</td><td>${fmtDate(t.createdAt)}</td>
      <td class="team-td-action">${rowMenu(`team-t-${t.id}`, [
        { label: 'View Members', icon: 'users', onClick: `teamOpenTeamMembers('${t.id}')` },
        { label: 'Edit', icon: 'pencil', onClick: `teamOpenTeamModal('${t.id}')` },
        { label: 'Duplicate', icon: 'copy', onClick: `teamConfirmDuplicateTeam('${t.id}')` },
        'sep', { label: 'Delete', icon: 'trash-2', danger: true, onClick: `teamConfirmDeleteTeam('${t.id}')` }])}</td></tr>`).join('');
  const filtered = (state.ui.teamSearch.teams || '').trim() || teamFilterCount('teams');
  const empty = filtered && !state.flags.teamEmpty.teams
    ? emptyState('search-x', 'No teams match your search or filters', 'Try a different name or clear the filters.')
    : emptyState('users-round', 'No teams yet', 'Create a team to group members and give them product access together.');
  return teamTable(T, head, rows, all.length, empty);
}
function teamProductPicker() {
  const sel = state.ui.teamFormProducts || [];
  return teamOrgProducts().map(p => {
    const on = sel.includes(p.id);
    return `<button type="button" class="team-chip-opt ${on ? 'on' : ''}" aria-pressed="${on}" onclick="teamToggleFormProduct('${p.id}')">${on ? '<i data-lucide="check"></i>' : '<i data-lucide="plus"></i>'}${esc(p.name)}</button>`;
  }).join('');
}
function teamToggleFormProduct(pid) {
  const sel = state.ui.teamFormProducts || [];
  state.ui.teamFormProducts = sel.includes(pid) ? sel.filter(x => x !== pid) : [...sel, pid];
  renderRegion('team-f-products', teamProductPicker());
}
function teamMemberItems(excludeTeamId) {
  return teamOrgMembers().filter(m => !excludeTeamId || m.teamId !== excludeTeamId).map(m => ({
    id: m.id, label: m.name, sub: `${m.email}${m.teamId ? ` · currently in ${teamById(m.teamId)?.name || '—'}` : ''}`
  }));
}
function teamOpenTeamModal(id) {
  const t = id ? teamById(id) : null;
  state.ui.teamFormProducts = t ? [...t.products] : [];
  state.ui.teamFormMembers = [];
  const body = `
    ${teamField('Team Name', `<input class="input" id="team-f-tname" placeholder="e.g. Marketing" value="${esc(t?.name || '')}" autocomplete="off">`, { req: true, id: 'team-f-tname' })}
    <div class="field"><span class="field-label">Product Access</span><div class="team-chip-select" id="team-f-products">${teamProductPicker()}</div>
      <div class="field-hint">Members of this team get access to the selected products.</div></div>
    ${t ? '' : `<div class="field"><span class="field-label">Add Members</span>${teamChecklist('teamFormMembers', () => teamMemberItems(), 'Search members')}
      <div class="field-hint">A member can belong to one team. Adding them here moves them from their current team.</div></div>`}`;
  openModal({
    title: t ? 'Edit Team' : 'Create Team',
    desc: t ? 'Update the team’s name and modify which product it can access.' : 'Create a team and define which products it can access.',
    body,
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: t ? 'Save Changes' : 'Create Team', kind: 'primary', onClick: () => teamSaveTeam(id) }]
  });
}
function teamSaveTeam(id) {
  const org = currentOrgId();
  const name = document.getElementById('team-f-tname').value.trim();
  if (!name) return teamFieldError('team-f-tname', 'Team name is required.');
  if (teamOrgTeams(org).some(t => t.id !== id && t.name.toLowerCase() === name.toLowerCase())) return teamFieldError('team-f-tname', 'A team with this name already exists.');
  const prods = [...(state.ui.teamFormProducts || [])];
  let t = id ? teamById(id) : null;
  if (t) { t.name = name; t.products = prods; }
  else { t = { id: uid('t'), org, name, status: 'active', products: prods, createdAt: teamToday() }; teams.push(t); }
  (state.ui.teamFormMembers || []).forEach(mid => { const m = memberById(mid); if (m) m.teamId = t.id; });
  // Product access follows the team.
  teamTeamMembers(t.id).forEach(m => { m.products = [...prods]; });
  teamRefresh();
  showToast(id ? `Team “${name}” updated` : `Team “${name}” created`);
}
function teamCopyName(name, list) {
  let n = `${name} (Copy)`, i = 2;
  while (list.some(x => x.name.toLowerCase() === n.toLowerCase())) n = `${name} (Copy ${i++})`;
  return n;
}
function teamConfirmDuplicateTeam(id) {
  const t = teamById(id);
  if (!t) return;
  confirmDialog({
    title: 'Duplicate Team Settings?',
    text: 'This will create a new team using the same team configuration and product access. Team members will not be copied over.',
    confirmLabel: 'Duplicate', icon: 'copy',
    onConfirm: () => {
      const copy = { id: uid('t'), org: t.org, name: teamCopyName(t.name, teamOrgTeams(t.org)), status: 'active', products: [...t.products], createdAt: teamToday() };
      teams.push(copy);
      teamRefresh();
      showToast(`“${copy.name}” created`, 'copy');
    }
  });
}
function teamConfirmDeleteTeam(id) {
  const t = teamById(id);
  if (!t) return;
  confirmDialog({
    title: 'Delete Team?',
    text: 'This will permanently delete the team and its product access settings. Team members will be removed from the team but will remain in your organisation. This action cannot be undone.',
    confirmLabel: 'Delete', danger: true, icon: 'trash-2',
    onConfirm: () => {
      members.forEach(m => { if (m.teamId === id) m.teamId = null; });
      teams.splice(teams.indexOf(t), 1);
      teamRefresh();
      showToast(`Team “${t.name}” deleted`, 'trash-2');
    }
  });
}
function teamOpenTeamMembers(id) {
  const t = teamById(id);
  if (!t) return;
  const list = teamTeamMembers(id);
  const rows = list.map(m => `<tr><td><div class="team-name">${esc(m.name)}</div><div class="cell-sub">${esc(m.email)}</div></td><td>${esc(roleById(m.roleId)?.name || '—')}</td>
      <td class="team-td-action"><button type="button" class="kebab" aria-label="Remove ${esc(m.name)} from team" title="Remove from team" onclick="teamConfirmRemoveFromTeam('${t.id}','${m.id}')"><i data-lucide="user-minus"></i></button></td></tr>`).join('');
  openModal({
    title: `${t.name} Team`,
    desc: 'View members assigned to this team.',
    size: 'lg',
    body: `<div class="table-wrap team-table-wrap"><table class="table team-table"><thead><tr><th>Name & Email</th><th>Role</th><th class="team-th-action">Remove</th></tr></thead>
      <tbody>${rows || `<tr><td class="table-empty" colspan="3">${emptyState('users', 'No members in this team', 'Add members to give them this team’s product access.')}</td></tr>`}</tbody></table></div>`,
    actions: [{ label: 'Close', kind: 'outline' }, { label: 'Add Member', kind: 'primary', icon: 'user-plus', onClick: () => { teamOpenAddMembers(id); return false; } }]
  });
}
function teamOpenAddMembers(id) {
  const t = teamById(id);
  state.ui.teamFormMembers = [];
  openModal({
    title: `${t.name} Team`,
    desc: 'Select the member(s) you wish to add to the team.',
    body: teamChecklist('teamFormMembers', () => teamMemberItems(id), 'Search members'),
    actions: [{ label: 'Back', kind: 'outline', onClick: () => { teamOpenTeamMembers(id); return false; } },
      { label: 'Add Member', kind: 'primary', onClick: () => {
        const ids = state.ui.teamFormMembers || [];
        if (!ids.length) { showToast('Select at least one member', 'triangle-alert'); return false; }
        ids.forEach(mid => { const m = memberById(mid); if (m) { m.teamId = id; m.products = [...t.products]; } });
        teamRefresh();
        showToast(`${ids.length} member${ids.length === 1 ? '' : 's'} added to ${t.name}`, 'user-plus');
        teamOpenTeamMembers(id);
        return false;
      } }]
  });
}
function teamConfirmRemoveFromTeam(teamId, memberId) {
  const m = memberById(memberId);
  confirmDialog({
    title: 'Remove Member from Team?',
    text: 'This will remove the member from the current team. This action cannot be undone.',
    confirmLabel: 'Remove', danger: true, icon: 'user-minus',
    onConfirm: () => {
      m.teamId = null;
      teamRefresh();
      showToast(`${m.name} removed from the team`, 'user-minus');
      teamOpenTeamMembers(teamId);
      return false;
    }
  });
}

// ---------- Roles & Permissions ----------
function teamRoleMembers(roleId, org = currentOrgId()) { return members.filter(m => m.org === org && m.roleId === roleId); }
function teamRoleProducts(roleId) { return [...new Set(teamRoleMembers(roleId).flatMap(m => m.products || []))]; }
function teamRolesList() {
  if (state.flags.teamEmpty.roles) return [];
  let list = teamScopeRoles();
  const s = (state.ui.teamSearch.roles || '').trim().toLowerCase();
  if (s) list = list.filter(r => `${r.name} ${r.description}`.toLowerCase().includes(s));
  list = teamApplyFilters(list, 'roles', { product: r => teamRoleProducts(r.id) });
  return applySort(list, 'team-roles', { name: r => r.name.toLowerCase(), members: r => teamRoleMembers(r.id).length, products: r => teamRoleProducts(r.id).length, created: r => r.createdAt });
}
function teamRolesTable() {
  const T = 'team-roles';
  const all = teamRolesList();
  const head = `<th>${sortHeader(T, 'name', 'Role', 'teamRefresh')}</th><th>Description</th><th>${sortHeader(T, 'members', 'Members', 'teamRefresh')}</th>
    <th>${sortHeader(T, 'products', 'Product Access', 'teamRefresh')}</th><th>${sortHeader(T, 'created', 'Created', 'teamRefresh')}</th><th class="team-th-action">Action</th>`;
  const rows = paginate(all, T).map(r => `<tr>
      <td><button type="button" class="team-link-cell" onclick="teamOpenRoleEditor('${r.id}')">${esc(r.name)}</button>${r.locked ? '<span class="team-lock" title="System role — view only"><i data-lucide="lock"></i></span>' : ''}</td>
      <td class="t-secondary team-wrap">${esc(r.description || '—')}</td><td>${teamRoleMembers(r.id).length}</td><td>${productChips(teamRoleProducts(r.id))}</td><td>${fmtDate(r.createdAt)}</td>
      <td class="team-td-action">${rowMenu(`team-r-${r.id}`, [
        { label: r.locked ? 'View' : 'Edit', icon: r.locked ? 'eye' : 'pencil', onClick: `teamOpenRoleEditor('${r.id}')` },
        { label: 'Duplicate', icon: 'copy', onClick: `teamConfirmDuplicateRole('${r.id}')` },
        'sep', { label: r.locked ? 'Delete (system role)' : 'Delete', icon: 'trash-2', danger: !r.locked, disabled: r.locked, onClick: `teamConfirmDeleteRole('${r.id}')` }])}</td></tr>`).join('');
  const empty = emptyState('key-round', 'No roles match your search or filters', 'Try a different name or clear the filters.');
  return `${isAgency() ? '' : '<div class="team-note"><i data-lucide="info"></i>Client roles are shared by every client workspace. Member counts show this workspace only.</div>'}${teamTable(T, head, rows, all.length, empty)}`;
}
function teamConfirmDuplicateRole(id) {
  const r = roleById(id);
  if (!r) return;
  confirmDialog({
    title: 'Duplicate Role?',
    text: 'This will create a new role with the same permissions as the selected role. Team members assigned to the original role will not be copied.',
    confirmLabel: 'Duplicate', icon: 'copy',
    onConfirm: () => {
      const copy = { id: uid('r'), org: r.org, name: teamCopyName(r.name, teamScopeRoles(r.org)), description: r.description, locked: false,
        perms: r.perms.includes('*') ? teamAllPermIds(r.org) : [...r.perms], createdAt: teamToday() };
      roles.push(copy);
      teamRefresh();
      showToast(`“${copy.name}” created`, 'copy');
    }
  });
}
function teamConfirmDeleteRole(id) {
  const r = roleById(id);
  if (!r || r.locked) { showToast('System roles can’t be deleted', 'lock'); return; }
  const fallback = teamLowestRole(r.org, id);
  const affected = members.filter(m => m.roleId === id);
  const n = affected.length;
  confirmDialog({
    title: 'Delete Role?',
    text: `This will permanently delete the role and its permissions. ${n ? `${n} member${n === 1 ? '' : 's'} on this role ${r.org === 'client' ? 'across client workspaces ' : ''}will be moved to ${fallback?.name || 'no role'}.` : 'No members are assigned to this role.'} This action cannot be undone.`,
    confirmLabel: 'Delete', danger: true, icon: 'trash-2',
    onConfirm: () => {
      affected.forEach(m => { m.roleId = fallback?.id || null; });
      roles.splice(roles.indexOf(r), 1);
      teamRefresh();
      showToast(`Role “${r.name}” deleted${n ? ` · ${n} moved to ${fallback?.name}` : ''}`, 'trash-2');
    }
  });
}

// Role editor page (Figma "Create Role" / "Edit Role"; replaces V1's role modal).
function teamOpenRoleEditor(id) {
  state.ui.teamRoleDraft = null;
  navigate('team', { tab: 'roles', edit: id });
}
function teamCloseRoleEditor() {
  state.ui.teamRoleDraft = null;
  navigate('team', { tab: 'roles' });
}
function teamRoleDraft() {
  const scope = teamScope();
  const key = `${scope}:${state.params.edit}`;
  let d = state.ui.teamRoleDraft;
  if (!d || d.key !== key) {
    const r = state.params.edit === 'new' ? null : roleById(state.params.edit);
    d = state.ui.teamRoleDraft = {
      key, scope, roleId: r?.id || null, name: r?.name || '', description: r?.description || '', locked: !!r?.locked,
      perms: r ? (r.perms.includes('*') ? teamAllPermIds(scope) : [...r.perms]) : [], collapsed: {}, search: '', nav: teamPermGroups(scope)[0].id
    };
  }
  return d;
}
function teamPermMatches(p, s) { return !s || `${p.title} ${p.desc}`.toLowerCase().includes(s); }
function teamRoleNavHtml() {
  const d = teamRoleDraft();
  const s = d.search.trim().toLowerCase();
  const groups = teamPermGroups(d.scope).filter(g => g.subgroups.some(sg => sg.perms.some(p => teamPermMatches(p, s)) || g.name.toLowerCase().includes(s)));
  if (!groups.length) return '<div class="team-checklist-empty">No permissions match.</div>';
  return groups.map(g => {
    const ids = teamGroupPermIds(g);
    const on = ids.filter(x => d.perms.includes(x)).length;
    return `<button type="button" class="team-role-nav-item ${d.nav === g.id ? 'active' : ''}" onclick="teamRoleJump('${g.id}')"><span>${esc(g.name)}</span><span class="team-role-nav-count">${on}/${ids.length}</span></button>`;
  }).join('');
}
function teamRoleGroupsHtml() {
  const d = teamRoleDraft();
  const s = d.search.trim().toLowerCase();
  const ro = d.locked ? 'disabled' : '';
  const html = teamPermGroups(d.scope).map(g => {
    const groupHit = s && g.name.toLowerCase().includes(s);
    const subs = g.subgroups.map((sg, i) => ({ sg, i, perms: sg.perms.filter(p => groupHit || teamPermMatches(p, s)) })).filter(x => x.perms.length);
    if (!subs.length) return '';
    const total = teamGroupPermIds(g).length;
    const collapsed = !!d.collapsed[g.id] && !s;
    return `<section class="card team-perm-group" id="team-perm-${g.id}">
      <button type="button" class="team-perm-head" aria-expanded="${!collapsed}" onclick="teamRoleCollapse('${g.id}')">
        <span><span class="h-card">${esc(g.name)}</span><span class="card-sub">${esc(g.desc)}</span></span>
        <span class="team-perm-count">${total} permissions<i data-lucide="${collapsed ? 'chevron-down' : 'chevron-up'}"></i></span></button>
      ${collapsed ? '' : subs.map(({ sg, i, perms }) => {
        const all = sg.perms.every(p => d.perms.includes(p.id));
        return `<div class="team-perm-sub"><div class="team-perm-sub-head"><span class="t-bold">${esc(sg.name)}</span>
            <label class="check team-select-all"><input type="checkbox" ${all ? 'checked' : ''} ${ro} onchange="teamRoleSelectAll('${g.id}', ${i}, this.checked)">Select All</label></div>
          ${perms.map(p => `<label class="team-perm-row"><span class="grow"><span class="team-perm-title">${esc(p.title)}</span><span class="team-perm-desc">${esc(p.desc)}</span></span>
            <input type="checkbox" ${d.perms.includes(p.id) ? 'checked' : ''} ${ro} onchange="teamRoleToggle('${p.id}', this.checked)" aria-label="${esc(p.title)}"></label>`).join('')}</div>`;
      }).join('')}</section>`;
  }).join('');
  return html || `<div class="card">${emptyState('search-x', 'No permissions match your search', 'Try another word, such as “members” or “integrations”.')}</div>`;
}
function teamRoleRefresh() {
  renderRegion('team-role-nav-list', teamRoleNavHtml());
  renderRegion('team-role-groups', teamRoleGroupsHtml());
}
function teamRoleToggle(pid, on) {
  const d = teamRoleDraft();
  if (d.locked) return;
  d.perms = on ? [...new Set([...d.perms, pid])] : d.perms.filter(x => x !== pid);
  teamRoleRefresh();
}
function teamRoleSelectAll(gid, i, on) {
  const d = teamRoleDraft();
  if (d.locked) return;
  const ids = permissionCatalogue.find(g => g.id === gid).subgroups[i].perms.map(p => p.id);
  d.perms = on ? [...new Set([...d.perms, ...ids])] : d.perms.filter(x => !ids.includes(x));
  teamRoleRefresh();
}
function teamRoleCollapse(gid) { const d = teamRoleDraft(); d.collapsed[gid] = !d.collapsed[gid]; teamRoleRefresh(); }
function teamRoleSearch(v) { teamRoleDraft().search = v; teamRoleRefresh(); }
function teamRoleJump(gid) {
  const d = teamRoleDraft();
  d.nav = gid;
  d.collapsed[gid] = false;
  teamRoleRefresh();
  const el = document.getElementById(`team-perm-${gid}`);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' });
}
function teamRenderRoleEditor() {
  const d = teamRoleDraft();
  const ro = d.locked ? 'disabled' : '';
  const isNew = !d.roleId;
  return `<div class="team-role-editor">
    <button type="button" class="t-link team-back" onclick="teamCloseRoleEditor()"><i data-lucide="arrow-left"></i>Back to List</button>
    ${d.locked ? `<div class="banner banner-info team-role-banner"><i data-lucide="lock"></i><div><div class="banner-title">System role — view only</div><div class="banner-text">This is a system role and cannot be modified. It has every permission. Duplicate it from the list to make an editable copy.</div></div></div>` : ''}
    <div class="grid-2 team-role-fields">
      ${teamField('Role Name', `<input class="input" id="team-role-name" placeholder="e.g. Head of Department" value="${esc(d.name)}" oninput="teamRoleDraft().name = this.value" ${ro} autocomplete="off">`, { req: !d.locked, id: 'team-role-name' })}
      ${teamField('Description', `<input class="input" id="team-role-desc" placeholder="What this role is for" value="${esc(d.description)}" oninput="teamRoleDraft().description = this.value" ${ro} autocomplete="off">`)}
    </div>
    <div class="team-role-layout">
      <aside class="card team-role-nav" aria-label="Permission groups">
        <div class="h-card">Products</div>
        <div class="search"><input class="input" placeholder="Search" value="${esc(d.search)}" oninput="teamRoleSearch(this.value)" aria-label="Search permissions"><i data-lucide="search"></i></div>
        <div id="team-role-nav-list" class="team-role-nav-list">${teamRoleNavHtml()}</div>
      </aside>
      <div id="team-role-groups" class="team-role-groups">${teamRoleGroupsHtml()}</div>
    </div>
    <div class="team-role-footer">
      ${d.locked ? '<button type="button" class="btn btn-primary" onclick="teamCloseRoleEditor()">Back to List</button>'
        : `<button type="button" class="btn btn-outline" onclick="teamCloseRoleEditor()">Cancel</button>
           <button type="button" class="btn btn-primary" onclick="teamSaveRole()">${isNew ? '<i data-lucide="plus"></i>Create Role' : 'Save Changes'}</button>`}
    </div></div>`;
}
function teamSaveRole() {
  const d = teamRoleDraft();
  if (d.locked) return teamCloseRoleEditor();
  const name = d.name.trim();
  if (!name) { teamFieldError('team-role-name', 'Role name is required.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (teamScopeRoles(d.scope).some(r => r.id !== d.roleId && r.name.toLowerCase() === name.toLowerCase())) {
    teamFieldError('team-role-name', 'A role with this name already exists.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
  }
  if (d.roleId) {
    // Members reference roles by id, so a rename keeps every assignment (V1 propagated the new name by hand).
    const r = roleById(d.roleId);
    Object.assign(r, { name, description: d.description.trim(), perms: [...d.perms] });
    showToast(`Role “${name}” updated`);
  } else {
    roles.push({ id: uid('r'), org: d.scope, name, description: d.description.trim(), locked: false, perms: [...d.perms], createdAt: teamToday() });
    showToast(`Role “${name}” created`);
  }
  teamCloseRoleEditor();
}

// ---------- Client Organisation (agency only) ----------
function teamOrgStatus(ws) { return ws.archived ? 'archived' : ws.status === 'inactive' ? 'inactive' : 'active'; }
function teamClientsList() {
  if (state.flags.teamEmpty.clients) return [];
  const f = teamFilterState('clients');
  const showArchived = (f.status || []).includes('archived');
  let list = workspaces.filter(w => !w.archived || showArchived);
  const s = (state.ui.teamSearch.clients || '').trim().toLowerCase();
  if (s) list = list.filter(w => `${w.name} ${w.industry} ${wsPrimaryContact(w.id)?.name || ''}`.toLowerCase().includes(s));
  list = teamApplyFilters(list, 'clients', { status: teamOrgStatus, industry: w => w.industry });
  return [...list].sort((a, b) => a.archived - b.archived || a.name.localeCompare(b.name));
}
function teamClientsGrid() {
  const list = teamClientsList();
  if (!list.length) {
    const filtered = (state.ui.teamSearch.clients || '').trim() || teamFilterCount('clients');
    return filtered && !state.flags.teamEmpty.clients
      ? emptyState('search-x', 'No organisations match your search or filters', 'Try a different name or clear the filters.')
      : `${emptyState('building-2', 'No client organisations yet', 'Add an organisation to create its client workspace.')}<div class="team-center"><button type="button" class="btn btn-primary" onclick="teamOpenAddOrg('new')"><i data-lucide="user-plus"></i>Add Organisation</button></div>`;
  }
  return `<div class="team-org-grid">${list.map(teamOrgCard).join('')}</div>`;
}
function teamOrgCard(ws) {
  const pc = wsPrimaryContact(ws.id);
  const clientCount = teamOrgMembers(ws.id).filter(m => m.status !== 'deactivated').length;
  const agencyCount = teamWsAgencyMembers(ws.id).length;
  // Agency CRM auto set-up (crm.js): badge, progress while incomplete, and the checklist.
  const hasSetup = typeof crmSetups !== 'undefined' && !!crmSetups[ws.id];
  const prog = hasSetup ? crmSetupProgress(ws.id) : null;
  const items = ws.archived
    ? [{ label: 'Restore', icon: 'archive-restore', onClick: `teamRestoreOrg('${ws.id}')` }]
    : [{ label: 'Open Workspace', icon: 'external-link', onClick: `openWorkspace('${ws.id}')` },
       ...(hasSetup ? [{ label: 'View set-up', icon: 'list-checks', onClick: `crmOpenSetup('${ws.id}')` }] : []),
       { label: 'Assign Members', icon: 'user-plus', onClick: `teamOpenAssignMembers('${ws.id}')` },
       'sep', { label: 'Archive', icon: 'archive', danger: true, onClick: `teamConfirmArchive('${ws.id}')` }];
  const setupHtml = prog && prog.done < prog.total && !ws.archived
    ? `<button type="button" class="team-org-setup" onclick="crmOpenSetup('${ws.id}')" aria-label="View set-up checklist for ${esc(ws.name)}">
        <span class="row-between"><span>Set-up: ${prog.done} of ${prog.total} steps</span><span class="t-link">View set-up</span></span>
        <span class="progress team-org-setup-bar"><span style="width:${Math.round(prog.done / prog.total * 100)}%"></span></span></button>` : '';
  return `<article class="team-org-card ${ws.archived ? 'archived' : ''}">
    <div class="team-org-top">
      <span class="team-org-logo">${esc(initials(ws.name))}</span>
      <button type="button" class="team-org-name" ${ws.archived ? 'disabled' : `onclick="openWorkspace('${ws.id}')"`} title="${ws.archived ? 'Archived' : 'Open workspace'}">${esc(ws.name)}</button>
      ${statusDot(teamOrgStatus(ws))}
      ${rowMenu(`team-o-${ws.id}`, items)}
    </div>
    <div class="team-org-line"><i data-lucide="briefcase"></i>${esc(ws.industry || '—')}${ws.source === 'crm' ? '<span class="crm-badge team-org-crm" title="Created automatically when the account converted in the agency CRM"><i data-lucide="sparkles"></i>From CRM</span>' : ''}</div>
    ${setupHtml}
    <div class="team-org-contact"><span class="team-org-avatar"><i data-lucide="user"></i></span>
      <span>${pc ? `<span class="team-org-contact-name">${esc(pc.name)}</span><span class="cell-sub">${esc(pc.email)}</span>` : '<span class="team-org-contact-name t-muted">Unassigned</span><span class="cell-sub">No Primary Contact</span>'}</span></div>
    <div class="team-org-stats">
      <div><div class="team-org-stat"><i data-lucide="users"></i>${clientCount}</div><div class="cell-sub">Client Members</div></div>
      <div><div class="team-org-stat"><i data-lucide="users"></i>${agencyCount}</div><div class="cell-sub">Agency Members</div></div>
    </div></article>`;
}

// Add Organisation (Figma New / Existing; V1 create workspace + duplicate-name rule).
function teamOpenAddOrg(mode) {
  state.ui.teamOrgMode = mode;
  const seg = `<div class="seg seg-block team-org-seg" role="tablist">
      <button type="button" class="${mode === 'new' ? 'active' : ''}" onclick="teamOpenAddOrg('new')">New Organisation</button>
      <button type="button" class="${mode === 'existing' ? 'active' : ''}" onclick="teamOpenAddOrg('existing')">Existing Organisation</button></div>`;
  if (mode === 'new') {
    const inds = [...new Set([...TEAM_INDUSTRIES, ...workspaces.map(w => w.industry).filter(Boolean)])].sort();
    openModal({
      title: 'Add Organisation',
      desc: 'Create a new client workspace or select an existing organisation and enter their website and industry information.',
      body: `${seg}
        ${teamField('Organisation Name', `<input class="input" id="team-f-org" placeholder="e.g. Visual Studio" oninput="teamOrgNameCheck()" autocomplete="off">`, { req: true, id: 'team-f-org' })}
        ${teamField('Site URL', '<input class="input" id="team-f-site" placeholder="e.g. visualstudio.example.com" autocomplete="off">')}
        ${teamField('Industry', `<select class="select" id="team-f-ind"><option value="">Select industry</option>${inds.map(i => `<option>${esc(i)}</option>`).join('')}</select>`)}`,
      actions: [{ label: 'Cancel', kind: 'outline' }, { label: 'Create Organisation', kind: 'primary', onClick: teamCreateOrg }]
    });
    return;
  }
  state.ui.teamOrgPick = null;
  state.ui.teamOrgPickSearch = '';
  openModal({
    title: 'Add Organisation',
    desc: 'Select an existing organisation to open it, or restore it if it was archived.',
    body: `${seg}
      <div class="field"><label class="field-label" for="team-f-pick">Organisation<span class="req">*</span></label>
        <div class="search"><input class="input" id="team-f-pick" placeholder="Search organisations" oninput="state.ui.teamOrgPickSearch = this.value; renderRegion('team-org-pick', teamOrgPickHtml())" autocomplete="off"><i data-lucide="search"></i></div>
        <div class="team-checklist-list" id="team-org-pick" role="listbox">${teamOrgPickHtml()}</div>
        <div class="field-error" id="team-f-pick-err"></div></div>`,
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: 'Continue', kind: 'primary', onClick: teamUseExistingOrg }]
  });
}
function teamOrgPickHtml() {
  const s = (state.ui.teamOrgPickSearch || '').trim().toLowerCase();
  const list = [...workspaces].sort((a, b) => b.archived - a.archived || a.name.localeCompare(b.name)).filter(w => !s || w.name.toLowerCase().includes(s));
  if (!list.length) return '<div class="team-checklist-empty">No organisation found. Use “New Organisation” to create it.</div>';
  return list.map(w => `<button type="button" role="option" aria-selected="${state.ui.teamOrgPick === w.id}" class="team-pick-row ${state.ui.teamOrgPick === w.id ? 'on' : ''}" onclick="state.ui.teamOrgPick = '${w.id}'; renderRegion('team-org-pick', teamOrgPickHtml())">
      <span class="team-org-logo sm">${esc(initials(w.name))}</span><span class="grow"><span class="team-check-label">${esc(w.name)}</span><span class="cell-sub">${esc(w.industry || '—')}</span></span>
      ${statusDot(teamOrgStatus(w))}${state.ui.teamOrgPick === w.id ? '<i data-lucide="check" class="t-primary"></i>' : ''}</button>`).join('');
}
function teamUseExistingOrg() {
  const ws = wsById(state.ui.teamOrgPick);
  if (!ws) { document.getElementById('team-f-pick-err').textContent = 'Select an organisation.'; return false; }
  if (ws.archived) { ws.archived = false; showToast(`${ws.name} restored`, 'archive-restore'); }
  closeModal();
  openWorkspace(ws.id, 'team', { tab: 'members' });
  return false;
}
function teamOrgNameTaken(name) { const n = name.trim().toLowerCase(); return !!n && workspaces.some(w => w.name.trim().toLowerCase() === n); }
function teamOrgNameCheck() {
  const v = document.getElementById('team-f-org').value;
  const err = document.getElementById('team-f-org-err');
  const taken = teamOrgNameTaken(v);
  document.getElementById('team-f-org').classList.toggle('invalid', taken);
  err.textContent = taken ? 'This organisation already exists. Please use the “Existing Organisation” tab.' : '';
}
// Shared workspace creation: Add Organisation (manual) and the agency CRM auto set-up (crm.js) both use it.
// Callers validate the name first (teamOrgNameTaken). Returns the new workspace; it is in the switcher straight away.
function teamCreateWorkspace({ name, site = '', industry = '', budget = 10000, status = 'new', source = 'manual' }) {
  const id = uid('ws');
  const ws = { id, name: name.trim(), industry, site: String(site).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, ''), status, budget,
    seed: Math.max(0, ...workspaces.map(w => w.seed || 0)) + 1, createdAt: teamToday(), archived: false, source };
  workspaces.push(ws);
  // orgProfiles[id] is left unset: Organisation › Business Information generates the placeholder profile on first view.
  workspaceProducts[id] = workspaceProducts[id] || {};
  return ws;
}
function teamCreateOrg() {
  const name = document.getElementById('team-f-org').value.trim();
  if (!name) return teamFieldError('team-f-org', 'Organisation name is required.');
  if (teamOrgNameTaken(name)) return teamFieldError('team-f-org', 'This organisation already exists. Please use the “Existing Organisation” tab.');
  const site = document.getElementById('team-f-site').value.trim();
  const industry = document.getElementById('team-f-ind').value;
  const { id } = teamCreateWorkspace({ name, site, industry });
  teamRefresh();
  showToast('Organisation created', 'building-2');
  openModal({
    title: 'Organisation created',
    desc: `${name} is now in your client list and workspace switcher. Invite its members next?`,
    actions: [{ label: 'Stay Here', kind: 'outline' }, { label: 'Go to Team & Access', kind: 'primary', onClick: () => openWorkspace(id, 'team', { tab: 'members' }) }]
  });
  return false;
}
function teamAssignChips() {
  const ids = state.ui.teamFormAssign || [];
  if (!ids.length) return '<span class="t-caption t-muted">No members assigned yet.</span>';
  return ids.map(id => memberById(id)).filter(Boolean).map(m => `<span class="chip chip-dark">${esc(m.name)}<button type="button" class="chip-remove" aria-label="Unassign ${esc(m.name)}" onclick="teamChecklistToggle('teamFormAssign','${m.id}', false); renderRegion('team-cl-teamFormAssign', teamChecklistItems('teamFormAssign'))"><i data-lucide="x"></i></button></span>`).join('');
}
function teamOpenAssignMembers(wsId) {
  const ws = wsById(wsId);
  const agencyMembers = members.filter(m => m.org === 'agency' && m.status !== 'deactivated');
  state.ui.teamFormAssign = agencyMembers.filter(m => (m.workspaces || []).includes(wsId)).map(m => m.id);
  openModal({
    title: 'Assign Members',
    desc: `Select the agency member(s) who can access ${ws.name}.`,
    body: `<div class="field"><span class="field-label">Members Assigned</span><div class="chips team-assign-chips" id="team-assign-chips">${teamAssignChips()}</div></div>
      <div class="field"><span class="field-label">Add Member</span>${teamChecklist('teamFormAssign', () => agencyMembers.map(m => {
        const all = (m.workspaces || []).includes('*');
        return { id: m.id, label: m.name, sub: `${m.email} · ${roleById(m.roleId)?.name || '—'}`, disabled: all, checked: all ? true : undefined, tag: all ? '<span class="chip">All workspaces</span>' : '' };
      }), 'Search agency members')}</div>`,
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: 'Save', kind: 'primary', onClick: () => {
      const sel = state.ui.teamFormAssign || [];
      agencyMembers.forEach(m => {
        if ((m.workspaces || []).includes('*')) return;
        const has = m.workspaces.includes(wsId);
        if (sel.includes(m.id) && !has) m.workspaces.push(wsId);
        if (!sel.includes(m.id) && has) m.workspaces = m.workspaces.filter(x => x !== wsId);
      });
      teamRefresh();
      showToast(`Agency access updated for ${ws.name}`, 'users');
    } }]
  });
}
function teamConfirmArchive(wsId) {
  const ws = wsById(wsId);
  confirmDialog({
    title: 'Are You Sure To Archive This Workspace?',
    text: 'Archiving this workspace will immediately lock access for all assigned members and pause active workflows. All data and files will be safely stored and can be unarchived by an Administrator later.',
    confirmLabel: 'Archive', danger: true, icon: 'archive',
    onConfirm: () => {
      ws.archived = true;
      delete state.ui.teamQueue[wsId];
      if (state.ctx === wsId) { switchWorkspace(null); return; }
      teamRefresh();
      showToast(`${ws.name} archived`, 'archive');
    }
  });
}
function teamRestoreOrg(wsId) {
  const ws = wsById(wsId);
  ws.archived = false;
  teamRefresh();
  showToast(`${ws.name} restored`, 'archive-restore');
}

// ---------- Agency (client workspace; V1 Agency Access) ----------
function teamQueue() { return state.ui.teamQueue[state.ctx] || (state.ui.teamQueue[state.ctx] = []); }
function teamAgencyAssigned() {
  if (state.flags.teamEmpty.agency) return [];
  let list = teamWsAgencyMembers(state.ctx);
  list = teamApplyFilters(list, 'agency', { role: m => m.roleId, team: m => m.teamId });
  if (state.sorts['team-agency']) return applySort(list, 'team-agency', { name: m => m.name.toLowerCase(), role: m => roleById(m.roleId)?.name || '', team: m => teamById(m.teamId)?.name || '' });
  // Default order: Agency Admins / Owners ('*') first, as V1 lists them by default, then by name.
  return [...list].sort((a, b) => (b.workspaces.includes('*') - a.workspaces.includes('*')) || a.name.localeCompare(b.name));
}
function teamAgencyCandidates(term) {
  const s = (term || '').trim().toLowerCase();
  const queued = teamQueue();
  return members.filter(m => m.org === 'agency' && m.status !== 'deactivated' && !(m.workspaces || []).some(w => w === '*' || w === state.ctx) && !queued.includes(m.id))
    .filter(m => !s || `${m.name} ${m.email}`.toLowerCase().includes(s));
}
function teamAgencyTab() {
  const o = AGENCY_ORG;
  return `<section class="card team-agency-org">
      <div class="org-card">
        <div class="team-agency-logo">OOm</div>
        <div><div class="row"><span class="team-agency-name">${esc(o.name)}</span>${statusDot(o.status)}</div>
          <div class="org-meta">
            <span><i data-lucide="map-pin"></i>${esc(o.country)}</span><span><i data-lucide="building-2"></i>${esc(o.industry)}</span>
            <span><i data-lucide="globe"></i>${esc(o.site)}</span><span><i data-lucide="mail"></i>${esc(o.email)}</span></div></div>
      </div></section>
    <section class="card team-card">
      ${teamCardHead('Agency Member', '', `<div class="team-assign" data-popover-trigger>
          <div class="search"><input class="input" id="team-assign-input" placeholder="Search agency members to give access" oninput="teamAssignSuggest(this.value)" onfocus="teamAssignSuggest(this.value)" autocomplete="off" aria-label="Search agency members to give access"><i data-lucide="search"></i></div>
          <div class="menu menu-left team-suggest" id="team-suggest" role="listbox"></div></div>
        <button type="button" class="btn btn-primary" id="team-save-all" onclick="teamSaveAllQueued()" ${teamQueue().length ? '' : 'hidden'}><i data-lucide="check-check"></i>Save All Queued</button>
        ${teamFilterButton('agency')}`)}
      <div id="team-region">${teamRegionHtml()}</div></section>`;
}
function teamAssignSuggest(term) {
  const el = document.getElementById('team-suggest');
  if (!el) return;
  const list = teamAgencyCandidates(term).slice(0, 8);
  el.innerHTML = list.length
    ? list.map(m => `<button type="button" role="option" class="menu-item" onclick="teamQueueAgency('${m.id}')"><span class="avatar team-avatar-sm">${esc(initials(m.name))}</span><span><span class="team-check-label">${esc(m.name)}</span><span class="cell-sub">${esc(m.email)} · ${esc(roleById(m.roleId)?.name || '—')}</span></span></button>`).join('')
    : `<div class="team-checklist-empty">${term ? 'No unassigned agency member matches.' : 'Every agency member already has access.'}</div>`;
  closeAllPopovers();
  el.classList.add('open');
  refreshIcons();
}
function teamQueueAgency(id) {
  const q2 = teamQueue();
  if (!q2.includes(id)) q2.push(id);
  closeAllPopovers();
  const input = document.getElementById('team-assign-input');
  if (input) input.value = '';
  teamAgencyChanged();
}
function teamAgencyChanged() {
  const btn = document.getElementById('team-save-all');
  if (btn) btn.hidden = !teamQueue().length;
  teamRefresh();
}
function teamRemoveQueued(id) { state.ui.teamQueue[state.ctx] = teamQueue().filter(x => x !== id); teamAgencyChanged(); }
function teamSaveQueued(id) {
  const m = memberById(id);
  if (m && !m.workspaces.includes(state.ctx)) m.workspaces.push(state.ctx);
  state.ui.teamQueue[state.ctx] = teamQueue().filter(x => x !== id);
  teamAgencyChanged();
  showToast(`Access granted to ${m.name}`, 'user-check');
}
function teamSaveAllQueued() {
  const ids = [...teamQueue()];
  ids.forEach(id => { const m = memberById(id); if (m && !m.workspaces.includes(state.ctx)) m.workspaces.push(state.ctx); });
  state.ui.teamQueue[state.ctx] = [];
  teamAgencyChanged();
  showToast(`Saved access for ${ids.length} member${ids.length === 1 ? '' : 's'}`, 'check-check');
}
function teamConfirmRevoke(id) {
  const m = memberById(id);
  const ws = currentWs();
  confirmDialog({
    title: 'Revoke Agency Access?',
    text: `${m.name} will no longer be able to open ${ws.name}, and it will disappear from their workspace switcher. You can give access again at any time.`,
    confirmLabel: 'Revoke Access', danger: true, icon: 'user-x',
    onConfirm: () => { m.workspaces = m.workspaces.filter(w => w !== state.ctx); teamAgencyChanged(); showToast(`Access revoked for ${m.name}`, 'user-x'); }
  });
}
function teamAgencyTable() {
  const T = 'team-agency';
  const queued = teamQueue().map(memberById).filter(Boolean);
  const assigned = teamAgencyAssigned();
  const cells = m => `<td><div class="team-name">${esc(m.name)}</div></td><td>${esc(roleById(m.roleId)?.name || '—')}</td><td>${esc(teamById(m.teamId)?.name || '—')}</td>
    <td>${esc(m.email)}</td><td>${productChips(m.products)}</td>`;
  const qRows = queued.map(m => `<tr class="team-row-pending">${cells(m)}<td class="team-td-action"><div class="team-row-actions"><span class="team-pending-tag">Pending</span>
      <button type="button" class="btn btn-outline btn-sm" onclick="teamRemoveQueued('${m.id}')">Remove</button><button type="button" class="btn btn-primary btn-sm" onclick="teamSaveQueued('${m.id}')">Save</button></div></td></tr>`).join('');
  const aRows = paginate(assigned, T).map(m => `<tr>${cells(m)}<td class="team-td-action">${m.workspaces.includes('*')
      ? `<span class="team-default-access">Default access ${infoTip('Agency Admins and Owners have access to every client workspace, so they are listed by default and can’t be revoked here.')}</span>`
      : `<button type="button" class="btn btn-danger-outline btn-sm" onclick="teamConfirmRevoke('${m.id}')">Revoke Access</button>`}</td></tr>`).join('');
  const head = `<th>${sortHeader(T, 'name', 'Name', 'teamRefresh')}</th><th>${sortHeader(T, 'role', 'Role', 'teamRefresh')}</th><th>${sortHeader(T, 'team', 'Team', 'teamRefresh')}</th>
    <th>Email</th><th>Product Responsibility</th><th class="team-th-action">Access</th>`;
  return teamTable(T, head, qRows + aRows, assigned.length, emptyState('user-search', 'No agency users have access.', 'Search above to assign.'));
}

// ---------- Registration ----------
registerScreen('team', {
  contexts: ['agency', 'client'],
  title: () => 'Team & Access',
  desc: () => 'Manage team members, roles, permissions, and agency access.',
  key: () => `${teamScope()}-team-${teamEditing() ? 'role-editor' : teamTab()}`,
  render: teamRender,
  afterRender: () => {}
});

(function teamRegisterDev() {
  const agencyGo = (tab, extra = {}) => () => { state.ctx = null; state.persona = 'agency'; state.ui.teamRoleDraft = null; navigate('team', { tab, ...extra }); };
  const clientGo = (tab, extra = {}) => () => { state.ctx = devClientCtx(); if (tab === 'agency') state.persona = 'agency'; state.ui.teamRoleDraft = null; navigate('team', { tab, ...extra }); };
  registerDevScreen('Agency', 'agency-team-members', 'Team & Access › Members', agencyGo('members'));
  registerDevScreen('Agency', 'agency-team-teams', 'Team & Access › Teams', agencyGo('teams'));
  registerDevScreen('Agency', 'agency-team-roles', 'Team & Access › Roles & Permissions', agencyGo('roles'));
  registerDevScreen('Agency', 'agency-team-role-editor', 'Team & Access › Create / Edit Role', agencyGo('roles', { edit: 'new' }));
  registerDevScreen('Agency', 'agency-team-clients', 'Team & Access › Client Organisation', agencyGo('clients'));
  registerDevScreen('Client workspace', 'client-team-members', 'Team & Access › Members', clientGo('members'));
  registerDevScreen('Client workspace', 'client-team-teams', 'Team & Access › Teams', clientGo('teams'));
  registerDevScreen('Client workspace', 'client-team-roles', 'Team & Access › Roles & Permissions', clientGo('roles'));
  registerDevScreen('Client workspace', 'client-team-role-editor', 'Team & Access › Create / Edit Role', clientGo('roles', { edit: 'new' }));
  registerDevScreen('Client workspace', 'client-team-agency', 'Team & Access › Agency', clientGo('agency'));

  const emptyToggle = (tab, label) => ({
    label, active: !!state.flags.teamEmpty[tab],
    run: () => { state.flags.teamEmpty[tab] = !state.flags.teamEmpty[tab]; rerender(); }
  });
  const manyToggle = () => ({
    label: '30 extra members (pagination)', active: !!state.flags.teamManyMembers,
    run: () => {
      state.flags.teamManyMembers = !state.flags.teamManyMembers;
      for (let i = members.length - 1; i >= 0; i--) if (members[i].teamDemo) members.splice(i, 1);
      if (state.flags.teamManyMembers) {
        const org = currentOrgId();
        const tms = teamOrgTeams(org), rls = teamScopeRoles();
        for (let i = 1; i <= 30; i++) {
          const t = tms[i % Math.max(1, tms.length)];
          members.push({ id: `m-demo-${i}`, org, teamDemo: true, name: `Demo Member ${String(i).padStart(2, '0')}`, email: `demo${String(i).padStart(2, '0')}@example.com`,
            teamId: t?.id || null, roleId: rls[rls.length - 1].id, status: ['active', 'active', 'pending', 'inactive'][i % 4], products: t ? [...t.products] : [],
            lastActive: `${i}hr ago`, lastProduct: null, workspaces: [] });
        }
      }
      rerender();
    }
  });
  ['agency', 'client'].forEach(ctx => {
    registerDevToggles(`${ctx}-team-members`, () => [emptyToggle('members', 'Empty state'), manyToggle()]);
    registerDevToggles(`${ctx}-team-teams`, () => [emptyToggle('teams', 'Empty state (no teams)')]);
    registerDevToggles(`${ctx}-team-role-editor`, () => {
      const sys = ctx === 'agency' ? 'r-a-admin' : 'r-c-super';
      const custom = ctx === 'agency' ? 'r-a-am' : 'r-c-hom';
      return [
        { label: 'New role', active: state.params.edit === 'new', run: () => teamOpenRoleEditor('new') },
        { label: 'Edit custom role', active: state.params.edit === custom, run: () => teamOpenRoleEditor(custom) },
        { label: 'System role (view only)', active: state.params.edit === sys, run: () => teamOpenRoleEditor(sys) }
      ];
    });
  });
  registerDevToggles('agency-team-clients', () => [emptyToggle('clients', 'Empty state (no client organisations)'),
    { label: 'Simulate CRM conversion', active: false, run: () => crmSimulateConversion() }]);
  registerDevToggles('client-team-agency', () => [emptyToggle('agency', 'Empty state (no agency access)')]);
})();

// ---------- Specs ----------
Object.assign(screenSpecs, {
  'agency-team-members': {
    title: 'Team & Access › Members (Agency)', status: 'In Review', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `### Screen Purpose & Objectives
Central administration of agency (OOm) staff: invite members, set their team and role, and govern exactly which client workspaces each member can open. Ported from V1 "Agency Team Members & Custom Roles", laid out to the Figma Members frame.

### Key Functional Specifications
- **Agency User Directory**: Table of every agency member — Name & Email, Team, Assigned Role, Status (Active / Pending Invite / Inactive / Deactivated), **Assigned Workspaces**, Product Access chips (+N overflow) and Activity (time + last product).
  - Assigned Workspaces shows the first 2 names + "N more", or "All workspaces" for Owner / Agency Admin.
  - Search by name or email; filter by Team, Assigned Role, Status and Product Access (count badge on the filter button); sortable columns; pagination (10 / 20 / 50 per page).
- **Invite Team Member** (V1 quick invite): Member Email (required, validated; a duplicate email shows an inline error), Team, Role and an Assigned Workspaces searchable checklist with an "N Selected" counter. Saving adds the member as *Pending Invite*.
  - System roles (Owner, Agency Admin) automatically get every workspace, including new ones.
- **Edit Team Member** (V1 Manage User Access): same fields, email read-only. Assigned workspaces decide which clients appear in that member's workspace switcher.
- **Row actions**: Edit, Resend Invite (pending only), Deactivate / Reactivate, Remove.
  - *(Draft — Figma only)* Deactivate suspends access and can be reversed; Remove deletes the member. You can't deactivate or remove yourself.
- Product access follows the member's team.

### Open questions
- Permissions are not enforced in this prototype (V1 didn't either).`
  },
  'client-team-members': {
    title: 'Team & Access › Members (Client workspace)', status: 'In Review', author: 'Hannah', updatedAt: '22/10/2026',
    notes: `### Screen Purpose & Objectives
Manage the client's own members in this workspace. Ported from the V1 "Workspace Settings & Permissions" client member section, laid out to the Figma Members frame.

### Key Functional Specifications
- **Seat usage** *(Draft — Figma only)*: "{Workspace} · N / 20 Seats Used" bar with Active / Pending / Inactive counts. 20 seats is a [PLACEHOLDER] allowance.
- **Client Member Management**: Invite and edit members with Team, Role and a **Manage members** toggle ("View workspace analytics" is always on).
  - *Visibility/Editability:* Visible and editable by authorised client users and authorised agency users.
- **Strict Single Primary Contact**: exactly one Primary Contact per workspace. Turning it on for one member clears the previous one. The Primary Contact shows a badge, and Organisation, Dashboard and the Client Organisation cards read it.
- **Row actions**: Edit, Resend Invite, Deactivate / Reactivate, Remove *(Deactivate/Remove: Draft — Figma only)*. Deactivating the Primary Contact leaves the workspace without one until another is set.
- Search, filters (Team / Role / Status / Product Access), sorting and pagination as on the agency list.
- **Awaiting approval** *(Draft, 22/10/2026)*: client contacts added by the agency CRM auto set-up show "Awaiting approval" until the account manager approves them. Their row menu offers **Approve & send invite** (status becomes Pending Invite). They don't use a seat; the seat card lists them separately. The Status filter includes Awaiting approval.`
  },
  'agency-team-teams': {
    title: 'Team & Access › Teams', status: 'Draft', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `### Screen Purpose & Objectives
*(Draft — Figma only, no V1 equivalent.)* Group members into teams and give each team product access.

### Key Functional Specifications
- **Table**: Team, Members (count), Status, Product Access, Created, Action menu. Search, Status / Product Access filters, sorting, pagination.
- **Create Team**: Team Name (required, unique within the organisation), Product Access multi-select of the organisation's products, and an Add Members searchable checklist. A member belongs to one team; adding moves them.
- **Edit Team**: name and product access. Members' product access follows the team.
- **View Members**: members with Remove (confirmation) and an Add Member picker.
- **Duplicate**: confirmation, creates "{name} (Copy)" with the same product access and no members.
- **Delete**: confirmation; members stay in the organisation with no team.`
  },
  'client-team-teams': {
    title: 'Team & Access › Teams (Client workspace)', status: 'Draft', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `### Screen Purpose & Objectives
*(Draft — Figma only.)* Same as the agency Teams screen, scoped to this client workspace's members and to the products connected to this workspace.

### Key Functional Specifications
- Create / Edit / Duplicate / Delete teams; View, Add and Remove team members.
- Product Access options come from the workspace's connected products (Integrations) plus products already in use.`
  },
  'agency-team-roles': {
    title: 'Team & Access › Roles & Permissions (Agency)', status: 'In Review', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `### Screen Purpose & Objectives
Create, edit and delete custom agency roles. Ported from the V1 Role Builder & Permission Matrix.

### Key Functional Specifications
- **Table**: Role, Description, Members (count in this organisation), Product Access (products its members use), Created, Action menu. Search, Product Access filter, sorting, pagination.
- **System roles** (Owner, Agency Admin) are locked: View only, can't be deleted.
- **Create Role / Edit** open the full-page role editor (see Create / Edit Role).
- **Duplicate** *(Draft — Figma only)*: confirmation, creates "{name} (Copy)" with the same permissions; members are not copied. Duplicating a system role gives an editable copy.
- **Delete**: confirmation. Members on the role fall back to the lowest role (**Viewer**), as in V1; the confirmation says how many members move.`
  },
  'client-team-roles': {
    title: 'Team & Access › Roles & Permissions (Client workspace)', status: 'Draft', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `### Screen Purpose & Objectives
*(Draft — new in the Figma design; V1 only had View / Manage members for clients.)* Client roles are shared by every client workspace.

### Key Functional Specifications
- Same table and actions as agency roles. Members count shows this workspace only.
- Super Admin is the locked system role. Deleting a role moves its members (in every client workspace) to **Employee**.
- The Agency permission group is not offered on client roles.`
  },
  'agency-team-role-editor': {
    title: 'Team & Access › Create / Edit Role', status: 'In Review', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `### Screen Purpose & Objectives
Full-page role builder (Figma "Create Role" / "Edit Role"), replacing V1's role modal.

### Key Functional Specifications
- "← Back to List", Role Name (required, unique) and Description.
- **Products panel**: search plus one entry per permission group with a live count (e.g. Organisation 2/3). Clicking an entry scrolls to that group.
- **Permission groups**: collapsible, "N permissions", sub-groups with Select All, and a checkbox per permission with its title and description.
  - Organisation (3), Organisation Management (16), Integrations (6), Agency (5, agency roles only), Settings (5).
  - V1 permission ids are kept: View assigned workspaces, Create workspaces, Manage clients in workspaces, Assign/unassign agency users, Link/unlink ad accounts (Agency group); Invite users = Invite Members; Create/edit roles = Create Roles.
  - The Agency and Settings groups have no Figma detail frame. Agency is filled from V1; **Settings is [PLACEHOLDER]** until designed.
- "+ Create Role" or "Save Changes" bottom right. Renaming keeps member assignments (members reference roles by id).
- System roles open read-only with a "system role" note.`
  },
  'client-team-role-editor': {
    title: 'Team & Access › Create / Edit Role (Client workspace)', status: 'Draft', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `### Screen Purpose & Objectives
*(Draft.)* The same role editor for client roles. The Agency permission group is hidden.`
  },
  'agency-team-clients': {
    title: 'Team & Access › Client Organisation', status: 'In Review', author: 'Hannah', updatedAt: '22/10/2026',
    notes: `### Screen Purpose & Objectives
Directory for creating and locating client organisations (workspaces). Ported from V1 "Client Workspaces Directory & Creation", shown as Figma cards.

### Key Functional Specifications
- **Card grid**: logo initials, name, status dot (Active / Inactive / Archived), Action menu (Open Workspace, Assign Members, Archive), industry, Primary Contact (or "Unassigned"), client member count and agency member count (members assigned to it, including Owner / Agency Admin).
- Search by name, industry or contact; filter by Status and Industry. Picking "Archived" shows archived organisations, which can be restored.
- **Add Organisation** modal with New / Existing tabs:
  - New: Organisation Name (required), Site URL, Industry. A duplicate name (case-insensitive, archived included) shows "This organisation already exists. Please use the “Existing Organisation” tab."
  - Existing: pick an organisation; archived ones are restored, then the workspace opens.
  - On create the organisation appears in this grid **and** the workspace switcher (fixes V1), then offers to go to its Team & Access.
- **Assign Members** *(Draft — Figma only)*: searchable checklist of agency members; writes to each member's assigned workspaces.
- **Archive** *(Draft — Figma only)*: confirmation; locks access, removes it from the switcher and lists.
- Manual creation and the CRM auto set-up share one function (\`teamCreateWorkspace\`), so both behave the same.

### Auto set-up from the agency CRM *(Draft, 22/10/2026)*
When an account converts in the agency CRM, Galaxis creates the client workspace automatically:
1. **Workspace created**, marked "From CRM" (badge on the card).
2. **Services & budgets synced** from the CRM (shown read-only in Organisation › Business Information › Services & Contract).
3. **Agency assignees added** through the default CRM role mapping (no editing UI since 22/10/2026). The CRM's named user is used when they hold the mapped Galaxis role and team; otherwise the agency member with that role and team and the fewest workspaces is picked. Assignment writes to each member's assigned workspaces, so the workspace appears in their switcher.
4. **SEO Cloud project linked** (only when SEO is a live service). The project starts as *Pending setup* until keywords are set up in SEO Cloud.
5. **Client contacts awaiting approval.** CRM contacts are added as members with status *Awaiting approval*. They are not invited and don't use a seat. The account manager approves them (all at once or one by one) or removes them; approved contacts become *Pending Invite*. The first primary contact becomes the workspace Primary Contact.
6. **Ad accounts linked** — a manual step: "Link in Integrations" opens agency Integrations.
- **Card**: while set-up is incomplete, the card shows "Set-up: N of M steps" with a progress bar. The action menu has **View set-up**.
- **Set-up checklist** (slide-over): progress, each step with ✓ Done / Needs approval / Manual step, the contact list with Approve and Remove, Link in Integrations, Assign members (when a CRM role has no matching Galaxis user), **Open workspace** and **Approve & send invites**.
- Steps are computed from live data, so linking ad accounts or approving contacts elsewhere ticks them off.
- The agency dashboard lists incomplete set-ups as Attention rows ("N client invites awaiting approval").
- If the agency turns approval off in Integrations, contacts are invited straight away.
- If the Agency CRM is disconnected, no workspaces are created.
- Seeded demo: Grizzly Bear Corp and Bean Tech Pte Ltd are CRM-created and still waiting for approval and ad accounts. Earlier workspaces count as fully set up.
- Dev toggle "Simulate CRM conversion" converts the next placeholder account (Northstar Dental Pte Ltd, Harbourview Bakery, Lumen Fitness Studio — fictional [PLACEHOLDER] companies).

### Open questions
- What happens to the workspace, assignees and budgets when a CRM account churns or a service ends?
- Should an agency be able to make client invites fully automatic (per-agency setting), and who can change it?
- How do we map a CRM account manager who isn't a Galaxis user yet (invite them, fall back to the mapping, or block)?
- Ad budget source: CRM services (SEM + Google Ads + Facebook Ads) or a per-workspace budget?
- Duplicate detection: when a converted CRM account matches an existing workspace (name, domain or UEN), link it instead of creating one? The demo skips the conversion and flags it.`
  },
  'client-team-agency': {
    title: 'Team & Access › Agency (Client workspace)', status: 'In Review', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `### Screen Purpose & Objectives
Agency access governance for this workspace. Ported from the V1 "Workspace Settings & Permissions" agency section.

### Key Functional Specifications
- **Visibility**: hidden from client users. Visible and editable by authorised agency users.
- **Agency header card**: agency logo, name, Active status, country, industry, site, email.
- **Agency Member table**: Name, Role, Team, Email, Product Responsibility. Agency Admins and Owners inherit global access and are listed by default (can't be revoked).
- **Assign flow (V1)**: search unassigned agency members, pick one to queue it as an amber *Pending* row with Remove and Save; "Save All Queued" appears while anything is queued. Assigned rows have Revoke Access behind a confirmation.
- Changes write to the member's assigned workspaces, so the agency Members list, the Client Organisation counts and the member's workspace switcher stay in sync.
- Empty state: "No agency users have access. Search above to assign."
- Seat usage card as on Members.`
  }
});
