// Galaxis Hub demo — core: state, routing, formatting and shared UI helpers.
// Every module is a classic script; functions called from inline handlers must be global.

const state = {
  ctx: null,              // null = agency ("My Workspace"); otherwise a workspace id
  page: 'dashboard',      // dashboard | organisation | team | integrations | leads
  params: {},             // page-specific route params, e.g. { tab: 'members' } or { leadId }
  persona: 'agency',      // who is viewing a client workspace: 'agency' (agency admin) | 'client' (client user)
  flags: {},              // dev-toolbar scenario flags, owned by each module
  sorts: {},              // table sort state, keyed by table id
  pagers: {},             // pagination state, keyed by table id
  ui: {}                  // per-module transient UI state (search text, open tabs, filters)
};

const screens = {};
const devToggleRegistry = {};

// ---------- Context helpers ----------
function isAgency() { return state.ctx === null; }
function currentWs() { return state.ctx ? workspaces.find(w => w.id === state.ctx) : null; }
function currentOrgId() { return state.ctx || 'agency'; }
function wsById(id) { return workspaces.find(w => w.id === id); }
function activeWorkspaces() { return workspaces.filter(w => !w.archived); }
// The viewer can manage agency-only settings (ad linking, agency access) in this context.
function viewerIsAgency() { return isAgency() || state.persona === 'agency'; }
function productById(id) { return products.find(p => p.id === id); }
function memberById(id) { return members.find(m => m.id === id); }
function roleById(id) { return roles.find(r => r.id === id); }
function teamById(id) { return teams.find(t => t.id === id); }
function wsProducts(wsId) { return workspaceProducts[wsId] || (workspaceProducts[wsId] = {}); }
// The connected, active CRM for a workspace, or null. Drives CRM mode on the dashboard and the Leads nav item.
function activeCrm(wsId) {
  const entries = Object.entries(wsProducts(wsId));
  const hit = entries.find(([pid, s]) => productById(pid)?.category === 'CRM' && s.active && s.status === 'connected');
  return hit ? productById(hit[0]) : null;
}
// The client workspace's single Primary Contact (V1 rule: exactly one per workspace), or null.
function wsPrimaryContact(wsId) { return members.find(m => m.org === wsId && m.isPrimary && m.status !== 'deactivated') || null; }
// One connected product per lane: a workspace can have only one CRM, one chat platform and one call tracker.
const PRODUCT_LANES = {
  crm:   { label: 'CRM', noun: 'CRM', ids: () => products.filter(p => p.category === 'CRM').map(p => p.id) },
  chat:  { label: 'Automated Chat', noun: 'chat platform', ids: () => ['aurix', 'sleekflow', 'wati'] },
  calls: { label: 'Call Tracking', noun: 'call tracker', ids: () => ['delacon'] }
};
function productLane(pid) { return Object.keys(PRODUCT_LANES).find(k => PRODUCT_LANES[k].ids().includes(pid)) || null; }
// The product already holding pid's lane in this workspace (any status), or null.
function laneOccupant(wsId, pid) {
  const lane = productLane(pid);
  if (!lane) return null;
  const hit = PRODUCT_LANES[lane].ids().find(id => id !== pid && wsProducts(wsId)[id]);
  return hit ? productById(hit) : null;
}
// Monthly ad budget for a workspace: the CRM's SEM + Google Ads + Facebook Ads services, else the workspace default.
function wsAdBudget(wsId) {
  const services = (crmAccounts[wsId]?.services || []).filter(x => CRM_AD_SERVICES.includes(x.type));
  return services.length ? services.reduce((t, x) => t + x.monthlyBudget, 0) : (wsById(wsId)?.budget || 0);
}
// CRM services that are live today (started and not yet ended), each with daysLeft until its contract ends.
function crmLiveServices(wsId) {
  const today = toDateInput(new Date());
  return (crmAccounts[wsId]?.services || []).filter(x => (!x.start || x.start <= today) && (!x.end || x.end >= today))
    .map(x => ({ ...x, daysLeft: x.end ? Math.round((new Date(x.end + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000) : null }));
}
function wsAdAccounts(wsId) { return adAccounts.filter(a => a.workspaceId === wsId); }
function wsPlatforms(wsId) { return ['google', 'meta'].filter(p => wsAdAccounts(wsId).some(a => a.platform === p)); }

// ---------- Screens & routing ----------
// def: { contexts: ['agency','client'], title(), desc(), render() -> html, afterRender?(), key?() -> specs key }
function registerScreen(page, def) { screens[page] = def; }
function registerDevToggles(screenKey, fn) { devToggleRegistry[screenKey] = fn; }

function screenKey() {
  const def = screens[state.page];
  if (def && def.key) return def.key();
  return `${isAgency() ? 'agency' : 'client'}-${state.page}`;
}

function navigate(page, params = {}) {
  const def = screens[page];
  if (!def) return;
  const ctx = isAgency() ? 'agency' : 'client';
  if (def.contexts && !def.contexts.includes(ctx)) page = 'dashboard';
  state.page = page;
  state.params = params;
  closeAllPopovers();
  closeDrawer();
  render();
  window.scrollTo(0, 0);
}

function switchWorkspace(wsId) {
  state.ctx = wsId;
  if (!wsId) state.persona = 'agency';
  const def = screens[state.page];
  const ctx = wsId ? 'client' : 'agency';
  const params = state.page === 'team' || state.page === 'organisation' ? { tab: state.params.tab } : {};
  if (!def || (def.contexts && !def.contexts.includes(ctx))) navigate('dashboard');
  else navigate(state.page, params);
  showToast(wsId ? `Switched to ${wsById(wsId).name}` : 'Switched to My Workspace (Agency)', 'repeat');
}

function render() {
  const def = screens[state.page];
  renderShell();
  const root = document.getElementById('screen-root');
  root.innerHTML = def ? def.render() : '';
  if (def && def.afterRender) def.afterRender();
  renderDevBar();
  refreshIcons();
}

// Re-render only the page body (keeps the shell). Use after state changes inside a screen.
function rerender() {
  const def = screens[state.page];
  const root = document.getElementById('screen-root');
  const y = window.scrollY;
  root.innerHTML = def ? def.render() : '';
  if (def && def.afterRender) def.afterRender();
  renderSidebar();
  renderDevBar();
  refreshIcons();
  window.scrollTo(0, y);
}

// Replace one region's HTML (keeps focus in inputs elsewhere on the page).
function renderRegion(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
  refreshIcons();
}

function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

// ---------- Formatting ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Quote a value for use inside an inline onclick="fn('…')" attribute.
function q(s) { return esc(String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
function fmtMoney(n, dp = 0) { return '$' + Number(n || 0).toLocaleString('en-SG', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
function fmtNum(n) { return Number(n || 0).toLocaleString('en-SG'); }
function fmtPct(n, dp = 2) { return `${Number(n || 0).toFixed(dp)}%`; }
// Dates follow the Figma copy: "02 Jan 2026" and "6 Sep 2026, 11:32" (day first, SGT).
// Fixed month names: en-GB renders September as "Sept", which Figma does not use.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function sgtParts(d) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return p;
}
function toDate(v) { return v instanceof Date ? v : new Date(v.length === 10 ? v + 'T00:00:00+08:00' : v); }
function fmtDate(v) {
  if (!v) return '—';
  const p = sgtParts(toDate(v));
  return `${p.day.padStart(2, '0')} ${MONTHS[p.month - 1]} ${p.year}`;
}
function fmtDateTime(v) {
  if (!v) return '—';
  const p = sgtParts(toDate(v));
  return `${Number(p.day)} ${MONTHS[p.month - 1]} ${p.year}, ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function uid(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 8)}`; }
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }

// ---------- Small render helpers ----------
const STATUS_PILL = { active: ['Active', 'pill-green'], new: ['New', 'pill-blue'], attention: ['Attention Required', 'pill-red'], inactive: ['Inactive', 'pill-orange'], paused: ['Paused', 'pill-grey'] };
function statusPill(status, label) {
  const [text, cls] = STATUS_PILL[status] || [status, 'pill-grey'];
  return `<span class="pill ${cls}">${esc(label || text)}</span>`;
}
const STATUS_DOT = { active: ['Active', 'dot-green', 't-success'], pending: ['Pending Invite', 'dot-blue', 't-primary'], awaiting: ['Awaiting approval', 'dot-orange', 't-warning'], inactive: ['Inactive', 'dot-orange', 't-warning'], deactivated: ['Deactivated', 'dot-grey', 't-muted'], archived: ['Archived', 'dot-grey', 't-muted'] };
function statusDot(status, label) {
  const [text, dot, color] = STATUS_DOT[status] || [status, 'dot-grey', 't-muted'];
  return `<span class="dot-label ${color}"><span class="dot ${dot}"></span>${esc(label || text)}</span>`;
}
function productChips(ids, max = 2) {
  const names = (ids || []).map(id => productById(id)?.name).filter(Boolean);
  if (!names.length) return '<span class="t-muted">—</span>';
  const shown = names.slice(0, max).map(n => `<span class="chip">${esc(n)}</span>`).join('');
  const more = names.length > max ? `<span class="more-count" title="${esc(names.slice(max).join(', '))}">+${names.length - max}</span>` : '';
  return `<span class="chips">${shown}${more}</span>`;
}
function infoTip(text) {
  return `<span class="info-tip" tabindex="0"><i data-lucide="info"></i><span class="tip">${esc(text)}</span></span>`;
}
function emptyState(icon, title, text) {
  return `<div class="empty"><i data-lucide="${icon}"></i><div class="empty-title">${esc(title)}</div><div class="t-caption">${esc(text || '')}</div></div>`;
}

// Platform marks (simplified, self-hosted).
const PLATFORM_SVG = {
  google: `<svg class="logo" viewBox="0 0 24 24" aria-label="Google Ads"><path fill="#FBBC04" d="M2.3 17.3 9 5.7a3.4 3.4 0 0 1 5.9 3.4L8.2 20.7a3.4 3.4 0 1 1-5.9-3.4z"/><path fill="#4285F4" d="M21.7 17.3 15 5.7a3.4 3.4 0 0 0-5.9 3.4l6.7 11.6a3.4 3.4 0 1 0 5.9-3.4z"/><circle fill="#34A853" cx="5.2" cy="19" r="3.4"/></svg>`,
  meta: `<svg class="logo" viewBox="0 0 24 24" aria-label="Meta"><path fill="none" stroke="#0866FF" stroke-width="2.4" stroke-linecap="round" d="M3 15.5c0-4.5 2.2-8 4.6-8 3.3 0 5.6 9 8.8 9 1.8 0 3.1-2 3.1-4.6 0-3.1-1.5-4.4-3.1-4.4-3.2 0-5.5 9-8.8 9C4.6 16.5 3 15.9 3 15.5z"/></svg>`
};
const PLATFORM_NAME = { google: 'Google', meta: 'Meta' };
function platformLogo(p) { return PLATFORM_SVG[p] || ''; }
function platformBadge(p, plain) { return `<span class="platform ${plain ? 'platform-plain' : ''}">${platformLogo(p)}${PLATFORM_NAME[p] || esc(p)}</span>`; }
function productLogo(pid, size = 32) {
  const p = productById(pid);
  if (!p) return '';
  const fg = p.id === 'mailchimp' ? '#2B2B2B' : '#fff';
  return `<span class="product-logo" style="width:${size}px;height:${size}px;background:${p.color};color:${fg};font-size:${Math.round(size / 2.8)}px">${esc(p.initials)}</span>`;
}

// ---------- Clipboard ----------
// Fallback for browsers without navigator.clipboard (e.g. file:// pages).
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { showToast('Copy failed — select the text manually', 'triangle-alert'); }
  ta.remove();
}

// ---------- Toast ----------
let toastTimer;
function showToast(message, icon = 'check-circle') {
  const t = document.getElementById('toast');
  t.innerHTML = `<i data-lucide="${icon}"></i><span>${esc(message)}</span>`;
  t.classList.add('show');
  refreshIcons();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------- Modals ----------
// openModal({ title, desc, body, size: 'lg', actions: [{ label, kind: 'primary'|'outline'|'danger', onClick, close: true }] })
// onClick returning false keeps the modal open (e.g. validation failed).
let modalActions = [];
function openModal({ title, desc = '', body = '', actions = [], size = '', onOpen } = {}) {
  modalActions = actions;
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop open" onclick="if (event.target === this) closeModal()">
      <div class="modal ${size === 'lg' ? 'modal-lg' : ''}" role="dialog" aria-modal="true">
        ${title ? `<h3 class="modal-title">${esc(title)}</h3>` : ''}
        ${desc ? `<p class="modal-desc">${esc(desc)}</p>` : ''}
        <div class="modal-body">${body}</div>
        ${actions.length ? `<div class="modal-actions">${actions.map((a, i) => `<button type="button" class="btn btn-${a.kind || 'primary'}" id="modal-action-${i}" onclick="runModalAction(${i})">${a.icon ? `<i data-lucide="${a.icon}"></i>` : ''}${esc(a.label)}</button>`).join('')}</div>` : ''}
      </div>
    </div>`;
  refreshIcons();
  const first = root.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
  if (first) first.focus();
  if (onOpen) onOpen();
}
function runModalAction(i) {
  const a = modalActions[i];
  if (!a) return;
  const result = a.onClick ? a.onClick() : undefined;
  if (result !== false && a.close !== false) closeModal();
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; modalActions = []; }

// Centred confirmation modal (Figma: warning icon, title, grey text, Cancel + Confirm).
function confirmDialog({ title, text, confirmLabel = 'Confirm', danger = false, icon = 'triangle-alert', onConfirm }) {
  modalActions = [{ onClick: onConfirm }];
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-backdrop open" onclick="if (event.target === this) closeModal()">
      <div class="modal modal-confirm" role="alertdialog" aria-modal="true">
        <div class="confirm-icon ${danger ? 'danger' : ''}"><i data-lucide="${icon}"></i></div>
        <h3 class="modal-title">${esc(title)}</h3>
        <p class="modal-desc">${esc(text)}</p>
        <div class="modal-actions center">
          <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" onclick="runModalAction(0)">${esc(confirmLabel)}</button>
        </div>
      </div>
    </div>`;
  refreshIcons();
}

// ---------- Drawer (right slide-over) ----------
function openDrawer(bodyHtml, footerHtml = '') {
  document.getElementById('drawer-root').innerHTML = `
    <div class="drawer-backdrop open" onclick="closeDrawer()"></div>
    <aside class="drawer" role="dialog" aria-modal="true">
      <button type="button" class="kebab drawer-close" onclick="closeDrawer()" aria-label="Close"><i data-lucide="x"></i></button>
      <div class="drawer-body" id="drawer-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="drawer-footer" id="drawer-footer">${footerHtml}</div>` : ''}
    </aside>`;
  refreshIcons();
  requestAnimationFrame(() => document.querySelector('#drawer-root .drawer')?.classList.add('open'));
}
function closeDrawer() { const r = document.getElementById('drawer-root'); if (r) r.innerHTML = ''; }

// ---------- Menus & popovers ----------
// Markup: <div class="menu-anchor"><button onclick="toggleMenu('id', event)">…</button><div class="menu" id="id">…</div></div>
function toggleMenu(id, ev) {
  if (ev) ev.stopPropagation();
  const el = document.getElementById(id);
  if (!el) return;
  const wasOpen = el.classList.contains('open');
  closeAllPopovers();
  if (wasOpen) return;
  el.classList.add('open');
  el.closest('td, th')?.classList.add('menu-open-cell');
  // Menus inside scrollable tables would be clipped: pin them to the viewport next to their trigger.
  const trigger = ev && ev.currentTarget;
  if (trigger && el.closest('.table-wrap')) {
    const r = trigger.getBoundingClientRect();
    const h = el.offsetHeight, w = el.offsetWidth;
    const top = r.bottom + 6 + h > window.innerHeight ? Math.max(8, r.top - 6 - h) : r.bottom + 6;
    Object.assign(el.style, { position: 'fixed', top: `${top}px`, left: `${Math.max(8, r.right - w)}px`, right: 'auto', bottom: 'auto' });
  }
}
window.addEventListener('scroll', () => document.querySelectorAll('.table-wrap .menu.open').forEach(el => el.classList.remove('open')), true);
function closeAllPopovers() {
  document.querySelectorAll('.menu.open, .filter-panel.open, .ws-panel.open, .date-filter.open').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.menu-open-cell').forEach(el => el.classList.remove('menu-open-cell'));
}
function rowMenu(id, items) {
  // items: [{ label, icon, onClick: "js string", danger, disabled }] or 'sep'
  return `<div class="menu-anchor"><button type="button" class="kebab" aria-label="Actions" onclick="toggleMenu('${id}', event)"><i data-lucide="more-vertical"></i></button>
    <div class="menu" id="${id}" onclick="event.stopPropagation()">${items.map(it => it === 'sep' ? '<div class="menu-sep"></div>' :
      `<button type="button" class="menu-item ${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''} onclick="closeAllPopovers(); ${it.onClick}">${it.icon ? `<i data-lucide="${it.icon}"></i>` : ''}${esc(it.label)}</button>`).join('')}</div></div>`;
}

// ---------- Sorting & pagination ----------
// sortHeader('tableId', 'col', 'Label', 'rerenderFn') -> clickable header; applySort(list, 'tableId', { col: item => value })
function sortHeader(table, col, label, fn) {
  const s = state.sorts[table] || {};
  const on = s.col === col;
  const ind = on ? (s.dir === 'asc' ? '↑' : '↓') : '↑↓';
  return `<button type="button" class="th-sort ${on ? 'sorted' : ''}" onclick="toggleSort('${table}','${col}','${fn}')">${thLabel(label)}<span class="sort-ind">${ind}</span></button>`;
}
// Header label split into two balanced lines. Shown on one line normally; in tables with .table-wrap-heads each
// line becomes a block that never wraps, so a header takes at most two rows (e.g. "Contract Days / Left").
function thLabel(label) {
  const words = String(label).split(' ');
  if (words.length < 2) return `<span class="th-label">${esc(label)}</span>`;
  let best = 1, bestLen = Infinity;
  for (let i = 1; i < words.length; i++) {
    const len = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length);
    if (len < bestLen) { best = i; bestLen = len; }
  }
  return `<span class="th-label"><span class="th-line">${esc(words.slice(0, best).join(' '))}</span> <span class="th-line">${esc(words.slice(best).join(' '))}</span></span>`;
}
function toggleSort(table, col, fn) {
  const s = state.sorts[table] || {};
  state.sorts[table] = { col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' };
  if (state.pagers[table]) state.pagers[table].page = 1;
  window[fn]();
}
function applySort(list, table, accessors, fallback) {
  const s = state.sorts[table] || fallback;
  if (!s || !accessors[s.col]) return list;
  const get = accessors[s.col];
  return [...list].sort((a, b) => {
    const va = get(a), vb = get(b);
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return s.dir === 'asc' ? cmp : -cmp;
  });
}
function pager(table, perPage = 10) {
  return state.pagers[table] || (state.pagers[table] = { page: 1, perPage });
}
function paginate(list, table, perPage) {
  const p = pager(table, perPage);
  const pages = Math.max(1, Math.ceil(list.length / p.perPage));
  if (p.page > pages) p.page = pages;
  return list.slice((p.page - 1) * p.perPage, p.page * p.perPage);
}
// Figma pagination bar: "Showing Per Page: 10 ▾" + ‹ 1 2 … n ›
function paginationBar(table, total, fn) {
  const p = pager(table);
  const pages = Math.max(1, Math.ceil(total / p.perPage));
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - p.page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const opts = [10, 20, 50].map(n => `<option value="${n}" ${n === p.perPage ? 'selected' : ''}>${n}</option>`).join('');
  return `<div class="pagination">
    <span class="per-page">Showing Per Page: <select onchange="setPerPage('${table}', this.value, '${fn}')">${opts}</select>
      <span class="t-muted">&nbsp;· ${total ? `${(p.page - 1) * p.perPage + 1}–${Math.min(total, p.page * p.perPage)} of ${total}` : '0 results'}</span></span>
    <span class="pages">
      <button type="button" class="page-btn" ${p.page <= 1 ? 'disabled' : ''} onclick="setPage('${table}', ${p.page - 1}, '${fn}')" aria-label="Previous"><i data-lucide="chevron-left"></i></button>
      ${nums.map(n => n === '…' ? '<span class="page-btn muted">…</span>' : `<button type="button" class="page-btn ${n === p.page ? 'active' : 'muted'}" onclick="setPage('${table}', ${n}, '${fn}')">${n}</button>`).join('')}
      <button type="button" class="page-btn" ${p.page >= pages ? 'disabled' : ''} onclick="setPage('${table}', ${p.page + 1}, '${fn}')" aria-label="Next"><i data-lucide="chevron-right"></i></button>
    </span></div>`;
}
function setPage(table, n, fn) { pager(table).page = n; window[fn](); }
function setPerPage(table, n, fn) { const p = pager(table); p.perPage = Number(n); p.page = 1; window[fn](); }

// ---------- Date filter (ported from V1: Past / Current / Date Range) ----------
state.dateFilters = {
  agency: { mode: 'past', pastNumber: 30, pastUnit: 'days', currentUnit: 'month', start: '', end: '', label: 'Past 30 days' },
  client: { mode: 'past', pastNumber: 30, pastUnit: 'days', currentUnit: 'month', start: '', end: '', label: 'Past 30 days' }
};
function toDateInput(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function subtractDate(d, n, unit) {
  const x = new Date(d);
  if (unit === 'days') x.setDate(x.getDate() - n);
  if (unit === 'weeks') x.setDate(x.getDate() - n * 7);
  if (unit === 'months') x.setMonth(x.getMonth() - n);
  if (unit === 'years') x.setFullYear(x.getFullYear() - n);
  return x;
}
function resolveDateRange(cfg) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (cfg.mode === 'past') {
    const start = subtractDate(today, Math.max(1, Number(cfg.pastNumber) || 30), cfg.pastUnit);
    start.setDate(start.getDate() + 1);
    return { start: toDateInput(start), end: toDateInput(today) };
  }
  if (cfg.mode === 'current') {
    const start = new Date(today);
    if (cfg.currentUnit === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (cfg.currentUnit === 'month') start.setDate(1);
    if (cfg.currentUnit === 'year') start.setMonth(0, 1);
    return { start: toDateInput(start), end: toDateInput(today) };
  }
  if (!cfg.start || !cfg.end) return null;
  return cfg.start <= cfg.end ? { start: cfg.start, end: cfg.end } : { start: cfg.end, end: cfg.start };
}
// Number of days in the applied range — modules scale mock metrics by this so the filter visibly changes data.
function dateRangeDays(scope) {
  const r = resolveDateRange(state.dateFilters[scope]);
  if (!r) return 30;
  return Math.max(1, Math.round((new Date(r.end) - new Date(r.start)) / 86400000) + 1);
}
function dateFilterHTML(scope, onApply) {
  const c = state.dateFilters[scope];
  const tab = m => `<button type="button" class="${c.mode === m ? 'active' : ''}" onclick="setDateMode('${scope}','${m}')">${{ past: 'Past', current: 'Current', range: 'Date Range' }[m]}</button>`;
  return `<div class="date-filter" id="df-${scope}" onclick="event.stopPropagation()">
    <button type="button" class="date-trigger" onclick="toggleDateFilter('${scope}')"><span>${esc(c.label)}</span><i data-lucide="calendar"></i></button>
    <div class="date-popover">
      <div class="seg seg-block">${tab('past')}${tab('current')}${tab('range')}</div>
      <div ${c.mode !== 'past' ? 'hidden' : ''}><div class="date-config-row"><span>Past</span><input id="df-${scope}-num" class="input" style="width:80px" type="number" min="1" value="${c.pastNumber}" oninput="previewDate('${scope}')">
        <select id="df-${scope}-unit" class="select" onchange="previewDate('${scope}')">${['days', 'weeks', 'months', 'years'].map(u => `<option ${u === c.pastUnit ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
      <div ${c.mode !== 'current' ? 'hidden' : ''}><div class="date-config-row"><span>Current</span>
        <select id="df-${scope}-cur" class="select" onchange="previewDate('${scope}')">${['day', 'week', 'month', 'year'].map(u => `<option ${u === c.currentUnit ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
      <div ${c.mode !== 'range' ? 'hidden' : ''}><div class="date-config-row"><input id="df-${scope}-start" class="input" type="date" value="${c.start}" onchange="previewDate('${scope}')"><span>→</span><input id="df-${scope}-end" class="input" type="date" value="${c.end}" onchange="previewDate('${scope}')"></div></div>
      <div class="date-preview" id="df-${scope}-preview"></div>
      <div class="date-actions"><button type="button" class="btn btn-outline btn-sm" onclick="closeAllPopovers()">Cancel</button><button type="button" class="btn btn-primary btn-sm" onclick="applyDateFilter('${scope}','${onApply}')">Apply</button></div>
    </div></div>`;
}
function readDateDraft(scope) {
  const c = { ...state.dateFilters[scope] };
  const v = id => document.getElementById(`df-${scope}-${id}`)?.value;
  c.pastNumber = Math.max(1, Number(v('num')) || 30);
  c.pastUnit = v('unit') || c.pastUnit;
  c.currentUnit = v('cur') || c.currentUnit;
  c.start = v('start') || ''; c.end = v('end') || '';
  return c;
}
function previewDate(scope) {
  const r = resolveDateRange(readDateDraft(scope));
  const el = document.getElementById(`df-${scope}-preview`);
  if (el) el.textContent = r ? `${fmtDate(r.start)} – ${fmtDate(r.end)}` : 'Choose a start and end date';
}
function toggleDateFilter(scope) {
  const el = document.getElementById(`df-${scope}`);
  const open = !el.classList.contains('open');
  closeAllPopovers();
  if (open) {
    const c = state.dateFilters[scope];
    if (!c.start) { const r = resolveDateRange({ ...c, mode: 'past' }); c.start = r.start; c.end = r.end; document.getElementById(`df-${scope}-start`).value = c.start; document.getElementById(`df-${scope}-end`).value = c.end; }
    el.classList.add('open');
    previewDate(scope);
  }
}
function setDateMode(scope, mode) {
  Object.assign(state.dateFilters[scope], readDateDraft(scope), { mode });
  const el = document.getElementById(`df-${scope}`);
  const apply = el.querySelector('.date-actions .btn-primary').getAttribute('onclick').match(/'([^']+)'\)$/)[1];
  el.outerHTML = dateFilterHTML(scope, apply);
  document.getElementById(`df-${scope}`).classList.add('open');
  refreshIcons();
  previewDate(scope);
}
function applyDateFilter(scope, onApply) {
  const c = readDateDraft(scope);
  c.mode = state.dateFilters[scope].mode;
  const r = resolveDateRange(c);
  if (!r) { showToast('Choose a start and end date', 'calendar'); return; }
  c.label = c.mode === 'past' ? `Past ${c.pastNumber} ${c.pastUnit}` : c.mode === 'current' ? `Current ${c.currentUnit}` : `${fmtDate(r.start)} – ${fmtDate(r.end)}`;
  state.dateFilters[scope] = c;
  closeAllPopovers();
  if (onApply && window[onApply]) window[onApply]();
}

// ---------- Column picker (show / hide table columns) ----------
// registerColumnPicker('campaigns', {
//   columns: () => [{ key, group, label }],   // toggleable columns (fixed columns are simply not listed)
//   groups: [['delivery', 'Delivery', { summary: 'spend', tone: 'ads' }], …],  // order, labels; empty groups are skipped
//   collapsible: true,                          // optional: column groups get a band row and can collapse to their summary column
//   note: 'Name and Action are always shown',
//   onChange: 'dashRefreshCampaignTable',      // global fn re-rendering the table
//   storageKey: 'galaxis-demo:…',              // optional; hidden columns are a per-viewer convenience
//   defaultHidden: ['cpm', …]                  // optional; columns hidden until the viewer changes them (Reset to default restores)
// })
const columnPickers = {};
function registerColumnPicker(id, def) {
  def.storageKey = def.storageKey || `galaxis-demo:${id}-columns-hidden`;
  try { def.hidden = JSON.parse(localStorage.getItem(def.storageKey)) || def.defaultHidden || []; } catch (e) { def.hidden = def.defaultHidden || []; }
  def.collapsedKey = def.collapsedKey || `galaxis-demo:${id}-groups-collapsed`;
  try { def.collapsed = JSON.parse(localStorage.getItem(def.collapsedKey)) || []; } catch (e) { def.collapsed = []; }   // default: all expanded
  columnPickers[id] = def;
}
function colVisible(id, key) { return !columnPickers[id].hidden.includes(key); }
function colHiddenCount(id) { const d = columnPickers[id]; return d.columns().filter(c => d.hidden.includes(c.key)).length; }
function colPickerButton(id) {
  const n = colHiddenCount(id);
  return `<div class="menu-anchor">
    <button type="button" class="icon-btn" aria-label="Show or hide columns" title="Columns" onclick="toggleMenu('colpick-${id}', event)"><i data-lucide="columns-3"></i><span class="count" id="colpick-count-${id}" ${n ? '' : 'hidden'}>${n}</span></button>
    <div class="filter-panel colpick-panel" id="colpick-${id}" onclick="event.stopPropagation()"><div id="colpick-inner-${id}">${colPickerInner(id)}</div></div>
  </div>`;
}
function colPickerInner(id) {
  const d = columnPickers[id];
  const cols = d.columns();
  const shown = cols.filter(c => colVisible(id, c.key)).length;
  const groups = d.groups.map(([g, label]) => {
    const items = cols.filter(c => c.group === g);
    if (!items.length) return '';
    const on = items.filter(c => colVisible(id, c.key)).length;
    return `<div class="filter-group">
      <div class="colpick-group-head"><span class="filter-group-title">${esc(label)}</span>
        <button type="button" class="t-link" onclick="colSetGroup('${id}', '${g}', ${on !== items.length})">${on === items.length ? 'Hide all' : 'Show all'}</button></div>
      <div class="colpick-options">${items.map(c => `<label class="check"><input type="checkbox" ${colVisible(id, c.key) ? 'checked' : ''} onchange="colSet('${id}', '${c.key}', this.checked)">${esc(c.label)}</label>`).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="colpick-head"><div class="h-card">Columns</div><div class="card-sub">${shown} of ${cols.length} shown${d.note ? ` · ${esc(d.note)}` : ''}</div></div>
    ${groups}
    <div class="filter-actions">
      ${d.defaultHidden ? `<button type="button" class="btn btn-ghost btn-sm" onclick="colResetDefault('${id}')" ${colIsDefault(id) ? 'disabled' : ''}>Reset to default</button>` : ''}
      <button type="button" class="btn btn-outline btn-sm" onclick="colShowAll('${id}')" ${shown === cols.length ? 'disabled' : ''}>Show all columns</button></div>`;
}
function colSet(id, key, on) {
  const d = columnPickers[id];
  const h = new Set(d.hidden);
  if (on) h.delete(key); else h.add(key);
  d.hidden = [...h];
  colChanged(id);
}
function colSetGroup(id, group, on) {
  const d = columnPickers[id];
  const h = new Set(d.hidden);
  d.columns().filter(c => c.group === group).forEach(c => on ? h.delete(c.key) : h.add(c.key));
  d.hidden = [...h];
  colChanged(id);
}
function colShowAll(id) { columnPickers[id].hidden = []; colChanged(id); }
function colResetDefault(id) { columnPickers[id].hidden = [...(columnPickers[id].defaultHidden || [])]; colChanged(id); }
function colIsDefault(id) {
  const d = columnPickers[id];
  const a = [...d.hidden].sort().join(), b = [...(d.defaultHidden || [])].sort().join();
  return a === b;
}
function colChanged(id) {
  const d = columnPickers[id];
  try { localStorage.setItem(d.storageKey, JSON.stringify(d.hidden)); } catch (e) { /* storage unavailable: keep in memory */ }
  if (d.onChange && window[d.onChange]) window[d.onChange]();
  renderRegion(`colpick-inner-${id}`, colPickerInner(id));
  const n = colHiddenCount(id);
  const badge = document.getElementById(`colpick-count-${id}`);
  if (badge) { badge.textContent = n; badge.hidden = !n; }
}

// ---------- Collapsible column groups ----------
// colLayout(id, cols): cols = the table's ordered, visible column defs (each with .group). Returns the columns to render
// (a collapsed group keeps only its summary column, or its first visible column) and the band groups.
function colLayout(id, cols) {
  const d = columnPickers[id];
  const columns = [], groups = [];
  d.groups.forEach(([key, label, o = {}]) => {
    const items = cols.filter(c => c.group === key);
    if (!items.length) return;
    const collapsed = !!d.collapsible && d.collapsed.includes(key);
    const shown = collapsed ? [items.find(c => c.key === o.summary) || items[0]] : items;
    const tone = o.tone || 'neutral';
    groups.push({ key, label, tone, collapsed, span: shown.length, hidden: items.length - shown.length });
    shown.forEach((c, i) => columns.push({ ...c, colGroup: key, colTone: tone, colStart: i === 0 }));
  });
  return { columns, groups };
}
// Classes for a grouped header or body cell: group tone, plus a separator on each group's first column.
function colCellClass(c) { return c.colGroup ? `colgrp-${c.colTone}${c.colStart ? ' colgrp-start' : ''}` : ''; }
// The band row above the column headers. lead/trail = fixed columns before/after the groups (name, Action).
// The lead cell holds "Collapse all / Expand all".
function colGroupHeaderRow(id, layout, { lead = 1, trail = 0 } = {}) {
  const anyOpen = layout.groups.some(g => !g.collapsed);
  const toggleAll = layout.groups.length > 1
    ? `<button type="button" class="colgrp-all" onclick="colSetAllGroups('${id}', ${anyOpen})"><i data-lucide="${anyOpen ? 'chevrons-left-right' : 'chevrons-right-left'}"></i>${anyOpen ? 'Collapse all' : 'Expand all'}</button>` : '';
  const blank = (n, cls, content = '') => n ? `<th class="colgrp-blank ${cls}"${n > 1 ? ` colspan="${n}"` : ''}>${content}</th>` : '';
  return `<tr class="colgrp-row">${blank(lead, 'colgrp-lead', toggleAll)}${layout.groups.map(g => `
    <th class="colgrp-band colgrp-${g.tone} colgrp-start ${g.collapsed ? 'is-collapsed' : ''}"${g.span > 1 ? ` colspan="${g.span}"` : ''}>
      <button type="button" class="colgrp-btn" onclick="colToggleGroup('${id}', '${g.key}')" aria-expanded="${!g.collapsed}"
        title="${g.collapsed ? `${g.hidden} more column${g.hidden === 1 ? '' : 's'} — click to expand` : 'Collapse this group'}">
        <i data-lucide="${g.collapsed ? 'chevron-right' : 'chevron-down'}"></i>${esc(g.label)}${g.collapsed && g.hidden ? `<span class="colgrp-more">+${g.hidden}</span>` : ''}
      </button></th>`).join('')}${blank(trail, 'colgrp-trail')}</tr>`;
}
function colToggleGroup(id, key) {
  const d = columnPickers[id];
  d.collapsed = d.collapsed.includes(key) ? d.collapsed.filter(k => k !== key) : [...d.collapsed, key];
  colSaveGroups(id);
}
function colSetAllGroups(id, collapse) {
  const d = columnPickers[id];
  d.collapsed = collapse ? d.groups.map(g => g[0]) : [];
  colSaveGroups(id);
}
function colSaveGroups(id) {
  const d = columnPickers[id];
  try { localStorage.setItem(d.collapsedKey, JSON.stringify(d.collapsed)); } catch (e) { /* storage unavailable: keep in memory */ }
  if (d.onChange && window[d.onChange]) window[d.onChange]();
}

// ---------- Pinned first and action columns ----------
// The first column of every table is pinned by CSS; this marks action columns and the scroll state.
// A table's last column is pinned when it is an action column: its header says Action/Actions or carries an
// *action* class, or the header is blank/Remove/Manage and every body row's last cell holds a button or row menu.
function markActionColumns(root = document) {
  root.querySelectorAll('.table-wrap > .table').forEach(table => {
    const head = table.querySelector('thead tr:last-child > :last-child');   // the column-name row, not a group band row
    const rows = [...table.querySelectorAll('tbody tr')].filter(r => r.children.length > 1);
    const explicit = !!head && (/action/i.test(head.textContent) || /action/i.test(head.className));
    const implicit = !!head && /^(remove|manage|)$/i.test(head.textContent.trim()) && rows.length > 0 &&
      rows.every(r => r.lastElementChild.querySelector('button, .menu-anchor, a'));
    table.classList.toggle('has-action-col', explicit || implicit);
    markTableScroll(table.parentElement);
  });
}
// is-overflowing: columns are hidden horizontally; at-end: scrolled fully right, nothing left behind the action column;
// is-scrolled: scrolled away from the start, so columns are passing under the pinned first column.
function markTableScroll(wrap) {
  wrap.classList.toggle('is-overflowing', wrap.scrollWidth > wrap.clientWidth + 1);
  wrap.classList.toggle('at-end', wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 1);
  wrap.classList.toggle('is-scrolled', wrap.scrollLeft > 1);
}
let actionColFrame;
new MutationObserver(() => { cancelAnimationFrame(actionColFrame); actionColFrame = requestAnimationFrame(() => markActionColumns()); })
  .observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('resize', () => markActionColumns());
document.addEventListener('scroll', e => { if (e.target.classList?.contains('table-wrap')) markTableScroll(e.target); }, true);

// ---------- Global listeners ----------
document.addEventListener('click', e => {
  if (!e.target.closest('.menu, .filter-panel, .ws-panel, .date-filter, .menu-anchor, [data-popover-trigger]')) closeAllPopovers();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeAllPopovers();
  if (document.getElementById('modal-root').innerHTML) closeModal();
  else if (document.getElementById('drawer-root').innerHTML) closeDrawer();
});
