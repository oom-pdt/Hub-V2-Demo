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
// ---------- Contract billing schedules (Agency CRM) ----------
// Payment terms as in the Agency CRM revamp (PAY_TERMS), plus 'Customised' (a non-standard schedule approved there).
const CRM_PAY_TERMS = ['100%', 'Pre-Paid', '50-50%', '60-20-20%', '50-30-20%', 'Monthly', 'Quarterly', 'Quarterly Pre-Paid', 'Bi-Annual'];
const CRM_PAY_TERM_LABEL = {
  '100%': 'One-time, 100% upfront', 'Pre-Paid': 'Pre-paid in full', '50-50%': '50% upfront, 50% midway', '60-20-20%': '60% upfront, 20% at 1/3, 20% at 2/3',
  '50-30-20%': '50% upfront, 30% at 1/3, 20% at 2/3', Monthly: 'Monthly', Quarterly: 'Quarterly', 'Quarterly Pre-Paid': 'Quarterly, pre-paid', 'Bi-Annual': 'Every 6 months', Customised: 'Customised schedule'
};
// Instalments for a term over a contract of `months`: [[months after start, share of the total]] (the CRM revamp's rules).
function crmInstalments(term, months, custom) {
  months = Math.max(1, Math.round(months) || 1);
  const n = k => Array.from({ length: k }, (_, i) => i);
  switch (term) {
    case '100%': case 'Pre-Paid': return [[0, 1]];
    case '50-50%': return [[0, 0.5], [Math.round(months / 2), 0.5]];
    case '60-20-20%': return [[0, 0.6], [Math.round(months / 3), 0.2], [Math.round(2 * months / 3), 0.2]];
    case '50-30-20%': return [[0, 0.5], [Math.round(months / 3), 0.3], [Math.round(2 * months / 3), 0.2]];
    case 'Quarterly': case 'Quarterly Pre-Paid': { const k = Math.ceil(months / 3); return n(k).map(i => [i * 3, 1 / k]); }
    case 'Bi-Annual': { const k = Math.max(1, Math.ceil(months / 6)); return n(k).map(i => [i * 6, 1 / k]); }
    case 'Customised': return custom && custom.length ? custom : [[0, 1]];
    default: return n(months).map(i => [i, 1 / months]);
  }
}
function crmMonths(start, end) { return Math.max(1, Math.round((new Date(end + 'T00:00:00') - new Date(start + 'T00:00:00')) / (86400000 * 30.44))); }
function crmAddMonths(iso, m) { const d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + m); return toDateInput(d); }
// Every contract in a workspace with its billing schedule: fee lines by the contract's payment term, media budget lines
// (when paid via OOm) by the media term, grouped into one instalment per billing date. value = what OOm bills in total.
function crmContracts(wsId) {
  const acc = crmAccounts[wsId];
  if (!acc) return [];
  const by = {};
  acc.services.forEach(x => {
    const no = x.contractNo || `${x.type}-${x.start}`;
    const c = by[no] = by[no] || { contractNo: x.contractNo || '—', start: x.start, end: x.end, services: [], fee: 0, media: 0, monthly: 0, ...(acc.contracts && acc.contracts[x.contractNo]) };
    c.services.push(x.type);
    c.monthly += x.monthlyBudget || 0;
    if (CRM_AD_SERVICES.includes(x.type)) { c.fee += x.monthlyFee || 0; c.media += x.monthlyBudget || 0; } else c.fee += x.monthlyBudget || 0;
  });
  return Object.values(by).map(c => {
    const months = crmMonths(c.start, c.end);
    const feeTotal = c.fee * months, mediaTotal = c.mediaVia === 'OOm' ? c.media * months : 0;
    const lines = [];
    const add = (label, total, term, custom) => {
      if (total <= 0) return;
      const ins = crmInstalments(term, months, custom);
      let acc2 = 0;
      ins.forEach(([off, f], i) => {
        const amount = i === ins.length - 1 ? Math.round((total - acc2) * 100) / 100 : Math.round(total * f * 100) / 100;
        acc2 += amount;
        lines.push({ date: crmAddMonths(c.start, off), label, n: i + 1, of: ins.length, amount });
      });
    };
    add(c.media ? 'Agency fee' : 'Service fee', feeTotal, c.payTerm || 'Monthly', c.custom);
    add('Media budget', mediaTotal, c.mediaTerm || 'Monthly');
    const dates = [...new Set(lines.map(l => l.date))].sort();
    const schedule = dates.map((date, i) => {
      const parts = lines.filter(l => l.date === date);
      return { date, n: i + 1, of: dates.length, parts, amount: Math.round(parts.reduce((t, l) => t + l.amount, 0) * 100) / 100 };
    });
    return { ...c, payTerm: c.payTerm || 'Monthly', months, feeTotal, mediaTotal, value: feeTotal + mediaTotal, schedule };
  });
}
// Open an OOm product's web app in a new tab (product.url), or say it isn't available in the demo.
function openProductApp(pid) {
  const p = productById(pid);
  if (p?.url) window.open(p.url, '_blank', 'noopener,noreferrer');
  else showToast(`Opening ${p ? p.name : 'the product'}…`, 'external-link');
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
const STATUS_PILL = { active: ['Active', 'pill-green'], new: ['New', 'pill-blue'], attention: ['Attention Required', 'pill-red'], inactive: ['Inactive', 'pill-orange'], cancelled: ['Cancelled', 'pill-red'], paused: ['Paused', 'pill-grey'] };
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
  // Meta mark: the official symbol path (Simple Icons, CC0), in Meta blue.
  meta: `<svg class="logo" viewBox="0 0 24 24" aria-label="Meta"><path fill="#0866FF" d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/></svg>`,
  // Coming-soon ad platforms (official marks, Simple Icons, CC0).
  linkedin: `<svg class="logo" viewBox="0 0 24 24" aria-label="LinkedIn"><path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  tiktok: `<svg class="logo" viewBox="0 0 24 24" aria-label="TikTok"><path fill="#000000" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`
};
const PLATFORM_NAME = { google: 'Google', meta: 'Meta', linkedin: 'LinkedIn', tiktok: 'TikTok' };
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
// opts.wide: the wider slide-over used for product and issue panels.
function openDrawer(bodyHtml, footerHtml = '', opts = {}) {
  document.getElementById('drawer-root').innerHTML = `
    <div class="drawer-backdrop open" onclick="closeDrawer()"></div>
    <aside class="drawer${opts.wide ? ' drawer-wide' : ''}" role="dialog" aria-modal="true">
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
  // Client: Google Ads-style presets (datePresetHTML), shown on the campaign tables and the SEO tab.
  client: { mode: 'preset', preset: 'last30', n: 30, pastNumber: 30, pastUnit: 'days', currentUnit: 'month', start: '', end: '', label: 'Last 30 days' }
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
  const day = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const monday = d => day(d, -((d.getDay() + 6) % 7));
  const out = (a, b) => ({ start: toDateInput(a), end: toDateInput(b) });
  if (cfg.mode === 'past') {
    // "Past N <unit>" = the last N complete periods before the current one (calendar-aligned):
    // past 1 week = Mon–Sun of last week, past 1 month = the whole of last month, past N days = N days up to yesterday.
    const n = Math.max(1, Number(cfg.pastNumber) || 30);
    if (cfg.pastUnit === 'weeks') { const end = day(monday(today), -1); return out(day(end, -7 * n + 1), end); }
    if (cfg.pastUnit === 'months') return out(new Date(today.getFullYear(), today.getMonth() - n, 1), new Date(today.getFullYear(), today.getMonth(), 0));
    if (cfg.pastUnit === 'years') return out(new Date(today.getFullYear() - n, 0, 1), new Date(today.getFullYear() - 1, 11, 31));
    return out(day(today, -n), day(today, -1));
  }
  if (cfg.mode === 'preset') {
    const n = Math.max(1, Number(cfg.n) || 30);
    switch (cfg.preset) {
      case 'today': return out(today, today);
      case 'yesterday': return out(day(today, -1), day(today, -1));
      case 'thisWeek': return out(monday(today), today);
      case 'last7': return out(day(today, -7), day(today, -1));
      case 'lastWeek': { const end = day(monday(today), -1); return out(day(end, -6), end); }
      case 'last14': return out(day(today, -14), day(today, -1));
      case 'thisMonth': return out(new Date(today.getFullYear(), today.getMonth(), 1), today);
      case 'last30': return out(day(today, -30), day(today, -1));
      case 'lastMonth': return out(new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0));
      case 'all': return out(new Date(cfg.allFrom ? cfg.allFrom + 'T00:00:00' : today.getFullYear() - 1 + '-01-01T00:00:00'), today);
      case 'upToToday': return out(day(today, -n + 1), today);
      case 'upToYesterday': return out(day(today, -n), day(today, -1));
    }
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

// ---------- Date presets (Google Ads-style picker, client campaign tables) ----------
// Left: presets (incl. "N days up to today / yesterday"); right: start and end dates plus a month calendar for a custom
// range. Compare is not offered: ad data is a live API call with no stored history.
const DATE_PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['thisWeek', 'This week (Mon – Today)'], ['last7', 'Last 7 days'], ['lastWeek', 'Last week (Mon – Sun)'],
  ['last14', 'Last 14 days'], ['thisMonth', 'This month'], ['last30', 'Last 30 days'], ['lastMonth', 'Last month'], ['all', 'All time']];
