// Galaxis Hub demo — Leads and Lead Profile (ported from V2). Client workspaces with an active CRM only.
// All leads are generated placeholders: fictional names, example.com emails, +65 0000 00xx phones.

const LEAD_SOURCES = ['Google Ads (Search)', 'Meta WhatsApp Ad', 'SleekFlow', 'Delacon', 'Aurix chat', 'Website form'];
const LEAD_STATUSES = ['New', 'Qualified', 'Converted', 'Lost'];
const LEAD_PILL = { New: 'pill-grey', Qualified: 'pill-blue', Converted: 'pill-green', Lost: 'pill-red' };
const LEAD_FIRST = ['Avery', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Quinn', 'Taylor', 'Skyler', 'Rowan', 'Emerson', 'Harper', 'Kai', 'Remy', 'Sage', 'Reese', 'Dakota', 'Finley', 'Ellis', 'Marlow', 'Jules'];
const LEAD_LAST = ['Sample', 'Example', 'Demo', 'Mockridge', 'Testwell', 'Draftly', 'Placeholder', 'Prototype', 'Specimen', 'Fixture'];
const LEAD_TODAY = '2026-10-21';
const LEAD_PER_PAGE = 15;

state.ui.leadStatus = state.ui.leadStatus || 'All';
state.ui.leadSearch = state.ui.leadSearch || '';

const leadCache = {};

function leadHash(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function leadAddDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toDateInput(d); }
function leadPick(r, list) { return list[Math.floor(r() * list.length)]; }

// Owners: client staff of the workspace plus agency staff assigned to it.
function leadOwners(wsId) {
  const list = members.filter(m => m.status === 'active' && (m.org === wsId || (m.org === 'agency' && (m.workspaces.includes('*') || m.workspaces.includes(wsId)))));
  return list.length ? list.map(m => m.name) : ['Unassigned'];
}

function leadsFor(wsId) {
  if (leadCache[wsId]) return leadCache[wsId];
  const ws = wsById(wsId);
  const r = seededRandom((ws ? ws.seed : 1) * 7 + 3);
  const owners = leadOwners(wsId);
  const list = [];
  for (let i = 0; i < 45; i++) {
    const first = LEAD_FIRST[(i * 7 + (ws ? ws.seed : 0)) % LEAD_FIRST.length];
    const last = LEAD_LAST[Math.floor(r() * LEAD_LAST.length)];
    const roll = r();
    const status = roll < 0.3 ? 'New' : roll < 0.55 ? 'Qualified' : roll < 0.85 ? 'Converted' : 'Lost';
    // Lifetime value is the sum of contracts: only converted (and some churned, now-lost) leads have any.
    const ltv = status === 'Converted' || (status === 'Lost' && r() < 0.3) ? Math.round((2 + r() * 118)) * 1000 + Math.round(r() * 9) * 111 : 0;
    list.push({
      id: `${wsId}-L${String(i + 1).padStart(3, '0')}`,
      wsId,
      name: `${first} ${last}`,
      email: `${first}.${last}${i + 1}@example.com`.toLowerCase(),
      phone: `+65 0000 00${String(i + 1).padStart(2, '0')}`,
      source: leadPick(r, LEAD_SOURCES),
      owner: leadPick(r, owners),
      status,
      created: leadAddDays(LEAD_TODAY, -Math.floor(i * 2.6 + r() * 2)),
      ltv,
      record: `#${10000 + Math.floor(r() * 89999)}`
    });
  }
  leadCache[wsId] = list;
  return list;
}
function leadById(id) { return state.ctx ? leadsFor(state.ctx).find(l => l.id === id) : null; }

// ---------- Authority: who owns lead data ----------
// 'mirror' = third-party CRM is the system of record (read-only here); 'full' = Galaxis CRM (CRM-lite / Institute CRM).
function leadAuthority() {
  if (state.flags.leadAuthority) return state.flags.leadAuthority;
  const crm = activeCrm(state.ctx);
  return crm && crm.provider === 'third' ? 'mirror' : 'full';
}
function leadCanEdit() { return leadAuthority() === 'full'; }
function leadCrmName() { const c = activeCrm(state.ctx); return c ? c.name : 'your CRM'; }
function leadChatChannel() {
  const p = wsProducts(state.ctx);
  if (p.sleekflow && p.sleekflow.status !== 'disabled') return 'SleekFlow';
  if (p.aurix && p.aurix.status !== 'disabled') return 'Aurix';
  return 'SleekFlow';
}
function leadPill(status) { return `<span class="pill ${LEAD_PILL[status] || 'pill-grey'}">${esc(status)}</span>`; }
function leadMoney(n) { return n ? fmtMoney(n) : '<span class="t-muted">—</span>'; }

function leadNoCrmHTML() {
  return `<section class="card"><div class="empty">
    <i data-lucide="contact"></i>
    <div class="empty-title">No CRM connected</div>
    <div class="t-caption">Leads appear here once a CRM is connected and active for ${esc(currentWs()?.name || 'this workspace')}.</div>
    <button type="button" class="btn btn-primary" style="margin-top:16px" onclick="navigate('integrations')"><i data-lucide="blocks"></i>Connect a CRM</button>
  </div></section>`;
}

function leadAuthorityBanner() {
  const crm = leadCrmName();
  if (leadCanEdit()) {
    return `<div class="banner banner-success"><i data-lucide="shield-check"></i><div>
      <div class="banner-title">Galaxis CRM active — full edit</div>
      <div class="banner-text">${esc(crm)} is the system of record. Add leads and update statuses here; channel data from connected products keeps syncing in.</div></div></div>`;
  }
  return `<div class="banner banner-info"><i data-lucide="lock"></i><div>
    <div class="banner-title">Managed in ${esc(crm)} — Read-only mirror</div>
    <div class="banner-text">Edit leads in ${esc(crm)}. Lead details, statuses and deal values sync to Galaxis automatically.</div></div>
    <button type="button" class="banner-action" onclick="showToast('Opening ${q(crm)}…', 'external-link')">Open ${esc(crm)} ↗</button></div>`;
}

// ---------- Leads list ----------
function leadFiltered() {
  const term = state.ui.leadSearch.trim().toLowerCase();
  return leadsFor(state.ctx).filter(l => !term || l.name.toLowerCase().includes(term) || l.email.includes(term) || l.source.toLowerCase().includes(term));
}

function leadsRender() {
  if (!activeCrm(state.ctx)) return leadNoCrmHTML();
  const total = leadsFor(state.ctx).length;
  return `<div class="stack">
    ${leadAuthorityBanner()}
    <section class="card">
      <div class="card-header">
        <div><h2 class="h-card lead-card-title">All Leads</h2><div class="card-sub">${total} leads synchronised from ${esc(leadCrmName())}, Google Ads, Meta and connected chat and call products.</div></div>
        ${leadCanEdit() ? '<button type="button" class="btn btn-primary" onclick="leadOpenAdd()"><i data-lucide="plus"></i>Add Lead</button>' : ''}
      </div>
      <div class="table-toolbar lead-toolbar">
        <div id="lead-filter-region">${leadFilterHTML()}</div>
        <div class="search lead-search"><input class="input" id="lead-search" placeholder="Search name, email or source" value="${esc(state.ui.leadSearch)}" oninput="leadOnSearch(this.value)" aria-label="Search leads"><i data-lucide="search"></i></div>
      </div>
      <div id="lead-table-region">${leadTableHTML()}</div>
    </section>
  </div>`;
}

function leadFilterHTML() {
  const list = leadFiltered();
  const count = s => s === 'All' ? list.length : list.filter(l => l.status === s).length;
  return `<div class="seg" role="tablist" aria-label="Filter by status">${['All', ...LEAD_STATUSES].map(s =>
    `<button type="button" class="${state.ui.leadStatus === s ? 'active' : ''}" onclick="leadSetStatusFilter('${s}')">${s} <span class="lead-count">${count(s)}</span></button>`).join('')}</div>`;
}

function leadTableHTML() {
  const edit = leadCanEdit();
  let list = leadFiltered();
  if (state.ui.leadStatus !== 'All') list = list.filter(l => l.status === state.ui.leadStatus);
  const order = { New: 0, Qualified: 1, Converted: 2, Lost: 3 };
  list = applySort(list, 'leads', {
    name: l => l.name, phone: l => l.phone, source: l => l.source, owner: l => l.owner, status: l => order[l.status], created: l => l.created, ltv: l => l.ltv
  }, { col: 'created', dir: 'desc' });
  pager('leads', LEAD_PER_PAGE);
  const page = paginate(list, 'leads');
  const th = (col, label, cls = '') => `<th class="${cls}">${sortHeader('leads', col, label, 'leadRefreshTable')}</th>`;
  const term = state.ui.leadSearch.trim();
  const emptyMsg = term ? `No leads found matching “${term}”${state.ui.leadStatus !== 'All' ? ` with status ${state.ui.leadStatus}` : ''}.` : `No ${state.ui.leadStatus.toLowerCase()} leads yet.`;
  const rows = page.map(l => `<tr class="clickable" onclick="leadOpen('${q(l.id)}')">
      <td><div class="t-bold">${esc(l.name)}</div><div class="cell-sub">${esc(l.email)}</div></td>
      <td>${esc(l.phone)}</td>
      <td>${esc(l.source)}</td>
      <td>${esc(l.owner)}</td>
      <td>${leadPill(l.status)}</td>
      <td>${esc(fmtDate(l.created))}</td>
      <td class="num">${leadMoney(l.ltv)}</td>
      ${edit ? `<td class="lead-actions" onclick="event.stopPropagation()">${rowMenu(`lead-menu-${l.id}`, [
        { label: 'View profile', icon: 'user', onClick: `leadOpen('${q(l.id)}')` },
        { label: 'Edit status', icon: 'pencil', onClick: `leadOpenStatus('${q(l.id)}')` }
      ])}</td>` : ''}
    </tr>`).join('');
  // Shared paginationBar offers 10 / 20 / 50; Leads defaults to 15 per page (V2), so add that option.
  const p = pager('leads');
  const bar = paginationBar('leads', list.length, 'leadRefreshTable').replace('<option value="20"', `<option value="15" ${p.perPage === 15 ? 'selected' : ''}>15</option><option value="20"`);
  return `<div class="table-wrap"><table class="table lead-table">
    <thead><tr>${th('name', 'Name & Email')}${th('phone', 'Phone')}${th('source', 'Source')}${th('owner', 'Owner')}${th('status', 'Status')}${th('created', 'Created')}${th('ltv', 'Lifetime Value', 'num')}${edit ? '<th aria-label="Actions"></th>' : ''}</tr></thead>
    <tbody>${rows || `<tr><td colspan="${edit ? 8 : 7}" class="table-empty">${emptyState('search-x', 'No leads found', emptyMsg)}</td></tr>`}</tbody>
  </table></div>${bar}`;
}

function leadRefreshTable() {
  renderRegion('lead-filter-region', leadFilterHTML());
  renderRegion('lead-table-region', leadTableHTML());
}
function leadOnSearch(v) { state.ui.leadSearch = v; pager('leads', LEAD_PER_PAGE).page = 1; leadRefreshTable(); }
function leadSetStatusFilter(s) { state.ui.leadStatus = s; pager('leads', LEAD_PER_PAGE).page = 1; leadRefreshTable(); }
function leadOpen(id) { navigate('lead', { leadId: id }); }

// ---------- Add lead / edit status (full-edit mode only) ----------
function leadSelect(id, options, value) {
  return `<select class="select" id="${id}">${options.map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
}
function leadOpenAdd() {
  if (!leadCanEdit()) return;
  const owners = leadOwners(state.ctx);
  openModal({
    title: 'Add Lead', desc: `The lead is created in ${leadCrmName()} and appears in this list straight away.`, size: 'lg',
    body: `
      <div class="grid-2" style="gap:16px">
        <div class="field"><label class="field-label" for="lead-f-name">Full Name<span class="req">*</span></label><input class="input" id="lead-f-name" placeholder="e.g. Avery Sample"><div class="field-error" id="lead-e-name"></div></div>
        <div class="field"><label class="field-label" for="lead-f-email">Email<span class="req">*</span></label><input class="input" id="lead-f-email" placeholder="name@example.com"><div class="field-error" id="lead-e-email"></div></div>
        <div class="field"><label class="field-label" for="lead-f-phone">Phone</label><input class="input" id="lead-f-phone" placeholder="+65 0000 0000"><div class="field-error" id="lead-e-phone"></div></div>
        <div class="field"><label class="field-label" for="lead-f-source">First Touch Source</label>${leadSelect('lead-f-source', LEAD_SOURCES, 'Website form')}</div>
        <div class="field"><label class="field-label" for="lead-f-owner">Owner</label>${leadSelect('lead-f-owner', owners, owners[0])}</div>
        <div class="field"><label class="field-label" for="lead-f-status">Status</label>${leadSelect('lead-f-status', LEAD_STATUSES, 'New')}</div>
        <div class="field"><label class="field-label" for="lead-f-ltv">Deal Value (SGD)</label><input class="input" id="lead-f-ltv" type="number" min="0" step="1" placeholder="0"><div class="field-hint">Only for converted leads. Creates a contract.</div><div class="field-error" id="lead-e-ltv"></div></div>
      </div>
      <div class="field-hint">Use placeholder details only in this demo. Do not enter real personal data.</div>`,
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: 'Add Lead', icon: 'plus', onClick: leadSaveAdd }]
  });
}
function leadSaveAdd() {
  const v = id => document.getElementById(id).value.trim();
  const d = { name: v('lead-f-name'), email: v('lead-f-email').toLowerCase(), phone: v('lead-f-phone'), source: v('lead-f-source'), owner: v('lead-f-owner'), status: v('lead-f-status'), ltv: v('lead-f-ltv') };
  const list = leadsFor(state.ctx);
  const e = {};
  if (!d.name) e.name = 'Name is required.';
  if (!isEmail(d.email)) e.email = 'Enter a valid email address.';
  else if (list.some(l => l.email === d.email)) e.email = 'A lead with this email already exists.';
  if (d.phone && !/^\+?[\d\s-]{8,}$/.test(d.phone)) e.phone = 'Enter a valid phone number, e.g. +65 0000 0000.';
  const ltv = d.ltv === '' ? 0 : Number(d.ltv);
  if (!(ltv >= 0) || !Number.isFinite(ltv)) e.ltv = 'Deal value must be 0 or more.';
  else if (ltv > 0 && d.status !== 'Converted') e.ltv = 'Only converted leads can have a deal value.';
  ['name', 'email', 'phone', 'ltv'].forEach(k => {
    document.getElementById(`lead-e-${k}`).textContent = e[k] || '';
    document.getElementById(`lead-f-${k}`).classList.toggle('invalid', !!e[k]);
  });
  if (Object.keys(e).length) return false;
  const n = list.length + 1;
  list.unshift({
    id: `${state.ctx}-N${String(n).padStart(3, '0')}-${leadHash(d.email) % 1000}`, wsId: state.ctx, name: d.name, email: d.email,
    phone: d.phone || '—', source: d.source, owner: d.owner, status: d.status, created: toDateInput(new Date()), ltv: Math.round(ltv), record: `#${10000 + leadHash(d.email) % 89999}`
  });
  state.ui.leadStatus = 'All'; state.ui.leadSearch = '';
  state.sorts.leads = { col: 'created', dir: 'desc' };
  pager('leads', LEAD_PER_PAGE).page = 1;
  rerender();
  showToast(`${d.name} added to ${leadCrmName()}`, 'user-plus');
}

