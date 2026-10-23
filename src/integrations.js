// Galaxis Hub demo — Integrations (Figma layout + V2 integration depth + V1 ad-account linking).
// Client workspace: product cards, slide-over (about / config), one-CRM rule, routing choice, ad platform linking.
// Agency ("My Workspace"): master tokens, unlinked workspaces, unlinked-account queue, linked directory, product health.
// Every global here is prefixed `integ`. UI state lives in state.ui.integ…, scenario flags in state.flags.integ….

Object.assign(state.ui, {
  integSearch: '',          // client: product search
  integCat: 'all',          // client: available-products category tab
  integCfg: null,           // client: config drawer draft { pid, authed, verified, webhookTested, showKey, key, backfill, mapping }
  integInline: {},          // agency: inline picks per workspace { wsId: { google: accId, meta: accId } }
  integQueuePlat: 'all',    // agency: queue platform filter
  integQueueTarget: {},     // agency: typed target workspace per queued account
  integDirSearch: ''        // agency: linked directory search
});
state.flags.integScenario = null;   // client dev toggle last applied: { name, ws }
state.flags.integToken = 'healthy'; // agency dev toggle
state.flags.integCrm = 'connected';  // agency dev toggle: Agency CRM connected / disconnected

const INTEG_THIRD_CRMS = ['hubspot', 'salesforce', 'zoho', 'dynamics'];
const INTEG_ROUTABLE = ['sleekflow', 'wati', 'delacon'];
const INTEG_CATS = [
  { id: 'all', label: 'All Products', icon: 'layout-grid' },
  { id: 'CRM', label: 'CRM', icon: 'users-round' },
  { id: 'CCM', label: 'CCM', icon: 'message-square-text' },
  { id: 'CDP', label: 'CDP', icon: 'database' },
  { id: 'Marketing', label: 'Marketing', icon: 'megaphone' }
];
const INTEG_FIELDS = ['Full name', 'Lead full name', 'Organisation', 'Email', 'Phone number', 'Phone number [Primary identifier]', 'Marketing channel & campaign',
  'Marketing source / keyword', 'Source / campaign', 'Lead intelligence & deal intent', 'Qualified call (>2m) flag', 'Contracts & closed revenue', 'Do not map'];
const INTEG_BACKFILL = [['lifetime', 'Lifetime (default) — up to 2,000 records'], ['365', 'Past 1 year'], ['90', 'Past 90 days'], ['30', 'Past 30 days']];

// Vendor set-up guides. Ported from V2 prdPlatformGuides (sleekflow, wati, delacon, aurix, hubspot, salesforce);
// zoho, dynamics, slack and mailchimp written to match. {URL} is replaced with the placeholder webhook URL.
const integGuides = {
  sleekflow: {
    apiSteps: ['Log into SleekFlow and select <strong>Integrations</strong> from the left navigation bar', 'Go to <strong>Platform API</strong> and click <strong>Connect</strong>', 'Copy <strong>Your Unique API Key</strong> and paste it below'],
    keyLabel: 'SleekFlow API key',
    webhookNote: 'Requirements: you need a Premium or Enterprise SleekFlow plan to set this up.',
    webhookSteps: ['Log into SleekFlow and select <strong>Flow Builder</strong> from the left navigation bar', 'Click <strong>Create new flow</strong> → <strong>Advanced</strong> → <strong>Start from scratch</strong>',
      'Enter a <strong>Flow Name</strong> (e.g. Galaxis Hub Lead Sync) and enable <strong>Allow re-enrolment</strong>', 'Click the <strong>Start</strong> node and select <strong>“Incoming message from Click-to-WhatsApp (CTWA) ad”</strong>',
      'Click <strong>+ Add node</strong>, choose <strong>Action</strong>, and select <strong>“Send contact webhook”</strong>', 'In the right-hand panel, <strong>paste the webhook URL below</strong>', 'Click <strong>Publish</strong> to make the webhook active'],
    mappings: [['customer_phone / wa_id', 'Phone number [Primary identifier]'], ['contact_full_name', 'Lead full name'], ['utm_source / ad_campaign', 'Marketing channel & campaign']]
  },
  wati: {
    apiSteps: ['Log into Wati and go to <strong>Connector → API → Create API Token</strong>', 'On the <strong>API Tokens</strong> page, click <strong>Generate new token</strong>',
      'Enter a <strong>token name</strong> (e.g. “Galaxis Integration”) and select the scope <strong>“Contacts:Read”</strong>', 'Copy the <strong>API token</strong> and paste it below'],
    keyLabel: 'Wati API access token',
    webhookSteps: ['Log into Wati and select <strong>Webhooks</strong> from the top navigation bar', 'Click <strong>Add Webhook</strong>',
      'Enter the following:<br>• <strong>URL:</strong> <code>{URL}</code><br>• <strong>Status:</strong> Enabled<br>• <strong>Events:</strong> New Contact Message', 'Click <strong>Save</strong> to publish the webhook',
      'Click <strong>…</strong> next to the webhook and choose <strong>Trigger sample callback</strong> to test the connection'],
    mappings: [['phone_number / waId', 'Phone number [Primary identifier]'], ['contact_name', 'Lead full name'], ['custom_fields.utm_source', 'Marketing source / keyword']]
  },
  delacon: {
    apiSteps: ['Log into Delacon and go to <strong>Settings → Master API Key</strong>', 'Copy the <strong>API Key</strong> and paste it below'],
    keyLabel: 'Delacon API key',
    webhookSteps: ['Log into Delacon and go to <strong>Services → List Services → Edit relevant Service</strong>', 'Under <strong>Data Integration</strong>, select <strong>Push live data through to the webhooks provided</strong>',
      'Enter the following:<br>• <strong>Create URL Hook:</strong> <code>{URL}</code><br>• <strong>Update URL Hook:</strong> <code>{URL}</code>', 'Click <strong>Submit</strong> to save the set-up'],
    mappings: [['caller_number', 'Phone number [Primary identifier]'], ['call_duration / qualified_flag', 'Qualified call (>2m) flag'], ['search_keyword / ad_source', 'Marketing source / keyword']]
  },
  aurix: { mappings: [['lead_phone / user_id', 'Phone number [Primary identifier]'], ['lead_name', 'Lead full name'], ['ai_intent_score / budget_extracted', 'Lead intelligence & deal intent']] },
  'crm-lite': { mappings: [['Contact name', 'Full name'], ['Company', 'Organisation'], ['Email', 'Email'], ['Mobile', 'Phone number'], ['Lead source', 'Source / campaign'], ['Won deal value', 'Contracts & closed revenue']] },
  'institute-crm': { mappings: [['Learner name', 'Full name'], ['Email', 'Email'], ['Mobile', 'Phone number'], ['Enquiry source', 'Source / campaign'], ['Course fee (enrolled)', 'Contracts & closed revenue']] },
  cdp: { mappings: [['profile.name', 'Full name'], ['profile.email', 'Email'], ['profile.phone', 'Phone number'], ['event.utm_campaign', 'Marketing channel & campaign']] },
  'seo-cloud': { mappings: null, noMapNote: 'SEO Cloud shares keyword, ranking and approval data only, so there are no lead fields to map.' },
  hubspot: { mappings: [['First Name + Last Name (Contacts)', 'Full name'], ['Company', 'Organisation'], ['Email', 'Email'], ['Phone number', 'Phone number'], ['Original Source (hs_analytics_source)', 'Source / campaign'], ['Deal Amount in Company Currency (closed won)', 'Contracts & closed revenue']] },
  salesforce: { mappings: [['FirstName + LastName (Leads & Contacts)', 'Full name'], ['Account', 'Organisation'], ['Email', 'Email'], ['Phone', 'Phone number'], ['LeadSource', 'Source / campaign'], ['Opportunity Amount (IsWon = true)', 'Contracts & closed revenue']] },
  zoho: { mappings: [['First Name + Last Name (Leads)', 'Full name'], ['Company', 'Organisation'], ['Email', 'Email'], ['Mobile', 'Phone number'], ['Lead Source', 'Source / campaign'], ['Deal Amount (Stage = Closed Won)', 'Contracts & closed revenue']] },
  dynamics: { mappings: [['fullname (Lead)', 'Full name'], ['companyname', 'Organisation'], ['emailaddress1', 'Email'], ['mobilephone', 'Phone number'], ['leadsourcecode', 'Source / campaign'], ['actualvalue (Opportunity, state = Won)', 'Contracts & closed revenue']] },
  mailchimp: { mappings: [['FNAME + LNAME', 'Full name'], ['EMAIL', 'Email'], ['PHONE', 'Phone number'], ['Audience tags', 'Marketing source / keyword'], ['Campaign opens / clicks', 'Marketing channel & campaign']] },
  slack: { mapTitle: 'Notification Routing', mapHelp: 'Choose which Slack channel receives each Galaxis event.', sourceLabel: 'Galaxis event', targetLabel: 'Slack channel',
    options: ['#leads', '#marketing-alerts', '#general', 'Do not send'], mappings: [['New lead created', '#leads'], ['Lead converted', '#leads'], ['Integration error', '#marketing-alerts']] }
};

// ---------- Helpers ----------
function integNow() { return new Date().toISOString(); }
function integEntry(pid, wsId = state.ctx) { return wsProducts(wsId)[pid]; }
function integIsOom(p) { return p.provider === 'oom'; }
function integWebhookUrl(pid) { return `https://hub.example.com/webhook/leads/${pid}?id=gal_XXXX`; }
function integDot(color, label) { return `<span class="dot-label integ-dot-${color}"><span class="dot dot-${color}${color === 'grey' ? '' : '-strong'}"></span>${esc(label)}</span>`; }
function integFlowLabel(p) { return p.flow === 'internal' ? 'Managed by OOm' : p.flow === 'oauth' ? 'OAuth 2.0' : 'API & Webhook'; }
// Every connected product is listed under Active Products (one per lane, so there is no connected-but-inactive state).
function integInActiveSection(e) { return !!e; }

function integStatusDots(pid, wsId = state.ctx) {
  const e = integEntry(pid, wsId);
  if (!e) return integDot('grey', 'Not Connected');
  if (e.status === 'pending') return integDot('orange', 'Pending Setup');
  if (e.status === 'error') return integDot('red', 'Error');
  if (e.status === 'disabled') return integDot('grey', 'Disabled');
  return integDot('green', 'Connected') + (e.active ? integDot('green', 'Active') : integDot('grey', 'Inactive'));
}

function integMatches(p) {
  const t = state.ui.integSearch.trim().toLowerCase();
  return !t || [p.name, p.category, p.description, p.dataShared].join(' ').toLowerCase().includes(t);
}

