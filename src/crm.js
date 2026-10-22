// Galaxis Hub demo — agency CRM: role mapping, auto set-up when a CRM account converts, and the set-up checklist.
// Data: crmAccounts / agencyCrm (data.js). This module owns crmRoleMap, crmSettings, crmSetups and the conversion queue.
// Every global here is prefixed `crm`. Contract used by the dashboard: crmPendingSetups(), crmOpenSetup(wsId), crmSimulateConversion().
// All companies, people and emails below are fictional placeholders.

// ---------- Role mapping (defaults; no editing UI since 22/10/2026 — where it is managed is an open question) ----------
// Each CRM role maps to a Galaxis agency role and, optionally, a team. On conversion the CRM's named user is used when
// they hold the mapped role (and team); otherwise the least-loaded agency member with that role and team is picked.
// roleId '' means "do not assign".
const crmRoleMap = [
  { crmRole: 'Account Manager', roleId: 'r-a-am', teamId: '' },
  { crmRole: 'SEO Specialist', roleId: 'r-a-seolead', teamId: 't-a-seo' },
  { crmRole: 'Project Lead', roleId: 'r-a-pl', teamId: '' },
  { crmRole: 'Ads Specialist', roleId: 'r-a-am', teamId: 't-a-mkt' }
];
// Hannah's decision: client invites wait for the account manager's approval.
const crmSettings = { approvalRequired: true };
// Set-up record per CRM-created workspace: { crmId, createdAt, assignees: [{ crmRole, memberId|null }], contactIds: [memberIds], removed: n }
// Workspaces without a record were set up before the CRM integration and count as fully set up.
const crmSetups = {};

// Placeholder queue of CRM accounts that convert next. [PLACEHOLDER] — fictional companies, people and budgets.
const crmQueue = [
  { name: 'Northstar Dental Pte Ltd', industry: 'Healthcare', site: 'northstar-dental.example.com',
    services: [{ type: 'SEO', monthlyBudget: 3500 }, { type: 'Google Ads', monthlyBudget: 8000 }, { type: 'Content Marketing', monthlyBudget: 2000 }],
    seo: { contractedKeywords: 60, targetTop10Pct: 50 },
    adAccountIds: { google: '#998-234-1102' },
    accountManager: 'melson.ng@example.com',
    assignees: [{ crmRole: 'SEO Specialist', email: 'mary.lim@example.com' }, { crmRole: 'Project Lead', email: 'serah.chua@example.com' }],
    contacts: [{ name: 'Alex Northstar', email: 'alex@northstar-dental.example.com', role: 'Primary contact' },
      { name: 'Bea Practice', email: 'bea@northstar-dental.example.com', role: 'Marketing' }] },
  { name: 'Harbourview Bakery', industry: 'F&B', site: 'harbourview-bakery.example.com',
    services: [{ type: 'Facebook Ads', monthlyBudget: 3000 }, { type: 'Social Media', monthlyBudget: 1500 }],
    adAccountIds: { meta: 'act_4920194820' },
    accountManager: 'joseph.tan@example.com',
    assignees: [{ crmRole: 'Ads Specialist', email: '' }],
    contacts: [{ name: 'Casey Harbour', email: 'casey@harbourview.example.com', role: 'Primary contact' }] },
  { name: 'Lumen Fitness Studio', industry: 'Other', site: 'lumen-fitness.example.com',
    services: [{ type: 'SEO', monthlyBudget: 2500 }, { type: 'Google Ads', monthlyBudget: 5000 }, { type: 'Facebook Ads', monthlyBudget: 4000 }],
    seo: { contractedKeywords: 40, targetTop10Pct: 45 },
    adAccountIds: { google: '#552-901-7744', meta: 'act_9999999999' },   // the Meta ID isn't discovered yet: stays a manual step
    accountManager: 'joseph.tan@example.com',
    assignees: [{ crmRole: 'SEO Specialist', email: '' }, { crmRole: 'Ads Specialist', email: '' }, { crmRole: 'Project Lead', email: '' }],
    contacts: [{ name: 'Dana Lumen', email: 'dana@lumen-fitness.example.com', role: 'Primary contact' },
      { name: 'Eli Coach', email: 'eli@lumen-fitness.example.com', role: 'Marketing' },
      { name: 'Fern Ledger', email: 'fern@lumen-fitness.example.com', role: 'Finance' }] }
];

