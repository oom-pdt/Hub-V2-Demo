// Galaxis Hub demo — Dashboard module: agency "My Workspace" dashboard and client workspace dashboard.
// Owns src/dashboard.js + src/dashboard.css. Every global here is prefixed `dash`, except
// workspaceCampaignCount(), which shell.js calls for the workspace switcher.

// =====================================================================
// Mock performance data — generated per workspace, deterministic from ws.seed
// =====================================================================
const DASH_CAMPAIGNS = {
  google: ['Search Campaign', 'Display Remarketing', 'Performance Max', 'Brand Search', 'YouTube Awareness'],
  meta: ['Paid Social Campaign', 'Lead Gen - Instant Forms', 'Retargeting - Site Visitors', 'Awareness Reach', 'Advantage+ Catalogue']
};
const DASH_ADGROUPS = {
  google: ['Search - Brand Exact', 'Search - Non Brand Broad', 'Display - Cart Abandoners', 'Retargeting - 30D Visitors', 'In-Market Audiences', 'Competitor Terms'],
  meta: ['Lookalike 1%', 'Interest - Decision Makers', 'Retargeting - 30D Engagers', 'Broad - Advantage+', 'Custom Audience - CRM List', 'Video Viewers 50%']
};
const DASH_FORMATS = { google: ['Text/Search', 'Image', 'Video'], meta: ['Image', 'Video', 'Carousel'] };
const DASH_ALL_FORMATS = ['Image', 'Video', 'Carousel', 'Text/Search'];
const DASH_STATUSES = ['Active', 'Paused', 'Attention Required'];
const DASH_STATUS_RANK = { 'Active': 0, 'Attention Required': 1, 'Paused': 2 };
const DASH_STATUS_KEY = { 'Active': 'active', 'Paused': 'paused', 'Attention Required': 'attention' };
const DASH_LEVELS = ['platform', 'campaign', 'adgroup', 'ad'];
const DASH_LEVEL_LABEL = { platform: 'Platform', campaign: 'Campaign', adgroup: 'Ad Group', ad: 'Ad' };
const DASH_LEVEL_TAB = { platform: 'Platform', campaign: 'Campaigns', adgroup: 'Ad Groups', ad: 'Ads' };
const DASH_NAME_COL = { platform: 'Platform Name', campaign: 'Campaign Name', adgroup: 'Campaign & Ad Group', ad: 'Campaign & Ads Name' };
const DASH_MODELS = [['mta', 'Multi-Touch (40/20/40)'], ['first', 'First-Touch'], ['last', 'Last-Touch']];
// Share of platform conversions that the CRM attributes to each platform, per attribution model (mock).
const DASH_MODEL_FACTOR = { google: { mta: 0.8, first: 0.6, last: 1 }, meta: { mta: 0.74, first: 0.66, last: 0.9 } };
// Lead-to-customer rate also shifts by model (first-touch credits more early, colder leads).
const DASH_MODEL_CLOSE = { mta: 1, first: 0.82, last: 1.12 };
const DASH_SUM_KEYS = ['spend', 'impressions', 'clicks', 'conversions', 'leads', 'converted', 'revenue'];
const DASH_QUALITY_LABEL = { good: 'Excellent', mid: 'Average', bad: 'Bad' };
const DASH_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dashCache = { tree: {}, metrics: {} };

function dashHash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function dashRng(key) { return seededRandom(dashHash(key) % 100000 + 1); }
function dashShuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function dashPickStatus(rnd, attentionBias) {
  const r = rnd();
  if (r < 0.12) return 'Paused';
  if (r < 0.12 + (attentionBias ? 0.2 : 0.07)) return 'Attention Required';
  return 'Active';
}
// Linked platforms as the dashboard sees them (the dev toggle can simulate "no ad accounts linked").
function dashPlatforms(wsId) { return state.flags.dashNoAccounts && !isAgency() ? [] : wsPlatforms(wsId); }

// Platform → campaign → ad group → ad hierarchy for one workspace, only for its linked platforms.
// `base` holds 30-day metrics; dashMetrics() scales them to the selected date range.
function dashTree(wsId) {
  const ws = wsById(wsId);
  const plats = wsPlatforms(wsId);
  const key = `${wsId}|${plats.join(',')}`;
  if (dashCache.tree[key]) return dashCache.tree[key];
  const t = { platforms: [], campaigns: [], adGroups: [], ads: [] };
  const bias = ws.status === 'attention';
  let adNo = 0;
  plats.forEach(p => {
    const rnd = dashRng(`${wsId}:${p}`);
    const pid = `${wsId}~${p}`;
    t.platforms.push({ id: pid, level: 'platform', platform: p, name: PLATFORM_NAME[p], status: 'Active', parents: [], path: { platform: pid } });
    dashShuffle(DASH_CAMPAIGNS[p], rnd).slice(0, 2 + Math.floor(rnd() * 2)).forEach((cName, ci) => {
      const cid = `${pid}~c${ci + 1}`;
      const cStatus = ci === 0 ? (bias ? 'Attention Required' : 'Active') : dashPickStatus(rnd, bias);
      t.campaigns.push({ id: cid, level: 'campaign', platform: p, name: cName, status: cStatus, parents: [PLATFORM_NAME[p]], path: { platform: pid, campaign: cid } });
      dashShuffle(DASH_ADGROUPS[p], rnd).slice(0, 1 + Math.floor(rnd() * 3)).forEach((gName, gi) => {
        const gid = `${cid}~g${gi + 1}`;
        const gStatus = cStatus === 'Paused' ? 'Paused' : (gi === 0 ? 'Active' : dashPickStatus(rnd, bias));
        t.adGroups.push({ id: gid, level: 'adgroup', platform: p, name: gName, status: gStatus, parents: [cName], campaignName: cName, path: { platform: pid, campaign: cid, adgroup: gid } });
        const n = 2 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
          adNo++;
          const id = `${gid}~a${k + 1}`;
          const fmt = DASH_FORMATS[p][Math.floor(rnd() * DASH_FORMATS[p].length)];
          const status = gStatus === 'Paused' ? 'Paused' : dashPickStatus(rnd, bias);
          const cpm = p === 'google' ? 30 + rnd() * 60 : 12 + rnd() * 18;
          const ctr = (p === 'google' ? 3 + rnd() * 3.5 : 1 + rnd() * 1.6) / 100;
          const cvr = (1 + rnd() * 3) / 100;
          const spend = (400 + rnd() * 2600) * (status === 'Paused' ? 0.3 : 1);
          const impressions = spend / cpm * 1000;
          const clicks = impressions * ctr;
          t.ads.push({
            id, level: 'ad', platform: p, name: `Ad Creative Q${Math.ceil(adNo / 2)} - Variant ${adNo}`, format: fmt, status,
            parents: [cName, gName], campaignName: cName, adGroupName: gName,
            path: { platform: pid, campaign: cid, adgroup: gid, ad: id },
            base: { spend, impressions, clicks, conversions: clicks * cvr }
          });
        }
      });
    });
  });
  // Fit 30-day spend to 72–94% of the monthly budget so budget pacing looks plausible.
  const total = t.ads.reduce((s, a) => s + a.base.spend, 0);
  if (total) {
    const f = ws.budget * (0.72 + dashRng(`${wsId}:budget`)() * 0.22) / total;
    t.ads.forEach(a => Object.keys(a.base).forEach(k => { a.base[k] *= f; }));
  }
  dashCache.tree[key] = t;
  return t;
}

// Date-range scaling. Not purely linear, so ratios (CPM, CTR, CPC) also move a little with the range.
function dashFactors(days) {
  const f = days / 30;
  return { spend: f, impressions: f * (1 + 0.03 * Math.sin(days)), clicks: f * (1 + 0.05 * Math.cos(days * 1.3)), conversions: f * (1 - 0.06 * Math.sin(days * 0.7)) };
}
function dashDerive(o) {
  o.cpm = o.impressions ? o.spend / o.impressions * 1000 : 0;
  o.ctr = o.impressions ? o.clicks / o.impressions * 100 : 0;
  o.cpc = o.clicks ? o.spend / o.clicks : 0;
  o.cpa = o.conversions ? o.spend / o.conversions : 0;
  o.cpl = o.leads ? o.spend / o.leads : 0;
  o.roas = o.spend ? o.revenue / o.spend : 0;
  o.convRate = o.leads ? o.converted / o.leads * 100 : 0;
  return o;
}
function dashSum(items) {
  const o = {};
  DASH_SUM_KEYS.forEach(k => { o[k] = items.reduce((s, c) => s + (c[k] || 0), 0); });
  return dashDerive(o);
}

// All four levels with metrics for the date filter of `scope` ('agency' | 'client') and the current attribution model.
function dashMetrics(wsId, scope) {
  const days = dateRangeDays(scope);
  const model = state.ui.dashModel || 'mta';
  const plats = wsPlatforms(wsId);
  const key = `${wsId}|${days}|${model}|${plats.join(',')}`;
  if (dashCache.metrics[key]) return dashCache.metrics[key];
  const t = dashTree(wsId);
  const f = dashFactors(days);
  const ws = wsById(wsId);
  const deal = 300 + (ws.seed * 67) % 700;
  const ads = t.ads.map(a => {
    const r = dashRng(`${a.id}:${model}`);
    const conversions = Math.round(a.base.conversions * f.conversions);
    const leads = Math.round(conversions * DASH_MODEL_FACTOR[a.platform][model] * (0.8 + r() * 0.4));
    const converted = Math.round(leads * (0.16 + r() * 0.16) * DASH_MODEL_CLOSE[model]);
    return dashDerive({
      ...a, formats: [a.format], childCount: 0,
      spend: a.base.spend * f.spend,
      impressions: Math.round(a.base.impressions * f.impressions),
      clicks: Math.round(a.base.clicks * f.clicks),
      conversions, leads, converted, revenue: converted * deal * (0.85 + r() * 0.3)
    });
  });
  const roll = (parents, children, levelKey) => parents.map(p => {
    const kids = children.filter(c => c.path[levelKey] === p.id);
    const o = { ...p, ...dashSum(kids), childCount: kids.length };
    o.formats = [...new Set(kids.flatMap(c => c.formats))].sort();
    return o;
  });
  const adgroup = roll(t.adGroups, ads, 'adgroup');
  const campaign = roll(t.campaigns, adgroup, 'campaign');
  const platform = roll(t.platforms, campaign, 'platform');
  const res = {
    platform, campaign, adgroup, ad: ads, days,
    total: dashSum(platform),
    byPlatform: { google: platform.find(p => p.platform === 'google') || null, meta: platform.find(p => p.platform === 'meta') || null }
  };
  dashCache.metrics[key] = res;
  return res;
}

// ---------- Public helpers other modules may call ----------
// Active campaigns in a workspace (used by the workspace switcher: "N Active Campaigns").
function workspaceCampaignCount(wsId) { return dashTree(wsId).campaigns.filter(c => c.status === 'Active').length; }
// Totals for a workspace under the agency (default) or client date filter: { spend, impressions, clicks, conversions, cpm, cpc, cpa, … }.
function dashWsTotals(wsId, scope = 'agency') { return dashMetrics(wsId, scope).total; }