// ---------- Screen ----------
registerScreen('integrations', {
  contexts: ['agency', 'client'],
  title: () => 'Integrations',
  desc: () => 'Connect the products that integrate with your workspace to send and receive data.',
  render: () => isAgency() ? integRenderAgency() : integRenderClient(),
  afterRender: () => {}
});
// Connection set-up: a dedicated client screen with breadcrumbed steps (replaces the config slide-over).
registerScreen('integration-setup', {
  contexts: ['client'],
  key: () => 'client-integration-setup',
  title: () => `${integEntry(integCfg().pid) ? 'Configure' : 'Connect'} ${productById(integCfg().pid).name}`,
  desc: () => 'Set up the connection step by step. Nothing changes in your workspace until you finish.',
  render: integSetupRender
});
// Dev jump: Delacon (API product, so every step incl. Webhook) in the current client workspace.
registerDevScreen('Client workspace', 'client-integration-setup', 'Integration set-up', () => { state.ctx = devClientCtx(); integOpenSetup('delacon'); });

// ================= CLIENT WORKSPACE =================
function integRenderClient() {
  return `<div class="integ-page">
    <div class="search integ-search"><input class="input" placeholder="Search" value="${esc(state.ui.integSearch)}" oninput="state.ui.integSearch = this.value; integRenderGrids()" aria-label="Search products"><i data-lucide="search"></i></div>
    <div id="integ-readiness">${integReadinessHTML()}</div>
    <div id="integ-grids">${integGridsHTML()}</div>
    <div id="integ-ads">${integAdsHTML()}</div>
  </div>`;
}
function integRenderGrids() { renderRegion('integ-grids', integGridsHTML()); }

// V2 pipeline readiness strip, computed from the workspace data.
function integReadinessHTML() {
  const ws = state.ctx;
  const plats = wsPlatforms(ws).length;
  const level = ids => {
    const es = ids.map(id => integEntry(id)).filter(Boolean);
    if (es.some(e => e.status === 'connected' && e.active)) return 'active';
    if (es.length) return 'warning';
    return 'off';
  };
  const crmIds = products.filter(p => p.category === 'CRM').map(p => p.id);
  const items = [
    ['Ads', plats === 2 ? 'active' : plats === 1 ? 'warning' : 'off', plats === 2 ? 'Google and Meta linked' : plats === 1 ? 'Only one ad platform linked' : 'No ad accounts linked'],
    ['CRM', activeCrm(ws) ? 'active' : level(crmIds) === 'off' ? 'off' : 'warning', activeCrm(ws) ? `${activeCrm(ws).name} active` : level(crmIds) === 'off' ? 'No CRM connected' : 'CRM needs attention'],
    ['Messaging', level(['aurix', 'sleekflow', 'wati']), ''],
    ['Calls', level(['delacon']), '']
  ];
  const icon = { active: 'check', warning: 'triangle-alert', off: 'minus' };
  const tip = { active: 'Active', warning: 'Needs attention', off: 'Not connected' };
  return `<div class="integ-readiness" aria-label="Pipeline readiness"><span class="integ-readiness-label">Pipeline readiness</span>
    ${items.map(([label, lv, t]) => `<span class="integ-ready integ-ready-${lv}" title="${esc(t || tip[lv])}"><i data-lucide="${icon[lv]}"></i>${label}</span>`).join('')}</div>`;
}

function integGridsHTML() {
  const entries = wsProducts(state.ctx);
  const active = products.filter(p => integInActiveSection(entries[p.id]) && integMatches(p));
  const activeCount = products.filter(p => entries[p.id]?.status === 'connected' && entries[p.id]?.active).length;
  const avail = products.filter(p => !integInActiveSection(entries[p.id]) && integMatches(p));
  const cat = state.ui.integCat;
  const shown = avail.filter(p => cat === 'all' || p.category === cat);
  const count = c => avail.filter(p => c === 'all' || p.category === c).length;
  const searching = !!state.ui.integSearch.trim();
  return `
    <section class="integ-section">
      <div class="row"><h2 class="h-section">Active Products</h2>${integDot('green', `${activeCount} Active`)}</div>
      <div class="integ-sub">These products are currently connected and active in your workspace.</div>
      ${active.length ? `<div class="integ-grid-3">${active.map(integActiveCard).join('')}</div>`
        : `<div class="card integ-empty-card">${emptyState('blocks', searching ? 'No active products match your search' : 'No active products yet', searching ? 'Try another product name or category.' : 'Connect a product below to start sending and receiving data.')}</div>`}
    </section>
    <section class="integ-section">
      <h2 class="h-section">Available Products</h2>
      <div class="integ-sub">Browse and manage all available products and providers.</div>
      <div class="cat-tabs" role="tablist">${INTEG_CATS.map(c => `<button type="button" role="tab" class="cat-tab ${cat === c.id ? 'active' : ''}" onclick="state.ui.integCat='${c.id}'; integRenderGrids()"><i data-lucide="${c.icon}"></i>${c.label} (${count(c.id)})</button>`).join('')}</div>
      <div class="integ-grid-4">${shown.map(integAvailCard).join('')}
        ${!searching ? `<div class="card integ-card integ-coming"><div class="integ-card-head"><span class="product-logo integ-oom-logo">OOm</span><div class="grow"><div class="h-card">Coming Soon</div></div></div><div class="integ-desc">More products coming your way.</div></div>` : ''}
      </div>
      ${!shown.length && searching ? emptyState('search-x', 'No products found', `Nothing matches “${state.ui.integSearch}” in this category.`) : ''}
    </section>`;
}

function integActiveCard(p) {
  const e = integEntry(p.id);
  const crm = e.routedVia ? productById(e.routedVia) : null;
  const items = [
    { label: 'View details', icon: 'info', onClick: `integOpenDrawer('${p.id}','about')` },
    { label: 'Configure', icon: 'settings-2', onClick: `integOpenSetup('${p.id}')` },
    e.status === 'disabled' ? { label: 'Enable', icon: 'play', onClick: `integActivate('${p.id}')` } : { label: 'Disable', icon: 'pause', onClick: `integDisable('${p.id}')` },
    'sep',
    { label: 'Disconnect', icon: 'unplug', danger: true, onClick: `integDisconnect('${p.id}')` }
  ];
  const alert = e.status === 'error' || e.status === 'pending' ? `
    <div class="integ-alert integ-alert-${e.status === 'error' ? 'error' : 'warning'}">
      <i data-lucide="${e.status === 'error' ? 'circle-alert' : 'clock-alert'}"></i>
      <div class="grow"><div class="t-bold">${e.status === 'error' ? 'Connection error' : 'Setup incomplete'}</div><div class="t-caption">${esc(e.error || 'Finish setting up this product to start syncing.')}</div></div>
      <button type="button" class="btn btn-sm ${e.status === 'error' ? 'btn-danger' : 'integ-btn-warning'}" onclick="integOpenSetup('${p.id}')">${e.status === 'error' ? 'Fix Now' : 'Resume Setup'}</button>
    </div>` : '';
  const action = e.status === 'disabled'
    ? `<button type="button" class="btn btn-outline" onclick="integActivate('${p.id}')"><i data-lucide="play"></i>Enable</button>`
    : `<button type="button" class="btn btn-outline" onclick="integOpen('${p.id}')"><i data-lucide="square-arrow-out-up-right"></i>Open</button>`;
  return `<div class="card integ-card ${e.status === 'disabled' ? 'integ-card-muted' : ''}" data-product="${p.id}">
    <div class="integ-card-head">${productLogo(p.id, 32)}
      <div class="grow"><div class="h-card">${esc(p.name)}</div><div class="integ-cat">${esc(p.category)}</div><div class="integ-dots">${integStatusDots(p.id)}</div></div>
      ${rowMenu(`integ-m-${p.id}`, items)}</div>
    ${crm ? `<div class="integ-routed"><i data-lucide="git-merge"></i>Routed via ${esc(crm.name)}</div>` : ''}
    <div class="integ-desc">${esc(p.description)}</div>
    ${alert}
    <div class="integ-meta">
      <div class="integ-meta-row"><i data-lucide="share-2"></i><div><div>Data shared</div><div class="integ-meta-val">${esc(p.dataShared)}</div></div></div>
      <div class="integ-meta-row"><i data-lucide="refresh-ccw"></i><div><div>Last synced</div><div class="integ-meta-val">${e.lastSynced ? fmtDateTime(e.lastSynced) : 'Not synced yet'}</div></div></div>
    </div>
    <div class="integ-card-foot">${action}</div>
  </div>`;
}

function integAvailCard(p) {
  const items = [{ label: 'View details', icon: 'info', onClick: `integOpenDrawer('${p.id}','about')` }, { label: 'Connect', icon: 'plug', onClick: `integConnect('${p.id}')` }];
  return `<div class="card integ-card" data-product="${p.id}">
    <div class="integ-card-head">${productLogo(p.id, 32)}
      <div class="grow"><div class="h-card">${esc(p.name)}</div><div class="integ-cat">${esc(p.category)}</div></div>
      ${rowMenu(`integ-m-${p.id}`, items)}</div>
    <div class="integ-desc">${esc(p.description)}</div>
    <div class="integ-card-foot integ-foot-split">
      <button type="button" class="t-link integ-learn" onclick="integOpenDrawer('${p.id}','about')">Learn More</button>
      <button type="button" class="btn btn-primary" onclick="integConnect('${p.id}')">Connect</button>
    </div>
  </div>`;
}

// "Open" — OOm products launch the product; third-party products show their details.
function integOpen(pid) {
  const p = productById(pid);
  if (integIsOom(p)) openProductApp(pid);
  else integOpenDrawer(pid, 'about');
}

// ---------- Rules: connect / enable / disable / disconnect ----------
// One per lane: a workspace can connect only one CRM, one chat platform and one call tracker (PRODUCT_LANES).
// Connecting a second one asks to replace the current one, which is disconnected when the new one is saved.
function integReplaceText(pid, old) {
  const lane = PRODUCT_LANES[productLane(pid)];
  return `Only one ${lane.noun} can be connected at a time. Connecting ${productById(pid).name} will disconnect ${old.name}. Data already synced from ${old.name} will not be deleted.`;
}

function integConnect(pid) {
  const old = laneOccupant(state.ctx, pid);
  if (old) {
    confirmDialog({ title: `Replace ${old.name}?`, text: integReplaceText(pid, old), confirmLabel: `Replace with ${productById(pid).name}`,
      onConfirm: () => setTimeout(() => integBeginConnect(pid), 0) });
    return;
  }
  integBeginConnect(pid);
}