// ---------- Helpers ----------
function crmToday() { return toDateInput(new Date()); }
function crmConnected() { return agencyCrm.status === 'connected'; }
function crmMapFor(crmRole) { return crmRoleMap.find(r => r.crmRole === crmRole); }
// Agency members who can fill a CRM role under the current mapping (active, not Owner / Agency Admin, who see every workspace anyway).
function crmCandidates(crmRole) {
  const map = crmMapFor(crmRole);
  if (!map || !map.roleId) return [];
  return members.filter(m => m.org === 'agency' && m.status === 'active' && !(m.workspaces || []).includes('*') &&
    m.roleId === map.roleId && (!map.teamId || m.teamId === map.teamId));
}
// Pick the member for a CRM role: the CRM's named user if they qualify, else the one with the fewest assigned workspaces.
function crmResolve(crmRole, email) {
  const list = crmCandidates(crmRole);
  const named = email && list.find(m => m.email.toLowerCase() === email.toLowerCase());
  if (named) return named;
  return [...list].sort((a, b) => (a.workspaces || []).length - (b.workspaces || []).length || a.name.localeCompare(b.name))[0] || null;
}
// Client role for a CRM contact. The primary contact becomes Super Admin and the workspace Primary Contact.
function crmContactRole(role) {
  if (/primary/i.test(role)) return 'r-c-super';
  if (/marketing/i.test(role)) return 'r-c-hom';
  return 'r-c-employee';
}
function crmAddContactMember(wsId, c, status) {
  const m = { id: uid('m'), org: wsId, name: c.name, email: c.email, teamId: null, roleId: crmContactRole(c.role), status,
    products: [], lastActive: null, lastProduct: null, crmContact: true, crmRole: c.role };
  if (/primary/i.test(c.role) && !wsPrimaryContact(wsId)) m.isPrimary = true;
  members.push(m);
  return m;
}
function crmAwaiting(wsId) { return members.filter(m => m.org === wsId && m.status === 'awaiting'); }
function crmSetupContacts(wsId) {
  const s = crmSetups[wsId];
  return s ? s.contactIds.map(memberById).filter(Boolean) : [];
}

