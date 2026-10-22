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
// Summable metrics. Platform-reported: spend … convValue. CRM-attributed: leads, converted, revenue.
const DASH_SUM_KEYS = ['spend', 'impressions', 'reach', 'clicks', 'conversions', 'pLeads', 'purchases', 'convValue', 'engagements', 'leads', 'converted', 'revenue'];
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
          const conversions = clicks * cvr;
          // Sheet metrics use their own random stream so the original metrics keep their values.
          const xr = dashRng(`${id}:sheet-metrics`);
          const freq = p === 'google' ? 1.2 + xr() * 1.3 : 1.6 + xr() * 1.8;
          const engRate = (p === 'google' ? 0.4 + xr() * 1.2 : 1 + xr() * 3.5) / 100;
          const purchases = conversions * (0.1 + xr() * 0.2);
          t.ads.push({
            id, level: 'ad', platform: p, name: `Ad Creative Q${Math.ceil(adNo / 2)} - Variant ${adNo}`, format: fmt, status,
            parents: [cName, gName], campaignName: cName, adGroupName: gName,
            path: { platform: pid, campaign: cid, adgroup: gid, ad: id },
            base: {
              spend, impressions, clicks, conversions,
              reach: impressions / freq,
              engagements: impressions * engRate,
              pLeads: conversions * (0.45 + xr() * 0.3),
              purchases,
              convValue: purchases * (60 + xr() * 180)
            }
          });
        }
      });
    });
  });
  // Fit 30-day spend to 72–94% of the monthly budget so budget pacing looks plausible.
  const total = t.ads.reduce((s, a) => s + a.base.spend, 0);
  if (total) {
    const f = wsAdBudget(wsId) * (0.72 + dashRng(`${wsId}:budget`)() * 0.22) / total;
    t.ads.forEach(a => Object.keys(a.base).forEach(k => { a.base[k] *= f; }));
  }
  dashCache.tree[key] = t;
  return t;
}