function integBeginConnect(pid) {
  const p = productById(pid);
  const crm = activeCrm(state.ctx);
  if (INTEG_ROUTABLE.includes(pid) && crm && INTEG_THIRD_CRMS.includes(crm.id) && !integEntry(pid)) { integOpenRouting(pid); return; }
  if (p.flow === 'internal') {
    closeDrawer();
    const old = integCommit(pid).replaced;
    showToast(old ? `${p.name} connected. ${old.name} was disconnected.` : `${p.name} connected and active`);
    return;
  }
  integOpenSetup(pid);
}

// Remove a product's entry; products routed through a CRM lose their path.
function integRemove(pid, verb) {
  if (productById(pid).category === 'CRM') integOrphanRouted(pid, verb);
  delete wsProducts(state.ctx)[pid];
}

// Write a connected entry. Any other product in the same lane is disconnected (one per lane).
// Swaps only happen here, on save, so closing the config drawer changes nothing.
function integCommit(pid, { extra = {} } = {}) {
  const entries = wsProducts(state.ctx);
  const replaced = laneOccupant(state.ctx, pid);
  if (replaced) integRemove(replaced.id, 'replaced');
  const e = Object.assign({}, entries[pid], { status: 'connected', active: true, lastSynced: integNow() }, extra);
  delete e.error;
  entries[pid] = e;
  render();
  return { entry: e, replaced };
}

// Products routed through a CRM lose their path when that CRM stops syncing.
function integOrphanRouted(crmId, verb) {
  const crm = productById(crmId);
  Object.entries(wsProducts(state.ctx)).forEach(([pid, e]) => {
    if (e.routedVia !== crmId) return;
    delete e.routedVia;
    e.status = 'pending'; e.active = false;
    e.error = `Routing via ${crm.name} stopped because ${crm.name} was ${verb}. Connect ${productById(pid).name} directly to resume syncing.`;
  });
}

// Re-enable a disabled product.
function integActivate(pid) {
  const p = productById(pid);
  const e = integEntry(pid);
  e.status = 'connected'; e.active = true; e.lastSynced = integNow(); delete e.error;
  closeDrawer();
  render();
  showToast(`${p.name} is active`);
}

function integDisable(pid) {
  const p = productById(pid);
  confirmDialog({
    title: 'Disabling This Product?',
    text: 'Disabling this product will pause data synchronisation, so new updates will no longer be reflected. You can activate it again whenever you’re ready.',
    confirmLabel: 'Disable',
    onConfirm: () => {
      const e = integEntry(pid);
      e.status = 'disabled'; e.active = false;
      if (p.category === 'CRM') integOrphanRouted(pid, 'disabled');
      closeDrawer();
      render();
      showToast(`${p.name} disabled. Sync is paused.`, 'pause');
    }
  });
}

// Fixes V2: removes only this product's entry instead of resetting every integration.
function integDisconnect(pid) {
  const p = productById(pid);
  confirmDialog({
    title: 'Disconnect This Product?',
    text: 'This will remove the product’s connection from your workspace. Existing data will not be deleted. You’ll need to reconnect it to use the product again. This action cannot be undone.',
    confirmLabel: 'Disconnect',
    danger: true,
    onConfirm: () => {
      integRemove(pid, 'disconnected');
      closeDrawer();
      if (state.page === 'integration-setup') { state.ui.integCfg = null; navigate('integrations'); } else render();
      showToast(`${p.name} disconnected`, 'unplug');
    }
  });
}

// ---------- V2 routing choice ----------
function integOpenRouting(pid) {
  const p = productById(pid);
  const crm = activeCrm(state.ctx);
  const activity = pid === 'delacon' ? 'call' : 'chat';
  openModal({
    title: `Does ${crm.name} already capture your ${p.name} activity?`,
    desc: `Choose how Galaxis should capture your ${activity} activity. We can either receive this data through your existing CRM connection, or connect ${p.name} directly to Galaxis.`,
    size: 'lg',
    body: `<div class="integ-route-grid">
      <div class="integ-route">
        <div class="t-bold">Yes — ${esc(p.name)} is connected to ${esc(crm.name)}</div>
        <div class="integ-route-flow">${esc(p.name)} → ${esc(crm.name)} → Galaxis</div>
        <p class="t-caption t-secondary">Your ${esc(p.name)} leads already flow into ${esc(crm.name)}. We’ll use the existing ${esc(crm.name)} connection to bring them into Galaxis.</p>
        <button type="button" class="btn btn-primary" onclick="integRouteYes('${pid}')">Use ${esc(crm.name)} connection</button>
      </div>
      <div class="integ-route">
        <div class="t-bold">No — ${esc(p.name)} is not connected to ${esc(crm.name)}</div>
        <div class="integ-route-flow">${esc(p.name)} → Galaxis</div>
        <p class="t-caption t-secondary">${esc(p.name)} operates separately from ${esc(crm.name)}. We’ll connect ${esc(p.name)} directly to Galaxis to capture your leads and activity.</p>
        <button type="button" class="btn btn-outline" onclick="integRouteNo('${pid}')">Connect ${esc(p.name)} to Galaxis</button>
      </div>
    </div>`,
    actions: [{ label: 'Cancel', kind: 'outline' }]
  });
}
function integRouteYes(pid) {
  const crm = activeCrm(state.ctx);
  closeModal();
  const old = integCommit(pid, { extra: { routedVia: crm.id } }).replaced;
  showToast(`${productById(pid).name} activity will be captured through ${crm.name}.${old ? ` ${old.name} was disconnected.` : ''}`, 'git-merge');
}
function integRouteNo(pid) {
  closeModal();
  integOpenSetup(pid);
}

// ---------- About slide-over + connection set-up screen ----------
// About stays a slide-over (product details before connecting). Connecting or configuring a product opens the
// dedicated set-up screen ('integration-setup') with breadcrumbed steps. Nothing is saved until the last step.
// Global entry point for other modules: integOpenProduct('sleekflow', 'config') from anywhere in a client workspace.
function integOpenProduct(pid, mode = 'about', wsId) {
  if (wsId && wsId !== state.ctx) state.ctx = wsId;
  if (mode === 'config') { integOpenSetup(pid); return; }
  if (state.page !== 'integrations') navigate('integrations');
  integOpenDrawer(pid, mode);
}

function integOpenDrawer(pid, mode = 'about') {
  if (mode === 'config') { integOpenSetup(pid); return; }
  openDrawer(`<div id="integ-drawer">${integAboutHTML(pid)}</div>`, integDrawerFooter(pid));
}

function integDrawerHead(p) {
  return `<div class="integ-drawer-head">${productLogo(p.id, 40)}<div><div class="h-card">${esc(p.name)}</div><div class="integ-cat">${esc(p.category)}</div><div class="integ-dots">${integStatusDots(p.id)}</div></div></div>`;
}

function integAboutHTML(pid) {
  const p = productById(pid);
  const about = integIsOom(p) ? `${p.name} is an OOm product. ${p.description}` : `Connect ${p.name} to sync ${p.dataShared.toLowerCase().replace(/, ([^,]+)$/, ' and $1')} between your workspace and ${p.name}.`;
  return `${integDrawerHead(p)}
    <h4>About this integration</h4><p class="integ-drawer-p">${esc(about)}</p>
    <h4>What can be synced?</h4><ul>${p.syncs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <h4>Requirements</h4><ul>${p.requirements.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <h4>Before you connect</h4><p class="integ-drawer-p">You can connect multiple products, but only one CRM, one chat platform and one call tracker can be connected at a time. Connecting another one replaces the current one.</p>`;
}

function integDrawerFooter(pid) {
  if (!integEntry(pid)) return `<button type="button" class="btn btn-primary" onclick="integConnect('${pid}')">Connect</button>`;
  return `<button type="button" class="btn btn-primary" onclick="integOpenSetup('${pid}')"><i data-lucide="settings-2"></i>Configure</button>`;
}

// Steps by connection type: API products add the optional Webhook step.
function integSetupSteps(p) {
  const g = integGuides[p.id] || {};
  return [
    { key: 'connect', label: p.flow === 'internal' ? 'Connection' : 'Connect account' },
    ...(p.flow === 'api' ? [{ key: 'webhook', label: 'Webhook' }] : []),
    { key: 'mapping', label: g.mapTitle || 'Field mapping' },
    { key: 'review', label: 'Review & sync' }
  ];
}
function integCfgDraft(pid) {
  const p = productById(pid);
  const e = integEntry(pid);
  const g = integGuides[pid] || {};
  return {
    pid, step: 0,
    authed: !!e && e.status === 'connected' && !e.routedVia,
    verified: !!e && e.status === 'connected' && !e.routedVia && p.flow === 'api', webhookTested: false, showKey: false,
    key: e && p.flow === 'api' && !e.routedVia ? 'sk_test_PLACEHOLDER' : '',
    backfill: (e && e.backfill) || 'lifetime',
    mapping: (e && e.mapping) || Object.fromEntries((g.mappings || []).map(([s, t]) => [s, t]))
  };
}
function integOpenSetup(pid) {
  closeDrawer();
  state.ui.integCfg = integCfgDraft(pid);
  navigate('integration-setup', { pid });
}
function integCfg() {
  const pid = state.params.pid || 'delacon';
  if (!state.ui.integCfg || state.ui.integCfg.pid !== pid) state.ui.integCfg = integCfgDraft(pid);
  return state.ui.integCfg;
}
function integSetupExit() { state.ui.integCfg = null; navigate('integrations'); }
// Editing an existing, working connection: every step can be opened directly.
function integSetupEditing(c) { const e = integEntry(c.pid); return !!e && e.status === 'connected' && !e.routedVia; }
function integConnOk(c) {
  const p = productById(c.pid);
  return p.flow === 'internal' || (p.flow === 'oauth' ? c.authed : c.verified);
}