// ---------- Set-up checklist (computed from live data, so manual changes elsewhere tick steps off) ----------
// state: 'done' | 'pending' (needs the account manager) | 'manual' (done outside the checklist)
function crmSetupSteps(wsId) {
  const s = crmSetups[wsId];
  const acc = crmAccounts[wsId];
  if (!s || !acc) return [];
  const steps = [];
  const total = acc.services.reduce((t, x) => t + x.monthlyBudget, 0);
  steps.push({ id: 'created', label: 'Workspace created', state: 'done', detail: `Created from CRM account ${acc.crmId} on ${fmtDate(s.createdAt)}.` });
  steps.push({ id: 'services', label: 'Services & budgets synced', state: 'done', detail: `${acc.services.length} service${acc.services.length === 1 ? '' : 's'} · ${fmtMoney(total)} / month (${acc.services.map(x => x.type).join(', ')}).` });
  const assigned = s.assignees.filter(a => a.memberId && memberById(a.memberId));
  const missing = s.assignees.filter(a => !a.memberId);
  steps.push({ id: 'assignees', label: 'Agency assignees added', state: missing.length ? 'pending' : 'done',
    detail: assigned.map(a => `${memberById(a.memberId).name} (${a.crmRole})`).join(', ') || 'No agency members assigned.',
    warn: missing.length ? `No Galaxis user matches ${missing.map(a => a.crmRole).join(', ')}. Assign one manually.` : '' });
  if (acc.services.some(x => x.type === 'SEO')) {
    const e = wsProducts(wsId)['seo-cloud'];
    steps.push({ id: 'seo', label: 'SEO Cloud project linked', state: seoProjects[wsId] ? 'done' : 'pending',
      detail: seoProjects[wsId] ? `${seoProjects[wsId].contractedKeywords} keywords contracted · target ${seoProjects[wsId].targetTop10Pct}% in top 10.${e && e.status === 'pending' ? ' Keyword set-up in progress in SEO Cloud.' : ''}` : 'SEO is a live service but no SEO Cloud project is linked yet.' });
  }
  const contacts = crmSetupContacts(wsId);
  const waiting = contacts.filter(m => m.status === 'awaiting');
  const sent = contacts.filter(m => m.status !== 'awaiting');
  steps.push({ id: 'invites', label: waiting.length ? 'Client contacts awaiting approval' : 'Client contacts approved', state: waiting.length ? 'pending' : 'done',
    detail: waiting.length ? `${waiting.length} contact${waiting.length === 1 ? '' : 's'} from the CRM will be invited once you approve.`
      : `${sent.length} invite${sent.length === 1 ? '' : 's'} sent${s.removed ? ` · ${s.removed} contact${s.removed === 1 ? '' : 's'} removed` : ''}.` });
  const need = [...new Set(acc.services.filter(x => CRM_AD_SERVICES.includes(x.type)).map(x => x.type === 'Facebook Ads' ? 'meta' : 'google'))];
  if (need.length) {
    const linked = wsPlatforms(wsId);
    const left = need.filter(p => !linked.includes(p));
    const ids = acc.adAccountIds || {};
    const auto = (s.autoLinked || []).map(id => adAccounts.find(a => a.id === id)).filter(a => a && a.workspaceId === wsId);
    const why = p => ids[p] ? `the CRM's ${PLATFORM_NAME[p]} ID ${ids[p]} isn't among the discovered accounts yet` : `the CRM has no ${PLATFORM_NAME[p]} ad account ID`;
    steps.push({ id: 'ads', label: 'Ad accounts linked', state: left.length ? 'manual' : 'done',
      detail: (auto.length ? `Linked automatically from the CRM's ad account IDs: ${auto.map(a => `${PLATFORM_NAME[a.platform]} ${a.id}`).join(', ')}. ` : '')
        + (left.length ? `Link ${left.map(p => PLATFORM_NAME[p]).join(' and ')} in Integrations: ${left.map(why).join('; ')}.` : (auto.length ? '' : `${need.map(p => PLATFORM_NAME[p]).join(' and ')} linked.`)) });
  }
  return steps;
}
function crmSetupProgress(wsId) {
  const steps = crmSetupSteps(wsId);
  return { done: steps.filter(x => x.state === 'done').length, total: steps.length };
}

// Contract: workspaces whose auto set-up still has steps to do.
function crmPendingSetups() {
  return Object.keys(crmSetups).map(wsById).filter(w => w && !w.archived).map(w => {
    const p = crmSetupProgress(w.id);
    return { wsId: w.id, wsName: w.name, pendingInvites: crmAwaiting(w.id).filter(m => m.crmContact).length, stepsDone: p.done, stepsTotal: p.total };
  }).filter(x => x.stepsDone < x.stepsTotal);
}

