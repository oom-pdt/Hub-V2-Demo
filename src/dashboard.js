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
// Google and Meta report campaigns, ad groups / ad sets and ads as Active or Paused only.
const DASH_STATUSES = ['Active', 'Paused'];
const DASH_STATUS_RANK = { 'Active': 0, 'Paused': 1 };
const DASH_STATUS_KEY = { 'Active': 'active', 'Paused': 'paused' };
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
// 'Limited' = active but delivery-limited. The consolidated table shows it as Active; the native views show
// Google "Limited" / Meta "Learning limited" from the entity's `limited` flag.
function dashPickStatus(rnd, limitedBias) {
  const r = rnd();
  if (r < 0.12) return 'Paused';
  if (r < 0.12 + (limitedBias ? 0.2 : 0.07)) return 'Limited';
  return 'Active';
}
const dashStatusFields = raw => ({ status: raw === 'Limited' ? 'Active' : raw, limited: raw === 'Limited' });
// Linked platforms as the dashboard sees them. Dev toggles can simulate "no ad accounts linked" and
// "single platform (Google only)" without changing ad-account data.
function dashPlatforms(wsId) {
  if (isAgency()) return wsPlatforms(wsId);
  if (state.flags.dashNoAccounts) return [];
  const plats = wsPlatforms(wsId);
  return state.flags.dashGoogleOnly && plats.includes('google') ? ['google'] : plats;
}