state.ui.dpDraft = {};
function dpLabel(c) {
  if (c.mode === 'range') return 'Custom';
  if (c.preset === 'upToToday') return `${c.n} days up to today`;
  if (c.preset === 'upToYesterday') return `${c.n} days up to yesterday`;
  return (DATE_PRESETS.find(p => p[0] === c.preset) || [, 'Last 30 days'])[1];
}
function datePresetHTML(scope, onApply) {
  const c = state.dateFilters[scope];
  const r = resolveDateRange(c) || {};
  return `<div class="date-filter dp" id="dp-${scope}" data-apply="${onApply}" onclick="event.stopPropagation()">
    <button type="button" class="date-trigger dp-trigger" onclick="dpToggle('${scope}')"><span class="dp-trigger-label"><b>${esc(dpLabel(c))}</b><span>${r.start ? `${esc(fmtDate(r.start))} – ${esc(fmtDate(r.end))}` : ''}</span></span><i data-lucide="calendar"></i></button>
    <div class="date-popover dp-popover" id="dp-${scope}-pop"></div>
  </div>`;
}
function dpToggle(scope) {
  const el = document.getElementById(`dp-${scope}`);
  const open = !el.classList.contains('open');
  closeAllPopovers();
  if (!open) return;
  const c = state.dateFilters[scope];
  const r = resolveDateRange(c) || resolveDateRange({ mode: 'preset', preset: 'last30' });
  const m = new Date(r.end + 'T00:00:00');
  state.ui.dpDraft[scope] = { mode: c.mode === 'range' ? 'range' : 'preset', preset: c.preset || 'last30', n: c.n || 30, start: r.start, end: r.end, pick: null, month: new Date(m.getFullYear(), m.getMonth(), 1), allFrom: c.allFrom };
  dpRender(scope);
  el.classList.add('open');
}
function dpRender(scope) {
  const d = state.ui.dpDraft[scope];
  const sel = (mode, preset) => d.mode === mode && (mode === 'range' || d.preset === preset) ? 'is-active' : '';
  const today = toDateInput(new Date());
  // Month calendar (the current draft month); click a start then an end date. Future dates are disabled.
  const y = d.month.getFullYear(), mo = d.month.getMonth();
  const first = (new Date(y, mo, 1).getDay() + 6) % 7, dim = new Date(y, mo + 1, 0).getDate();
  const cells = Array.from({ length: first }, () => '<span></span>').concat(Array.from({ length: dim }, (_, i) => {
    const iso = toDateInput(new Date(y, mo, i + 1));
    const inR = d.start && d.end && iso >= d.start && iso <= d.end;
    const edge = iso === d.start || iso === d.end;
    return `<button type="button" class="dp-day ${inR ? 'in-range' : ''} ${edge ? 'is-edge' : ''}" ${iso > today ? 'disabled' : ''} onclick="dpPickDay('${scope}','${iso}')">${i + 1}</button>`;
  })).join('');
  const monthName = d.month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  document.getElementById(`dp-${scope}-pop`).innerHTML = `
    <div class="dp-grid">
      <div class="dp-presets">
        <button type="button" class="dp-preset ${sel('range')}" onclick="dpCustom('${scope}')">Custom</button>
        <div class="dp-sep"></div>
        ${DATE_PRESETS.map(([k, l]) => `<button type="button" class="dp-preset ${sel('preset', k)}" onclick="dpPreset('${scope}','${k}')">${esc(l)}</button>`).join('')}
        <div class="dp-sep"></div>
        <label class="dp-n ${sel('preset', 'upToToday')}"><input class="input" type="number" min="1" max="999" value="${d.preset === 'upToToday' ? d.n : 30}" onchange="dpN('${scope}','upToToday',this.value)" onclick="dpN('${scope}','upToToday',this.value)">days up to today</label>
        <label class="dp-n ${sel('preset', 'upToYesterday')}"><input class="input" type="number" min="1" max="999" value="${d.preset === 'upToYesterday' ? d.n : 30}" onchange="dpN('${scope}','upToYesterday',this.value)" onclick="dpN('${scope}','upToYesterday',this.value)">days up to yesterday</label>
      </div>
      <div class="dp-cal">
        <div class="dp-dates">
          <label class="field"><span class="field-label">Start date<span class="req">*</span></span><input class="input" type="date" max="${today}" value="${d.start}" onchange="dpDate('${scope}','start',this.value)"></label>
          <span class="dp-dash">–</span>
          <label class="field"><span class="field-label">End date<span class="req">*</span></span><input class="input" type="date" max="${today}" value="${d.end}" onchange="dpDate('${scope}','end',this.value)"></label>
        </div>
        <div class="dp-month"><span class="t-bold">${esc(monthName)}</span><span>
          <button type="button" class="kebab" onclick="dpMonth('${scope}',-1)" aria-label="Previous month"><i data-lucide="chevron-left"></i></button>
          <button type="button" class="kebab" onclick="dpMonth('${scope}',1)" aria-label="Next month"><i data-lucide="chevron-right"></i></button></span></div>
        <div class="dp-week">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span>${x}</span>`).join('')}</div>
        <div class="dp-days">${cells}</div>
        <div class="dp-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="closeAllPopovers()">Cancel</button><button type="button" class="btn btn-primary btn-sm" onclick="dpApply('${scope}')">Apply</button></div>
      </div>
    </div>`;
  refreshIcons();
}
function dpSet(scope, patch) {
  const d = state.ui.dpDraft[scope];
  Object.assign(d, patch);
  if (d.mode === 'preset') { const r = resolveDateRange({ mode: 'preset', preset: d.preset, n: d.n, allFrom: d.allFrom }); d.start = r.start; d.end = r.end; const m = new Date(r.end + 'T00:00:00'); d.month = new Date(m.getFullYear(), m.getMonth(), 1); }
  dpRender(scope);
}
function dpPreset(scope, k) { dpSet(scope, { mode: 'preset', preset: k, pick: null }); }
function dpN(scope, k, v) { dpSet(scope, { mode: 'preset', preset: k, n: Math.max(1, Math.min(999, Number(v) || 30)), pick: null }); }
function dpCustom(scope) { dpSet(scope, { mode: 'range', pick: null }); }
function dpDate(scope, which, v) { if (v) dpSet(scope, { mode: 'range', [which]: v }); }
function dpMonth(scope, step) { const d = state.ui.dpDraft[scope]; d.month = new Date(d.month.getFullYear(), d.month.getMonth() + step, 1); dpRender(scope); }
// Calendar clicks: first click sets the start (and end), the second sets the end (swapped if earlier).
function dpPickDay(scope, iso) {
  const d = state.ui.dpDraft[scope];
  if (!d.pick) dpSet(scope, { mode: 'range', start: iso, end: iso, pick: iso });
  else dpSet(scope, { mode: 'range', start: iso < d.pick ? iso : d.pick, end: iso < d.pick ? d.pick : iso, pick: null });
}
function dpApply(scope) {
  const d = state.ui.dpDraft[scope];
  const c = state.dateFilters[scope];
  if (d.mode === 'range') Object.assign(c, { mode: 'range', start: d.start <= d.end ? d.start : d.end, end: d.start <= d.end ? d.end : d.start });
  else Object.assign(c, { mode: 'preset', preset: d.preset, n: d.n });
  const r = resolveDateRange(c);
  c.label = c.mode === 'range' ? `${fmtDate(r.start)} – ${fmtDate(r.end)}` : dpLabel(c);
  closeAllPopovers();
  const fn = document.getElementById(`dp-${scope}`)?.dataset.apply;
  if (fn && window[fn]) window[fn]();
}

// ---------- Column picker (show / hide table columns) ----------
// registerColumnPicker('campaigns', {
//   columns: () => [{ key, group, label }],   // toggleable columns (fixed columns are simply not listed)
//   groups: [['delivery', 'Delivery', { summary: 'spend' }], …],  // default order, labels; summary = the column placed first by default;
//                                                                  // empty groups are skipped (tone is optional; bands share one colour)
//   collapsible: true,                          // optional: column groups get a band row, collapse to their first column,
//                                               // and columns / groups can be reordered (picker handles or dragging headers)
//   note: 'Name and Action are always shown',
//   onChange: 'dashRefreshCampaignTable',      // global fn re-rendering the table
//   storageKey: 'galaxis-demo:…',              // optional; hidden columns are a per-viewer convenience
//   defaultHidden: ['cpm', …],                 // optional; columns hidden until the viewer changes them (Reset to default restores)
//   defaultCollapsed: ['ads', …]               // optional; groups collapsed to their first column until the viewer expands them
// })
const columnPickers = {};
function registerColumnPicker(id, def) {
  def.storageKey = def.storageKey || `galaxis-demo:${id}-columns-hidden`;
  try { def.hidden = JSON.parse(localStorage.getItem(def.storageKey)) || def.defaultHidden || []; } catch (e) { def.hidden = def.defaultHidden || []; }
  def.collapsedKey = def.collapsedKey || `galaxis-demo:${id}-groups-collapsed`;
  try { def.collapsed = JSON.parse(localStorage.getItem(def.collapsedKey)) || [...(def.defaultCollapsed || [])]; } catch (e) { def.collapsed = [...(def.defaultCollapsed || [])]; }   // default: defaultCollapsed, else all expanded
  // Viewer's order: { groups: [groupKey…], cols: { groupKey: [colKey…] } }; null = default order.
  def.orderKey = def.orderKey || `galaxis-demo:${id}-order`;
  try { def.order = JSON.parse(localStorage.getItem(def.orderKey)) || null; } catch (e) { def.order = null; }
  columnPickers[id] = def;
}

// ---------- Column order ----------
// Default: the groups in definition order; within a group the summary (key) column first, then definition order.
// A collapsed group shows its first visible column, so whatever the viewer drags to the front is what stays visible.
function colGroupOrder(id) {
  const d = columnPickers[id];
  const keys = d.groups.map(g => g[0]);
  const saved = (d.order && d.order.groups || []).filter(k => keys.includes(k));
  return [...saved, ...keys.filter(k => !saved.includes(k))];
}
function colSortGroup(id, g, items) {
  const d = columnPickers[id];
  const summary = (d.groups.find(x => x[0] === g) || [])[2]?.summary;
  const base = [...items].sort((a, b) => (b.key === summary) - (a.key === summary));
  const saved = d.order && d.order.cols && d.order.cols[g];
  if (!saved) return base;
  const pos = new Map(base.map((c, i) => [c.key, i]));
  const rank = k => { const i = saved.indexOf(k); return i < 0 ? saved.length + pos.get(k) : i; };
  return base.sort((a, b) => rank(a.key) - rank(b.key));
}
// Columns in the viewer's order (groups, then within each group), ignoring collapse. Used for CSV exports.
function colOrdered(id, cols) { return colGroupOrder(id).flatMap(g => colSortGroup(id, g, cols.filter(c => c.group === g))); }
function colSaveOrder(id) {
  const d = columnPickers[id];
  try { localStorage.setItem(d.orderKey, JSON.stringify(d.order)); } catch (e) { /* storage unavailable: keep in memory */ }
  colChanged(id);
}
// Move column `key` before / after `target` (same group only), or a group before / after another group.
function colMove(id, key, target, after) {
  const d = columnPickers[id];
  const all = d.columns();
  const c = all.find(x => x.key === key), t = all.find(x => x.key === target);
  if (!c || !t || c.group !== t.group || key === target) return;
  const list = colSortGroup(id, c.group, all.filter(x => x.group === c.group)).map(x => x.key).filter(k => k !== key);
  list.splice(list.indexOf(target) + (after ? 1 : 0), 0, key);
  const prev = (d.order && d.order.cols && d.order.cols[c.group]) || [];
  d.order = { groups: (d.order && d.order.groups) || null, cols: { ...((d.order && d.order.cols) || {}), [c.group]: [...list, ...prev.filter(k => !list.includes(k))] } };
  if (!d.order.groups) delete d.order.groups;
  colSaveOrder(id);
}
function colMoveGroup(id, g, target, after) {
  const d = columnPickers[id];
  if (g === target) return;
  const list = colGroupOrder(id).filter(k => k !== g);
  list.splice(list.indexOf(target) + (after ? 1 : 0), 0, g);
  d.order = { ...(d.order || {}), groups: list };
  colSaveOrder(id);
}
// Keyboard: arrow keys on a picker handle move the column / group one place.
function colMoveStep(ev, id, kind, key, group) {
  if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
  ev.preventDefault();
  const down = ev.key === 'ArrowDown';
  if (kind === 'group') {
    const list = colGroupOrder(id).filter(g => columnPickers[id].columns().some(c => c.group === g));
    const i = list.indexOf(key), j = i + (down ? 1 : -1);
    if (j >= 0 && j < list.length) colMoveGroup(id, key, list[j], down);
  } else {
    const list = colSortGroup(id, group, columnPickers[id].columns().filter(c => c.group === group)).map(c => c.key);
    const i = list.indexOf(key), j = i + (down ? 1 : -1);
    if (j >= 0 && j < list.length) colMove(id, key, list[j], down);
  }
  requestAnimationFrame(() => document.querySelector(`#colpick-inner-${id} [data-handle="${kind}:${key}"]`)?.focus());
}
// Drag and drop (picker rows and table headers). Columns only drop within their own group.
let colDrag = null;
function colDragStart(ev, id, kind, key, group) {
  colDrag = { id, kind, key, group };
  ev.dataTransfer.effectAllowed = 'move';
  try { ev.dataTransfer.setData('text/plain', key); } catch (e) { /* some browsers restrict dataTransfer */ }
  ev.currentTarget.classList.add('is-dragging');
  // Dragging a whole group in the picker folds every group's column list, so only the group names are left to reorder.
  // Applied a frame later: changing layout inside dragstart can cancel the drag in some browsers.
  const panel = kind === 'group' && ev.currentTarget.closest('.colpick-panel');
  if (panel) requestAnimationFrame(() => panel.classList.add('is-group-drag'));
}
function colEndGroupDrag() { document.querySelectorAll('.colpick-panel.is-group-drag').forEach(p => p.classList.remove('is-group-drag')); }
function colDragOk(id, kind, group) { return colDrag && colDrag.id === id && colDrag.kind === kind && (kind === 'group' || colDrag.group === group); }
function colDropAfter(ev, horizontal) { const r = ev.currentTarget.getBoundingClientRect(); return horizontal ? ev.clientX > r.left + r.width / 2 : ev.clientY > r.top + r.height / 2; }
function colDragOver(ev, id, kind, group, horizontal) {
  if (!colDragOk(id, kind, group)) return;
  ev.preventDefault();
  const after = colDropAfter(ev, horizontal);
  ev.currentTarget.classList.toggle('is-drop-after', after);
  ev.currentTarget.classList.toggle('is-drop-before', !after);
}
function colDragLeave(ev) { ev.currentTarget.classList.remove('is-drop-before', 'is-drop-after'); }
function colDrop(ev, id, kind, key, group, horizontal) {
  colDragLeave(ev);
  colEndGroupDrag();
  if (!colDragOk(id, kind, group)) return;
  ev.preventDefault();
  const d = colDrag; colDrag = null;
  if (kind === 'group') colMoveGroup(id, d.key, key, colDropAfter(ev, horizontal));
  else colMove(id, d.key, key, colDropAfter(ev, horizontal));
}
function colDragEnd(ev) { colDrag = null; ev.currentTarget.classList.remove('is-dragging'); colEndGroupDrag(); }
// Drag attributes for a reorderable table header cell (column) or band cell (group).
function colDragAttrs(id, kind, key, group = '') {
  if (!columnPickers[id] || !columnPickers[id].collapsible) return '';
  const a = `'${id}','${kind}','${key}','${group}'`;
  return ` draggable="true" ondragstart="colDragStart(event,${a})" ondragover="colDragOver(event,'${id}','${kind}','${group}',true)" ondragleave="colDragLeave(event)" ondrop="colDrop(event,${a},true)" ondragend="colDragEnd(event)"`;
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
  const sortable = !!d.collapsible;
  const label = g => (d.groups.find(x => x[0] === g) || [])[1] || g;
  // Reorderable pickers: grip handles (drag, or arrow keys) on groups and on columns within a group.
  const handle = (kind, key, group, name) => sortable ? `<button type="button" class="colpick-grip" data-handle="${kind}:${key}" aria-label="Move ${esc(name)} (arrow keys)" title="Drag to reorder"
      onkeydown="colMoveStep(event,'${id}','${kind}','${key}','${group}')"><i data-lucide="grip-vertical"></i></button>` : '';
  const dnd = (kind, key, group) => sortable ? ` draggable="true" ondragstart="colDragStart(event,'${id}','${kind}','${key}','${group}')" ondragover="colDragOver(event,'${id}','${kind}','${group}',false)" ondragleave="colDragLeave(event)" ondrop="colDrop(event,'${id}','${kind}','${key}','${group}',false)" ondragend="colDragEnd(event)"` : '';
  const groups = (sortable ? colGroupOrder(id) : d.groups.map(x => x[0])).map(g => {
    const items = sortable ? colSortGroup(id, g, cols.filter(c => c.group === g)) : cols.filter(c => c.group === g);
    if (!items.length) return '';
    const on = items.filter(c => colVisible(id, c.key)).length;
    return `<div class="filter-group colpick-group"${dnd('group', g, '')}>
      <div class="colpick-group-head">${handle('group', g, '', label(g))}<span class="filter-group-title">${esc(label(g))}</span>
        <button type="button" class="t-link" onclick="colSetGroup('${id}', '${g}', ${on !== items.length})">${on === items.length ? 'Hide all' : 'Show all'}</button></div>
      <div class="colpick-options ${sortable ? 'colpick-sortable' : ''}">${items.map((c, i) => `<div class="colpick-item"${dnd('col', c.key, g)}>${handle('col', c.key, g, c.label)}<label class="check"><input type="checkbox" ${colVisible(id, c.key) ? 'checked' : ''} onchange="colSet('${id}', '${c.key}', this.checked)">${esc(c.label)}</label>${sortable && d.collapsible && i === 0 ? '<span class="colpick-first" title="Shown when the group is collapsed">Shown when collapsed</span>' : ''}</div>`).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="colpick-head"><div class="h-card">Columns</div><div class="card-sub">${shown} of ${cols.length} shown${d.note ? ` · ${esc(d.note)}` : ''}${sortable ? '<br>Drag to reorder columns and groups. A collapsed group shows its first column.' : ''}</div></div>
    ${groups}
    <div class="filter-actions">
      ${d.defaultHidden || d.defaultCollapsed || d.collapsible ? `<button type="button" class="btn btn-ghost btn-sm" onclick="colResetDefault('${id}')" ${colIsDefault(id) ? 'disabled' : ''}>Reset to default</button>` : ''}
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
function colResetDefault(id) {
  const d = columnPickers[id];
  d.hidden = [...(d.defaultHidden || [])];
  d.collapsed = [...(d.defaultCollapsed || [])];
  d.order = null;
  try { localStorage.setItem(d.collapsedKey, JSON.stringify(d.collapsed)); localStorage.removeItem(d.orderKey); } catch (e) { /* keep in memory */ }
  colChanged(id);
}
function colIsDefault(id) {
  const d = columnPickers[id];
  const same = (x, y) => [...x].sort().join() === [...y].sort().join();
  return same(d.hidden, d.defaultHidden || []) && same(d.collapsed, d.defaultCollapsed || []) && !d.order;
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
// colLayout(id, cols): cols = the table's visible column defs (each with .group). Returns the columns to render in the
// viewer's order (a collapsed group keeps only its first visible column) and the band groups.
function colLayout(id, cols) {
  const d = columnPickers[id];
  const columns = [], groups = [];
  colGroupOrder(id).forEach(key => {
    const [, label, o = {}] = d.groups.find(g => g[0] === key);
    const items = colSortGroup(id, key, cols.filter(c => c.group === key));
    if (!items.length) return;
    const collapsed = !!d.collapsible && d.collapsed.includes(key);
    const shown = collapsed ? [items[0]] : items;
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
    <th class="colgrp-band colgrp-${g.tone} colgrp-start ${g.collapsed ? 'is-collapsed' : ''}"${g.span > 1 ? ` colspan="${g.span}"` : ''}${colDragAttrs(id, 'group', g.key)}>
      <button type="button" class="colgrp-btn" onclick="colToggleGroup('${id}', '${g.key}')" aria-expanded="${!g.collapsed}"
        title="${esc(g.label)} · ${g.collapsed ? `${g.hidden} more column${g.hidden === 1 ? '' : 's'} — click to expand` : 'click to collapse'}">
        <i data-lucide="${g.collapsed ? 'chevron-right' : 'chevron-down'}"></i><span class="colgrp-label">${esc(g.label)}</span>${g.collapsed && g.hidden ? `<span class="colgrp-more">+${g.hidden}</span>` : ''}
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