// ---------- Conversion ----------
// Contract: runs the whole auto set-up for the next account in the queue.
function crmSimulateConversion() {
  if (!crmConnected()) {
    showToast('Agency CRM is disconnected. Reconnect it in Integrations to sync new accounts.', 'triangle-alert');
    return null;
  }
  const next = crmQueue.shift();
  if (!next) { showToast('No more CRM accounts waiting to convert in this demo', 'info'); return null; }
  // Duplicate detection (open question): never create a second workspace with the same name.
  if (typeof teamOrgNameTaken === 'function' && teamOrgNameTaken(next.name)) {
    showToast(`${next.name} already has a workspace. Flagged for review instead of creating a duplicate.`, 'triangle-alert');
    return null;
  }
  const today = crmToday();
  const end = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  const adBudget = next.services.filter(x => CRM_AD_SERVICES.includes(x.type)).reduce((t, x) => t + x.monthlyBudget, 0);
  const ws = teamCreateWorkspace({ name: next.name, site: next.site, industry: next.industry, budget: adBudget || 0, source: 'crm' });

  // 1–2. CRM record: services and budgets.
  const crmId = `CRM-${2000 + Object.keys(crmSetups).length + 1}`;
  const am = crmResolve('Account Manager', next.accountManager);
  const wanted = [{ crmRole: 'Account Manager', email: next.accountManager }, ...next.assignees];
  const assignees = wanted.map(a => ({ crmRole: a.crmRole, memberId: (a.crmRole === 'Account Manager' ? am : crmResolve(a.crmRole, a.email))?.id || null }));
  crmAccounts[ws.id] = {
    crmId, stage: 'converted', convertedAt: today, source: 'crm',
    services: next.services.map(x => ({ ...x, contractNo: `${today.slice(2, 4)}${today.slice(5, 7)}-${String(crmId.slice(-3)).padStart(3, '0')}`, start: today, end })),
    adAccountIds: { google: next.adAccountIds?.google || null, meta: next.adAccountIds?.meta || null },
    accountManager: am?.id || null,
    assignees: assignees.filter(a => a.memberId).map(a => ({ role: a.crmRole, memberId: a.memberId })),
    clientContacts: next.contacts.map(c => ({ ...c }))
  };
  // 3. Agency assignees via member.workspaces.
  assignees.forEach(a => {
    const m = a.memberId && memberById(a.memberId);
    if (m && !(m.workspaces || []).includes(ws.id)) (m.workspaces = m.workspaces || []).push(ws.id);
  });
  // SEO Cloud project placeholder: pending until keywords are set up.
  if (next.seo) {
    seoProjects[ws.id] = { contractedKeywords: next.seo.contractedKeywords, targetTop10Pct: next.seo.targetTop10Pct, scenarioTop10Pct: 0, startedAt: today };
    wsProducts(ws.id)['seo-cloud'] = { status: 'pending', active: false, lastSynced: null, error: 'SEO Cloud project created; keyword set-up in progress.' };
  }
  // Ad accounts: link automatically when the CRM's Google Ads / Meta IDs match accounts discovered by the master connections.
  const autoLinked = [];
  Object.entries(crmAccounts[ws.id].adAccountIds).forEach(([plat, id]) => {
    const acc = id && adAccounts.find(a => a.id === id && a.platform === plat && !a.workspaceId);
    if (acc && !wsAdAccounts(ws.id).some(a => a.platform === plat)) { acc.workspaceId = ws.id; autoLinked.push(acc); }
  });
  // 4. Client contacts: awaiting approval (or invited straight away when the agency turns approval off).
  const status = crmSettings.approvalRequired ? 'awaiting' : 'pending';
  const contactIds = next.contacts.map(c => crmAddContactMember(ws.id, c, status).id);
  crmSetups[ws.id] = { crmId, createdAt: today, assignees, contactIds, removed: 0, autoLinked: autoLinked.map(a => a.id) };
  agencyCrm.accountsSynced += 1;
  agencyCrm.lastSynced = new Date().toISOString();

  render();
  showToast(`New workspace created from CRM: ${ws.name}`, 'sparkles');
  return ws;
}

// ---------- Approval ----------
function crmApproveAll(wsId) {
  const list = crmAwaiting(wsId);
  if (!list.length) { showToast('No client contacts are awaiting approval', 'info'); return; }
  confirmDialog({
    title: `Send ${list.length} client invite${list.length === 1 ? '' : 's'}?`,
    text: `${list.map(m => m.email).join(', ')} will get an invitation to ${wsById(wsId).name}.`,
    confirmLabel: 'Approve & send invites', icon: 'send',
    onConfirm: () => { crmDoApprove(wsId, list.map(m => m.id)); }
  });
}
function crmApproveContact(memberId) {
  const m = memberById(memberId);
  if (!m || m.status !== 'awaiting') return;
  crmDoApprove(m.org, [m.id]);
}
function crmDoApprove(wsId, ids) {
  ids.forEach(id => { const m = memberById(id); if (m && m.status === 'awaiting') m.status = 'pending'; });
  crmChanged(wsId);
  showToast(ids.length === 1 ? `Invitation sent to ${memberById(ids[0]).email}` : `Invitations sent to ${ids.length} client contacts`, 'send');
}
function crmRemoveContact(memberId) {
  const m = memberById(memberId);
  if (!m) return;
  confirmDialog({
    title: 'Remove client contact?',
    text: `${m.name} (${m.email}) won’t be invited to ${wsById(m.org).name}. The contact stays in the agency CRM.`,
    confirmLabel: 'Remove', danger: true, icon: 'user-minus',
    onConfirm: () => {
      members.splice(members.indexOf(m), 1);
      const s = crmSetups[m.org];
      if (s) { s.contactIds = s.contactIds.filter(x => x !== m.id); s.removed = (s.removed || 0) + 1; }
      crmChanged(m.org);
      showToast(`${m.name} removed`, 'user-minus');
    }
  });
}
// Re-render the page and, when it is open, the checklist drawer.
function crmChanged(wsId) {
  if (state.ui.crmDrawerWs === wsId && document.getElementById('crm-setup')) crmRenderSetup(wsId);
  rerender();
}

