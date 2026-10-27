// Galaxis Hub demo — Organisation (Figma-only): Business Information / Brand Identity / Billing Information.
// Works in both contexts: the agency shows AGENCY_ORG, a client workspace shows that workspace.
// Every value here (UEN, address, billing, card, brand assets) is a [PLACEHOLDER].

const ORG_TABS = [
  { id: 'business', label: 'Business Information', icon: 'briefcase' },
  { id: 'brand', label: 'Brand Identity', icon: 'pencil-ruler' },
  { id: 'billing', label: 'Billing Information', icon: 'receipt' }
];
const ORG_INDUSTRIES = ['Digital Media', 'Technology', 'Logistics', 'Manufacturing', 'Education', 'Professional Services', 'Finance', 'Property', 'Retail', 'F&B', 'Healthcare', 'Other'];
const ORG_SIZES = ['Micro', 'SME', 'Mid-size', 'Enterprise'];
const ORG_PLANS = [
  { id: 'starter', name: 'Starter', seats: 5, desc: 'For small teams getting started with one product.' },
  { id: 'business', name: 'Business', seats: 20, desc: 'For growing teams using several Galaxis products.' },
  { id: 'enterprise', name: 'Enterprise', seats: 50, desc: 'For large organisations with advanced access controls.' }
];
const ORG_DEMO_TODAY = '2026-10-21';

state.ui.orgEdit = state.ui.orgEdit || {};   // { business, billing, logo, colours, type, assets }
state.ui.orgEditFor = null;                   // org id the edit state belongs to
state.ui.orgDraft = null;                     // form values kept across a failed validation
state.ui.orgErrors = {};

// ---------- Data accessors ----------
function orgTab() { return ORG_TABS.some(t => t.id === state.params.tab) ? state.params.tab : 'business'; }
function orgEntity(orgId = currentOrgId()) { return orgId === 'agency' ? AGENCY_ORG : wsById(orgId); }
function orgPad2(n) { return String(n).padStart(2, '0'); }

// Business profile: creates a placeholder entry for client workspaces on first use.
function orgProfile(orgId = currentOrgId()) {
  const ent = orgEntity(orgId);
  if (!orgProfiles[orgId]) {
    const r = seededRandom((ent.seed || 1) * 13 + 5);
    orgProfiles[orgId] = {
      uen: '[PLACEHOLDER UEN]', size: ORG_SIZES[1 + Math.floor(r() * 3)], founded: String(2005 + Math.floor(r() * 18)),
      address: '[PLACEHOLDER address]', postal: '000000', unit: '', building: '',
      contactName: '', contactNumber: `+65 0000 00${orgPad2((ent.seed || 1) + 10)}`, contactEmail: ''
    };
  }
  const p = orgProfiles[orgId];
  if (p.country === undefined) p.country = orgId === 'agency' ? AGENCY_ORG.country : 'Singapore';
  if (p.email === undefined) p.email = orgId === 'agency' ? AGENCY_ORG.email : `contact@${ent.site}`;
  if (p.description === undefined) p.description = orgId === 'agency' ? AGENCY_ORG.description : `${ent.name} is a ${ent.industry.toLowerCase()} organisation. [PLACEHOLDER description]`;
  return p;
}

// Primary Business Contact. In a client workspace it follows the workspace Primary Contact (Team & Access).
function orgContact(orgId = currentOrgId()) {
  const p = orgProfile(orgId);
  const pc = orgId === 'agency' ? null : wsPrimaryContact(orgId);
  return { name: pc ? pc.name : p.contactName, email: pc ? pc.email : p.contactEmail, number: p.contactNumber, memberId: pc ? pc.id : null };
}
function orgContactCandidates(orgId) {
  return orgId === 'agency' ? [] : members.filter(m => m.org === orgId && m.status !== 'deactivated');
}

function orgStatus(orgId) {
  const e = orgEntity(orgId);
  if (e.archived) return 'archived';
  return e.status === 'inactive' ? 'inactive' : 'active';
}

// ---------- Billing data (placeholders) ----------
// Billing is per contract: a contract covers one or more services, a client can have several contracts running at
// once, and each service has at most one active contract at a time (no overlapping contracts for a service).
// Each contract bills by its own schedule (crmContracts in core.js: the Agency CRM's payment terms).
function orgContracts(orgId) { return crmContracts(orgId); }
// Invoices = the schedule's instalments due so far (billing date on or before today). One invoice per instalment.
function orgContractInvoices(contracts, seed) {
  const today = toDateInput(new Date());
  const list = [];
  contracts.forEach(c => c.schedule.filter(x => x.date <= today && !(c.cancelledOn && x.date > c.cancelledOn)).forEach(x => list.push({
    id: `INV-${c.contractNo}-${String(x.n).padStart(2, '0')}`, date: x.date, amount: x.amount, contractNo: c.contractNo, services: c.services,
    desc: x.parts.map(p => `${p.label} ${p.n} of ${p.of}`).join(' + ')
  })));
  // Demo variety: the newest invoice of some contracts is pending; one older invoice failed for some clients.
  contracts.forEach((c, ci) => {
    list.filter(i => i.contractNo === c.contractNo).sort((a, b) => b.date.localeCompare(a.date))
      .forEach((i, k) => { i.status = c.cancelledOn || c.schedule.length === 1 ? 'paid' : k === 0 && (seed + ci) % 2 ? 'pending' : (k === 2 && ci === 0 && seed % 3 === 0) ? 'failed' : 'paid'; });
    // Demo: invoices of cancelled contracts and one-time payments are settled.
  });
  return list;
}

const orgBillingStore = {};
function orgBilling(orgId = currentOrgId()) {
  if (orgBillingStore[orgId]) return orgBillingStore[orgId];
  const ent = orgEntity(orgId);
  const seed = orgId === 'agency' ? 99 : ent.seed;
  const r = seededRandom(seed * 17 + 3);
  const slug = orgId === 'agency' ? 'example.com' : ent.site;
  // Next annual renewal: the next anniversary of the workspace's creation date.
  const created = new Date((ent.createdAt || '2026-01-15') + 'T00:00:00');
  const next = new Date(created); next.setFullYear(2026);
  if (toDateInput(next) <= ORG_DEMO_TODAY) next.setFullYear(2027);
  const contracts = orgId === 'agency' ? [] : orgContracts(orgId);
  const invoices = contracts.length ? orgContractInvoices(contracts, seed) : [];
  if (!contracts.length) {
    // Agency workspace, or a client without an agency CRM record: the Galaxis plan instalments.
    const base = 600 + Math.round(r() * 18) * 100;
    for (let i = 0; i < 14; i++) {
      const d = new Date(2026, 9 - i, Math.min(28, created.getDate() || 1));
      const status = i === 0 && seed % 2 ? 'pending' : (i === 3 && seed % 3 === 0) ? 'failed' : 'paid';
      invoices.push({
        id: `INV-${d.getFullYear()}-${String(140 - i).padStart(3, '0')}`,
        date: toDateInput(d),
        amount: base + (i % 4 === 0 ? 288 : 0) + 0.0,
        status, contractNo: null, services: ['Galaxis Hub plan'],
        desc: i % 4 === 0 ? 'Business plan instalment + additional seats' : 'Business plan instalment'
      });
    }
  }
  const pc = orgContact(orgId);
  orgBillingStore[orgId] = {
    plan: orgId === 'agency' ? (ORG_PLANS.find(p => p.seats === AGENCY_ORG.seats) || ORG_PLANS[1]).id : 'business',
    cycle: 'Annual',
    seats: 20,
    nextBilling: toDateInput(next),
    billingEmail: `finance@${slug}`,
    cards: [{ id: 'card-1', brand: 'Visa', last4: '4242', expiry: '08/28', holder: pc.name || 'Card Holder', isDefault: true }],
    contact: {
      legal: /pte|ltd|inc\.?$/i.test(ent.name) ? ent.name : `${ent.name} Pte Ltd`,
      invoiceEmail: `finance@${slug}`,
      person: pc.name || 'Billing Contact',
      number: `+65 0000 00${orgPad2((seed % 80) + 12)}`,
      address: '[PLACEHOLDER billing address]',
      postal: '000000'
    },
    invoices
  };
  return orgBillingStore[orgId];
}
function orgSeatTotal(orgId) { return orgId === 'agency' ? AGENCY_ORG.seats : orgBilling(orgId).seats; }
function orgSeatsUsed(orgId) {
  return members.filter(m => m.org === orgId && (m.status === 'active' || m.status === 'pending')).length;
}