function integSetupRender() {
  const c = integCfg();
  const p = productById(c.pid);
  const e = integEntry(c.pid);
  const steps = integSetupSteps(p);
  const editing = integSetupEditing(c);
  const reach = i => editing || i <= c.step || (i === c.step + 1 && integSetupValid(c, false));
  const stepper = steps.map((s, i) => {
    const cls = i === c.step ? 'is-current' : i < c.step ? 'is-done' : '';
    return `<li class="${cls}"><button type="button" onclick="integSetupGo(${i})" ${reach(i) ? '' : 'disabled'} ${i === c.step ? 'aria-current="step"' : ''}>
      <span class="integ-stepper-num">${i < c.step ? '<i data-lucide="check"></i>' : i + 1}</span>${esc(s.label)}</button></li>`;
  }).join('<li class="integ-stepper-sep" aria-hidden="true"><i data-lucide="chevron-right"></i></li>');
  const last = c.step === steps.length - 1;
  return `<div class="integ-setup">
    <nav class="integ-crumbs" aria-label="Breadcrumb">
      <button type="button" class="t-link" onclick="integSetupExit()">Integrations</button><i data-lucide="chevron-right"></i>
      <span>${esc(p.name)}</span><i data-lucide="chevron-right"></i><span class="integ-crumb-current">${editing || e ? 'Configure' : 'Connect'}</span>
    </nav>
    <section class="card integ-setup-head">${integDrawerHead(p)}<span class="integ-tag">${integFlowLabel(p)}</span></section>
    <ol class="integ-stepper" aria-label="Set-up steps">${stepper}</ol>
    <section class="card integ-setup-body">
      <div class="integ-setup-step t-caption t-muted">Step ${c.step + 1} of ${steps.length}</div>
      ${integSetupStepHTML(c, steps[c.step].key)}
    </section>
    <div class="integ-setup-foot">
      ${e ? `<button type="button" class="btn btn-danger-outline" onclick="integDisconnect('${c.pid}')">Disconnect</button>` : ''}
      <span class="grow"></span>
      <button type="button" class="btn btn-ghost" onclick="integSetupExit()">Cancel</button>
      ${c.step ? '<button type="button" class="btn btn-outline" onclick="integSetupGo(state.ui.integCfg.step - 1)"><i data-lucide="arrow-left"></i>Back</button>' : ''}
      ${last ? `<button type="button" class="btn btn-primary" id="integ-save" onclick="integSaveConfig()">${e ? 'Save Configuration' : 'Connect and start sync'}</button>`
        : '<button type="button" class="btn btn-primary" onclick="integSetupNext()">Next<i data-lucide="arrow-right"></i></button>'}
    </div>
  </div>`;
}

// Only the connection step has a requirement: OAuth authorised, or the API key entered and verified.
function integSetupValid(c, tell = true) {
  const p = productById(c.pid);
  if (integSetupSteps(p)[c.step].key !== 'connect' || integConnOk(c)) return true;
  if (tell) {
    if (p.flow === 'oauth') showToast(`Connect ${p.name} via OAuth to continue`, 'triangle-alert');
    else if (!c.key.trim()) { showToast('Enter an API key to continue', 'key-round'); document.getElementById('integ-key')?.focus(); }
    else showToast('Verify the connection to continue', 'triangle-alert');
  }
  return false;
}
function integSetupNext() {
  const c = state.ui.integCfg;
  if (!integSetupValid(c)) return;
  integSetupGo(c.step + 1);
}
function integSetupGo(i) {
  const c = state.ui.integCfg;
  const n = integSetupSteps(productById(c.pid)).length;
  if (i > c.step && !integSetupEditing(c) && !integSetupValid(c)) return;
  c.step = Math.max(0, Math.min(n - 1, i));
  rerender();
  window.scrollTo(0, 0);
}
function integRefreshConfig() { if (state.page === 'integration-setup') rerender(); }

function integSteps(steps, pid) {
  return `<ol class="integ-steps">${steps.map(s => `<li><span>${s.replace(/\{URL\}/g, esc(integWebhookUrl(pid)))}</span></li>`).join('')}</ol>`;
}

