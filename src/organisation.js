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
const ORG_FONTS = ['Radio Canada Big', 'Arimo', 'Lato', 'Futura', 'Helvetica', 'Georgia'];
const ORG_DEMO_TODAY = '2026-10-21';

state.ui.orgEdit = state.ui.orgEdit || {};   // { business, billing, logo, colours, type, assets }
state.ui.orgEditFor = null;                   // org id the edit state belongs to
state.ui.orgDraft = null;                     // form values kept across a failed validation
state.ui.orgErrors = {};

// ---------- Data accessors ----------
function orgTab() { return ORG_TABS.some(t => t.id === state.params.tab) ? state.params.tab : 'business'; }
function orgEntity(orgId = currentOrgId()) { return orgId === 'agency' ? AGENCY_ORG : wsById(orgId); }
function orgHash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
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
  const invoices = [];
  const base = 600 + Math.round(r() * 18) * 100;
  for (let i = 0; i < 14; i++) {
    const d = new Date(2026, 9 - i, Math.min(28, created.getDate() || 1));
    const status = i === 0 && seed % 2 ? 'pending' : (i === 3 && seed % 3 === 0) ? 'failed' : 'paid';
    invoices.push({
      id: `INV-${d.getFullYear()}-${String(140 - i).padStart(3, '0')}`,
      date: toDateInput(d),
      amount: base + (i % 4 === 0 ? 288 : 0) + 0.0,
      status,
      desc: i % 4 === 0 ? 'Business plan instalment + additional seats' : 'Business plan instalment'
    });
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
function orgHslHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}
function orgBrand(orgId = currentOrgId()) {
  if (orgBrandStore[orgId]) return orgBrandStore[orgId];
  const name = orgEntity(orgId).name;
  const h = orgHash(name);
  // Keep generated primaries dark enough for white text (skip the yellow/lime band).
  let hue = h % 360;
  if (hue >= 40 && hue < 100) hue = (hue + 120) % 360;
  const fontPair = [['Radio Canada Big', 'Arimo'], ['Lato', 'Futura'], ['Georgia', 'Helvetica'], ['Futura', 'Lato']][h % 4];
  orgBrandStore[orgId] = {
    logos: { full: null, reversed: null, favicon: null },
    colours: [
      { key: 'primary', name: 'Primary', role: 'Buttons, Key Function', hex: orgId === 'agency' ? '#398FF7' : orgHslHex(hue, 72, 46) },
      { key: 'secondary', name: 'Secondary', role: 'Secondary Function', hex: orgHslHex((hue + 150) % 360, 50, 50) },
      { key: 'black', name: 'Core Black', role: 'Content, Text', hex: '#2B2B2B' },
      { key: 'white', name: 'Sand White', role: 'Backgrounds', hex: '#FFFDF5' }
    ],
    fonts: { heading: fontPair[0], body: fontPair[1] },
    assets: [
      { id: 'guidelines', name: 'Brand Guidelines', kind: 'ZIP', icon: 'folder', size: 'Placeholder file' },
      { id: 'docs', name: 'Documentation', kind: 'Doc', icon: 'file-text', size: 'Placeholder file' },
      { id: 'slides', name: 'Slides', kind: 'Slides', icon: 'presentation', size: 'Placeholder file' }
    ]
  };
  return orgBrandStore[orgId];
}
function orgColour(orgId, key) { return orgBrand(orgId).colours.find(c => c.key === key).hex; }