// ---------- Set-up checklist drawer ----------
state.ui.crmDrawerWs = null;
// Contract: open a workspace's set-up checklist (from the dashboard Attention row or the Client Organisation card).
function crmOpenSetup(wsId) {
  const ws = wsById(wsId);
  if (!ws) return;
  if (!(isAgency() && state.page === 'team' && state.params.tab === 'clients')) {
    state.ctx = null; state.persona = 'agency';
    navigate('team', { tab: 'clients' });
  }
  state.ui.crmDrawerWs = wsId;
  openDrawer('<div id="crm-setup"></div>', '<div id="crm-setup-foot" class="crm-foot"></div>');
  crmRenderSetup(wsId);
}
function crmRenderSetup(wsId) {
  const body = document.getElementById('crm-setup');
  const foot = document.getElementById('crm-setup-foot');
  if (!body) return;
  body.innerHTML = crmSetupHTML(wsId);
  const waiting = crmAwaiting(wsId).length;
  if (foot) foot.innerHTML = `<button type="button" class="btn btn-outline" onclick="closeDrawer(); openWorkspace('${wsId}')">Open workspace</button>
    ${waiting ? `<button type="button" class="btn btn-primary" onclick="crmApproveAll('${wsId}')" title="${waiting} contact${waiting === 1 ? '' : 's'} awaiting approval"><i data-lucide="send"></i>Approve & send invites</button>` : ''}`;
  refreshIcons();
}
const CRM_STEP_ICON = { done: ['check', 'crm-step-done', 'Done'], pending: ['clock', 'crm-step-pending', 'Needs approval'], manual: ['hand', 'crm-step-manual', 'Manual step'] };
function crmSetupHTML(wsId) {
  const ws = wsById(wsId);
  const s = crmSetups[wsId];
  const acc = crmAccounts[wsId];
  if (!s || !acc) {
    return `<h3 class="h-section">${esc(ws.name)}</h3>${emptyState('circle-check', 'No auto set-up for this workspace', 'It was set up before the agency CRM integration, so there is no checklist.')}`;
  }
  const steps = crmSetupSteps(wsId);
  const p = crmSetupProgress(wsId);
  const am = memberById(acc.accountManager);
  const pct = Math.round(p.done / Math.max(1, p.total) * 100);
  const items = steps.map((st, i) => {
    const [icon, cls, label] = CRM_STEP_ICON[st.state];
    let extra = '';
    if (st.id === 'invites') extra = crmContactList(wsId);
    if (st.id === 'ads' && st.state !== 'done') extra = `<button type="button" class="btn btn-outline btn-sm crm-step-btn" onclick="crmLinkAds('${wsId}')"><i data-lucide="link"></i>Link in Integrations</button>`;
    if (st.id === 'assignees' && st.state !== 'done') extra = `<button type="button" class="btn btn-outline btn-sm crm-step-btn" onclick="closeDrawer(); teamOpenAssignMembers('${wsId}')"><i data-lucide="user-plus"></i>Assign members</button>`;
    return `<li class="crm-step ${cls}">
      <span class="crm-step-icon" title="${label}"><i data-lucide="${icon}"></i></span>
      <div class="grow"><div class="row-between"><span class="t-bold">${i + 1}. ${esc(st.label)}</span><span class="crm-step-state">${label}</span></div>
        <div class="t-caption t-secondary crm-step-detail">${esc(st.detail)}</div>
        ${st.warn ? `<div class="t-caption t-warning crm-step-detail">${esc(st.warn)}</div>` : ''}
        ${extra}</div></li>`;
  }).join('');
  return `<div class="crm-setup-head"><span class="team-org-logo">${esc(initials(ws.name))}</span>
      <div class="grow"><h3 class="h-section">${esc(ws.name)}</h3>
        <div class="row crm-setup-meta"><span class="crm-badge"><i data-lucide="sparkles"></i>From CRM</span><span class="t-caption t-muted">${esc(acc.crmId)} · Account manager ${esc(am?.name || 'not mapped')}</span></div></div></div>
    <div class="crm-progress-row"><span class="t-bold">Set-up checklist</span><span class="t-caption t-secondary">${p.done} of ${p.total} steps</span></div>
    <div class="progress crm-progress" role="progressbar" aria-valuenow="${p.done}" aria-valuemin="0" aria-valuemax="${p.total}"><span style="width:${pct}%"></span></div>
    <p class="t-caption t-muted crm-setup-note">Galaxis created this workspace automatically when the account converted in the agency CRM. ${crmSettings.approvalRequired ? 'Client invites wait for the account manager’s approval.' : 'Client invites were sent automatically.'}</p>
    <ol class="crm-steps">${items}</ol>`;
}
function crmContactList(wsId) {
  const list = crmSetupContacts(wsId);
  if (!list.length) return '<div class="t-caption t-muted crm-step-detail">No client contacts left to invite.</div>';
  return `<div class="crm-contacts">${list.map(m => `<div class="crm-contact">
      <div class="grow crm-contact-text"><div class="crm-contact-name"><span class="t-bold">${esc(m.name)}</span><span class="chip">${esc(m.isPrimary ? 'Primary contact' : (m.crmRole || roleById(m.roleId)?.name || 'Contact'))}</span></div><div class="cell-sub">${esc(m.email)}</div></div>
      ${m.status === 'awaiting'
        ? `<button type="button" class="btn btn-outline btn-sm" onclick="crmRemoveContact('${m.id}')">Remove</button><button type="button" class="btn btn-primary btn-sm" onclick="crmApproveContact('${m.id}')">Approve</button>`
        : statusDot(m.status)}</div>`).join('')}</div>`;
}
function crmLinkAds(wsId) {
  closeDrawer();
  state.ctx = null; state.persona = 'agency';
  navigate('integrations');
  showToast(`Link ${wsById(wsId).name}’s ad accounts under “Client workspaces without linked ad accounts”`, 'link');
}