// Date-range scaling. Not purely linear, so ratios (CPM, CTR, CPC) also move a little with the range.
function dashFactors(days) {
  const f = days / 30;
  const impressions = f * (1 + 0.03 * Math.sin(days));
  const conversions = f * (1 - 0.06 * Math.sin(days * 0.7));
  // Reach grows more slowly than impressions over longer ranges, so frequency rises with the range.
  return { spend: f, impressions, reach: Math.pow(f, 0.8), engagements: impressions, clicks: f * (1 + 0.05 * Math.cos(days * 1.3)), conversions, pLeads: conversions, purchases: conversions, convValue: conversions };
}
function dashDerive(o) {
  o.cpm = o.impressions ? o.spend / o.impressions * 1000 : 0;
  o.ctr = o.impressions ? o.clicks / o.impressions * 100 : 0;
  o.cpc = o.clicks ? o.spend / o.clicks : 0;
  o.cpa = o.conversions ? o.spend / o.conversions : 0;
  // Platform-reported metrics from the Google & Meta Ads Metrics sheet (Dev Notes, green rows).
  o.freq = o.reach ? o.impressions / o.reach : 0;
  o.cvr = o.clicks ? o.conversions / o.clicks * 100 : 0;
  o.cpLead = o.pLeads ? o.spend / o.pLeads : 0;
  o.cpp = o.purchases ? o.spend / o.purchases : 0;
  o.pRoas = o.spend ? o.convValue / o.spend : 0;
  o.engRate = o.impressions ? o.engagements / o.impressions * 100 : 0;
  o.cpe = o.engagements ? o.spend / o.engagements : 0;
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
      reach: Math.round(a.base.reach * f.reach),
      clicks: Math.round(a.base.clicks * f.clicks),
      engagements: Math.round(a.base.engagements * f.engagements),
      pLeads: Math.round(a.base.pLeads * f.pLeads),
      purchases: Math.round(a.base.purchases * f.purchases),
      convValue: a.base.convValue * f.convValue,
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
// SEO number formatting: whole numbers stay whole, others get one decimal ("52.5%").
function dashNum1(n) { const v = Math.round(Number(n || 0) * 10) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); }
function dashPctTxt(n) { return `${dashNum1(n)}%`; }
const DASH_SEO_TEXT = { on: 't-success', off: 't-warning', critical: 't-error' };
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
      { key: 'perf', title: 'Performance (Cost per Conversion)', options: [['good', 'Excellent'], ['mid', 'Average'], ['bad', 'Bad']] },
      { key: 'seo', title: 'SEO Status', options: [['on', 'On track'], ['off', 'Off track'], ['critical', 'Critical'], ['none', 'Not on SEO Cloud']] }
    ],
    refresh: () => { pager('dash-managed').page = 1; dashRefreshManaged(); }
  },
  attention: {
    store: () => state.ui.dashAttFilter,
    groups: () => [
      { key: 'type', title: 'Issue Status', options: ['Performance Review', 'SEO Critical', 'SEO Off Track', 'No Account Linked', 'Integration Error', 'Token Expired', 'Unlinked Ad Accounts', 'CRM Set-up'].map(t => [t, t]) },
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
  },
  seo: {
    store: () => state.ui.dashSeoFilter,
    groups: () => [
      { key: 'intent', title: 'Search Intent', options: Object.entries(SEO_INTENTS) },
      { key: 'difficulty', title: 'Difficulty', options: SEO_DIFFICULTY.map(d => [d, d]) },
      { key: 'group', title: 'Keyword Group', options: (seoProject(state.ctx)?.groups || []).map(g => [g.name, g.name]) }
    ],
    refresh: () => { pager('dash-seo').page = 1; dashSeoRefreshTable(); }
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
  // SEO Cloud projects below their top-10 target (status rule in seoStatus()).
  seoPortfolio(list).rows.filter(x => x.stats.status.key !== 'on').forEach(({ ws, stats }) => items.push({
    client: ws.name, type: stats.status.key === 'critical' ? 'SEO Critical' : 'SEO Off Track', priority: stats.status.key === 'critical' ? 'High' : 'Medium',
    desc: `${dashPctTxt(stats.top10Pct)} of keywords in top 10 vs ${dashPctTxt(stats.target)} target (${dashNum1(stats.status.gap)} pts below).`,
    cta: 'View SEO', action: `openWorkspace('${ws.id}','dashboard',{tab:'seo'})`
  }));
  // Agency CRM auto set-up waiting for the account manager (provided by crm.js when loaded).
  if (typeof crmPendingSetups === 'function') {
    (crmPendingSetups() || []).filter(x => x.pendingInvites > 0).forEach(x => items.push({
      client: x.wsName, type: 'CRM Set-up', priority: 'Medium',
      desc: `${x.pendingInvites} client invite${x.pendingInvites === 1 ? '' : 's'} awaiting approval · ${x.stepsDone} of ${x.stepsTotal} set-up steps done.`,
      cta: 'Review set-up', action: `typeof crmOpenSetup === 'function' ? crmOpenSetup('${q(x.wsId)}') : navigate('team', { tab: 'clients' })`
    }));
  }
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
      ${dashSeoPortfolioCard()}
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
  const seoBehind = seoPortfolio(list).rows.filter(x => x.stats.status.key !== 'on').length;
  return `<div class="banner banner-warning dash-banner">
    <i data-lucide="triangle-alert"></i>
    <div><div class="banner-title">Attention Required</div><div class="banner-text">${missing} account${missing === 1 ? '' : 's'} missing platform links, ${impacting} impacting overall performance${seoBehind ? `, ${seoBehind} SEO project${seoBehind === 1 ? '' : 's'} below target` : ''}.</div></div>
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

// SEO Portfolio: SEO Cloud health across the managed workspaces (status rule in seoStatus()).
const DASH_SEO_SEGS = [['on', 'On track', 'onTrack', 'var(--success-pill)'], ['off', 'Off track', 'offTrack', 'var(--warning-pill)'], ['critical', 'Critical', 'critical', 'var(--error-pill)']];
function dashSeoPortfolioCard() {
  const s = seoPortfolio(dashAgencyWorkspaces());
  const tip = 'Client workspaces with SEO Cloud connected. Status compares the share of keywords in the top 10 with the contracted target: On track at or above target, Off track less than 5 points below, Critical 5 or more points below.';
  if (!s.clients) {
    return `<div class="card dash-metric dash-seo-port">
      <div class="kpi-title">SEO Portfolio ${infoTip(tip)}</div>
      <div class="kpi-value t-muted">0</div><div class="kpi-sub">No clients on SEO Cloud yet.</div>
    </div>`;
  }
  const bar = DASH_SEO_SEGS.filter(([, , k]) => s[k]).map(([key, label, k, color]) =>
    `<span style="width:${(s[k] / s.clients * 100).toFixed(2)}%;background:${color}" title="${esc(label)}: ${s[k]}"></span>`).join('');
  const gap = Math.round((s.avgTop10Pct - s.avgTarget) * 10) / 10;
  const avgStatus = seoStatus(s.avgTop10Pct, s.avgTarget);
  return `<div class="card dash-metric dash-seo-port">
    <div class="kpi-title">SEO Portfolio ${infoTip(tip)}</div>
    <div class="kpi-value">${s.clients} <span class="dash-kpi-unit">client${s.clients === 1 ? '' : 's'} on SEO Cloud</span></div>
    <div class="dash-stack" role="img" aria-label="${s.onTrack} on track, ${s.offTrack} off track, ${s.critical} critical">${bar}</div>
    <div class="dash-stack-legend">${DASH_SEO_SEGS.map(([key, label, k, color]) =>
      `<span><span class="dash-legend-sw" style="background:${color}"></span>${esc(label)} <b>${s[k]}</b></span>`).join('')}</div>
    <div class="dash-seo-port-rows">
      <div class="dash-plat-row"><span>Avg. top 10</span><span class="dash-plat-val"><b class="${DASH_SEO_TEXT[avgStatus.key]}">${dashPctTxt(s.avgTop10Pct)}</b> vs ${dashPctTxt(s.avgTarget)} target <span class="t-muted">(${gap >= 0 ? '+' : ''}${dashNum1(gap)} pts)</span></span></div>
      <div class="dash-plat-row"><span>Keywords tracked</span><span class="dash-plat-val"><b>${fmtNum(s.keywords)}</b> of ${fmtNum(s.contracted)} contracted</span></div>
    </div>
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
  const days = dateRangeDays('agency');
  return dashAgencyWorkspaces().map(w => {
    const t = dashMetrics(w.id, 'agency').total;
    const linked = t.spend > 0;
    const contact = wsPrimaryContact(w.id);
    const services = crmAccounts[w.id]?.services || [];
    return {
      w, t, linked, plats: wsPlatforms(w.id), contact, last: dashLastActivity(w),
      services, budget: services.reduce((s, x) => s + (x.monthlyBudget || 0), 0),
      seo: seoConnected(w.id) ? seoStats(w.id, days) : null,
      q: { cpm: linked ? dashQuality(t.cpm, port.cpm) : '', cpc: linked ? dashQuality(t.cpc, port.cpc) : '', cpa: linked ? dashQuality(t.cpa, port.cpa) : '' }
    };
  });
}

// Managed Accounts columns, in table order. Client and Action are always shown; the rest are in the column picker.
const DASH_MG_COLS = [
  { key: 'platforms', group: 'ads', label: 'Ad Platforms' },
  { key: 'status', group: 'account', label: 'Status' },
  { key: 'spend', group: 'ads', label: 'Combined Spend' },
  { key: 'cpm', group: 'ads', label: 'CPM' },
  { key: 'cpc', group: 'ads', label: 'CPC' },
  { key: 'cpa', group: 'ads', label: 'Cost Per Conversion' },
  { key: 'seoStatus', group: 'seo', label: 'SEO Status', tip: 'SEO Cloud project status: On track at or above the top-10 target, Off track less than 5 points below, Critical 5 or more points below.' },
  { key: 'top10', group: 'seo', label: 'Top 10 %', tip: 'Share of tracked keywords ranking in the top 10 today, against the contracted target.' },
  { key: 'avgPos', group: 'seo', label: 'Avg Position', tip: 'Mean position of keywords ranking in the top 100 (lower is better).' },
  { key: 'services', group: 'crm', label: 'Live Services', tip: 'Live services on the Agency CRM account.' },
  { key: 'budget', group: 'crm', label: 'Monthly Budget', tip: 'Sum of the monthly budgets of every live CRM service (SGD).' },
  { key: 'contact', group: 'account', label: 'Primary Contact' },
  { key: 'last', group: 'account', label: 'Last Activity' }
];
registerColumnPicker('managed', {
  columns: () => DASH_MG_COLS,
  groups: [['ads', 'Ads'], ['seo', 'SEO'], ['crm', 'CRM'], ['account', 'Account']],
  note: 'Client and Action are always shown',
  onChange: 'dashRefreshManaged',
  storageKey: 'galaxis-demo:managed-columns-hidden'
});

function dashManagedCard() {
  return `<div class="card-header">
      <div><h2 class="h-section">Managed Accounts</h2><div class="card-sub">A complete overview of all client accounts currently assigned to you.</div></div>
      <div class="row">
        <div class="search dash-search"><input class="input" placeholder="Search client or contact" value="${esc(state.ui.dashMgrSearch)}" oninput="dashManagedSearch(this.value)" aria-label="Search managed accounts"><i data-lucide="search"></i></div>
        ${dashFilterButton('managed')}
        ${colPickerButton('managed')}
      </div>
    </div>
    <div id="dash-managed-body">${dashManagedBody()}</div>`;
}
function dashManagedSearch(v) { state.ui.dashMgrSearch = v; pager('dash-managed').page = 1; dashRefreshManaged(); }
function dashRefreshManaged() { renderRegion('dash-managed-body', dashManagedBody()); }
function dashServiceChips(services, max = 2) {
  if (!services.length) return '<span class="t-muted">—</span>';
  const names = services.map(x => x.type);
  const more = names.length > max ? `<span class="more-count" title="${esc(names.slice(max).join(', '))}">+${names.length - max}</span>` : '';
  return `<span class="chips dash-nowrap">${names.slice(0, max).map(n => `<span class="chip">${esc(n)}</span>`).join('')}${more}</span>`;
}
function dashManagedBody() {
  const term = state.ui.dashMgrSearch.trim().toLowerCase();
  const f = state.ui.dashMgrFilter;
  let rows = dashManagedRows().filter(r => {
    if (term && !`${r.w.name} ${r.contact ? r.contact.email + ' ' + r.contact.name : 'unassigned'}`.toLowerCase().includes(term)) return false;
    if (f.status.length && !f.status.includes(r.w.status)) return false;
    if (f.platform.length && !f.platform.some(p => p === 'none' ? !r.plats.length : r.plats.includes(p))) return false;
    if (f.perf.length && !f.perf.includes(r.q.cpa)) return false;
    if (f.seo.length && !f.seo.includes(r.seo ? r.seo.status.key : 'none')) return false;
    return true;
  });
  const statusRank = { attention: 0, new: 1, active: 2, inactive: 3 };
  const seoRank = { critical: 0, off: 1, on: 2 };
  // Workspaces without data ("—") always sort last, whichever direction.
  const asc = (state.sorts['dash-managed'] || {}).dir === 'asc';
  const num = v => v || (asc ? Infinity : -1);
  const miss = v => v === null || v === undefined ? (asc ? Infinity : -Infinity) : v;
  rows = applySort(rows, 'dash-managed', {
    name: r => r.w.name.toLowerCase(), platforms: r => r.plats.length, status: r => statusRank[r.w.status],
    spend: r => num(r.t.spend), cpm: r => num(r.t.cpm), cpc: r => num(r.t.cpc), cpa: r => num(r.t.cpa),
    seoStatus: r => miss(r.seo ? seoRank[r.seo.status.key] : null), top10: r => miss(r.seo ? r.seo.top10Pct : null),
    avgPos: r => miss(r.seo ? r.seo.avgPos : null), services: r => num(r.services.length), budget: r => num(r.budget),
    contact: r => r.contact ? r.contact.email : '~', last: r => r.last
  });
  const total = rows.length;
  const page = paginate(rows, 'dash-managed', 10);
  const fn = 'dashRefreshManaged';
  const cols = DASH_MG_COLS.filter(c => colVisible('managed', c.key));
  const th = c => `<th${c.tip ? ` title="${esc(c.tip)}"` : ''}>${sortHeader('dash-managed', c.key, c.label, fn)}</th>`;
  const dash = '<span class="t-muted">—</span>';
  const money = (r, k) => r.linked ? dashDot(fmtMoney(r.t[k], 2), r.q[k]) : dash;
  const cell = (r, k) => {
    switch (k) {
      case 'platforms': return `<div class="chips dash-nowrap">${r.plats.map(p => platformBadge(p)).join('') || '<span class="t-muted">No platform linked</span>'}</div>`;
      case 'status': return statusPill(r.w.status);
      case 'spend': return r.linked ? fmtMoney(r.t.spend) : dash;
      case 'cpm': case 'cpc': case 'cpa': return money(r, k);
      case 'seoStatus': return r.seo ? `<span class="pill pill-sm ${r.seo.status.pill}">${esc(r.seo.status.label)}</span>` : dash;
      case 'top10': return r.seo ? `<b class="${DASH_SEO_TEXT[r.seo.status.key]}">${dashPctTxt(r.seo.top10Pct)}</b><span class="t-muted"> / ${dashPctTxt(r.seo.target)}</span>` : dash;
      case 'avgPos': return r.seo && r.seo.avgPos !== null ? dashNum1(r.seo.avgPos) : dash;
      case 'services': return dashServiceChips(r.services);
      case 'budget': return r.budget ? fmtMoney(r.budget) : dash;
      case 'contact': return r.contact ? `<span class="dash-email" title="${esc(r.contact.name)} · ${esc(r.contact.email)}">${esc(r.contact.email)}</span>` : '<span class="t-muted">Unassigned</span>';
      case 'last': return fmtDate(r.last);
    }
    return '';
  };
  const body = page.map(r => `
    <tr class="clickable" onclick="openWorkspace('${r.w.id}','dashboard')">
      <td class="dash-nowrap"><button type="button" class="dash-name-link" onclick="event.stopPropagation(); openWorkspace('${r.w.id}','dashboard')">${esc(r.w.name)}</button></td>
      ${cols.map(c => `<td class="dash-nowrap">${cell(r, c.key)}</td>`).join('')}
      <td onclick="event.stopPropagation()">${rowMenu(`dash-mm-${r.w.id}`, [
        { label: 'Go to workspace', icon: 'arrow-right', onClick: `openWorkspace('${r.w.id}','dashboard')` },
        ...(r.seo ? [{ label: 'View SEO performance', icon: 'search', onClick: `openWorkspace('${r.w.id}','dashboard',{tab:'seo'})` }] : []),
        { label: 'Organisation settings', icon: 'building-2', onClick: `openWorkspace('${r.w.id}','organisation')` },
        { label: 'Integrations', icon: 'blocks', onClick: `openWorkspace('${r.w.id}','integrations')` }
      ])}</td>
    </tr>`).join('');
  const emptyText = term ? `No workspaces found matching “${esc(state.ui.dashMgrSearch)}”.` : 'No workspaces found matching these filters.';
  return `<div class="table-wrap dash-table-wrap"><table class="table">
      <thead><tr><th>${sortHeader('dash-managed', 'name', 'Client', fn)}</th>${cols.map(th).join('')}<th>Action</th></tr></thead>
      <tbody>${body || `<tr><td colspan="${cols.length + 2}" class="table-empty">${emptyText}</td></tr>`}</tbody>
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
    dashEntSel: [], dashEntType: 'all', dashEntQ: '',
    dashSeoBucket: 'all', dashSeoSearch: '', dashSeoFilter: { intent: [], difficulty: [], group: [] }, dashSeoCollapsed: {}
  });
  pager('dash-ct').page = 1;
  pager('dash-seo', 25).page = 1;
}

// ---------- Tabs: Ad Performance | SEO Performance ----------
// state.params.tab ('ads' | 'seo') deep-links a tab; state.ui.dashTab remembers the last one used, so switching
// workspace (which drops params on the dashboard) keeps the tab. A remembered SEO tab falls back to Ads when the
// new workspace has no SEO Cloud; an explicit ?tab=seo shows the "not connected" state instead.
function dashTab() {
  if (isAgency()) return 'ads';
  const explicit = state.params.tab;
  const t = explicit || state.ui.dashTab || 'ads';
  if (t !== 'seo') return 'ads';
  return explicit || seoConnected(state.ctx) ? 'seo' : 'ads';
}
function dashSetTab(t) {
  state.params = { ...state.params, tab: t };
  state.ui.dashTab = t;
  closeAllPopovers();
  rerender();
}
function dashTabBar(tab, ws) {
  const on = seoConnected(ws.id);
  const btn = (key, icon, label, attrs = '') => `<button type="button" role="tab" aria-selected="${tab === key}" class="page-tab ${tab === key ? 'active' : ''}" onclick="dashSetTab('${key}')" ${attrs}><i data-lucide="${icon}"></i>${label}</button>`;
  return `<div class="page-tabs dash-tabs" role="tablist" aria-label="Dashboard">
    ${btn('ads', 'megaphone', 'Ad Performance')}
    ${on ? btn('seo', 'search', 'SEO Performance') : btn('seo', 'lock', 'SEO Performance', 'data-off title="SEO Cloud is not connected to this workspace"')}
    ${on ? '' : `<button type="button" class="t-link dash-tab-connect" onclick="navigate('integrations')">Connect SEO Cloud<i data-lucide="arrow-right"></i></button>`}
  </div>`;
}

function dashRenderClient() {
  const ws = currentWs();
  if (!ws) return '';
  dashSyncClientState();
  const tab = dashTab();
  if (state.params.tab) state.ui.dashTab = state.params.tab;
  const sub = tab === 'seo' ? 'Keyword rankings from SEO Cloud for this workspace.' : 'Google and Meta advertising performance for this workspace.';
  const header = `<div class="dash-welcome">
      <div><h2 class="h-welcome">Welcome Back, ${esc(ws.name)}</h2><p class="dash-welcome-sub">${sub}</p></div>
      ${dateFilterHTML('client', 'dashRerender')}
    </div>
    ${dashHubPanel(ws)}
    ${dashTabBar(tab, ws)}`;
  if (tab === 'seo') return header + dashRenderSeo(ws);
  if (!dashPlatforms(ws.id).length) return header + dashNoAccountsCard();
  const m = dashMetrics(ws.id, 'client');
  const crm = activeCrm(ws.id);
  return `${header}
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

// =====================================================================
// SEO PERFORMANCE TAB (client dashboard) — SEO Cloud data from seo.js, read-only, in the Figma card style.
// =====================================================================
const DASH_SEO_RULE = 'On track: at or above the target. Off track: below the target by less than 5 points. Critical: 5 or more points below the target.';
function dashSeoDays() { return Math.min(dateRangeDays('client'), SEO_HISTORY_DAYS - 1); }
function dashSeoStats() { return seoStats(state.ctx, dateRangeDays('client')); }
function dashSeoDayLabel(ago) { const d = toDate(seoDayIso(ago)); return `${MONTHS[d.getMonth()].toUpperCase()}-${String(d.getDate()).padStart(2, '0')}`; }

function dashRenderSeo(ws) {
  if (!seoConnected(ws.id)) return dashSeoNotConnected();
  const s = dashSeoStats();
  return `${dashSeoStrip(s)}
    ${dashSectionHead('Position Filter', `Share of tracked keywords in each position band today, with the change since ${fmtDate(seoDayIso(s.days))}. Select a band to filter the keyword table.`)}
    <div class="dash-seo-buckets" id="dash-seo-buckets">${dashSeoBuckets(s)}</div>
    <div class="dash-seo-trend">
      <div class="dash-seo-side">${dashSeoAvgCard(s)}${dashSeoOverviewCard(s)}</div>
      <div class="card dash-seo-chart-card">
        <div class="card-header">
          <div><h2 class="h-section">Average Position Trend</h2><div class="card-sub">Daily average position of keywords in the top 100. Lower is better, so position 1 is at the top.</div></div>
        </div>
        <div class="dash-chart" id="dash-seo-chart"><svg role="img" aria-label="Average position trend"></svg></div>
      </div>
    </div>
    <div class="card dash-seo-kw-card" id="dash-seo-kw">${dashSeoKwCard()}</div>`;
}

function dashSeoNotConnected() {
  return `<div class="card dash-empty-card">
    <div class="dash-empty-icon"><i data-lucide="search"></i></div>
    <h2 class="h-section">SEO Cloud is not connected</h2>
    <p class="t-secondary">Connect SEO Cloud to see keyword rankings, the average position trend and progress against the contracted top-10 target for this workspace.</p>
    <button type="button" class="btn btn-primary" onclick="navigate('integrations')"><i data-lucide="plug"></i>Connect SEO Cloud</button>
  </div>`;
}

// 1. Contract strip
function dashSeoStrip(s) {
  const p = s.project;
  const agency = state.persona !== 'client';
  return `<div class="card dash-seo-strip">
    ${productLogo('seo-cloud', 36)}
    <div class="grow">
      <div class="dash-seo-strip-title"><span class="h-card">SEO Cloud</span><span class="t-muted t-caption">${esc(p.domain)}</span></div>
      <div class="dash-seo-facts"><span><b>${fmtNum(p.contractedKeywords)}</b> keywords contracted</span><span><b>${fmtNum(p.tracked)}</b> tracked</span><span>Target <b>${p.targetTop10Pct}%</b> in top 10</span><span>Last checked ${fmtDateTime(p.lastChecked)}</span></div>
    </div>
    <span class="pill ${s.status.pill}" title="${esc(DASH_SEO_RULE)}">${esc(s.status.label)}</span>
    <button type="button" class="btn btn-outline btn-sm" onclick="dashSeoOpenCloud('open')">Open in SEO Cloud<i data-lucide="external-link"></i></button>
    ${agency ? `<button type="button" class="btn btn-primary btn-sm" onclick="dashSeoOpenCloud('manage')">Manage in SEO Cloud<i data-lucide="external-link"></i></button>` : ''}
  </div>`;
}
function dashSeoOpenCloud(mode) {
  showToast(mode === 'manage' ? 'Opening the keyword manager in SEO Cloud…' : 'Opening this project in SEO Cloud…', 'external-link');
}

// 2. Position Filter cards (clickable filters for the keyword table)
function dashSeoBuckets(s) {
  const sel = state.ui.dashSeoBucket;
  const since = fmtDate(seoDayIso(s.days));
  return s.buckets.map(b => {
    const top10 = b.key === 'top10';
    let delta = '';
    if (b.key !== 'all') {
      // Fewer keywords outside the top 100 is an improvement; more in any top-N band is an improvement.
      const good = b.key === 'over100' ? b.delta < 0 : b.delta > 0;
      delta = b.delta
        ? `<span class="dash-delta ${good ? 'up' : 'down'}" title="${b.delta > 0 ? '+' : ''}${b.delta} keyword${Math.abs(b.delta) === 1 ? '' : 's'} since ${since}">${b.delta > 0 ? '▲' : '▼'} ${Math.abs(b.delta)}</span>`
        : `<span class="dash-delta flat" title="No change since ${since}">–</span>`;
    }
    const value = b.key === 'all' ? fmtNum(b.count) : top10 ? dashPctTxt(s.top10Pct) : `${b.pct}%`;
    const extra = b.key === 'all' ? '<div class="dash-seo-bk-sub">keywords tracked</div>'
      : top10 ? `<div class="dash-seo-goal"><div class="dash-seo-goal-bar" title="${dashPctTxt(s.top10Pct)} in top 10 · target ${s.target}%"><span class="dash-seo-fill-${s.status.key}" style="width:${Math.min(100, s.top10Pct)}%"></span><i style="left:${s.target}%"></i></div><div class="dash-seo-bk-sub">Target ${s.target}%</div></div>` : '';
    return `<button type="button" class="dash-seo-bucket ${sel === b.key ? 'selected' : ''} ${top10 ? 'is-goal' : ''}" aria-pressed="${sel === b.key}" onclick="dashSeoSetBucket('${b.key}')">
      <span class="dash-seo-bk-head"><span class="dash-seo-bk-label">${esc(b.label)}</span><span class="dash-seo-bk-count">(${b.count})</span>${delta}</span>
      <span class="dash-seo-bk-val ${top10 ? DASH_SEO_TEXT[s.status.key] : ''}">${value}</span>
      ${extra}
    </button>`;
  }).join('');
}
function dashSeoSetBucket(key) {
  state.ui.dashSeoBucket = state.ui.dashSeoBucket === key && key !== 'all' ? 'all' : key;
  pager('dash-seo', 25).page = 1;
  renderRegion('dash-seo-buckets', dashSeoBuckets(dashSeoStats()));
  dashSeoRefreshTable();
}

// 3. Average Position + Project Overview, and the trend chart
function dashSeoAvgCard(s) {
  const now = s.avgPos, prev = s.avgPosPrev;
  const ch = now !== null && prev !== null ? Math.round((prev - now) * 10) / 10 : null;   // positive = moved up (better)
  const since = fmtDate(seoDayIso(s.days));
  const sub = ch === null ? 'No earlier data'
    : ch > 0 ? `<span class="dash-delta up">▲ ${dashNum1(ch)}</span> better than ${since}`
    : ch < 0 ? `<span class="dash-delta down">▼ ${dashNum1(-ch)}</span> worse than ${since}`
    : `No change since ${since}`;
  return `<div class="card dash-seo-mini">
    <div class="kpi-title">Average Position ${infoTip('Mean position of the keywords ranking in the top 100 today. Keywords outside the top 100 are left out. Lower is better.')}</div>
    <div class="dash-seo-mini-val">${now === null ? '—' : dashNum1(now)}</div>
    <div class="kpi-sub">${sub}</div>
  </div>`;
}
function dashSeoOverviewCard(s) {
  const g = s.status.gap;
  const pos = `${dashPctTxt(s.top10Pct)} in top 10`;
  const reason = g > 0 ? `${pos} · ${dashNum1(g)} pts below ${s.target}% target` : g < 0 ? `${pos} · ${dashNum1(-g)} pts above ${s.target}% target` : `${pos} · at the ${s.target}% target`;
  return `<div class="card dash-seo-mini">
    <div class="kpi-title">Project Overview ${infoTip(DASH_SEO_RULE)}</div>
    <div class="dash-seo-mini-val ${DASH_SEO_TEXT[s.status.key]}">${esc(s.status.label)}</div>
    <div class="kpi-sub">${esc(reason)}</div>
  </div>`;
}
function dashSeoRenderChart() {
  const wrap = document.getElementById('dash-seo-chart');
  if (!wrap || !seoConnected(state.ctx)) return;
  const s = dashSeoStats();
  const p = s.project;
  const vals = s.series.map(x => x.avg).filter(v => v !== null);
  if (!vals.length) { wrap.innerHTML = emptyState('chart-line', 'No ranked keywords yet', 'The trend appears once keywords rank in the top 100.'); return; }
  const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
  const step = [1, 2, 5, 10, 20, 25, 50].find(st => (max - min) / st <= 6) || 50;
  const lo = Math.max(0, Math.floor(min / step) * step), hi = Math.max(lo + step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const n = p.keywords.length || 1;
  dashLineChart(wrap, {
    id: 'dash-seo', invert: true, lo, hi, ticks, fmtAxis: v => String(v),
    series: s.series.map(x => ({ d: toDate(x.date), v: x.avg === null ? hi : x.avg })),
    tip: i => {
      const ago = s.days - i;
      const inTop10 = p.keywords.filter(k => { const v = seoPosAt(k, ago); return v !== null && v <= 10; }).length;
      const x = s.series[i];
      return `<div class="dash-tip-date">${fmtDate(x.date)}</div>
        <div class="dash-tip-row on"><span>Avg. position</span><b>${x.avg === null ? '—' : dashNum1(x.avg)}</b></div>
        <div class="dash-tip-row"><span>In top 10</span><b>${inTop10} (${dashPctTxt(inTop10 / n * 100)})</b></div>`;
    }
  });
}

// 4. Keyword table (read-only)
const DASH_SEO_COLS = [
  { key: 'urls', group: 'details', label: 'Ranking URL' },
  { key: 'volume', group: 'details', label: 'Volume' },
  { key: 'intent', group: 'details', label: 'Search Intent' },
  { key: 'difficulty', group: 'details', label: 'Difficulty' },
  { key: 'history', group: 'rank', label: 'History' },
  { key: 'baseline', group: 'rank', label: 'Baseline' },
  { key: 'days', group: 'rank', label: 'Previous 6 days' }
];
const DASH_SEO_DIFF_DOT = { Easy: 'good', Moderate: 'mid', Hard: 'bad' };
registerColumnPicker('seo-keywords', {
  columns: () => DASH_SEO_COLS,
  groups: [['details', 'Keyword details'], ['rank', 'Rankings']],
  note: 'Keyword and the latest day are always shown',
  onChange: 'dashSeoRefreshTable',
  storageKey: 'galaxis-demo:seo-keyword-columns-hidden'
});

function dashSeoKwCard() {
  const mode = state.ui.dashSeoView;
  return `<div class="card-header">
      <div><h2 class="h-section">Keywords</h2><div class="card-sub">Rankings from SEO Cloud (read-only). Daily positions are green when better than the baseline and red when worse.</div></div>
      <div class="dash-seo-view"><span>View mode</span><div class="seg" role="tablist">${[['group', 'Group'], ['list', 'List']].map(([k, l]) => `<button type="button" role="tab" class="${mode === k ? 'active' : ''}" onclick="dashSeoSetView('${k}')">${l}</button>`).join('')}</div></div>
    </div>
    <div class="dash-ct-toolbar">
      <div class="search grow"><input class="input" placeholder="Search keywords or groups" value="${esc(state.ui.dashSeoSearch)}" oninput="dashSeoSearchInput(this.value)" aria-label="Search keywords"><i data-lucide="search"></i></div>
      ${dashFilterButton('seo')}
      ${colPickerButton('seo-keywords')}
    </div>
    <div id="dash-seo-body">${dashSeoBody()}</div>`;
}
function dashSeoRefreshTable() { renderRegion('dash-seo-body', dashSeoBody()); }
function dashSeoSearchInput(v) { state.ui.dashSeoSearch = v; pager('dash-seo', 25).page = 1; dashSeoRefreshTable(); }
function dashSeoSetView(m) { state.ui.dashSeoView = m; pager('dash-seo', 25).page = 1; renderRegion('dash-seo-kw', dashSeoKwCard()); }
function dashSeoToggleGroup(name) { const c = state.ui.dashSeoCollapsed; c[name] = !c[name]; dashSeoRefreshTable(); }
function dashSeoExpandAll(open) {
  state.ui.dashSeoCollapsed = open ? {} : Object.fromEntries((seoProject(state.ctx)?.groups || []).map(g => [g.name, true]));
  pager('dash-seo', 25).page = 1;
  dashSeoRefreshTable();
}

function dashSeoRows() {
  const p = seoProject(state.ctx);
  const u = state.ui, f = u.dashSeoFilter;
  const b = SEO_BUCKETS.find(x => x.key === u.dashSeoBucket) || SEO_BUCKETS[0];
  const term = u.dashSeoSearch.trim().toLowerCase();
  return p.keywords.filter(k => seoInBucket(seoPosAt(k, 0), b)
    && (!term || `${k.term} ${k.group}`.toLowerCase().includes(term))
    && (!f.intent.length || k.intent.some(i => f.intent.includes(i)))
    && (!f.difficulty.length || f.difficulty.includes(k.difficulty))
    && (!f.group.length || f.group.includes(k.group)));
}

// History sparkline over the selected range; inverted y-axis (position 1 at the top). Unranked days sit at the bottom.
function dashSeoSpark(k, days) {
  const vals = [];
  for (let ago = days; ago >= 0; ago--) { const v = seoPosAt(k, ago); vals.push(v === null ? 101 : v); }
  const W = 96, H = 28, pad = 3;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 4) { const mid = (hi + lo) / 2; lo = mid - 2; hi = mid + 2; }
  const x = i => pad + i * (W - 2 * pad) / Math.max(1, vals.length - 1);
  const y = v => pad + (v - lo) / (hi - lo) * (H - 2 * pad);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const fmt = v => v > 100 ? 'not ranked' : `#${v}`;
  const last = vals[vals.length - 1];
  return `<svg class="dash-seo-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Position history: ${fmt(vals[0])} to ${fmt(last)}"><title>${fmt(vals[0])} → ${fmt(last)} over ${days} days</title>
    <polyline points="${pts}" fill="none" stroke="#398FF7" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="2.2" fill="#398FF7"/></svg>`;
}
// Day cell tint: better (green) or worse (red) than the baseline, or than the previous day when there is no baseline.
function dashSeoDayClass(k, ago) {
  const v = seoPosAt(k, ago);
  const ref = k.baseline !== null ? k.baseline : seoPosAt(k, ago + 1);
  if (v === null && ref === null) return '';
  if (v === null) return 'dash-seo-worse';
  if (ref === null || v < ref) return 'dash-seo-better';
  return v > ref ? 'dash-seo-worse' : '';
}

function dashSeoBody() {
  const p = seoProject(state.ctx);
  const u = state.ui;
  const days = dashSeoDays();
  const fn = 'dashSeoRefreshTable';
  // Positions sort with unranked keywords last, whichever the direction.
  const asc = (state.sorts['dash-seo'] || {}).dir === 'asc';
  const pos = v => v === null || v === undefined ? (asc ? Infinity : -Infinity) : v;
  const rows = applySort(dashSeoRows(), 'dash-seo', {
    term: k => k.term, volume: k => k.volume, difficulty: k => SEO_DIFFICULTY.indexOf(k.difficulty),
    baseline: k => pos(k.baseline), latest: k => pos(seoPosAt(k, 0))
  });
  const dayAgos = (colVisible('seo-keywords', 'days') ? [6, 5, 4, 3, 2, 1] : []).concat([0]);
  const cols = DASH_SEO_COLS.filter(c => c.key !== 'days' && colVisible('seo-keywords', c.key));
  const ncols = 1 + cols.length + dayAgos.length;
  const grouped = u.dashSeoView === 'group';

  // Paging units: keywords, plus one unit per collapsed group (its header). Expanded group headers are drawn
  // above the first keyword of the group on each page.
  const groups = grouped ? p.groups.map(g => ({ g, rows: rows.filter(k => k.group === g.name) })).filter(x => x.rows.length) : [];
  const units = grouped ? groups.flatMap(x => u.dashSeoCollapsed[x.g.name] ? [{ hdr: x }] : x.rows.map(k => ({ k, grp: x }))) : rows.map(k => ({ k }));
  const total = units.length;
  const page = paginate(units, 'dash-seo', 25);

  const sortable = { term: 'Keyword', volume: 'Volume', difficulty: 'Difficulty', baseline: 'Baseline' };
  const thCls = { volume: 'num', baseline: 'num', urls: 'num' };
  const head = `<th>${sortHeader('dash-seo', 'term', 'Keyword', fn)}</th>`
    + cols.map(c => `<th class="${thCls[c.key] || ''}">${sortable[c.key] ? sortHeader('dash-seo', c.key, c.label, fn) : esc(c.label)}</th>`).join('')
    + dayAgos.map(ago => `<th class="dash-seo-day ${ago === 0 ? 'dash-seo-latest' : ''}" title="${fmtDate(seoDayIso(ago))}">${ago === 0 ? sortHeader('dash-seo', 'latest', dashSeoDayLabel(0), fn) : dashSeoDayLabel(ago)}</th>`).join('');

  const dash = '<span class="t-muted">–</span>';
  const cell = (k, key) => {
    switch (key) {
      case 'urls': return `<span class="dash-seo-url ${k.rankingUrls ? '' : 't-muted'}" title="${k.rankingUrls} ranking URL${k.rankingUrls === 1 ? '' : 's'}"><i data-lucide="link"></i>${k.rankingUrls}</span>`;
      case 'volume': return fmtNum(k.volume);
      case 'intent': return `<span class="dash-seo-intents">${k.intent.map(i => `<span class="dash-seo-intent" title="${esc(SEO_INTENTS[i])}">${i}</span>`).join('')}</span>`;
      case 'difficulty': return `<span class="metric-dot ${DASH_SEO_DIFF_DOT[k.difficulty]}">${esc(k.difficulty)}</span>`;
      case 'history': return dashSeoSpark(k, days);
      case 'baseline': return k.baseline === null ? `<span class="t-muted" title="Not in the top 100 when the keyword was added">–</span>` : k.baseline;
    }
    return '';
  };
  const kwRow = k => `<tr>
      <td class="dash-seo-kwcell"><span class="dash-seo-cc" title="${k.country === 'SG' ? 'Singapore' : esc(k.country)}">${esc(k.country)}</span><span class="dash-seo-term">${esc(k.term)}</span></td>
      ${cols.map(c => `<td class="${thCls[c.key] || ''} dash-nowrap">${cell(k, c.key)}</td>`).join('')}
      ${dayAgos.map(ago => { const v = seoPosAt(k, ago); return `<td class="dash-seo-day ${dashSeoDayClass(k, ago)}">${v === null ? dash : v}</td>`; }).join('')}
    </tr>`;
  const grpRow = (x, cont) => {
    const open = !u.dashSeoCollapsed[x.g.name];
    return `<tr class="dash-seo-grow"><td colspan="${ncols}"><div class="dash-seo-ghead">
      <button type="button" class="dash-seo-gtoggle" aria-expanded="${open}" onclick="dashSeoToggleGroup('${q(x.g.name)}')"><i data-lucide="chevron-${open ? 'down' : 'right'}"></i><b>${esc(x.g.name)}</b><span class="t-muted">(${x.rows.length})</span></button>
      <span class="dash-seo-gdate">${cont ? 'continued · ' : ''}Updated on ${fmtDate(x.g.updatedAt)}</span>
    </div></td></tr>`;
  };
  let lastGrp = null;
  const body = page.map(un => {
    if (un.hdr) { lastGrp = un.hdr; return grpRow(un.hdr, false); }
    let out = '';
    if (grouped && un.grp !== lastGrp) { out = grpRow(un.grp, un.grp.rows[0] !== un.k); lastGrp = un.grp; }
    return out + kwRow(un.k);
  }).join('');

  const u2 = state.ui;
  const bucket = SEO_BUCKETS.find(b => b.key === u2.dashSeoBucket);
  const meta = `<div class="dash-seo-meta">
      <span>Total Keywords: <span class="chip chip-dark">${rows.length}</span>${rows.length !== p.keywords.length ? `<span class="t-muted"> of ${p.keywords.length}</span>` : ''}</span>
      ${bucket && bucket.key !== 'all' ? `<span class="dash-drill">Position: <b>${esc(bucket.label)}</b><button type="button" class="chip-remove" onclick="dashSeoSetBucket('all')" aria-label="Clear position filter"><i data-lucide="x"></i></button></span>` : ''}
      ${grouped && groups.length ? `<span class="dash-seo-meta-right"><button type="button" class="t-link" onclick="dashSeoExpandAll(true)">Expand all</button><span class="t-muted">·</span><button type="button" class="t-link" onclick="dashSeoExpandAll(false)">Collapse all</button></span>` : ''}
    </div>`;
  const empty = `<tr><td colspan="${ncols}" class="table-empty">No keywords match these filters.</td></tr>`;
  // 25 per page by default for keywords; the shared bar offers 10 / 20 / 50, so add 25 to its options.
  const pg = pager('dash-seo', 25);
  const bar = paginationBar('dash-seo', total, fn).replace('<option value="50"', `<option value="25" ${pg.perPage === 25 ? 'selected' : ''}>25</option><option value="50"`);
  return `${meta}
    <div class="table-wrap dash-table-wrap dash-seo-wrap"><table class="table dash-seo-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body || empty}</tbody>
    </table></div>
    ${bar}`;
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

// Fixed rows, as in the V2 prototype: one card with three sections of three rows, every row the same height.
const DASH_HUB_OOM = ['crm-lite', 'aurix', 'seo-cloud'];
const DASH_HUB_LANE_ICON = { crm: 'contact', chat: 'message-circle', calls: 'phone' };
const DASH_HUB_EMPTY = { crm: 'No CRM', chat: 'No chat', calls: 'No tracker' };

// One connected product per lane (PRODUCT_LANES in core.js), so each Connections row shows at most one product.
function dashHubLanes(wsId) {
  const entries = wsProducts(wsId);
  return Object.entries(PRODUCT_LANES).map(([key, l]) => {
    const pid = l.ids().find(id => entries[id]);
    return { key, label: l.label, noun: l.noun, icon: DASH_HUB_LANE_ICON[key], hit: pid ? { pid, e: entries[pid] } : null };
  });
}

// Status pill for a Connections row (V2 style: Connected / Error / Pending setup / Disabled / Not connected).
function dashHubPill(e) {
  const [color, label] = dashEntryStatus(e);
  const cls = { green: 'dash-hub-pill-green', red: 'dash-hub-pill-red', orange: 'dash-hub-pill-orange', grey: 'dash-hub-pill-grey' }[color];
  return `<span class="dash-hub-tag ${cls}">${color === 'green' ? '<i data-lucide="check"></i>' : ''}${esc(label)}</span>`;
}

function dashHubSection(icon, title, sub, rows, extra = '') {
  return `<div class="dash-hub-section">
    <div class="dash-hub-card-head">
      <span class="dash-hub-head-icon"><i data-lucide="${icon}"></i></span>
      <div class="grow"><div class="h-card">${esc(title)}</div><div class="dash-hub-card-sub">${esc(sub)}</div></div>
      ${extra}
    </div>
    <div class="dash-hub-rows">${rows}</div>
  </div>`;
}

function dashHubPanel(ws) {
  if (!ws) return '';
  const entries = wsProducts(ws.id);
  const open = state.ui.dashHubOpen;
  const live = e => !!e && e.status === 'connected' && e.active;
  const needsFix = e => !!e && (e.status === 'error' || e.status === 'pending');
  const link = (label, onclick, icon = 'arrow-right') => `<button type="button" class="t-link dash-hub-action" onclick="${onclick}">${esc(label)}<i data-lucide="${icon}"></i></button>`;

  // OOm Products: always the same three rows.
  const oomRows = DASH_HUB_OOM.map(pid => {
    const p = productById(pid);
    const e = entries[pid];
    const alert = live(e) ? dashProductAlerts(ws.id, pid) : null;
    const action = live(e) ? link('Open', `dashOpenProduct('${pid}')`, p.category === 'CRM' ? 'arrow-right' : 'external-link')
      : link(!e ? 'Connect' : needsFix(e) ? 'Fix' : 'Enable', `dashIntegAction('${pid}', '${needsFix(e) ? 'config' : 'about'}')`);
    return `<div class="dash-hub-row">
      ${productLogo(pid, 30)}
      <div class="dash-hub-main"><span class="dash-hub-name">${esc(p.name)}</span>${alert ? `<span class="pill pill-sm ${alert.cls}">${esc(alert.text)}</span>` : live(e) ? '' : dashHubPill(e)}</div>
      ${action}
    </div>`;
  }).join('');

  // Quick Links.
  const crm = activeCrm(ws.id);
  const links = [
    { icon: 'contact', label: 'View Leads', action: crm ? 'Open' : 'Connect CRM', go: crm ? "navigate('leads')" : "navigate('integrations')" },
    { icon: 'blocks', label: 'Manage Integrations', action: 'Manage', go: "navigate('integrations')" },
    { icon: 'building-2', label: 'Organisation Settings', action: 'Configure', go: "navigate('organisation')" }
  ];
  const linkRows = links.map(l => `<div class="dash-hub-row">
      <span class="dash-hub-icon"><i data-lucide="${l.icon}"></i></span>
      <div class="dash-hub-main"><span class="dash-hub-name">${esc(l.label)}</span></div>
      ${link(l.action, l.go)}
    </div>`).join('');

  // Connections: CRM, Automated Chat, Call Tracking — one product each.
  const laneRows = dashHubLanes(ws.id).map(l => {
    const h = l.hit;
    const action = !h ? link('Connect', "navigate('integrations')")
      : link(needsFix(h.e) ? 'Fix now' : 'Manage', `dashIntegAction('${h.pid}', '${needsFix(h.e) ? 'config' : 'about'}')`);
    return `<div class="dash-hub-row">
      <span class="dash-hub-icon"><i data-lucide="${l.icon}"></i></span>
      <div class="dash-hub-main dash-hub-stack"><span class="dash-hub-lane">${esc(l.label)}</span>
        <span class="dash-hub-line"><span class="dash-hub-name">${h ? esc(productById(h.pid).name) : esc(DASH_HUB_EMPTY[l.key])}</span>${dashHubPill(h && h.e)}</span></div>
      ${action}
    </div>`;
  }).join('');

  // Header summary covers only the products shown in the panel.
  const shown = [...new Set([...DASH_HUB_OOM, ...Object.values(PRODUCT_LANES).flatMap(l => l.ids())])];
  const summary = [];
  DASH_HUB_OOM.forEach(pid => { const a = live(entries[pid]) && dashProductAlerts(ws.id, pid); if (a) summary.push({ text: `${productById(pid).name}: ${a.text}`, cls: a.cls, go: `dashOpenProduct('${pid}')` }); });
  shown.forEach(pid => {
    const e = entries[pid];
    if (e?.status === 'error') summary.push({ text: `${productById(pid).name}: Error`, cls: 'pill-red', go: `dashIntegAction('${pid}', 'config')` });
    if (e?.status === 'pending') summary.push({ text: `${productById(pid).name}: Pending setup`, cls: 'pill-orange', go: `dashIntegAction('${pid}', 'config')` });
  });
  const activeCount = shown.filter(pid => live(entries[pid])).length;

  return `<section class="card dash-hub" id="dash-hub" aria-label="Products and connections">
    <div class="dash-hub-head">
      <div><h2 class="h-card">Products &amp; Connections</h2>
        <div class="card-sub">${activeCount} active product${activeCount === 1 ? '' : 's'} connected to ${esc(ws.name)}.</div></div>
      <div class="dash-hub-head-right">
        ${summary.map(x => `<button type="button" class="pill pill-sm ${x.cls} dash-hub-pill" onclick="${x.go}">${esc(x.text)}</button>`).join('')}
        <button type="button" class="kebab dash-hub-toggle" onclick="dashToggleHub()" aria-expanded="${open}" aria-controls="dash-hub-body" title="${open ? 'Hide' : 'Show'} products and connections"><i data-lucide="chevron-${open ? 'up' : 'down'}"></i></button>
      </div>
    </div>
    ${open ? `<div class="dash-hub-body" id="dash-hub-body">
      ${dashHubSection('star', 'OOm Products', 'Your connected suite apps', oomRows)}
      ${dashHubSection('compass', 'Quick Links', 'Common workspace actions', linkRows)}
      ${dashHubSection('link', 'Connections', 'External services & integrations', laneRows, link('View all', "navigate('integrations')"))}
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
  const budget = Math.round(wsAdBudget(ws.id) * m.days / 30);
  const used = budget ? Math.round(t.spend / budget * 100) : 0;
  const unique = Math.round(t.impressions * (0.6 + dashRng(`${ws.id}:reach`)() * 0.12));
  const g = m.byPlatform.google, mt = m.byPlatform.meta;
  const convShare = g && t.conversions ? Math.round(g.conversions / t.conversions * 100) : 0;
  const convSub = g ? `<b>${convShare}%</b> from Google Ads` : '<b>100%</b> from Meta Ads';
  const cpaSub = g && mt ? `Google <b>${fmtMoney(g.cpa, 2)}</b> • Meta <b>${fmtMoney(mt.cpa, 2)}</b>` : `Across ${g ? 'Google' : 'Meta'} Ads`;
  const warn = used >= 100 ? 'dash-bad' : used >= 85 ? 'dash-warn' : '';
  const plats = dashPlatforms(ws.id).map(pl => PLATFORM_NAME[pl]).join(' and ');
  return `${dashSectionHead('Ad Performance', `Platform-reported results from ${plats} Ads for the selected dates.`)}
  <div class="grid-5 dash-kpis">
    ${dashKpi('Total Ad Spend', 'Total advertising spend reported by connected ad platforms.', fmtMoney(t.spend),
      `of <b>${fmtMoney(budget)}</b> budget, <b class="${warn}">${used}%</b> used`,
      `<div class="progress dash-budget"><span class="${warn}" style="width:${Math.min(100, used)}%"></span></div>`)}
    ${dashKpi('Impressions', 'Times ads were served, using the platform-reported impressions metric.', fmtNum(t.impressions), `<b>${fmtNum(unique)}</b> unique users`)}
    ${dashKpi('Clicks', 'Clicks reported by the ad platforms.', fmtNum(t.clicks), `CTR <b>${fmtPct(t.ctr)}</b> • Avg. CPC <b>${fmtMoney(t.cpc, 2)}</b>`)}
    ${dashKpi('Platform Conversions', 'Platform-reported conversion actions.', fmtNum(t.conversions), convSub)}
    ${dashKpi('Cost per Conversion', 'Total ad spend divided by platform-reported conversions.', t.conversions ? fmtMoney(t.cpa, 2) : '—', cpaSub)}
  </div>`;
}

// Section header above a KPI row: title + one-line description, optional controls on the right.
function dashSectionHead(title, sub, right = '') {
  return `<div class="dash-section-head"><div><h2 class="h-card">${esc(title)}</h2><div class="card-sub">${esc(sub)}</div></div>${right}</div>`;
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
      ${dashSectionHead('Leads & Revenue', 'Leads, closed revenue and ROAS from your CRM, credited to the ads that drove them.')}
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
    ${dashSectionHead('Leads & Revenue', `Leads and closed revenue from ${crm.name}, credited to your ads by the selected attribution model.`, `<label class="dash-model"><span>Attribution model</span>
        <select class="select" onchange="dashSetModel(this.value)" aria-label="Attribution model">${DASH_MODELS.map(([v, l]) => `<option value="${v}" ${v === model ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        ${infoTip('Multi-Touch gives 40% of the credit to the first touch, 40% to the last touch and splits 20% across the touches in between. First-Touch and Last-Touch give all the credit to one touch.')}
      </label>`)}
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
      ${colPickerButton('campaigns')}
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

// Campaigns and Ads metric columns, in the order of the Google & Meta Ads Metrics sheet (green rows),
// plus V1's Cost Per Conversion and the CRM-attributed columns. tip = the sheet's definition.
// quality: 'low' = lower is better, 'high' = higher is better (coloured dot against the workspace total).
const DASH_CT_COLS = [
  { key: 'spend', group: 'delivery', label: 'Spend', tip: 'Amount spent on your campaign.', fmt: v => fmtMoney(v) },
  { key: 'impressions', group: 'delivery', label: 'Impressions', tip: 'Total number of times the ad was shown on screen.', fmt: v => fmtNum(v) },
  { key: 'reach', group: 'delivery', label: 'Reach', tip: 'Estimated number of unique individuals who saw the ad.', fmt: v => fmtNum(v) },
  { key: 'cpm', group: 'delivery', label: 'CPM', tip: 'The average cost to show the ad 1,000 times.', fmt: v => fmtMoney(v, 2), quality: 'low' },
  { key: 'freq', group: 'delivery', label: 'Frequency', tip: 'Average number of times each unique person saw the ad.', fmt: v => v.toFixed(2) },
  { key: 'clicks', group: 'clicks', label: 'Clicks', tip: 'Number of clicks on links within the ad that direct users to specified destinations (like your website).', fmt: v => fmtNum(v) },
  { key: 'ctr', group: 'clicks', label: 'CTR', tip: 'Percentage of impressions that resulted in a click.', fmt: v => fmtPct(v), quality: 'high' },
  { key: 'cpc', group: 'clicks', label: 'CPC', tip: 'Average cost paid for each link click.', fmt: v => fmtMoney(v, 2), quality: 'low' },
  { key: 'conversions', group: 'conversions', label: 'Conversions', tip: 'An action that a customer takes after interacting with your ad, such as making a purchase, signing up for a newsletter, or calling your business.', fmt: v => fmtNum(v) },
  { key: 'cvr', group: 'conversions', label: 'Conversion Rate', tip: 'Percentage of clicks that successfully resulted in a lead submission.', fmt: v => fmtPct(v), quality: 'high', needs: 'clicks' },
  { key: 'cpa', group: 'conversions', label: 'Cost Per Conversion', tip: 'Total spend divided by platform-reported conversions.', fmt: v => fmtMoney(v, 2), quality: 'low', needs: 'conversions' },
  { key: 'cpLead', group: 'conversions', label: 'Cost Per Lead', tip: 'Average cost required to generate one successful lead.', fmt: v => fmtMoney(v, 2), quality: 'low', needs: 'pLeads' },
  { key: 'cpp', group: 'conversions', label: 'Cost Per Purchase', tip: 'Average cost required to acquire one successful sale.', fmt: v => fmtMoney(v, 2), quality: 'low', needs: 'purchases' },
  { key: 'pRoas', group: 'conversions', label: 'ROAS', tip: 'Revenue generated for every dollar spent on the campaign (platform-reported purchase value ÷ spend).', fmt: v => `${v.toFixed(2)}x`, quality: 'high', needs: 'spend' },
  { key: 'convValue', group: 'conversions', label: 'Conversion Value', tip: 'Total monetary value of the purchases driven by the advertising efforts.', fmt: v => fmtMoney(v) },
  { key: 'engRate', group: 'engagement', label: 'Engagement Rate', tip: 'Percentage of people who interacted with the ad after seeing it.', fmt: v => fmtPct(v), quality: 'high', needs: 'impressions' },
  { key: 'engagements', group: 'engagement', label: 'Engagement', tip: 'Total actions taken on the ad (likes, comments, shares, video views, ad expansions).', fmt: v => fmtNum(v) },
  { key: 'cpe', group: 'engagement', label: 'Cost Per Engagement', tip: 'Average cost for each interaction with the ad.', fmt: v => fmtMoney(v, 2), quality: 'low', needs: 'engagements' }
];
// CRM-attributed columns (CRM mode only). Prefixed "CRM" so they are not confused with platform-reported ROAS.
const DASH_CT_CRM_COLS = [
  { key: 'leads', group: 'crm', label: 'CRM Leads', tip: 'Leads in your CRM attributed to this row under the selected attribution model.', fmt: v => fmtNum(v) },
  { key: 'cpl', group: 'crm', label: 'CRM CPL', tip: 'Spend ÷ CRM-attributed leads.', fmt: v => fmtMoney(v, 2), needs: 'leads' },
  { key: 'revenue', group: 'crm', label: 'CRM Revenue', tip: 'Closed revenue in your CRM credited to this row by the attribution model.', fmt: v => fmtMoney(v) },
  { key: 'roas', group: 'crm', label: 'CRM ROAS', tip: 'CRM-attributed revenue ÷ spend.', fmt: v => `${v.toFixed(2)}x`, needs: 'spend' }
];

// ---------- Column picker (show / hide columns; shared helper in core.js) ----------
// Name, Status and Action are always shown.
registerColumnPicker('campaigns', {
  columns: () => [{ key: 'format', group: 'details', label: 'Ad Format' }].concat(DASH_CT_COLS, activeCrm(state.ctx) ? DASH_CT_CRM_COLS : []),
  groups: [['details', 'Details'], ['delivery', 'Delivery'], ['clicks', 'Clicks'], ['conversions', 'Conversions'], ['engagement', 'Engagement'], ['crm', 'CRM']],
  note: 'Name, Status and Action are always shown',
  onChange: 'dashRefreshCampaignTable',
  storageKey: 'galaxis-demo:campaign-columns-hidden'
});

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
  const metricCols = DASH_CT_COLS.concat(crm ? DASH_CT_CRM_COLS : []);
  rows = applySort(rows, 'dash-ct', {
    name: e => e.name.toLowerCase(), format: e => e.formats[0] || '', status: e => DASH_STATUS_RANK[e.status],
    ...Object.fromEntries(metricCols.map(c => [c.key, e => e[c.key] || 0]))
  });
  const total = rows.length;
  const page = paginate(rows, 'dash-ct', 10);
  const ref = m.total;
  const next = DASH_LEVELS[DASH_LEVELS.indexOf(level) + 1];
  const cols = [['name', DASH_NAME_COL[level]], ['format', 'Ad Format'], ['status', 'Status']].concat(metricCols.map(c => [c.key, c.label]))
    .filter(([c]) => c === 'name' || c === 'status' || colVisible('campaigns', c));
  const colDef = Object.fromEntries(metricCols.map(c => [c.key, c]));
  const fn = 'dashRefreshCampaignTable';
  const head = cols.map(([c, l]) => `<th${colDef[c] ? ` title="${esc(colDef[c].tip)}"` : ''}>${sortHeader('dash-ct', c, l, fn)}</th>`).join('') + (next ? '<th>Action</th>' : '');
  const cell = (e, c) => {
    if (c === 'name') return dashNameCell(e, level);
    if (c === 'format') return dashFormatCell(e.formats);
    if (c === 'status') return statusPill(DASH_STATUS_KEY[e.status], e.status);
    const d = colDef[c];
    if (d.needs && !e[d.needs]) return '<span class="t-muted">—</span>';
    const text = d.fmt(e[c] || 0);
    return d.quality ? dashDot(text, dashQuality(e[c], ref[c], d.quality === 'high')) : text;
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
// Smooth line chart with area fill, axis labels, hover guide and tooltip. Used by Daily Performance and the
// SEO Average Position trend. o: { id, series: [{ d: Date, v }], lo, hi, ticks: [values], fmtAxis(v),
// invert (lo at the top, e.g. ranking positions), tip(i) -> tooltip html, height }
function dashLineChart(wrap, o) {
  if (!wrap) return;
  const svg = wrap.querySelector('svg');
  const series = o.series;
  const n = series.length;
  const W = Math.max(320, wrap.clientWidth || 600), H = o.height || 280;
  const p = { l: 18 + Math.max(...o.ticks.map(v => o.fmtAxis(v).length)) * 7, r: 16, t: 12, b: 34 };
  const iw = W - p.l - p.r, ih = H - p.t - p.b;
  const span = (o.hi - o.lo) || 1;
  const x = i => p.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
  const y = v => o.invert ? p.t + (v - o.lo) / span * ih : p.t + ih - (v - o.lo) / span * ih;
  const ticks = n <= 6 ? series.map((_, i) => i) : Array.from({ length: 6 }, (_, j) => Math.round(j * (n - 1) / 5));
  const lbl = d => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
  const bottom = o.invert ? o.hi : o.lo;
  let out = `<defs><linearGradient id="${o.id}-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#398FF7" stop-opacity=".14"/><stop offset="1" stop-color="#398FF7" stop-opacity="0"/></linearGradient></defs>`;
  o.ticks.forEach(v => {
    out += `<text x="${p.l - 14}" y="${y(v) + 4}" text-anchor="end" class="dash-axis">${o.fmtAxis(v)}</text>`;
    if (v !== bottom) out += `<line x1="${p.l}" x2="${W - p.r}" y1="${y(v)}" y2="${y(v)}" class="dash-grid"/>`;
  });
  out += `<line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${p.t + ih}" class="dash-axis-line"/><line x1="${p.l}" y1="${p.t + ih}" x2="${W - p.r}" y2="${p.t + ih}" class="dash-axis-line"/>`;
  ticks.forEach(i => { out += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="dash-axis">${lbl(series[i].d)}</text>`; });
  const pts = series.map((s, i) => [x(i), y(s.v)]);
  const line = dashSmoothPath(pts, p.t + ih);
  out += `<path d="${line} L ${x(n - 1)} ${p.t + ih} L ${x(0)} ${p.t + ih} Z" fill="url(#${o.id}-area)"/>`;
  out += `<path d="${line}" fill="none" stroke="#398FF7" stroke-width="1.75" stroke-linejoin="round"/>`;
  ticks.forEach(i => { out += `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.5" fill="#66ACFD" stroke="#398FF7" stroke-width="1"/>`; });
  out += `<line class="dash-guide" x1="0" x2="0" y1="${p.t}" y2="${p.t + ih}" stroke="#AEAEAE" stroke-dasharray="3 3" visibility="hidden"/>`;
  out += `<circle class="dash-hover-dot" r="5" fill="#fff" stroke="#398FF7" stroke-width="2" visibility="hidden"/>`;
  out += `<rect class="dash-hover-rect" x="${p.l}" y="${p.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);
  svg.innerHTML = out;
  const rect = svg.querySelector('.dash-hover-rect');
  const guide = svg.querySelector('.dash-guide');
  const dot = svg.querySelector('.dash-hover-dot');
  rect.addEventListener('mousemove', ev => {
    const bb = svg.getBoundingClientRect();
    const px = (ev.clientX - bb.left) * (W / bb.width);
    const i = Math.max(0, Math.min(n - 1, Math.round((px - p.l) / (iw || 1) * (n - 1))));
    guide.setAttribute('x1', pts[i][0]); guide.setAttribute('x2', pts[i][0]); guide.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', pts[i][0]); dot.setAttribute('cy', pts[i][1]); dot.setAttribute('visibility', 'visible');
    dashTip(ev, o.tip(i));
  });
  rect.addEventListener('mouseleave', () => { guide.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); dashTipHide(); });
}
function dashRenderDaily() {
  const wrap = document.getElementById('dash-daily');
  if (!wrap) return;
  const metric = state.ui.dashChartMetric;
  const series = dashDailySeries();
  const fmtV = v => metric === 'spend' ? fmtMoney(v) : fmtNum(Math.round(v));
  const max = dashNiceMax(Math.max(1, ...series.map(s => s[metric])));
  dashLineChart(wrap, {
    id: 'dash-daily', series: series.map(s => ({ d: s.d, v: s[metric] })), lo: 0, hi: max,
    ticks: [0, 1, 2, 3, 4, 5].map(k => max * k / 5), fmtAxis: fmtV,
    tip: i => {
      const s = series[i];
      const row = (k, l, v) => `<div class="dash-tip-row ${k === metric ? 'on' : ''}"><span>${l}</span><b>${v}</b></div>`;
      return `<div class="dash-tip-date">${fmtDate(s.d)}</div>${row('spend', 'Spend (SGD)', fmtMoney(s.spend, 2))}${row('conversions', 'Conversions', fmtNum(s.conversions))}${row('clicks', 'Clicks', fmtNum(s.clicks))}`;
    }
  });
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
  dashResizeTimer = setTimeout(() => { dashRenderDaily(); dashSeoRenderChart(); }, 120);
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
  dashMgrSearch: '', dashMgrFilter: { platform: [], status: [], perf: [], seo: [] },
  dashAttFilter: { type: [], priority: [] },
  dashModel: 'mta', dashChartMetric: 'spend', dashHeatMetric: 'spend',
  dashFpSnap: {}, dashFpCollapsed: {},
  dashCtWs: undefined, dashCtFilter: { platform: [], format: [], status: [] }, dashEntSel: [], dashEntType: 'all', dashEntQ: '', dashCtSearch: '', dashLevel: 'platform', dashDrill: null,
  dashTab: 'ads', dashSeoView: 'group', dashSeoBucket: 'all', dashSeoSearch: '', dashSeoFilter: { intent: [], difficulty: [], group: [] }, dashSeoCollapsed: {}, dashSeoRemoved: {}
});

registerScreen('dashboard', {
  contexts: ['agency', 'client'],
  title: () => 'Dashboard',
  desc: () => '',
  key: () => isAgency() ? 'agency-dashboard' : `client-dashboard-${dashTab()}`,
  render: () => isAgency() ? dashRenderAgency() : dashRenderClient(),
  afterRender: () => {
    dashTipHide();
    if (!isAgency()) { dashRenderDaily(); dashBindHeatmap(); dashSeoRenderChart(); }
  }
});

// Dev screens. Registering these keys makes app.js skip its generic agency-dashboard / client-dashboard entries.
const DASH_DEV_KEYS = ['agency-dashboard', 'client-dashboard-ads', 'client-dashboard-seo'];
registerDevScreen('Agency', 'agency-dashboard', 'Dashboard', () => { state.ctx = null; state.persona = 'agency'; navigate('dashboard'); });
registerDevScreen('Client workspace', 'client-dashboard-ads', 'Dashboard › Ad Performance', () => { state.ctx = devClientCtx(); navigate('dashboard', { tab: 'ads' }); });
registerDevScreen('Client workspace', 'client-dashboard-seo', 'Dashboard › SEO Performance', () => { state.ctx = devClientCtx(); navigate('dashboard', { tab: 'seo' }); });
// app.js lists core pages before module-registered screens; move the dashboard entries back to the top of each group.
document.addEventListener('DOMContentLoaded', () => {
  const mine = DASH_DEV_KEYS.map(k => devScreens.find(d => d.key === k)).filter(Boolean);
  mine.forEach(d => devScreens.splice(devScreens.indexOf(d), 1));
  ['Client workspace', 'Agency'].forEach(g => {
    const at = devScreens.findIndex(d => d.group === g);
    devScreens.splice(at < 0 ? devScreens.length : at, 0, ...mine.filter(d => d.group === g));
  });
  if (document.getElementById('devbar')) renderDevBar();
});

function dashSetAdOnly() {
  const wp = wsProducts(state.ctx);
  Object.keys(wp).forEach(pid => { if (productById(pid)?.category === 'CRM') wp[pid].active = false; });
  render();
}
function dashSetCrmConnected() {
  const wp = wsProducts(state.ctx);
  Object.keys(wp).forEach(pid => { if (pid !== 'crm-lite' && productById(pid)?.category === 'CRM') delete wp[pid]; }); // one CRM per workspace
  wp['crm-lite'] = { ...(wp['crm-lite'] || {}), status: 'connected', active: true, lastSynced: new Date().toISOString() };
  render();
}

// SEO scenarios: set the generator's top-10 share relative to the target (seoProject() regenerates on change).
const DASH_SEO_SCENARIO = { on: 3, off: -2, critical: -8 };
function dashSeoScenario(kind) {
  const cfg = seoProjects[state.ctx];
  if (!cfg) return;
  cfg.scenarioTop10Pct = cfg.targetTop10Pct + DASH_SEO_SCENARIO[kind];
  rerender();
}
// "SEO Cloud not connected": removes the product entry (kept so it can be restored), or adds it back.
// A workspace without an SEO Cloud project gets a placeholder project so the tab can be demoed.
function dashSeoToggleConnected() {
  const id = state.ctx;
  const wp = wsProducts(id);
  state.ui.dashSeoRemoved = state.ui.dashSeoRemoved || {};
  if (seoConnected(id)) {
    state.ui.dashSeoRemoved[id] = wp['seo-cloud'];
    delete wp['seo-cloud'];
  } else {
    wp['seo-cloud'] = state.ui.dashSeoRemoved[id] || { status: 'connected', active: true, lastSynced: new Date().toISOString() };
    Object.assign(wp['seo-cloud'], { status: 'connected', active: true });
    if (!seoProjects[id]) seoProjects[id] = { contractedKeywords: 40, targetTop10Pct: 50, scenarioTop10Pct: 47, startedAt: seoDayIso(30), placeholder: true };
  }
  state.params = { ...state.params, tab: 'seo' };
  render();
}

function dashSimulateCrm() {
  if (typeof crmSimulateConversion === 'function') crmSimulateConversion();
  else showToast('CRM module not loaded', 'triangle-alert');
}

registerDevToggles('agency-dashboard', () => [
  { label: 'Alerts on', active: !state.flags.dashAlertsOff, run: () => { state.flags.dashAlertsOff = false; rerender(); } },
  { label: 'Alerts off', active: !!state.flags.dashAlertsOff, run: () => { state.flags.dashAlertsOff = true; rerender(); } },
  'sep',
  { label: 'Simulate CRM conversion', active: false, run: dashSimulateCrm }
]);
registerDevToggles('client-dashboard-ads', () => {
  const crm = !!activeCrm(state.ctx);
  return [
    { label: 'Ad-only (no CRM)', active: !crm, run: dashSetAdOnly },
    { label: 'CRM connected', active: crm, run: dashSetCrmConnected },
    { label: 'No ad accounts linked', active: !!state.flags.dashNoAccounts, run: () => { state.flags.dashNoAccounts = !state.flags.dashNoAccounts; rerender(); } }
  ];
});
registerDevToggles('client-dashboard-seo', () => {
  const on = seoConnected(state.ctx);
  const key = on ? dashSeoStats().status.key : null;
  return [
    ...(on ? [
      { label: 'On track', active: key === 'on', run: () => dashSeoScenario('on') },
      { label: 'Off track', active: key === 'off', run: () => dashSeoScenario('off') },
      { label: 'Critical', active: key === 'critical', run: () => dashSeoScenario('critical') },
      'sep'] : []),
    { label: 'SEO Cloud not connected', active: !on, run: dashSeoToggleConnected }
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
    updatedAt: '22/10/2026',
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
  - **SEO Portfolio** (added 22/10/2026): clients on SEO Cloud; a stacked bar of On track / Off track / Critical with a legend and counts; the average top-10 % against the average target; total keywords tracked against the contracted total. Built with \`seoPortfolio()\` over the visible workspaces with SEO Cloud connected.
    - **Status rule** (\`seoStatus\`): On track when the top-10 % is at or above target; Off track when it is below target by less than 5 points; Critical when it is 5 or more points below. Example with a 55% target: 55% on track, 52% off track, 50% critical.
  - Overall CPM, CPC and Cost per Conversion cards were removed from the agency dashboard on 21/10/2026. These metrics remain per workspace in the Managed Accounts table.
- **Attention Required list**: Merges V1 triage with V2 pipeline alerts. Each row has a type, a priority (High / Medium / Low) and a one-click CTA. Filtered by issue type and priority (Figma "Attention Account Filter").
  - **Performance Review**: workspace status Attention Required → View Account (High for the first, Medium after that).
  - **Integration Error**: a workspace product in error (High) or pending setup (Medium) → Fix Integration (workspace Integrations).
  - **Token Expired**: an agency master token (Google MCC / Meta Business Manager) that is not valid → Re-authorise (High).
  - **Unlinked Ad Accounts**: one agency-level row for discovered but unlinked ad accounts → Review accounts (agency Integrations › Ad Platforms) (Medium).
  - **No Account Linked**: a workspace with zero linked ad accounts → Link Ad Account (Low).
  - **SEO Critical** (High) and **SEO Off Track** (Medium): an SEO Cloud project below target, e.g. "50% of keywords in top 10 vs 55% target (5 pts below)" → View SEO (opens that workspace's dashboard on the SEO Performance tab).
  - **CRM Set-up** (Medium): an Agency CRM auto set-up with client invites awaiting approval, "N client invites awaiting approval" → Review set-up (the CRM module's set-up checklist; falls back to Team & Access › Client Organisation). Shown only when the CRM module is loaded.
  - The banner adds "N SEO projects below target" when any project is Off track or Critical.
- **Managed Accounts table** (the V1 Client Workspace Directory, with Figma columns): Client, Ad Platforms, Status, Combined Spend, CPM, CPC, Cost Per Conversion, SEO Status, Top 10 %, Avg Position, Live Services, Monthly Budget, Primary Contact, Last Activity, Action.
  - **SEO columns**: SEO Status pill ("—" when the workspace is not on SEO Cloud); Top 10 % as "current / target", coloured by status; Avg Position (mean position of keywords ranking in the top 100).
  - **CRM columns**: Live Services as chips from the Agency CRM account (max 2, then "+N"); Monthly Budget = the sum of every live service's monthly budget (SGD).
  - **Column picker**: show or hide columns, grouped as Ads, SEO, CRM and Account. Client and Action are always shown. Remembered per viewer (prototype: localStorage).
  - The ⋮ menu adds "View SEO performance" for workspaces on SEO Cloud.
  - Coloured dots on CPM / CPC / Cost per Conversion compare each workspace with the portfolio average. Green (Excellent) is at least 10% better; orange (Average) is within -10% to +15%; red (Bad) is more than 15% worse. This replaces V1's heat cells.
  - Search by client or contact.
  - Figma "Managed Account Filter": Ad Platforms, Status, Performance band (on Cost per Conversion) and SEO Status (On track / Off track / Critical / Not on SEO Cloud).
  - Every column is sortable. Rows without SEO or CRM data sort last in both directions. Pagination uses "Showing Per Page".
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
- Is the keyword contract (X keywords, Y% top-10 target) owned by SEO Cloud or by the Agency CRM?
- Should the average position count keywords outside the top 100 as position 100, instead of leaving them out?

### Dev toolbar states
- **Alerts on / Alerts off**: Off hides the banner and empties the Attention list (the healthy state).
- **Simulate CRM conversion**: runs the Agency CRM auto set-up (owned by the CRM module). Shows "CRM module not loaded" when that module is missing.
`
  },
  'client-dashboard-seo': {
    title: '1b. Workspace Dashboard › SEO Performance',
    status: 'Draft',
    author: 'Hannah',
    updatedAt: '22/10/2026',
    notes: `
### Screen Purpose & Objectives
Read-only SEO Cloud results inside the client workspace, next to ad performance, so clients do not need SEO Cloud's own dashboard. Rebuilt from the SEO Cloud dashboard in the Galaxis Figma style. Staff actions (Recheck Data, Recheck Metrics, Keyword Manager, Add) stay in SEO Cloud.

### Key Functional Specifications
- **Availability**: the tab is enabled when SEO Cloud is connected and active for the workspace and an SEO project exists. Otherwise the tab is greyed out with "Connect SEO Cloud" (Integrations); opening it directly shows a "SEO Cloud is not connected" empty state.
- **Contract strip**: "{contracted} keywords contracted · {tracked} tracked · Target {target}% in top 10 · Last checked {date, time}", the status pill, and "Open in SEO Cloud ↗". The agency persona also sees "Manage in SEO Cloud ↗".
- **Status rule** (\`seoStatus\`): **On track** when the top-10 % is at or above target; **Off track** when it is below target by less than 5 points; **Critical** when it is 5 or more points below. Example with a 55% target: 55% on track, 52% off track, 50% critical. Pills: green / orange / red.
- **Position Filter cards**: All, Top 1, Top 3, Top 5, Top 10, Top 30, Top >100. Each shows the count in brackets, the share of tracked keywords as the big value (All shows the count) and the ▲/▼ change in keywords since the start of the date range. Green = improvement; for Top >100 an increase is bad, so it is red. The Top 10 card shows a progress bar with a target marker ("Target 55%"), coloured by status. Cards filter the keyword table (selected card has a primary border; click again or ✕ to return to All).
- **Average Position**: mean position today of the keywords ranking in the top 100 (keywords outside the top 100 are left out), with the change since the start of the range. Lower is better, so a lower number is shown as ▲ better (green).
- **Project Overview**: the status in its colour, with the reason, e.g. "50% in top 10 · 5 pts below 55% target".
- **Average Position Trend**: daily average position over the date range, with an inverted y-axis (position 1 at the top), date labels, a hover tooltip (average position and top-10 share that day), and redraw on resize.
- **Keyword table** (read-only):
  - Header: Keywords, View mode Group | List; toolbar with search (keyword or group), filter (Search Intent, Difficulty, Keyword Group) and the column picker; "Total Keywords: N" (of the total when filtered) above the table.
  - **Group mode**: collapsible group header rows, "Best / Top Brand (21)" and "Updated on {date}", with Expand all / Collapse all.
  - **Columns**: Keyword (country chip "SG" + term), Ranking URL (link icon + count), Volume, Search Intent (round C / L / I / N chips; tooltip names the intent: Commercial, Local, Informational, Navigational), Difficulty (Easy / Moderate / Hard dot), History (sparkline over the date range, inverted y-axis), Baseline (position when added; "–" if it was not in the top 100), then one column per day for the last 7 days ("OCT-16"), with the position or "–".
  - **Day cell colour**: green when better than the baseline, red when worse. With no baseline, the cell is compared with the previous day.
  - Sortable: Keyword, Volume, Difficulty, Baseline and the latest day. Unranked keywords sort last in both directions. In Group mode, rows are sorted within each group.
  - 25 keywords per page by default (Showing Per Page also offers 10 / 20 / 50).
  - Only the Keyword column is pinned; the day columns scroll. There is no Action column.
  - Column picker groups: Keyword details (Ranking URL, Volume, Search Intent, Difficulty) and Rankings (History, Baseline, Previous 6 days). Keyword and the latest day are always shown.
  - Empty state when nothing matches.
- **Date filter** (shared with Ad Performance): sets the trend range, the sparkline range and the comparison point for every ▲/▼ change. History is kept for 120 days.

### Open questions
- Is the keyword contract (X keywords, Y% target) owned by SEO Cloud or by the Agency CRM?
- Should the average position include keywords outside the top 100 as position 100? Today they are left out, which can make the average improve when keywords drop out.
- Should GEO / AI-visibility metrics from SEO Cloud appear on this tab later?
- Should clients see keyword groups that are marked internal-only in SEO Cloud? The prototype shows every group.

### Dev toolbar states
- **Viewing as Agency Admin / Client User** (shared). Client users do not see "Manage in SEO Cloud".
- **On track / Off track / Critical**: sets this workspace's mock top-10 share to target +3, -2 or -8 points; the keyword data regenerates.
- **SEO Cloud not connected**: removes SEO Cloud from the workspace (or adds it back) to show the not-connected state.
`
  },
  'client-dashboard-ads': {
    title: '1. Workspace Dashboard › Ad Performance',
    status: 'In Review',
    author: 'Hannah',
    updatedAt: '21/10/2026',
    notes: `
### Screen Purpose & Objectives
Client-facing workspace dashboard giving a simplified, unified view of Meta and Google Ads performance. Since 22/10/2026 the dashboard has two tabs below the welcome header and Products & Connections panel: **Ad Performance** (this spec) and **SEO Performance** (\`client-dashboard-seo\`). It aims to remove the client's need to log in to the native ad platforms, and it doubles as an inspection view for agency administrators. Layout follows the Figma "Dashboard - Platform / Campaign / Ad Group / Ads" frames.

### Key Functional Specifications (All metrics TBC)
- **Top-Level KPI Cards**: Total Ad Spend (with budget used and a progress bar), Impressions (unique users), Clicks (CTR and average CPC), Platform Conversions (% from Google Ads) and Cost per Conversion (per-platform split). Each card has an ⓘ definition.
  - Exact KPIs are placeholders pending feedback from performance marketing and account management.
  - The budget shown is the workspace monthly budget pro-rated to the selected range.
- **Tabs**: Ad Performance | SEO Performance (page tabs with icons). The active tab is in the route (\`tab: 'ads' | 'seo'\`) and is remembered when switching workspace; a remembered SEO tab falls back to Ad Performance in a workspace without SEO Cloud. Without SEO Cloud the SEO tab is greyed out, with a "Connect SEO Cloud" link to Integrations.
- **Global Event-Based Date Filter**: Filters all dashboard data by the exact date the action (e.g. click or conversion) happened within the selected timeframe, independent of events higher up the funnel.
  - **Prototype note:** the date filter scales mock data to the selected range, and the Daily Performance chart plots one point per day of the range. It does **not** yet filter by event date.
- **CRM mode (from V2)**: shown when the workspace has a connected, active CRM.
  - **Products & Connections panel** (top of the page, from the V2 client home): collapsible card with three columns. one card with three sections in V2 order, three fixed rows each, all rows the same height. OOm Products: CRM - lite, Aurix and SEO Cloud, with outstanding-work badges and Open links (CRM opens Leads), or Connect / Enable / Fix when not live. Quick Links: View Leads, Manage Integrations and Organisation Settings. Connections: CRM, Automated Chat and Call Tracking, one product each (one-per-lane rule), with a status pill and Manage / Fix now / Connect, plus View all. Items needing attention also show as pills in the header, so they stay visible when collapsed. Built from the same data as Integrations.
  - Each KPI row has a section header (title + one-line description): **Ad Performance** for the platform metrics, **Leads & Revenue** for the CRM metrics (with the attribution model on the right).
  - A second row of 5 KPI cards, matching the ad-platform row: Attributed Leads (+ share of platform conversions), Cost per Lead (+ cost per conversion for comparison), Converted Leads (+ conversion rate), Attributed Revenue (+ average deal value) and ROAS (+ ad spend).
  - The table gains Leads, CPL, Revenue and ROAS columns.
  - The **attribution model** selector offers Multi-Touch (40/20/40), First-Touch and Last-Touch. Each model credits leads and revenue differently, so the figures change with the model.
  - **Ad-only mode** (no CRM): those three cards are locked ("Requires CRM"), with a "Connect a CRM to unlock leads, revenue and ROAS" banner linking to Integrations.
- **Hierarchical Campaign Breakdown Table ("Campaigns and Ads")**: Users drill down through Platform → Campaign → Ad Group → Ad to compare key statistics.
  - **Level tabs**: Platform / Campaigns / Ad Groups / Ads.
  - **Drill-down**: clicking a row, or "View …" in the ⋮ menu, opens the next level with a "Filtered for X ✕" badge. Clearing the badge returns to Platform.
  - **Columns**: Name (parent shown above), Ad Format (+N overflow), Status, then the platform metrics from the *Google & Meta Ads Metrics* sheet (Metrics (Dev Notes), green rows), in sheet order: Spend (Cost), Impressions, Reach, CPM, Frequency, Clicks, CTR, CPC, Conversions, Conversion Rate, Cost Per Conversion (kept from V1), Cost Per Lead, Cost Per Purchase, ROAS, Conversion Value, Engagement Rate, Engagement, Cost Per Engagement. In CRM mode, CRM Leads, CRM CPL, CRM Revenue and CRM ROAS follow ("CRM" prefix to separate CRM-attributed ROAS from platform-reported ROAS). Header tooltips show the sheet's definitions. Every column is sortable, including Status (Active → Attention Required → Paused) and Ad Format (first format).
  - **Column picker** (columns icon next to the filter): show or hide columns, grouped as Details (Ad Format), Delivery, Clicks, Conversions, Engagement and CRM (CRM mode only), with Show all / Hide all per group and Show all columns. The badge counts hidden columns. Name, Status and Action are always shown. The choice is remembered per viewer in the browser (prototype: localStorage; product: save per user).
  - **API fields** (from the sheet, for development):
    - Cost — Meta \`spend\`; Google \`metrics.cost_micros\`
    - Impressions — Meta \`impressions\`; Google \`metrics.impressions\`
    - Reach — Meta \`reach\`; Google \`metrics.unique_users\`
    - CPM — Meta \`cpm\`; Google \`metrics.average_cpm\`
    - Frequency — Meta \`frequency\`; Google \`metrics.average_impression_frequency_per_user\`
    - Clicks — Meta \`inline_link_clicks\`; Google \`metrics.clicks\`
    - CTR — Meta \`inline_link_click_ctr\`; Google \`metrics.ctr\`
    - CPC — Meta \`cost_per_inline_link_click\`; Google \`metrics.average_cpc\`
    - Conversions — Meta \`actions\`; Google \`metrics.conversions\`
    - Conversion Rate — Meta \`actions / inline_link_clicks\`; Google \`metrics.conversions_from_interactions_rate\`
    - Cost Per Lead / Cost Per Purchase — Meta \`cost_per_action_type\`; Google \`metrics.cost_per_conversion\`
    - ROAS — Meta \`purchase_roas\`; Google \`metrics.conversions_value_per_cost\`
    - Conversion Value — Meta \`action_values\`; Google \`metrics.conversions_value\`
    - Engagement Rate — Meta \`actions / impressions\` (action_type = post_engagement); Google \`metrics.engagement_rate\`
    - Engagement — Meta \`actions\` (action_type = post_engagement); Google \`metrics.interactions\`
    - Cost Per Engagement — Meta \`cost_per_action_type\` (action_type = post_engagement); Google \`metrics.average_cpe\`
  - **Open question:** Google reports Cost Per Lead and Cost Per Purchase from the same field (\`metrics.cost_per_conversion\`), so they only differ if conversion actions are set up separately for leads and purchases.
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