function leadOpenStatus(id) {
  const l = leadById(id);
  if (!l || !leadCanEdit()) return;
  openModal({
    title: 'Edit Lead Status', desc: `${l.name} · currently ${l.status}`,
    body: `<div class="field"><label class="field-label" for="lead-s-status">Status</label>
        <select class="select" id="lead-s-status" onchange="document.getElementById('lead-s-ltv-wrap').hidden = this.value !== 'Converted'">${LEAD_STATUSES.map(s => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field" id="lead-s-ltv-wrap" ${l.status === 'Converted' ? '' : 'hidden'}><label class="field-label" for="lead-s-ltv">Deal Value (SGD)</label>
        <input class="input" id="lead-s-ltv" type="number" min="0" step="1" value="${l.ltv || ''}" placeholder="0"><div class="field-hint">Lifetime value equals the total of this lead's contracts.</div><div class="field-error" id="lead-s-err"></div></div>`,
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: 'Save Status', onClick: () => leadSaveStatus(id) }]
  });
}
function leadSaveStatus(id) {
  const l = leadById(id);
  const status = document.getElementById('lead-s-status').value;
  const raw = document.getElementById('lead-s-ltv').value.trim();
  if (status === 'Converted') {
    const n = raw === '' ? 0 : Number(raw);
    if (!(n >= 0) || !Number.isFinite(n)) { document.getElementById('lead-s-err').textContent = 'Deal value must be 0 or more.'; return false; }
    l.ltv = Math.round(n);
  }
  leadApplyStatus(l, status);
}
// Header status select on the profile.
function leadQuickStatus(id, status) {
  const l = leadById(id);
  if (status === 'Converted' && !l.ltv) { rerender(); leadOpenStatus(id); document.getElementById('lead-s-status').value = 'Converted'; document.getElementById('lead-s-ltv-wrap').hidden = false; return; }
  leadApplyStatus(l, status);
}
function leadApplyStatus(l, status) {
  const prev = l.status;
  l.status = status;
  rerender();
  showToast(prev === status ? `${l.name} updated` : `${l.name} moved from ${prev} to ${status}`);
}