// ---------- Brand data (generated from the org name) ----------
const orgBrandStore = {};
// Brand assets per organisation (placeholder files).
function orgBrand(orgId = currentOrgId()) {
  if (orgBrandStore[orgId]) return orgBrandStore[orgId];
  orgBrandStore[orgId] = {
    assets: [
      { id: 'guidelines', name: 'Brand Guidelines', kind: 'ZIP', icon: 'folder', size: 'Placeholder file' },
      { id: 'docs', name: 'Documentation', kind: 'Doc', icon: 'file-text', size: 'Placeholder file' },
      { id: 'slides', name: 'Slides', kind: 'Slides', icon: 'presentation', size: 'Placeholder file' }
    ]
  };
  return orgBrandStore[orgId];
}

// ---------- Downloads ----------
function orgDownloadBlob(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function orgSlug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// ---------- Edit state ----------
function orgSyncEditScope() {
  if (state.ui.orgEditFor !== currentOrgId()) {
    state.ui.orgEdit = {}; state.ui.orgDraft = null; state.ui.orgErrors = {};
    state.ui.orgEditFor = currentOrgId();
  }
}
function orgSetEdit(section, on) {
  state.ui.orgEditFor = currentOrgId();
  state.ui.orgEdit[section] = on;
  state.ui.orgDraft = null; state.ui.orgErrors = {};
  rerender();
}
function orgEditBtn(section, label) {
  const on = state.ui.orgEdit[section];
  return `<button type="button" class="org-edit-btn ${on ? 'on' : ''}" onclick="orgSetEdit('${section}', ${!on})" aria-label="${on ? 'Stop editing' : 'Edit'} ${esc(label)}" title="${on ? 'Stop editing' : 'Edit'}"><i data-lucide="${on ? 'x' : 'pencil'}"></i></button>`;
}
function orgVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

// ---------- Rendering: page ----------
function orgRender() {
  orgSyncEditScope();
  const tab = orgTab();
  const tabs = ORG_TABS.map(t => `<button type="button" class="page-tab ${t.id === tab ? 'active' : ''}" onclick="navigate('organisation', { tab: '${t.id}' })"><i data-lucide="${t.icon}"></i>${esc(t.label)}</button>`).join('');
  const body = tab === 'brand' ? orgBrandHTML() : tab === 'billing' ? orgBillingHTML() : orgBusinessHTML();
  return `<div class="page-tabs" role="tablist">${tabs}</div>
    <div class="stack">${orgHeaderCard()}${body}</div>`;
}

function orgHeaderCard() {
  const id = currentOrgId();
  const ent = orgEntity(id);
  const p = orgProfile(id);
  const logo = `<div class="org-logo" aria-hidden="true">${esc(initials(ent.name))}</div>`;
  return `<section class="card org-card org-header-card">
    ${logo}
    <div class="grow">
      <div class="row" style="gap:16px"><div class="org-name">${esc(ent.name)}</div>${statusDot(orgStatus(id))}</div>
      <div class="org-meta">
        <span><i data-lucide="map-pin"></i>${esc(p.country || '—')}</span>
        <span><i data-lucide="building-2"></i>${esc(ent.industry || '—')}</span>
        <span><i data-lucide="globe"></i>${esc(ent.site || '—')}</span>
        <span><i data-lucide="mail"></i>${esc(p.email || '—')}</span>
      </div>
      <div class="org-desc">${esc(p.description)}</div>
    </div>
  </section>`;
}

function orgCardHead(title, sub, right = '') {
  return `<div class="card-header"><div><h2 class="h-card org-card-title">${esc(title)}</h2><div class="org-card-sub">${esc(sub)}</div></div>${right}</div>`;
}
function orgKV(label, value, opts = {}) {
  return `<div class="${opts.full ? 'org-kv-full' : ''}"><div class="kv-label">${esc(label)}</div><div class="kv-value">${value === '' || value == null ? '<span class="t-muted">—</span>' : esc(value)}</div>${opts.hint ? `<div class="field-hint" style="margin-top:6px">${esc(opts.hint)}</div>` : ''}</div>`;
}
function orgField(id, label, value, opts = {}) {
  const err = state.ui.orgErrors[id];
  const req = opts.required ? '<span class="req">*</span>' : '';
  let control;
  if (opts.options) {
    control = `<select class="select" id="${id}" ${opts.attrs || ''}>${opts.options.map(o => {
      const [v, l, extra] = Array.isArray(o) ? o : [o, o, ''];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''} ${extra || ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  } else {
    control = `<input class="input ${err ? 'invalid' : ''}" id="${id}" value="${esc(value)}" ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''} ${opts.attrs || ''}>`;
  }
  return `<div class="field ${opts.full ? 'org-kv-full' : ''}"><label class="field-label" for="${id}">${esc(label)}${req}</label>${control}
    ${err ? `<div class="field-error">${esc(err)}</div>` : opts.hint ? `<div class="field-hint">${esc(opts.hint)}</div>` : ''}</div>`;
}

// ---------- Business Information ----------
function orgBusinessValues(id) {
  const ent = orgEntity(id), p = orgProfile(id), c = orgContact(id);
  return {
    name: ent.name, uen: p.uen, industry: ent.industry, size: p.size, founded: p.founded, site: ent.site,
    address: p.address, postal: p.postal, unit: p.unit, building: p.building,
    contactMember: c.memberId || '', contactName: c.name, contactNumber: c.number, contactEmail: c.email
  };
}

function orgBusinessHTML() {
  const id = currentOrgId();
  const editing = !!state.ui.orgEdit.business;
  const v = editing && state.ui.orgDraft ? state.ui.orgDraft : orgBusinessValues(id);
  const head = orgCardHead('Business Information', 'Manage your organisation’s legal and business information.', orgEditBtn('business', 'business information'));
  const syncNote = id !== 'agency' ? 'Synced with the workspace Primary Contact in Team & Access' : '';
  if (!editing) {
    return `<section class="card org-section">${head}
      <div class="form-section-title">Company Information</div>
      <div class="kv-grid org-kv">${orgKV('Organisation Name', v.name)}${orgKV('UEN / Registration Number', v.uen)}${orgKV('Industry', v.industry)}${orgKV('Company Size', v.size)}${orgKV('Founded Year', v.founded)}${orgKV('Website', v.site)}</div>
      <div class="form-section-title">Company Address</div>
      <div class="kv-grid org-kv">${orgKV('Company Address', v.address)}${orgKV('Postal Code', v.postal)}${orgKV('Unit Number (If applicable)', v.unit)}${orgKV('Building Name (Optional)', v.building)}</div>
      <div class="form-section-title row-between"><span>Primary Business Contact</span>${syncNote ? `<span class="org-sync-note"><i data-lucide="refresh-cw"></i>${esc(syncNote)}</span>` : ''}</div>
      <div class="kv-grid org-kv">${orgKV('Contact Person', v.contactName)}${orgKV('Contact Number', v.contactNumber)}${orgKV('Email', v.contactEmail)}</div>
    </section>`;
  }
  const cands = orgContactCandidates(id);
  const contactFields = cands.length
    ? orgField('org-f-contactMember', 'Contact Person', v.contactMember, {
        required: true,
        options: [['', 'Select a member…'], ...cands.map(m => [m.id, `${m.name}${m.status === 'pending' ? ' (pending invite)' : ''}`, `data-email="${esc(m.email)}"`])],
        attrs: `onchange="document.getElementById('org-f-contactEmail').value = this.selectedOptions[0].dataset.email || ''"`,
        hint: 'Becomes the workspace Primary Contact (one per workspace).'
      }) + orgField('org-f-contactNumber', 'Contact Number', v.contactNumber, { placeholder: '+65 0000 0000' })
        + orgField('org-f-contactEmail', 'Email', v.contactEmail, { attrs: 'disabled', hint: 'Taken from the member’s account.' })
    : orgField('org-f-contactName', 'Contact Person', v.contactName, { required: true })
        + orgField('org-f-contactNumber', 'Contact Number', v.contactNumber, { placeholder: '+65 0000 0000' })
        + orgField('org-f-contactEmail', 'Email', v.contactEmail, { required: true, placeholder: 'name@example.com' });
  const errCount = Object.keys(state.ui.orgErrors).length;
  return `<section class="card org-section">${head}
    ${errCount ? `<div class="banner banner-error" style="margin-bottom:8px"><i data-lucide="circle-alert"></i><div class="banner-text">Please fix ${errCount} field${errCount === 1 ? '' : 's'} before saving.</div></div>` : ''}
    <div class="form-section-title">Company Information</div>
    <div class="kv-grid org-form">
      ${orgField('org-f-name', 'Organisation Name', v.name, { required: true })}
      ${orgField('org-f-uen', 'UEN / Registration Number', v.uen)}
      ${orgField('org-f-industry', 'Industry', v.industry, { options: ORG_INDUSTRIES.includes(v.industry) ? ORG_INDUSTRIES : [v.industry, ...ORG_INDUSTRIES] })}
      ${orgField('org-f-size', 'Company Size', v.size, { options: ORG_SIZES })}
      ${orgField('org-f-founded', 'Founded Year', v.founded, { placeholder: 'YYYY', attrs: 'inputmode="numeric" maxlength="4"' })}
      ${orgField('org-f-site', 'Website', v.site, { placeholder: 'example.com' })}
    </div>
    <div class="form-section-title">Company Address</div>
    <div class="kv-grid org-form">
      ${orgField('org-f-address', 'Company Address', v.address)}
      ${orgField('org-f-postal', 'Postal Code', v.postal, { placeholder: '6 digits', attrs: 'inputmode="numeric" maxlength="6"' })}
      ${orgField('org-f-unit', 'Unit Number (If applicable)', v.unit, { placeholder: '#00-00' })}
      ${orgField('org-f-building', 'Building Name (Optional)', v.building)}
    </div>
    <div class="form-section-title row-between"><span>Primary Business Contact</span>${syncNote ? `<span class="org-sync-note"><i data-lucide="refresh-cw"></i>${esc(syncNote)}</span>` : ''}</div>
    <div class="kv-grid org-form">${contactFields}</div>
    <div class="org-form-actions">
      <button type="button" class="btn btn-outline" onclick="orgSetEdit('business', false)">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="orgSaveBusiness()">Save Changes</button>
    </div>
  </section>`;
}

function orgSaveBusiness() {
  const id = currentOrgId();
  const cands = orgContactCandidates(id);
  const d = {
    name: orgVal('org-f-name'), uen: orgVal('org-f-uen'), industry: orgVal('org-f-industry'), size: orgVal('org-f-size'),
    founded: orgVal('org-f-founded'), site: orgVal('org-f-site'), address: orgVal('org-f-address'), postal: orgVal('org-f-postal'),
    unit: orgVal('org-f-unit'), building: orgVal('org-f-building'), contactNumber: orgVal('org-f-contactNumber'),
    contactMember: cands.length ? orgVal('org-f-contactMember') : '',
    contactName: cands.length ? '' : orgVal('org-f-contactName'),
    contactEmail: orgVal('org-f-contactEmail')
  };
  const e = {};
  if (!d.name) e['org-f-name'] = 'Organisation name is required.';
  else {
    const clash = [AGENCY_ORG, ...workspaces].find(o => o.id !== id && o.name.trim().toLowerCase() === d.name.toLowerCase());
    if (clash) e['org-f-name'] = `“${clash.name}” already exists. Choose a different name.`;
  }
  if (d.founded && (!/^\d{4}$/.test(d.founded) || +d.founded > 2026 || +d.founded < 1800)) e['org-f-founded'] = 'Enter a 4-digit year, no later than 2026.';
  if (d.site && !/^[^\s]+\.[^\s]{2,}$/.test(d.site)) e['org-f-site'] = 'Enter a valid domain, e.g. example.com.';
  if (!/^\d{6}$/.test(d.postal)) e['org-f-postal'] = 'Postal code must be 6 digits.';
  if (d.contactNumber && !/^\+?[\d\s-]{8,}$/.test(d.contactNumber)) e['org-f-contactNumber'] = 'Enter a valid phone number, e.g. +65 0000 0000.';
  if (cands.length) { if (!d.contactMember) e['org-f-contactMember'] = 'Choose the primary contact.'; }
  else {
    if (!d.contactName) e['org-f-contactName'] = 'Contact person is required.';
    if (!isEmail(d.contactEmail)) e['org-f-contactEmail'] = 'Enter a valid email address.';
  }
  if (Object.keys(e).length) {
    state.ui.orgDraft = d; state.ui.orgErrors = e;
    rerender();
    document.getElementById(Object.keys(e)[0])?.focus();
    return;
  }
  const ent = orgEntity(id), p = orgProfile(id);
  const renamed = ent.name !== d.name;
  Object.assign(ent, { name: d.name, industry: d.industry, site: d.site });
  Object.assign(p, { uen: d.uen, size: d.size, founded: d.founded, address: d.address, postal: d.postal, unit: d.unit, building: d.building, contactNumber: d.contactNumber });
  if (cands.length) {
    // Single-primary rule (V1): exactly one Primary Contact per workspace.
    members.filter(m => m.org === id).forEach(m => { m.isPrimary = m.id === d.contactMember; });
    const m = memberById(d.contactMember);
    p.contactName = m.name; p.contactEmail = m.email;
  } else { p.contactName = d.contactName; p.contactEmail = d.contactEmail; }
  if (orgBillingStore[id] && renamed) orgBillingStore[id].contact.legal = /pte|ltd|inc\.?$/i.test(d.name) ? d.name : `${d.name} Pte Ltd`;
  state.ui.orgEdit.business = false; state.ui.orgDraft = null; state.ui.orgErrors = {};
  render(); // full render: the workspace switcher and header show the new name
  showToast(renamed ? `Saved — organisation renamed to ${d.name}` : 'Business information saved');
}

// ---------- Services & Contract (client workspace, read-only from the agency CRM) ----------
function orgServicesHTML() {
  const id = currentOrgId();
  const acc = crmAccounts[id];
  const head = orgCardHead('Services & Contract', 'Services, contract and monthly budgets from the agency CRM. A contract can cover one or more services. Each service has one active contract at a time.');
  if (!acc) {
    return `<section class="card org-section">${head}${emptyState('file-x', 'No CRM record linked', 'This workspace was created manually. Services and budgets appear here once the account is linked in the agency CRM.')}</section>`;
  }
  const today = toDateInput(new Date());
  const bt = orgBtRows(id);
  const daysLeft = x => Math.round((new Date(x.end + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  // Status (Figma 6628:35585): Live · Paused "On {date}" (overdue payment on its contract, see Billing Tracking) ·
  // Cancelled "On {date}" · Upcoming / Ended from the dates.
  const status = x => {
    const row = bt.find(r => r.c.contractNo === x.contractNo);
    const dot = (cls, label, on) => `<span class="dot-label org-svc-st ${cls}"><span class="dot"></span>${label}</span>${on ? `<div class="cell-sub">On ${fmtDate(on)}</div>` : ''}`;
    if (x.cancelledOn && x.cancelledOn <= today) return dot('is-cancelled', 'Cancelled', x.cancelledOn);
    if (x.start > today) return dot('is-upcoming', 'Upcoming');
    if (x.end < today) return dot('is-ended', 'Ended');
    if (row && row.status === 'paused') return dot('is-paused', 'Paused', row.pausedOn);
    return dot('is-live', 'Live');
  };
  const rows = acc.services.map(x => {
    const cancelled = x.cancelledOn && x.cancelledOn <= today;
    const d = x.end && !cancelled && x.start <= today ? daysLeft(x) : null;
    return `<tr><td class="t-bold">${esc(x.type)}</td><td>${esc(x.contractNo || '—')}</td>
      <td>${CRM_AD_SERVICES.includes(x.type) ? fmtMoney(x.monthlyBudget, 2) : 'NA'}</td><td>${fmtDate(x.start)}</td><td>${fmtDate(x.end)}</td>
      <td>${d !== null ? `${d} day${d === 1 ? '' : 's'}` : '-'}</td><td>${status(x)}</td></tr>`;
  }).join('');
  return `<section class="card org-section">${head}
    <div class="table-wrap org-svc-table"><table class="table">
      <thead><tr><th>Services</th><th>Contract</th><th>Monthly Budget</th><th>Start Date</th><th>End Date</th><th>Days Left</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td class="table-empty" colspan="7">No services in the CRM record.</td></tr>'}</tbody></table></div>
  </section>`;
}

// ---------- Billing Tracking (client workspace; Figma 6628:35585, replaces Billing History) ----------
// One row per contract (services as pills). Expanding a row shows the Contract Billing Breakdown: payment term, a status
// banner and one card per instalment (T1, T2…). Rules: an instalment is due 14 days after it's billed (CRM default
// credit term); unpaid past that = overdue, which pauses the contract. Contract status: Cancelled · Paused (overdue) ·
// Paid (every instalment paid) · Pending (in good standing, next payment upcoming or due).
Object.assign(state.ui, { orgBtTab: 'all', orgBtSearch: '', orgBtOpen: null, orgBtAll: {}, orgBtRange: null });
const ORG_CREDIT_DAYS = 14;
const ORG_BT_STATUS = { paid: ['Paid', 'org-st-paid'], pending: ['Pending', 'org-st-pending'], paused: ['Paused', 'org-st-paused'], cancelled: ['Cancelled', 'org-st-cancelled'], upcoming: ['Upcoming', 'org-st-upcoming'] };
function orgSvcPills(list) { return `<span class="chips org-svc-pills">${list.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</span>`; }
function crmAddDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toDateInput(d); }
function orgMoney(v) { return fmtMoney(v, Math.round(v * 100) % 100 ? 2 : 0); }
// Billing position of every contract: instalments with their state, contract status and the banner event.
function orgBtRows(id) {
  const b = orgBilling(id), today = toDateInput(new Date());
  return orgContracts(id).map(c => {
    const inv = b.invoices.filter(i => i.contractNo === c.contractNo);
    let nextSet = false;
    const periods = c.schedule.map(x => {
      const i = inv.find(v => v.id === `INV-${c.contractNo}-${String(x.n).padStart(2, '0')}`);
      const due = crmAddDays(x.date, ORG_CREDIT_DAYS);
      let st;
      if (i && i.status === 'paid') st = 'paid';
      else if (c.cancelledOn && x.date > c.cancelledOn) st = 'cancelled';
      else if (i && (i.status === 'failed' || today > due)) st = 'paused';
      else if (!nextSet) { st = 'pending'; nextSet = true; }
      else st = 'upcoming';
      if (st === 'paused') nextSet = true;
      // Paid date: a few days after billing (demo; official payment dates come from QBB).
      const paidOn = st === 'paid' ? [crmAddDays(x.date, 1 + (x.n * 3) % 8), today].sort()[0] : null;
      return { ...x, pct: c.value ? x.amount / c.value * 100 : 0, due, st, paidOn, invoice: i || null };
    });
    const overdue = periods.find(x => x.st === 'paused');
    const status = c.cancelledOn ? 'cancelled' : overdue ? 'paused' : periods.every(x => x.st === 'paid') ? 'paid' : 'pending';
    const paid = periods.filter(x => x.st === 'paid');
    return { c, periods, status, overdue, pausedOn: overdue ? crmAddDays(overdue.due, 1) : null, next: periods.find(x => x.st === 'pending'),
      paidAmount: paid.reduce((t, x) => t + x.amount, 0), paidCount: paid.length };
  });
}
// Month range filter (Billing Tracking): contracts whose dates overlap the range. Default: January to the current month.
function orgBtRange() {
  if (!state.ui.orgBtRange) { const t = new Date(); state.ui.orgBtRange = { from: `${t.getFullYear()}-01`, to: toDateInput(t).slice(0, 7) }; }
  return state.ui.orgBtRange;
}
function orgMonthLabel(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long' }); }
function orgBtRangeLabel(r) {
  const [fy] = r.from.split('-'), [ty] = r.to.split('-');
  return fy === ty ? `${orgMonthLabel(r.from)} - ${orgMonthLabel(r.to)} ${ty}` : `${orgMonthLabel(r.from)} ${fy} - ${orgMonthLabel(r.to)} ${ty}`;
}
function orgBillingTrackingHTML() {
  const id = currentOrgId();
  const u = state.ui, r = orgBtRange();
  const all = orgBtRows(id);
  if (u.orgBtOpen === null) u.orgBtOpen = Object.fromEntries(all.map(x => [x.c.contractNo, true]));   // expanded by default, as in the design
  const rangeEnd = toDateInput(new Date(+r.to.slice(0, 4), +r.to.slice(5, 7), 0));
  const term = u.orgBtSearch.trim().toLowerCase();
  const base = all.filter(x => x.c.start <= rangeEnd && x.c.end >= `${r.from}-01` && (!term || `${x.c.contractNo} ${x.c.services.join(' ')}`.toLowerCase().includes(term)));
  const count = k => k === 'all' ? base.length : base.filter(x => x.status === k).length;
  const rows = base.filter(x => u.orgBtTab === 'all' || x.status === u.orgBtTab);
  const tabs = [['all', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['paused', 'Paused'], ['cancelled', 'Cancelled']];
  const head = orgCardHead('Billing Tracking', 'Track payments for contract billing periods and milestones. Unpaid invoice or milestone delays may temporarily pause your contract.');
  const card = (row, x) => {
    const st = ORG_BT_STATUS[x.st];
    const line = { paid: ['circle-check', 't-success', `Paid on ${fmtDate(x.paidOn)}`], pending: ['clock', 'org-tx-pending', `Payment due on ${fmtDate(x.due)}`],
      paused: ['triangle-alert', 'org-tx-paused', `Contract paused on ${fmtDate(row.pausedOn)}`], cancelled: ['circle-x', 't-error', `Contract cancelled on ${fmtDate(row.c.cancelledOn)}`],
      upcoming: ['rotate-cw', 't-muted', 'Upcoming future payment'] }[x.st];
    const title = row.c.payTerm === 'Monthly' ? `T${x.n}` : `T${x.n} (${Math.round(x.pct)}%)`;
    return `<div class="org-bt-period">
      <div class="org-bt-period-top"><span>${esc(title)}</span><span class="org-st ${st[1]}">${st[0]}</span></div>
      <div class="org-bt-period-amt">${orgMoney(x.amount)}</div>
      <div class="org-bt-period-line ${line[1]}"><i data-lucide="${line[0]}"></i>${esc(line[2])}</div>
    </div>`;
  };
  const banner = row => {
    if (row.status === 'cancelled') return ['org-bn-cancelled', 'circle-alert', `Contract has been cancelled by client on ${fmtDate(row.c.cancelledOn)}.`];
    if (row.status === 'paused') return ['org-bn-paused', 'triangle-alert', `Contract paused on ${fmtDate(row.pausedOn)} due to overdue payment for T${row.overdue.n}.`];
    if (row.status === 'paid') return ['org-bn-paid', 'circle-check', 'All payments have been made and completed.'];
    return ['org-bn-pending', 'clock', `Upcoming payment due on ${fmtDate(row.next.due)}.`];
  };
  const terms = row => {
    const t = row.c.payTerm;
    const label = { '50-50%': '50% / 50%', '60-20-20%': '60% / 20% / 20%', '50-30-20%': '50% / 30% / 20%', '100%': '100%', 'Pre-Paid': 'Pre-paid', Customised: 'Customised' }[t] || t;
    return `Payment Term (${label})`;
  };
  const body = rows.map(row => {
    const open = !!u.orgBtOpen[row.c.contractNo];
    const pct = row.c.value ? Math.round(row.paidAmount / row.c.value * 100) : 0;
    const st = ORG_BT_STATUS[row.status];
    // Long schedules (e.g. monthly) show four cards around the current one, with "View all Billing Period".
    const showAll = !!u.orgBtAll[row.c.contractNo] || row.periods.length <= 4;
    let shown = row.periods;
    if (!showAll) {
      const firstOpen = row.periods.findIndex(x => x.st !== 'paid');
      const start = firstOpen < 0 ? row.periods.length - 4 : Math.max(0, Math.min(row.periods.length - 4, firstOpen - 1));
      shown = row.periods.slice(start, start + 4);
    }
    const [bnCls, bnIcon, bnText] = banner(row);
    const perMonth = row.c.payTerm === 'Monthly' ? `<div class="org-bt-sub">${row.periods.length} payments • ${orgMoney(row.c.value / row.periods.length)}/ month</div>` : '';
    return `<div class="org-bt-row">
      <div class="org-bt-line" role="button" tabindex="0" onclick="orgBtToggle('${q(row.c.contractNo)}')" onkeydown="if(event.key==='Enter')orgBtToggle('${q(row.c.contractNo)}')" aria-expanded="${open}">
        <span class="org-bt-contract"><i data-lucide="${open ? 'chevron-up' : 'chevron-down'}"></i>${esc(row.c.contractNo)}</span>
        <span>${orgSvcPills(row.c.services)}</span>
        <span>${orgMoney(row.c.value)}</span>
        <span class="org-bt-progress"><span class="org-bt-progress-top"><span>${pct}% Paid</span><span>(${row.paidCount} of ${row.periods.length})</span></span><span class="org-bt-bar"><span style="width:${pct}%"></span></span></span>
        <span class="org-bt-dates">${fmtDate(row.c.start)} -<br>${fmtDate(row.c.end)}</span>
        <span><span class="org-st org-st-lg ${st[1]}">${st[0]}</span></span>
      </div>
      ${open ? `<div class="org-bt-detail"><div class="org-bt-breakdown">
        <div class="org-bt-bd-head"><span class="t-bold">Contract Billing Breakdown</span><span class="t-muted">${esc(terms(row))}</span></div>
        ${perMonth}
        <div class="org-bt-banner ${bnCls}"><i data-lucide="${bnIcon}"></i>${esc(bnText)}</div>
        <div class="org-bt-periods" style="grid-template-columns:repeat(${Math.min(4, shown.length)}, minmax(0, 1fr))">${shown.map(x => card(row, x)).join('')}</div>
        ${row.periods.length > 4 ? `<button type="button" class="t-link org-bt-all" onclick="state.ui.orgBtAll['${q(row.c.contractNo)}'] = ${!showAll}; orgBtRefresh()">${showAll ? 'Show fewer' : 'View all Billing Period'}</button>` : ''}
      </div></div>` : ''}
    </div>`;
  }).join('');
  return `<section class="card org-section" id="org-bt">${head}
    <div class="org-bt-toolbar">
      <div class="search grow"><input class="input" placeholder="Search" value="${esc(u.orgBtSearch)}" oninput="state.ui.orgBtSearch = this.value; orgBtRefresh()" aria-label="Search contracts or services"></div>
      <div class="menu-anchor">
        <button type="button" class="org-bt-range" onclick="toggleMenu('org-bt-range-pop', event)"><span>${esc(orgBtRangeLabel(r))}</span><i data-lucide="calendar"></i></button>
        <div class="menu org-bt-range-pop" id="org-bt-range-pop" onclick="event.stopPropagation()">
          <label class="field"><span class="field-label">From</span><input class="input" type="month" id="org-bt-from" value="${r.from}"></label>
          <label class="field"><span class="field-label">To</span><input class="input" type="month" id="org-bt-to" value="${r.to}"></label>
          <div class="org-bt-range-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="closeAllPopovers()">Cancel</button><button type="button" class="btn btn-primary btn-sm" onclick="orgBtApplyRange()">Apply</button></div>
        </div>
      </div>
    </div>
    <div class="seg org-bt-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" class="${u.orgBtTab === k ? 'active' : ''}" onclick="state.ui.orgBtTab='${k}'; orgBtRefresh()">${l} (${count(k)})</button>`).join('')}</div>
    <div class="org-bt-table">
      <div class="org-bt-line org-bt-colhead"><span>Contract</span><span>Services</span><span>Total Amount</span><span>Payment Progress</span><span>Start &amp; End Date</span><span>Status</span></div>
      ${body || `<div class="org-bt-empty">${emptyState('search-x', 'No contracts found', 'Try another search, date range or status.')}</div>`}
    </div>
  </section>`;
}
function orgBtToggle(no) { state.ui.orgBtOpen[no] = !state.ui.orgBtOpen[no]; orgBtRefresh(); }
function orgBtApplyRange() {
  let from = document.getElementById('org-bt-from').value, to = document.getElementById('org-bt-to').value;
  if (!from || !to) { showToast('Choose both months', 'calendar'); return; }
  if (from > to) [from, to] = [to, from];
  state.ui.orgBtRange = { from, to };
  closeAllPopovers();
  orgBtRefresh();
}
function orgBtRefresh() {
  const el = document.getElementById('org-bt');
  if (!el) return;
  const inp = document.activeElement && document.activeElement.closest('#org-bt .search') ? document.activeElement.selectionStart : null;
  el.outerHTML = orgBillingTrackingHTML();
  refreshIcons();
  if (inp !== null) { const i = document.querySelector('#org-bt .search input'); i.focus(); i.setSelectionRange(inp, inp); }
}

// ---------- Billing Information ----------
function orgBillingHTML() {
  const id = currentOrgId();
  const b = orgBilling(id);
  const plan = ORG_PLANS.find(p => p.id === b.plan);
  const used = orgSeatsUsed(id), total = orgSeatTotal(id);
  const card = b.cards.find(c => c.isDefault) || b.cards[0];
  const others = b.cards.filter(c => c !== card);
  const subscription = `<section class="card org-section">
    ${orgCardHead('Subscription & Plan', 'Your current plan and billing cycle.', '<button type="button" class="btn btn-outline" onclick="orgOpenPlanModal()">Configure Plan</button>')}
    <div class="org-plan-grid">
      <div><div class="kv-label">Current Plan</div><div class="org-plan-value">${esc(plan.name)}</div><div class="org-plan-sub">${esc(b.cycle)} billing</div></div>
      <div><div class="kv-label">Seats Used</div><div class="org-plan-value ${used > total ? 't-error' : ''}">${used} / ${total}</div><div class="org-plan-sub">Across all products</div></div>
      <div><div class="kv-label">Next Billing Date</div><div class="org-plan-value">${esc(fmtDate(b.nextBilling))}</div><div class="org-plan-sub">Auto-renews</div></div>
    </div>
  </section>`;
  const payment = `<section class="card org-section">
    ${orgCardHead('Payment Method', 'Manage the card used for automatic billing.')}
    ${card ? `<div class="kv-grid org-kv">${orgKV('Card Details', `${card.brand} •••• ${card.last4}`)}${orgKV('Expiry', card.expiry)}${orgKV('Billing Email', b.billingEmail)}</div>`
      : `<div class="banner banner-warning"><i data-lucide="credit-card"></i><div><div class="banner-title">No payment method</div><div class="banner-text">Add a card to keep your subscription active.</div></div></div>`}
    ${others.length ? `<div class="form-section-title">Other cards</div><div class="org-card-list">${others.map(c => `
      <div class="org-card-row"><i data-lucide="credit-card"></i><span class="grow">${esc(c.brand)} •••• ${esc(c.last4)} <span class="t-muted">· Expires ${esc(c.expiry)}</span></span>
        <button type="button" class="org-link" onclick="orgMakeDefaultCard('${c.id}')">Make default</button>
        <button type="button" class="org-link t-error" onclick="orgRemoveCard('${c.id}')">Remove</button></div>`).join('')}</div>` : ''}
    <div class="org-form-actions">
      <button type="button" class="btn btn-outline" onclick="orgOpenCardModal(false)">Add Payment Method</button>
      ${card ? '<button type="button" class="btn btn-primary" onclick="orgOpenCardModal(true)">Update Card</button>' : ''}
    </div>
  </section>`;
  // Client workspaces (Figma 6628:35585): Subscription & Plan, Services & Contract, Billing Tracking.
  if (!isAgency()) return subscription + orgServicesHTML() + orgBillingTrackingHTML();
  return subscription + payment + orgBillingContactHTML() + `<section class="card org-section">
    ${orgCardHead('Billing History', 'Download past invoices and receipts.')}
    <div id="org-invoice-region">${orgInvoiceTableHTML()}</div>
    <div class="field-hint" style="margin-top:12px">All plans, amounts and invoices on this page are [PLACEHOLDER] demo data.</div>
  </section>`;
}

function orgBillingContactHTML() {
  const b = orgBilling();
  const editing = !!state.ui.orgEdit.billing;
  const c = editing && state.ui.orgDraft ? state.ui.orgDraft : b.contact;
  const head = orgCardHead('Billing Contact & Address', 'Where invoices and receipts are sent.', orgEditBtn('billing', 'billing contact'));
  if (!editing) {
    return `<section class="card org-section">${head}
      <div class="kv-grid org-kv">${orgKV('Legal Entity Name', c.legal)}${orgKV('Invoice Email', c.invoiceEmail)}${orgKV('Contact Person', c.person)}${orgKV('Contact Number', c.number)}${orgKV('Billing Address', c.address)}${orgKV('Postal Code', c.postal)}</div>
    </section>`;
  }
  return `<section class="card org-section">${head}
    <div class="kv-grid org-form">
      ${orgField('org-b-legal', 'Legal Entity Name', c.legal, { required: true })}
      ${orgField('org-b-invoiceEmail', 'Invoice Email', c.invoiceEmail, { required: true, placeholder: 'finance@example.com' })}
      ${orgField('org-b-person', 'Contact Person', c.person, { required: true })}
      ${orgField('org-b-number', 'Contact Number', c.number, { placeholder: '+65 0000 0000' })}
      ${orgField('org-b-address', 'Billing Address', c.address, { required: true })}
      ${orgField('org-b-postal', 'Postal Code', c.postal, { required: true, placeholder: '6 digits', attrs: 'inputmode="numeric" maxlength="6"' })}
    </div>
    <div class="org-form-actions">
      <button type="button" class="btn btn-outline" onclick="orgSetEdit('billing', false)">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="orgSaveBillingContact()">Save Changes</button>
    </div>
  </section>`;
}

function orgSaveBillingContact() {
  const d = { legal: orgVal('org-b-legal'), invoiceEmail: orgVal('org-b-invoiceEmail'), person: orgVal('org-b-person'), number: orgVal('org-b-number'), address: orgVal('org-b-address'), postal: orgVal('org-b-postal') };
  const e = {};
  if (!d.legal) e['org-b-legal'] = 'Legal entity name is required.';
  if (!isEmail(d.invoiceEmail)) e['org-b-invoiceEmail'] = 'Enter a valid email address.';
  if (!d.person) e['org-b-person'] = 'Contact person is required.';
  if (d.number && !/^\+?[\d\s-]{8,}$/.test(d.number)) e['org-b-number'] = 'Enter a valid phone number, e.g. +65 0000 0000.';
  if (!d.address) e['org-b-address'] = 'Billing address is required.';
  if (!/^\d{6}$/.test(d.postal)) e['org-b-postal'] = 'Postal code must be 6 digits.';
  if (Object.keys(e).length) { state.ui.orgDraft = d; state.ui.orgErrors = e; rerender(); return; }
  orgBilling().contact = d;
  state.ui.orgEdit.billing = false; state.ui.orgDraft = null; state.ui.orgErrors = {};
  rerender();
  showToast('Billing contact saved');
}

const ORG_PAY_STATUS = { paid: ['Paid', 'dot-green', 't-success'], pending: ['Pending', 'dot-orange-strong', 't-warning'], failed: ['Failed', 'dot-red-strong', 't-error'] };
function orgPayDot(s) { const [l, d, c] = ORG_PAY_STATUS[s]; return `<span class="dot-label ${c}"><span class="dot ${d}"></span>${l}</span>`; }

function orgInvoiceTableHTML() {
  const b = orgBilling();
  const order = { paid: 0, pending: 1, failed: 2 };
  const list = applySort(b.invoices, 'org-invoices', { id: i => i.id, contract: i => i.contractNo || '', service: i => i.services.join(', '), date: i => i.date, amount: i => i.amount, status: i => order[i.status] }, { col: 'date', dir: 'desc' });
  // Service: every service on the invoice's contract (never "+N").
  const svc = i => `<span class="chips org-inv-svcs">${i.services.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</span>`;
  const rows = paginate(list, 'org-invoices', 10).map(i => `<tr>
    <td>${esc(i.id)}</td><td>${esc(i.contractNo || '—')}</td><td>${svc(i)}</td><td>${esc(fmtDate(i.date))}</td><td>${fmtMoney(i.amount, 2)}</td><td>${orgPayDot(i.status)}</td>
    <td><div class="row" style="gap:16px">
      <button type="button" class="org-link org-dl" onclick="orgDownloadInvoice('${q(i.id)}')"><i data-lucide="download"></i>Download</button>
      ${i.status === 'failed' ? `<button type="button" class="org-link" onclick="orgRetryInvoice('${q(i.id)}')"><i data-lucide="rotate-cw"></i>Retry payment</button>` : ''}
    </div></td></tr>`).join('');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>${sortHeader('org-invoices', 'id', 'Invoice', 'orgRefreshInvoices')}</th><th>${sortHeader('org-invoices', 'contract', 'Contract', 'orgRefreshInvoices')}</th><th>${sortHeader('org-invoices', 'service', 'Service', 'orgRefreshInvoices')}</th><th>${sortHeader('org-invoices', 'date', 'Date', 'orgRefreshInvoices')}</th><th>${sortHeader('org-invoices', 'amount', 'Amount', 'orgRefreshInvoices')}</th><th>${sortHeader('org-invoices', 'status', 'Status', 'orgRefreshInvoices')}</th><th>Action</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" class="table-empty">No invoices yet.</td></tr>`}</tbody></table></div>
    ${paginationBar('org-invoices', list.length, 'orgRefreshInvoices')}`;
}
function orgRefreshInvoices() { renderRegion('org-invoice-region', orgInvoiceTableHTML()); }

function orgDownloadInvoice(invId) {
  const id = currentOrgId();
  const b = orgBilling(id), inv = b.invoices.find(i => i.id === invId);
  if (!inv) return;
  const text = [
    'PLACEHOLDER DOCUMENT — NOT A REAL INVOICE',
    '==========================================',
    '',
    `Invoice:        ${inv.id}`,
    `Contract:       ${inv.contractNo || '—'}`,
    `Service:        ${inv.services.join(', ')}`,
    `Date:           ${fmtDate(inv.date)}`,
    `Billed to:      ${b.contact.legal}`,
    `Attention:      ${b.contact.person}`,
    `Address:        ${b.contact.address}, Singapore ${b.contact.postal}`,
    `Invoice email:  ${b.contact.invoiceEmail}`,
    '',
    `Description:    ${inv.desc} [PLACEHOLDER]`,
    `Amount (SGD):   ${fmtMoney(inv.amount, 2)}`,
    `Status:         ${ORG_PAY_STATUS[inv.status][0]}`,
    '',
    'Generated by the Galaxis Hub demo prototype. All figures are placeholders.'
  ].join('\n');
  orgDownloadBlob(`${inv.id}-PLACEHOLDER.txt`, text);
  showToast(`Downloaded ${inv.id} (placeholder)`, 'download');
}
function orgRetryInvoice(invId) {
  const inv = orgBilling().invoices.find(i => i.id === invId);
  const card = orgBilling().cards.find(c => c.isDefault);
  if (!card) { showToast('Add a payment method first', 'triangle-alert'); return; }
  inv.status = 'paid';
  if (document.getElementById('org-bt')) rerender(); else orgRefreshInvoices();
  showToast(`${inv.id} paid with ${card.brand} •••• ${card.last4}`);
}

function orgOpenPlanModal() {
  const id = currentOrgId();
  const b = orgBilling(id);
  const used = orgSeatsUsed(id);
  const body = `<div class="org-plan-options">${ORG_PLANS.map(p => `
      <label class="org-plan-option">
        <input type="radio" name="org-plan" value="${p.id}" ${p.id === b.plan ? 'checked' : ''}>
        <span class="grow"><span class="row-between"><span class="t-bold">${esc(p.name)}</span><span class="t-secondary">[PLACEHOLDER] / ${b.cycle === 'Annual' ? 'year' : 'month'}</span></span>
          <span class="t-caption t-muted" style="display:block">${p.seats} seats · ${esc(p.desc)}</span></span>
      </label>`).join('')}</div>
    <div class="field"><span class="field-label">Billing cycle</span>
      <div class="row">${['Annual', 'Monthly'].map(c => `<label class="check"><input type="radio" name="org-cycle" value="${c}" ${c === b.cycle ? 'checked' : ''}>${c}</label>`).join('')}</div></div>
    <div class="field-hint">${used} seat${used === 1 ? '' : 's'} currently in use (active and pending members).</div>
    <div class="field-error" id="org-plan-error"></div>`;
  openModal({
    title: 'Configure Plan', desc: 'Choose a plan and billing cycle. Pricing is a placeholder.', body, size: 'lg',
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: 'Save Plan', onClick: orgSavePlan }]
  });
}
function orgSavePlan() {
  const id = currentOrgId();
  const b = orgBilling(id);
  const planId = document.querySelector('input[name="org-plan"]:checked')?.value;
  const cycle = document.querySelector('input[name="org-cycle"]:checked')?.value || b.cycle;
  const plan = ORG_PLANS.find(p => p.id === planId);
  const used = orgSeatsUsed(id);
  if (plan.seats < used) {
    document.getElementById('org-plan-error').textContent = `${plan.name} includes ${plan.seats} seats, but ${used} are in use. Remove members or choose a larger plan.`;
    return false;
  }
  const changed = plan.id !== b.plan || cycle !== b.cycle;
  b.plan = plan.id; b.cycle = cycle;
  if (id === 'agency') AGENCY_ORG.seats = plan.seats; else b.seats = plan.seats;
  rerender();
  showToast(changed ? `Plan changed to ${plan.name} (${cycle.toLowerCase()} billing)` : 'No changes to your plan', changed ? 'check-circle' : 'info');
}

function orgOpenCardModal(update) {
  const b = orgBilling();
  const card = b.cards.find(c => c.isDefault);
  const body = `
    <div class="banner banner-info"><i data-lucide="shield-alert"></i><div class="banner-text">Demo only — do not enter real card details. Nothing is sent or stored except the last four digits.</div></div>
    <div class="field"><label class="field-label" for="org-c-holder">Cardholder Name<span class="req">*</span></label><input class="input" id="org-c-holder" value="${esc(update && card ? card.holder : '')}" autocomplete="off"></div>
    <div class="field"><label class="field-label" for="org-c-number">Card Number<span class="req">*</span></label><input class="input" id="org-c-number" placeholder="${update && card ? `•••• •••• •••• ${esc(card.last4)}` : '4242 4242 4242 4242'}" inputmode="numeric" autocomplete="off"></div>
    <div class="grid-2" style="gap:16px">
      <div class="field"><label class="field-label" for="org-c-expiry">Expiry (MM/YY)<span class="req">*</span></label><input class="input" id="org-c-expiry" value="${esc(update && card ? card.expiry : '')}" placeholder="MM/YY" maxlength="5" autocomplete="off"></div>
      <div class="field"><label class="field-label" for="org-c-cvc">CVC<span class="req">*</span></label><input class="input" id="org-c-cvc" placeholder="123" maxlength="4" inputmode="numeric" autocomplete="off"></div>
    </div>
    <div class="field"><label class="field-label" for="org-c-email">Billing Email<span class="req">*</span></label><input class="input" id="org-c-email" value="${esc(b.billingEmail)}"></div>
    ${!update && b.cards.length ? '<label class="check"><input type="checkbox" id="org-c-default" checked>Set as default payment method</label>' : ''}
    <div class="field-error" id="org-card-error"></div>`;
  openModal({
    title: update ? 'Update Card' : 'Add Payment Method', desc: update ? 'Replace the card used for automatic billing.' : 'Add a card for automatic billing.', body,
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: update ? 'Update Card' : 'Add Card', onClick: () => orgSaveCard(update) }]
  });
}
function orgSaveCard(update) {
  const b = orgBilling();
  const holder = orgVal('org-c-holder'), num = orgVal('org-c-number').replace(/[\s-]/g, ''), exp = orgVal('org-c-expiry'), cvc = orgVal('org-c-cvc'), email = orgVal('org-c-email');
  const errs = [];
  if (!holder) errs.push('Enter the cardholder name.');
  if (!/^\d{13,19}$/.test(num)) errs.push('Card number must be 13–19 digits.');
  const m = exp.match(/^(\d{2})\/(\d{2})$/);
  if (!m || +m[1] < 1 || +m[1] > 12) errs.push('Expiry must be in MM/YY format.');
  else if (new Date(2000 + +m[2], +m[1], 0) < new Date(ORG_DEMO_TODAY)) errs.push('This card has expired.');
  if (!/^\d{3,4}$/.test(cvc)) errs.push('CVC must be 3 or 4 digits.');
  if (!isEmail(email)) errs.push('Enter a valid billing email.');
  document.querySelectorAll('#modal-root .input').forEach(el => el.classList.remove('invalid'));
  if (errs.length) { document.getElementById('org-card-error').innerHTML = errs.map(esc).join('<br>'); return false; }
  const brand = num[0] === '4' ? 'Visa' : num[0] === '5' ? 'Mastercard' : num[0] === '3' ? 'Amex' : 'Card';
  const info = { brand, last4: num.slice(-4), expiry: exp, holder };
  b.billingEmail = email;
  if (update) Object.assign(b.cards.find(c => c.isDefault), info);
  else {
    const makeDefault = !b.cards.length || document.getElementById('org-c-default')?.checked;
    if (makeDefault) b.cards.forEach(c => { c.isDefault = false; });
    b.cards.push({ id: uid('card'), ...info, isDefault: makeDefault });
  }
  rerender();
  showToast(update ? `Card updated — ${brand} •••• ${info.last4}` : `${brand} •••• ${info.last4} added`, 'credit-card');
}
function orgMakeDefaultCard(cardId) {
  const b = orgBilling();
  b.cards.forEach(c => { c.isDefault = c.id === cardId; });
  const c = b.cards.find(x => x.id === cardId);
  rerender();
  showToast(`${c.brand} •••• ${c.last4} is now the default card`, 'credit-card');
}
function orgRemoveCard(cardId) {
  const b = orgBilling();
  const c = b.cards.find(x => x.id === cardId);
  confirmDialog({
    title: 'Remove card?', text: `${c.brand} •••• ${c.last4} will no longer be available for billing.`, confirmLabel: 'Remove', danger: true,
    onConfirm: () => { b.cards = b.cards.filter(x => x.id !== cardId); rerender(); showToast('Card removed'); }
  });
}

// ---------- Brand Identity ----------
// Brand Identity: only Brand Assets (Logo, Colour Palette and Typography were removed on 23/10/2026).
function orgBrandHTML() {
  const br = orgBrand(currentOrgId());
  const ed = state.ui.orgEdit;
  const assets = br.assets.map(a => `<div class="org-asset">
      <span class="org-asset-icon"><i data-lucide="${a.icon}"></i></span>
      <span class="grow"><div class="t-bold t-caption">${esc(a.name)}</div><div class="t-caption t-muted">${esc(a.kind)} • ${esc(a.size)}</div></span>
      <button type="button" class="org-link" onclick="orgDownloadAsset('${q(a.id)}')">Download</button>
      ${ed.assets ? `<button type="button" class="kebab" aria-label="Remove ${esc(a.name)}" onclick="orgRemoveAsset('${q(a.id)}')"><i data-lucide="trash-2"></i></button>` : ''}
    </div>`).join('');
  return `
    <section class="card org-section">${orgCardHead('Brand Assets', 'Downloadable resources for teams and agency partners.', orgEditBtn('assets', 'brand assets'))}
      <div class="grid-3 org-asset-grid">${assets || '<div class="t-muted t-caption">No brand assets yet.</div>'}</div>
      ${ed.assets ? `<div class="org-form-actions"><input type="file" id="org-asset-input" hidden onchange="orgAssetPicked(this)">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('org-asset-input').click()"><i data-lucide="upload"></i>Upload Asset</button>
        <button type="button" class="btn btn-primary" onclick="orgSetEdit('assets', false)">Done</button></div>` : ''}
    </section>`;
}



function orgDownloadAsset(assetId) {
  const id = currentOrgId();
  const a = orgBrand(id).assets.find(x => x.id === assetId);
  if (!a) return;
  if (a.dataUrl) {
    const link = document.createElement('a');
    link.href = a.dataUrl; link.download = a.fileName; document.body.appendChild(link); link.click(); link.remove();
  } else {
    const text = [
      `PLACEHOLDER DOCUMENT — ${a.name.toUpperCase()} (${a.kind})`,
      `Organisation: ${orgEntity(id).name}`,
      '',
      'This file stands in for the real brand asset, which has not been supplied yet.',
      '',
      'Generated by the Galaxis Hub demo prototype.'
    ].join('\n');
    orgDownloadBlob(`${orgSlug(orgEntity(id).name)}-${orgSlug(a.name)}-PLACEHOLDER.txt`, text);
  }
  showToast(`Downloaded ${a.name}${a.dataUrl ? '' : ' (placeholder)'}`, 'download');
}
function orgAssetPicked(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('Brand assets must be 5 MB or smaller in this demo', 'triangle-alert'); input.value = ''; return; }
  const orgId = currentOrgId();
  const reader = new FileReader();
  reader.onload = () => {
    const ext = (file.name.split('.').pop() || 'File').toUpperCase();
    const size = file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    orgBrand(orgId).assets.push({ id: uid('asset'), name: file.name.replace(/\.[^.]+$/, ''), kind: ext, icon: 'file', size, dataUrl: reader.result, fileName: file.name });
    rerender();
    showToast(`${file.name} uploaded`, 'upload');
  };
  reader.readAsDataURL(file);
}
function orgRemoveAsset(assetId) {
  const br = orgBrand();
  const a = br.assets.find(x => x.id === assetId);
  confirmDialog({
    title: 'Remove brand asset?', text: `“${a.name}” will no longer be available to your team and agency partners.`, confirmLabel: 'Remove', danger: true,
    onConfirm: () => { br.assets = br.assets.filter(x => x.id !== assetId); rerender(); showToast('Brand asset removed'); }
  });
}

// ---------- Screen registration ----------
registerScreen('organisation', {
  contexts: ['agency', 'client'],
  title: () => 'Organisation',
  desc: () => 'Manage your organisation’s information and brand identity.',
  key: () => `${isAgency() ? 'agency' : 'client'}-organisation-${orgTab()}`,
  render: orgRender
});

function orgDevGo(ctx, tab, edit) {
  if (ctx === 'agency') { state.ctx = null; state.persona = 'agency'; }
  else state.ctx = devClientCtx();
  state.ui.orgEditFor = currentOrgId();
  state.ui.orgEdit = edit || {}; state.ui.orgDraft = null; state.ui.orgErrors = {};
  navigate('organisation', { tab });
}
const ORG_DEV_EDIT = { business: ['business'], billing: ['billing'], brand: ['logo', 'colours', 'type', 'assets'] };
['agency', 'client'].forEach(ctx => {
  ORG_TABS.forEach(t => {
    const key = `${ctx}-organisation-${t.id}`;
    registerDevScreen(ctx === 'agency' ? 'Agency' : 'Client workspace', key, `Organisation · ${t.label}`, () => orgDevGo(ctx, t.id));
    registerDevToggles(key, () => {
      const sections = ORG_DEV_EDIT[t.id];
      const editing = sections.some(s => state.ui.orgEdit[s]);
      const set = on => () => {
        state.ui.orgEditFor = currentOrgId(); state.ui.orgDraft = null; state.ui.orgErrors = {};
        sections.forEach(s => { state.ui.orgEdit[s] = on; });
        rerender();
      };
      return [{ label: 'Edit mode', active: editing, run: set(!editing) }];
    });
  });
});

// ---------- Specs ----------
(function orgSpecs() {
  const common = `## Header card (all tabs)
- Initials tile, organisation name, status dot (Active / Inactive / Archived).
- Country, industry, website and general email with icons, then the description.
- Agency context shows the agency (\`AGENCY_ORG\`); a client workspace shows that workspace.`;
  const business = ctx => `## Purpose
Read and edit the organisation's legal and business details. Figma frame \`6196:2005\`.

${common}

## Business Information card
- Read-only label/value grid in three sections: **Company Information** (Organisation Name, UEN / Registration Number, Industry, Company Size, Founded Year, Website), **Company Address** (Address, Postal Code, Unit Number, Building Name) and **Primary Business Contact** (Contact Person, Contact Number, Email).
- The ✎ icon switches the grid to an editable form with **Cancel / Save Changes**.
- Validation:
  - Organisation Name is required and must not match another organisation.
  - Postal Code must be 6 digits.
  - Founded Year, if given, is a 4-digit year no later than the current year.
  - Contact email must be a valid email; phone numbers allow digits, spaces, + and -.
- Saving updates the organisation everywhere (workspace switcher, header card, Client Organisation list) and shows a toast.
${ctx === 'client' ? `
## Primary Business Contact (client workspace)
- Synced with the workspace **Primary Contact** in Team & Access.
- In edit mode, Contact Person is a member picker; Email follows the chosen member.
- Saving enforces the V1 single-primary rule: the chosen member becomes Primary Contact and every other member in the workspace loses the flag.
- Workspaces with no members fall back to free-text name and email.` : `
## Primary Business Contact (agency)
- Free-text name, number and email stored on the agency profile.`}

## Open questions
- Website is not in the Figma grid; it was added because the header card shows it and nothing else edits it. Confirm with design.
- Should Client Users be able to edit business details, or only Super Admins / Agency Admins?
- Is UEN validated against ACRA format, or free text?
- Can the description and general email be edited here? Figma has no fields for them.`;
  const billing = `## Purpose
Subscription, payment method, billing contact and invoices. Figma frame \`6242:9882\`. **All figures are placeholders.**

${common}

## Subscription & Plan
- Current Plan + billing cycle; Seats Used (active + pending members / plan seats, "Across all products"); Next Billing Date with "Auto-renews".
- **Configure Plan** modal: Starter (5 seats) / Business (20) / Enterprise (50), each with [PLACEHOLDER] pricing, plus an Annual / Monthly cycle.
- A plan with fewer seats than are in use is blocked with an inline error.
- In the agency context the plan's seats drive the agency seat limit used in Team & Access.

## Payment Method
- Default card (brand •••• last 4), expiry and billing email.
- **Update Card** and **Add Payment Method** open a card form with validation: name required, 13–19 digit number, MM/YY expiry that has not passed, 3–4 digit CVC, valid billing email.
- Only the brand and last four digits are kept. The modal warns not to enter real card details.
- Extra cards are listed with Make default / Remove.

## Billing Contact & Address
- Legal Entity Name, Invoice Email, Contact Person, Contact Number, Billing Address, Postal Code.
- ✎ edit mode with validation (required fields, email format, 6-digit postal code).

## Client workspace layout (Figma 6628:35585, 27/10/2026)
- The client Billing Information tab is: **Subscription & Plan**, **Services & Contract**, **Billing Tracking**. Payment Method, Billing Contact & Address and Billing History are not part of the client design (the agency workspace keeps them).

## Services & Contract (client workspace)
- Read-only, from the workspace's agency CRM record. "A contract can cover one or more services. Each service has one active contract at a time."
- Table: **Services · Contract · Monthly Budget · Start Date · End Date · Days Left · Status**. Monthly Budget is the media budget for ad services and **NA** for the others. Days Left shows "-" for a cancelled service.
- Status (dot + label): **Live** (green), **Paused** (amber, "On {date}": the contract has an overdue payment, see Billing Tracking), **Cancelled** (red, "On {date}"), plus Upcoming / Ended from the dates. Cancelled services stop counting as live everywhere (dashboards, renewals).

## Billing Tracking (client workspace; replaces Billing History)
- "Track payments for contract billing periods and milestones. Unpaid invoice or milestone delays may temporarily pause your contract."
- Toolbar: **Search** (contract number or service) and a **month range** ("January - April 2026"; shows contracts whose dates overlap the range; default January to the current month).
- Tabs with counts: **All · Paid · Pending · Paused · Cancelled**.
- One row per **contract** (a contract can hold several services): Contract (expand / collapse) · **Services as pills** · Total Amount · **Payment Progress** ("X% Paid", "(n of N)" instalments, green bar) · Start & End Date · Status pill. Rows start expanded.
- **Contract Billing Breakdown** (expanded): payment term on the right (e.g. "Payment Term (50% / 30% / 20%)", "Quarterly", "Monthly"); monthly contracts add "12 payments • $X/ month"; a status banner; one card per instalment **T1 (50%)…** (monthly: T1…T12) with amount, status pill and a status line. Long schedules show four cards around the current one, with **View all Billing Period**.
- Rules (from the agency CRM's payment terms; official payment status from QBB):
  - An instalment is billed on its schedule date and due **14 days** later (CRM default credit term).
  - Instalment states: **Paid** ("Paid on {date}"), **Pending** (the next one due: "Payment due on {date}"), **Paused** (overdue: "Contract paused on {date}"), **Upcoming** ("Upcoming future payment"), **Cancelled** (after the cancellation date: "Contract cancelled on {date}").
  - Contract status and banner: **Cancelled** (red, "Contract has been cancelled by client on {date}."), **Paused** (yellow, "Contract paused on {date} due to overdue payment for T{n}."; paused the day after the due date), **Paid** (green, every instalment paid: "All payments have been made and completed."), otherwise **Pending** (amber, "Upcoming payment due on {date}.").
- **Colours (27/10/2026)**: Paid green, **Pending orange**, **Paused golden yellow** (pill with dark text so it stays readable), Cancelled red, Upcoming grey. Orange and yellow are kept far enough apart in hue to tell apart; Pending and Paused also use different icons (clock vs warning).
- Demo data: Visual Studio shows all four states (ads contract paused, SEO paid, Aurix cancelled, Galaxis CRM pending). [PLACEHOLDER] amounts.

## Billing History (agency workspace)
- Columns Invoice, **Contract**, **Service**, Date, Amount, Status (Paid green / Pending orange / Failed red dot), Action.
- **Billing is per contract (23/10/2026).** A contract covers one or more services (e.g. Google Ads + Facebook Ads on one contract); a client can have several contracts running at once; each service has at most one active contract at a time, so contracts for the same service never overlap. Each invoice belongs to one contract, and **Service** lists every service on that contract (never "+N").
- Client workspaces: one invoice per **instalment of the contract's billing schedule** (its payment term in the agency CRM: one-time, monthly, quarterly, 50-30-20% and so on), issued on or before today. The agency workspace, and clients without a CRM record, show the Galaxis Hub plan instalments (Service: Galaxis Hub plan, Contract: —).
- Sortable, paginated (10 per page by default).
- **Download** saves a plain-text placeholder invoice clearly labelled "PLACEHOLDER DOCUMENT".
- Failed invoices also offer **Retry payment** against the default card.

## Open questions
- Figma's button says "Configure Plan"; the brief said "Manage Plan". Figma copy is used.
- Real plan names, prices and seat limits are needed from the product owner.
- Who can see billing in a client workspace (Super Admin only)?
- Real invoices should be PDFs from the billing provider.
- Invoices follow each contract's billing schedule (Services & Contract → Contracts & Payments): one invoice per instalment, with media budget included only when it's paid via OOm. Amounts are placeholders.
- In a client workspace, does the Subscription & Plan card (Galaxis seats) still apply when billing is per service contract?`;
  const brand = `## Purpose
The organisation's approved brand kit. Figma frame \`6240:9519\`. Each organisation (agency and every client) has its own brand data, with defaults generated from its name.

${common}

## Scope
- Brand Identity shows **Brand Assets only**. The Logo, Colour Palette and Typography sections from the Figma frame were removed on 23/10/2026; the header card shows the organisation's initials tile.

## Brand Assets
- Brand Guidelines (ZIP), Documentation (Doc), Slides — each **Download** saves a labelled placeholder text file.
- ✎ edit mode allows uploading a new asset (kept in memory) and removing assets.

## Open questions
- Where are brand files stored in production, and what are the size and type limits?
- Who approves brand changes in a client workspace?`;
  const meta = { status: 'Draft', author: 'Hannah', updatedAt: '21/10/2026' };
  Object.assign(screenSpecs, {
    'agency-organisation-business': { ...meta, title: 'Organisation — Business Information (Agency)', notes: business('agency') },
    'client-organisation-business': { ...meta, updatedAt: '22/10/2026', title: 'Organisation — Business Information (Client workspace)', notes: business('client') },
    'agency-organisation-billing': { ...meta, title: 'Organisation — Billing Information (Agency)', notes: billing },
    'client-organisation-billing': { ...meta, title: 'Organisation — Billing Information (Client workspace)', notes: billing },
    'agency-organisation-brand': { ...meta, title: 'Organisation — Brand Identity (Agency)', notes: brand },
    'client-organisation-brand': { ...meta, title: 'Organisation — Brand Identity (Client workspace)', notes: brand }
  });
})();