// Default logo marks: an initials tile in the brand colours, exported as SVG.
function orgLogoSvg(orgId, slot) {
  const name = orgEntity(orgId).name;
  const ini = esc(initials(name));
  const p = orgColour(orgId, 'primary'), s = orgColour(orgId, 'secondary');
  const font = 'font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central"';
  if (slot === 'reversed') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect x="40" y="40" width="432" height="432" rx="96" fill="none" stroke="#FFFFFF" stroke-width="24"/><circle cx="392" cy="120" r="40" fill="#FFFFFF"/><text x="256" y="268" ${font} font-size="190" fill="#FFFFFF">${ini}</text></svg>`;
  if (slot === 'favicon') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="128" fill="${p}"/><text x="256" y="268" ${font} font-size="300" fill="#FFFFFF">${ini.slice(0, 1)}</text></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect x="40" y="40" width="432" height="432" rx="96" fill="${p}"/><circle cx="392" cy="120" r="56" fill="${s}"/><text x="256" y="268" ${font} font-size="190" fill="#FFFFFF">${ini}</text></svg>`;
}
function orgLogoSrc(orgId, slot) {
  const up = orgBrand(orgId).logos[slot];
  return up ? up.dataUrl : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(orgLogoSvg(orgId, slot))}`;
}
const ORG_LOGO_SLOTS = [
  { id: 'full', label: 'Full Colour' },
  { id: 'reversed', label: 'Reversed (white)' },
  { id: 'favicon', label: 'Favicon' }
];

// ---------- Downloads & clipboard ----------
function orgDownloadBlob(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function orgSlug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function orgCopy(text) {
  const done = () => showToast(`Copied ${text}`, 'clipboard-check');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}

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
  const up = orgBrand(id).logos.full;
  const logo = up ? `<div class="org-logo org-logo-img"><img src="${up.dataUrl}" alt="${esc(ent.name)} logo"></div>` : `<div class="org-logo" aria-hidden="true">${esc(initials(ent.name))}</div>`;
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
  const list = applySort(b.invoices, 'org-invoices', { id: i => i.id, date: i => i.date, amount: i => i.amount, status: i => order[i.status] }, { col: 'date', dir: 'desc' });
  const rows = paginate(list, 'org-invoices', 10).map(i => `<tr>
    <td>${esc(i.id)}</td><td>${esc(fmtDate(i.date))}</td><td>${fmtMoney(i.amount, 2)}</td><td>${orgPayDot(i.status)}</td>
    <td><div class="row" style="gap:16px">
      <button type="button" class="org-link org-dl" onclick="orgDownloadInvoice('${q(i.id)}')"><i data-lucide="download"></i>Download</button>
      ${i.status === 'failed' ? `<button type="button" class="org-link" onclick="orgRetryInvoice('${q(i.id)}')"><i data-lucide="rotate-cw"></i>Retry payment</button>` : ''}
    </div></td></tr>`).join('');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>${sortHeader('org-invoices', 'id', 'Invoice', 'orgRefreshInvoices')}</th><th>${sortHeader('org-invoices', 'date', 'Date', 'orgRefreshInvoices')}</th><th>${sortHeader('org-invoices', 'amount', 'Amount', 'orgRefreshInvoices')}</th><th>${sortHeader('org-invoices', 'status', 'Status', 'orgRefreshInvoices')}</th><th>Action</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="table-empty">No invoices yet.</td></tr>`}</tbody></table></div>
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
  orgRefreshInvoices();
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
function orgBrandHTML() {
  const id = currentOrgId();
  const br = orgBrand(id);
  const ed = state.ui.orgEdit;
  const logos = ORG_LOGO_SLOTS.map(s => {
    const up = br.logos[s.id];
    const caption = up ? `${up.format} • ${up.dims}` : 'SVG • 512x512';
    return `<div class="org-logo-card">
      <div class="org-logo-preview ${s.id === 'reversed' ? 'dark' : ''}"><img src="${orgLogoSrc(id, s.id)}" alt="${esc(s.label)} logo"></div>
      <div class="org-logo-info">
        <div class="t-bold t-caption">${esc(s.label)}</div>
        <div class="t-caption t-muted org-logo-caption">${esc(caption)}${up ? '' : ' · Default'}</div>
        <div class="row" style="gap:12px">
          <button type="button" class="org-link" onclick="orgViewLogo('${s.id}')">View</button>
          <button type="button" class="org-link" onclick="orgDownloadLogo('${s.id}')">Download</button>
          ${ed.logo ? `<button type="button" class="org-link" onclick="document.getElementById('org-logo-input-${s.id}').click()">${up ? 'Replace' : 'Upload'}</button>
            ${up ? `<button type="button" class="org-link t-error" onclick="orgResetLogo('${s.id}')">Reset</button>` : ''}
            <input type="file" id="org-logo-input-${s.id}" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onchange="orgLogoPicked('${s.id}', this)">` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  const swatches = br.colours.map(c => `<div class="org-swatch">
      <div class="org-swatch-fill" style="background:${esc(c.hex)}"></div>
      <div class="org-swatch-info">
        <div class="t-bold t-caption">${esc(c.name)}</div>
        <div class="t-caption t-muted">${esc(c.role)}</div>
        <div class="org-swatch-hex">
          ${ed.colours ? `<input type="color" id="org-col-pick-${c.key}" value="${esc(c.hex.toLowerCase())}" oninput="document.getElementById('org-col-${c.key}').value = this.value.toUpperCase()" aria-label="${esc(c.name)} colour">
            <input class="input org-hex-input" id="org-col-${c.key}" value="${esc(c.hex)}" maxlength="7" oninput="if (/^#[0-9a-f]{6}$/i.test(this.value)) document.getElementById('org-col-pick-${c.key}').value = this.value.toLowerCase()">`
            : `<button type="button" class="org-hex-btn" onclick="orgCopy('${q(c.hex)}')" title="Copy ${esc(c.hex)}"><span>${esc(c.hex)}</span><i data-lucide="copy"></i></button>`}
        </div>
      </div>
    </div>`).join('');

  const fontSel = (id, val) => `<select class="select org-font-select" id="${id}">${ORG_FONTS.map(f => `<option ${f === val ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>`;
  const typography = `
    <div class="org-type-card">
      <div class="t-caption t-muted">Heading</div>
      <div class="org-type-sample org-type-heading" style="font-family:'${esc(br.fonts.heading)}', var(--font-head)">The quick brown fox jumps over the lazy dog.</div>
      <div class="t-caption t-secondary">${ed.type ? fontSel('org-font-heading', br.fonts.heading) : esc(br.fonts.heading)} - used for heading and section titles</div>
    </div>
    <div class="org-type-card">
      <div class="t-caption t-muted">Body &amp; Button</div>
      <div class="org-type-sample" style="font-family:'${esc(br.fonts.body)}', var(--font-body)">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</div>
      <div class="t-caption t-secondary">${ed.type ? fontSel('org-font-body', br.fonts.body) : esc(br.fonts.body)} - used for paragraph, labels, and buttons</div>
    </div>`;

  const assets = br.assets.map(a => `<div class="org-asset">
      <span class="org-asset-icon"><i data-lucide="${a.icon}"></i></span>
      <span class="grow"><div class="t-bold t-caption">${esc(a.name)}</div><div class="t-caption t-muted">${esc(a.kind)} • ${esc(a.size)}</div></span>
      <button type="button" class="org-link" onclick="orgDownloadAsset('${q(a.id)}')">Download</button>
      ${ed.assets ? `<button type="button" class="kebab" aria-label="Remove ${esc(a.name)}" onclick="orgRemoveAsset('${q(a.id)}')"><i data-lucide="trash-2"></i></button>` : ''}
    </div>`).join('');

  const saveRow = (fn, section) => `<div class="org-form-actions"><button type="button" class="btn btn-outline" onclick="orgSetEdit('${section}', false)">Cancel</button><button type="button" class="btn btn-primary" onclick="${fn}()">Save Changes</button></div>`;
  return `
    <section class="card org-section">${orgCardHead('Logo', 'Approved logo marks for use across products and marketing.', orgEditBtn('logo', 'logos'))}
      ${ed.logo ? '<div class="field-hint" style="margin:-8px 0 14px">PNG, JPG, SVG or WebP, up to 2 MB. Uploaded files stay in this browser tab only.</div>' : ''}
      <div class="grid-3 org-logo-grid">${logos}</div>
      ${ed.logo ? '<div class="org-form-actions"><button type="button" class="btn btn-primary" onclick="orgSetEdit(\'logo\', false)">Done</button></div>' : ''}
    </section>
    <section class="card org-section">${orgCardHead('Colour Palette', 'Core palette applied across UI, docs, and marketing assets.', orgEditBtn('colours', 'colour palette'))}
      <div class="grid-4 org-swatch-grid">${swatches}</div>
      <div class="field-error" id="org-colour-error"></div>
      ${ed.colours ? saveRow('orgSaveColours', 'colours') : ''}
    </section>
    <section class="card org-section">${orgCardHead('Typography', 'Fonts and how they’re used across headings and body copy.', orgEditBtn('type', 'typography'))}
      <div class="stack-sm">${typography}</div>
      ${ed.type ? saveRow('orgSaveFonts', 'type') : ''}
    </section>
    <section class="card org-section">${orgCardHead('Brand Assets', 'Downloadable resources for teams and agency partners.', orgEditBtn('assets', 'brand assets'))}
      <div class="grid-3 org-asset-grid">${assets || '<div class="t-muted t-caption">No brand assets yet.</div>'}</div>
      ${ed.assets ? `<div class="org-form-actions"><input type="file" id="org-asset-input" hidden onchange="orgAssetPicked(this)">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('org-asset-input').click()"><i data-lucide="upload"></i>Upload Asset</button>
        <button type="button" class="btn btn-primary" onclick="orgSetEdit('assets', false)">Done</button></div>` : ''}
    </section>`;
}

function orgViewLogo(slot) {
  const id = currentOrgId();
  const s = ORG_LOGO_SLOTS.find(x => x.id === slot);
  const up = orgBrand(id).logos[slot];
  openModal({
    title: `${s.label} logo`, desc: up ? `${up.name} · ${up.format} • ${up.dims}` : 'Default mark generated from the organisation name · SVG • 512x512', size: 'lg',
    body: `<div class="org-logo-preview org-logo-preview-lg ${slot === 'reversed' ? 'dark' : ''}"><img src="${orgLogoSrc(id, slot)}" alt="${esc(s.label)} logo preview"></div>`,
    actions: [{ label: 'Close', kind: 'outline' }, { label: 'Download', icon: 'download', onClick: () => orgDownloadLogo(slot) }]
  });
}
function orgDownloadLogo(slot) {
  const id = currentOrgId();
  const name = orgSlug(orgEntity(id).name);
  const up = orgBrand(id).logos[slot];
  if (up) {
    const a = document.createElement('a');
    a.href = up.dataUrl; a.download = up.name || `${name}-${slot}`; document.body.appendChild(a); a.click(); a.remove();
  } else orgDownloadBlob(`${name}-logo-${slot}.svg`, orgLogoSvg(id, slot), 'image/svg+xml');
  showToast(`Downloaded ${ORG_LOGO_SLOTS.find(x => x.id === slot).label} logo`, 'download');
}
function orgLogoPicked(slot, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const ok = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
  if (!ok.includes(file.type)) { showToast('Use a PNG, JPG, SVG or WebP file', 'triangle-alert'); input.value = ''; return; }
  if (file.size > 2 * 1024 * 1024) { showToast('Logo files must be 2 MB or smaller', 'triangle-alert'); input.value = ''; return; }
  const orgId = currentOrgId();
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const format = { 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/svg+xml': 'SVG', 'image/webp': 'WEBP' }[file.type];
    const done = dims => {
      orgBrand(orgId).logos[slot] = { dataUrl, name: file.name, format, dims };
      rerender();
      showToast(`${ORG_LOGO_SLOTS.find(x => x.id === slot).label} logo updated`, 'image');
    };
    const img = new Image();
    img.onload = () => done(img.naturalWidth ? `${img.naturalWidth}x${img.naturalHeight}` : 'Vector');
    img.onerror = () => done('Unknown size');
    img.src = dataUrl;
  };
  reader.onerror = () => showToast('Could not read that file', 'triangle-alert');
  reader.readAsDataURL(file);
}
function orgResetLogo(slot) {
  orgBrand().logos[slot] = null;
  rerender();
  showToast('Logo reset to the default mark');
}

function orgSaveColours() {
  const br = orgBrand();
  const vals = {};
  const bad = [];
  br.colours.forEach(c => {
    const v = orgVal(`org-col-${c.key}`).toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(v)) bad.push(c.name);
    vals[c.key] = v;
  });
  if (bad.length) {
    document.getElementById('org-colour-error').textContent = `Enter a 6-digit hex value (e.g. #23C5EB) for: ${bad.join(', ')}.`;
    bad.forEach(n => document.getElementById(`org-col-${br.colours.find(c => c.name === n).key}`).classList.add('invalid'));
    return;
  }
  br.colours.forEach(c => { c.hex = vals[c.key]; });
  state.ui.orgEdit.colours = false;
  rerender();
  showToast('Colour palette saved');
}
function orgSaveFonts() {
  const br = orgBrand();
  br.fonts = { heading: orgVal('org-font-heading'), body: orgVal('org-font-body') };
  state.ui.orgEdit.type = false;
  rerender();
  showToast('Typography saved');
}

function orgDownloadAsset(assetId) {
  const id = currentOrgId();
  const a = orgBrand(id).assets.find(x => x.id === assetId);
  if (!a) return;
  if (a.dataUrl) {
    const link = document.createElement('a');
    link.href = a.dataUrl; link.download = a.fileName; document.body.appendChild(link); link.click(); link.remove();
  } else {
    const br = orgBrand(id);
    const text = [
      `PLACEHOLDER DOCUMENT — ${a.name.toUpperCase()} (${a.kind})`,
      `Organisation: ${orgEntity(id).name}`,
      '',
      'This file stands in for the real brand asset, which has not been supplied yet.',
      '',
      'Colour palette:',
      ...br.colours.map(c => `  ${c.name.padEnd(12)} ${c.hex}  (${c.role})`),
      '',
      `Heading font: ${br.fonts.heading}`,
      `Body font:    ${br.fonts.body}`,
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
      return [{ label: 'View mode', active: !editing, run: set(false) }, { label: 'Edit mode', active: editing, run: set(true) }];
    });
  });
});