// ---------- Lead profile (generated per lead, deterministic) ----------
const LEAD_TL = {
  ad:     { icon: 'mouse-pointer-click', cls: 'lead-tl-blue', label: 'Ad click' },
  chat:   { icon: 'message-circle', cls: 'lead-tl-green', label: 'WhatsApp session' },
  aurix:  { icon: 'bot', cls: 'lead-tl-green', label: 'Chat session' },
  call:   { icon: 'phone-incoming', cls: 'lead-tl-orange', label: 'Inbound call' },
  form:   { icon: 'file-input', cls: 'lead-tl-purple', label: 'Lead created' },
  won:    { icon: 'trophy', cls: 'lead-tl-success', label: 'Deal won' },
  lost:   { icon: 'circle-x', cls: 'lead-tl-red', label: 'Marked lost' }
};
const LEAD_CHAT_FIRST = ['Hi, I’d like to find out more about your packages.', 'Hello, is this still available?', 'Can I get a quote for my team?', 'Hi, I saw your ad and have a few questions.', 'Do you offer a free consultation?'];
const LEAD_CHAT_LAST = ['Thanks, please send the proposal over.', 'Demo confirmed for next Tuesday.', 'Let me check with my manager and revert.', 'Great, see you at the appointment.', 'Could you share the pricing sheet?'];
const LEAD_AI_SUMMARY = ['Asked about pricing tiers and onboarding timeline.', 'Confirmed team size and requested a product demo.', 'Compared plans and asked for a case study [PLACEHOLDER].', 'Requested a callback to discuss contract terms.', 'Shared requirements and preferred start date.'];
const LEAD_INSIGHTS = [['Budget: [PLACEHOLDER] range', 'Decision maker: Yes', 'Timeline: within 3 months'], ['Interested in: annual plan', 'Preferred contact: WhatsApp', 'Team size: 10–50'], ['Main concern: onboarding effort', 'Competitor mentioned: [PLACEHOLDER]', 'Follow-up: proposal requested'], ['Intent: high', 'Asked for: product demo', 'Timeline: this quarter']];
const LEAD_CONTRACTS = ['Annual subscription — [PLACEHOLDER] plan', 'Onboarding & setup services', 'Additional seats', 'Renewal — 12 months', 'Training workshop'];