function integSetupStepHTML(c, key) {
  const p = productById(c.pid);
  const e = integEntry(c.pid);
  const g = integGuides[c.pid] || {};
  const head = (title, tag = '') => `<div class="integ-cfg-head"><h3 class="h-card">${esc(title)}</h3>${tag}</div>`;

  if (key === 'connect') {
    const routedCrm = e && e.routedVia ? productById(e.routedVia) : null;
    const ok = integConnOk(c) && !(e && e.status === 'error');
    let conn;
    if (p.flow === 'internal') {
      conn = `<div class="integ-managed"><i data-lucide="shield-check"></i><div><div class="t-bold">Managed by OOm — no credentials needed</div><div class="t-caption t-secondary">${esc(p.name)} is part of your OOm subscription. Galaxis connects to it automatically.</div></div></div>`;
    } else if (p.flow === 'oauth') {
      conn = `<div class="integ-input-row"><div class="grow"><div class="field-label">Connection</div>
          <div class="t-caption ${c.authed ? 't-success' : 't-muted'}" id="integ-oauth-status">${c.authed ? `✓ Connected via OAuth · ${esc(p.name)}` : e && e.status === 'pending' ? 'OAuth authorisation incomplete' : 'Not connected'}</div></div>
        <button type="button" class="btn btn-outline btn-sm" id="integ-oauth-btn" onclick="integOAuth()">${c.authed ? 'Re-authorise' : 'Connect via OAuth'}</button></div>`;
    } else {
      conn = `<div class="integ-guide"><div class="integ-guide-title">API set-up: connect account and import contacts</div>${integSteps(g.apiSteps || [], c.pid)}</div>
        <div class="field"><label class="field-label" for="integ-key">${esc(g.keyLabel || 'API key / token')}<span class="req">*</span></label>
          <div class="integ-input-row">
            <div class="integ-key grow"><input id="integ-key" class="input mono" type="${c.showKey ? 'text' : 'password'}" placeholder="sk_test_PLACEHOLDER" value="${esc(c.key)}" oninput="state.ui.integCfg.key = this.value; state.ui.integCfg.verified = false" autocomplete="off">
              <button type="button" class="integ-eye" onclick="state.ui.integCfg.showKey = !state.ui.integCfg.showKey; integRefreshConfig()" aria-label="${c.showKey ? 'Hide' : 'Show'} key"><i data-lucide="${c.showKey ? 'eye-off' : 'eye'}"></i></button></div>
            <button type="button" class="btn btn-outline btn-sm" id="integ-verify-btn" onclick="integVerify()">${c.verified ? 'Re-test connection' : 'Verify connection'}</button>
          </div>
          <div class="t-caption ${c.verified ? 't-success' : 't-muted'}" id="integ-verify-status">${c.verified ? '✓ Connection verified and schema synchronised.' : 'Connection has not been verified yet.'}</div>
        </div>`;
    }
    return `${head(p.flow === 'internal' ? 'Connection' : `Connect your ${p.name} account`, `<span class="integ-tag ${ok ? 'integ-tag-ok' : 'integ-tag-warn'}">${ok ? 'Connected' : 'Action Required'}</span>`)}
      <p class="integ-help">Galaxis uses this connection to import lead data and identify conversion events.</p>
      ${e && e.error ? `<div class="integ-alert integ-alert-${e.status === 'error' ? 'error' : 'warning'}"><i data-lucide="circle-alert"></i><div class="t-caption">${esc(e.error)}</div></div>` : ''}
      ${routedCrm ? `<div class="integ-managed"><i data-lucide="git-merge"></i><div><div class="t-bold">Routed via ${esc(routedCrm.name)}</div><div class="t-caption t-secondary">Galaxis receives ${esc(p.name)} activity through your ${esc(routedCrm.name)} connection. Finish these steps to connect ${esc(p.name)} directly instead.</div></div></div>` : ''}
      ${conn}`;
  }

  if (key === 'webhook') {
    return `${head('Webhook', '<span class="integ-tag">Optional · Real-Time Sync</span>')}
      <p class="integ-help">${esc(g.webhookNote || 'Enable instant updates from the connected platform. You can skip this step and set it up later.')}</p>
      <div class="integ-guide"><div class="integ-guide-title">Webhook set-up: enable real-time sync</div>${integSteps(g.webhookSteps || [], c.pid)}</div>
      <div class="integ-webhook"><code id="integ-webhook-url">${esc(integWebhookUrl(c.pid))}</code><button type="button" class="btn btn-ghost btn-sm" onclick="integCopyWebhook(this)"><i data-lucide="copy"></i>Copy</button></div>
      <div class="row integ-mt"><button type="button" class="btn btn-outline btn-sm" id="integ-webhook-btn" onclick="integTestWebhook()">Test webhook signal</button>
        <span class="t-caption ${c.webhookTested ? 't-success' : 't-muted'}" id="integ-webhook-status">${c.webhookTested ? '✓ Test callback received successfully' : 'Not tested yet'}</span></div>`;
  }

  if (key === 'mapping') {
    const opts = g.options || INTEG_FIELDS;
    const mapping = g.mappings ? `
      <div class="integ-map">
        <div class="integ-map-row integ-map-head"><div>${esc(g.sourceLabel || `${p.name} field`)}</div><div></div><div>${esc(g.targetLabel || 'Galaxis field')}</div></div>
        ${g.mappings.map(([src]) => `<div class="integ-map-row"><div class="integ-map-src">${esc(src)}</div><i data-lucide="arrow-right"></i>
          <select class="select" aria-label="Map ${esc(src)}" onchange="state.ui.integCfg.mapping['${q(src)}'] = this.value">${opts.map(o => `<option ${o === c.mapping[src] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`).join('')}
      </div>` : `<p class="integ-help">${esc(g.noMapNote || 'No fields to map for this product.')}</p>`;
    return `${head(g.mapTitle || 'Lead Field Mapping', g.mappings ? '<span class="integ-tag integ-tag-ok">Auto-mapped</span>' : '')}
      <p class="integ-help">${esc(g.mapHelp || 'Review how source fields map into Galaxis. You can change them later without repeating the connection set-up.')}</p>
      ${mapping}`;
  }

  // Review & sync: backfill choice, a summary of the earlier steps, and the one-per-lane replacement warning.
  const old = laneOccupant(state.ctx, c.pid);
  const mapped = g.mappings ? g.mappings.filter(([s]) => c.mapping[s] && c.mapping[s] !== 'Do not map').length : 0;
  const row = (label, value, ok) => `<div class="integ-review-row"><span class="t-muted">${esc(label)}</span><span class="${ok === false ? 't-warning' : ''}">${value}</span></div>`;
  return `${head('Review & sync')}
    <p class="integ-help">Check the set-up, choose how much history to import, then ${e ? 'save' : 'connect'}.</p>
    ${old ? `<div class="integ-alert integ-alert-warning"><i data-lucide="triangle-alert"></i><div class="t-caption">${esc(integReplaceText(c.pid, old))}</div></div>` : ''}
    <div class="integ-review">
      ${row('Connection', p.flow === 'internal' ? 'Managed by OOm' : p.flow === 'oauth' ? 'OAuth authorised' : 'API key verified')}
      ${p.flow === 'api' ? row('Webhook', c.webhookTested ? 'Tested · real-time sync on' : 'Not set up · syncs on schedule', c.webhookTested) : ''}
      ${row(g.mapTitle || 'Field mapping', g.mappings ? `${mapped} of ${g.mappings.length} fields mapped` : 'Nothing to map')}
    </div>
    <div class="field integ-mt"><label class="field-label" for="integ-backfill">Historical Backfill</label>
      <select class="select" id="integ-backfill" onchange="state.ui.integCfg.backfill = this.value">${INTEG_BACKFILL.map(([v, l]) => `<option value="${v}" ${v === c.backfill ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="t-caption t-muted integ-mt">Choose how much historical lead data Galaxis should import. Changes take effect after saving.</div></div>`;
}

function integBusy(btnId, label, ms, done) {
  const b = document.getElementById(btnId);
  if (b) { b.disabled = true; b.textContent = label; }
  setTimeout(() => { if (state.ui.integCfg) { done(); integRefreshConfig(); } }, ms);
}
function integOAuth() {
  const p = productById(state.ui.integCfg.pid);
  integBusy('integ-oauth-btn', `Connecting to ${p.name}…`, 900, () => { state.ui.integCfg.authed = true; showToast(`${p.name} connection verified`, 'shield-check'); });
}
function integVerify() {
  const c = state.ui.integCfg;
  const p = productById(c.pid);
  if (!c.key.trim()) { showToast('Enter an API key first', 'key-round'); document.getElementById('integ-key')?.focus(); return; }
  integBusy('integ-verify-btn', 'Testing connection…', 900, () => { c.verified = true; showToast(`${p.name} connection verified`); });
}
function integTestWebhook() {
  integBusy('integ-webhook-btn', 'Testing…', 900, () => { state.ui.integCfg.webhookTested = true; showToast('Webhook signal verified with a sample callback', 'zap'); });
}
function integCopyWebhook(btn) {
  const text = document.getElementById('integ-webhook-url').textContent;
  const done = () => { showToast('Webhook URL copied', 'clipboard-check'); btn.innerHTML = '<i data-lucide="check"></i>Copied'; refreshIcons(); setTimeout(() => { btn.innerHTML = '<i data-lucide="copy"></i>Copy'; refreshIcons(); }, 1200); };
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { showToast('Copy failed — select the URL manually', 'triangle-alert'); }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

function integSaveConfig() {
  const c = state.ui.integCfg;
  const p = productById(c.pid);
  if (!integConnOk(c)) { c.step = 0; rerender(); integSetupValid(c); return; }
  const existed = !!integEntry(c.pid);
  const { entry, replaced } = integCommit(c.pid, { extra: { backfill: c.backfill, mapping: { ...c.mapping } } });
  delete entry.routedVia;
  state.ui.integCfg = null;
  navigate('integrations');
  showToast(`${existed ? `Configuration saved for ${p.name}` : `${p.name} connected`}. Sync started.${replaced ? ` ${replaced.name} was disconnected.` : ''}`);
}

// ---------- Ad platforms (V1 workspace linking, Figma card style) ----------
function integAdsHTML() {
  return `<section class="integ-section">
    <h2 class="h-section">Ad Platforms</h2>
    <div class="integ-sub">Link one Google Ads and one Meta Ads account to this workspace.</div>
    <div class="integ-grid-2">${['google', 'meta'].map(integAdCard).join('')}</div>
  </section>`;
}

function integAdCard(plat) {
  const acc = wsAdAccounts(state.ctx).find(a => a.platform === plat);
  const name = `${PLATFORM_NAME[plat]} Ads`;
  const agency = viewerIsAgency();
  let body;
  if (acc) {
    body = `<div class="integ-meta">
        <div class="integ-meta-row"><i data-lucide="badge-check"></i><div><div>Account name</div><div class="integ-meta-val integ-meta-strong">${esc(acc.name)}</div></div></div>
        <div class="integ-meta-row"><i data-lucide="hash"></i><div><div>Account ID</div><div class="integ-meta-val mono">${esc(acc.id)}</div></div></div>
      </div>
      ${agency ? `<div class="integ-card-foot"><button type="button" class="btn btn-danger-outline" onclick="integUnlinkAd('${q(acc.id)}')"><i data-lucide="unlink"></i>Unlink</button></div>` : ''}`;
  } else if (agency) {
    body = `<div class="integ-ad-link">
        <label class="field-label" for="integ-ad-${plat}">${plat === 'google' ? 'Google Ads Customer ID' : 'Meta Ad Account ID'}</label>
        <div class="integ-input-row"><input id="integ-ad-${plat}" class="input mono grow" placeholder="Enter exact Account ID" onkeydown="if (event.key === 'Enter') integSearchLink('${plat}')" autocomplete="off">
        <button type="button" class="btn btn-primary" onclick="integSearchLink('${plat}')"><i data-lucide="search"></i>Search &amp; Link</button></div>
        <div class="t-caption t-muted">Max 1 Google + 1 Meta account per workspace.</div>
      </div>`;
  } else {
    body = `<div class="integ-ad-link"><div class="integ-managed"><i data-lucide="lock"></i><div class="t-caption t-secondary">Contact your Agency Admin to link a ${esc(PLATFORM_NAME[plat])} account to this workspace.</div></div></div>`;
  }
  return `<div class="card integ-card" data-platform="${plat}">
    <div class="integ-card-head"><span class="integ-plat-logo">${platformLogo(plat)}</span>
      <div class="grow"><div class="h-card">${name}</div><div class="integ-cat">Ad Platform</div>
        <div class="integ-dots">${acc ? integDot('green', 'Synced') : integDot('grey', 'Not connected')}</div></div></div>
    <div class="integ-desc">${plat === 'google' ? 'Campaign, spend and conversion data from Google Ads.' : 'Campaign, spend and conversion data from Meta (Facebook and Instagram) ads.'}</div>
    ${body}
  </div>`;
}

function integSearchLink(plat) {
  const input = document.getElementById(`integ-ad-${plat}`);
  const v = (input?.value || '').trim();
  const label = PLATFORM_NAME[plat];
  if (!v) { showToast(`Enter a ${label} Account ID first`, 'triangle-alert'); input?.focus(); return; }
  if (wsAdAccounts(state.ctx).some(a => a.platform === plat)) { showToast(`This workspace already has a ${label} account. Unlink it first.`, 'triangle-alert'); return; }
  const acc = adAccounts.find(a => a.platform === plat && !a.workspaceId && a.id.toLowerCase() === v.toLowerCase());
  if (!acc) { showToast(`Invalid ID or no matching ${label} account exists`, 'circle-x'); input?.classList.add('invalid'); return; }
  const ws = currentWs();
  openModal({
    title: 'Confirm Account Linking',
    desc: 'We found an ad account matching this ID. Please confirm before linking it to the workspace.',
    body: `<div class="integ-kv">
      <div><span>Platform</span><span>${platformBadge(plat, true)}</span></div>
      <div><span>Account name</span><span class="t-bold">${esc(acc.name)}</span></div>
      <div><span>Account ID</span><code class="mono">${esc(acc.id)}</code></div>
      <div class="integ-kv-sep"><span>Target workspace</span><span class="t-bold t-primary">${esc(ws.name)}</span></div>
    </div>`,
    actions: [{ label: 'Cancel', kind: 'outline' }, { label: 'Link to Workspace', kind: 'primary', onClick: () => { acc.workspaceId = ws.id; rerender(); showToast(`Linked ${label} account ${acc.id} to ${ws.name}`, 'link'); } }]
  });
}

function integUnlinkAd(accId) {
  const acc = adAccounts.find(a => a.id === accId);
  confirmDialog({
    title: 'Unlink Ad Account?',
    text: 'Data is not stored in Galaxis. Once unlinked, all platform conversions and spend data from this account will immediately be removed from the Workspace Analytics view.',
    confirmLabel: 'Yes, Unlink Account',
    danger: true,
    onConfirm: () => { acc.workspaceId = null; rerender(); showToast(`${PLATFORM_NAME[acc.platform]} account ${acc.id} unlinked and returned to the agency queue`, 'unlink'); }
  });
}

// ================= AGENCY ("My Workspace") =================
function integRenderAgency() {
  const expired = Object.entries(masterTokens).filter(([, t]) => t.status === 'expired');
  return `<div class="integ-page">
    ${expired.map(([k, t]) => `<div class="banner banner-error integ-banner"><i data-lucide="circle-alert"></i>
      <div><div class="banner-title">${esc(t.label)} token expired</div><div class="banner-text">Ad data from ${fmtNum(t.discovered)} ${PLATFORM_NAME[k]} accounts has stopped syncing since ${fmtDate(t.expires)}. Re-authenticate to resume.</div></div>
      <button type="button" class="banner-action" onclick="integReauth('${k}')">Re-authenticate</button></div>`).join('')}
    ${agencyCrm.status !== 'connected' ? `<div class="banner banner-error integ-banner"><i data-lucide="circle-alert"></i>
      <div><div class="banner-title">Agency CRM disconnected</div><div class="banner-text">Converted CRM accounts are not creating workspaces, and services and budgets were last synced ${fmtDateTime(agencyCrm.lastSynced)}. Reconnect to resume.</div></div>
      <button type="button" class="banner-action" onclick="integCrmReconnect()">Reconnect</button></div>` : ''}
    <section class="integ-section">
      <h2 class="h-section">Master connections</h2>
      <div class="integ-sub">Agency-level connections Galaxis uses to discover client ad accounts and to set up workspaces from the agency CRM.</div>
      <div class="integ-grid-3">${Object.keys(masterTokens).map(integTokenCard).join('')}${integCrmCard()}</div>
    </section>
    <section class="integ-section card" id="integ-unlinked">${integUnlinkedHTML()}</section>
    <section class="integ-section card" id="integ-queue">${integQueueHTML()}</section>
    <section class="integ-section card">
      <div class="card-header"><div><h2 class="h-section">Linked ad accounts</h2><div class="card-sub">${activeWorkspaces().filter(w => wsPlatforms(w.id).length === 2).length} of ${activeWorkspaces().length} workspaces have both Google and Meta linked.</div></div>
        <div class="search integ-dir-search"><input class="input" placeholder="Search workspace or account" value="${esc(state.ui.integDirSearch)}" oninput="state.ui.integDirSearch = this.value; pager('integ-dir').page = 1; integRenderDir()" aria-label="Search linked accounts"><i data-lucide="search"></i></div></div>
      <div id="integ-dir">${integDirHTML()}</div>
    </section>
    <section class="integ-section card">${integOverviewHTML()}</section>
  </div>`;
}

function integTokenCard(k) {
  const t = masterTokens[k];
  const bad = t.status === 'expired';
  return `<div class="card integ-card ${bad ? 'integ-card-error' : ''}">
    <div class="integ-card-head"><span class="integ-plat-logo">${platformLogo(k)}</span>
      <div class="grow"><div class="h-card">${esc(t.label)}</div><div class="integ-cat">${esc(t.detail)}</div>
        <div class="integ-dots">${bad ? integDot('red', 'Expired') : integDot('green', 'Valid')}</div></div></div>
    <div class="integ-meta">
      <div class="integ-meta-row"><i data-lucide="radar"></i><div><div>Accounts discovered</div><div class="integ-meta-val">${fmtNum(t.discovered)} accounts discovered</div></div></div>
      <div class="integ-meta-row"><i data-lucide="calendar-clock"></i><div><div>${bad ? 'Expired on' : 'Expires on'}</div><div class="integ-meta-val ${bad ? 't-error' : ''}">${fmtDate(t.expires)}</div></div></div>
    </div>
    <div class="integ-card-foot"><button type="button" class="btn ${bad ? 'btn-primary' : 'btn-outline'}" id="integ-reauth-${k}" onclick="integReauth('${k}')"><i data-lucide="refresh-ccw"></i>Re-authenticate</button></div>
  </div>`;
}

// ---- Agency CRM (internal OOm CRM): converted accounts create workspaces automatically (crm.js) ----
function integCrmCard() {
  const on = agencyCrm.status === 'connected';
  return `<div class="card integ-card ${on ? '' : 'integ-card-error'}" id="integ-crm-card">
    <div class="integ-card-head"><span class="integ-plat-logo integ-crm-logo"><i data-lucide="contact-round"></i></span>
      <div class="grow"><div class="h-card">Agency CRM</div><div class="integ-cat">Internal OOm CRM · API connection</div>
        <div class="integ-dots">${on ? integDot('green', 'Connected') : integDot('red', 'Disconnected')}</div></div></div>
    <div class="integ-meta">
      <div class="integ-meta-row"><i data-lucide="refresh-cw"></i><div><div>Accounts synced</div><div class="integ-meta-val">${fmtNum(agencyCrm.accountsSynced)} accounts synced</div></div></div>
      <div class="integ-meta-row"><i data-lucide="calendar-clock"></i><div><div>Last synced</div><div class="integ-meta-val ${on ? '' : 't-error'}">${fmtDateTime(agencyCrm.lastSynced)}</div></div></div>
    </div>
    <div class="integ-card-foot">${on
      ? `<button type="button" class="btn btn-outline" id="integ-crm-sync" onclick="integCrmResync()"><i data-lucide="refresh-cw"></i>Re-sync</button>`
      : `<button type="button" class="btn btn-primary" id="integ-crm-sync" onclick="integCrmReconnect()"><i data-lucide="plug"></i>Reconnect</button>`}</div>
  </div>`;
}
// Simulated sync: refreshes the sync time and the synced account count.
function integCrmResync() {
  const b = document.getElementById('integ-crm-sync');
  if (b) { b.disabled = true; b.textContent = 'Syncing…'; }
  setTimeout(() => {
    agencyCrm.lastSynced = new Date().toISOString();
    agencyCrm.accountsSynced = Object.keys(crmAccounts).length;
    if (state.page === 'integrations' && isAgency()) rerender();
    showToast(`Agency CRM synced. ${fmtNum(agencyCrm.accountsSynced)} accounts up to date.`, 'refresh-cw');
  }, 800);
}
function integCrmReconnect() {
  const b = document.getElementById('integ-crm-sync');
  if (b) { b.disabled = true; b.textContent = 'Connecting…'; }
  setTimeout(() => {
    agencyCrm.status = 'connected';
    agencyCrm.lastSynced = new Date().toISOString();
    state.flags.integCrm = 'connected';
    if (state.page === 'integrations' && isAgency()) rerender();
    showToast('Agency CRM reconnected. New conversions will create workspaces again.', 'plug');
  }, 900);
}
// Simulated OAuth: resets the token to valid with a new expiry (Google 1 year, Meta 60 days).
function integReauth(k) {
  const t = masterTokens[k];
  const b = document.getElementById(`integ-reauth-${k}`);
  if (b) { b.disabled = true; b.textContent = `Connecting to ${PLATFORM_NAME[k]}…`; }
  setTimeout(() => {
    const d = new Date();
    if (k === 'google') d.setFullYear(d.getFullYear() + 1); else d.setDate(d.getDate() + 60);
    t.status = 'valid'; t.expires = toDateInput(d);
    state.flags.integToken = Object.values(masterTokens).some(x => x.status === 'expired') ? 'expired' : 'healthy';
    if (state.page === 'integrations' && isAgency()) rerender();
    showToast(`${t.label} re-authenticated. Valid until ${fmtDate(t.expires)}.`, 'shield-check');
  }, 900);
}

// ---- Workspaces without linked ad accounts (V1 renderUnlinkedWorkspaces, no 5-row cap) ----
function integUnlinkedWs() { return activeWorkspaces().filter(w => !wsAdAccounts(w.id).length); }
function integPickedIds() { return new Set(Object.values(state.ui.integInline).flatMap(o => Object.values(o)).filter(Boolean)); }
function integRenderUnlinked() { renderRegion('integ-unlinked', integUnlinkedHTML()); }

function integUnlinkedHTML() {
  const list = integUnlinkedWs();
  const anyPick = list.some(w => Object.values(state.ui.integInline[w.id] || {}).some(Boolean));
  const rows = paginate(list, 'integ-unl', 10);
  return `<div class="card-header"><div><h2 class="h-section">Client workspaces without linked ad accounts (${list.length})</h2>
      <div class="card-sub">Search for a discovered account and link it straight from the row.</div></div>
      ${list.length ? `<button type="button" class="btn ${anyPick ? 'btn-primary' : 'btn-outline'}" onclick="integSaveAllInline()"><i data-lucide="save"></i>Save all</button>` : ''}</div>
    ${list.length ? `<div class="table-wrap"><table class="table integ-table">
      <thead><tr><th>Workspace</th><th>Google Ads</th><th>Meta Ads</th><th></th></tr></thead>
      <tbody>${rows.map(w => {
        const picks = state.ui.integInline[w.id] || {};
        const has = Object.values(picks).some(Boolean);
        return `<tr><td><button type="button" class="t-link integ-ws-link" onclick="openWorkspace('${w.id}','integrations')">${esc(w.name)}</button><div class="cell-sub">${esc(w.industry)}</div></td>
          <td>${integInlineCell(w.id, 'google')}</td><td>${integInlineCell(w.id, 'meta')}</td>
          <td class="num"><button type="button" class="btn btn-sm ${has ? 'btn-primary' : 'btn-outline'}" onclick="integSaveInline('${w.id}')">Save</button></td></tr>`;
      }).join('')}</tbody></table></div>
      ${list.length > 10 ? paginationBar('integ-unl', list.length, 'integRenderUnlinked') : ''}`
    : `<div class="empty"><i data-lucide="circle-check"></i><div class="empty-title">All client workspaces have at least one linked ad account.</div></div>`}`;
}

function integInlineCell(wsId, plat) {
  const picked = (state.ui.integInline[wsId] || {})[plat];
  if (picked) {
    const a = adAccounts.find(x => x.id === picked);
    return `<span class="integ-acc-chip">${platformLogo(plat)}<span class="integ-acc-text"><span class="t-bold">${esc(a.name)}</span><span class="mono t-muted">${esc(a.id)}</span></span>
      <button type="button" class="chip-remove" onclick="integInlineClear('${wsId}','${plat}')" aria-label="Remove"><i data-lucide="x"></i></button></span>`;
  }
  const taken = integPickedIds();
  const opts = adAccounts.filter(a => a.platform === plat && !a.workspaceId && !taken.has(a.id));
  const dl = `integ-dl-${plat}-${wsId}`;
  return `<input class="input integ-inline-input" list="${dl}" placeholder="${opts.length ? 'Search & select…' : 'No unlinked accounts'}" ${opts.length ? '' : 'disabled'}
      oninput="integInlinePick('${wsId}','${plat}', this.value, false)" onchange="integInlinePick('${wsId}','${plat}', this.value, true)" aria-label="${PLATFORM_NAME[plat]} account for ${esc(wsById(wsId).name)}">
    <datalist id="${dl}">${opts.map(a => `<option value="${esc(a.name)} [${esc(a.id)}]"></option>`).join('')}</datalist>`;
}

function integInlinePick(wsId, plat, val, strict) {
  const m = String(val).trim().match(/\[([^\]]+)\]\s*$/);
  const id = m ? m[1] : String(val).trim();
  const acc = adAccounts.find(a => a.platform === plat && !a.workspaceId && a.id === id);
  if (acc) {
    (state.ui.integInline[wsId] = state.ui.integInline[wsId] || {})[plat] = acc.id;
    integRenderUnlinked();
  } else if (strict && val.trim()) showToast(`Pick a ${PLATFORM_NAME[plat]} account from the list`, 'triangle-alert');
}
function integInlineClear(wsId, plat) { if (state.ui.integInline[wsId]) delete state.ui.integInline[wsId][plat]; integRenderUnlinked(); }

function integApplyInline(wsId) {
  const picks = state.ui.integInline[wsId] || {};
  let n = 0;
  ['google', 'meta'].forEach(plat => {
    const acc = picks[plat] && adAccounts.find(a => a.id === picks[plat] && !a.workspaceId);
    if (acc && !wsAdAccounts(wsId).some(a => a.platform === plat)) { acc.workspaceId = wsId; n++; }
  });
  delete state.ui.integInline[wsId];
  return n;
}
function integSaveInline(wsId) {
  if (!Object.values(state.ui.integInline[wsId] || {}).some(Boolean)) { showToast('Select at least one account to link', 'triangle-alert'); return; }
  const n = integApplyInline(wsId);
  rerender();
  showToast(`Linked ${n} account${n === 1 ? '' : 's'} to ${wsById(wsId).name}`, 'link');
}
function integSaveAllInline() {
  const ids = Object.keys(state.ui.integInline).filter(id => Object.values(state.ui.integInline[id]).some(Boolean));
  if (!ids.length) { showToast('No links to save', 'info'); return; }
  const n = ids.reduce((s, id) => s + integApplyInline(id), 0);
  rerender();
  showToast(`Linked ${n} account${n === 1 ? '' : 's'} across ${ids.length} workspace${ids.length === 1 ? '' : 's'}`, 'link');
}

// ---- Unlinked ad accounts queue ----
function integRenderQueue() { renderRegion('integ-queue', integQueueHTML()); }
function integQueueHTML() {
  const all = adAccounts.filter(a => !a.workspaceId);
  const f = state.ui.integQueuePlat;
  const list = all.filter(a => f === 'all' || a.platform === f);
  const rows = paginate(list, 'integ-q', 10);
  const seg = ['all', 'google', 'meta'].map(p => `<button type="button" class="${f === p ? 'active' : ''}" onclick="state.ui.integQueuePlat='${p}'; pager('integ-q').page = 1; integRenderQueue()">${p === 'all' ? 'All' : PLATFORM_NAME[p]} (${p === 'all' ? all.length : all.filter(a => a.platform === p).length})</button>`).join('');
  return `<div class="card-header"><div><div class="row"><h2 class="h-section">Unlinked ad accounts queue</h2><span class="integ-tag integ-tag-warn">${all.length} pending</span></div>
      <div class="card-sub">Accounts discovered through the master connections that are not linked to any client workspace yet.</div></div>
      <div class="seg">${seg}</div></div>
    <datalist id="integ-ws-dl">${activeWorkspaces().map(w => `<option value="${esc(w.name)}"></option>`).join('')}</datalist>
    ${list.length ? `<div class="table-wrap"><table class="table integ-table">
      <thead><tr><th>Account</th><th>Platform</th><th>Account ID</th><th>Target workspace</th><th></th></tr></thead>
      <tbody>${rows.map(a => `<tr><td class="t-bold">${esc(a.name)}</td><td>${platformBadge(a.platform)}</td><td class="mono">${esc(a.id)}</td>
        <td><input class="input integ-inline-input" list="integ-ws-dl" placeholder="Search workspace…" value="${esc(state.ui.integQueueTarget[a.id] || '')}" oninput="state.ui.integQueueTarget['${q(a.id)}'] = this.value" aria-label="Target workspace for ${esc(a.name)}"></td>
        <td class="num"><button type="button" class="btn btn-primary btn-sm" onclick="integLinkQueued('${q(a.id)}')"><i data-lucide="link"></i>Link account</button></td></tr>`).join('')}</tbody></table></div>
      ${list.length > 10 ? paginationBar('integ-q', list.length, 'integRenderQueue') : ''}`
    : `<div class="empty"><i data-lucide="inbox"></i><div class="empty-title">No unlinked ${f === 'all' ? '' : PLATFORM_NAME[f] + ' '}accounts</div><div class="t-caption">Every discovered account is linked to a workspace.</div></div>`}`;
}

function integLinkQueued(accId) {
  const acc = adAccounts.find(a => a.id === accId);
  const typed = (state.ui.integQueueTarget[accId] || '').trim().toLowerCase();
  const ws = activeWorkspaces().find(w => w.name.toLowerCase() === typed);
  if (!typed) { showToast('Choose a target client workspace first', 'triangle-alert'); return; }
  if (!ws) { showToast('No client workspace matches that name. Pick one from the list.', 'triangle-alert'); return; }
  const existing = wsAdAccounts(ws.id).find(a => a.platform === acc.platform);
  const go = () => {
    if (existing) existing.workspaceId = null;
    acc.workspaceId = ws.id;
    delete state.ui.integQueueTarget[accId];
    rerender();
    showToast(`Linked ${acc.id} to ${ws.name}${existing ? `. ${existing.id} returned to the queue.` : ''}`, 'link');
  };
  // V1 bug fix: never overwrite an existing link silently.
  if (existing) confirmDialog({
    title: `Replace existing ${PLATFORM_NAME[acc.platform]} account?`,
    text: `${ws.name} is already linked to ${existing.name} (${existing.id}). Linking ${acc.name} will unlink it and return it to the queue. Data from the old account will no longer appear in this workspace.`,
    confirmLabel: 'Replace account', onConfirm: go
  });
  else go();
}

// ---- Linked directory ----
function integDirCell(wsId, plat) {
  const a = wsAdAccounts(wsId).find(x => x.platform === plat);
  return a ? `<div class="integ-dir-cell">${platformLogo(plat)}<div><div class="t-bold">${esc(a.name)}</div><div class="mono t-muted">${esc(a.id)}</div></div></div>`
    : '<span class="integ-pill-warn"><i data-lucide="triangle-alert"></i>Not linked</span>';
}
function integRenderDir() { renderRegion('integ-dir', integDirHTML()); }
function integDirHTML() {
  const t = state.ui.integDirSearch.trim().toLowerCase();
  const acc = (w, p) => wsAdAccounts(w.id).find(a => a.platform === p);
  let list = activeWorkspaces().filter(w => !t || [w.name, ...wsAdAccounts(w.id).flatMap(a => [a.name, a.id])].join(' ').toLowerCase().includes(t));
  list = applySort(list, 'integ-dir', { ws: w => w.name, google: w => acc(w, 'google')?.name || '~', meta: w => acc(w, 'meta')?.name || '~', count: w => wsAdAccounts(w.id).length }, { col: 'ws', dir: 'asc' });
  const rows = paginate(list, 'integ-dir', 10);
  return `<div class="table-wrap"><table class="table integ-table">
    <thead><tr><th>${sortHeader('integ-dir', 'ws', 'Workspace', 'integRenderDir')}</th><th>${sortHeader('integ-dir', 'google', 'Google Ads', 'integRenderDir')}</th><th>${sortHeader('integ-dir', 'meta', 'Meta Ads', 'integRenderDir')}</th><th></th></tr></thead>
    <tbody>${rows.length ? rows.map(w => `<tr>
      <td><button type="button" class="t-link integ-ws-link" onclick="openWorkspace('${w.id}','integrations')">${esc(w.name)}</button><div class="cell-sub">${esc(w.industry)}</div></td>
      <td>${integDirCell(w.id, 'google')}</td><td>${integDirCell(w.id, 'meta')}</td>
      <td class="num">${rowMenu(`integ-dir-m-${w.id}`, [{ label: 'Manage', icon: 'settings-2', onClick: `openWorkspace('${w.id}','integrations')` }, { label: 'Go to dashboard', icon: 'layout-dashboard', onClick: `openWorkspace('${w.id}','dashboard')` }])}</td></tr>`).join('')
      : `<tr><td colspan="4" class="table-empty">No workspace or account matches “${esc(state.ui.integDirSearch)}”.</td></tr>`}</tbody></table></div>
    ${paginationBar('integ-dir', list.length, 'integRenderDir')}`;
}

// ---- Products across clients (agency-wide integration health; the V2 gap) ----
function integOverviewHTML() {
  const wss = activeWorkspaces();
  const stat = (pid, test) => wss.filter(w => { const e = wsProducts(w.id)[pid]; return e && test(e); });
  const cell = (pid, kind, list, cls) => list.length ? `<button type="button" class="integ-count ${cls}" onclick="integDrill('${pid}','${kind}')">${list.length}</button>` : '<span class="t-muted">0</span>';
  const rows = products.map(p => {
    const conn = stat(p.id, e => e.status === 'connected');
    const act = stat(p.id, e => e.status === 'connected' && e.active);
    const err = stat(p.id, e => e.status === 'error' || e.status === 'pending');
    return `<tr><td><div class="integ-dir-cell">${productLogo(p.id, 24)}<div><div class="t-bold">${esc(p.name)}</div><div class="cell-sub">${esc(p.category)} · ${integIsOom(p) ? 'OOm' : 'Third-party'}</div></div></div></td>
      <td class="num">${cell(p.id, 'connected', conn, '')}</td><td class="num">${cell(p.id, 'active', act, '')}</td><td class="num">${cell(p.id, 'error', err, 'integ-count-err')}</td></tr>`;
  }).join('');
  return `<div class="card-header"><div><h2 class="h-section">Products across clients</h2><div class="card-sub">How many client workspaces have each product connected, active or needing attention. Select a count to see the workspaces.</div></div></div>
    <div class="table-wrap"><table class="table integ-table">
      <thead><tr><th>Product</th><th class="num">Connected</th><th class="num">Active</th><th class="num">Error / pending</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function integDrill(pid, kind) {
  const p = productById(pid);
  const test = { connected: e => e.status === 'connected', active: e => e.status === 'connected' && e.active, error: e => e.status === 'error' || e.status === 'pending' }[kind];
  const list = activeWorkspaces().filter(w => { const e = wsProducts(w.id)[pid]; return e && test(e); });
  const label = { connected: 'connected', active: 'active', error: 'with errors or pending set-up' }[kind];
  openModal({
    title: `${p.name} — workspaces ${label}`,
    desc: `${list.length} client workspace${list.length === 1 ? '' : 's'}`,
    size: 'lg',
    body: `<div class="integ-drill">${list.map(w => {
      const e = wsProducts(w.id)[pid];
      return `<div class="integ-drill-row"><div class="grow"><div class="t-bold">${esc(w.name)}</div>
        <div class="integ-dots">${integStatusDots(pid, w.id)}</div>${e.error ? `<div class="t-caption t-secondary">${esc(e.error)}</div>` : ''}</div>
        <button type="button" class="btn btn-outline btn-sm" onclick="closeModal(); openWorkspace('${w.id}','integrations')">Open workspace</button></div>`;
    }).join('')}</div>`,
    actions: [{ label: 'Close', kind: 'outline' }]
  });
}

// ---------- Dev toggles ----------
const INTEG_SYNC = '2026-10-21T11:32:00';
const INTEG_SCENARIOS = {
  'All Disconnected': () => ({}),
  'All Connected': () => ({
    'crm-lite': { status: 'connected', active: true, lastSynced: INTEG_SYNC },
    aurix: { status: 'connected', active: true, lastSynced: INTEG_SYNC },
    cdp: { status: 'connected', active: true, lastSynced: INTEG_SYNC },
    delacon: { status: 'connected', active: true, lastSynced: INTEG_SYNC }
  }),
  'Pending Setup + Error': () => ({
    salesforce: { status: 'pending', active: false, lastSynced: null, error: 'OAuth authorisation incomplete.' },
    sleekflow: { status: 'error', active: true, lastSynced: '2026-10-19T08:41:00', error: 'Webhook verification failed. New messaging events are queued until the connection is fixed.' },
    delacon: { status: 'error', active: true, lastSynced: '2026-10-17T16:20:00', error: 'Webhook access token expired. Real-time call logs are queued pending token renewal.' }
  }),
  'Routing Choice': () => ({ hubspot: { status: 'connected', active: true, lastSynced: INTEG_SYNC } })
};
function integApplyScenario(name) {
  workspaceProducts[state.ctx] = INTEG_SCENARIOS[name]();
  state.flags.integScenario = { name, ws: state.ctx };
  closeDrawer(); closeModal();
  render();
  if (name === 'Routing Choice') integConnect('sleekflow');
}
registerDevToggles('client-integrations', () => Object.keys(INTEG_SCENARIOS).map(name => ({
  label: name,
  active: state.flags.integScenario?.name === name && state.flags.integScenario?.ws === state.ctx,
  run: () => integApplyScenario(name)
})));
registerDevToggles('agency-integrations', () => [
  { label: 'Healthy tokens', active: state.flags.integToken === 'healthy', run: () => { masterTokens.google.status = 'valid'; masterTokens.meta.status = 'valid'; if (masterTokens.meta.expires < '2026-10-21') masterTokens.meta.expires = '2026-12-01'; state.flags.integToken = 'healthy'; render(); } },
  { label: 'Meta token expired', active: state.flags.integToken === 'expired', run: () => { masterTokens.meta.status = 'expired'; masterTokens.meta.expires = '2026-10-14'; state.flags.integToken = 'expired'; render(); } },
  'sep',
  { label: 'Agency CRM connected', active: agencyCrm.status === 'connected', run: () => { agencyCrm.status = 'connected'; state.flags.integCrm = 'connected'; render(); } },
  { label: 'Agency CRM disconnected', active: agencyCrm.status !== 'connected', run: () => { agencyCrm.status = 'disconnected'; state.flags.integCrm = 'disconnected'; render(); } }
]);

// ---------- Specs ----------
Object.assign(screenSpecs, {
  'agency-integrations': {
    title: 'Integrations — Ad Account Discovery, Workspace Linking & Agency CRM (Agency)',
    status: 'In Review',
    author: 'Hannah',
    updatedAt: '22/10/2026',
    notes: `
### Screen purpose and objectives
Agency-level integrations page ("My Workspace"). Bridges the external ad platforms with client workspaces: agency admins triage unlinked accounts and workspaces, keep the master connections healthy, and see integration health across every client. Ported from V1 \`agency-adaccounts\`; Figma has no frame for this context, so it reuses the Figma card, table and modal patterns.

### Ad Platforms — master connections (from V2, Draft)
- One card each for the **Google Ads Manager Account (MCC)** and **Meta Business Manager**: status (Valid / Expired), token type, accounts discovered, expiry date.
- **Re-authenticate** runs the OAuth flow and resets the token to Valid with a new expiry date.
- An expired token shows a red banner at the top of the page and is also raised in the dashboard Attention list.

### Agency CRM (new, Draft, 22/10/2026)
- A third master-connection card, **Agency CRM** (OOm's internal CRM), next to Google MCC and Meta BM, using the same card pattern.
  - Shows status (Connected / Disconnected), "{N} accounts synced" and the last sync time.
  - **Re-sync** runs a sync (simulated) and refreshes the count and time. When disconnected the button becomes **Reconnect**.
  - Disconnected shows a red banner at the top of the page ("Agency CRM disconnected") with Reconnect. While disconnected, converted CRM accounts don't create workspaces.
- **Role mapping**: the CRM role → Galaxis role/team mapping card was removed from this page on 22/10/2026. Auto set-up uses the default mapping (Account Manager → Account Manager; SEO Specialist → SEO Lead, SEO Research team; Project Lead → Project Lead; Ads Specialist → Account Manager, Marketing team), and client invites always wait for account-manager approval. Where the mapping is managed (here, Team & Access, or the CRM) is an open question.
- What auto set-up does is specified on Team & Access › Client Organisation.

### Client workspaces without linked ad accounts (V1, In Review)
- Lists every active client workspace with **zero** linked ad accounts. V1's cap of five rows is removed; the list paginates.
- Each row has a Google and a Meta cell with a searchable picker of **unlinked** accounts for that platform. A picked account becomes a chip with ✕, and cannot be picked in another row.
- Per-row **Save**, plus a header **Save all**.
- Empty state: "All client workspaces have at least one linked ad account."

### Unlinked ad accounts queue (V1, In Review)
- Accounts discovered through the master connections that are not linked to any workspace. The "N pending" count is live (V1 hard-coded it).
- Platform filter: All / Google / Meta.
- Each row: account name, platform, ID, a searchable target-workspace input and **Link account**.
- **V1 bug fix:** if the target workspace already has an account for that platform, a "Replace existing {platform} account?" confirmation appears. On confirm, the old account returns to the queue.
- Rule: max 1 Google + 1 Meta account per workspace.

### Linked ad accounts directory (V1, In Review)
- One row per active workspace, with Google and Meta cells (account name and ID, or a "Not linked" warning).
- Search, sort and pagination. "Manage" opens that workspace's Integrations page.

### Products across clients (new, Draft)
- One row per product: how many workspaces have it connected, active, or in error / pending set-up.
- Selecting a count lists the affected workspaces, each with "Open workspace". This fills V2's gap of having no agency-wide integration health view.

### Open questions
- Should re-authenticating a master token need a specific permission (e.g. Agency Admin only)?
- Should an expired token also email the agency admins, and how far ahead of expiry?
- Can an agency link an account that is already linked to an archived workspace?
- Agency CRM: what happens on churn or when a service ends (archive, pause, or just update budgets)?
- Agency CRM: can an agency make client invites fully automatic, and should that be a per-agency setting only Agency Admins can change?
- Agency CRM: how do we map an account manager who isn't a Galaxis user yet?
- Agency CRM: is the workspace ad budget taken from CRM services (SEM + Google Ads + Facebook Ads) or set per workspace?
- Agency CRM: duplicate detection when a converted CRM account matches an existing workspace (name, domain, UEN)?
`
  },
  'client-integrations': {
    title: 'Integrations — Product Integrations Hub & Ad Platform Linking (Client workspace)',
    status: 'Draft',
    author: 'Hannah',
    updatedAt: '21/10/2026',
    notes: `
### Screen purpose and objectives
The workspace's integrations hub, built from the Figma "Integrations" frames with V2's configuration depth and V1's ad-account linking. The product hub is **Draft**; the Ad Platforms section is ported from V1 \`client-profile\` and is **In Review**.

### Product hub (V2 + Figma, Draft)
- **Search** filters both grids. A **pipeline readiness** strip (Ads, CRM, Messaging, Calls) shows active / needs attention / not connected, computed from the data.
- **Active Products** ("N Active"): logo, name, category, status (Connected · Active, Pending Setup, Error, Disabled), description, Data shared, Last synced and **Open**.
  - Open launches OOm products and shows the details slide-over for third-party products.
  - ⋮ menu: View details, Configure, Disable (or Enable), Disconnect.
  - Error and pending cards show an inline box with the reason and **Fix Now** / **Resume Setup**, which open the configuration view.
  - Products routed through a CRM show "Routed via {CRM}".
- **Available Products**: category tabs with counts (All / CRM / CCM / CDP / Marketing). Each card has Learn More and **Connect**. The list ends with a Coming Soon card.
- **Details slide-over** (View details / Learn More): About this integration, What can be synced?, Requirements, Before you connect; footer **Connect** (or **Configure** when connected).
- **Connection set-up screen (23/10/2026; replaces the config slide-over)**: Connect, Configure, Fix Now and Resume Setup open a dedicated page (\`client-integration-setup\`).
  - Breadcrumb **Integrations › {Product} › Connect / Configure**; product header (logo, category, status, connection type).
  - **Breadcrumbed steps**: Connect account › Webhook (API products only) › Field mapping › Review & sync. Done steps show a tick and can be reopened; the current step is highlighted; later steps unlock in order. When editing a working connection every step can be opened directly.
    - **Connect account**: OAuth, or API key with the vendor's steps and **Verify connection** (required to continue). OOm products need no credentials ("Managed by OOm").
    - **Webhook** (optional): steps, URL with Copy, and Test webhook signal.
    - **Field mapping**: auto-mapped, editable (Slack: notification routing; SEO Cloud: nothing to map).
    - **Review & sync**: summary of the steps, Historical backfill (Lifetime up to 2,000 records, 1 year, 90 days, 30 days), and the one-per-lane replacement warning when another product will be disconnected.
  - Footer: Disconnect (existing connections), Cancel, Back, **Next** / **Connect and start sync** (or Save Configuration). Nothing is saved until the last step; Cancel or leaving the page changes nothing.
- **Rules**
  - **One per lane.** A workspace can connect only one CRM, one chat platform (Aurix, SleekFlow, Wati) and one call tracker (Delacon). Connecting a second one asks "Replace {current}?"; on confirm and save, the new product is connected and the current one is disconnected (its synced data is kept). There is no connected-but-inactive state. This replaces the Figma "Connect This Product?" copy, which allowed several connected products with one active.
  - **Disable** pauses sync (status Disabled, inactive). **Disconnect** removes only that product (fixes V2's reset-everything bug). Neither deletes data that has already synced.
  - **Routing choice (V2).** Connecting SleekFlow, Wati or Delacon while a third-party CRM is active asks whether the CRM already captures that activity.
    - Yes: route via the CRM.
    - No: configure a direct connection.
  - If a CRM that other products route through is disabled, disconnected or replaced, those products move to Pending Setup and ask for a direct connection.
- The active CRM drives the Leads nav item and the dashboard's CRM mode.

### Ad Platforms (V1 client-profile ad linking, In Review)
- One Google Ads and one Meta Ads card, each showing the linked account name and ID with "Synced", or "Not connected".
- **Agency persona**
  - Unlink shows V1's warning: data is not stored in Galaxis and disappears from Workspace Analytics immediately.
  - When not linked, the agency enters an exact Account ID (the field starts empty) and selects Search & Link.
    - An exact match with an unlinked account shows a confirmation with platform, name, ID and target workspace.
    - Otherwise: "Invalid ID or no matching {platform} account exists".
  - Max 1 Google + 1 Meta per workspace.
- **Client persona:** view only — "Contact your Agency Admin to link a {platform} account to this workspace."

### Open questions
- **Disable vs Disconnect retention:** Disable keeps credentials and mappings and pauses sync. Disconnect drops credentials. Do we keep synced leads after Disconnect, for how long, and does it differ by product?
- Does the one-CRM rule apply across OOm CRMs (Galaxis CRM, Institute CRM) and third-party CRMs alike, or can an OOm CRM run alongside a third-party one?
- Should client users be able to connect or disconnect products, or only Agency Admins / client Super Admins?
- Routing choice: should Galaxis detect existing CRM ↔ messaging links automatically instead of asking?
- Backfill limit of 2,000 records for Lifetime: confirm with engineering, and whether it differs by plan.
- Where do OOm products open (new tab, SSO hand-off)?
`
  }
});