// ---------- Seed: two new workspaces still waiting for approval (Attention row demo) ----------
(function crmSeedPending() {
  const seed = {
    'ws-grizzly': [{ name: 'Gus Grizzly', email: 'gus@grizzly.example.com', role: 'Primary contact' }, { name: 'Hana Bear', email: 'hana@grizzly.example.com', role: 'Marketing' }],
    'ws-beantech': [{ name: 'Ivan Bean', email: 'ivan@beantech.example.com', role: 'Primary contact' }]
  };
  Object.entries(seed).forEach(([wsId, contacts]) => {
    const ws = wsById(wsId), acc = crmAccounts[wsId];
    if (!ws || !acc) return;
    ws.source = 'crm';
    acc.clientContacts = contacts;
    const contactIds = contacts.map(c => crmAddContactMember(wsId, c, 'awaiting').id);
    const assignees = acc.assignees.map(a => ({ crmRole: a.role, memberId: a.memberId }));
    assignees.forEach(a => { const m = memberById(a.memberId); if (m && !(m.workspaces || []).some(w => w === '*' || w === wsId)) m.workspaces.push(wsId); });
    crmSetups[wsId] = { crmId: acc.crmId, createdAt: ws.createdAt, assignees, contactIds, removed: 0 };
  });
})();