function leadTime(iso, r) { return `${iso}T${String(9 + Math.floor(r() * 9)).padStart(2, '0')}:${String(Math.floor(r() * 4) * 15).padStart(2, '0')}:00+08:00`; }

function leadDetail(l) {
  const r = seededRandom(leadHash(l.id) % 100000 + 11);
  const chatProduct = leadChatChannel();
  const crm = leadCrmName();
  const events = [];
  let day = leadAddDays(l.created, -Math.floor(r() * 3));
  const push = (type, extra) => {
    let at = leadTime(day, r);
    // Same-day touches must stay in order: place this one 1–3 hours after the previous touch.
    const prev = events[events.length - 1];
    if (prev && new Date(at) <= new Date(prev.at)) at = new Date(new Date(prev.at).getTime() + (1 + Math.floor(r() * 3)) * 3600000).toISOString();
    events.push({ type, at, ...extra });
    day = leadAddDays(day, Math.floor(r() * 3));
  };
  const adPlatform = l.source === 'Meta WhatsApp Ad' ? 'meta' : l.source === 'Google Ads (Search)' ? 'google' : (r() < 0.5 ? 'google' : 'meta');
  const campaign = adPlatform === 'google' ? leadPick(r, ['Search — Brand', 'Search — Generic', 'Performance Max']) : leadPick(r, ['CTWA — Lead Gen', 'Retargeting — Engaged', 'Awareness — Video']);
  const chat = () => {
    const msgs = 4 + Math.floor(r() * 18);
    push(chatProduct === 'Aurix' ? 'aurix' : 'chat', { messages: msgs, mins: 3 + Math.floor(r() * 25), summary: leadPick(r, LEAD_AI_SUMMARY) });
  };
  const call = () => push('call', { duration: `${1 + Math.floor(r() * 9)}m ${String(Math.floor(r() * 60)).padStart(2, '0')}s`, attributed: adPlatform === 'google' ? 'Google Ads (Search)' : 'Meta Ads', handledBy: l.owner });

  // First touch matches the lead's First Touch Source.
  if (l.source === 'Google Ads (Search)' || l.source === 'Meta WhatsApp Ad') push('ad', { platform: adPlatform, campaign });
  if (l.source === 'Meta WhatsApp Ad' || l.source === 'SleekFlow' || l.source === 'Aurix chat') chat();
  if (l.source === 'Delacon') call();
  push('form', { via: l.source === 'Website form' ? 'Website enquiry form' : `${l.source} (auto-created)`, crm });
  // Follow-up touches, keeping the total between 3 and 6 including the outcome.
  const outcome = l.status === 'Converted' ? 'won' : l.status === 'Lost' ? 'lost' : null;
  const max = 6 - (outcome ? 1 : 0);
  const extra = Math.floor(r() * 3);
  for (let i = 0; i < extra && events.length < max; i++) { if (r() < 0.6) chat(); else call(); }
  while (events.length + (outcome ? 1 : 0) < 3) chat();
  if (outcome === 'won') push('won', { value: l.ltv });
  if (outcome === 'lost') push('lost', { reason: leadPick(r, ['Budget not approved', 'Chose another provider', 'No response after follow-ups', 'Timing — revisit next year']) });

  // Contracts: total equals lifetime value.
  const contracts = [];
  if (l.ltv > 0) {
    const n = Math.min(3, 1 + Math.floor(r() * 3));
    let left = l.ltv;
    const startDay = events.find(e => e.type === 'won') ? events.find(e => e.type === 'won').at.slice(0, 10) : l.created;
    for (let i = 0; i < n; i++) {
      const val = i === n - 1 ? left : Math.round(left * (0.55 + r() * 0.2));
      left -= val;
      contracts.push({ id: `CON-2026-${String(100 + (leadHash(l.id + i) % 900)).padStart(4, '0')}`, desc: LEAD_CONTRACTS[(leadHash(l.id) + i) % LEAD_CONTRACTS.length], value: val, created: leadAddDays(startDay, i * 3) });
      if (left <= 0) break;
    }
  }

  const chats = events.filter(e => e.type === 'chat' || e.type === 'aurix');
  return {
    events,
    contracts,
    conversation: chats.length ? {
      product: chatProduct,
      sessions: chats.length,
      messages: chats.reduce((s, e) => s + e.messages, 0),
      first: { at: chats[0].at, text: leadPick(r, LEAD_CHAT_FIRST) },
      latest: { at: chats[chats.length - 1].at, text: leadPick(r, LEAD_CHAT_LAST) },
      insights: LEAD_INSIGHTS[leadHash(l.id) % LEAD_INSIGHTS.length]
    } : null
  };
}