// ---------- Small render helpers ----------
function dashRerender() { rerender(); }
function dashQuality(v, ref, higherBetter) {
  if (!v || !ref) return '';
  const r = v / ref;
  if (higherBetter) return r >= 1.1 ? 'good' : r >= 0.85 ? 'mid' : 'bad';
  return r <= 0.9 ? 'good' : r <= 1.15 ? 'mid' : 'bad';
}
function dashDot(text, quality) {
  return quality ? `<span class="metric-dot ${quality}" title="${DASH_QUALITY_LABEL[quality]}">${text}</span>` : text;
}
function dashFirstName() { const u = memberById(CURRENT_USER_ID); return u ? u.name.split(/\s+/)[0] : 'there'; }
function dashAgencyWorkspaces() { return typeof visibleWorkspaces === 'function' ? visibleWorkspaces() : activeWorkspaces(); }

// =====================================================================
// Shared Figma filter dropdown (Managed Account / Attention Account / Campaign filters)
// Changes apply live; "Revert To Original" restores the selection from when the panel was opened.
// =====================================================================
const DASH_FILTERS = {
  managed: {
    store: () => state.ui.dashMgrFilter,
    groups: () => [
      { key: 'platform', title: 'Ad Platforms', options: [['google', 'Google'], ['meta', 'Meta'], ['none', 'No platform linked']] },
      { key: 'status', title: 'Status', options: [['new', 'New'], ['active', 'Active'], ['inactive', 'Inactive'], ['attention', 'Attention Required']] },
      { key: 'perf', title: 'Performance (Cost per Conversion)', options: [['good', 'Excellent'], ['mid', 'Average'], ['bad', 'Bad']] }
    ],
    refresh: () => { pager('dash-managed').page = 1; dashRefreshManaged(); }
  },
  attention: {
    store: () => state.ui.dashAttFilter,
    groups: () => [
      { key: 'type', title: 'Issue Status', options: ['Performance Review', 'No Account Linked', 'Integration Error', 'Token Expired', 'Unlinked Ad Accounts'].map(t => [t, t]) },
      { key: 'priority', title: 'Priority Status', options: [['High', 'High'], ['Medium', 'Medium'], ['Low', 'Low']] }
    ],
    refresh: () => renderRegion('dash-att-list', dashAttentionList())
  },
  campaigns: {
    store: () => state.ui.dashCtFilter,
    groups: () => [
      { key: 'platform', title: 'Platform', options: dashPlatforms(state.ctx).map(p => [p, PLATFORM_NAME[p]]) },
      { key: 'format', title: 'Ad Format', options: DASH_ALL_FORMATS.map(f => [f, f]) },
      { key: 'status', title: 'Status', options: DASH_STATUSES.map(s => [s, s]) }
    ],
    refresh: () => { pager('dash-ct').page = 1; dashRefreshCampaignTable(); }
  }
};
function dashFilterCount(fid) { return Object.values(DASH_FILTERS[fid].store()).reduce((n, a) => n + a.length, 0); }
function dashFilterButton(fid) {
  const n = dashFilterCount(fid);
  return `<div class="menu-anchor">
    <button type="button" class="icon-btn" aria-label="Filter" onclick="dashFilterOpen('${fid}', event)"><i data-lucide="list-filter"></i><span class="count" id="dash-fc-${fid}" ${n ? '' : 'hidden'}>${n}</span></button>
    <div class="filter-panel dash-fp" id="dash-fp-${fid}" onclick="event.stopPropagation()">${dashFilterInner(fid)}</div>
  </div>`;
}
function dashFilterInner(fid) {
  const cfg = DASH_FILTERS[fid];
  const sel = cfg.store();
  const groups = cfg.groups().map(g => {
    const collapsed = state.ui.dashFpCollapsed[`${fid}.${g.key}`];
    const picked = sel[g.key];
    return `<div class="dash-fp-group">
      <div class="dash-fp-ghead">
        <button type="button" class="dash-fp-toggle" onclick="dashFilterCollapse('${fid}','${g.key}')"><i data-lucide="${collapsed ? 'chevron-down' : 'chevron-up'}"></i>${esc(g.title)}</button>
        <label class="check"><input type="checkbox" ${picked.length ? '' : 'checked'} onchange="dashFilterAll('${fid}','${g.key}')">All</label>
      </div>
      <div class="dash-fp-opts" ${collapsed ? 'hidden' : ''}>${g.options.map(([v, l]) =>
        `<label class="check"><input type="checkbox" ${picked.includes(v) ? 'checked' : ''} onchange="dashFilterToggle('${fid}','${g.key}','${q(v)}')">${esc(l)}</label>`).join('') || '<span class="t-muted t-caption">No options</span>'}</div>
    </div>`;
  }).join('');
  return `<div class="dash-fp-head"><span class="h-card">Filter</span><button type="button" class="t-link" onclick="dashFilterClear('${fid}')">Clear Filter</button></div>
    <div class="dash-fp-body">${groups}</div>
    <div class="dash-fp-foot"><button type="button" class="btn btn-outline btn-sm" onclick="dashFilterRevert('${fid}')">Revert To Original</button><button type="button" class="btn btn-primary btn-sm" onclick="closeAllPopovers()">Apply</button></div>`;
}
function dashFilterOpen(fid, ev) {
  const panel = document.getElementById(`dash-fp-${fid}`);
  if (panel && !panel.classList.contains('open')) state.ui.dashFpSnap[fid] = JSON.parse(JSON.stringify(DASH_FILTERS[fid].store()));
  toggleMenu(`dash-fp-${fid}`, ev);
}
function dashFilterChanged(fid) {
  renderRegion(`dash-fp-${fid}`, dashFilterInner(fid));
  const badge = document.getElementById(`dash-fc-${fid}`);
  const n = dashFilterCount(fid);
  if (badge) { badge.textContent = n; badge.hidden = !n; }
  DASH_FILTERS[fid].refresh();
}
function dashFilterToggle(fid, key, value) {
  const cfg = DASH_FILTERS[fid];
  const s = cfg.store();
  s[key] = s[key].includes(value) ? s[key].filter(v => v !== value) : [...s[key], value];
  const all = cfg.groups().find(g => g.key === key).options.length;
  if (s[key].length >= all) s[key] = []; // every option ticked = no filter ("All")
  dashFilterChanged(fid);
}
function dashFilterAll(fid, key) { DASH_FILTERS[fid].store()[key] = []; dashFilterChanged(fid); }
function dashFilterClear(fid) { const s = DASH_FILTERS[fid].store(); Object.keys(s).forEach(k => { s[k] = []; }); dashFilterChanged(fid); }
function dashFilterRevert(fid) {
  const snap = state.ui.dashFpSnap[fid];
  if (snap) Object.assign(DASH_FILTERS[fid].store(), JSON.parse(JSON.stringify(snap)));
  dashFilterChanged(fid);
}
function dashFilterCollapse(fid, key) {
  const k = `${fid}.${key}`;
  state.ui.dashFpCollapsed[k] = !state.ui.dashFpCollapsed[k];
  renderRegion(`dash-fp-${fid}`, dashFilterInner(fid));
}

// =====================================================================
// AGENCY DASHBOARD
// =====================================================================
function dashPortfolio() {
  const list = dashAgencyWorkspaces().map(w => dashMetrics(w.id, 'agency'));
  const plat = p => dashSum(list.map(m => m.byPlatform[p]).filter(Boolean));
  return { total: dashSum(list.map(m => m.total)), google: plat('google'), meta: plat('meta') };
}

const DASH_PERF_ISSUES = ['CTR dropped by 45% month-over-month.', 'Approaching budget limit, 90% consumed.', 'Cost per conversion up 38% week-over-week.'];
const DASH_PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const DASH_PRIORITY_PILL = { High: 'pill-red', Medium: 'pill-orange', Low: 'pill-green' };

// Attention Required list: V1 triage (workspaces without accounts, unlinked queue) + V2 pipeline alerts (integration errors, tokens).
function dashAttentionItems() {
  if (state.flags.dashAlertsOff) return [];
  const items = [];
  const list = dashAgencyWorkspaces();
  list.filter(w => w.status === 'attention').forEach((w, i) => items.push({
    client: w.name, type: 'Performance Review', priority: i === 0 ? 'High' : 'Medium',
    desc: DASH_PERF_ISSUES[i % DASH_PERF_ISSUES.length], cta: 'View Account', action: `openWorkspace('${w.id}','dashboard')`
  }));
  list.forEach(w => Object.entries(wsProducts(w.id)).forEach(([pid, s]) => {
    if (s.status !== 'error' && s.status !== 'pending') return;
    const p = productById(pid);
    items.push({
      client: w.name, type: 'Integration Error', priority: s.status === 'error' ? 'High' : 'Medium',
      desc: `${p ? p.name : pid}: ${s.error || (s.status === 'pending' ? 'Setup has not been completed.' : 'Sync failed.')}`,
      cta: 'Fix Integration', action: `openWorkspace('${w.id}','integrations')`
    });
  }));
  Object.values(masterTokens).filter(t => t.status !== 'valid').forEach(t => items.push({
    client: 'My Workspace', type: 'Token Expired', priority: 'High',
    desc: `${t.label} ${t.status === 'expired' ? 'token has expired' : 'token needs re-authorising'}. Ad data sync is paused for linked accounts.`,
    cta: 'Re-authorise', action: `navigate('integrations')`
  }));
  const unlinked = adAccounts.filter(a => a.workspaceId === null).length;
  if (unlinked) items.push({
    client: 'My Workspace', type: 'Unlinked Ad Accounts', priority: 'Medium',
    desc: `${unlinked} unlinked ad account${unlinked === 1 ? '' : 's'} discovered from your master connections. Link them to a client workspace.`,
    cta: 'Review accounts', action: `navigate('integrations')`
  });
  list.filter(w => !wsAdAccounts(w.id).length).forEach(w => items.push({
    client: w.name, type: 'No Account Linked', priority: 'Low',
    desc: 'Missing Google or Meta platform integration.', cta: 'Link Ad Account', action: `openWorkspace('${w.id}','integrations')`
  }));
  return items.sort((a, b) => DASH_PRIORITY_RANK[a.priority] - DASH_PRIORITY_RANK[b.priority]);
}

function dashRenderAgency() {
  const port = dashPortfolio();
  return `
    <div class="dash-welcome">
      <div><h2 class="h-welcome">Welcome Back, ${esc(dashFirstName())}</h2><p class="dash-welcome-sub">Keep track of project progress and manage your account all in one place.</p></div>
      ${dateFilterHTML('agency', 'dashRerender')}
    </div>
    ${dashBanner()}
    <div class="dash-top">
      ${dashDonutCard()}
      ${dashSpendCard(port)}
    </div>
    <div class="card dash-att-card" id="dash-attention">${dashAttentionCard()}</div>
    <div class="card" id="dash-managed">${dashManagedCard()}</div>`;
}

function dashBanner() {
  if (state.flags.dashAlertsOff) return '';
  const list = dashAgencyWorkspaces();
  const missing = list.filter(w => !wsAdAccounts(w.id).length).length;
  const impacting = list.filter(w => w.status === 'attention').length;
  if (!missing && !impacting && !dashAttentionItems().length) return '';
  return `<div class="banner banner-warning dash-banner">
    <i data-lucide="triangle-alert"></i>
    <div><div class="banner-title">Attention Required</div><div class="banner-text">${missing} account${missing === 1 ? '' : 's'} missing platform links, ${impacting} impacting overall performance.</div></div>
    <button type="button" class="banner-action" onclick="dashReviewAccounts()">Review Accounts</button>
  </div>`;
}
function dashReviewAccounts() {
  const el = document.getElementById('dash-attention');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('dash-flash');
  void el.offsetWidth;
  el.classList.add('dash-flash');
}