// ---------- Specs ----------
(function orgSpecs() {
  const common = `## Header card (all tabs)
- Logo (uploaded Full Colour logo, or an initials tile), organisation name, status dot (Active / Inactive / Archived).
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

## Billing History
- Columns Invoice, Date, Amount, Status (Paid green / Pending orange / Failed red dot), Action.
- Sortable, paginated (10 per page by default).
- **Download** saves a plain-text placeholder invoice clearly labelled "PLACEHOLDER DOCUMENT".
- Failed invoices also offer **Retry payment** against the default card.

## Open questions
- Figma's button says "Configure Plan"; the brief said "Manage Plan". Figma copy is used.
- Real plan names, prices and seat limits are needed from the product owner.
- Who can see billing in a client workspace (Super Admin only)?
- Real invoices should be PDFs from the billing provider.`;
  const brand = `## Purpose
The organisation's approved brand kit. Figma frame \`6240:9519\`. Each organisation (agency and every client) has its own brand data, with defaults generated from its name.

${common}

## Logo
- Three cards: Full Colour, Reversed (white on dark), Favicon, each with format/size caption and **View / Download**.
- View opens a modal preview; Download exports the default mark as SVG, or the uploaded file.
- ✎ edit mode adds **Upload / Replace / Reset** per card: PNG, JPG, SVG or WebP up to 2 MB, read in the browser and kept in memory only.
- The uploaded Full Colour logo replaces the initials tile in the header card.

## Colour Palette
- Primary / Secondary / Core Black / Sand White with role caption and hex.
- Clicking a hex copies it to the clipboard.
- ✎ edit mode shows a colour picker and hex input per swatch; hex must be 6 digits. Default logos use the new Primary / Secondary.

## Typography
- Heading and Body & Button samples rendered in the chosen font, with the font name and usage.
- ✎ edit mode lets you pick each font from a list.

## Brand Assets
- Brand Guidelines (ZIP), Documentation (Doc), Slides — each **Download** saves a labelled placeholder text file.
- ✎ edit mode allows uploading a new asset (kept in memory) and removing assets.

## Open questions
- Where are brand files stored in production, and what are the size and type limits?
- Should a brand change (e.g. primary colour) flow into client-facing reports?
- Who approves brand changes in a client workspace?`;
  const meta = { status: 'Draft', author: 'Hannah', updatedAt: '21/10/2026' };
  Object.assign(screenSpecs, {
    'agency-organisation-business': { ...meta, title: 'Organisation — Business Information (Agency)', notes: business('agency') },
    'client-organisation-business': { ...meta, title: 'Organisation — Business Information (Client workspace)', notes: business('client') },
    'agency-organisation-billing': { ...meta, title: 'Organisation — Billing Information (Agency)', notes: billing },
    'client-organisation-billing': { ...meta, title: 'Organisation — Billing Information (Client workspace)', notes: billing },
    'agency-organisation-brand': { ...meta, title: 'Organisation — Brand Identity (Agency)', notes: brand },
    'client-organisation-brand': { ...meta, title: 'Organisation — Brand Identity (Client workspace)', notes: brand }
  });
})();