function leadEventHTML(e) {
  const t = LEAD_TL[e.type];
  let title = '', box = '';
  if (e.type === 'ad') {
    title = `${platformLogo(e.platform)} ${e.platform === 'google' ? 'Google Ads' : 'Meta Ads'} click`;
    box = `<div>Campaign: <strong>${esc(e.campaign)}</strong></div><div class="t-muted">Click ID matched to this lead’s first session.</div>`;
  } else if (e.type === 'chat' || e.type === 'aurix') {
    title = `${e.type === 'chat' ? 'WhatsApp session' : 'Aurix chat session'} (${e.messages} messages) · ${esc(e.type === 'chat' ? 'SleekFlow' : 'Aurix')}`;
    box = `<div class="t-muted">Duration: ${e.mins} mins</div><div><strong>AI summary:</strong> ${esc(e.summary)}</div>`;
  } else if (e.type === 'call') {
    title = 'Inbound call · Delacon';
    box = `<div class="lead-call-grid"><div><span class="t-muted">Status</span><strong class="t-success">● Answered (${esc(e.duration)})</strong></div><div><span class="t-muted">Handled by</span><strong>${esc(e.handledBy)}</strong></div><div><span class="t-muted">Attributed source</span><strong>${esc(e.attributed)}</strong></div></div>`;
  } else if (e.type === 'form') {
    title = `Lead created · ${esc(e.crm)}`;
    box = `<div>Trigger: <strong>${esc(e.via)}</strong></div>`;
  } else if (e.type === 'won') {
    title = 'Deal won';
    box = `<div>Closed for <strong>${e.value ? fmtMoney(e.value) : 'an unrecorded value'}</strong>.</div>`;
  } else if (e.type === 'lost') {
    title = 'Marked as lost';
    box = `<div>Reason: <strong>${esc(e.reason)}</strong></div>`;
  }
  return `<li class="lead-tl-item">
    <span class="lead-tl-badge ${t.cls}" title="${esc(t.label)}"><i data-lucide="${t.icon}"></i></span>
    <div class="lead-tl-time">${esc(fmtDateTime(e.at))}</div>
    <div class="lead-tl-title">${title}</div>
    <div class="lead-tl-box">${box}</div>
  </li>`;
}