// Platform → campaign → ad group → ad hierarchy for one workspace, only for its linked platforms.
// `base` holds 30-day metrics; dashMetrics() scales them to the selected date range.
function dashTree(wsId) {
  const ws = wsById(wsId);
  const plats = wsPlatforms(wsId);
  const key = `${wsId}|${plats.join(',')}`;
  if (dashCache.tree[key]) return dashCache.tree[key];
  const t = { platforms: [], campaigns: [], adGroups: [], ads: [] };
  const bias = !!ws.perfFlag;   // accounts with a performance issue generate weaker numbers
  let adNo = 0;
  plats.forEach(p => {
    const rnd = dashRng(`${wsId}:${p}`);
    const pid = `${wsId}~${p}`;
    t.platforms.push({ id: pid, level: 'platform', platform: p, name: PLATFORM_NAME[p], status: 'Active', parents: [], path: { platform: pid } });
    dashShuffle(DASH_CAMPAIGNS[p], rnd).slice(0, 2 + Math.floor(rnd() * 2)).forEach((cName, ci) => {
      const cid = `${pid}~c${ci + 1}`;
      const cStatus = ci === 0 ? (bias ? 'Limited' : 'Active') : dashPickStatus(rnd, bias);
      t.campaigns.push({ id: cid, level: 'campaign', platform: p, name: cName, ...dashStatusFields(cStatus), parents: [PLATFORM_NAME[p]], path: { platform: pid, campaign: cid } });
      dashShuffle(DASH_ADGROUPS[p], rnd).slice(0, 1 + Math.floor(rnd() * 3)).forEach((gName, gi) => {
        const gid = `${cid}~g${gi + 1}`;
        const gStatus = cStatus === 'Paused' ? 'Paused' : (gi === 0 ? 'Active' : dashPickStatus(rnd, bias));
        t.adGroups.push({ id: gid, level: 'adgroup', platform: p, name: gName, ...dashStatusFields(gStatus), parents: [cName], campaignName: cName, path: { platform: pid, campaign: cid, adgroup: gid } });
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
            id, level: 'ad', platform: p, name: `Ad Creative Q${Math.ceil(adNo / 2)} - Variant ${adNo}`, format: fmt, ...dashStatusFields(status),
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
  // Fit 30-day spend to 72–94% of the workspace's spend level (ws.budget); the CRM media budget can differ, which drives pacing.
  const total = t.ads.reduce((s, a) => s + a.base.spend, 0);
  if (total) {
    const f = (ws.budget || 0) * (0.72 + dashRng(`${wsId}:budget`)() * 0.22) / total;
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
      { key: 'health', title: 'Account Health', options: [['attention', 'Attention Required'], ['off', 'Off Track'], ['on', 'On Track']] },
      { key: 'platform', title: 'Ad Platforms', options: [['google', 'Google'], ['meta', 'Meta'], ['none', 'No platform linked']] },
      { key: 'perf', title: 'Performance (Cost per Conversion)', options: [['good', 'Excellent'], ['mid', 'Average'], ['bad', 'Bad']] },
      { key: 'seo', title: 'SEO Status', options: [['on', 'On track'], ['off', 'Off track'], ['critical', 'Critical'], ['none', 'Not on SEO Cloud']] }
    ],
    refresh: () => { pager('dash-managed').page = 1; dashRefreshManaged(); }
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
  list.filter(w => w.perfFlag).forEach((w, i) => items.push({
    client: w.name, type: 'Performance Review', priority: i === 0 ? 'High' : 'Medium',
    desc: DASH_PERF_ISSUES[i % DASH_PERF_ISSUES.length], cta: 'View Account', action: `openWorkspace('${w.id}','dashboard')`
  }));
  // SEO Cloud projects below their top-10 target (status rule in seoStatus()).
  seoPortfolio(list).rows.filter(x => x.stats.status.key !== 'on').forEach(({ ws, stats }) => items.push({
    client: ws.name, type: stats.status.key === 'critical' ? 'SEO Critical' : 'SEO Off Track', priority: stats.status.key === 'critical' ? 'High' : 'Medium',
    desc: `${dashPctTxt(stats.top10Pct)} of keywords in top 10 vs ${dashPctTxt(stats.target)} target (${dashNum1(stats.status.gap)} pts below).`,
    cta: 'View SEO', action: `openWorkspace('${ws.id}','dashboard',{tab:'seo'})`
  }));
  // Agency CRM contracts: SEO contract ending soon while SEO is below target, then any service contract ending within 30 days.
  list.forEach(w => {
    const svcs = crmLiveServices(w.id);
    const seoSvc = svcs.find(x => x.type === 'SEO');
    const st = seoConnected(w.id) ? seoStats(w.id, dateRangeDays('agency')).status : null;
    const atRisk = seoSvc && seoSvc.daysLeft !== null && seoSvc.daysLeft <= 60 && st && st.key !== 'on';
    if (atRisk) items.push({
      client: w.name, type: 'Renewal at Risk', priority: 'High',
      desc: `SEO contract ends in ${seoSvc.daysLeft} days (${fmtDate(seoSvc.end)}) while SEO is ${st.label.toLowerCase()}.`,
      cta: 'View SEO', action: `openWorkspace('${w.id}','dashboard',{tab:'seo'})`
    });
    svcs.filter(x => x.daysLeft !== null && x.daysLeft <= 30 && !(atRisk && x === seoSvc)).forEach(x => items.push({
      client: w.name, type: 'Contract Ending', priority: 'Medium',
      desc: `${x.type} contract ${x.contractNo || ''} ends in ${x.daysLeft} day${x.daysLeft === 1 ? '' : 's'} (${fmtDate(x.end)}).`,
      cta: 'View Contract', action: `openWorkspace('${w.id}','organisation',{tab:'billing'})`
    }));
    const pace = dashPacing(w.id, dashMetrics(w.id, 'agency').total.spend, dateRangeDays('agency'));
    if (pace && pace.key === 'ahead') items.push({
      client: w.name, type: 'Budget Pacing', priority: 'Medium',
      desc: `Ad spend is ahead of pace: ${Math.round(pace.pct)}% of the media budget for these dates.`,
      cta: 'View Account', action: `openWorkspace('${w.id}','dashboard',{tab:'ads'})`
    });
  });
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
  // Aurix is a live CRM service but the workspace isn't connected to Aurix in Galaxis.
  list.filter(w => crmLiveServices(w.id).some(x => x.type === 'Aurix') && !(wsProducts(w.id).aurix?.status === 'connected')).forEach(w => items.push({
    client: w.name, type: 'Aurix Not Linked', priority: 'Low',
    desc: 'Aurix is a live service in the Agency CRM, but this workspace is not linked to Aurix yet.', cta: 'Link Aurix', action: `openWorkspace('${w.id}','integrations')`
  }));
  items.forEach(i => {
    i.wsId = workspaces.find(w => w.name === i.client)?.id || null;   // null = agency-level ("My Workspace")
    i.product = DASH_ISSUE_PRODUCT[i.type] || (i.type === 'Integration Error' && /^Aurix/.test(i.desc) ? 'Aurix' : i.type === 'Contract Ending' ? dashContractProduct(i.desc) : 'Integrations');
  });
  return items.sort((a, b) => DASH_PRIORITY_RANK[a.priority] - DASH_PRIORITY_RANK[b.priority]);
}
// Which OOm product an issue belongs to (banner: "… across Ads Performance and Aurix").
const DASH_ISSUE_PRODUCT = {
  'Performance Review': 'Ads Performance', 'Budget Pacing': 'Ads Performance', 'No Account Linked': 'Ads Performance',
  'Unlinked Ad Accounts': 'Ads Performance', 'Token Expired': 'Ads Performance',
  'SEO Critical': 'SEO Cloud', 'SEO Off Track': 'SEO Cloud', 'Renewal at Risk': 'SEO Cloud',
  'Aurix Not Linked': 'Aurix', 'CRM Set-up': 'Agency CRM'
};
function dashContractProduct(desc) { return /^SEO/.test(desc) ? 'SEO Cloud' : /^Aurix/.test(desc) ? 'Aurix' : /^(Google Ads|Facebook Ads|SEM)/.test(desc) ? 'Ads Performance' : 'Contracts'; }

function dashRenderAgency() {
  // Date range lives on the Managed Accounts table (Google Ads-style presets) and drives the whole page.
  // "All time" starts at the earliest managed workspace.
  state.dateFilters.agency.allFrom = dashAgencyWorkspaces().map(w => w.createdAt).filter(Boolean).sort()[0];
  const items = dashAttentionItems();
  return `
    <div class="dash-welcome">
      <div><h2 class="h-welcome">Welcome Back, ${esc(dashFirstName())}</h2><p class="dash-welcome-sub">Here’s what’s happening across your services today.</p></div>
    </div>
    ${dashAgencyBanner(items)}
    ${dashAgencyKpis(items)}
    <div class="dash-top">
      ${dashDonutCard()}
      ${dashProductsCard()}
    </div>
    <div class="card" id="dash-managed">${dashManagedCard()}</div>`;
}

// Banner: the same issues as the Attention Required KPI and Account Health, so the numbers always agree.
function dashAgencyBanner(items) {
  if (!items.length) return '';
  // Name the three areas with the most issues; summarise the rest.
  const counts = {};
  items.forEach(i => { counts[i.product] = (counts[i.product] || 0) + 1; });
  const prods = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const named = prods.slice(0, 3), rest = prods.length - named.length;
  const list = rest ? `${named.join(', ')} and ${rest} other area${rest === 1 ? '' : 's'}`
    : named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}` : named[0];
  return `<div class="banner banner-warning dash-banner">
    <i data-lucide="triangle-alert"></i>
    <div><div class="banner-title">Attention Required</div><div class="banner-text">${items.length} account issue${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} your attention across ${esc(list)}.</div></div>
    <button type="button" class="banner-action" onclick="dashOpenAllIssues()">View Issues</button>
  </div>`;
}
// "Review Accounts": filter Managed Accounts to accounts that need attention, worst first.
function dashReviewAccounts() {
  state.ui.dashMgrFilter.health = ['attention', 'off'];
  state.sorts['dash-managed'] = { col: 'health', dir: 'asc' };
  pager('dash-managed').page = 1;
  renderRegion('dash-managed', dashManagedCard());
  document.getElementById('dash-managed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Months covered by a CRM contract (for contract value = monthly budget × months).
function dashContractMonths(x) { return x.start && x.end ? Math.max(1, Math.round((new Date(x.end) - new Date(x.start)) / (86400000 * 30.44))) : 12; }
function dashAgencyKpis(items) {
  const list = dashAgencyWorkspaces();
  const svcs = list.flatMap(w => crmLiveServices(w.id).map(x => ({ ...x, wsId: w.id })));
  const value = svcs.reduce((t, x) => t + x.monthlyBudget * dashContractMonths(x), 0);
  const clients = new Set(items.filter(i => i.wsId).map(i => i.wsId)).size;
  const renewals = new Set(svcs.filter(x => x.daysLeft !== null && x.daysLeft <= 30).map(x => `${x.wsId}|${x.contractNo}`)).size;
  const followUps = list.reduce((t, w) => t + (crmAccounts[w.id]?.followUpsDue || 0), 0);
  const card = (title, tip, value, sub, onclick) => `<div class="kpi-card dash-agency-kpi ${onclick ? 'clickable' : ''}" ${onclick ? `role="button" tabindex="0" onclick="${onclick}"` : ''}>
      <div class="kpi-title t-bold">${esc(title)} ${infoTip(tip)}</div>${onclick ? '<span class="dash-kpi-panel" title="Show all pending issues"><i data-lucide="panel-right-open"></i></span>' : ''}<div class="kpi-value dash-agency-kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`;
  return `<div class="grid-4 dash-kpis dash-agency-kpis">
    ${card('Managed Contract Value', 'Total value of the live contracts across your managed accounts (monthly budget × contract months), from the Agency CRM.', fmtMoney(value, 2), 'Total value across managed contracts')}
    ${card('Attention Required', 'Open issues across ads, SEO, Aurix, contracts and integrations. The same issues drive the banner and Account Health. Select to see them all in a side panel.', fmtNum(items.length), `Issues across <b>${clients}</b> client${clients === 1 ? '' : 's'}`, 'dashOpenAllIssues()')}
    ${card('Upcoming Renewals', 'Live Agency CRM contracts that end within 30 days.', fmtNum(renewals), 'Contracts renewing within 30 days')}
    ${card('Client Follow-ups Due', 'Open follow-up tasks on your clients in the Agency CRM. [PLACEHOLDER] mock counts.', fmtNum(followUps), 'Follow-ups pending')}
  </div>`;
}

// Your Products: one row per OOm product with a short health line. Selecting a row opens its slide-over.
const DASH_PRODUCTS = [
  { key: 'ads', name: 'Ads Performance', product: 'Ads Performance', covered: ['Budget Pacing'], view: "dashFocusGroup('ads')" },
  { key: 'aurix', name: 'Aurix', product: 'Aurix', covered: ['Aurix Not Linked'], view: "openProductApp('aurix')" },
  { key: 'seo', name: 'SEO Cloud', product: 'SEO Cloud', covered: ['SEO Critical', 'SEO Off Track'], view: "openProductApp('seo-cloud')" }
];
// Sections behind each product line, from the same rows and issues as the rest of the dashboard.
// Issues not covered by a section (e.g. Token Expired, Renewal at Risk) are listed under Other Issues.
function dashProductIssues(key, rows = dashManagedRows(), items = dashAttentionItems()) {
  const def = DASH_PRODUCTS.find(p => p.key === key);
  const other = items.filter(i => i.product === def.product && !def.covered.includes(i.type));
  const n = (v, txt) => `<b class="t-error">${v}</b> ${txt}`;
  let sections = [], parts = [];
  if (key === 'ads') {
    const days = dateRangeDays('agency');
    const avg = dashPortfolio().total.cpa;
    const near = rows.filter(r => r.pacing && r.pacing.key === 'ahead').sort((a, b) => b.pacing.pct - a.pacing.pct);
    const under = rows.filter(r => r.q.cpa === 'bad').sort((a, b) => b.t.cpa - a.t.cpa);
    sections = [
      { title: 'Accounts Near Spend Limits', rows: near, card: r => {
        const budget = r.pacing.monthly * days / 30, pct = r.pacing.pct;
        return `<div class="row-between dash-sp-meter"><span>${fmtMoney(r.t.spend)} / ${fmtMoney(budget)} spent</span><span class="pill pill-sm ${pct >= 100 ? 'pill-red' : 'pill-orange'}">${Math.round(pct)}%</span></div>
          <div class="dash-sp-bar"><span class="${pct >= 100 ? 'red' : 'amber'}" style="width:${Math.min(100, pct).toFixed(1)}%"></span></div>`;
      }, open: r => `openWorkspace('${r.w.id}','dashboard',{tab:'ads'})` },
      { title: 'Accounts Underperforming', rows: under, card: r => `
        <div class="t-error dash-sp-gap">${Math.round((r.t.cpa / avg - 1) * 100)}% above agency average</div>
        <div class="dash-sp-metric">Cost per conversion</div>
        <div class="dash-sp-value"><b>${fmtMoney(r.t.cpa, 2)}</b> / Agency avg: ${fmtMoney(avg, 2)}</div>`,
        open: r => `openWorkspace('${r.w.id}','dashboard',{tab:'ads'})` }
    ];
    if (near.length) parts.push(n(near.length, `Account${near.length === 1 ? '' : 's'} nearing spend limits`));
    if (under.length) parts.push(n(under.length, 'Underperforming'));
  } else if (key === 'aurix') {
    const gap = rows.filter(r => r.services.includes('aurix') && !(wsProducts(r.w.id).aurix?.status === 'connected'));
    sections = [{ title: 'Accounts Not Linked', rows: gap, card: () => '<div class="dash-sp-metric">Aurix is a live service in the Agency CRM, but this workspace is not linked to Aurix yet.</div>',
      open: r => `openWorkspace('${r.w.id}','integrations')` }];
    if (gap.length) parts.push(n(gap.length, `Account${gap.length === 1 ? '' : 's'} currently not linked`));
  } else {
    const seoRows = k => rows.filter(r => r.seo && r.seo.status.key === k).sort((a, b) => b.seo.status.gap - a.seo.status.gap);
    const card = r => {
      const s = r.seo, fill = s.target ? Math.min(100, s.top10Pct / s.target * 100) : 0;
      return `<div class="row-between dash-sp-meter"><span>Keywords in top 10: <b>${dashPctTxt(s.top10Pct)}</b> / Target: ${dashPctTxt(s.target)}</span><span class="pill pill-sm ${s.status.pill}">${dashNum1(s.status.gap)} pts below</span></div>
        <div class="dash-sp-bar"><span class="${s.status.key === 'critical' ? 'red' : 'amber'}" style="width:${fill.toFixed(1)}%"></span></div>`;
    };
    const open = r => `openWorkspace('${r.w.id}','dashboard',{tab:'seo'})`;
    const crit = seoRows('critical'), off = seoRows('off');
    sections = [{ title: 'Critical', rows: crit, card, open }, { title: 'Off Track', rows: off, card, open }];
    if (crit.length) parts.push(n(crit.length, 'Critical'));
    if (off.length) parts.push(`<b class="t-warning">${off.length}</b> Off track`);
  }
  if (other.length) parts.push(n(other.length, 'more'));
  const count = sections.reduce((t, x) => t + x.rows.length, 0) + other.length;
  return { def, sections, other, count, line: parts.length ? parts.join(' • ') : '<span class="t-success">No critical issues detected</span>' };
}
function dashProductsCard() {
  const rows = dashManagedRows(), items = dashAttentionItems();
  const list = DASH_PRODUCTS.map(def => ({ ...def, icon: dashServiceIcon(def.key, 36), ...dashProductIssues(def.key, rows, items) }));
  return `<div class="card dash-products">
    <div class="row-between dash-products-head"><h2 class="h-section">Your Products</h2><span class="t-caption t-muted">${list.length} Connected Products</span></div>
    <div class="dash-products-list">${list.map(p => `
      <div class="dash-product-row clickable" role="button" tabindex="0" onclick="dashOpenProductPanel('${p.key}')" onkeydown="if(event.key==='Enter')dashOpenProductPanel('${p.key}')">
        ${p.icon}
        <div class="grow"><div class="t-bold">${esc(p.name)}</div><div class="t-caption">${p.line}</div></div>
        ${p.count
          ? `<button type="button" class="kebab dash-product-open" onclick="event.stopPropagation(); dashOpenProductPanel('${p.key}')" title="${p.count} pending issue${p.count === 1 ? '' : 's'}" aria-label="Show ${esc(p.name)} issues"><i data-lucide="panel-right-open"></i></button>`
          : `<button type="button" class="kebab dash-product-open" onclick="event.stopPropagation(); ${p.view}" title="Open ${esc(p.name)}" aria-label="Open ${esc(p.name)}"><i data-lucide="square-arrow-out-up-right"></i></button>`}
      </div>`).join('')}</div>
  </div>`;
}
// Product slide-over (Figma 6551:24738): summary line, one section per issue type with a card per account, View Product.
function dashOpenProductPanel(key) {
  const { def, sections, other, count, line } = dashProductIssues(key);
  const body = sections.filter(x => x.rows.length).map(x => `
    <div class="dash-sp-section">
      <div class="dash-sp-title">${esc(x.title)} (${x.rows.length})</div>
      ${x.rows.map(r => `<div class="dash-sp-card">
        <span class="team-org-logo">${esc(initials(r.w.name))}</span>
        <div class="grow"><div class="dash-sp-name">${esc(r.w.name)}</div>${x.card(r)}</div>
        <button type="button" class="kebab dash-sp-open" onclick="closeDrawer(); ${x.open(r)}" title="Open ${esc(r.w.name)}" aria-label="Open ${esc(r.w.name)}"><i data-lucide="square-arrow-out-up-right"></i></button>
      </div>`).join('')}
    </div>`).join('') + (other.length ? `<div class="dash-sp-section"><div class="dash-sp-title">Other Issues (${other.length})</div>${dashIssueListHTML(other)}</div>` : '');
  openDrawer(`<div class="dash-sp">
      <h3 class="h-section">${esc(def.name)}</h3>
      <div class="dash-sp-sub">${line}</div>
      ${count ? body : emptyState('circle-check', 'No pending issues', `Nothing in ${def.name} needs attention right now.`)}
    </div>`,
    `<button type="button" class="btn btn-primary dash-sp-view" onclick="closeDrawer(); ${def.view}"><i data-lucide="square-arrow-out-up-right"></i>View Product</button>`, { wide: true });
}
// All pending issues (Attention Required KPI and banner), grouped by product or area, most issues first.
function dashOpenAllIssues() {
  const items = dashAttentionItems();
  const clients = new Set(items.filter(i => i.wsId).map(i => i.wsId)).size;
  const groups = {};
  items.forEach(i => { (groups[i.product] = groups[i.product] || []).push(i); });
  const order = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
  openDrawer(`<div class="dash-sp">
      <h3 class="h-section">Attention Required</h3>
      <div class="dash-sp-sub"><b class="t-error">${items.length}</b> pending issue${items.length === 1 ? '' : 's'} across <b>${clients}</b> client${clients === 1 ? '' : 's'}</div>
      ${items.length ? order.map(g => `<div class="dash-sp-section"><div class="dash-sp-title">${esc(g)} (${groups[g].length})</div>${dashIssueListHTML(groups[g])}</div>`).join('')
        : emptyState('circle-check', 'No pending issues', 'Nothing across your accounts needs attention right now.')}
    </div>`,
    items.length ? `<button type="button" class="btn btn-outline" onclick="closeDrawer(); dashReviewAccounts()">Show accounts in Managed Accounts</button>` : '', { wide: true });
}
// Ads Performance "open": expand and show the Ads columns in Managed Accounts.
function dashFocusGroup(group) {
  const d = columnPickers.managed;
  d.collapsed = d.collapsed.filter(g => g !== group);
  d.hidden = d.hidden.filter(k => DASH_MG_COLS.find(c => c.key === k)?.group !== group);
  colChanged('managed');
  document.getElementById('dash-managed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Small round product marks used in Services and Your Products.
const DASH_SERVICE_META = {
  ads: { label: 'Ads Performance', bg: '#FBD3F2', fg: '#C2419C', icon: 'chart-column' },
  seo: { label: 'SEO Cloud', pid: 'seo-cloud' },
  aurix: { label: 'Aurix', pid: 'aurix' },
  crm: { label: 'Galaxis CRM', pid: 'crm-lite' },
  content: { label: 'Content Marketing', bg: '#FFF4E3', fg: '#C47E16', icon: 'pen-line' },
  social: { label: 'Social Media', bg: '#E6F6F6', fg: '#1A6A6D', icon: 'share-2' }
};
function dashServiceIcon(key, size = 24) {
  const m = DASH_SERVICE_META[key];
  if (m.pid) return `<span class="dash-svc-icon" title="${esc(m.label)}">${productLogo(m.pid, size)}</span>`;
  return `<span class="dash-svc-icon product-logo" title="${esc(m.label)}" style="width:${size}px;height:${size}px;background:${m.bg};color:${m.fg}"><i data-lucide="${m.icon}" style="width:${Math.round(size / 2)}px;height:${Math.round(size / 2)}px"></i></span>`;
}

function dashDonutCard() {
  const list = dashAgencyWorkspaces();
  const segs = [['cancelled', 'Cancelled', '#F78483'], ['inactive', 'Inactive', '#F9C576'], ['new', 'New', '#66ACFD'], ['active', 'Active', '#8CDA93']]
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
  const legendOrder = ['active', 'new', 'inactive', 'cancelled'].map(k => segs.find(s => s.k === k));
  return `<div class="card dash-donut-card">
    <div class="kpi-title">Total Accounts Managed ${infoTip('Client workspaces you manage, grouped by account lifecycle status (Active, New, Inactive, Cancelled). Not affected by the date filter.')}</div>
    <div class="dash-donut-wrap">
      <div class="dash-donut">
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${total} total accounts">${total ? arcs : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#F2F2F2" stroke-width="${sw}"/>`}</svg>
        <div class="dash-donut-center"><div class="dash-donut-num">${total}</div><div class="t-caption">Total Accounts</div></div>
      </div>
      <div class="dash-legend">${legendOrder.map(s => `<div class="dash-legend-row"><span class="dash-legend-sw" style="background:${s.color}"></span><span class="grow">${esc(s.label)}</span><span>${s.n}</span></div>`).join('')}</div>
    </div>
  </div>`;
}

// Issue rows (used in the per-client issues drawer).
function dashIssueListHTML(items) {
  if (!items.length) return emptyState('circle-check', 'No open issues', 'This account has nothing that needs attention right now.');
  return `<div class="dash-att-list">${items.map(i => `
    <div class="dash-att-item">
      <div class="grow">
        <div class="dash-att-top"><span class="t-bold">${esc(i.client)}</span><span class="chip">${esc(i.type)}</span><span class="pill pill-sm dash-prio ${DASH_PRIORITY_PILL[i.priority]}">${i.priority}</span></div>
        <div class="dash-att-desc">${esc(i.desc)}</div>
      </div>
      <button type="button" class="t-link dash-att-cta" onclick="closeDrawer(); ${i.action}">${esc(i.cta)}<i data-lucide="chevron-right"></i></button>
    </div>`).join('')}</div>`;
}

// Account Health from the open issues: any High-priority issue → Attention Required, any other issue → Off Track.
const DASH_HEALTH = { attention: ['Attention Required', 'pill-red', 0], off: ['Off Track', 'pill-orange', 1], on: ['On Track', 'pill-green', 2] };
function dashHealthOf(issues) { return issues.some(i => i.priority === 'High') ? 'attention' : issues.length ? 'off' : 'on'; }
// Last activity in the workspace (mock: a recent day per workspace).
function dashLastActivity(w) { const d = new Date(); d.setDate(d.getDate() - ((w.seed * 3) % 9)); return toDateInput(d); }
function dashManagedRows() {
  const port = dashPortfolio().total;
  const days = dateRangeDays('agency');
  const allIssues = dashAttentionItems();
  return dashAgencyWorkspaces().map(w => {
    const t = dashMetrics(w.id, 'agency').total;
    const linked = t.spend > 0;
    const services = crmLiveServices(w.id);
    const issues = allIssues.filter(i => i.wsId === w.id);
    const types = services.map(x => x.type);
    // Services the client uses: Ads Performance, SEO Cloud, Aurix, Galaxis CRM (+N other CRM services).
    const svcKeys = [
      types.some(t => CRM_AD_SERVICES.includes(t)) && 'ads',
      (types.includes('SEO') || seoConnected(w.id)) && 'seo',
      (types.includes('Aurix') || wsProducts(w.id).aurix) && 'aurix',
      wsProducts(w.id)['crm-lite']?.status === 'connected' && 'crm'
    ].filter(Boolean);
    if (types.includes('Content Marketing')) svcKeys.push('content');
    if (types.includes('Social Media')) svcKeys.push('social');
    return {
      w, t, linked, plats: wsPlatforms(w.id), issues, health: dashHealthOf(issues), services: svcKeys,
      contact: wsPrimaryContact(w.id), last: dashLastActivity(w),
      adSvcs: services.filter(x => CRM_AD_SERVICES.includes(x.type)), seoSvcs: services.filter(x => x.type === 'SEO'),
      pacing: dashPacing(w.id, t.spend, days), industry: w.industry, am: memberById(crmAccounts[w.id]?.accountManager || '')?.name || null,
      seo: seoConnected(w.id) ? seoStats(w.id, days) : null,
      q: { cpm: linked ? dashQuality(t.cpm, port.cpm) : '', cpc: linked ? dashQuality(t.cpc, port.cpc) : '', cpa: linked ? dashQuality(t.cpa, port.cpa) : '', pRoas: linked ? dashQuality(t.pRoas, port.pRoas, true) : '' }
    };
  });
}

// Managed Accounts columns, in table order. Client and Action are always shown; the rest are in the column picker.
// Default view (new design): every column, with the Ads and SEO groups collapsed to their key KPI (Ads: Cost Per
// Conversion, SEO: Top 10 %). Expanding a group shows the rest of its columns.
const DASH_MG_COLS = [
  { key: 'services', group: 'overview', label: 'Services', tip: 'Every service this client uses: Ads Performance, SEO Cloud, Aurix, Galaxis CRM, Content Marketing, Social Media. Hover to name them.' },
  { key: 'health', group: 'overview', label: 'Account Health', tip: 'From the open issues: Attention Required when any issue is High priority, Off Track when there are other open issues, otherwise On Track.' },
  { key: 'issues', group: 'overview', label: 'Issues Count', tip: 'Open issues for this client (ads, SEO, Aurix, contracts, integrations). Select to see them.' },
  { key: 'platforms', group: 'ads', label: 'Ad Platforms' },
  { key: 'spend', group: 'ads', label: 'Combined Spend' },
  { key: 'pacing', group: 'ads', label: 'Budget Pacing', tip: 'Ad spend against the media budget in the Agency CRM for the selected dates. Ahead of pace above 115%, Under spend below 80%, otherwise On track (same rule as the CRM).' },
  { key: 'conversions', group: 'ads', label: 'Conversions', tip: 'Platform-reported conversions for the selected dates.' },
  { key: 'cpa', group: 'ads', label: 'Cost Per Conversion', tip: 'Key ads KPI: spend ÷ platform-reported conversions, coloured against the portfolio average.' },
  { key: 'pRoas', group: 'ads', label: 'ROAS', tip: 'Platform-reported purchase value ÷ spend. Mainly meaningful for clients that track purchase value (e-commerce).' },
  { key: 'cpm', group: 'ads', label: 'CPM' },
  { key: 'cpc', group: 'ads', label: 'CPC' },
  { key: 'adsDays', group: 'ads', label: 'Contract Days Left', tip: 'Days left on the Agency CRM contract for the live ad services (Google Ads, Facebook Ads, SEM). Shown per platform when they run on different contracts. Amber at 60 days or fewer, red at 30 or fewer.' },
  { key: 'seoStatus', group: 'seo', label: 'SEO Status', tip: 'SEO Cloud project status: On track at or above the top-10 target, Off track less than 5 points below, Critical 5 or more points below.' },
  { key: 'top10', group: 'seo', label: 'Keywords in Top 10', tip: 'Key SEO KPI: share of tracked keywords ranking in the top 10 today, against the contracted target.' },
  { key: 'avgPos', group: 'seo', label: 'Avg Position', tip: 'Mean position of keywords ranking in the top 100 (lower is better).' },
  { key: 'seoDays', group: 'seo', label: 'Contract Days Left', tip: 'Days left on the Agency CRM contract for the SEO service. Amber at 60 days or fewer, red at 30 or fewer.' },
  { key: 'contact', group: 'contact', label: 'Primary Contact' },
  { key: 'last', group: 'contact', label: 'Last Activity' }
];
registerColumnPicker('managed', {
  columns: () => DASH_MG_COLS,
  groups: [['overview', 'Account', { summary: 'health', tone: 'neutral' }], ['ads', 'Ads', { summary: 'cpa', tone: 'ads' }],
    ['seo', 'SEO', { summary: 'top10', tone: 'seo' }], ['contact', 'Contact', { summary: 'contact', tone: 'neutral' }]],
  collapsible: true,
  note: 'Client and Action are always shown',
  onChange: 'dashRefreshManaged',
  // Every column is shown; Ads and SEO start collapsed to their key KPI (Cost Per Conversion, Top 10 %).
  defaultHidden: [],
  defaultCollapsed: ['ads', 'seo'],
  storageKey: 'galaxis-demo:managed-columns-hidden-v4',
  collapsedKey: 'galaxis-demo:managed-groups-collapsed-v4'
});

function dashManagedCard() {
  return `<div class="card-header">
      <div><h2 class="h-section">Managed Accounts</h2><div class="card-sub">A complete overview of all client accounts currently assigned to you.</div></div>
      <div class="row">
        ${datePresetHTML('agency', 'dashRerender')}
        <div class="search dash-search"><input class="input" placeholder="Search client or contact" value="${esc(state.ui.dashMgrSearch)}" oninput="dashManagedSearch(this.value)" aria-label="Search managed accounts"><i data-lucide="search"></i></div>
        ${dashFilterButton('managed')}
        ${colPickerButton('managed')}
      </div>
    </div>
    <div id="dash-managed-body">${dashManagedBody()}</div>`;
}
// Services cell: overlapping product marks, +N for other Agency CRM services.
// Services cell: every service the client uses, as product marks (never "+N"); hover names each one.
function dashServiceIconsCell(r) {
  if (!r.services.length) return '<span class="t-muted">—</span>';
  return `<span class="dash-svc-icons" title="${esc(r.services.map(k => DASH_SERVICE_META[k].label).join(', '))}">${r.services.map(k => dashServiceIcon(k, 24)).join('')}</span>`;
}
// Issues drawer for one client.
function dashOpenIssues(wsId) {
  const w = wsById(wsId);
  const issues = dashAttentionItems().filter(i => i.wsId === wsId);
  const h = DASH_HEALTH[dashHealthOf(issues)];
  openDrawer(`<div class="dash-issues-drawer">
      <h3 class="h-section">${esc(w.name)}</h3>
      <div class="row" style="margin:8px 0 18px"><span class="pill pill-sm ${h[1]}">${h[0]}</span><span class="t-caption t-muted">${issues.length} open issue${issues.length === 1 ? '' : 's'}</span></div>
      ${dashIssueListHTML(issues)}
    </div>`, `<button type="button" class="btn btn-outline" onclick="closeDrawer(); openWorkspace('${wsId}','dashboard')">Open workspace</button>`);
}
function dashManagedSearch(v) { state.ui.dashMgrSearch = v; pager('dash-managed').page = 1; dashRefreshManaged(); }
function dashRefreshManaged() { renderRegion('dash-managed-body', dashManagedBody()); }
// Days left on the Agency CRM contracts of the given live services (crmLiveServices in core.js). Services on the same
// contract show one figure; concurrent contracts (e.g. Google and Meta bought separately) show one per service.
const DASH_SVC_SHORT = { 'Google Ads': 'Google', 'Facebook Ads': 'Meta', 'SEM': 'SEM', 'SEO': 'SEO' };
function dashDaysLeftCell(services) {
  const list = services.filter(x => x.daysLeft !== null);
  if (!list.length) return '<span class="t-muted">—</span>';
  const tone = d => d <= 30 ? 'dash-days-red' : d <= 60 ? 'dash-days-amber' : '';
  const title = list.map(x => `${x.type} · contract ${x.contractNo || '—'} · ends ${fmtDate(x.end)} (${x.daysLeft} day${x.daysLeft === 1 ? '' : 's'} left)`).join('\n');
  const same = list.every(x => x.daysLeft === list[0].daysLeft);
  const body = same
    ? `<span class="dash-days ${tone(list[0].daysLeft)}">${list[0].daysLeft} days</span>`
    : [...list].sort((x, y) => x.daysLeft - y.daysLeft).map(x => `<span class="dash-days ${tone(x.daysLeft)}">${esc(DASH_SVC_SHORT[x.type] || x.type)} ${x.daysLeft}d</span>`).join(' · ');
  return `<span class="dash-nowrap" title="${esc(title)}">${body}</span>`;
}
const dashMinDays = list => { const d = list.filter(x => x.daysLeft !== null).map(x => x.daysLeft); return d.length ? Math.min(...d) : null; };
// Budget pacing (Agency CRM rule): spend in the selected days vs the CRM media budget for the same days.
function dashPacing(wsId, spend, days) {
  const monthly = crmLiveServices(wsId).filter(x => CRM_AD_SERVICES.includes(x.type)).reduce((t, x) => t + (x.monthlyBudget || 0), 0);
  if (!monthly || !spend) return null;
  const pct = spend / (monthly * days / 30) * 100;
  const key = pct > 115 ? 'ahead' : pct < 80 ? 'under' : 'on';
  return { key, pct, monthly, label: { ahead: 'Ahead of pace', under: 'Under spend', on: 'On track' }[key], quality: { ahead: 'bad', under: 'mid', on: 'good' }[key] };
}
function dashManagedBody() {
  const days = dateRangeDays('agency');
  const term = state.ui.dashMgrSearch.trim().toLowerCase();
  const f = state.ui.dashMgrFilter;
  let rows = dashManagedRows().filter(r => {
    if (term && !`${r.w.name} ${r.contact ? r.contact.email : ''}`.toLowerCase().includes(term)) return false;
    if (f.health.length && !f.health.includes(r.health)) return false;
    if (f.platform.length && !f.platform.some(p => p === 'none' ? !r.plats.length : r.plats.includes(p))) return false;
    if (f.perf.length && !f.perf.includes(r.q.cpa)) return false;
    if (f.seo.length && !f.seo.includes(r.seo ? r.seo.status.key : 'none')) return false;
    return true;
  });
  const seoRank = { critical: 0, off: 1, on: 2 };
  // Workspaces without data ("—") always sort last, whichever direction.
  const asc = (state.sorts['dash-managed'] || {}).dir === 'asc';
  const num = v => v || (asc ? Infinity : -1);
  const miss = v => v === null || v === undefined ? (asc ? Infinity : -Infinity) : v;
  rows = applySort(rows, 'dash-managed', {
    name: r => r.w.name.toLowerCase(), platforms: r => r.plats.length,
    services: r => r.services.length, health: r => DASH_HEALTH[r.health][2], issues: r => r.issues.length,
    contact: r => r.contact ? r.contact.email : '~', last: r => r.last,
    conversions: r => num(r.t.conversions), pRoas: r => num(r.t.pRoas),
    spend: r => num(r.t.spend), cpm: r => num(r.t.cpm), cpc: r => num(r.t.cpc), cpa: r => num(r.t.cpa),
    seoStatus: r => miss(r.seo ? seoRank[r.seo.status.key] : null), top10: r => miss(r.seo ? r.seo.top10Pct : null),
    avgPos: r => miss(r.seo ? r.seo.avgPos : null), adsDays: r => miss(dashMinDays(r.adSvcs)), seoDays: r => miss(dashMinDays(r.seoSvcs)),
    pacing: r => miss(r.pacing ? r.pacing.pct : null)
  });
  const total = rows.length;
  const page = paginate(rows, 'dash-managed', 10);
  const fn = 'dashRefreshManaged';
  // Grouped, collapsible columns (core.js colLayout): Account · Ads · SEO · CRM.
  const layout = colLayout('managed', DASH_MG_COLS.filter(c => colVisible('managed', c.key)));
  const cols = layout.columns;
  const th = c => `<th class="${colCellClass(c)}"${colDragAttrs('managed', 'col', c.key, c.group)}${c.tip ? ` title="${esc(c.tip)}"` : ''}>${sortHeader('dash-managed', c.key, c.label, fn)}</th>`;
  const dash = '<span class="t-muted">—</span>';
  const money = (r, k) => r.linked ? dashDot(fmtMoney(r.t[k], 2), r.q[k]) : dash;
  const cell = (r, k) => {
    switch (k) {
      case 'platforms': return `<div class="dash-plat-stack">${r.plats.map(p => platformBadge(p)).join('') || '<span class="t-muted">No platform linked</span>'}</div>`;
      case 'spend': return r.linked ? fmtMoney(r.t.spend) : dash;
      case 'cpm': case 'cpc': case 'cpa': return money(r, k);
      case 'conversions': return r.linked ? fmtNum(r.t.conversions) : dash;
      case 'pRoas': return r.linked && r.t.pRoas ? dashDot(`${r.t.pRoas.toFixed(2)}x`, r.q.pRoas) : dash;
      case 'seoStatus': return r.seo ? `<span class="pill pill-sm ${r.seo.status.pill}">${esc(r.seo.status.label)}</span>` : dash;
      case 'top10': return r.seo ? `<b class="${DASH_SEO_TEXT[r.seo.status.key]}">${dashPctTxt(r.seo.top10Pct)}</b><span class="t-muted"> / ${dashPctTxt(r.seo.target)}</span>` : dash;
      case 'avgPos': return r.seo && r.seo.avgPos !== null ? dashNum1(r.seo.avgPos) : dash;
      case 'services': return dashServiceIconsCell(r);
      case 'health': return `<span class="pill pill-sm ${DASH_HEALTH[r.health][1]} dash-health">${DASH_HEALTH[r.health][0]}</span>`;
      case 'issues': return r.issues.length ? `<button type="button" class="t-link dash-issues-link" onclick="event.stopPropagation(); dashOpenIssues('${r.w.id}')">${r.issues.length} Item${r.issues.length === 1 ? '' : 's'}</button>` : '<span class="t-muted">0</span>';
      case 'contact': return r.contact ? `<span class="dash-email" title="${esc(r.contact.name)} · ${esc(r.contact.email)}">${esc(r.contact.email)}</span>` : '<span class="t-muted">Unassigned</span>';
      case 'last': return fmtDate(r.last);
      case 'adsDays': return dashDaysLeftCell(r.adSvcs);
      case 'seoDays': return dashDaysLeftCell(r.seoSvcs);
      case 'pacing': return r.pacing ? `<span title="${esc(fmtMoney(r.t.spend))} spent vs ${esc(fmtMoney(r.pacing.monthly * days / 30))} media budget for these dates">${dashDot(esc(r.pacing.label), r.pacing.quality)} <span class="t-muted">${Math.round(r.pacing.pct)}%</span></span>` : dash;
    }
    return '';
  };
  const body = page.map(r => `
    <tr class="clickable" onclick="openWorkspace('${r.w.id}','dashboard')">
      <td class="dash-nowrap"><button type="button" class="dash-name-link" onclick="event.stopPropagation(); openWorkspace('${r.w.id}','dashboard')">${esc(r.w.name)}</button>
        <div class="cell-sub">${esc([r.industry, r.am].filter(Boolean).join(' · ') || '—')}</div></td>
      ${cols.map(c => `<td class="dash-nowrap ${colCellClass(c)}">${cell(r, c.key)}</td>`).join('')}
      <td onclick="event.stopPropagation()">${rowMenu(`dash-mm-${r.w.id}`, [
        { label: 'Go to workspace', icon: 'arrow-right', onClick: `openWorkspace('${r.w.id}','dashboard')` },
        ...(r.seo ? [{ label: 'View SEO performance', icon: 'search', onClick: `openWorkspace('${r.w.id}','dashboard',{tab:'seo'})` }] : []),
        { label: 'Organisation settings', icon: 'building-2', onClick: `openWorkspace('${r.w.id}','organisation')` },
        { label: 'Integrations', icon: 'blocks', onClick: `openWorkspace('${r.w.id}','integrations')` }
      ])}</td>
    </tr>`).join('');
  const emptyText = term ? `No workspaces found matching “${esc(state.ui.dashMgrSearch)}”.` : 'No workspaces found matching these filters.';
  return `<div class="table-wrap dash-table-wrap"><table class="table table-wrap-heads">
      <thead>${colGroupHeaderRow('managed', layout, { lead: 1, trail: 1 })}
        <tr><th>${sortHeader('dash-managed', 'name', 'Client', fn)}</th>${cols.map(th).join('')}<th>Action</th></tr></thead>
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
    dashSeoBucket: 'all', dashSeoSearch: '', dashSeoFilter: { intent: [], difficulty: [], group: [] }, dashSeoCollapsed: {},
    dashPf: dashPfInitState()
  });
  pager('dash-ct').page = 1;
  pager('dash-seo', 25).page = 1;
  pager('dash-pf-google').page = 1;
  pager('dash-pf-meta').page = 1;
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
  // Date range (Google Ads-style presets): on the campaign tables for Ad Performance; the SEO tab has no picker and
  // uses the same range. It drives the whole tab (KPIs, charts, tables). "All time" starts at the workspace's creation date.
  state.dateFilters.client.allFrom = ws.createdAt;
  const hasAds = tab === 'ads' && dashPlatforms(ws.id).length > 0;
  const view = hasAds ? dashAdView(ws) : 'all';
  if (hasAds && state.params.view === view) state.ui.dashAdView = view;
  const sub = tab === 'seo' ? 'Keyword rankings from SEO Cloud for this workspace.'
    : view === 'all' ? 'Google and Meta advertising performance for this workspace.' : `${DASH_VIEW_LABEL[view]} performance for this workspace, with the full ${DASH_VIEW_LABEL[view]} report.`;
  const header = `<div class="dash-welcome">
      <div><h2 class="h-welcome">Welcome Back, ${esc(ws.name)}</h2><p class="dash-welcome-sub">${sub}</p></div>
    </div>
    ${dashHubPanel(ws)}
    ${dashTabBar(tab, ws)}`;
  if (tab === 'seo') return header + dashRenderSeo(ws);
  if (!hasAds) return header + dashNoAccountsCard();
  const switcher = dashViewSwitcher(ws, view);
  if (view !== 'all') return header + switcher + dashRenderPlatform(ws, view);
  const m = dashMetrics(ws.id, 'client');
  const crm = activeCrm(ws.id);
  return `${header}
    ${switcher}
    ${state.flags.dashKpiLayout === 'panels' ? dashKpiPanels(ws, 'all', m) : dashClientKpis(ws, m) + dashCrmSection(m, crm)}
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
          <div><h2 class="h-section">Average Position Trend</h2><div class="card-sub">Daily average position of keywords in the top 100. Lower is better, so better positions are higher on the chart.</div></div>
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
function dashSeoOpenCloud() { openProductApp('seo-cloud'); }

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
  // Same presentation as SEO Cloud: axis zoomed to the data in whole positions (better at the top),
  // a dot on every day and angled "Oct-18" date labels.
  const step = [1, 2, 5, 10].find(st => (Math.ceil(Math.max(...vals)) - Math.floor(Math.min(...vals)) + 2) / st <= 9) || 10;
  const lo = Math.max(1, Math.floor((Math.min(...vals) - 1) / step) * step), hi = Math.ceil((Math.max(...vals) + 1) / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const n = p.keywords.length || 1;
  dashLineChart(wrap, {
    id: 'dash-seo', invert: true, lo, hi, ticks, fmtAxis: v => String(v), height: 300,
    rotateLabels: true, allDots: s.series.length <= 31,
    dateLabel: d => `${MONTHS[d.getMonth()]}-${String(d.getDate()).padStart(2, '0')}`,
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
  defaultHidden: ['urls', 'intent'],
  storageKey: 'galaxis-demo:seo-keyword-columns-hidden-v2'
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

// ---------- Products panel (client dashboard) ----------
// Products & Connections (Figma 6371:9127, 23/10/2026): one panel of the products this workspace uses, four cards
// per row, styled like the Integrations cards. Each card: logo, name, sub-line (lane, or the Google / Meta pills for
// Ads Performance), Open (external-link icon) and Manage (settings icon; not in the Figma), status, connected-on date, description. Built from workspaceProducts / adAccounts, so it matches Integrations.

// Status of one entry: [dot colour, label]. Matches integStatusDots().
function dashEntryStatus(e) {
  if (!e) return ['grey', 'Not connected'];
  if (e.status === 'error') return ['red', 'Error'];
  if (e.status === 'pending') return ['orange', 'Pending setup'];
  if (e.status === 'disabled') return ['grey', 'Disabled'];
  if (!e.active) return ['grey', 'Inactive'];
  return ['green', e.routedVia ? `Via ${productById(e.routedVia)?.name || 'CRM'}` : 'Connected'];
}

// Opening an OOm product: its web app in a new tab (Galaxis CRM, Aurix, SEO Cloud; see products[].url).
function dashOpenProduct(pid) { openProductApp(pid); }
function dashIntegAction(pid, mode) {
  if (typeof integOpenProduct === 'function') integOpenProduct(pid, mode);
  else navigate('integrations');
}
// Ads Performance "Open": the Ad Performance tab on this page.
function dashOpenAds() {
  if (dashTab() !== 'ads') dashSetTab('ads');
  document.querySelector('.dash-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Products shown: OOm products, then the one product per lane (CRM, Automated Chat, Call Tracking; PRODUCT_LANES).
const DASH_HUB_OOM = ['crm-lite', 'aurix', 'seo-cloud'];
function dashHubProductIds() { return [...new Set([...DASH_HUB_OOM, ...Object.values(PRODUCT_LANES).flatMap(l => l.ids())])]; }

// Connected-on date. [PLACEHOLDER] mock: the entry's connectedAt, else a fixed date per workspace and product.
function dashHubSince(wsId, key, e) {
  if (e?.connectedAt) return e.connectedAt;
  const d = new Date(); d.setDate(d.getDate() - 60 - Math.floor(dashRng(`${wsId}:${key}:since`)() * 600));
  return toDateInput(d);
}
// Short descriptions for the cards (the Figma's SEO Cloud copy; product descriptions otherwise).
const DASH_HUB_DESC = { 'seo-cloud': 'Optimising and tracking keyword ranking.' };

function dashHubPanel(ws) {
  if (!ws) return '';
  const entries = wsProducts(ws.id);
  const live = e => !!e && e.status === 'connected' && e.active;
  const needsFix = e => !!e && (e.status === 'error' || e.status === 'pending');
  // Same parts as the Integrations cards: round product logo, card title, sub-line, status dot.
  const card = ({ key, name, logo, sub, e, open, openTitle, manage, desc, connected = '' }) => {
    const [color, label] = dashEntryStatus(e);
    return `<div class="dash-hub-card">
      <div class="dash-hub-card-top">
        ${logo}
        <div class="grow"><div class="h-card dash-hub-name">${esc(name)}</div><div class="dash-hub-sub">${sub}</div></div>
        <span class="dash-hub-card-actions">
          <button type="button" class="kebab dash-hub-icon-btn" onclick="${open}" title="${esc(openTitle)}" aria-label="${esc(openTitle)}"><i data-lucide="square-arrow-out-up-right"></i></button>
          <button type="button" class="kebab dash-hub-icon-btn" onclick="${manage}" title="Manage ${esc(name)}" aria-label="Manage ${esc(name)}"><i data-lucide="settings"></i></button>
        </span>
      </div>
      <div class="dot-label dash-hub-status dash-hub-status-${color}"><span class="dot dot-${color}${color === 'grey' ? '' : '-strong'}"></span>${esc(label)}${connected}${needsFix(e) ? `<button type="button" class="t-link dash-hub-fix" onclick="${manage.replace("'about'", "'config'")}">Fix now</button>` : ''}</div>
      <div class="dash-hub-meta">${color === 'green' ? 'Connected' : 'Added'} on: ${esc(fmtDate(dashHubSince(ws.id, key, e)))}</div>
      <div class="dash-hub-desc">${desc}</div>
    </div>`;
  };

  // Products in use (OOm products, then one per lane), except disabled ones; Ads Performance last, as in the Figma.
  const cards = dashHubProductIds().filter(pid => entries[pid] && entries[pid].status !== 'disabled').map(pid => {
    const p = productById(pid), e = entries[pid];
    const lane = productLane(pid);
    return card({ key: pid, name: p.name, logo: productLogo(pid, 32), sub: esc(lane ? PRODUCT_LANES[lane].label : pid === 'seo-cloud' ? 'SEO' : p.category), e, open: live(e) ? `dashOpenProduct('${pid}')` : `dashIntegAction('${pid}', '${needsFix(e) ? 'config' : 'about'}')`,
      openTitle: live(e) ? `Open ${p.name}` : `Set up ${p.name}`, manage: `dashIntegAction('${pid}', 'about')`, desc: esc(DASH_HUB_DESC[pid] || p.description || '') });
  });
  // Ads Performance: the linked platforms (Google Ads, Meta Ads or both) as pills under the name.
  const plats = dashPlatforms(ws.id);
  if (plats.length) {
    // The linked platforms sit on the status line ("● Connected: Google Ads · Meta Ads"), so they read as what's connected.
    const connected = `<span class="dash-hub-plats">${plats.map(p => `<span class="chip dash-hub-plat">${platformLogo(p)}${esc(DASH_VIEW_LABEL[p])}</span>`).join('')}</span>`;
    cards.push(card({ key: 'ads', name: 'Ads Performance', logo: dashServiceIcon('ads', 32), sub: 'Ad platforms', connected, e: { status: 'connected', active: true }, open: 'dashOpenAds()', openTitle: 'View Ad Performance',
      manage: "navigate('integrations')", desc: `Results from the connected ${plats.length === 2 ? 'Google Ads and Meta Ads accounts' : `${DASH_VIEW_LABEL[plats[0]]} account`}, in one view.` }));
  }
  const connected = dashHubProductIds().filter(pid => live(entries[pid])).length + (plats.length ? 1 : 0);

  return `<section class="card dash-hub" id="dash-hub" aria-label="Products and connections">
    <div class="dash-hub-head">
      <div><h2 class="h-card">Products &amp; Connections</h2>
        <div class="card-sub">Active products connected to ${esc(ws.name)}</div></div>
      <span class="dash-hub-count"><b>${connected}</b> Connected Product${connected === 1 ? '' : 's'}</span>
    </div>
    <div class="dash-hub-grid">
      ${cards.length ? cards.join('') : `<div class="t-muted dash-hub-none">No products connected yet. <button type="button" class="t-link" onclick="navigate('integrations')">Browse integrations</button></div>`}
    </div>
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
// ---------- KPI layout variant: three panels (prototype toggle in the dev toolbar) ----------
// 'cards' = the KPI card rows (+ the Leads & Revenue section); 'panels' = one card with three panels:
// Spend & Traffic · Conversions · Leads & Revenue. Each panel (its own card): headline metric, caption, metric list.
try { state.flags.dashKpiLayout = localStorage.getItem('galaxis-demo:kpi-layout') || 'cards'; } catch (e) { state.flags.dashKpiLayout = 'cards'; }
function dashSetKpiLayout(v) {
  state.flags.dashKpiLayout = v;
  try { localStorage.setItem('galaxis-demo:kpi-layout', v); } catch (e) { /* storage unavailable: keep in memory */ }
  rerender();
}
// source: where the panel's numbers come from ("Reported by Meta", "Verified in Galaxis CRM"), so similar metrics in
// neighbouring panels (e.g. Meta's leads vs CRM leads) are never confused.
function dashKpiPanel({ eyebrow, source, label, tip, value, caption, rows, body }) {
  return `<div class="dash-kp-panel">
    <div class="dash-kp-eyebrow">${esc(eyebrow)}${source ? `<span class="dash-kp-source">${esc(source)}</span>` : ''}</div>
    ${body || `<div class="dash-kp-label">${esc(label)} ${tip ? infoTip(tip) : ''}</div>
    <div class="dash-kp-value">${value}</div>
    <div class="dash-kp-caption">${caption}</div>`}
    <div class="dash-kp-rows">${rows.map(([k, v, sw]) => `<div class="dash-kp-row"><span>${sw ? `<i class="dash-kp-sw ${sw}"></i>` : ''}${k}</span><b>${v}</b></div>`).join('')}</div>
  </div>`;
}
// Leads & Revenue panel (CRM), from the same totals as the Leads & Revenue section.
function dashKpiCrmPanel(t, crm) {
  if (!crm) return dashKpiPanel({ eyebrow: 'Leads & Revenue', source: 'Needs a CRM', rows: [['Attributed Revenue', '—'], ['ROAS', '—'], ['Attributed Leads', '—'], ['Cost per CRM Lead', '—'], ['Converted Leads', '—']],
    body: `<div class="dash-kp-locked"><i data-lucide="lock"></i><div><div class="t-bold">Connect a CRM to unlock leads, revenue and ROAS</div>
      <div class="dash-kp-caption">Lead and revenue attribution needs one connected CRM.</div>
      <button type="button" class="btn btn-primary btn-sm" onclick="navigate('integrations')"><i data-lucide="plug"></i>Connect CRM</button></div></div>` });
  // Headline: the outcome (attributed revenue, ROAS on the caption line); leads are in the list, labelled as CRM leads.
  return dashKpiPanel({ eyebrow: 'Leads & Revenue', source: `Verified in ${crm.name}`, label: 'Attributed Revenue', tip: 'Closed revenue from converted leads in your CRM, credited to these ads by the selected attribution model.',
    value: fmtMoney(t.revenue), caption: t.spend ? `On <b class="dash-kp-hl">${fmtMoney(t.spend)}</b> ad spend • <b class="dash-kp-hl">${t.roas.toFixed(2)}x</b> <b class="dash-kp-strong">ROAS</b>` : 'No ad spend in this period',
    rows: [['Attributed Leads (CRM)', fmtNum(t.leads)], ['Cost per CRM Lead', t.leads ? fmtMoney(t.cpl, 2) : '—'], ['Converted Leads', fmtNum(t.converted)],
      ['Lead-to-Customer Rate', fmtPct(t.convRate, 1)], ['Avg. Deal', t.converted ? fmtMoney(t.revenue / t.converted) : '—']] });
}
// p: 'all' (All Platforms) | 'google' | 'meta'. Each tab keeps its own metric names.
function dashKpiPanels(ws, p, m) {
  const crm = activeCrm(ws.id);
  const both = dashPlatforms(ws.id).length > 1;
  const model = state.ui.dashModel;
  const modelSel = crm ? `<label class="dash-model"><span>Attribution model</span>
      <select class="select" onchange="dashSetModel(this.value)" aria-label="Attribution model">${DASH_MODELS.map(([v, l]) => `<option value="${v}" ${v === model ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : '';
  let head, p1, p2;
  if (p === 'all') {
    const t = m.total, g = m.byPlatform.google, mt = m.byPlatform.meta;
    const budget = Math.round(wsAdBudget(ws.id) * m.days / 30), used = budget ? t.spend / budget * 100 : 0;
    const unique = Math.round(t.impressions * (0.6 + dashRng(`${ws.id}:reach`)() * 0.12));
    const gShare = g && t.conversions ? g.conversions / t.conversions * 100 : 0;
    head = dashSectionHead('Ad Performance', `Platform-reported results from ${dashPlatforms(ws.id).map(x => PLATFORM_NAME[x]).join(' and ')} Ads for the selected dates.`, modelSel);
    p1 = dashKpiPanel({ eyebrow: 'Spend & Traffic', label: 'Total Ads Spend', tip: 'Total advertising spend reported by connected ad platforms.', value: fmtMoney(t.spend, 2),
      caption: `<b class="${used >= 100 ? 't-error' : used >= 85 ? 't-warning' : ''}">${Math.round(used)}%</b> of the ${fmtMoney(budget)} budget used`,
      rows: [['Impressions', fmtNum(t.impressions)], ['Unique Users', fmtNum(unique)], ['Clicks', fmtNum(t.clicks)], ['Click-Through Rate (CTR)', fmtPct(t.ctr)], ['Avg. Cost per Click (CPC)', fmtMoney(t.cpc, 2)]] });
    // Platform split as text (no bars in this look): Google Ads X% · Meta Ads Y%.
    const legend = g && mt ? `Google Ads <b>${Math.round(gShare)}%</b> · Meta Ads <b>${100 - Math.round(gShare)}%</b>` : `<b>100%</b> from ${g ? 'Google' : 'Meta'} Ads`;
    p2 = dashKpiPanel({ eyebrow: 'Conversions', source: `Reported by ${g && mt ? 'Google and Meta' : g ? 'Google' : 'Meta'}`, label: 'Platform Conversions', tip: 'Platform-reported conversion actions.', value: fmtNum(t.conversions),
      caption: legend,
      rows: [['Cost per Conversion', t.conversions ? fmtMoney(t.cpa, 2) : '—'], ['Conversion Rate', t.clicks ? fmtPct(t.conversions / t.clicks * 100) : '—'],
        ...(g ? [['Google Ads', `${fmtNum(g.conversions)} • ${fmtMoney(g.cpa, 2)}`]] : []),
        ...(mt ? [['Meta Ads', `${fmtNum(mt.conversions)} • ${fmtMoney(mt.cpa, 2)}`]] : [])] });
    return `${head}<div class="dash-kp">${p1}${p2}${dashKpiCrmPanel(t, crm)}</div>`;
  }
  const d = dashPfData(ws.id, p), t = d.total;
  // This platform's share of workspace spend, as text (no bars in this look).
  const share = both && m.total.spend ? t.spend / m.total.spend * 100 : null;
  const shareCap = share !== null ? `<b>${Math.round(share)}%</b> of workspace ad spend` : `Across <b>${d.campaign.length}</b> campaigns`;
  const acct = wsAdAccounts(ws.id).filter(a => a.platform === p).map(a => `${esc(a.name)} (${esc(a.id)})`).join(', ');
  head = dashSectionHead(DASH_VIEW_LABEL[p], `Platform-reported results from ${acct} for the selected dates, under ${PLATFORM_NAME[p]}'s own metric names. SGD · Asia/Singapore.`, modelSel);
  if (p === 'google') {
    p1 = dashKpiPanel({ eyebrow: 'Spend & Traffic', label: 'Cost', tip: DASH_SHEET.cost, value: fmtMoney(t.spend, 2), caption: shareCap,
      rows: [['Impr.', fmtNum(t.impressions)], ['Avg. CPM', fmtMoney(t.cpm, 2)], ['Clicks', fmtNum(t.clicks)], ['CTR', fmtPct(t.ctr)], ['Avg. CPC', fmtMoney(t.cpc, 2)]] });
    p2 = dashKpiPanel({ eyebrow: 'Conversions', source: 'Reported by Google', label: 'Conversions', tip: DASH_SHEET.conversions, value: fmtNum(t.conversions), caption: `Across <b>${d.campaign.length}</b> campaigns`,
      rows: [['Cost / conv.', t.conversions ? fmtMoney(t.cpa, 2) : '—'], ['Conv. rate', fmtPct(t.cvr)], ['All conv.', fmtNum(t.allConv)], ['Conv. value', fmtMoney(t.convValue)], ['Conv. value / cost', t.spend ? t.pRoas.toFixed(2) : '—']] });
  } else {
    p1 = dashKpiPanel({ eyebrow: 'Spend & Traffic', label: 'Amount spent', tip: DASH_SHEET.cost, value: fmtMoney(t.spend, 2), caption: shareCap,
      rows: [['Reach', fmtNum(t.reach)], ['Frequency', t.freq.toFixed(2)], ['Impressions', fmtNum(t.impressions)], ['CPM (cost per 1,000 impressions)', fmtMoney(t.cpm, 2)],
        ['Link clicks', fmtNum(t.clicks)], ['CTR (link click-through rate)', fmtPct(t.ctr)], ['CPC (cost per link click)', fmtMoney(t.cpc, 2)]] });
    p2 = dashKpiPanel({ eyebrow: 'Conversions', source: 'Reported by Meta', label: 'Leads', tip: DASH_SHEET.leads, value: fmtNum(t.pLeads), caption: `Across <b>${d.campaign.length}</b> campaigns`,
      rows: [['Cost per lead', t.pLeads ? fmtMoney(t.cpLead, 2) : '—'], ['Leads ÷ link clicks', t.clicks ? fmtPct(t.pLeads / t.clicks * 100) : '—'], ['Purchases', fmtNum(t.purchases || 0)], ['Purchases conversion value', fmtMoney(t.convValue)],
        ['Purchase ROAS (return on ad spend)', t.spend ? t.pRoas.toFixed(2) : '—']] });
  }
  return `${head}<div class="dash-kp">${p1}${p2}${dashKpiCrmPanel(t, crm)}</div>`;
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
    cpl: 'Cost per CRM lead: total ad spend ÷ leads attributed in your CRM (not the platform-reported cost per lead).',
    converted: 'Attributed leads marked as converted (won) in your CRM.',
    revenue: 'Closed revenue from converted leads, credited to ads by the selected attribution model.',
    roas: 'Return on ad spend: attributed revenue ÷ total ad spend.'
  };
  const kpis = [['Attributed Leads', tips.leads], ['Cost per CRM Lead', tips.cpl], ['Converted Leads', tips.converted], ['Attributed Revenue', tips.revenue], ['ROAS', tips.roas]];
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
    ${dashSectionHead('Leads & Revenue', `Verified in ${crm.name}: leads and closed revenue credited to your ads by the selected attribution model.`, `<label class="dash-model"><span>Attribution model</span>
        <select class="select" onchange="dashSetModel(this.value)" aria-label="Attribution model">${DASH_MODELS.map(([v, l]) => `<option value="${v}" ${v === model ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        ${infoTip('Multi-Touch gives 40% of the credit to the first touch, 40% to the last touch and splits 20% across the touches in between. First-Touch and Last-Touch give all the credit to one touch.')}
      </label>`)}
    <div class="grid-5 dash-kpis">
      ${dashKpi('Attributed Leads', tips.leads, fmtNum(t.leads), t.conversions ? `<b>${fmtPct(t.leads / t.conversions * 100, 0)}</b> of platform conversions` : 'From Google and Meta ads')}
      ${dashKpi('Cost per CRM Lead', tips.cpl, t.leads ? fmtMoney(t.cpl, 2) : '—', t.conversions ? `vs <b>${fmtMoney(t.cpa, 2)}</b> per conversion` : 'Spend ÷ attributed leads')}
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
      ${datePresetHTML('client', 'dashRerender')}
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
  { key: 'spend', group: 'details', label: 'Spend', tip: 'Amount spent on your campaign.', fmt: v => fmtMoney(v) },
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
// Name and Action are always shown; every other column (Status included) can be hidden or collapsed with its group.
// Overview group: Ad Format and Status, shown before the metrics (Spend joins them from DASH_CT_COLS).
const DASH_CT_DETAIL_COLS = [{ key: 'format', group: 'details', label: 'Ad Format' }, { key: 'status', group: 'details', label: 'Status' }];
registerColumnPicker('campaigns', {
  columns: () => DASH_CT_DETAIL_COLS.concat(DASH_CT_COLS, activeCrm(state.ctx) ? DASH_CT_CRM_COLS : []),
  groups: [['details', 'Overview', { summary: 'spend', tone: 'neutral' }], ['delivery', 'Impressions', { summary: 'impressions', tone: 'ads' }],
    ['clicks', 'Clicks', { summary: 'ctr', tone: 'ads2' }], ['conversions', 'Conversions', { summary: 'conversions', tone: 'ads' }],
    ['engagement', 'Engagement', { summary: 'engRate', tone: 'ads2' }], ['crm', 'CRM', { summary: 'roas', tone: 'crm' }]],
  collapsible: true,
  note: 'Name and Action are always shown',
  onChange: 'dashRefreshCampaignTable',
  // Default view (22/10/2026): every column shown, every metric group collapsed to its summary column;
  // Overview stays expanded. Keys bumped (v5 / v3, 23/10/2026) when the collapsible groups came back, so every viewer gets this default.
  defaultHidden: [],
  defaultCollapsed: ['delivery', 'clicks', 'conversions', 'engagement', 'crm'],
  storageKey: 'galaxis-demo:campaign-columns-hidden-v5',
  collapsedKey: 'galaxis-demo:campaign-groups-collapsed-v3'
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
  // Grouped, collapsible columns (core.js colLayout): Overview · Impressions · Clicks · Conversions · Engagement · CRM.
  const layout = colLayout('campaigns', DASH_CT_DETAIL_COLS.concat(metricCols).filter(c => colVisible('campaigns', c.key)));
  const cols = layout.columns;
  const colDef = Object.fromEntries(metricCols.map(c => [c.key, c]));
  const fn = 'dashRefreshCampaignTable';
  const head = `${colGroupHeaderRow('campaigns', layout, { lead: 1, trail: next ? 1 : 0 })}
    <tr><th>${sortHeader('dash-ct', 'name', DASH_NAME_COL[level], fn)}</th>${cols.map(c => `<th class="${colCellClass(c)}"${colDragAttrs('campaigns', 'col', c.key, c.group)}${colDef[c.key] ? ` title="${esc(colDef[c.key].tip)}"` : ''}>${sortHeader('dash-ct', c.key, c.label, fn)}</th>`).join('')}${next ? '<th>Action</th>' : ''}</tr>`;
  const cell = (e, c) => {
    if (c === 'format') return dashFormatCell(e.formats);
    if (c === 'status') return statusPill(DASH_STATUS_KEY[e.status], e.status);
    const d = colDef[c];
    if (d.needs && !e[d.needs]) return '<span class="t-muted">—</span>';
    const text = d.fmt(e[c] || 0);
    return d.quality ? dashDot(text, dashQuality(e[c], ref[c], d.quality === 'high')) : text;
  };
  const body = page.map(e => `
    <tr ${next ? `class="clickable" onclick="dashDrill('${q(e.id)}')"` : ''}>
      <td>${dashNameCell(e, level)}</td>
      ${cols.map(c => `<td class="dash-nowrap ${colCellClass(c)}">${cell(e, c.key)}</td>`).join('')}
      ${next ? `<td onclick="event.stopPropagation()">${rowMenu(`dash-ctm-${dashHash(e.id)}`, [{ label: `View ${DASH_LEVEL_TAB[next].toLowerCase()} (${e.childCount})`, icon: 'arrow-right', onClick: `dashDrill('${q(e.id)}')` }])}</td>` : ''}
    </tr>`).join('');
  const drill = u.dashDrill ? `<div class="dash-drill"><span>Filtered for ${DASH_LEVEL_LABEL[u.dashDrill.level]}: <b>${esc(u.dashDrill.name)}</b></span><button type="button" class="chip-remove" onclick="dashClearDrill()" aria-label="Clear filter"><i data-lucide="x"></i></button></div>` : '';
  return `${dashEntityChips(byId)}${drill}
    <div class="table-wrap dash-table-wrap"><table class="table table-wrap-heads">
      <thead>${head}</thead>
      <tbody>${body || `<tr><td colspan="${cols.length + 1 + (next ? 1 : 0)}" class="table-empty">No data matches criteria.</td></tr>`}</tbody>
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

// totals: the figures the days add up to (default: the workspace total); seed: the random-stream prefix
// (default: the workspace id, so the All Platforms chart keeps its shape). Platform views pass their own.
function dashDailySeries(totals, seed) {
  const ws = currentWs();
  const tot = totals || dashMetrics(ws.id, 'client').total;
  const key = seed || ws.id;
  const range = resolveDateRange(state.dateFilters.client);
  const days = dateRangeDays('client');
  const start = new Date((range ? range.start : toDateInput(new Date())) + 'T00:00:00');
  const phase = dashRng(`${key}:phase`)() * 6;
  const pts = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const r = dashRng(`${key}:${toDateInput(d)}`);
    const dow = d.getDay();
    const w = Math.max(0.2, 1 + 0.28 * Math.sin(i / 3.1 + phase) + (dow === 0 || dow === 6 ? -0.16 : 0.04) + 0.14 * (r() - 0.5));
    pts.push({ d, w, wc: w * (0.85 + r() * 0.3), wv: w * (0.75 + r() * 0.5) });
  }
  const sw = pts.reduce((s, p) => s + p.w, 0), sc = pts.reduce((s, p) => s + p.wc, 0), sv = pts.reduce((s, p) => s + p.wv, 0);
  return pts.map(p => ({
    d: p.d,
    spend: tot.spend * p.w / sw,
    clicks: Math.round(tot.clicks * p.wc / sc),
    conversions: Math.round(tot.conversions * p.wv / sv)
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
// o: { id, series: [{ d: Date, v }], lo, hi, ticks, fmtAxis, invert, tip(i), height,
//      dateLabel(d) (x-axis text), rotateLabels (angled x labels), allDots (a dot on every point) }
function dashLineChart(wrap, o) {
  if (!wrap) return;
  const svg = wrap.querySelector('svg');
  const series = o.series;
  const n = series.length;
  const W = Math.max(320, wrap.clientWidth || 600), H = o.height || 280;
  const p = { l: 18 + Math.max(...o.ticks.map(v => o.fmtAxis(v).length)) * 7, r: 16, t: 12, b: o.rotateLabels ? 54 : 34 };
  const iw = W - p.l - p.r, ih = H - p.t - p.b;
  const span = (o.hi - o.lo) || 1;
  const x = i => p.l + (n === 1 ? iw / 2 : i * iw / (n - 1));
  const y = v => o.invert ? p.t + (v - o.lo) / span * ih : p.t + ih - (v - o.lo) / span * ih;
  const ticks = n <= 6 ? series.map((_, i) => i) : Array.from({ length: 6 }, (_, j) => Math.round(j * (n - 1) / 5));
  const lbl = o.dateLabel || (d => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`);
  const bottom = o.invert ? o.hi : o.lo;
  let out = `<defs><linearGradient id="${o.id}-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#398FF7" stop-opacity=".14"/><stop offset="1" stop-color="#398FF7" stop-opacity="0"/></linearGradient></defs>`;
  o.ticks.forEach(v => {
    out += `<text x="${p.l - 14}" y="${y(v) + 4}" text-anchor="end" class="dash-axis">${o.fmtAxis(v)}</text>`;
    if (v !== bottom) out += `<line x1="${p.l}" x2="${W - p.r}" y1="${y(v)}" y2="${y(v)}" class="dash-grid"/>`;
  });
  out += `<line x1="${p.l}" y1="${p.t}" x2="${p.l}" y2="${p.t + ih}" class="dash-axis-line"/><line x1="${p.l}" y1="${p.t + ih}" x2="${W - p.r}" y2="${p.t + ih}" class="dash-axis-line"/>`;
  ticks.forEach(i => {
    out += o.rotateLabels
      ? `<text x="${x(i)}" y="${p.t + ih + 14}" text-anchor="end" transform="rotate(-45 ${x(i)} ${p.t + ih + 14})" class="dash-axis">${lbl(series[i].d)}</text>`
      : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="dash-axis">${lbl(series[i].d)}</text>`;
  });
  const pts = series.map((s, i) => [x(i), y(s.v)]);
  const line = dashSmoothPath(pts, p.t + ih);
  out += `<path d="${line} L ${x(n - 1)} ${p.t + ih} L ${x(0)} ${p.t + ih} Z" fill="url(#${o.id}-area)"/>`;
  out += `<path d="${line}" fill="none" stroke="#398FF7" stroke-width="1.75" stroke-linejoin="round"/>`;
  (o.allDots ? series.map((_, i) => i) : ticks).forEach(i => { out += `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="${o.allDots ? 3 : 3.5}" fill="#66ACFD" stroke="#398FF7" stroke-width="1"/>`; });
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
// AD PERFORMANCE › PLATFORM VIEWS (Google Ads, Meta Ads)
// Native-report replicas: the platform's own levels, attribute columns and every metric it has in the
// Google & Meta Ads Metrics sheet, under the platform's own column names. Built on the same ad rows as the
// consolidated table (dashMetrics), so Cost / Impressions / Clicks / Conversions always equal its platform row.
// New metrics use their own random streams (`:platform-attrs`, `:platform-ext`, `:keywords`, `:kw-split`).
// =====================================================================
const DASH_VIEW_LABEL = { all: 'All Platforms', google: 'Google Ads', meta: 'Meta Ads' };
const DASH_PF_LEVELS = { google: ['campaign', 'adgroup', 'ad', 'keyword'], meta: ['campaign', 'adgroup', 'ad'] };
const DASH_PF_LEVEL_TAB = { google: { campaign: 'Campaigns', adgroup: 'Ad groups', ad: 'Ads', keyword: 'Keywords' }, meta: { campaign: 'Campaigns', adgroup: 'Ad sets', ad: 'Ads' } };
const DASH_PF_LEVEL_ONE = { google: { campaign: 'Campaign', adgroup: 'Ad group', ad: 'Ad', keyword: 'Keyword' }, meta: { campaign: 'Campaign', adgroup: 'Ad set', ad: 'Ad' } };
const DASH_PF_NAME_COL = { google: { campaign: 'Campaign', adgroup: 'Ad group', ad: 'Ad', keyword: 'Keyword' }, meta: { campaign: 'Campaign name', adgroup: 'Ad set name', ad: 'Ad name' } };
const DASH_PF_FN = { google: 'dashPfRefreshGoogle', meta: 'dashPfRefreshMeta' };

// Native attributes (derived from the campaign name, the ad format and a per-entity random stream).
const DASH_G_CAMP_TYPE = { 'Search Campaign': 'Search', 'Brand Search': 'Search', 'Display Remarketing': 'Display', 'Performance Max': 'Performance Max', 'YouTube Awareness': 'Video' };
const DASH_G_TYPES = ['Search', 'Display', 'Video', 'Performance Max'];
const DASH_G_BID = { Search: ['Maximise conversions', 'Target CPA', 'Manual CPC', 'Maximise clicks'], Display: ['Target CPA', 'Maximise conversions'], Video: ['Target CPM', 'Maximum CPV'], 'Performance Max': ['Maximise conversion value', 'Target ROAS'] };
const DASH_G_AG_TYPE = { Search: 'Search standard', Display: 'Display standard', Video: 'Video responsive', 'Performance Max': 'Asset group' };
const DASH_G_AD_TYPE = { 'Text/Search': 'Responsive search ad', Image: 'Responsive display ad', Video: 'Video responsive ad' };
const DASH_G_STATUS = { 'Active': 'Enabled', 'Paused': 'Paused' };
const dashGStatus = e => e.limited ? 'Limited' : DASH_G_STATUS[e.status];
const DASH_G_STATUSES = ['Enabled', 'Limited', 'Paused'];
const DASH_G_MATCH = ['Exact', 'Phrase', 'Broad'];
// Keyword templates: {b} = brand (first word of the workspace name), {i} = industry. Placeholder terms only.
const DASH_KW_POOL = ['{b}', '{b} singapore', '{b} {i}', '{i} singapore', '{i} services', '{i} company near me', '{i} agency', 'affordable {i}', '{i} consultation', '{i} pricing', '{b} reviews', '{i} solutions sg'];
const DASH_M_OBJECTIVE = { 'Paid Social Campaign': 'Traffic', 'Lead Gen - Instant Forms': 'Leads', 'Retargeting - Site Visitors': 'Sales', 'Awareness Reach': 'Awareness', 'Advantage+ Catalogue': 'Sales' };
const DASH_M_OBJECTIVES = ['Leads', 'Sales', 'Traffic', 'Awareness', 'Engagement'];
const DASH_M_GOAL = { Leads: 'Leads', Sales: 'Conversions', Traffic: 'Landing page views', Awareness: 'Reach', Engagement: 'Post engagement' };
const DASH_M_DELIVERIES = ['Active', 'Learning', 'Learning limited', 'Paused'];
const DASH_M_FORMAT = { Image: 'Single image', Video: 'Single video', Carousel: 'Carousel' };
const DASH_M_ATTRIBUTION = '7-day click, 1-day view';
const DASH_PF_STATUS_DOT = { Enabled: 'dot-green', Active: 'dot-green', Learning: 'dot-blue', Limited: 'dot-orange', 'Learning limited': 'dot-orange', Paused: 'dot-grey' };
// Extra summable metrics for the platform views (on top of DASH_SUM_KEYS). si* = Search impression-share
// building blocks (eligible impressions etc.), v* = video, the rest are platform counts.
const DASH_PF_SUM_KEYS = ['allConv', 'siImpr', 'siElig', 'siTop', 'siAbs', 'siRank', 'siBudget', 'vImpr', 'vViews', 'v25', 'v50', 'v75', 'v100', 'storeVisits',
  'allClicks', 'lpv', 'shares', 'saves', 'igFollows', 'igVisits', 'msgs', 'thruplays', 'addsToCart', 'checkouts'];
const DASH_PF_INT_KEYS = new Set(['impressions', 'reach', 'clicks', 'conversions', 'pLeads', 'purchases', 'engagements', 'leads', 'converted', 'allConv', 'vViews', 'storeVisits',
  'allClicks', 'lpv', 'shares', 'saves', 'igFollows', 'igVisits', 'msgs', 'thruplays', 'v25', 'v50', 'v75', 'v100', 'addsToCart', 'checkouts']);
dashCache.pfStatic = {};
dashCache.pf = {};

// Definitions from the metric sheet (Metrics (Original) › Definition). Rows the sheet leaves blank use
// prototype wording, marked "Not in the sheet" in the spec.
const DASH_SHEET = {
  cost: 'Amount spent on your campaign.',
  impressions: 'Total number of times the ad was shown on screen.',
  reach: 'Estimated number of unique individuals who saw the ad.',
  cpm: 'The average cost to show the ad 1,000 times.',
  freq: 'Average number of times each unique person saw the ad.',
  clicks: 'Number of clicks on links within the ad that direct users to specified destinations (like your website).',
  allClicks: 'The number of clicks, taps or swipes on your ads.',
  ctr: 'Percentage of impressions that resulted in a click.',
  ctrAll: 'The percentage of impressions where a click (all) occurred out of the total number of impressions.',
  cpc: 'Average cost paid for each link click.',
  cpcAll: 'The average cost for each click (all).',
  lpv: 'Number of times a person clicked the ad and the destination page successfully loaded.',
  cplpv: 'Average cost for each landing page view.',
  leads: 'Total number of generated leads, sign-ups, or form submissions.',
  cpLead: 'Average cost required to generate one successful lead.',
  conversions: 'An action that a customer takes after interacting with your ad, such as making a purchase, signing up for a newsletter, or calling your business.',
  allConv: 'Total number of conversions driven by Google Ads, including primary, secondary, and cross-device conversion actions.',
  cvr: 'Percentage of clicks that successfully resulted in a lead submission.',
  purchases: 'Total number of completed transactions or sales.',
  cpp: 'Average cost required to acquire one successful sale.',
  roas: 'Revenue generated for every dollar spent on the campaign.',
  convValue: 'Total monetary value of the purchases driven by the advertising efforts.',
  addsToCart: 'Number of times a product was added to the shopping cart by a user.',
  checkouts: 'Number of times a user started the checkout process.',
  is: 'The percentage of impressions your ads receive compared to the total number of impressions they were eligible to get on the Search Network.',
  topIs: 'The percentage of impressions your ads received in top locations above organic search results relative to the total estimated impressions your ads were eligible to receive in those top locations.',
  absIs: 'Percentage of eligible impressions your ad received in the absolute top position as the very first ad on the page.',
  lostRank: 'Percentage of time your ads did not show on the Search Network due to poor Ad Rank.',
  lostBudget: 'Percentage of time your ads did not show on the Search Network due to insufficient budget.',
  storeVisits: 'Number of visits to physical locations after interacting with Google Ads.',
  thruplays: 'The number of times your video was played to completion, or for at least 15 seconds.',
  vViews: 'ThruView views. The watch time counted varies by ad format: skippable in-stream ads 30 seconds; in-feed video and Shorts ads 10 seconds. Also counted when someone watches the entire video ad, regardless of length, or clicks or taps on it.',
  engRate: 'Percentage of people who interacted with the ad after seeing it.',
  engagements: 'Total actions taken on the ad (likes, comments, shares, video views, ad expansions).',
  cpe: 'Average cost for each interaction with the ad.',
  // Not defined in the sheet (prototype wording, to confirm):
  msgs: 'Number of times people started a messaging conversation with your business after interacting with the ad.',
  cpMsg: 'Average cost for each messaging conversation started.',
  shares: 'Number of times people shared the ad post.',
  saves: 'Number of times people saved the ad post.',
  igFollows: 'Number of Instagram follows gained from the ad.',
  igVisits: 'Number of visits to your Instagram profile from the ad.',
  mVideo: n => `Number of times your video was played to ${n}% of its length, including plays that skipped to this point.`,
  gVideo: n => `Percentage of video impressions where the viewer watched ${n}% of the video.`
};

// ---------- Views: All Platforms | Google Ads | Meta Ads ----------
// All Platforms appears with both platforms linked (or more than one ad account); a platform view appears when
// that platform is linked. state.params.view deep-links a view; state.ui.dashAdView remembers the last one.
function dashAdViews(ws) {
  const plats = dashPlatforms(ws.id);
  const accounts = wsAdAccounts(ws.id).filter(a => plats.includes(a.platform));
  return [...(plats.length > 1 || accounts.length > 1 ? ['all'] : []), ...plats];
}
function dashAdView(ws) {
  const views = dashAdViews(ws);
  const v = state.params.view || state.ui.dashAdView || 'all';
  return views.includes(v) ? v : views[0] || 'all';
}
function dashSetAdView(v) {
  state.params = { ...state.params, tab: 'ads', view: v };
  state.ui.dashAdView = v;
  closeAllPopovers();
  rerender();
}
function dashViewLogo(p) { return `<span class="dash-view-logo">${platformLogo(p)}</span>`; }
function dashViewSwitcher(ws, view) {
  const views = dashAdViews(ws);
  if (!views.length) return '';
  const logos = v => v === 'all' ? `<span class="dash-view-logos">${dashPlatforms(ws.id).map(dashViewLogo).join('')}</span>` : dashViewLogo(v);
  const btn = v => `<button type="button" role="tab" aria-selected="${v === view}" class="${v === view ? 'active' : ''}" onclick="dashSetAdView('${v}')">${logos(v)}${DASH_VIEW_LABEL[v]}</button>`;
  const note = views.length === 1 ? `<span class="dash-views-note">Only ${DASH_VIEW_LABEL[views[0]]} is linked to this workspace.</span>` : '';
  return `<div class="dash-views"><div class="seg dash-view-seg" role="tablist" aria-label="Ad platform view">${views.map(btn).join('')}</div>${note}</div>`;
}

// ---------- Mock data ----------
function dashSlug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
// Date-independent attributes per campaign / ad group / ad, and the Google keyword list.
function dashPfStatic(wsId) {
  const key = `${wsId}|${wsPlatforms(wsId).join(',')}`;
  if (dashCache.pfStatic[key]) return dashCache.pfStatic[key];
  const t = dashTree(wsId);
  const ws = wsById(wsId);
  const site = ws.site || 'www.example.com';
  const attrs = {}, keywords = [];
  const base = pred => t.ads.filter(pred).reduce((s, a) => ({ spend: s.spend + a.base.spend, clicks: s.clicks + a.base.clicks }), { spend: 0, clicks: 0 });
  const round5 = v => Math.max(5, Math.round(v / 5) * 5);
  t.campaigns.forEach(c => {
    const r = dashRng(`${c.id}:platform-attrs`);
    const daily = round5(base(a => a.path.campaign === c.id).spend / 30 * (1.1 + r() * 0.4));
    if (c.platform === 'google') {
      const type = DASH_G_CAMP_TYPE[c.name] || 'Search';
      const bids = DASH_G_BID[type];
      attrs[c.id] = { pfStatus: dashGStatus(c), campType: type, bid: bids[Math.floor(r() * bids.length)], budget: { amount: daily, kind: 'daily', daily } };
    } else {
      const objective = DASH_M_OBJECTIVE[c.name] || 'Traffic';
      const cbo = r() < 0.55, lifetime = r() < 0.35;
      attrs[c.id] = {
        pfStatus: c.status === 'Paused' ? 'Paused' : c.limited ? 'Learning limited' : 'Active', campType: objective, cbo, attribution: DASH_M_ATTRIBUTION,
        budget: cbo ? (lifetime ? { amount: daily * 30, kind: 'lifetime', daily } : { amount: daily, kind: 'daily', daily }) : { note: 'Using ad set budget' }
      };
    }
  });
  t.adGroups.forEach(g => {
    const c = attrs[g.path.campaign];
    const r = dashRng(`${g.id}:platform-attrs`);
    const roll = r(), spread = r();
    const b = base(a => a.path.adgroup === g.id);
    if (g.platform === 'google') {
      attrs[g.id] = { pfStatus: dashGStatus(g), campType: c.campType, agType: DASH_G_AG_TYPE[c.campType] };
      if (c.campType !== 'Search') return;
      const kr = dashRng(`${g.id}:keywords`);
      const brand = ws.name.split(/\s+/)[0].toLowerCase(), ind = (ws.industry || 'services').toLowerCase();
      const cpc = b.clicks ? b.spend / b.clicks : 1;
      const n = 3 + Math.floor(kr() * 4);
      dashShuffle(DASH_KW_POOL, kr).slice(0, n).forEach((tpl, i) => {
        const id = `${g.id}~k${i + 1}`;
        const match = DASH_G_MATCH[Math.floor(kr() * 3)];
        const qs = Math.max(1, Math.min(10, Math.round(2.5 + kr() * 7.5)));
        const w = 0.25 + kr();
        const paused = kr() < 0.1;
        keywords.push({
          id, level: 'keyword', platform: 'google', adgroupId: g.id, name: tpl.replace('{b}', brand).replace('{i}', ind), match, qs, w,
          maxCpc: cpc * (1.15 + kr() * 0.5), pfStatus: g.status === 'Paused' || paused ? 'Paused' : 'Enabled', campType: 'Search',
          parents: [g.campaignName, g.name], campaignName: g.campaignName, adGroupName: g.name, path: { ...g.path, keyword: id }, childCount: 0
        });
      });
    } else {
      const delivery = g.status === 'Paused' ? 'Paused' : g.limited ? 'Learning limited' : roll < 0.25 ? 'Learning' : 'Active';
      const daily = round5(b.spend / 30 * (1.1 + spread * 0.4));
      attrs[g.id] = { pfStatus: delivery, campType: c.campType, attribution: DASH_M_ATTRIBUTION, optGoal: DASH_M_GOAL[c.campType],
        budget: c.cbo ? { note: 'Using campaign budget' } : { amount: daily, kind: 'daily', daily } };
    }
  });
  t.ads.forEach(a => {
    const g = attrs[a.path.adgroup];
    if (a.platform === 'google') attrs[a.id] = { pfStatus: dashGStatus(a), campType: g.campType, adType: DASH_G_AD_TYPE[a.format], finalUrl: `https://${site}/${dashSlug(a.adGroupName)}` };
    else attrs[a.id] = {
      pfStatus: a.status === 'Paused' ? 'Paused' : a.limited ? 'Learning limited' : /^Learning/.test(g.pfStatus) ? g.pfStatus : 'Active',
      campType: g.campType, adFormat: DASH_M_FORMAT[a.format], attribution: DASH_M_ATTRIBUTION
    };
  });
  return (dashCache.pfStatic[key] = { attrs, keywords });
}

// Extra platform metrics for one ad, as ratios of its (date-scaled) consolidated metrics, so they follow the
// date filter. A fixed number of draws keeps every ad's stream stable whatever branch it takes.
function dashPfAdExt(a, att) {
  const r = dashRng(`${a.id}:platform-ext`);
  const u = Array.from({ length: 16 }, () => r());
  const o = Object.fromEntries(DASH_PF_SUM_KEYS.map(k => [k, 0]));
  const video = a.format === 'Video';
  if (a.platform === 'google') {
    o.allConv = Math.round(a.conversions * (1.08 + u[0] * 0.37));
    if (att.campType === 'Search' && a.impressions) {   // impression share: Search campaigns only (10–90%)
      const is = 0.1 + u[1] * 0.8, top = is * (0.55 + u[2] * 0.35), abs = top * (0.35 + u[3] * 0.35), rank = (1 - is) * (0.35 + u[4] * 0.5);
      const elig = a.impressions / is;
      Object.assign(o, { siImpr: a.impressions, siElig: elig, siTop: elig * top, siAbs: elig * abs, siRank: elig * rank, siBudget: elig * (1 - is - rank) });
    }
    if (video) {
      const p25 = 0.55 + u[5] * 0.25, p50 = p25 * (0.6 + u[6] * 0.2), p75 = p50 * (0.6 + u[7] * 0.2), p100 = p75 * (0.55 + u[8] * 0.25);
      Object.assign(o, { vImpr: a.impressions, vViews: Math.round(a.impressions * (0.18 + u[9] * 0.2)), v25: a.impressions * p25, v50: a.impressions * p50, v75: a.impressions * p75, v100: a.impressions * p100 });
    }
    if (!video && u[10] < 0.25) o.storeVisits = Math.round(a.clicks * (0.004 + u[11] * 0.016));   // sparse
  } else {
    o.allClicks = Math.round(a.clicks * (1.5 + u[0] * 1.1));
    o.lpv = Math.round(a.clicks * (0.58 + u[1] * 0.28));
    o.shares = Math.round(a.engagements * (0.008 + u[2] * 0.027));
    o.saves = Math.round(a.engagements * (0.004 + u[3] * 0.016));
    o.igFollows = Math.round(a.engagements * (0.002 + u[4] * 0.007));
    o.igVisits = Math.round(a.engagements * (0.015 + u[5] * 0.035));
    if (u[6] < 0.4) o.msgs = Math.round(a.clicks * (0.02 + u[7] * 0.05));
    if (video) {
      const v25 = Math.round(a.impressions * (0.18 + u[8] * 0.16)), v50 = Math.round(v25 * (0.55 + u[9] * 0.2)), v75 = Math.round(v50 * (0.55 + u[10] * 0.2));
      Object.assign(o, { vImpr: a.impressions, v25, v50, v75, v100: Math.round(v75 * (0.5 + u[11] * 0.25)), thruplays: Math.round(v50 * (0.7 + u[12] * 0.25)) });
    }
    o.addsToCart = Math.round(a.purchases * (2.5 + u[13] * 3));
    o.checkouts = Math.round(a.purchases * (1.4 + u[14]));
  }
  return o;
}
function dashPfDerive(o) {
  dashDerive(o);
  const si = k => o.siElig ? o[k] / o.siElig * 100 : 0;
  o.is = si('siImpr'); o.topIs = si('siTop'); o.absIs = si('siAbs'); o.lostRank = si('siRank'); o.lostBudget = si('siBudget');
  const vr = k => o.vImpr ? o[k] / o.vImpr * 100 : 0;
  o.v25r = vr('v25'); o.v50r = vr('v50'); o.v75r = vr('v75'); o.v100r = vr('v100');
  o.ctrAll = o.impressions ? o.allClicks / o.impressions * 100 : 0;
  o.cpcAll = o.allClicks ? o.spend / o.allClicks : 0;
  o.cplpv = o.lpv ? o.spend / o.lpv : 0;
  o.cpMsg = o.msgs ? o.spend / o.msgs : 0;
  return o;
}
function dashPfSum(items) {
  const o = {};
  DASH_SUM_KEYS.concat(DASH_PF_SUM_KEYS).forEach(k => { o[k] = items.reduce((s, c) => s + (c[k] || 0), 0); });
  return dashPfDerive(o);
}
// Keywords split their ad group's metrics (counts stay whole and add up exactly); impression share varies per keyword.
function dashPfKeywords(st, adgroups) {
  const out = [];
  const keys = DASH_SUM_KEYS.concat(DASH_PF_SUM_KEYS).filter(k => !/^si/.test(k));
  adgroups.forEach(g => {
    const kws = st.keywords.filter(k => k.adgroupId === g.id);
    if (!kws.length) return;
    const r = dashRng(`${g.id}:kw-split`);
    const rows = kws.map(k => ({ ...k }));
    keys.forEach(key => {
      const w = kws.map(k => k.w * (0.8 + r() * 0.4));
      const sw = w.reduce((a, b) => a + b, 0);
      const all = g[key] || 0;
      let left = all;
      rows.forEach((row, i) => {
        if (i === rows.length - 1) { row[key] = Math.max(0, left); return; }
        const v = Math.min(left, DASH_PF_INT_KEYS.has(key) ? Math.round(all * w[i] / sw) : all * w[i] / sw);
        row[key] = v; left -= v;
      });
    });
    const gIs = g.siElig ? g.siImpr / g.siElig : 0;
    rows.forEach(row => {
      const x = r();
      if (gIs && row.impressions) {
        const is = Math.max(0.08, Math.min(0.95, gIs * (0.75 + x * 0.5)));
        const elig = row.impressions / is;
        const topF = g.siTop / g.siImpr, absF = g.siAbs / g.siTop, rankF = g.siRank / ((g.siRank + g.siBudget) || 1);
        Object.assign(row, { siImpr: row.impressions, siElig: elig, siTop: elig * is * topF, siAbs: elig * is * topF * absF, siRank: elig * (1 - is) * rankF, siBudget: elig * (1 - is) * (1 - rankF) });
      } else Object.assign(row, { siImpr: 0, siElig: 0, siTop: 0, siAbs: 0, siRank: 0, siBudget: 0 });
      out.push(dashPfDerive(row));
    });
  });
  return out;
}
// Every level for platform p under the client date filter and the attribution model (CRM columns).
function dashPfData(wsId, p) {
  const m = dashMetrics(wsId, 'client');
  const key = `${wsId}|${m.days}|${state.ui.dashModel || 'mta'}|${wsPlatforms(wsId).join(',')}|${p}`;
  if (dashCache.pf[key]) return dashCache.pf[key];
  const st = dashPfStatic(wsId);
  const ad = m.ad.filter(a => a.platform === p).map(a => dashPfDerive({ ...a, ...st.attrs[a.id], ...dashPfAdExt(a, st.attrs[a.id]) }));
  const roll = (parents, kids, lk) => parents.filter(x => x.platform === p).map(x => {
    const ks = kids.filter(c => c.path[lk] === x.id);
    return { ...x, ...st.attrs[x.id], ...dashPfSum(ks), childCount: ks.length };
  });
  const adgroup = roll(m.adgroup, ad, 'adgroup');
  const campaign = roll(m.campaign, adgroup, 'campaign');
  const keyword = p === 'google' ? dashPfKeywords(st, adgroup) : [];
  adgroup.forEach(g => { g.kwCount = keyword.filter(k => k.path.adgroup === g.id).length; });
  campaign.forEach(c => { c.kwCount = keyword.filter(k => k.path.campaign === c.id).length; });
  return (dashCache.pf[key] = { campaign, adgroup, ad, keyword, total: dashPfSum(campaign), days: m.days });
}

// ---------- Columns ----------
// t: status | text | budget | url | qs | money | money2 | int | pct | dec | roas. levels: where the column exists natively.
const DASH_PF_FMT = { money: v => fmtMoney(v), money2: v => fmtMoney(v, 2), int: v => fmtNum(Math.round(v)), pct: v => fmtPct(v), dec: v => Number(v || 0).toFixed(2), roas: v => `${Number(v || 0).toFixed(2)}x` };
function dashPfCol(key, group, label, t, tip, o = {}) { return { key, group, label, t, tip, ...o }; }
const DASH_PF_NOT_KW = ['campaign', 'adgroup', 'ad'];
const DASH_PF_COLS = {
  google: [
    dashPfCol('pfStatus', 'attr', 'Status', 'status', 'Whether the item can serve: Enabled, Limited (by budget, policy or learning) or Paused.'),
    dashPfCol('campType', 'attr', 'Campaign type', 'text', 'The campaign type set in Google Ads: Search, Display, Video or Performance Max.', { levels: ['campaign'] }),
    dashPfCol('bid', 'attr', 'Bid strategy type', 'text', 'How Google Ads sets bids for the campaign.', { levels: ['campaign'] }),
    dashPfCol('budget', 'attr', 'Budget', 'budget', 'Average daily budget set on the campaign.', { levels: ['campaign'] }),
    dashPfCol('agType', 'attr', 'Ad group type', 'text', 'The ad group type, set by the campaign type (Performance Max uses asset groups).', { levels: ['adgroup'] }),
    dashPfCol('adType', 'attr', 'Ad type', 'text', 'The ad format in Google Ads.', { levels: ['ad'] }),
    dashPfCol('finalUrl', 'attr', 'Final URL', 'url', 'The page people reach after clicking the ad.', { levels: ['ad'] }),
    dashPfCol('match', 'attr', 'Match type', 'text', 'How closely a search must match the keyword: Exact [ ], Phrase " " or Broad.', { levels: ['keyword'] }),
    dashPfCol('qs', 'attr', 'Quality Score', 'qs', 'Google\'s 1–10 estimate of the quality of the keyword, its ads and landing page.', { levels: ['keyword'] }),
    dashPfCol('maxCpc', 'attr', 'Max. CPC', 'money2', 'The most you will pay for a click on this keyword.', { levels: ['keyword'] }),
    dashPfCol('impressions', 'perf', 'Impr.', 'int', DASH_SHEET.impressions),
    dashPfCol('clicks', 'perf', 'Clicks', 'int', DASH_SHEET.clicks),
    dashPfCol('ctr', 'perf', 'CTR', 'pct', DASH_SHEET.ctr, { quality: 'high', needs: 'impressions' }),
    dashPfCol('cpc', 'perf', 'Avg. CPC', 'money2', DASH_SHEET.cpc, { quality: 'low', needs: 'clicks' }),
    dashPfCol('spend', 'perf', 'Cost', 'money2', DASH_SHEET.cost),
    dashPfCol('cpm', 'perf', 'Avg. CPM', 'money2', DASH_SHEET.cpm, { quality: 'low', needs: 'impressions' }),
    dashPfCol('engagements', 'perf', 'Interactions', 'int', DASH_SHEET.engagements),
    dashPfCol('engRate', 'perf', 'Engagement rate', 'pct', DASH_SHEET.engRate, { needs: 'impressions' }),
    dashPfCol('cpe', 'perf', 'Avg. CPE', 'money2', DASH_SHEET.cpe, { needs: 'engagements' }),
    dashPfCol('conversions', 'conv', 'Conversions', 'int', DASH_SHEET.conversions),
    dashPfCol('cvr', 'conv', 'Conv. rate', 'pct', DASH_SHEET.cvr, { needs: 'clicks' }),
    dashPfCol('cpa', 'conv', 'Cost / conv.', 'money2', `${DASH_SHEET.cpLead} Google reports cost per lead and cost per purchase as Cost / conv. of that conversion action.`, { quality: 'low', needs: 'conversions' }),
    dashPfCol('allConv', 'conv', 'All conv.', 'int', DASH_SHEET.allConv),
    dashPfCol('convValue', 'conv', 'Conv. value', 'money2', DASH_SHEET.convValue),
    dashPfCol('pRoas', 'conv', 'Conv. value / cost', 'dec', DASH_SHEET.roas, { needs: 'spend' }),
    dashPfCol('is', 'comp', 'Search impr. share', 'pct', DASH_SHEET.is, { needs: 'siElig', levels: ['campaign', 'adgroup', 'keyword'] }),
    dashPfCol('topIs', 'comp', 'Search top IS', 'pct', DASH_SHEET.topIs, { needs: 'siElig', levels: ['campaign', 'adgroup', 'keyword'] }),
    dashPfCol('absIs', 'comp', 'Search abs. top IS', 'pct', DASH_SHEET.absIs, { needs: 'siElig', levels: ['campaign', 'adgroup', 'keyword'] }),
    dashPfCol('lostRank', 'comp', 'Search lost IS (rank)', 'pct', DASH_SHEET.lostRank, { needs: 'siElig', levels: ['campaign', 'adgroup', 'keyword'] }),
    dashPfCol('lostBudget', 'comp', 'Search lost IS (budget)', 'pct', DASH_SHEET.lostBudget, { needs: 'siElig', levels: ['campaign', 'adgroup'] }),
    dashPfCol('reach', 'reach', 'Unique reach', 'int', DASH_SHEET.reach, { levels: DASH_PF_NOT_KW }),
    dashPfCol('freq', 'reach', 'Avg. impr. freq. / user', 'dec', DASH_SHEET.freq, { needs: 'reach', levels: DASH_PF_NOT_KW }),
    dashPfCol('vViews', 'video', 'Video views', 'int', DASH_SHEET.vViews, { needs: 'vImpr', levels: DASH_PF_NOT_KW }),
    ...[25, 50, 75, 100].map(n => dashPfCol(`v${n}r`, 'video', `Video played to ${n}%`, 'pct', DASH_SHEET.gVideo(n), { needs: 'vImpr', levels: DASH_PF_NOT_KW })),
    dashPfCol('storeVisits', 'store', 'Store visits', 'int', DASH_SHEET.storeVisits, { levels: DASH_PF_NOT_KW })
  ],
  meta: [
    dashPfCol('pfStatus', 'attr', 'Delivery', 'status', 'Whether the item is delivering: Active, Learning (the delivery system is still optimising), Learning limited or Paused.'),
    dashPfCol('campType', 'attr', 'Objective', 'text', 'The campaign objective chosen in Meta Ads Manager.', { levels: ['campaign'] }),
    dashPfCol('budget', 'attr', 'Budget', 'budget', 'Daily or lifetime budget, set on the campaign (Advantage campaign budget) or on each ad set.', { levels: ['campaign', 'adgroup'] }),
    dashPfCol('optGoal', 'attr', 'Optimisation goal', 'text', 'The result the ad set is optimised to get.', { levels: ['adgroup'] }),
    dashPfCol('adFormat', 'attr', 'Ad format', 'text', 'The creative format of the ad.', { levels: ['ad'] }),
    dashPfCol('attribution', 'attr', 'Attribution setting', 'text', 'The window in which a conversion is credited to the ad after a click or view.'),
    dashPfCol('conversions', 'perf', 'Results', 'int', DASH_SHEET.conversions),
    dashPfCol('cvr', 'perf', 'Result rate', 'pct', DASH_SHEET.cvr, { needs: 'clicks' }),
    dashPfCol('cpa', 'perf', 'Cost per result', 'money2', 'Amount spent divided by results.', { quality: 'low', needs: 'conversions' }),
    dashPfCol('spend', 'perf', 'Amount spent', 'money2', DASH_SHEET.cost),
    dashPfCol('reach', 'perf', 'Reach', 'int', DASH_SHEET.reach),
    dashPfCol('impressions', 'perf', 'Impressions', 'int', DASH_SHEET.impressions),
    dashPfCol('freq', 'perf', 'Frequency', 'dec', DASH_SHEET.freq, { needs: 'reach' }),
    dashPfCol('cpm', 'perf', 'CPM (cost per 1,000 impressions)', 'money2', DASH_SHEET.cpm, { quality: 'low', needs: 'impressions' }),
    dashPfCol('clicks', 'clicks', 'Link clicks', 'int', DASH_SHEET.clicks),
    dashPfCol('ctr', 'clicks', 'CTR (link click-through rate)', 'pct', DASH_SHEET.ctr, { quality: 'high', needs: 'impressions' }),
    dashPfCol('cpc', 'clicks', 'CPC (cost per link click)', 'money2', DASH_SHEET.cpc, { quality: 'low', needs: 'clicks' }),
    dashPfCol('allClicks', 'clicks', 'Clicks (all)', 'int', DASH_SHEET.allClicks),
    dashPfCol('ctrAll', 'clicks', 'CTR (all)', 'pct', DASH_SHEET.ctrAll, { needs: 'impressions' }),
    dashPfCol('cpcAll', 'clicks', 'CPC (all)', 'money2', DASH_SHEET.cpcAll, { needs: 'allClicks' }),
    dashPfCol('lpv', 'clicks', 'Landing page views', 'int', DASH_SHEET.lpv),
    dashPfCol('cplpv', 'clicks', 'Cost per landing page view', 'money2', DASH_SHEET.cplpv, { needs: 'lpv' }),
    dashPfCol('engagements', 'eng', 'Post engagement', 'int', DASH_SHEET.engagements),
    dashPfCol('cpe', 'eng', 'Cost per post engagement', 'money2', DASH_SHEET.cpe, { needs: 'engagements' }),
    dashPfCol('engRate', 'eng', 'Engagement rate', 'pct', DASH_SHEET.engRate, { needs: 'impressions' }),
    dashPfCol('shares', 'eng', 'Post shares', 'int', DASH_SHEET.shares),
    dashPfCol('saves', 'eng', 'Post saves', 'int', DASH_SHEET.saves),
    dashPfCol('igFollows', 'eng', 'Instagram follows', 'int', DASH_SHEET.igFollows),
    dashPfCol('igVisits', 'eng', 'Instagram profile visits', 'int', DASH_SHEET.igVisits),
    dashPfCol('msgs', 'msg', 'Messaging conversations started', 'int', DASH_SHEET.msgs),
    dashPfCol('cpMsg', 'msg', 'Cost per messaging conversation started', 'money2', DASH_SHEET.cpMsg, { needs: 'msgs' }),
    dashPfCol('thruplays', 'video', 'ThruPlays', 'int', DASH_SHEET.thruplays, { needs: 'vImpr' }),
    ...[25, 50, 75, 100].map(n => dashPfCol(`v${n}`, 'video', `Video plays at ${n}%`, 'int', DASH_SHEET.mVideo(n), { needs: 'vImpr' })),
    dashPfCol('pLeads', 'conv', 'Leads', 'int', DASH_SHEET.leads),
    dashPfCol('cpLead', 'conv', 'Cost per lead', 'money2', DASH_SHEET.cpLead, { needs: 'pLeads' }),
    dashPfCol('purchases', 'conv', 'Purchases', 'int', DASH_SHEET.purchases),
    dashPfCol('cpp', 'conv', 'Cost per purchase', 'money2', DASH_SHEET.cpp, { needs: 'purchases' }),
    dashPfCol('convValue', 'conv', 'Purchases conversion value', 'money2', DASH_SHEET.convValue),
    dashPfCol('pRoas', 'conv', 'Purchase ROAS (return on ad spend)', 'dec', DASH_SHEET.roas, { needs: 'spend' }),
    dashPfCol('addsToCart', 'conv', 'Adds to cart', 'int', DASH_SHEET.addsToCart),
    dashPfCol('checkouts', 'conv', 'Checkouts initiated', 'int', DASH_SHEET.checkouts)
  ]
};
// CRM-attributed columns (CRM mode only), the same as the consolidated table's CRM group. Not at keyword level.
const DASH_PF_CRM_COLS = DASH_CT_CRM_COLS.map(c => ({ ...c, t: { leads: 'int', cpl: 'money2', revenue: 'money2', roas: 'roas' }[c.key], levels: DASH_PF_NOT_KW }));
// Bands as each platform groups its columns. summary = the primary field a collapsed group keeps.
// Meta Conversions → Leads: most workspaces run lead objectives and the Hub's CRM mode is lead-based;
// Purchase ROAS only means something with purchase tracking (it stays one click away).
const DASH_PF_GROUPS = {
  google: [['attr', 'Attributes', { summary: 'pfStatus', tone: 'neutral' }], ['perf', 'Performance', { summary: 'spend', tone: 'ads' }],
    ['conv', 'Conversions', { summary: 'cpa', tone: 'ads2' }], ['comp', 'Competitive metrics', { summary: 'is', tone: 'ads' }],
    ['reach', 'Reach metrics', { summary: 'reach', tone: 'ads2' }], ['video', 'Video', { summary: 'vViews', tone: 'ads' }],
    ['store', 'Store visits', { summary: 'storeVisits', tone: 'ads2' }], ['crm', 'CRM', { summary: 'roas', tone: 'crm' }]],
  meta: [['attr', 'Settings', { summary: 'pfStatus', tone: 'neutral' }], ['perf', 'Performance', { summary: 'cpa', tone: 'ads' }],
    ['clicks', 'Clicks', { summary: 'ctr', tone: 'ads2' }], ['eng', 'Engagement', { summary: 'engagements', tone: 'ads' }],
    ['msg', 'Messaging', { summary: 'msgs', tone: 'ads2' }], ['video', 'Video', { summary: 'thruplays', tone: 'ads' }],
    ['conv', 'Conversions', { summary: 'pLeads', tone: 'ads2' }], ['crm', 'CRM', { summary: 'roas', tone: 'crm' }]]
};
function dashPfState(p) { return state.ui.dashPf[p]; }
function dashPfLevelCols(p, level) {
  return DASH_PF_COLS[p].concat(activeCrm(state.ctx) ? DASH_PF_CRM_COLS : []).filter(c => !c.levels || c.levels.includes(level));
}
// Default: every column shown; every metric group collapsed to its primary field; Attributes / Settings expanded.
['google', 'meta'].forEach(p => registerColumnPicker(`pf-${p}`, {
  columns: () => dashPfLevelCols(p, dashPfState(p).level),
  groups: DASH_PF_GROUPS[p],
  collapsible: true,
  note: 'Name and Action are always shown',
  onChange: DASH_PF_FN[p],
  // Google: Competitive metrics (Search impr. share etc.) are not in Google Ads' default column set, so they start
  // hidden (switch them on in the column picker). Key bumped (v4) so every viewer gets this default.
  defaultHidden: p === 'google' ? DASH_PF_COLS.google.filter(c => c.group === 'comp').map(c => c.key) : [],
  defaultCollapsed: DASH_PF_GROUPS[p].map(g => g[0]).filter(k => k !== 'attr'),
  storageKey: `galaxis-demo:pf-${p}-columns-hidden-v4`,
  collapsedKey: `galaxis-demo:pf-${p}-groups-collapsed-v2`
}));
// Filters: Status + Campaign type (Google), Delivery + Objective (Meta). Lower levels filter by their campaign's type.
['google', 'meta'].forEach(p => {
  DASH_FILTERS[`pf-${p}`] = {
    store: () => dashPfState(p).filter,
    groups: () => p === 'google'
      ? [{ key: 'status', title: 'Status', options: DASH_G_STATUSES.map(s => [s, s]) }, { key: 'type', title: 'Campaign type', options: DASH_G_TYPES.map(s => [s, s]) }]
      : [{ key: 'status', title: 'Delivery', options: DASH_M_DELIVERIES.map(s => [s, s]) }, { key: 'type', title: 'Objective', options: DASH_M_OBJECTIVES.map(s => [s, s]) }],
    refresh: () => { pager(`dash-pf-${p}`).page = 1; dashPfRefresh(p); }
  };
});

// ---------- Platform view page ----------
function dashRenderPlatform(ws, p) {
  const m = dashMetrics(ws.id, 'client');
  const d = dashPfData(ws.id, p);
  const chart = { google: 'Daily cost, conversions and clicks from Google Ads.', meta: 'Daily amount spent, results and link clicks from Meta Ads.' }[p];
  return `${state.flags.dashKpiLayout === 'panels' ? dashKpiPanels(ws, p, m) : dashPfKpis(ws, p, d, m) + dashCrmSection({ total: m.byPlatform[p] }, activeCrm(ws.id))}
    <div class="card dash-ct-card" id="dash-pf-card">${dashPfReportCard(p)}</div>
    <div class="card dash-pf-daily-card">
      <div class="card-header">
        <div><h2 class="h-section">Daily Performance</h2><div class="card-sub">${chart}</div></div>
        <div class="seg" id="dash-pf-daily-seg">${dashPfDailySeg(p)}</div>
      </div>
      <div class="dash-chart" id="dash-pf-daily" data-platform="${p}"><svg role="img" aria-label="${DASH_VIEW_LABEL[p]} daily performance chart"></svg></div>
    </div>`;
}
function dashPfKpis(ws, p, d, m) {
  const t = d.total;
  const S = DASH_SHEET;
  const accts = wsAdAccounts(ws.id).filter(a => a.platform === p);
  const share = dashPlatforms(ws.id).length > 1 && m.total.spend ? `<b>${Math.round(t.spend / m.total.spend * 100)}%</b> of workspace ad spend` : `Across <b>${d.campaign.length}</b> campaigns`;
  // KPI rows mirror each platform's own overview (26/10/2026). Google: the Ads overview scorecards (Clicks, Impr.,
  // Avg. CPC, Cost) plus the conversion trio. Meta: Ads Manager's account-level delivery metrics plus Leads and Cost
  // per lead. Left out on purpose: Search impr. share (Search campaigns only, not additive, not a default scorecard),
  // Meta "Results" (each campaign's result type differs by objective, so a summed total is meaningless) and the ROAS
  // metrics (only meaningful for e-commerce). All of them stay available in the report table.
  const cards = p === 'google' ? [
    dashKpi('Clicks', S.clicks, fmtNum(t.clicks), `CTR <b>${fmtPct(t.ctr)}</b>`),
    dashKpi('Impr.', S.impressions, fmtNum(t.impressions), `Avg. CPM <b>${fmtMoney(t.cpm, 2)}</b>`),
    dashKpi('Avg. CPC', 'Cost divided by clicks.', t.clicks ? fmtMoney(t.cpc, 2) : '—', 'Cost ÷ clicks'),
    dashKpi('Cost', S.cost, fmtMoney(t.spend, 2), share),
    dashKpi('Conversions', S.conversions, fmtNum(t.conversions), `All conv. <b>${fmtNum(t.allConv)}</b>`),
    dashKpi('Cost / conv.', 'Cost divided by conversions.', t.conversions ? fmtMoney(t.cpa, 2) : '—', 'Cost ÷ conversions'),
    dashKpi('Conv. rate', 'Conversions divided by interactions (clicks).', t.clicks ? fmtPct(t.cvr) : '—', 'Conversions ÷ clicks')
  ] : [
    dashKpi('Amount spent', S.cost, fmtMoney(t.spend, 2), share),
    dashKpi('Reach', S.reach, fmtNum(t.reach), `Frequency <b>${t.freq.toFixed(2)}</b>`),
    dashKpi('Impressions', S.impressions, fmtNum(t.impressions), `CPM (cost per 1,000 impressions) <b>${fmtMoney(t.cpm, 2)}</b>`),
    dashKpi('Link clicks', S.clicks, fmtNum(t.clicks), `CPC (cost per link click) <b>${fmtMoney(t.cpc, 2)}</b>`),
    dashKpi('CTR (link click-through rate)', S.ctr, t.impressions ? fmtPct(t.ctr) : '—', 'Link clicks ÷ impressions'),
    dashKpi('Leads', S.leads, fmtNum(t.pLeads), t.clicks && t.pLeads ? `<b>${fmtPct(t.pLeads / t.clicks * 100)}</b> of link clicks` : 'No leads yet'),
    dashKpi('Cost per lead', S.cpLead, t.pLeads ? fmtMoney(t.cpLead, 2) : '—', 'Amount spent ÷ leads')
  ];
  const acct = accts.map(a => `${esc(a.name)} (${esc(a.id)})`).join(', ');
  return `<div class="dash-section-head"><div><h2 class="h-card">${DASH_VIEW_LABEL[p]}</h2>
      <div class="card-sub">Platform-reported results from ${acct} for the selected dates, under ${PLATFORM_NAME[p]}'s own metric names. SGD · Asia/Singapore.</div></div></div>
    <div class="dash-kpis dash-pf-kpis">${cards.join('')}</div>`;
}
function dashPfReportCard(p) {
  const s = dashPfState(p);
  const tabs = DASH_PF_LEVELS[p].map(l => `<button type="button" role="tab" class="${l === s.level ? 'active' : ''}" onclick="dashPfSetLevel('${p}','${l}')">${DASH_PF_LEVEL_TAB[p][l]}</button>`).join('');
  return `<div class="card-header">
      <div><h2 class="h-section">${DASH_VIEW_LABEL[p]} report</h2><div class="card-sub">Every ${DASH_VIEW_LABEL[p]} column, under its native name. Metric groups start collapsed to their key column: expand a group, or choose columns with the column picker.</div></div>
      <div class="seg" role="tablist" aria-label="${DASH_VIEW_LABEL[p]} level">${tabs}</div>
    </div>
    <div class="dash-ct-toolbar">
      ${datePresetHTML('client', 'dashRerender')}
      <div class="search grow"><input class="input" placeholder="Search ${DASH_PF_LEVEL_TAB[p][s.level].toLowerCase()}" value="${esc(s.search)}" oninput="dashPfSearch('${p}', this.value)" aria-label="Search ${DASH_PF_LEVEL_TAB[p][s.level].toLowerCase()}"><i data-lucide="search"></i></div>
      ${dashFilterButton(`pf-${p}`)}
      ${colPickerButton(`pf-${p}`)}
      <button type="button" class="btn btn-outline btn-sm dash-pf-csv" onclick="dashPfCsv('${p}')"><i data-lucide="download"></i>Download CSV</button>
    </div>
    <div id="dash-pf-body">${dashPfBody(p)}</div>`;
}
function dashPfRefresh(p) { renderRegion('dash-pf-body', dashPfBody(p)); }
function dashPfRefreshGoogle() { dashPfRefresh('google'); }
function dashPfRefreshMeta() { dashPfRefresh('meta'); }
function dashPfRenderCard(p) { renderRegion('dash-pf-card', dashPfReportCard(p)); }
function dashPfSetLevel(p, l) { dashPfState(p).level = l; pager(`dash-pf-${p}`).page = 1; dashPfRenderCard(p); }
function dashPfSearch(p, v) { dashPfState(p).search = v; pager(`dash-pf-${p}`).page = 1; dashPfRefresh(p); }
function dashPfNext(p, level) { return { campaign: 'adgroup', adgroup: 'ad' }[level] || null; }
function dashPfDrill(p, id, to) {
  const s = dashPfState(p);
  const e = dashPfData(state.ctx, p)[s.level].find(x => x.id === id);
  const next = to || dashPfNext(p, s.level);
  if (!e || !next) return;
  s.drill = { level: s.level, id, name: e.name, path: e.path };
  s.level = next;
  pager(`dash-pf-${p}`).page = 1;
  dashPfRenderCard(p);
}
function dashPfClearDrill(p) { const s = dashPfState(p); s.drill = null; s.level = 'campaign'; pager(`dash-pf-${p}`).page = 1; dashPfRenderCard(p); }

// Filtered and sorted rows of the current level (all pages): the table, its total row and the CSV use these.
function dashPfRows(p) {
  const s = dashPfState(p);
  const d = dashPfData(state.ctx, p);
  const f = s.filter;
  const term = s.search.trim().toLowerCase();
  const rows = d[s.level].filter(e => {
    if (s.drill && !dashPathsMatch(e.path, s.drill.path)) return false;
    if (f.status.length && !f.status.includes(e.pfStatus)) return false;
    if (f.type.length && !f.type.includes(e.campType)) return false;
    if (term && !`${e.name} ${e.parents.join(' ')}`.toLowerCase().includes(term)) return false;
    return true;
  });
  const tid = `dash-pf-${p}`;
  const cols = dashPfLevelCols(p, s.level);
  const acc = { name: e => e.name.toLowerCase(), ...Object.fromEntries(cols.map(c => [c.key, e => dashPfSortVal(p, e, c)])) };
  if (!state.sorts[tid] || !acc[state.sorts[tid].col]) state.sorts[tid] = { col: 'spend', dir: 'desc' };
  return applySort(rows, tid, acc);
}
function dashPfSortVal(p, e, c) {
  const v = e[c.key];
  if (c.t === 'status') return (p === 'google' ? DASH_G_STATUSES : DASH_M_DELIVERIES).indexOf(v);
  if (c.t === 'text' || c.t === 'url') return String(v || '').toLowerCase();
  if (c.t === 'budget') return v && v.daily ? v.daily : -1;
  if (c.needs && !e[c.needs]) return -1;
  return v || 0;
}
function dashPfStatus(v) { return v ? `<span class="dot-label dash-pf-status"><span class="dot ${DASH_PF_STATUS_DOT[v] || 'dot-grey'}"></span>${esc(v)}</span>` : ''; }
function dashPfBudgetText(b) { return !b ? '' : b.note || (b.kind === 'lifetime' ? `${fmtMoney(b.amount, 2)} lifetime` : `${fmtMoney(b.amount, 2)}/day`); }
function dashPfCell(e, c, ref) {
  const v = e[c.key];
  const dash = '<span class="t-muted">—</span>';
  if (c.t === 'status') return dashPfStatus(v);
  if (c.t === 'text') return v ? esc(v) : dash;
  if (c.t === 'budget') return v ? (v.note ? `<span class="t-muted">${esc(v.note)}</span>` : esc(dashPfBudgetText(v))) : dash;
  if (c.t === 'url') return v ? `<span class="dash-pf-url" title="${esc(v)}">${esc(v.replace(/^https:\/\//, ''))}</span>` : dash;
  if (c.t === 'qs') return v ? `<span class="metric-dot ${v >= 7 ? 'good' : v >= 5 ? 'mid' : 'bad'}">${v}/10</span>` : dash;
  if (c.needs && !e[c.needs]) return dash;
  const text = DASH_PF_FMT[c.t](v || 0);
  return c.quality && ref ? dashDot(text, dashQuality(v, ref[c.key], c.quality === 'high')) : text;
}
function dashPfKeywordText(e) { return e.match === 'Exact' ? `[${e.name}]` : e.match === 'Phrase' ? `"${e.name}"` : e.name; }
function dashPfNameCell(p, e, level) {
  const acct = wsAdAccounts(state.ctx).find(a => a.platform === p);
  const parent = level === 'campaign' ? (acct ? acct.name : DASH_VIEW_LABEL[p]) : e.parents.join(' › ');
  const name = level === 'keyword' ? dashPfKeywordText(e) : e.name;
  return `<div class="dash-name"><span class="dash-name-parent" title="${esc(parent)}">${platformLogo(p)}<span>${esc(parent)}</span></span><b>${esc(name)}</b></div>`;
}
function dashPfBody(p) {
  const s = dashPfState(p);
  const level = s.level;
  const pid = `pf-${p}`, tid = `dash-pf-${p}`, fn = DASH_PF_FN[p];
  const d = dashPfData(state.ctx, p);
  const rows = dashPfRows(p);
  const page = paginate(rows, tid, 10);
  const layout = colLayout(pid, dashPfLevelCols(p, level).filter(c => colVisible(pid, c.key)));
  const cols = layout.columns;
  const next = dashPfNext(p, level);
  const levelName = DASH_PF_LEVEL_TAB[p][level].toLowerCase();
  const head = `${colGroupHeaderRow(pid, layout, { lead: 1, trail: next ? 1 : 0 })}
    <tr><th>${sortHeader(tid, 'name', DASH_PF_NAME_COL[p][level], fn)}</th>${cols.map(c => `<th class="${colCellClass(c)}"${colDragAttrs(pid, 'col', c.key, c.group)} title="${esc(c.tip)}">${sortHeader(tid, c.key, c.label, fn)}</th>`).join('')}${next ? '<th>Action</th>' : ''}</tr>`;
  const menu = e => {
    const items = [{ label: `View ${DASH_PF_LEVEL_TAB[p][next].toLowerCase()} (${e.childCount})`, icon: 'arrow-right', onClick: `dashPfDrill('${p}','${q(e.id)}')` }];
    if (p === 'google' && e.kwCount) items.push({ label: `View keywords (${e.kwCount})`, icon: 'key-round', onClick: `dashPfDrill('${p}','${q(e.id)}','keyword')` });
    return rowMenu(`dash-pfm-${dashHash(e.id)}`, items);
  };
  const body = page.map(e => `
    <tr ${next ? `class="clickable" onclick="dashPfDrill('${p}','${q(e.id)}')"` : ''}>
      <td>${dashPfNameCell(p, e, level)}</td>
      ${cols.map(c => `<td class="dash-nowrap ${colCellClass(c)}">${dashPfCell(e, c, d.total)}</td>`).join('')}
      ${next ? `<td onclick="event.stopPropagation()">${menu(e)}</td>` : ''}
    </tr>`).join('');
  const tot = dashPfSum(rows);
  const foot = rows.length ? `<tfoot><tr class="dash-pf-total"><td><b>Total: ${rows.length} ${rows.length === 1 ? DASH_PF_LEVEL_ONE[p][level].toLowerCase() : levelName}</b>${rows.length < d[level].length ? '<div class="cell-sub">Filtered</div>' : ''}</td>
      ${cols.map(c => `<td class="dash-nowrap ${colCellClass(c)}">${c.group === 'attr' ? '' : dashPfCell(tot, c, null)}</td>`).join('')}${next ? '<td></td>' : ''}</tr></tfoot>` : '';
  const empty = level === 'keyword' && !d.keyword.length ? 'No keywords. Keywords exist only in Search campaigns.'
    : level === 'keyword' && s.drill ? 'No keywords here. Keywords exist only in Search campaigns.' : 'No data matches criteria.';
  const drill = s.drill ? `<div class="dash-drill"><span>Filtered for ${DASH_PF_LEVEL_ONE[p][s.drill.level]}: <b>${esc(s.drill.name)}</b></span><button type="button" class="chip-remove" onclick="dashPfClearDrill('${p}')" aria-label="Clear filter"><i data-lucide="x"></i></button></div>` : '';
  return `${drill}
    <div class="table-wrap dash-table-wrap"><table class="table table-wrap-heads dash-pf-table">
      <thead>${head}</thead>
      <tbody>${body || `<tr><td colspan="${cols.length + 1 + (next ? 1 : 0)}" class="table-empty">${empty}</td></tr>`}</tbody>
      ${foot}
    </table></div>
    ${paginationBar(tid, rows.length, fn)}`;
}

// ---------- Download CSV (the native "Download report") ----------
// Current level, every column switched on in the column picker (collapsed groups included), all filtered rows
// in the current sort order (not just this page), then a total row. Numbers are plain values; money in SGD.
function dashCsvCell(v) {
  if (typeof v === 'number') return String(v);
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;   // stop spreadsheet formula injection from text cells
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function dashPfCsvValue(e, c) {
  const v = e[c.key];
  if (c.t === 'status' || c.t === 'text' || c.t === 'url') return v || '';
  if (c.t === 'budget') return dashPfBudgetText(v);
  if (c.t === 'qs') return v || '';
  if (c.needs && !e[c.needs]) return '';
  return c.t === 'int' ? Math.round(v || 0) : Number((v || 0).toFixed(2));
}
function dashPfCsv(p) {
  try {
    const ws = currentWs();
    const s = dashPfState(p);
    const level = s.level;
    const rows = dashPfRows(p);
    const cols = colOrdered(`pf-${p}`, dashPfLevelCols(p, level).filter(c => colVisible(`pf-${p}`, c.key)));
    const parentHead = level === 'campaign' ? [] : level === 'adgroup' ? ['Campaign'] : ['Campaign', DASH_PF_LEVEL_ONE[p].adgroup];
    const label = c => c.t.startsWith('money') || c.t === 'budget' ? `${c.label} (SGD)` : c.t === 'pct' && !c.label.includes('%') ? `${c.label} (%)` : c.label;
    const parents = e => level === 'campaign' ? [] : level === 'adgroup' ? [e.campaignName] : [e.campaignName, e.adGroupName];
    const lines = [[DASH_PF_NAME_COL[p][level], ...parentHead, ...cols.map(label)]];
    rows.forEach(e => lines.push([e.name, ...parents(e), ...cols.map(c => dashPfCsvValue(e, c))]));
    const tot = dashPfSum(rows);
    if (rows.length) lines.push(['Total', ...parentHead.map(() => ''), ...cols.map(c => c.group === 'attr' ? '' : dashPfCsvValue(tot, c))]);
    const csv = '﻿' + lines.map(r => r.map(dashCsvCell).join(',')).join('\r\n');
    const range = resolveDateRange(state.dateFilters.client) || { start: '', end: '' };
    const name = `${dashSlug(ws.name)}_${p}-ads_${dashSlug(DASH_PF_LEVEL_TAB[p][level])}_${range.start}_${range.end}.csv`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    state.ui.dashPfLastCsv = { name, rows: rows.length, cols: cols.length + 1 + parentHead.length };
    showToast(`Downloaded ${name}`, 'download');
  } catch (err) {
    showToast('The CSV could not be created. Try again.', 'triangle-alert');
  }
}

// ---------- Daily Performance (platform only) ----------
const DASH_PF_CHART = { google: [['spend', 'Cost'], ['conversions', 'Conversions'], ['clicks', 'Clicks']], meta: [['spend', 'Amount spent'], ['conversions', 'Results'], ['clicks', 'Link clicks']] };
function dashPfDailySeg(p) {
  const cur = state.ui.dashPfChartMetric;
  return DASH_PF_CHART[p].map(([k, l]) => `<button type="button" class="${k === cur ? 'active' : ''}" onclick="dashPfSetChartMetric('${p}','${k}')">${l}</button>`).join('');
}
function dashPfSetChartMetric(p, k) { state.ui.dashPfChartMetric = k; renderRegion('dash-pf-daily-seg', dashPfDailySeg(p)); dashPfRenderDaily(); }
function dashPfRenderDaily() {
  const wrap = document.getElementById('dash-pf-daily');
  if (!wrap) return;
  const p = wrap.dataset.platform;
  const ws = currentWs();
  const metric = state.ui.dashPfChartMetric;
  const series = dashDailySeries(dashMetrics(ws.id, 'client').byPlatform[p], `${ws.id}:${p}`);
  const fmtV = v => metric === 'spend' ? fmtMoney(v) : fmtNum(Math.round(v));
  const max = dashNiceMax(Math.max(1, ...series.map(s => s[metric])));
  const names = Object.fromEntries(DASH_PF_CHART[p]);
  dashLineChart(wrap, {
    id: 'dash-pf-daily', series: series.map(s => ({ d: s.d, v: s[metric] })), lo: 0, hi: max,
    ticks: [0, 1, 2, 3, 4, 5].map(k => max * k / 5), fmtAxis: fmtV,
    tip: i => {
      const s = series[i];
      const row = (k, v) => `<div class="dash-tip-row ${k === metric ? 'on' : ''}"><span>${names[k]}</span><b>${v}</b></div>`;
      return `<div class="dash-tip-date">${fmtDate(s.d)}</div>${row('spend', fmtMoney(s.spend, 2))}${row('conversions', fmtNum(s.conversions))}${row('clicks', fmtNum(s.clicks))}`;
    }
  });
}
window.addEventListener('resize', () => { clearTimeout(dashResizeTimer); dashResizeTimer = setTimeout(() => { dashRenderDaily(); dashPfRenderDaily(); dashSeoRenderChart(); }, 120); });

// =====================================================================
// Screen registration, dev toggles
// =====================================================================
Object.assign(state.ui, {
  dashMgrSearch: '', dashMgrFilter: { health: [], platform: [], perf: [], seo: [] },
  dashModel: 'mta', dashChartMetric: 'spend', dashHeatMetric: 'spend',
  dashFpSnap: {}, dashFpCollapsed: {},
  dashCtWs: undefined, dashCtFilter: { platform: [], format: [], status: [] }, dashEntSel: [], dashEntType: 'all', dashEntQ: '', dashCtSearch: '', dashLevel: 'platform', dashDrill: null,
  dashTab: 'ads', dashSeoView: 'group', dashSeoBucket: 'all', dashSeoSearch: '', dashSeoFilter: { intent: [], difficulty: [], group: [] }, dashSeoCollapsed: {}, dashSeoRemoved: {},
  dashAdView: 'all', dashPf: dashPfInitState(), dashPfChartMetric: 'spend'
});
function dashPfInitState() {
  const one = () => ({ level: 'campaign', drill: null, search: '', filter: { status: [], type: [] } });
  return { google: one(), meta: one() };
}

registerScreen('dashboard', {
  contexts: ['agency', 'client'],
  title: () => 'Dashboard',
  desc: () => '',
  // client-dashboard-ads (All Platforms) | client-dashboard-ads-google | client-dashboard-ads-meta | client-dashboard-seo
  key: () => {
    if (isAgency()) return 'agency-dashboard';
    const tab = dashTab();
    const ws = currentWs();
    if (tab !== 'ads' || !ws || !dashPlatforms(ws.id).length) return `client-dashboard-${tab}`;
    const view = dashAdView(ws);
    return view === 'all' ? 'client-dashboard-ads' : `client-dashboard-ads-${view}`;
  },
  render: () => isAgency() ? dashRenderAgency() : dashRenderClient(),
  afterRender: () => {
    dashTipHide();
    if (!isAgency()) { dashRenderDaily(); dashPfRenderDaily(); dashBindHeatmap(); dashSeoRenderChart(); }
  }
});

// Dev screens. Registering these keys makes app.js skip its generic agency-dashboard / client-dashboard entries
// (it skips any key equal to or starting with "client-dashboard-").
const DASH_DEV_KEYS = ['agency-dashboard', 'client-dashboard-ads', 'client-dashboard-ads-google', 'client-dashboard-ads-meta', 'client-dashboard-seo'];
// A platform screen needs a workspace with that platform linked: keep the current one if it has it, else Visual Studio.
function dashDevCtxFor(p) { const c = devClientCtx(); return wsPlatforms(c).includes(p) ? c : 'ws-visual'; }
registerDevScreen('Agency', 'agency-dashboard', 'Dashboard', () => { state.ctx = null; state.persona = 'agency'; navigate('dashboard'); });
registerDevScreen('Client workspace', 'client-dashboard-ads', 'Dashboard › Ad Performance', () => { state.ctx = devClientCtx(); state.ui.dashAdView = 'all'; navigate('dashboard', { tab: 'ads', view: 'all' }); });
registerDevScreen('Client workspace', 'client-dashboard-ads-google', 'Dashboard › Ad Performance › Google Ads', () => { state.ctx = dashDevCtxFor('google'); navigate('dashboard', { tab: 'ads', view: 'google' }); });
registerDevScreen('Client workspace', 'client-dashboard-ads-meta', 'Dashboard › Ad Performance › Meta Ads', () => { state.ctx = dashDevCtxFor('meta'); state.flags.dashGoogleOnly = false; navigate('dashboard', { tab: 'ads', view: 'meta' }); });
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
  { label: 'Alerts', active: !state.flags.dashAlertsOff, run: () => { state.flags.dashAlertsOff = !state.flags.dashAlertsOff; rerender(); } },
  'sep',
  { label: 'Simulate CRM conversion', action: true, run: dashSimulateCrm }
]);
// Shared by All Platforms, Google Ads and Meta Ads. "Single platform (Google only)" hides Meta for a workspace
// that has both, so the single-platform behaviour (no All Platforms, Google view only) can be demoed.
function dashAdsDevToggles() {
  const crm = !!activeCrm(state.ctx);
  const plats = wsPlatforms(state.ctx);
  return [
    { label: 'CRM connected', active: crm, run: () => crm ? dashSetAdOnly() : dashSetCrmConnected() },
    { label: 'No ad accounts linked', active: !!state.flags.dashNoAccounts, run: () => { state.flags.dashNoAccounts = !state.flags.dashNoAccounts; rerender(); } },
    ...(plats.includes('google') && plats.length > 1 ? [{ label: 'Single platform (Google only)', active: !!state.flags.dashGoogleOnly, run: () => { state.flags.dashGoogleOnly = !state.flags.dashGoogleOnly; rerender(); } }] : []),
    'sep',
    { label: 'KPI panels', active: state.flags.dashKpiLayout === 'panels', run: () => dashSetKpiLayout(state.flags.dashKpiLayout === 'panels' ? 'cards' : 'panels') }
  ];
}
['client-dashboard-ads', 'client-dashboard-ads-google', 'client-dashboard-ads-meta'].forEach(k => registerDevToggles(k, dashAdsDevToggles));
registerDevToggles('client-dashboard-seo', () => {
  const on = seoConnected(state.ctx);
  const key = on ? dashSeoStats().status.key : null;
  return [
    { label: 'SEO Cloud connected', active: on, run: dashSeoToggleConnected },
    // Status cycles On track → Off track → Critical.
    ...(on ? [{ label: `SEO status: ${{ on: 'On track', off: 'Off track', critical: 'Critical' }[key]}`, cycle: true, run: () => dashSeoScenario({ on: 'off', off: 'critical', critical: 'on' }[key]) }] : [])
  ];
});

// =====================================================================
// Specs (ported from V1 agency-home / client-home and updated to this build)
// =====================================================================
// Shared part of the Google Ads and Meta Ads view specs.
function dashPfSpecCommon(name) {
  return `
### Screen Purpose & Objectives
A dedicated **${name}** view inside the Ad Performance tab that replicates the native ${name} report in the Galaxis style, so customers and agency users can stop opening ${name === 'Google Ads' ? 'Google Ads' : 'Meta Ads Manager'}: the full, configurable report is here. Google and Meta are separate views because some columns exist on one platform only. Source of truth for which metrics exist on which platform: the *Google & Meta Ads Metrics* sheet (Metrics (Original) for names and definitions, Metrics (Dev Notes) for API fields). Each metric uses **${name}'s own column name**.

### Key Functional Specifications
- **View switcher**: All Platforms | Google Ads | Meta Ads under the page tabs (rules in \`client-dashboard-ads\`). Route \`view: '${name === 'Google Ads' ? 'google' : 'meta'}'\`.
- **Totals agree with All Platforms**: Cost / Impressions / Clicks / Conversions in this view (KPIs and the table's total row) equal the ${name === 'Google Ads' ? 'Google' : 'Meta'} platform row of the consolidated Campaigns and Ads table for the same dates. Both read the same platform data.
- **Leads & Revenue** (CRM mode): the same section as All Platforms, scoped to this platform. Ad-only mode shows the locked cards and the Connect CRM banner.
- **Report table**: level tabs, search, filter, column picker, **Download CSV**; grouped, collapsible column bands like the native column sets; every column sortable (default Cost / Amount spent, high to low; rows with no data sort last); 10 rows per page (10 / 20 / 50); name column and Action pinned; two-line headers; header tooltips with the sheet's definitions. Name cells show the parent above (campaign: ad account; lower levels: campaign › ad group). A grey **Total** row sums every filtered row (all pages), "Filtered" when a search, filter or drill-down applies; ratios are recalculated from the sums.
- **Drill-down**: clicking a row, or "View …" in the ⋮ menu, opens the next level with a "Filtered for X ✕" badge; ✕ returns to Campaigns. Level tabs keep the drill-down filter.
- **Table principle (22/10/2026; collapsible groups reinstated 23/10/2026 after feedback that they help on long tables)**: these views replicate the native Google Ads and Meta Ads reports as closely as possible, so clients never need the native UIs. **All columns shown by default, in collapsed state**. Every metric group starts collapsed to its primary field ("+N" on the band shows how many columns are folded in); the Attributes / Settings group starts expanded, with Status / Delivery as its primary field when collapsed. "Collapse all / Expand all" above the name column; the column picker hides or shows single columns; **Reset to default** restores the defaults. Choices are remembered per viewer (prototype: localStorage; product: per user). **Reordering (23/10/2026)**: viewers can reorder columns within a group and reorder the groups themselves, by dragging the grip handles in the column picker (arrow keys also work) or dragging the column headers / group bands in the table; columns only move within their own group. **A collapsed group always shows its first column** (the picker tags it "Shown when collapsed"); by default each group's key column is placed first, so the default collapsed view is unchanged. Dragging a whole group in the picker folds every group's column list, leaving just the group names to reorder. The order is remembered per viewer and also drives the CSV export; **Reset to default** restores it.
- Only columns that exist at the current level natively are offered (e.g. Quality Score only for keywords).
- Quality dots (green / orange / red vs this platform's total) on CTR, CPC, CPM and cost per conversion / result.
- **Download CSV** (the native "Download report"): exports the current level, every column switched on in the column picker (collapsed groups included, since collapsing is only a display choice), every filtered row in the current sort order (not only the current page), then a Total row. Name and parent columns (Campaign, Ad group / Ad set) come first. Plain numbers: money in SGD to 2 dp ("(SGD)" in the header), percentages as numbers ("(%)"), "—" cells empty. UTF-8 with BOM for Excel. File name: \`{workspace}_${name === 'Google Ads' ? 'google' : 'meta'}-ads_{level}_{start}_{end}.csv\`. Text cells starting with = + - @ are prefixed with ' so spreadsheets do not run them as formulas.
- **Daily Performance**: below the table, a daily line chart for this platform only (${name === 'Google Ads' ? 'Cost / Conversions / Clicks' : 'Amount spent / Results / Link clicks'} toggle, hover tooltip), adding up to this platform's totals.
- **Date filter**: the shared client date filter applies to every number, as on All Platforms. **Prototype note:** mock data is scaled to the range, not filtered by event date.
- **Mock data**: new platform metrics are generated per ad from their own random streams, so the consolidated numbers never change, and rolled up through the levels as sums or recalculated ratios.

### Open questions
- **Attribution windows differ**: Meta reports conversions under each ad set's attribution setting (default 7-day click, 1-day view); Google uses each conversion action's window and data-driven attribution. Platform totals are not like-for-like; how should All Platforms label or reconcile them?
- **Exact native column sets to support** need performance-team sign-off (which columns, their order and the primary field of each group).
- Are **keyword and search-term reports** needed (Google), and should keywords show search terms, negative keywords or match-type breakdowns?
- **Currency and time zone per ad account**: the prototype assumes SGD and Asia/Singapore. Accounts billed in other currencies or time zones need conversion rules and labelling.
- Should Google conversions be segmentable by **conversion action** (to show Leads / Purchases / Adds to cart separately, as the sheet suggests)?
- Should CRM-attributed columns appear at Google keyword level (needs click-ID matching)?

### Dev toolbar states
- **Client user view** (shared on/off; off = viewing as Agency Admin). **KPI panels** (26/10/2026, prototyping, on/off): switches the KPI layout on All Platforms, Google Ads and Meta Ads between the card rows and one card with three panels (Spend & Traffic · Conversions · Leads & Revenue; each a headline metric, a bar, a caption and a metric list, in that tab's own metric names). In panels mode the Leads & Revenue section becomes the third panel, with the attribution model in the section header. Each panel names its source on the heading (Conversions: "Reported by Google / Meta"; Leads & Revenue: "Verified in {CRM}"), and CRM metrics are labelled as such (Cost per CRM lead, Attributed leads (CRM)) so they're never confused with the platform's own Leads / Cost per lead. The Leads & Revenue panel headlines **Attributed revenue**, with "On $X ad spend • N.NNx ROAS" on the caption line beneath it (figures in the accent colour); leads are in its list. Panel lengths are allowed to differ: each platform keeps the native metrics it supports. **Look (26/10/2026)**: three separate cards: coloured uppercase eyebrow, bold label, large figure in the accent colour, a caption, one divider, then a compact metric list. **No bars**: budget use is a coloured % in the caption (amber from 85%, red from 100%) and platform splits are caption text (Google Ads X% · Meta Ads Y%). All Platforms uses Title Case labels; the Google / Meta tabs keep the native metric names. Cost per conversion / cost per lead sit in the metric list, not the caption. **CRM connected** (on/off; off = ad-only, no CRM): CRM columns and the Leads & Revenue section. **No ad accounts linked**: empty state. **Single platform (Google only)**: workspaces with both platforms show only the Google Ads view.
`;
}
Object.assign(screenSpecs, {
  'agency-dashboard': {
    title: '1. Agency Dashboard (My Workspace)',
    status: 'In Review',
    author: 'Hannah',
    updatedAt: '22/10/2026',
    notes: `
### Screen Purpose & Objectives
Central command dashboard for agency administrators managing many client workspaces across Ads, SEO Cloud and Aurix. A performance indicator for every account at a glance, with one click through to the specifics. Layout follows the new agency dashboard design (22/10/2026).

### Key Functional Specifications
- **Workspace Switcher**: The workspace dropdown in the top bar switches between the agency view ("My Workspace") and individual client workspaces. There is no separate My/Agency toggle.
- **Date range (27/10/2026)**: on the **Managed Accounts table toolbar** (moved from the page header), using the same Google Ads-style picker as the client campaign tables (presets incl. Last week (Mon – Sun) and Last month, N days up to today / yesterday, start / end dates and a month calendar). It still applies to every spend and cost metric on the page (KPIs, issues, the table); Total Accounts Managed is not date-dependent. All time starts at the earliest managed workspace.
  - **Prototype note:** the date filter scales mock 30-day data to the selected range. It does **not** yet filter by event date. Real behaviour must use the event date (click / conversion date), as in the client dashboard spec.
- **Layout (new agency dashboard design, 22/10/2026)**: banner → four KPI cards → Total Accounts Managed + Your Products → Managed Accounts. The dashboard is a performance indicator: each account shows its health and issue count, and users click through for the specifics.
- **Attention Required banner**: "N account issues need your attention across …", naming the three areas with the most issues (Ads Performance, SEO Cloud, Aurix, Integrations, Contracts, Agency CRM) and summarising the rest ("and 2 other areas"). It counts the same issues as the Attention Required KPI and the Issues Count column, so the numbers always agree. **View Issues** opens the all-issues slide-over. Hidden when there are no issues.
- **KPI cards** (all from the Agency CRM and the issue list; "KPIs TBC" still applies):
  - **Managed Contract Value**: sum of live CRM contracts (monthly budget × contract months) across managed accounts.
  - **Attention Required**: open issues, "Issues across N clients". A panel icon marks it; selecting it opens the **all-issues slide-over**: every pending issue grouped by product or area (most issues first), each with its CTA. The footer's "Show accounts in Managed Accounts" filters the table to Attention Required and Off Track, worst first. This replaces a dedicated outstanding-issues section on the page.
  - **Upcoming Renewals**: live CRM contracts ending within 30 days (each contract counted once).
  - **Client Follow-ups Due**: open CRM follow-up tasks. [PLACEHOLDER] mock counts until the CRM exposes tasks.
- **Total Accounts Managed**: donut by account lifecycle status (Active / New / Inactive / Cancelled). Performance problems are no longer a lifecycle status; they show as Account Health.
- **Your Products** ("N Connected Products"): one row per OOm product with a health line, plus "• N more" for the product's other pending issues. Selecting a row opens the **product slide-over** (Figma 6551:24738). Rows with pending issues show a panel icon; rows without show an external-link icon that opens the product directly.
  - **Product slide-over**: product name, the same health line, one section per issue type with a card per account (initials tile, name, detail, external-link icon that opens the client workspace), then **Other Issues** (the product's remaining issues from the issue list), and a full-width **View Product** button.
  - **Ads Performance**: *Accounts Near Spend Limits*: budget pacing ahead of pace (over 115%), shown as spend / CRM media budget for the selected dates with a % pill and bar. *Accounts Underperforming*: cost per conversion more than 15% worse than the agency average, shown as "X% above agency average" and value / agency average. There are no per-client ad targets in the CRM yet, so the agency average stands in. View Product shows the Ads columns in Managed Accounts.
  - **Aurix**: *Accounts Not Linked*: a live Aurix service in the CRM, but not linked to Aurix in Galaxis. View Product hands off to Aurix.
  - **SEO Cloud**: *Critical* and *Off Track* sections: keywords in top 10 vs target, points below, and a bar. View Product hands off to SEO Cloud.
- **Issues** (shared by the banner, KPI, Account Health and Issues Count). Each has a type, priority (High / Medium / Low), product and CTA:
  - **Performance Review** (Ads, High for the first then Medium): accounts flagged for a performance issue.
  - **Budget Pacing** (Ads, Medium): ad spend ahead of pace. **No Account Linked** (Ads, Low). **Unlinked Ad Accounts** and **Token Expired** (Ads, agency-level).
  - **SEO Critical** (High), **SEO Off Track** (Medium), **Renewal at Risk** (High: SEO contract ends within 60 days while SEO is below target).
  - **Contract Ending** (Medium): any service contract ending within 30 days.
  - **Aurix Not Linked** (Aurix, Low). **Integration Error** (High, or Medium when pending). **CRM Set-up** (Medium: client invites awaiting approval).
- **Managed Accounts table**:
  - **Default columns** (the new design, plus each service's key KPI): Client (industry · account manager underneath), **Services** (overlapping product marks: Ads Performance, SEO Cloud, Aurix, Galaxis CRM, +N other CRM services), **Account Health**, **Issues Count**, **Ads: Cost Per Conversion** (the key ads KPI), **SEO: Top 10 %** (current / target, the key SEO KPI), **Primary Contact**, **Last Activity**, Action.
  - **Account Health**: Attention Required (red) when any open issue is High priority, Off Track (orange) when there are other open issues, On Track (green) with none.
  - **Issues Count**: "N Items"; selecting it opens a drawer listing that client's issues with their CTAs.
  - **More columns, hidden by default** (column picker, or Ads Performance › Open): Ads: Ad Platforms, Combined Spend, Budget Pacing, Conversions, ROAS, CPM, CPC, Contract Days Left. SEO: SEO Status, Avg Position, Contract Days Left. Definitions:
    - **Budget Pacing**: ad spend for the selected dates against the CRM media budget for the same days (monthly media budget × days ÷ 30). Ahead of pace above 115% (red), Under spend below 80% (orange), otherwise On track (green).
    - **Contract Days Left**: each service runs on its own CRM contract; Ads shows one figure when the ad services share a contract, otherwise one per platform. Amber at 60 days or fewer, red at 30 or fewer.
    - **ROAS**: platform-reported purchase value ÷ spend, mainly meaningful for e-commerce clients.
  - **Column groups**: Account · Ads · SEO · Contact bands, collapsible; collapsed groups keep their key column (Account Health, Cost Per Conversion, Top 10 %, Primary Contact). All start expanded; each viewer's choice is remembered (prototype: localStorage). **Reset to default** restores the default columns. **Reordering (23/10/2026)**: viewers can reorder columns within a group and reorder the groups themselves, by dragging the grip handles in the column picker (arrow keys also work) or dragging the column headers / group bands in the table; columns only move within their own group. **A collapsed group always shows its first column** (the picker tags it "Shown when collapsed"); by default each group's key column is placed first, so the default collapsed view is unchanged. Dragging a whole group in the picker folds every group's column list, leaving just the group names to reorder. The order is remembered per viewer and also drives the CSV export; **Reset to default** restores it.
  - Coloured dots on Cost per Conversion (and CPM / CPC) compare each workspace with the portfolio average: green at least 10% better, orange within -10% to +15%, red more than 15% worse.
  - Search by client or contact. Filter: Account Health, Ad Platforms, Performance band, SEO Status. Every column is sortable; rows without data sort last. The ⋮ menu: Go to workspace, View SEO performance (SEO Cloud clients), Organisation settings, Integrations.
- **Filter dropdowns**: Changes apply immediately. Each group has an "All" option. **Clear Filter** removes every filter. **Revert To Original** restores the selection from when the panel was opened. **Apply** closes the panel.
- **Cross-Client Campaigns**: Removed on purpose. Per V1 notes, pulling campaign KPIs across every client is too heavy for v1, and the Managed Accounts table is enough for cross-client comparison.

### Open questions
- **KPIs TBC**: the final portfolio KPI set still needs performance-marketing and account-management sign-off.
- Should "No Account Linked" also flag workspaces linked to only one of Google / Meta?
- Performance-review triggers (CTR drop, budget pacing) are placeholders. Thresholds are TBC.
- Should Account Health weigh issue types differently (e.g. Contract Ending alone keeps an account On Track)?
- Client Follow-ups Due needs a CRM task feed; until then it is placeholder data.
- Is the keyword contract (X keywords, Y% top-10 target) owned by SEO Cloud or by the Agency CRM?
- Should the average position count keywords outside the top 100 as position 100, instead of leaving them out?
- **Managed Accounts Ads columns (reviewed 23/10/2026: keep all for now).** Conversions, ROAS, CPM and CPC are candidates to move to the workspace only (not comparable across clients, or diagnostic); revisit after user feedback.
- **Period-over-period comparison (deferred).** Cost Per Conversion is coloured against the portfolio average because ad data is a live API call with no stored history. Comparing each client with its own previous period would be more meaningful; it could also come from a second live query for the previous date range rather than storage (to confirm with engineering: extra API calls and rate limits).

### Dev toolbar states
- **Alerts** (on/off): off clears every issue: no banner, Attention Required 0, every account On Track (the healthy state).
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
  - **Columns**: Keyword (country chip "SG" + term), Ranking URL (link icon + count), Volume, Search Intent (round C / L / I / N chips; tooltip names the intent: Commercial, Local, Informational, Navigational), Difficulty (Easy / Moderate / Hard dot), History (sparkline over the date range, inverted y-axis), Baseline (position when added; "–" if it was not in the top 100), then one column per day for the last 7 days ("OCT-16"), with the position or "–". Ranking URL and Search Intent start hidden (column picker, or Reset to default).
  - **Day cell colour**: green when better than the baseline, red when worse. With no baseline, the cell is compared with the previous day.
  - Sortable: Keyword, Volume, Difficulty, Baseline and the latest day. Unranked keywords sort last in both directions. In Group mode, rows are sorted within each group.
  - 25 keywords per page by default (Showing Per Page also offers 10 / 20 / 50).
  - Only the Keyword column is pinned; the day columns scroll. There is no Action column.
  - Column picker groups: Keyword details (Ranking URL, Volume, Search Intent, Difficulty) and Rankings (History, Baseline, Previous 6 days). Keyword and the latest day are always shown.
  - Empty state when nothing matches.
- **Date range** (shared with Ad Performance; no picker on this tab since 27/10/2026, it follows the range set on the Ad Performance tables, default Last 30 days): sets the trend range, the sparkline range and the comparison point for every ▲/▼ change. History is kept for 120 days.

### Open questions
- Is the keyword contract (X keywords, Y% target) owned by SEO Cloud or by the Agency CRM?
- Should the average position include keywords outside the top 100 as position 100? Today they are left out, which can make the average improve when keywords drop out.
- Should GEO / AI-visibility metrics from SEO Cloud appear on this tab later?
- Should clients see keyword groups that are marked internal-only in SEO Cloud? The prototype shows every group.

### Dev toolbar states
- **Client user view** (shared on/off; off = viewing as Agency Admin). Client users do not see "Manage in SEO Cloud".
- **SEO status: …** (one cycle button: On track → Off track → Critical): sets this workspace's mock top-10 share to target +3, -2 or -8 points; the keyword data regenerates.
- **SEO Cloud connected** (on/off): off removes SEO Cloud from the workspace to show the not-connected state; on adds it back.
`
  },
  'client-dashboard-ads': {
    title: '1. Workspace Dashboard › Ad Performance',
    status: 'In Review',
    author: 'Hannah',
    updatedAt: '22/10/2026',
    notes: `
### Screen Purpose & Objectives
Client-facing workspace dashboard giving a simplified, unified view of Meta and Google Ads performance. Since 22/10/2026 the dashboard has two tabs below the welcome header and Products & Connections panel: **Ad Performance** (this spec) and **SEO Performance** (\`client-dashboard-seo\`). It aims to remove the client's need to log in to the native ad platforms, and it doubles as an inspection view for agency administrators. Layout follows the Figma "Dashboard - Platform / Campaign / Ad Group / Ads" frames.

### Key Functional Specifications (All metrics TBC)
- **Top-Level KPI Cards**: Total Ad Spend (with budget used and a progress bar), Impressions (unique users), Clicks (CTR and average CPC), Platform Conversions (% from Google Ads) and Cost per Conversion (per-platform split). Each card has an ⓘ definition.
  - Exact KPIs are placeholders pending feedback from performance marketing and account management.
  - The budget shown is the workspace monthly budget pro-rated to the selected range.
- **Views (22/10/2026)**: under the page tabs, a second-level segmented control **All Platforms | Google Ads | Meta Ads**, each with its platform logo. This spec is **All Platforms** (consolidated); the platform views are \`client-dashboard-ads-google\` and \`client-dashboard-ads-meta\`.
  - All Platforms appears only when the workspace has both Google and Meta linked, or more than one ad account. A platform view appears only when that platform is linked.
  - With one platform linked, only that platform's view shows (a single tab, with "Only Google Ads is linked to this workspace"). With none, the "No ad accounts linked" empty state replaces everything.
  - The view is in the route (\`view: 'all' | 'google' | 'meta'\`) and the last one used is remembered when switching workspace; a remembered view the new workspace does not have falls back to its first available view.
- **Tabs**: Ad Performance | SEO Performance (page tabs with icons). The active tab is in the route (\`tab: 'ads' | 'seo'\`) and is remembered when switching workspace; a remembered SEO tab falls back to Ad Performance in a workspace without SEO Cloud. Without SEO Cloud the SEO tab is greyed out, with a "Connect SEO Cloud" link to Integrations.
- **Global Event-Based Date Filter**: Filters all dashboard data by the exact date the action (e.g. click or conversion) happened within the selected timeframe, independent of events higher up the funnel.
  - **Placement and picker (26/10/2026)**: on Ad Performance the date range sits in the **campaign table toolbars** (Campaigns and Ads, and the Google Ads / Meta Ads reports), not the page header, and still drives the whole tab (KPIs, charts, tables). The SEO tab keeps it in the header. The picker follows the native Google Ads date picker: presets **Custom, Today, Yesterday, This week (Mon – Today), Last 7 days, Last week (Mon – Sun), Last 14 days, This month, Last 30 days, Last month, All time**, plus **N days up to today** and **N days up to yesterday**; on the right, Start / End date fields and a month calendar (click a start, then an end; future dates disabled). "Last N days" presets end yesterday, as in Google Ads. All time starts at the workspace's creation date. **Compare** is not offered: ad data is a live API call with no stored history (see the agency dashboard's open question on period comparison).
  - **Prototype note:** the date filter scales mock data to the selected range, and the Daily Performance chart plots one point per day of the range. It does **not** yet filter by event date.
- **CRM mode (from V2)**: shown when the workspace has a connected, active CRM.
  - **Products & Connections** (top of the page; Figma 6371:9127, 23/10/2026): one card of the products this workspace uses, **four cards per row** (two below 1280 px, one below 720 px). Replaces the earlier three-section panel (OOm Products / Quick Links / Connections). Header: "Products & Connections", "Active products connected to {workspace}", and "**N** Connected Products" on the right.
    - **Each card** (same parts as the Integrations cards: round product logo, card title, grey sub-line, status dot): name with its lane underneath (CRM / Automated Chat / Call Tracking / SEO), an **external-link icon** (Open) and a **settings icon** (Manage; not in the Figma yet, added 23/10/2026), then status (green dot "Connected"; red Error / amber Pending setup with **Fix now**), "Connected on: {date}" ("Added on" when not live; [PLACEHOLDER] mock dates until the integration records them), and a short description.
    - **Products in use**: OOm products (Galaxis CRM, Aurix, SEO Cloud), then the one product per lane (CRM, Automated Chat, Call Tracking; one-per-lane rule). Disabled products are left out. **Ads Performance** comes last, as in the Figma, with the linked platforms as **pills on its status line** ("● Connected" followed by Google Ads, Meta Ads, or both, each with its logo), so they read as the connected accounts rather than supported platforms.
    - **Open** opens the product's web app in a new tab (Galaxis CRM: https://crm.oomdigital.com/, Aurix: https://app.aurix.com.sg/dashboard, SEO Cloud: https://oomdigital.com/dashboard; third-party products: their own app). For Ads Performance it goes to the Ad Performance tab. **Manage** opens the product's settings drawer in Integrations (Ads Performance: Integrations, where ad accounts are linked).
    - Not in the Figma, so dropped: the collapse toggle, header alert pills and outstanding-work badges (Aurix escalations, SEO Cloud approvals). Built from the same data as Integrations.
  - Each KPI row has a section header (title + one-line description): **Ad Performance** for the platform metrics, **Leads & Revenue** for the CRM metrics (with the attribution model on the right).
  - A second row of 5 KPI cards, matching the ad-platform row: Attributed Leads (+ share of platform conversions), Cost per Lead (+ cost per conversion for comparison), Converted Leads (+ conversion rate), Attributed Revenue (+ average deal value) and ROAS (+ ad spend).
  - The table gains Leads, CPL, Revenue and ROAS columns.
  - The **attribution model** selector offers Multi-Touch (40/20/40), First-Touch and Last-Touch. Each model credits leads and revenue differently, so the figures change with the model.
  - **Ad-only mode** (no CRM): those three cards are locked ("Requires CRM"), with a "Connect a CRM to unlock leads, revenue and ROAS" banner linking to Integrations.
- **Hierarchical Campaign Breakdown Table ("Campaigns and Ads")**: Users drill down through Platform → Campaign → Ad Group → Ad to compare key statistics.
  - **Level tabs**: Platform / Campaigns / Ad Groups / Ads.
  - **Drill-down**: clicking a row, or "View …" in the ⋮ menu, opens the next level with a "Filtered for X ✕" badge. Clearing the badge returns to Platform.
  - **Columns**: Name (parent shown above), Ad Format (+N overflow), Status, then the platform metrics from the *Google & Meta Ads Metrics* sheet (Metrics (Dev Notes), green rows), in sheet order: Spend (Cost), Impressions, Reach, CPM, Frequency, Clicks, CTR, CPC, Conversions, Conversion Rate, Cost Per Conversion (kept from V1), Cost Per Lead, Cost Per Purchase, ROAS, Conversion Value, Engagement Rate, Engagement, Cost Per Engagement. In CRM mode, CRM Leads, CRM CPL, CRM Revenue and CRM ROAS follow ("CRM" prefix to separate CRM-attributed ROAS from platform-reported ROAS). Header tooltips show the sheet's definitions. Every column is sortable, including Status (Active → Paused; Google and Meta report only these two) and Ad Format (first format).
  - **Column picker** (columns icon next to the filter): show or hide columns, grouped as Overview (Ad Format, Status, Spend), Impressions (Impressions, Reach, CPM, Frequency), Clicks, Conversions, Engagement and CRM (CRM mode only), with Show all / Hide all per group and Show all columns. The badge counts hidden columns. Name and Action are always shown.
  - **Default columns (22/10/2026 table principle: all columns, collapsed)**: every column is shown; every metric group starts **collapsed** to its summary column, and Overview (Ad Format, Status, Spend) stays expanded. Default view: Name, Ad Format, Status, Spend, Impressions, CTR, Conversions, Engagement Rate, CRM ROAS (CRM mode), Action. Expanding a group shows the rest of its columns. **Reset to default** restores this. (Before 22/10/2026, 11 columns started hidden; the storage keys were bumped so every viewer gets the new default once.)
  - **Column groups**: the same groups appear as collapsible bands above the column headers (one colour for every group, a deeper blue than the column headers, with 2px soft-blue dividers; 23/10/2026). Collapsing a group leaves its summary column: Overview → Spend, Impressions → Impressions, Clicks → CTR, Conversions → Conversions, Engagement → Engagement Rate, CRM → CRM ROAS (or the group's first visible column if that one is hidden). "Collapse all / Expand all" sits above the name column. Each viewer's choice is remembered in the browser (prototype: localStorage; product: save per user). **Reordering (23/10/2026)**: viewers can reorder columns within a group and reorder the groups themselves, by dragging the grip handles in the column picker (arrow keys also work) or dragging the column headers / group bands in the table; columns only move within their own group. **A collapsed group always shows its first column** (the picker tags it "Shown when collapsed"); by default each group's key column is placed first, so the default collapsed view is unchanged. Dragging a whole group in the picker folds every group's column list, leaving just the group names to reorder. The order is remembered per viewer and also drives the CSV export; **Reset to default** restores it.
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
- **Client user view** (shared on/off; off = viewing as Agency Admin).
- **CRM connected** (on/off): off deactivates every CRM for this workspace (ad-only), which also hides the Leads nav item.
- **CRM connected**: makes Galaxis CRM connected and active, and every other CRM inactive.
- **No ad accounts linked**: simulates the empty state without changing ad-account data.
- **Single platform (Google only)**: hides Meta for a workspace with both platforms, so only the Google Ads view shows (no All Platforms). Shared with the platform views.
`
  },
  'client-dashboard-ads-google': {
    title: '1c. Workspace Dashboard › Ad Performance › Google Ads',
    status: 'Draft',
    author: 'Hannah',
    updatedAt: '22/10/2026',
    notes: dashPfSpecCommon('Google Ads') + `
### Google Ads specifics
- **KPI row (26/10/2026: mirrors the Google Ads overview scorecards)**, native names, ⓘ = sheet definition: **Clicks** (CTR) · **Impr.** (Avg. CPM) · **Avg. CPC** · **Cost** (share of workspace ad spend when both platforms are linked) · **Conversions** (All conv.) · **Cost / conv.** · **Conv. rate**. Removed from the KPI row: Search impr. share (Search campaigns only, not additive across campaign types, not a default scorecard) and Conv. value / cost (only meaningful for e-commerce). Both remain in the report table.
- **Levels**: Campaigns | Ad groups | Ads | Keywords. Clicking a campaign opens its ad groups; clicking an ad group opens its ads; the ⋮ menu of a Search ad group (or campaign) also offers **View keywords (N)**.
  - **Keywords** exist only under Search campaigns: 3–6 per ad group, each with Match type (Exact shown as [keyword], Phrase as "keyword", Broad plain), Quality Score 1–10 (coloured dot: 7+ green, 5–6 orange, below 5 red) and Max. CPC. Keyword metrics split their ad group's totals exactly; impression share varies per keyword.
- **Columns** (native names; levels in brackets where a column does not exist at every level):
  - **Attributes**: Status (Enabled / Limited / Paused), Campaign type (Search / Display / Video / Performance Max, from the campaign) [campaigns], Bid strategy type [campaigns], Budget (daily) [campaigns], Ad group type [ad groups; Performance Max uses asset groups], Ad type, Final URL (placeholder example.com URLs) [ads], Match type, Quality Score, Max. CPC [keywords].
  - **Performance**: Impr., Clicks, CTR, Avg. CPC, Cost, Avg. CPM, Interactions, Engagement rate, Avg. CPE.
  - **Conversions**: Conversions, Conv. rate, Cost / conv., All conv., Conv. value, Conv. value / cost.
  - **Competitive metrics** [campaigns, ad groups, keywords; not ads, as in Google Ads]: Search impr. share, Search top IS, Search abs. top IS, Search lost IS (rank), Search lost IS (budget) [not keywords]. Search campaigns only (10–90% in the mock); other rows show "—".
  - **Reach metrics** [not keywords]: Unique reach, Avg. impr. freq. / user.
  - **Video** [not keywords]: Video views (ThruView views in the sheet), Video played to 25% / 50% / 75% / 100% (percentages). Video ads only; other rows "—".
  - **Store visits** [not keywords]: Store visits (Shop Visits in the sheet). Sparse: most rows are 0.
  - **CRM** (CRM mode, not keywords): CRM Leads, CRM CPL, CRM Revenue, CRM ROAS.
- **Collapsed defaults (primary field)**: Attributes → Status (expanded by default), Performance → Cost, Conversions → Cost / conv., Competitive metrics → Search impr. share, Reach metrics → Unique reach, Video → Video views, Store visits → Store visits, CRM → CRM ROAS.
- **Competitive metrics hidden by default (26/10/2026)**: Search impr. share, Search top IS, Search abs. top IS and the lost-IS columns are not in Google Ads' default column set and apply to Search only, so the group starts hidden; viewers can switch it on in the column picker.
- **Filter**: Status (Enabled / Limited / Paused) and Campaign type. Ad groups, ads and keywords filter by their campaign's type.
- **Google-only metrics** (N/A for Meta in the sheet): All conv., Search impr. share, Search top IS, Search abs. top IS, Search lost IS (rank), Search lost IS (budget), Shop visits (Store visits), ThruView views (Video views).
- **Not separate columns in Google**: the sheet's Leads, Purchases, Adds to cart and Initiate checkout map to Google's Conversions *for that conversion action*. They need a "Conversion action" segment, not extra columns (open question below). Cost per lead / cost per purchase likewise come from Cost / conv.
- **Interaction rate** is not shown: in this data model it equals Engagement rate (the sheet maps Engagement → Interactions and Engagement rate → metrics.engagement_rate). Add it if the performance team wants both.

### API fields (Metrics (Dev Notes) tab, Google)
- Cost \`metrics.cost_micros\` · Impr. \`metrics.impressions\` · Unique reach \`metrics.unique_users\` · Avg. CPM \`metrics.average_cpm\` · Avg. impr. freq. / user \`metrics.average_impression_frequency_per_user\`
- Clicks \`metrics.clicks\` · CTR \`metrics.ctr\` · Avg. CPC \`metrics.average_cpc\`
- Conversions \`metrics.conversions\` (also Leads / Purchases / Adds to cart / Checkouts when set up as those actions) · Conv. rate \`metrics.conversions_from_interactions_rate\` · Cost / conv. \`metrics.cost_per_conversion\` · Conv. value \`metrics.conversions_value\` · Conv. value / cost \`metrics.conversions_value_per_cost\`
- Engagement rate \`metrics.engagement_rate\` · Interactions \`metrics.interactions\` · Avg. CPE \`metrics.average_cpe\`
- No API field in the sheet yet: All conv., the five impression-share metrics, Store visits, Video views, Video played to 25–100%. [PLACEHOLDER] for development to fill in (e.g. \`metrics.all_conversions\`, \`metrics.search_impression_share\` — to confirm).
`
  },
  'client-dashboard-ads-meta': {
    title: '1d. Workspace Dashboard › Ad Performance › Meta Ads',
    status: 'Draft',
    author: 'Hannah',
    updatedAt: '22/10/2026',
    notes: dashPfSpecCommon('Meta Ads') + `
### Meta Ads specifics
- **KPI row (26/10/2026: Ads Manager's account-level metrics)**, native names: **Amount spent** (share of workspace ad spend) · **Reach** (Frequency) · **Impressions** (CPM (cost per 1,000 impressions)) · **Link clicks** (CPC (cost per link click)) · **CTR (link click-through rate)** · **Leads** (% of link clicks) · **Cost per lead**. Removed from the KPI row: Results and Cost per result (each campaign's result type depends on its objective, e.g. reach, link clicks or leads, so an account-wide sum is meaningless) and Purchase ROAS (e-commerce only). All remain in the report table.
- **Levels**: Campaigns | Ad sets | Ads. Meta ad sets are the hierarchy's ad groups. Clicking a campaign opens its ad sets; clicking an ad set opens its ads.
- **Columns** (native names):
  - **Settings**: Delivery (Active / Learning / Learning limited / Paused), Objective (Leads / Sales / Traffic / Awareness / Engagement, from the campaign) [campaigns], Budget (daily or lifetime; "Using ad set budget" / "Using campaign budget" when the budget sits at the other level) [campaigns, ad sets], Optimisation goal [ad sets], Ad format (Single image / Single video / Carousel) [ads], Attribution setting ("7-day click, 1-day view").
  - **Performance**: Results, Result rate, Cost per result, Amount spent, Reach, Impressions, Frequency, CPM (cost per 1,000 impressions).
  - **Clicks**: Link clicks, CTR (link click-through rate), CPC (cost per link click), Clicks (all), CTR (all), CPC (all), Landing page views, Cost per landing page view.
  - **Engagement**: Post engagement, Cost per post engagement, Engagement rate, Post shares, Post saves, Instagram follows, Instagram profile visits.
  - **Messaging**: Messaging conversations started, Cost per messaging conversation started (only some ads have messaging; others 0 / "—").
  - **Video**: ThruPlays (15-second ThruPlays in the sheet), Video plays at 25% / 50% / 75% / 100% (counts). Video ads only.
  - **Conversions**: Leads, Cost per lead, Purchases, Cost per purchase, Purchases conversion value, Purchase ROAS (return on ad spend), Adds to cart, Checkouts initiated.
  - **CRM** (CRM mode): CRM Leads, CRM CPL, CRM Revenue, CRM ROAS.
- **Collapsed defaults (primary field)**: Settings → Delivery (expanded by default), Performance → Cost per result, Clicks → CTR (link), Engagement → Post engagement, Messaging → Messaging conversations started, Video → ThruPlays, Conversions → **Leads**, CRM → CRM ROAS.
  - Why Leads rather than Purchase ROAS: most workspaces run lead objectives and the Hub's CRM mode is lead-based; Purchase ROAS only means something with purchase tracking (it is one click away).
- **Filter**: Delivery and Objective. Ad sets and ads filter by their campaign's objective.
- **Meta-only metrics** (N/A for Google in the sheet): Clicks (all), CTR (all), CPC (all), Landing page views, Cost per landing page view, Messaging conversations started, Cost per messaging conversation started, 15-second ThruPlays, Post shares, Post saves, Instagram follows, Instagram profile visits.
- **Results**: in Meta, Results count each ad set's optimisation event. The prototype uses the same conversion count as the consolidated table (so the totals agree). Confirm which event "Results" should use per objective.

### API fields (Metrics (Dev Notes) tab, Meta)
- Amount spent \`spend\` · Impressions \`impressions\` · Reach \`reach\` · CPM \`cpm\` · Frequency \`frequency\`
- Link clicks \`inline_link_clicks\` · CTR (link) \`inline_link_click_ctr\` · CPC (link) \`cost_per_inline_link_click\`
- Results / Leads \`actions\` · Result rate \`actions / inline_link_clicks\` · Cost per lead / Cost per purchase \`cost_per_action_type\` · Purchase ROAS \`purchase_roas\` · Purchases conversion value \`action_values\`
- Adds to cart \`actions\` (action_type = 'add_to_cart') · Checkouts initiated \`actions\` (action_type = 'initiate_checkout')
- Post engagement \`actions\` (action_type = 'post_engagement') · Engagement rate \`actions / impressions\` (post_engagement) · Cost per post engagement \`cost_per_action_type\` (post_engagement)
- No API field in the sheet yet: Clicks (all), CTR (all), CPC (all), Landing page views, Cost per landing page view, Purchases, Messaging, ThruPlays, Video plays, Post shares / saves, Instagram follows / profile visits. [PLACEHOLDER] for development to fill in.
- Definitions not in the sheet (prototype wording, to confirm): Messaging conversations started, Cost per messaging conversation started, Post shares, Post saves, Instagram follows, Instagram profile visits, Video plays at 25–100%.
`
  }
});