function dashDonutCard() {
  const list = dashAgencyWorkspaces();
  const segs = [['attention', 'Attention Required', '#F78483'], ['inactive', 'Inactive', '#F9C576'], ['new', 'New', '#66ACFD'], ['active', 'Active', '#8CDA93']]
    .map(([k, label, color]) => ({ k, label, color, n: list.filter(w => w.status === k).length }));
  const total = list.length;
  const size = 200, r = 76, sw = 26, C = 2 * Math.PI * r;
  const shown = segs.filter(s => s.n);
  const gap = shown.length > 1 ? sw + 8 : 0;
  let start = 0;
  const arcs = shown.map(s => {
    const len = s.n / total * C;
    const dash = Math.max(0.01, len - gap);
    const out = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-(start + gap / 2)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(s.label)}: ${s.n}</title></circle>`;
    start += len;
    return out;
  }).join('');
  const legendOrder = ['active', 'new', 'inactive', 'attention'].map(k => segs.find(s => s.k === k));
  return `<div class="card dash-donut-card">
    <div class="kpi-title">Total Accounts Managed ${infoTip('Client workspaces you manage, grouped by account status. Not affected by the date filter.')}</div>
    <div class="dash-donut-wrap">
      <div class="dash-donut">
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${total} total accounts">${total ? arcs : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#F2F2F2" stroke-width="${sw}"/>`}</svg>
        <div class="dash-donut-center"><div class="dash-donut-num">${total}</div><div class="t-caption">Total Accounts</div></div>
      </div>
      <div class="dash-legend">${legendOrder.map(s => `<div class="dash-legend-row"><span class="dash-legend-sw" style="background:${s.color}"></span><span class="grow">${esc(s.label)}</span><span>${s.n}</span></div>`).join('')}</div>
    </div>
  </div>`;
}

function dashSpendCard(port) {
  const share = p => port.total.spend ? port[p].spend / port.total.spend * 100 : 0;
  const row = p => `<div class="dash-plat-row dash-spend-row">
      <span class="dash-plat-name">${platformLogo(p)}${PLATFORM_NAME[p]}</span>
      <span class="dash-bar"><span class="dash-bar-fill dash-bar-${p}" style="width:${share(p).toFixed(1)}%"></span></span>
      <span class="dash-plat-val">${fmtMoney(port[p].spend)}<span class="dash-pct">(${Math.round(share(p))}%)</span></span>
    </div>`;
  return `<div class="card dash-metric">
    <div class="kpi-title">Portfolio Spend ${infoTip('Combined Google and Meta ad spend across all managed workspaces for the selected date range.')}</div>
    <div class="kpi-value">${fmtMoney(port.total.spend)}</div>
    ${row('google')}${row('meta')}
  </div>`;
}

function dashAttentionCard() {
  const n = dashAttentionItems().length;
  return `<div class="card-header">
      <div><h2 class="h-section">Attention Required ${n ? `<span class="t-error">(${n})</span>` : '<span class="t-muted">(0)</span>'}</h2><div class="card-sub">Resolve these issues to maintain account health and performance.</div></div>
      ${dashFilterButton('attention')}
    </div>
    <div id="dash-att-list">${dashAttentionList()}</div>`;
}
function dashAttentionList() {
  const all = dashAttentionItems();
  if (!all.length) return emptyState('circle-check', 'All accounts are healthy', 'No issues need your attention right now.');
  const f = state.ui.dashAttFilter;
  const items = all.filter(i => (!f.type.length || f.type.includes(i.type)) && (!f.priority.length || f.priority.includes(i.priority)));
  if (!items.length) return emptyState('search-x', 'No issues match these filters', 'Clear the filter to see every issue.');
  return `<div class="dash-att-list">${items.map(i => `
    <div class="dash-att-item">
      <div class="grow">
        <div class="dash-att-top"><span class="t-bold">${esc(i.client)}</span><span class="chip">${esc(i.type)}</span><span class="pill pill-sm dash-prio ${DASH_PRIORITY_PILL[i.priority]}">${i.priority}</span></div>
        <div class="dash-att-desc">${esc(i.desc)}</div>
      </div>
      <button type="button" class="t-link dash-att-cta" onclick="${i.action}">${esc(i.cta)}<i data-lucide="chevron-right"></i></button>
    </div>`).join('')}</div>`;
}

// ---------- Managed Accounts table ----------
function dashLastActivity(w) {
  const d = new Date('2026-10-21T00:00:00');
  d.setDate(d.getDate() - ((w.seed * 5) % 9));
  return toDateInput(d);
}
function dashManagedRows() {
  const port = dashPortfolio().total;
  return dashAgencyWorkspaces().map(w => {
    const t = dashMetrics(w.id, 'agency').total;
    const linked = t.spend > 0;
    const contact = wsPrimaryContact(w.id);
    return {
      w, t, linked, plats: wsPlatforms(w.id), contact, last: dashLastActivity(w),
      q: { cpm: linked ? dashQuality(t.cpm, port.cpm) : '', cpc: linked ? dashQuality(t.cpc, port.cpc) : '', cpa: linked ? dashQuality(t.cpa, port.cpa) : '' }
    };
  });
}
function dashManagedCard() {
  return `<div class="card-header">
      <div><h2 class="h-section">Managed Accounts</h2><div class="card-sub">A complete overview of all client accounts currently assigned to you.</div></div>
      <div class="row">
        <div class="search dash-search"><input class="input" placeholder="Search client or contact" value="${esc(state.ui.dashMgrSearch)}" oninput="dashManagedSearch(this.value)" aria-label="Search managed accounts"><i data-lucide="search"></i></div>
        ${dashFilterButton('managed')}
      </div>
    </div>
    <div id="dash-managed-body">${dashManagedBody()}</div>`;
}
function dashManagedSearch(v) { state.ui.dashMgrSearch = v; pager('dash-managed').page = 1; dashRefreshManaged(); }
function dashRefreshManaged() { renderRegion('dash-managed-body', dashManagedBody()); }
function dashManagedBody() {
  const term = state.ui.dashMgrSearch.trim().toLowerCase();
  const f = state.ui.dashMgrFilter;
  let rows = dashManagedRows().filter(r => {
    if (term && !`${r.w.name} ${r.contact ? r.contact.email + ' ' + r.contact.name : 'unassigned'}`.toLowerCase().includes(term)) return false;
    if (f.status.length && !f.status.includes(r.w.status)) return false;
    if (f.platform.length && !f.platform.some(p => p === 'none' ? !r.plats.length : r.plats.includes(p))) return false;
    if (f.perf.length && !f.perf.includes(r.q.cpa)) return false;
    return true;
  });
  const statusRank = { attention: 0, new: 1, active: 2, inactive: 3 };
  // Workspaces without data ("—") always sort last, whichever direction.
  const num = v => v || ((state.sorts['dash-managed'] || {}).dir === 'asc' ? Infinity : -1);
  rows = applySort(rows, 'dash-managed', {
    name: r => r.w.name.toLowerCase(), platforms: r => r.plats.length, status: r => statusRank[r.w.status],
    spend: r => num(r.t.spend), cpm: r => num(r.t.cpm), cpc: r => num(r.t.cpc), cpa: r => num(r.t.cpa),
    contact: r => r.contact ? r.contact.email : '~', last: r => r.last
  });
  const total = rows.length;
  const page = paginate(rows, 'dash-managed', 10);
  const fn = 'dashRefreshManaged';
  const th = (col, label, cls = '') => `<th class="${cls}">${sortHeader('dash-managed', col, label, fn)}</th>`;
  const money = (r, k) => r.linked ? dashDot(fmtMoney(r.t[k], 2), r.q[k]) : '<span class="t-muted">—</span>';
  const body = page.map(r => `
    <tr class="clickable" onclick="openWorkspace('${r.w.id}','dashboard')">
      <td class="dash-nowrap"><button type="button" class="dash-name-link" onclick="event.stopPropagation(); openWorkspace('${r.w.id}','dashboard')">${esc(r.w.name)}</button></td>
      <td><div class="chips dash-nowrap">${r.plats.map(p => platformBadge(p)).join('') || '<span class="t-muted">No platform linked</span>'}</div></td>
      <td>${statusPill(r.w.status)}</td>
      <td>${r.linked ? fmtMoney(r.t.spend) : '<span class="t-muted">—</span>'}</td>
      <td>${money(r, 'cpm')}</td>
      <td>${money(r, 'cpc')}</td>
      <td>${money(r, 'cpa')}</td>
      <td>${r.contact ? `<span class="dash-email" title="${esc(r.contact.name)} · ${esc(r.contact.email)}">${esc(r.contact.email)}</span>` : '<span class="t-muted">Unassigned</span>'}</td>
      <td class="dash-nowrap">${fmtDate(r.last)}</td>
      <td onclick="event.stopPropagation()">${rowMenu(`dash-mm-${r.w.id}`, [
        { label: 'Go to workspace', icon: 'arrow-right', onClick: `openWorkspace('${r.w.id}','dashboard')` },
        { label: 'Organisation settings', icon: 'building-2', onClick: `openWorkspace('${r.w.id}','organisation')` },
        { label: 'Integrations', icon: 'blocks', onClick: `openWorkspace('${r.w.id}','integrations')` }
      ])}</td>
    </tr>`).join('');
  const emptyText = term ? `No workspaces found matching “${esc(state.ui.dashMgrSearch)}”.` : 'No workspaces found matching these filters.';
  return `<div class="table-wrap dash-table-wrap"><table class="table">
      <thead><tr>${th('name', 'Client')}${th('platforms', 'Ad Platforms')}${th('status', 'Status')}${th('spend', 'Combined Spend')}${th('cpm', 'CPM')}${th('cpc', 'CPC')}${th('cpa', 'Cost Per Conversion')}${th('contact', 'Primary Contact')}${th('last', 'Last Activity')}<th>Action</th></tr></thead>
      <tbody>${body || `<tr><td colspan="10" class="table-empty">${emptyText}</td></tr>`}</tbody>
    </table></div>
    ${paginationBar('dash-managed', total, fn)}`;
}

// =====================================================================
// CLIENT DASHBOARD
// =====================================================================
function dashSyncClientState() {
  if (state.ui.dashCtWs === state.ctx) return;
  state.ui.dashCtWs = state.ctx;
  Object.assign(state.ui, {
    dashLevel: 'platform', dashDrill: null, dashCtSearch: '',
    dashCtFilter: { platform: [], format: [], status: [] },
    dashEntSel: [], dashEntType: 'all', dashEntQ: ''
  });
  pager('dash-ct').page = 1;
}

function dashRenderClient() {
  const ws = currentWs();
  if (!ws) return '';
  dashSyncClientState();
  const header = `<div class="dash-welcome">
      <div><h2 class="h-welcome">Welcome Back, ${esc(ws.name)}</h2><p class="dash-welcome-sub">Google and Meta advertising performance for this workspace.</p></div>
      ${dateFilterHTML('client', 'dashRerender')}
    </div>`;
  if (!dashPlatforms(ws.id).length) return header + dashHubPanel(ws) + dashNoAccountsCard();
  const m = dashMetrics(ws.id, 'client');
  const crm = activeCrm(ws.id);
  return `${header}
    ${dashHubPanel(ws)}
    ${dashClientKpis(ws, m)}
    ${dashCrmSection(m, crm)}
    <div class="card dash-ct-card" id="dash-campaigns">${dashCampaignCard()}</div>
    <div class="dash-charts">
      <div class="card" id="dash-daily-card">
        <div class="card-header">
          <div><h2 class="h-section">Daily Performance</h2><div class="card-sub">Daily total spend, clicks and conversions.</div></div>
          <div class="seg" id="dash-daily-seg">${dashDailySeg()}</div>
        </div>
        <div class="dash-chart" id="dash-daily"><svg role="img" aria-label="Daily performance chart"></svg></div>
      </div>
      <div class="card" id="dash-heat-card">
        <div class="card-header">
          <div><h2 class="h-section">Best Time of Day</h2><div class="card-sub">Hour x day of week • Asia/Singapore</div></div>
          <div class="seg" id="dash-heat-seg">${dashHeatSeg()}</div>
        </div>
        <div id="dash-heat-body">${dashHeatBody()}</div>
      </div>
    </div>`;
}

// ---------- Products & Connections panel (V2 client-home hero, in the Figma card style) ----------
// Shows which OOm products and integrations are connected, with links into each product,
// plus quick links. Built from workspaceProducts / adAccounts, so it always matches Integrations.
state.ui.dashHubOpen = true;

// Outstanding work inside OOm products (mock, deterministic per workspace).
function dashProductAlerts(wsId, pid) {
  const r = dashRng(`${wsId}:${pid}:alerts`)();
  if (pid === 'aurix') { const n = Math.floor(r * 5); return n ? { text: `${n} escalation${n === 1 ? '' : 's'}`, cls: 'pill-red' } : null; }
  if (pid === 'seo-cloud') { const n = Math.floor(r * 4); return n ? { text: `${n} approval${n === 1 ? '' : 's'}`, cls: 'pill-orange' } : null; }
  return null;
}

// Status of one entry: [dot colour, label]. Matches integStatusDots().
function dashEntryStatus(e) {
  if (!e) return ['grey', 'Not connected'];
  if (e.status === 'error') return ['red', 'Error'];
  if (e.status === 'pending') return ['orange', 'Pending setup'];
  if (e.status === 'disabled') return ['grey', 'Disabled'];
  if (!e.active) return ['grey', 'Inactive'];
  return ['green', e.routedVia ? `Via ${productById(e.routedVia)?.name || 'CRM'}` : 'Connected'];
}
function dashHubDot([color, label]) {
  return `<span class="dot-label dash-hub-status dash-hub-${color}"><span class="dot dot-${color}${color === 'grey' ? '' : '-strong'}"></span>${esc(label)}</span>`;
}

// Opening an OOm product: CRMs open Leads inside Galaxis; others hand off to the product (toast in the demo).
function dashOpenProduct(pid) {
  const p = productById(pid);
  if (p.category === 'CRM' && activeCrm(state.ctx)?.id === pid) { navigate('leads'); return; }
  showToast(`Opening ${p.name}…`, 'external-link');
}
function dashIntegAction(pid, mode) {
  if (typeof integOpenProduct === 'function') integOpenProduct(pid, mode);
  else navigate('integrations');
}
function dashToggleHub() {
  state.ui.dashHubOpen = !state.ui.dashHubOpen;
  const el = document.getElementById('dash-hub');
  if (el) { el.outerHTML = dashHubPanel(currentWs()); refreshIcons(); }
}

// Fixed rows, as in the V2 prototype: three per column.
const DASH_HUB_OOM = ['crm-lite', 'aurix', 'seo-cloud'];
const DASH_HUB_LANES = [
  { label: 'CRM', icon: 'contact', ids: () => products.filter(p => p.category === 'CRM').map(p => p.id), empty: 'No CRM connected' },
  { label: 'Automated Chat', icon: 'message-circle', ids: () => ['aurix', 'sleekflow', 'wati'], empty: 'No chat platform connected' },
  { label: 'Call Tracking', icon: 'phone', ids: () => ['delacon'], empty: 'No call tracking connected' }
];

// Connection lanes: the best entry per lane wins (active > needs attention > inactive).
function dashHubLanes(wsId) {
  const entries = wsProducts(wsId);
  const rank = e => !e ? 0 : e.status === 'connected' && e.active ? 4 : e.status === 'error' || e.status === 'pending' ? 3 : 1;
  return DASH_HUB_LANES.map(l => {
    const hits = l.ids().filter(id => entries[id]).sort((a, b) => rank(entries[b]) - rank(entries[a]));
    return { ...l, hit: hits.length ? { pid: hits[0], e: entries[hits[0]], more: hits.length - 1 } : null };
  });
}

function dashHubPanel(ws) {
  if (!ws) return '';
  const entries = wsProducts(ws.id);
  const open = state.ui.dashHubOpen;
  const live = e => !!e && e.status === 'connected' && e.active;
  const needsFix = e => !!e && (e.status === 'error' || e.status === 'pending');

  // Column 1: OOm products (always the same three rows).
  const oomRows = DASH_HUB_OOM.map(pid => {
    const p = productById(pid);
    const e = entries[pid];
    const alert = live(e) ? dashProductAlerts(ws.id, pid) : null;
    const label = !e ? 'Connect' : needsFix(e) ? 'Fix' : e.status === 'disabled' ? 'Enable' : 'Activate';
    const action = live(e)
      ? `<button type="button" class="t-link" onclick="dashOpenProduct('${pid}')">Open<i data-lucide="${p.category === 'CRM' ? 'arrow-right' : 'external-link'}"></i></button>`
      : `<button type="button" class="t-link" onclick="dashIntegAction('${pid}', '${needsFix(e) ? 'config' : 'about'}')">${label}<i data-lucide="arrow-right"></i></button>`;
    return `<div class="dash-hub-row">
      ${productLogo(pid, 28)}
      <div class="dash-hub-main"><div class="dash-hub-name">${esc(p.name)}${alert ? `<span class="pill pill-sm ${alert.cls}">${esc(alert.text)}</span>` : ''}</div>
        <div class="dash-hub-meta">${esc(p.category)}${live(e) ? '' : ` · ${dashHubDot(dashEntryStatus(e))}`}</div></div>
      ${action}
    </div>`;
  }).join('');

  // Column 2: connections — CRM, Automated Chat, Call Tracking.
  const lanes = dashHubLanes(ws.id);
  const laneRows = lanes.map(l => {
    const h = l.hit;
    const p = h && productById(h.pid);
    const action = !h
      ? `<button type="button" class="t-link" onclick="navigate('integrations')">Connect<i data-lucide="arrow-right"></i></button>`
      : `<button type="button" class="t-link" onclick="dashIntegAction('${h.pid}', '${needsFix(h.e) ? 'config' : 'about'}')">${needsFix(h.e) ? 'Fix now' : 'Manage'}<i data-lucide="arrow-right"></i></button>`;
    return `<div class="dash-hub-row">
      <span class="dash-hub-icon"><i data-lucide="${l.icon}"></i></span>
      <div class="dash-hub-main"><div class="dash-hub-name">${esc(l.label)}</div>
        <div class="dash-hub-meta">${h ? `${esc(p.name)}${h.more ? ` +${h.more}` : ''} · ${dashHubDot(dashEntryStatus(h.e))}` : `<span class="t-muted">${esc(l.empty)}</span>`}</div></div>
      ${action}
    </div>`;
  }).join('');

  // Column 3: quick links.
  const crm = activeCrm(ws.id);
  const links = [
    crm ? { icon: 'contact', label: 'View leads', sub: `Synced from ${crm.name}`, go: "navigate('leads')" }
        : { icon: 'contact', label: 'View leads', sub: 'Connect a CRM to sync leads', go: "navigate('integrations')", muted: true },
    { icon: 'blocks', label: 'Manage integrations', sub: 'Products, credentials and sync', go: "navigate('integrations')" },
    { icon: 'building-2', label: 'Organisation settings', sub: 'Business, brand and billing', go: "navigate('organisation')" }
  ];
  const linkRows = links.map(l => `<button type="button" class="dash-hub-row dash-hub-link ${l.muted ? 'muted' : ''}" onclick="${l.go}">
      <span class="dash-hub-icon"><i data-lucide="${l.icon}"></i></span>
      <span class="dash-hub-main"><span class="dash-hub-name">${esc(l.label)}</span><span class="dash-hub-meta">${esc(l.sub)}</span></span>
      <i data-lucide="chevron-right" class="dash-hub-chev"></i>
    </button>`).join('');

  // Header summary and count cover only the products shown in the panel.
  const shown = [...new Set([...DASH_HUB_OOM, ...DASH_HUB_LANES.flatMap(l => l.ids())])];
  const summary = [];
  DASH_HUB_OOM.forEach(pid => { const a = live(entries[pid]) && dashProductAlerts(ws.id, pid); if (a) summary.push({ text: `${productById(pid).name}: ${a.text}`, cls: a.cls, go: `dashOpenProduct('${pid}')` }); });
  shown.forEach(pid => {
    const e = entries[pid];
    if (e?.status === 'error') summary.push({ text: `${productById(pid).name}: Error`, cls: 'pill-red', go: `dashIntegAction('${pid}', 'config')` });
    if (e?.status === 'pending') summary.push({ text: `${productById(pid).name}: Pending setup`, cls: 'pill-orange', go: `dashIntegAction('${pid}', 'config')` });
  });
  const activeCount = shown.filter(pid => live(entries[pid])).length;

  return `<section class="card dash-hub ${open ? '' : 'collapsed'}" id="dash-hub" aria-label="Products and connections">
    <div class="dash-hub-head">
      <div><h2 class="h-card">Products &amp; Connections</h2>
        <div class="card-sub">${activeCount} active product${activeCount === 1 ? '' : 's'} connected to ${esc(ws.name)}.</div></div>
      <div class="dash-hub-head-right">
        ${summary.map(x => `<button type="button" class="pill pill-sm ${x.cls} dash-hub-pill" onclick="${x.go}">${esc(x.text)}</button>`).join('')}
        <button type="button" class="kebab dash-hub-toggle" onclick="dashToggleHub()" aria-expanded="${open}" aria-controls="dash-hub-body" title="${open ? 'Hide' : 'Show'} products and connections"><i data-lucide="chevron-${open ? 'up' : 'down'}"></i></button>
      </div>
    </div>
    ${open ? `<div class="dash-hub-body" id="dash-hub-body">
      <div class="dash-hub-col"><div class="dash-hub-col-title"><i data-lucide="sparkles"></i>OOm Products</div>${oomRows}</div>
      <div class="dash-hub-col"><div class="dash-hub-col-title"><i data-lucide="link"></i>Connections<button type="button" class="t-link dash-hub-viewall" onclick="navigate('integrations')">View all<i data-lucide="arrow-right"></i></button></div>${laneRows}</div>
      <div class="dash-hub-col"><div class="dash-hub-col-title"><i data-lucide="compass"></i>Quick Links</div>${linkRows}</div>
    </div>` : ''}
  </section>`;
}

function dashNoAccountsCard() {
  const agency = state.persona !== 'client';
  return `<div class="card dash-empty-card">
    <div class="dash-empty-icon"><i data-lucide="link-2-off"></i></div>
    <h2 class="h-section">No ad accounts linked yet</h2>
    <p class="t-secondary">This workspace has no Google Ads or Meta ad account linked, so there is no advertising performance to show yet. Once an account is linked, spend, conversions and campaign data appear here.</p>
    ${agency
      ? `<button type="button" class="btn btn-primary" onclick="navigate('integrations')"><i data-lucide="link"></i>Link ad accounts</button>`
      : `<p class="t-bold">Contact your Agency Admin to link your Google or Meta ad accounts.</p>`}
  </div>`;
}

function dashKpi(title, tip, value, sub, extra = '') {
  return `<div class="kpi-card"><div class="kpi-title">${esc(title)} ${infoTip(tip)}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div>${extra}</div>`;
}
function dashClientKpis(ws, m) {
  const t = m.total;
  const budget = Math.round(ws.budget * m.days / 30);
  const used = budget ? Math.round(t.spend / budget * 100) : 0;
  const unique = Math.round(t.impressions * (0.6 + dashRng(`${ws.id}:reach`)() * 0.12));
  const g = m.byPlatform.google, mt = m.byPlatform.meta;
  const convShare = g && t.conversions ? Math.round(g.conversions / t.conversions * 100) : 0;
  const convSub = g ? `<b>${convShare}%</b> from Google Ads` : '<b>100%</b> from Meta Ads';
  const cpaSub = g && mt ? `Google <b>${fmtMoney(g.cpa, 2)}</b> • Meta <b>${fmtMoney(mt.cpa, 2)}</b>` : `Across ${g ? 'Google' : 'Meta'} Ads`;
  const warn = used >= 100 ? 'dash-bad' : used >= 85 ? 'dash-warn' : '';
  return `<div class="grid-5 dash-kpis">
    ${dashKpi('Total Ad Spend', 'Total advertising spend reported by connected ad platforms.', fmtMoney(t.spend),
      `of <b>${fmtMoney(budget)}</b> budget, <b class="${warn}">${used}%</b> used`,
      `<div class="progress dash-budget"><span class="${warn}" style="width:${Math.min(100, used)}%"></span></div>`)}
    ${dashKpi('Impressions', 'Times ads were served, using the platform-reported impressions metric.', fmtNum(t.impressions), `<b>${fmtNum(unique)}</b> unique users`)}
    ${dashKpi('Clicks', 'Clicks reported by the ad platforms.', fmtNum(t.clicks), `CTR <b>${fmtPct(t.ctr)}</b> • Avg. CPC <b>${fmtMoney(t.cpc, 2)}</b>`)}
    ${dashKpi('Platform Conversions', 'Platform-reported conversion actions.', fmtNum(t.conversions), convSub)}
    ${dashKpi('Cost per Conversion', 'Total ad spend divided by platform-reported conversions.', t.conversions ? fmtMoney(t.cpa, 2) : '—', cpaSub)}
  </div>`;
}

// CRM mode (V2): extra lead / revenue KPIs with attribution model. Ad-only: locked cards + upsell.
function dashCrmSection(m, crm) {
  const t = m.total;
  const tips = {
    leads: 'Leads in your CRM attributed to Google or Meta ads under the selected attribution model.',
    cpl: 'Cost per lead: total ad spend ÷ attributed leads.',
    converted: 'Attributed leads marked as converted (won) in your CRM.',
    revenue: 'Closed revenue from converted leads, credited to ads by the selected attribution model.',
    roas: 'Return on ad spend: attributed revenue ÷ total ad spend.'
  };
  const kpis = [['Attributed Leads', tips.leads], ['Cost per Lead', tips.cpl], ['Converted Leads', tips.converted], ['Attributed Revenue', tips.revenue], ['ROAS', tips.roas]];
  if (!crm) {
    const locked = (title, tip) => `<div class="kpi-card kpi-locked"><div class="kpi-title">${esc(title)} ${infoTip(tip)}<i data-lucide="lock" class="dash-lock"></i></div><div class="kpi-value">—</div><div class="kpi-sub">Requires CRM</div></div>`;
    return `<div class="dash-crm">
      <div class="banner banner-info dash-crm-banner">
        <i data-lucide="lock"></i>
        <div><div class="banner-title">Connect a CRM to unlock leads, revenue and ROAS</div><div class="banner-text">Ad platform metrics above work without a CRM. Lead and revenue attribution needs one connected CRM.</div></div>
        <button type="button" class="btn btn-primary btn-sm dash-banner-btn" onclick="navigate('integrations')"><i data-lucide="plug"></i>Connect CRM</button>
      </div>
      <div class="grid-5 dash-kpis">${kpis.map(([title, tip]) => locked(title, tip)).join('')}</div>
    </div>`;
  }
  const model = state.ui.dashModel;
  return `<div class="dash-crm">
    <div class="dash-crm-head">
      <div class="row"><h2 class="h-card">Leads &amp; Revenue</h2><span class="chip">Attributed via ${esc(crm.name)}</span></div>
      <label class="dash-model"><span>Attribution model</span>
        <select class="select" onchange="dashSetModel(this.value)" aria-label="Attribution model">${DASH_MODELS.map(([v, l]) => `<option value="${v}" ${v === model ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        ${infoTip('Multi-Touch gives 40% of the credit to the first touch, 40% to the last touch and splits 20% across the touches in between. First-Touch and Last-Touch give all the credit to one touch.')}
      </label>
    </div>
    <div class="grid-5 dash-kpis">
      ${dashKpi('Attributed Leads', tips.leads, fmtNum(t.leads), t.conversions ? `<b>${fmtPct(t.leads / t.conversions * 100, 0)}</b> of platform conversions` : 'From Google and Meta ads')}
      ${dashKpi('Cost per Lead', tips.cpl, t.leads ? fmtMoney(t.cpl, 2) : '—', t.conversions ? `vs <b>${fmtMoney(t.cpa, 2)}</b> per conversion` : 'Spend ÷ attributed leads')}
      ${dashKpi('Converted Leads', tips.converted, fmtNum(t.converted), `<b>${fmtPct(t.convRate, 1)}</b> conversion rate`)}
      ${dashKpi('Attributed Revenue', tips.revenue, fmtMoney(t.revenue), t.converted ? `Avg. deal <b>${fmtMoney(t.revenue / t.converted)}</b>` : 'No converted leads yet')}
      ${dashKpi('ROAS', tips.roas, t.spend ? `${t.roas.toFixed(2)}x` : '—', `on <b>${fmtMoney(t.spend)}</b> ad spend`)}
    </div>
  </div>`;
}
function dashSetModel(v) { state.ui.dashModel = v; rerender(); }

// ---------- Campaigns and Ads card (V1 table behaviour) ----------
function dashCampaignCard() {
  const level = state.ui.dashLevel;
  return `<div class="card-header">
      <div><h2 class="h-section">Campaigns and Ads</h2><div class="card-sub">Platform reported campaign and ad metrics from Google and Meta.</div></div>
      <div class="seg" role="tablist">${DASH_LEVELS.map(l => `<button type="button" role="tab" class="${l === level ? 'active' : ''}" onclick="dashSetLevel('${l}')">${DASH_LEVEL_TAB[l]}</button>`).join('')}</div>
    </div>
    <div class="dash-ct-toolbar">
      <div class="menu-anchor dash-entity">
        <button type="button" class="dash-entity-trigger" onclick="dashEntityOpen(event)" aria-haspopup="true"><i data-lucide="layers"></i><span class="grow" id="dash-ent-label">${dashEntityLabel()}</span><i data-lucide="chevron-down"></i></button>
        <div class="filter-panel dash-entity-panel" id="dash-entity-pop" onclick="event.stopPropagation()">
          <div class="search"><input class="input" id="dash-ent-q" placeholder="Search campaigns, ad groups, ads…" value="${esc(state.ui.dashEntQ)}" oninput="state.ui.dashEntQ = this.value; dashRenderEntityList()" autocomplete="off"><i data-lucide="search"></i></div>
          <div id="dash-ent-region">${dashEntityRegion()}</div>
        </div>
      </div>
      <div class="search grow"><input class="input" placeholder="Search by name" value="${esc(state.ui.dashCtSearch)}" oninput="dashCtSearchInput(this.value)" aria-label="Search campaigns and ads"><i data-lucide="search"></i></div>
      ${dashFilterButton('campaigns')}
    </div>
    <div id="dash-ct-body">${dashCampaignBody()}</div>`;
}
function dashRenderCampaignCard() { renderRegion('dash-campaigns', dashCampaignCard()); }
function dashRefreshCampaignTable() { renderRegion('dash-ct-body', dashCampaignBody()); }
function dashSetLevel(l) { state.ui.dashLevel = l; pager('dash-ct').page = 1; dashRenderCampaignCard(); }
function dashCtSearchInput(v) { state.ui.dashCtSearch = v; pager('dash-ct').page = 1; dashRefreshCampaignTable(); }

// Two entities are related when they share every ancestor id they both have (self, ancestor or descendant).
function dashPathsMatch(a, b) { return Object.keys(a).every(k => !(k in b) || a[k] === b[k]); }

function dashDrill(id) {
  const level = state.ui.dashLevel;
  if (level === 'ad') return;
  const e = dashMetrics(state.ctx, 'client')[level].find(x => x.id === id);
  if (!e) return;
  state.ui.dashDrill = { level, id, name: e.name, path: e.path };
  state.ui.dashLevel = DASH_LEVELS[DASH_LEVELS.indexOf(level) + 1];
  pager('dash-ct').page = 1;
  dashRenderCampaignCard();
}
function dashClearDrill() { state.ui.dashDrill = null; state.ui.dashLevel = 'platform'; pager('dash-ct').page = 1; dashRenderCampaignCard(); }

function dashCampaignBody() {
  const u = state.ui;
  const level = u.dashLevel;
  const m = dashMetrics(state.ctx, 'client');
  const crm = !!activeCrm(state.ctx);
  const f = u.dashCtFilter;
  const term = u.dashCtSearch.trim().toLowerCase();
  const byId = new Map(DASH_LEVELS.flatMap(l => m[l].map(e => [e.id, e])));
  const selPaths = u.dashEntSel.map(id => byId.get(id)).filter(Boolean).map(e => e.path);
  let rows = m[level].filter(e => {
    if (u.dashDrill && !dashPathsMatch(e.path, u.dashDrill.path)) return false;
    if (f.platform.length && !f.platform.includes(e.platform)) return false;
    if (f.status.length && !f.status.includes(e.status)) return false;
    if (f.format.length && !e.formats.some(x => f.format.includes(x))) return false;
    if (selPaths.length && !selPaths.some(p => dashPathsMatch(e.path, p))) return false;
    if (term && !`${e.name} ${e.parents.join(' ')} ${PLATFORM_NAME[e.platform]}`.toLowerCase().includes(term)) return false;
    return true;
  });
  if (!state.sorts['dash-ct']) state.sorts['dash-ct'] = { col: 'spend', dir: 'desc' };
  rows = applySort(rows, 'dash-ct', {
    name: e => e.name.toLowerCase(), format: e => e.formats[0] || '', status: e => DASH_STATUS_RANK[e.status],
    spend: e => e.spend, impressions: e => e.impressions, cpm: e => e.cpm, clicks: e => e.clicks, ctr: e => e.ctr, cpc: e => e.cpc,
    conversions: e => e.conversions, cpa: e => e.cpa, leads: e => e.leads, cpl: e => e.cpl, revenue: e => e.revenue, roas: e => e.roas
  });
  const total = rows.length;
  const page = paginate(rows, 'dash-ct', 10);
  const ref = m.total;
  const next = DASH_LEVELS[DASH_LEVELS.indexOf(level) + 1];
  const cols = [['name', DASH_NAME_COL[level]], ['format', 'Ad Format'], ['status', 'Status'], ['spend', 'Spend'], ['impressions', 'Impressions'], ['cpm', 'CPM'], ['clicks', 'Clicks'], ['ctr', 'CTR'], ['cpc', 'CPC'], ['conversions', 'Conversions'], ['cpa', 'Cost Per Conversion']]
    .concat(crm ? [['leads', 'Leads'], ['cpl', 'CPL'], ['revenue', 'Revenue'], ['roas', 'ROAS']] : []);
  const fn = 'dashRefreshCampaignTable';
  const head = cols.map(([c, l]) => `<th>${sortHeader('dash-ct', c, l, fn)}</th>`).join('') + (next ? '<th>Action</th>' : '');
  const cell = (e, c) => {
    switch (c) {
      case 'name': return dashNameCell(e, level);
      case 'format': return dashFormatCell(e.formats);
      case 'status': return statusPill(DASH_STATUS_KEY[e.status], e.status);
      case 'spend': return fmtMoney(e.spend);
      case 'impressions': return fmtNum(e.impressions);
      case 'cpm': return dashDot(fmtMoney(e.cpm, 2), dashQuality(e.cpm, ref.cpm));
      case 'clicks': return fmtNum(e.clicks);
      case 'ctr': return dashDot(fmtPct(e.ctr), dashQuality(e.ctr, ref.ctr, true));
      case 'cpc': return dashDot(fmtMoney(e.cpc, 2), dashQuality(e.cpc, ref.cpc));
      case 'conversions': return fmtNum(e.conversions);
      case 'cpa': return e.conversions ? dashDot(fmtMoney(e.cpa, 2), dashQuality(e.cpa, ref.cpa)) : '<span class="t-muted">—</span>';
      case 'leads': return fmtNum(e.leads);
      case 'cpl': return e.leads ? fmtMoney(e.cpl, 2) : '<span class="t-muted">—</span>';
      case 'revenue': return fmtMoney(e.revenue);
      case 'roas': return `${e.roas.toFixed(2)}x`;
    }
    return '';
  };
  const body = page.map(e => `
    <tr ${next ? `class="clickable" onclick="dashDrill('${q(e.id)}')"` : ''}>
      ${cols.map(([c]) => `<td class="${c === 'name' ? '' : 'dash-nowrap'}">${cell(e, c)}</td>`).join('')}
      ${next ? `<td onclick="event.stopPropagation()">${rowMenu(`dash-ctm-${dashHash(e.id)}`, [{ label: `View ${DASH_LEVEL_TAB[next].toLowerCase()} (${e.childCount})`, icon: 'arrow-right', onClick: `dashDrill('${q(e.id)}')` }])}</td>` : ''}
    </tr>`).join('');
  const drill = u.dashDrill ? `<div class="dash-drill"><span>Filtered for ${DASH_LEVEL_LABEL[u.dashDrill.level]}: <b>${esc(u.dashDrill.name)}</b></span><button type="button" class="chip-remove" onclick="dashClearDrill()" aria-label="Clear filter"><i data-lucide="x"></i></button></div>` : '';
  return `${dashEntityChips(byId)}${drill}
    <div class="table-wrap dash-table-wrap"><table class="table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="${cols.length + (next ? 1 : 0)}" class="table-empty">No data matches criteria.</td></tr>`}</tbody>
    </table></div>
    ${paginationBar('dash-ct', total, fn)}`;
}
function dashNameCell(e, level) {
  if (level === 'platform') return `<span class="dash-name-plat">${platformLogo(e.platform)}<b>${esc(e.name)}</b></span>`;
  const parent = level === 'campaign' ? PLATFORM_NAME[e.platform] : e.parents.join(' › ');
  return `<div class="dash-name"><span class="dash-name-parent" title="${esc(parent)}">${platformLogo(e.platform)}<span>${esc(parent)}</span></span><b>${esc(e.name)}</b></div>`;
}
function dashFormatCell(formats) {
  if (!formats.length) return '<span class="t-muted">—</span>';
  const more = formats.length > 1 ? `<span class="more-count" title="${esc(formats.slice(1).join(', '))}">+${formats.length - 1}</span>` : '';
  return `<span class="chips dash-nowrap"><span class="chip">${esc(formats[0])}</span>${more}</span>`;
}

// ---------- Entity multi-select dropdown ----------
function dashEntities() {
  const m = dashMetrics(state.ctx, 'client');
  return [
    ...m.campaign.map(e => ({ e, type: 'campaign', parent: `${PLATFORM_NAME[e.platform]} Ads` })),
    ...m.adgroup.map(e => ({ e, type: 'adgroup', parent: `in ${e.campaignName} · ${PLATFORM_NAME[e.platform]}` })),
    ...m.ad.map(e => ({ e, type: 'ad', parent: `in ${e.adGroupName} · ${PLATFORM_NAME[e.platform]}` }))
  ];
}
function dashEntityShown() {
  const term = state.ui.dashEntQ.trim().toLowerCase();
  const type = state.ui.dashEntType;
  return dashEntities().filter(x => (type === 'all' || x.type === type) && (!term || `${x.e.name} ${x.parent}`.toLowerCase().includes(term)));
}
function dashEntityLabel() {
  const sel = state.ui.dashEntSel;
  if (!sel.length) return 'All Campaigns, Groups &amp; Ads';
  const types = dashEntities().filter(x => sel.includes(x.e.id)).map(x => x.type);
  const parts = [];
  const c = types.filter(t => t === 'campaign').length, g = types.filter(t => t === 'adgroup').length, a = types.filter(t => t === 'ad').length;
  if (c) parts.push(`${c} Camp.`);
  if (g) parts.push(`${g} Grp.`);
  if (a) parts.push(`${a} Ad${a > 1 ? 's' : ''}`);
  return `${sel.length} selected (${parts.join(', ')})`;
}
function dashEntityRegion() {
  const all = dashEntities();
  const shown = dashEntityShown();
  const sel = state.ui.dashEntSel;
  const count = t => t === 'all' ? all.length : all.filter(x => x.type === t).length;
  const labels = { all: 'All', campaign: 'Campaigns', adgroup: 'Ad Groups', ad: 'Ads' };
  const rows = shown.map(x => {
    const on = sel.includes(x.e.id);
    return `<button type="button" class="dash-ent-row ${on ? 'selected' : ''}" onclick="dashEntToggle('${q(x.e.id)}')">
      <span class="dash-ent-check">${on ? '<i data-lucide="check"></i>' : ''}</span>
      <span class="dash-tag dash-tag-${x.type}">${DASH_LEVEL_LABEL[x.type]}</span>
      <span class="dash-ent-text"><span class="dash-ent-name" title="${esc(x.e.name)}">${esc(x.e.name)}</span><span class="dash-ent-parent" title="${esc(x.parent)}">${esc(x.parent)}</span></span>
    </button>`;
  }).join('');
  return `<div class="dash-ent-types">${['all', 'campaign', 'adgroup', 'ad'].map(t => `<button type="button" class="${state.ui.dashEntType === t ? 'active' : ''}" onclick="dashEntType('${t}')">${labels[t]} (${count(t)})</button>`).join('')}</div>
    <div class="dash-ent-actions"><button type="button" class="t-link" onclick="dashEntSelectShown()">Select all shown</button><span class="t-muted">·</span><button type="button" class="t-link" onclick="dashEntClear()">Deselect all</button><span class="t-muted dash-ent-count">${shown.length} shown</span></div>
    <div class="dash-ent-list" id="dash-ent-list">${rows || `<div class="dash-ent-empty">No campaigns, ad groups or ads match “${esc(state.ui.dashEntQ)}”.</div>`}</div>`;
}
function dashEntityOpen(ev) {
  toggleMenu('dash-entity-pop', ev);
  if (document.getElementById('dash-entity-pop')?.classList.contains('open')) {
    dashRenderEntityList();
    setTimeout(() => document.getElementById('dash-ent-q')?.focus(), 30);
  }
}
function dashRenderEntityList() {
  const list = document.getElementById('dash-ent-list');
  const top = list ? list.scrollTop : 0;
  renderRegion('dash-ent-region', dashEntityRegion());
  const fresh = document.getElementById('dash-ent-list');
  if (fresh) fresh.scrollTop = top;
}
function dashEntitySelectionChanged() {
  dashRenderEntityList();
  const label = document.getElementById('dash-ent-label');
  if (label) label.innerHTML = dashEntityLabel();
  pager('dash-ct').page = 1;
  dashRefreshCampaignTable();
}
function dashEntToggle(id) {
  const s = state.ui.dashEntSel;
  state.ui.dashEntSel = s.includes(id) ? s.filter(x => x !== id) : [...s, id];
  dashEntitySelectionChanged();
}
function dashEntType(t) { state.ui.dashEntType = t; dashRenderEntityList(); }
function dashEntSelectShown() { state.ui.dashEntSel = [...new Set([...state.ui.dashEntSel, ...dashEntityShown().map(x => x.e.id)])]; dashEntitySelectionChanged(); }
function dashEntClear() { state.ui.dashEntSel = []; dashEntitySelectionChanged(); }
function dashEntityChips(byId) {
  const sel = state.ui.dashEntSel;
  if (!sel.length) return '';
  return `<div class="dash-chipbar">${sel.map(id => {
    const e = byId.get(id);
    return e ? `<span class="chip chip-dark dash-sel-chip"><span class="dash-chip-text" title="${esc(e.name)}">${esc(e.name)}</span><button type="button" class="chip-remove" onclick="dashEntToggle('${q(id)}')" aria-label="Remove ${esc(e.name)}"><i data-lucide="x"></i></button></span>` : '';
  }).join('')}<button type="button" class="t-link" onclick="dashEntClear()">Clear All</button></div>`;
}

// ---------- Daily Performance chart (V1 SVG chart, restyled) ----------
const DASH_CHART_METRICS = [['spend', 'Spend'], ['conversions', 'Conversion'], ['clicks', 'Clicks']];
function dashDailySeg() {
  const cur = state.ui.dashChartMetric;
  return DASH_CHART_METRICS.map(([k, l]) => `<button type="button" class="${k === cur ? 'active' : ''}" onclick="dashSetChartMetric('${k}')">${l}</button>`).join('');
}
function dashSetChartMetric(k) { state.ui.dashChartMetric = k; renderRegion('dash-daily-seg', dashDailySeg()); dashRenderDaily(); }

function dashDailySeries() {
  const ws = currentWs();
  const m = dashMetrics(ws.id, 'client');
  const range = resolveDateRange(state.dateFilters.client);
  const days = dateRangeDays('client');
  const start = new Date((range ? range.start : toDateInput(new Date())) + 'T00:00:00');
  const phase = dashRng(`${ws.id}:phase`)() * 6;
  const pts = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const r = dashRng(`${ws.id}:${toDateInput(d)}`);
    const dow = d.getDay();
    const w = Math.max(0.2, 1 + 0.28 * Math.sin(i / 3.1 + phase) + (dow === 0 || dow === 6 ? -0.16 : 0.04) + 0.14 * (r() - 0.5));
    pts.push({ d, w, wc: w * (0.85 + r() * 0.3), wv: w * (0.75 + r() * 0.5) });
  }
  const sw = pts.reduce((s, p) => s + p.w, 0), sc = pts.reduce((s, p) => s + p.wc, 0), sv = pts.reduce((s, p) => s + p.wv, 0);
  return pts.map(p => ({
    d: p.d,
    spend: m.total.spend * p.w / sw,
    clicks: Math.round(m.total.clicks * p.wc / sc),
    conversions: Math.round(m.total.conversions * p.wv / sv)
  }));
}
function dashNiceMax(v) {
  const raw = v / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw) || 10 * mag;
  return step * 5;
}
function dashSmoothPath(pts, floor) {
  if (!pts.length) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  const t = 0.16;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, Math.min(floor, p1[1] + (p2[1] - p0[1]) * t)];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, Math.min(floor, p2[1] - (p3[1] - p1[1]) * t)];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
function dashRenderDaily() {
  const wrap = document.getElementById('dash-daily');
  if (!wrap) return;
  const svg = wrap.querySelector('svg');
  const metric = state.ui.dashChartMetric;
  const series = dashDailySeries();
  const n = series.length;
  const W = Math.max(320, wrap.clientWidth || 600), H = 280;
  const fmtV = v => metric === 'spend' ? fmtMoney(v) : fmtNum(Math.round(v));
  const max = dashNiceMax(Math.max(1, ...series.map(s => s[metric])));
  const p = { l: 18 + fmtV(max).length * 7, r: 16, t: 12, b: 34 };
  const iw = W - p.l - p.r, ih = H - p.t - p.b;
  const x = i => p.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
  const y = v => p.t + ih - v / max * ih;
  const ticks = n <= 6 ? series.map((_, i) => i) : Array.from({ length: 6 }, (_, j) => Math.round(j * (n - 1) / 5));
  const lbl = d => `${String(d.getDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
  let o = `<defs><linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#398FF7" stop-opacity=".14"/><stop offset="1" stop-color="#398FF7" stop-opacity="0"/></linearGradient></defs>`;
  for (let k = 0; k <= 5; k++) {
    const v = max * k / 5;
    o += `<text x="${p.l - 14}" y="${y(v) + 4}" text-anchor="end" class="dash-axis">${fmtV(v)}</text>`;
    if (k) o += `<line x1="${p.l}" x2="${W - p.r}" y1="${y(v)}" y2="${y(v)}" class="dash-grid"/>`;
  }
  o += `<line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${p.t + ih}" class="dash-axis-line"/><line x1="${p.l}" y1="${p.t + ih}" x2="${W - p.r}" y2="${p.t + ih}" class="dash-axis-line"/>`;
  ticks.forEach(i => { o += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="dash-axis">${lbl(series[i].d)}</text>`; });
  const pts = series.map((s, i) => [x(i), y(s[metric])]);
  const line = dashSmoothPath(pts, p.t + ih);
  o += `<path d="${line} L ${x(n - 1)} ${p.t + ih} L ${x(0)} ${p.t + ih} Z" fill="url(#dash-area)"/>`;
  o += `<path d="${line}" fill="none" stroke="#398FF7" stroke-width="1.75" stroke-linejoin="round"/>`;
  ticks.forEach(i => { o += `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.5" fill="#66ACFD" stroke="#398FF7" stroke-width="1"/>`; });
  o += `<line id="dash-guide" x1="0" x2="0" y1="${p.t}" y2="${p.t + ih}" stroke="#AEAEAE" stroke-dasharray="3 3" visibility="hidden"/>`;
  o += `<circle id="dash-hover-dot" r="5" fill="#fff" stroke="#398FF7" stroke-width="2" visibility="hidden"/>`;
  o += `<rect id="dash-hover-rect" x="${p.l}" y="${p.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);
  svg.innerHTML = o;
  const rect = svg.querySelector('#dash-hover-rect');
  const guide = svg.querySelector('#dash-guide');
  const dot = svg.querySelector('#dash-hover-dot');
  rect.addEventListener('mousemove', ev => {
    const bb = svg.getBoundingClientRect();
    const px = (ev.clientX - bb.left) * (W / bb.width);
    const i = Math.max(0, Math.min(n - 1, Math.round((px - p.l) / (iw || 1) * (n - 1))));
    const s = series[i];
    guide.setAttribute('x1', pts[i][0]); guide.setAttribute('x2', pts[i][0]); guide.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', pts[i][0]); dot.setAttribute('cy', pts[i][1]); dot.setAttribute('visibility', 'visible');
    const row = (k, l, v) => `<div class="dash-tip-row ${k === metric ? 'on' : ''}"><span>${l}</span><b>${v}</b></div>`;
    dashTip(ev, `<div class="dash-tip-date">${fmtDate(s.d)}</div>${row('spend', 'Spend (SGD)', fmtMoney(s.spend, 2))}${row('conversions', 'Conversions', fmtNum(s.conversions))}${row('clicks', 'Clicks', fmtNum(s.clicks))}`);
  });
  rect.addEventListener('mouseleave', () => { guide.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); dashTipHide(); });
}

function dashTip(ev, html) {
  const t = document.getElementById('chart-tooltip');
  if (!t) return;
  t.innerHTML = html;
  t.style.display = 'block';
  const w = t.offsetWidth, h = t.offsetHeight;
  let left = ev.clientX + 14, top = ev.clientY - h - 12;
  if (left + w > window.innerWidth - 8) left = ev.clientX - w - 14;
  if (top < 52) top = ev.clientY + 18;
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}
function dashTipHide() { const t = document.getElementById('chart-tooltip'); if (t) t.style.display = 'none'; }

let dashResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(dashResizeTimer);
  dashResizeTimer = setTimeout(() => { if (document.getElementById('dash-daily')) dashRenderDaily(); }, 120);
});

// ---------- Best Time of Day heatmap (V1, restyled) ----------
function dashHeatSeg() {
  const cur = state.ui.dashHeatMetric;
  return [['spend', 'Spend'], ['cpa', 'Cost Per Conversion']].map(([k, l]) => `<button type="button" class="${k === cur ? 'active' : ''}" onclick="dashSetHeatMetric('${k}')">${l}</button>`).join('');
}
function dashSetHeatMetric(k) { state.ui.dashHeatMetric = k; renderRegion('dash-heat-seg', dashHeatSeg()); renderRegion('dash-heat-body', dashHeatBody()); }

// Average spend per hour (and cost per conversion) for each weekday × hour, Asia/Singapore.
function dashHeatData() {
  const ws = currentWs();
  const m = dashMetrics(ws.id, 'client');
  const days = dateRangeDays('client');
  const rnd = dashRng(`${ws.id}:heat`);
  const metaShare = m.total.spend && m.byPlatform.meta ? m.byPlatform.meta.spend / m.total.spend : 0;
  const dayF = [1, 1.05, 1.18, 1.08, 1, 0.72, 0.66];
  const w = [], eff = [];
  for (let d = 0; d < 7; d++) {
    w.push([]); eff.push([]);
    for (let h = 0; h < 24; h++) {
      const work = Math.exp(-((h - 14) ** 2) / 14);
      const eve = Math.exp(-((h - 20.5) ** 2) / 5) * metaShare * 0.9;
      const night = h < 6 ? 0.1 : 0.28;
      w[d].push((night + work + eve) * dayF[d] * (0.85 + rnd() * 0.3));
      eff[d].push(0.6 + 0.5 * Math.exp(-((h - 11) ** 2) / 18) + 0.25 * rnd());
    }
  }
  const sumW = w.flat().reduce((a, b) => a + b, 0);
  const meanE = eff.flat().reduce((a, b) => a + b, 0) / 168;
  const occ = Math.max(1, days / 7);
  return {
    spend: w.map(row => row.map(v => m.total.spend * v / sumW / occ)),
    cpa: eff.map(row => row.map(e => m.total.cpa * meanE / e))
  };
}
function dashRamp(n) {
  const stops = [[0, [191, 226, 176]], [0.5, [249, 213, 143]], [1, [243, 160, 156]]];
  const i = n <= 0.5 ? 0 : 1;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1];
  const t = Math.max(0, Math.min(1, (n - a) / (b - a)));
  return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(',')})`;
}
function dashHeatBody() {
  const metric = state.ui.dashHeatMetric;
  const data = dashHeatData()[metric];
  const flat = data.flat();
  const min = Math.min(...flat), max = Math.max(...flat);
  const target = metric === 'spend' ? max : min;
  const pi = flat.indexOf(target);
  const pd = Math.floor(pi / 24), ph = pi % 24;
  let g = '<div></div>';
  for (let h = 0; h < 24; h++) g += `<div class="dash-heat-hour">${h % 3 === 0 ? h : ''}</div>`;
  data.forEach((row, d) => {
    g += `<div class="dash-heat-day">${DASH_DAYS[d]}</div>`;
    row.forEach((v, h) => {
      const n = max > min ? (v - min) / (max - min) : 0;
      g += `<div class="dash-heat-cell" style="background:${dashRamp(n)}" data-d="${d}" data-h="${h}" data-v="${v.toFixed(2)}"></div>`;
    });
  });
  const when = `${DASH_DAYS[pd]} ${String(ph).padStart(2, '0')}:00`;
  const callout = metric === 'spend'
    ? `Peak spend: ${when} (about ${fmtMoney(target, 2)} per hour on average)`
    : `Lowest cost per conversion: ${when} (about ${fmtMoney(target, 2)} per conversion on average)`;
  return `<div class="dash-heat" id="dash-heat">${g}</div>
    <div class="dash-heat-legend"><span>Low</span><span class="dash-heat-ramp"></span><span>High</span></div>
    <div class="dash-heat-callout">${esc(callout)}</div>`;
}
function dashBindHeatmap() {
  const card = document.getElementById('dash-heat-card');
  if (!card) return;
  card.addEventListener('mousemove', ev => {
    const c = ev.target.closest('.dash-heat-cell');
    if (!c) { dashTipHide(); return; }
    const v = Number(c.dataset.v);
    const metric = state.ui.dashHeatMetric;
    dashTip(ev, `<div class="dash-tip-date">${DASH_DAYS[c.dataset.d]} ${String(c.dataset.h).padStart(2, '0')}:00</div>${metric === 'spend' ? `${fmtMoney(v, 2)} spend per hour (avg.)` : `${fmtMoney(v, 2)} per conversion (avg.)`}`);
  });
  card.addEventListener('mouseleave', dashTipHide);
}

// =====================================================================
// Screen registration, dev toggles
// =====================================================================
Object.assign(state.ui, {
  dashMgrSearch: '', dashMgrFilter: { platform: [], status: [], perf: [] },
  dashAttFilter: { type: [], priority: [] },
  dashModel: 'mta', dashChartMetric: 'spend', dashHeatMetric: 'spend',
  dashFpSnap: {}, dashFpCollapsed: {},
  dashCtWs: undefined, dashCtFilter: { platform: [], format: [], status: [] }, dashEntSel: [], dashEntType: 'all', dashEntQ: '', dashCtSearch: '', dashLevel: 'platform', dashDrill: null
});

registerScreen('dashboard', {
  contexts: ['agency', 'client'],
  title: () => 'Dashboard',
  desc: () => '',
  render: () => isAgency() ? dashRenderAgency() : dashRenderClient(),
  afterRender: () => {
    dashTipHide();
    if (!isAgency()) { dashRenderDaily(); dashBindHeatmap(); }
  }
});

function dashSetAdOnly() {
  const wp = wsProducts(state.ctx);
  Object.keys(wp).forEach(pid => { if (productById(pid)?.category === 'CRM') wp[pid].active = false; });
  render();
}
function dashSetCrmConnected() {
  const wp = wsProducts(state.ctx);
  Object.keys(wp).forEach(pid => { if (pid !== 'crm-lite' && productById(pid)?.category === 'CRM') wp[pid].active = false; });
  wp['crm-lite'] = { ...(wp['crm-lite'] || {}), status: 'connected', active: true, lastSynced: new Date().toISOString() };
  render();
}

registerDevToggles('agency-dashboard', () => [
  { label: 'Alerts on', active: !state.flags.dashAlertsOff, run: () => { state.flags.dashAlertsOff = false; rerender(); } },
  { label: 'Alerts off', active: !!state.flags.dashAlertsOff, run: () => { state.flags.dashAlertsOff = true; rerender(); } }
]);
registerDevToggles('client-dashboard', () => {
  const crm = !!activeCrm(state.ctx);
  return [
    { label: 'Ad-only (no CRM)', active: !crm, run: dashSetAdOnly },
    { label: 'CRM connected', active: crm, run: dashSetCrmConnected },
    { label: 'No ad accounts linked', active: !!state.flags.dashNoAccounts, run: () => { state.flags.dashNoAccounts = !state.flags.dashNoAccounts; rerender(); } }
  ];
});

// =====================================================================
// Specs (ported from V1 agency-home / client-home and updated to this build)
// =====================================================================
Object.assign(screenSpecs, {
  'agency-dashboard': {
    title: '1. Agency Dashboard (My Workspace)',
    status: 'In Review',
    author: 'Hannah',
    updatedAt: '21/10/2026',
    notes: `
### Screen Purpose & Objectives
Central command dashboard for agency administrators managing many client ad accounts and workspaces. Designed for portfolio-level performance monitoring and account triage. Layout follows the Figma "Desktop -> Dashboard" frame.

### Key Functional Specifications
- **Workspace Switcher**: The workspace dropdown in the top bar switches between the agency view ("My Workspace") and individual client workspaces. There is no separate My/Agency toggle.
- **Date Filter (Past / Current / Date Range)**: Applies to every spend and cost metric on this page. Total Accounts Managed is not date-dependent.
  - **Prototype note:** the date filter scales mock 30-day data to the selected range. It does **not** yet filter by event date. Real behaviour must use the event date (click / conversion date), as in the client dashboard spec.
- **Attention Required banner**: "N accounts missing platform links, M impacting overall performance." N = workspaces with no linked Google or Meta account; M = workspaces with status Attention Required. "Review Accounts" scrolls to the Attention list.
- **Unified Portfolio KPIs (KPIs TBC)**: All figures are computed from per-workspace data, with no hard-coded totals.
  - **Total Accounts Managed**: donut by status (Active / New / Inactive / Attention Required).
  - **Portfolio Spend**: total, with a Google / Meta split.
  - Overall CPM, CPC and Cost per Conversion cards were removed from the agency dashboard on 21/10/2026. These metrics remain per workspace in the Managed Accounts table.
- **Attention Required list**: Merges V1 triage with V2 pipeline alerts. Each row has a type, a priority (High / Medium / Low) and a one-click CTA. Filtered by issue type and priority (Figma "Attention Account Filter").
  - **Performance Review**: workspace status Attention Required → View Account (High for the first, Medium after that).
  - **Integration Error**: a workspace product in error (High) or pending setup (Medium) → Fix Integration (workspace Integrations).
  - **Token Expired**: an agency master token (Google MCC / Meta Business Manager) that is not valid → Re-authorise (High).
  - **Unlinked Ad Accounts**: one agency-level row for discovered but unlinked ad accounts → Review accounts (agency Integrations › Ad Platforms) (Medium).
  - **No Account Linked**: a workspace with zero linked ad accounts → Link Ad Account (Low).
- **Managed Accounts table** (the V1 Client Workspace Directory, with Figma columns): Client, Ad Platforms, Status, Combined Spend, CPM, CPC, Cost Per Conversion, Primary Contact, Last Activity, Action.
  - Coloured dots on CPM / CPC / Cost per Conversion compare each workspace with the portfolio average. Green (Excellent) is at least 10% better; orange (Average) is within -10% to +15%; red (Bad) is more than 15% worse. This replaces V1's heat cells.
  - Search by client or contact.
  - Figma "Managed Account Filter": Ad Platforms, Status, and Performance band (on Cost per Conversion).
  - Every column is sortable. Pagination uses "Showing Per Page".
  - Clicking a row or a client name opens that workspace's dashboard.
  - The ⋮ menu has Go to workspace, Organisation settings and Integrations.
  - Workspaces with no linked accounts show "—" for metrics. Primary Contact shows "Unassigned" when a workspace has none.
- **Filter dropdowns**: Changes apply immediately. Each group has an "All" option. **Clear Filter** removes every filter. **Revert To Original** restores the selection from when the panel was opened. **Apply** closes the panel.
- **Cross-Client Campaigns**: Removed on purpose. Per V1 notes, pulling campaign KPIs across every client is too heavy for v1, and the Managed Accounts table is enough for cross-client comparison.

### Open questions
- **KPIs TBC**: the final portfolio KPI set still needs performance-marketing and account-management sign-off.
- Should "missing platform links" also count workspaces linked to only one of Google / Meta?
- Performance-review triggers (CTR drop, budget pacing) are placeholders. Thresholds are TBC.
- "Last Activity" is mock data. Its source (last login, last sync or last edit) is TBC.

### Dev toolbar states
- **Alerts on / Alerts off**: Off hides the banner and empties the Attention list (the healthy state).
`
  },
  'client-dashboard': {
    title: '1. Workspace Dashboard & Analytics',
    status: 'In Review',
    author: 'Hannah',
    updatedAt: '21/10/2026',
    notes: `
### Screen Purpose & Objectives
Client-facing workspace dashboard giving a simplified, unified view of Meta and Google Ads performance. It aims to remove the client's need to log in to the native ad platforms, and it doubles as an inspection view for agency administrators. Layout follows the Figma "Dashboard - Platform / Campaign / Ad Group / Ads" frames.

### Key Functional Specifications (All metrics TBC)
- **Top-Level KPI Cards**: Total Ad Spend (with budget used and a progress bar), Impressions (unique users), Clicks (CTR and average CPC), Platform Conversions (% from Google Ads) and Cost per Conversion (per-platform split). Each card has an ⓘ definition.
  - Exact KPIs are placeholders pending feedback from performance marketing and account management.
  - The budget shown is the workspace monthly budget pro-rated to the selected range.
- **Global Event-Based Date Filter**: Filters all dashboard data by the exact date the action (e.g. click or conversion) happened within the selected timeframe, independent of events higher up the funnel.
  - **Prototype note:** the date filter scales mock data to the selected range, and the Daily Performance chart plots one point per day of the range. It does **not** yet filter by event date.
- **CRM mode (from V2)**: shown when the workspace has a connected, active CRM.
  - **Products & Connections panel** (top of the page, from the V2 client home): collapsible card with three columns. three fixed rows per column, as in V2. OOm Products: CRM - lite, Aurix and SEO Cloud, with outstanding-work badges and Open links (CRM opens Leads), or Connect / Activate / Fix when not live. Connections: CRM, Automated Chat and Call Tracking, with live status and Manage / Fix now / Connect, plus View all. Quick Links: View leads, Manage integrations and Organisation settings. Items needing attention also show as pills in the header, so they stay visible when collapsed. Built from the same data as Integrations.
  - A second row of 5 KPI cards, matching the ad-platform row: Attributed Leads (+ share of platform conversions), Cost per Lead (+ cost per conversion for comparison), Converted Leads (+ conversion rate), Attributed Revenue (+ average deal value) and ROAS (+ ad spend).
  - The table gains Leads, CPL, Revenue and ROAS columns.
  - The **attribution model** selector offers Multi-Touch (40/20/40), First-Touch and Last-Touch. Each model credits leads and revenue differently, so the figures change with the model.
  - **Ad-only mode** (no CRM): those three cards are locked ("Requires CRM"), with a "Connect a CRM to unlock leads, revenue and ROAS" banner linking to Integrations.
- **Hierarchical Campaign Breakdown Table ("Campaigns and Ads")**: Users drill down through Platform → Campaign → Ad Group → Ad to compare key statistics.
  - **Level tabs**: Platform / Campaigns / Ad Groups / Ads.
  - **Drill-down**: clicking a row, or "View …" in the ⋮ menu, opens the next level with a "Filtered for X ✕" badge. Clearing the badge returns to Platform.
  - **Columns**: Name (parent shown above), Ad Format (+N overflow), Status, Spend, Impressions, CPM, Clicks, CTR, CPC, Conversions, Cost Per Conversion. Every column is sortable, including Status (Active → Attention Required → Paused) and Ad Format (first format).
  - **Quality dots** on CPM, CTR, CPC and Cost per Conversion compare each row with the workspace average.
  - Only the workspace's linked platforms appear. The hierarchy is generated per workspace.
- **Table Filters**:
  - **Entity multi-select**: search, type pills with counts (All / Campaigns / Ad Groups / Ads), "Select all shown" / "Deselect all", a shown counter, and selected chips with Clear All. Choosing an entity also keeps its parents and children at other levels.
  - **Filter dropdown**: Platform / Ad Format / Status.
  - **Name search**.
- **Graphic Visualisations (Provisional)**:
  - **Daily Performance**: a smooth line chart with a Spend / Conversion / Clicks toggle and a hover tooltip.
  - **Best Time of Day**: a heatmap (hour × weekday, Asia/Singapore) with a Spend / Cost Per Conversion toggle, cell tooltips and a peak callout.
  - These formats are conceptual placeholders. Account-management feedback will decide the final visuals, and low-interest charts will be removed or replaced.
- **No ad accounts linked**: Charts, KPIs and the table are replaced by an empty state.
  - Agency Admins see "Link ad accounts" (Integrations).
  - Client users are told to contact their Agency Admin.

### Open questions
- **KPIs TBC**: the "unique users" figure is a mock reach estimate. Confirm whether reach should come from the platforms (Meta reach is not additive across campaigns).
- Should the attribution model selector also be available on the Leads screen?
- Whether the heatmap should show local ad-account time or SGT when the accounts use different time zones.

### Dev toolbar states
- **Viewing as Agency Admin / Client User** (shared).
- **Ad-only (no CRM)**: deactivates every CRM for this workspace, which also hides the Leads nav item.
- **CRM connected**: makes CRM - lite connected and active, and every other CRM inactive.
- **No ad accounts linked**: simulates the empty state without changing ad-account data.
`
  }
});