function leadProfileRender() {
  if (!activeCrm(state.ctx)) return leadNoCrmHTML();
  const l = leadById(state.params.leadId);
  const back = `<button type="button" class="t-link lead-back" onclick="navigate('leads')"><i data-lucide="arrow-left"></i>Back to Leads</button>`;
  if (!l) return `${back}<section class="card">${emptyState('user-x', 'Lead not found', 'This lead is not in the current workspace. Go back to the list to pick another lead.')}</section>`;
  const d = leadDetail(l);
  const crm = leadCrmName();
  const edit = leadCanEdit();
  const sorted = [...d.events].reverse();
  const range = `${fmtDate(d.events[0].at.slice(0, 10))} – ${fmtDate(d.events[d.events.length - 1].at.slice(0, 10))}`;
  const statusCtl = edit
    ? `<label class="lead-status-select"><span class="t-caption t-muted">Status</span><select class="select" onchange="leadQuickStatus('${q(l.id)}', this.value)" aria-label="Lead status">${LEAD_STATUSES.map(s => `<option ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`
    : `<span class="lead-readonly"><i data-lucide="lock"></i>Read-only (Synced via ${esc(crm)})</span>`;
  const row = (k, v) => `<div class="lead-dl-row"><span class="lead-dt">${esc(k)}</span><span class="lead-dd">${v}</span></div>`;
  const conv = d.conversation;
  const contractTotal = d.contracts.reduce((s, c) => s + c.value, 0);
  return `${back}
  <div class="stack">
    <section class="card lead-head">
      <div>
        <div class="row wrap" style="gap:14px"><h2 class="h-section lead-name">${esc(l.name)}</h2>${leadPill(l.status)}${statusCtl}</div>
        <div class="t-caption t-muted" style="margin-top:8px">Unified lead journey and marketing attribution record · ${esc(crm)} record ${esc(l.record)}</div>
      </div>
      <button type="button" class="btn btn-outline" onclick="showToast('Opening ${q(crm)}…', 'external-link')">Open in ${esc(crm)} ↗</button>
    </section>
    <div class="lead-layout">
      <div class="stack">
        <section class="card">
          <h3 class="h-card">Lead Details</h3>
          <div class="lead-dl">
            ${row('Email', esc(l.email))}
            ${row('Phone', esc(l.phone))}
            ${row('Owner', esc(l.owner))}
            ${row('Lifetime Value', `<strong class="t-primary">${fmtMoney(l.ltv)}</strong>`)}
            ${row('Status', leadPill(l.status))}
            ${row('First Touch Source', esc(l.source))}
            ${row('Created', esc(fmtDate(l.created)))}
          </div>
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="card-header"><div><h3 class="h-card">Conversation Summary</h3><div class="card-sub">${conv ? `${esc(conv.product)} · WhatsApp` : 'Chat channels'}</div></div>
            ${conv ? `<button type="button" class="btn btn-outline btn-sm" onclick="showToast('Opening ${q(conv.product)} inbox…', 'external-link')">Open inbox ↗</button>` : ''}</div>
          ${conv ? `
            <div class="lead-conv-stats">
              <div><div class="kv-label">Messages</div><div class="lead-stat">${conv.messages}</div></div>
              <div><div class="kv-label">Sessions</div><div class="lead-stat">${conv.sessions}</div></div>
              <div><div class="kv-label">First message</div><div class="t-caption">${esc(fmtDateTime(conv.first.at))}</div></div>
              <div><div class="kv-label">Latest message</div><div class="t-caption">${esc(fmtDateTime(conv.latest.at))}</div></div>
            </div>
            <div class="lead-quotes">
              <div><div class="t-caption t-muted">First message</div><div class="lead-quote">“${esc(conv.first.text)}”</div></div>
              <div><div class="t-caption t-muted">Latest message</div><div class="lead-quote">“${esc(conv.latest.text)}”</div></div>
            </div>
            <div class="lead-insights"><div class="lead-insights-title"><i data-lucide="sparkles"></i>AI key insights</div>
              <ul>${conv.insights.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`
          : emptyState('message-circle-off', 'No conversations synced', 'This lead has no WhatsApp or chat sessions yet.')}
        </section>
        <section class="card">
          <div class="card-header"><div><h3 class="h-card">Attribution Timeline</h3><div class="card-sub">${d.events.length} touchpoints · ${esc(range)}</div></div><span class="t-caption t-muted">Newest → Oldest</span></div>
          <ol class="lead-timeline">${sorted.map(leadEventHTML).join('')}</ol>
        </section>
        <section class="card">
          <div class="card-header"><div><h3 class="h-card">Contracts</h3><div class="card-sub">${d.contracts.length} contract${d.contracts.length === 1 ? '' : 's'}</div></div>
            <div class="lead-contract-total"><strong class="t-primary">${fmtMoney(contractTotal)}</strong> <span class="t-caption t-muted">lifetime value</span></div></div>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>ID</th><th>Description</th><th class="num">Value</th><th>Created</th></tr></thead>
            <tbody>${d.contracts.map(c => `<tr><td class="t-bold">${esc(c.id)}</td><td>${esc(c.desc)}</td><td class="num">${fmtMoney(c.value)}</td><td>${esc(fmtDate(c.created))}</td></tr>`).join('')
              || `<tr><td colspan="4" class="table-empty">No contracts yet. Lifetime value starts when the lead converts.</td></tr>`}</tbody>
          </table></div>
        </section>
      </div>
    </div>
  </div>`;
}

// ---------- Registration ----------
registerScreen('leads', {
  contexts: ['client'],
  key: () => 'client-leads',
  title: () => 'Leads',
  desc: () => activeCrm(state.ctx) ? `Leads synchronised from ${leadCrmName()} and connected channels.` : 'Connect a CRM to see your leads here.',
  render: leadsRender
});
registerScreen('lead', {
  contexts: ['client'],
  key: () => 'client-lead-profile',
  title: () => 'Lead Profile',
  desc: () => activeCrm(state.ctx) ? `Synchronised from ${leadCrmName()} and connected channels.` : 'Connect a CRM to see your leads here.',
  render: leadProfileRender
});

// Dev jumps need a workspace with an active CRM: use the current one if it has a CRM, otherwise Visual Studio (CRM-lite).
function leadDevCtx() { const c = devClientCtx(); return activeCrm(c) ? c : 'ws-visual'; }
registerDevScreen('Client workspace', 'client-leads', 'Leads', () => { state.ctx = leadDevCtx(); navigate('leads'); });
registerDevScreen('Client workspace', 'client-lead-profile', 'Lead Profile', () => {
  state.ctx = leadDevCtx();
  const cur = leadById(state.params.leadId);
  navigate('lead', { leadId: cur ? cur.id : leadsFor(state.ctx).find(l => l.status === 'Converted').id });
});
function leadDevToggles() {
  const f = state.flags.leadAuthority;
  const set = v => () => { state.flags.leadAuthority = v; rerender(); };
  return [
    { label: 'Auto (from CRM)', active: !f, run: set(undefined) },
    { label: 'Read-only mirror', active: f === 'mirror', run: set('mirror') },
    { label: 'Galaxis CRM (full edit)', active: f === 'full', run: set('full') }
  ];
}
registerDevToggles('client-leads', leadDevToggles);
registerDevToggles('client-lead-profile', leadDevToggles);

// ---------- Specs ----------
Object.assign(screenSpecs, {
  'client-leads': {
    title: 'Leads (Client workspace)', status: 'Draft', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `## Purpose
Ported from V2. Lists leads synchronised from the workspace's active CRM and connected channels (Google Ads, Meta, SleekFlow, Delacon, Aurix, website forms). No Figma frame — uses the Members table and card language.

## Visibility
- The **Leads** nav item appears only in a client workspace with an active, connected CRM (\`activeCrm\`).
- Without a CRM the page shows an empty state with **Connect a CRM** → Integrations.

## Authority banner
- Third-party CRM (HubSpot, Salesforce, Zoho, Dynamics): **"Managed in {CRM} — Read-only mirror"**. No add or edit controls.
- Galaxis CRM (CRM-lite, Institute CRM): **"Galaxis CRM active — full edit"**. Add Lead and Edit status are available.
- Dev toggles override the authority for the demo: Auto / Read-only mirror / Galaxis CRM (full edit).

## Table
- Status filter (All / New / Qualified / Converted / Lost, with counts) and search by name, email or source. Counts follow the search.
- Columns: Name & Email, Phone, Source, Owner, Status (Converted green, Qualified blue, New grey, Lost red), Created, Lifetime Value.
- All columns sort; default is newest first. 15 per page (V2), with 10 / 20 / 50 also available.
- Empty state: "No leads found matching …".
- Clicking a row opens the Lead Profile.
- Full edit adds a ⋮ menu (View profile / Edit status) and **Add Lead** (name, email, phone, source, owner, status, deal value; email must be valid and unique).

## Data
- About 45 leads per workspace, generated deterministically from the workspace seed. Owners are the workspace's active client members and assigned agency staff.
- Lifetime value is the sum of the lead's contracts, so New and Qualified leads show —.
- All names, emails (example.com) and phones (+65 0000 00xx) are placeholders.

## Open questions
- **Edit rights in Galaxis CRM mode:** can Client Users add or edit leads, or only Admins? Can agency staff edit a client's leads?
- **PDPA retention for mirrored leads:** how long does Galaxis keep a copy of leads mirrored from a third-party CRM, and are deletions in the CRM propagated? Needs a decision from the data protection owner.
- Should Lost leads with past contracts count towards attributed revenue?
- Is bulk export needed? (Not built: it would copy personal data out of the CRM.)`
  },
  'client-lead-profile': {
    title: 'Lead Profile (Client workspace)', status: 'Draft', author: 'Hannah', updatedAt: '21/10/2026',
    notes: `## Purpose
Ported from V2's Lead Intelligence profile: one lead's details, conversations, attribution journey and contracts.

## Header
- "← Back to Leads", lead name and status pill.
- Read-only mirror: a "Read-only (Synced via {CRM})" badge. Full edit: a status select (choosing Converted asks for the deal value).
- **Open in {CRM} ↗** (demo: toast "Opening {CRM}…").

## Left column — Lead Details
- Email, Phone, Owner, Lifetime Value, Status, First Touch Source, Created. All per lead (V2 left First Touch Source static).

## Right column
- **Conversation Summary** (SleekFlow or Aurix, depending on what the workspace has): message and session counts, first and latest message dates and quotes, AI key insights, **Open inbox ↗**. Leads without chat sessions show an empty state.
- **Attribution Timeline**: 3–6 touchpoints, newest first; the count in the subtitle matches the list. Badge types: ad click (Google / Meta), WhatsApp or Aurix session with AI summary, inbound call via Delacon (duration, handler, attributed source), lead created (web form or auto-created), deal won / marked lost. The first touchpoint always matches First Touch Source.
- **Contracts**: ID, Description, Value, Created. The total equals the lifetime value.

## Open questions
- **Edit rights in Galaxis CRM mode:** which roles can change status from the profile?
- **PDPA retention:** chat transcripts and AI summaries are personal data. Agree retention and who may see them before production.
- V2 showed an "Identity resolved" note (phone match). Should identity merges be surfaced?
- Should AI insights show a confidence level or source message?`
  }
});
