// Galaxis Hub demo — SEO Cloud data: keywords, daily positions, position buckets and project status.
// Mock data is generated per workspace from seoProjects (data.js) and cached. All keywords are placeholders.
// Globals are prefixed `seo`.

const SEO_HISTORY_DAYS = 120;   // daily position history kept per keyword
const SEO_BUCKETS = [
  { key: 'all', label: 'All', max: Infinity },
  { key: 'top1', label: 'Top 1', max: 1 },
  { key: 'top3', label: 'Top 3', max: 3 },
  { key: 'top5', label: 'Top 5', max: 5 },
  { key: 'top10', label: 'Top 10', max: 10 },
  { key: 'top30', label: 'Top 30', max: 30 },
  { key: 'over100', label: 'Top >100', max: null }   // not ranking in the top 100
];
const SEO_INTENTS = { C: 'Commercial', L: 'Local', I: 'Informational', N: 'Navigational' };
const SEO_DIFFICULTY = ['Easy', 'Moderate', 'Hard'];

// Keyword groups per industry. {loc} becomes "singapore" on some keywords.
const SEO_TOPICS = {
  'Digital Media': [['Video Production', ['video production company', 'corporate video production', 'video agency', 'explainer video company', 'event videography']], ['Content Studio', ['content production studio', 'social media video agency', 'branded content agency', 'photography studio']]],
  Technology: [['IT Services', ['managed it services', 'it support company', 'cloud migration services', 'cyber security company']], ['Software', ['custom software development', 'app development company', 'saas development agency', 'erp implementation']]],
  Logistics: [['Freight', ['freight forwarding company', 'air freight services', 'sea freight forwarder', 'customs brokerage']], ['Warehousing', ['warehouse storage', 'third party logistics', 'fulfilment services', 'last mile delivery']]],
  Manufacturing: [['Fabrication', ['metal fabrication company', 'cnc machining services', 'precision engineering', 'sheet metal fabrication']], ['Industrial Supply', ['industrial equipment supplier', 'factory automation', 'packaging manufacturer']]],
  Education: [['Courses', ['enrichment classes', 'tuition centre', 'coding classes for kids', 'adult learning courses']], ['Enrolment', ['open house', 'skillsfuture courses', 'diploma courses', 'part time degree']]],
  'Professional Services': [['Consulting', ['business consulting firm', 'management consultancy', 'hr consulting services']], ['Accounting', ['accounting firm', 'corporate secretarial services', 'payroll services', 'tax filing services']]],
  Finance: [['Advisory', ['financial advisory', 'wealth management', 'retirement planning', 'investment advisory']], ['Insurance', ['insurance agency', 'business insurance', 'health insurance plans']]],
  Property: [['Property Search', ['new condo launch', 'property agent', 'commercial property for rent', 'office space for rent']], ['Valuation', ['property valuation', 'home loan advisory']]],
  Retail: [['Shop', ['online furniture store', 'home decor shop', 'lighting store', 'mattress store']], ['Promotions', ['furniture sale', 'home decor sale']]],
  'F&B': [['Dining', ['halal restaurant', 'family restaurant', 'private dining room', 'buffet restaurant']], ['Catering', ['corporate catering', 'event catering', 'bento delivery']]]
};
const SEO_GENERIC = [['Best / Top Brand', ['best {svc} company', 'top {svc} agency', 'best {svc} services']]];

const seoCache = {};

// Today at 00:00 SGT (local for the demo) and day arithmetic, matching the date filter.
function seoToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function seoDayIso(offset) { const d = seoToday(); d.setDate(d.getDate() - offset); return toDateInput(d); }

// SEO Cloud counts as connected when the product is connected and active and a project exists.
function seoConnected(wsId) {
  const e = wsProducts(wsId)['seo-cloud'];
  return !!(e && e.status === 'connected' && e.active && seoProjects[wsId]);
}

// Status rule (Hannah): On track at or above target; Off track below by less than 5 points; Critical 5+ points below.
function seoStatus(pct, target) {
  const gap = Math.round((target - pct) * 10) / 10;
  if (gap <= 0) return { key: 'on', label: 'On track', pill: 'pill-green', dot: 'green', gap };
  if (gap < 5) return { key: 'off', label: 'Off track', pill: 'pill-orange', dot: 'orange', gap };
  return { key: 'critical', label: 'Critical', pill: 'pill-red', dot: 'red', gap };
}

// Keywords with daily positions (index 0 = SEO_HISTORY_DAYS-1 days ago … last = today). null = not in the top 100.
function seoProject(wsId) {
  const cfg = seoProjects[wsId];
  if (!cfg) return null;
  const key = `${wsId}|${cfg.contractedKeywords}|${cfg.scenarioTop10Pct}`;
  if (seoCache[key]) return seoCache[key];
  const ws = wsById(wsId);
  const r = seededRandom((ws?.seed || 1) * 131 + 7);
  const svc = (SEO_TOPICS[ws?.industry]?.[0]?.[0] || 'digital marketing').toLowerCase();
  const topics = [...SEO_GENERIC.map(([g, list]) => [g, list.map(t => t.replace('{svc}', svc))]), ...(SEO_TOPICS[ws?.industry] || SEO_TOPICS.Technology)];
  // Expand terms with location / modifiers until the contracted count is reached.
  const mods = ['', ' singapore', ' near me', ' price', ' sg'];
  const terms = [];
  for (let m = 0; terms.length < cfg.contractedKeywords && m < mods.length * 3; m++) {
    topics.forEach(([group, list]) => list.forEach(t => {
      if (terms.length >= cfg.contractedKeywords) return;
      const term = `${t}${mods[m % mods.length]}${m >= mods.length ? ` ${['services', 'company', 'agency'][Math.floor(m / mods.length) - 1]}` : ''}`.replace(/\s+/g, ' ').trim();
      if (!terms.some(x => x.term === term)) terms.push({ term, group });
    }));
  }
  // Today's positions: exactly round(n × scenario%) keywords in the top 10.
  const n = terms.length;
  const inTop10 = Math.round(n * cfg.scenarioTop10Pct / 100);
  const order = terms.map((_, i) => i).sort(() => r() - 0.5);
  const today = new Array(n);
  order.forEach((idx, rank) => {
    if (rank < inTop10) today[idx] = 1 + Math.floor(Math.pow(r(), 1.6) * 10);
    else {
      const x = r();
      today[idx] = x < 0.45 ? 11 + Math.floor(r() * 20) : x < 0.8 ? 31 + Math.floor(r() * 70) : null;
    }
  });
  const lastChecked = `${seoDayIso(0)}T06:00:00+08:00`;
  const keywords = terms.map((t, i) => {
    // Walk backwards from today: positions were usually worse in the past (SEO improves over time), not always.
    const pos = new Array(SEO_HISTORY_DAYS);
    let p = today[i] === null ? 100 + Math.floor(r() * 30) : today[i];
    const drift = -0.12 + r() * 0.36;   // most keywords improved over time, some slipped
    for (let d = SEO_HISTORY_DAYS - 1; d >= 0; d--) {
      if (d < SEO_HISTORY_DAYS - 1) p = Math.max(1, Math.round(p + drift * (r() < 0.6 ? 1 : 0) + (r() - 0.5) * 3));
      pos[d] = d === SEO_HISTORY_DAYS - 1 ? today[i] : (p > 100 ? null : p);
    }
    const intents = ['C'].concat(t.term.includes('singapore') || t.term.includes('near me') || t.term.includes(' sg') ? ['L'] : [], r() < 0.2 ? ['I'] : []);
    return {
      id: `${wsId}-kw${i + 1}`, term: t.term, group: t.group, country: 'SG',
      rankingUrls: today[i] === null ? 0 : 1 + (r() < 0.2 ? 1 : 0),
      volume: [10, 20, 30, 50, 70, 90, 110, 140, 170, 210, 260, 320, 390, 480, 590, 720, 880, 1000, 1300, 1600][Math.floor(Math.pow(r(), 1.4) * 20)],
      intent: intents, difficulty: SEO_DIFFICULTY[r() < 0.55 ? 0 : r() < 0.75 ? 1 : 2],
      baseline: r() < 0.35 ? null : pos[0] ?? null,   // position when the keyword was added (often unranked)
      positions: pos
    };
  });
  const groups = [...new Set(keywords.map(k => k.group))].map(name => ({ name, keywords: keywords.filter(k => k.group === name), updatedAt: lastChecked }));
  return (seoCache[key] = { wsId, ...cfg, tracked: n, keywords, groups, lastChecked, domain: ws?.site || '' });
}

function seoInBucket(pos, b) { return b.max === null ? pos === null : b.max === Infinity ? true : pos !== null && pos <= b.max; }
function seoPosAt(k, daysAgo) { return k.positions[SEO_HISTORY_DAYS - 1 - Math.min(daysAgo, SEO_HISTORY_DAYS - 1)]; }

// Stats for the selected range: bucket counts/% today and change vs the start of the range,
// average position (keywords ranking in the top 100) with its daily series, and status vs target.
function seoStats(wsId, days = 30) {
  const p = seoProject(wsId);
  if (!p) return null;
  const span = Math.min(days, SEO_HISTORY_DAYS - 1);
  const n = p.keywords.length || 1;
  const buckets = SEO_BUCKETS.map(b => {
    const count = p.keywords.filter(k => seoInBucket(seoPosAt(k, 0), b)).length;
    const prev = p.keywords.filter(k => seoInBucket(seoPosAt(k, span), b)).length;
    return { ...b, count, pct: Math.round(count / n * 100), delta: count - prev };
  });
  const avgOn = ago => {
    const ranked = p.keywords.map(k => seoPosAt(k, ago)).filter(v => v !== null);
    return ranked.length ? ranked.reduce((t, v) => t + v, 0) / ranked.length : null;
  };
  const series = [];
  for (let ago = span; ago >= 0; ago--) series.push({ date: seoDayIso(ago), avg: avgOn(ago) });
  const top10 = buckets.find(b => b.key === 'top10');
  const top10Pct = p.keywords.length ? Math.round(top10.count / p.keywords.length * 1000) / 10 : 0;
  return {
    project: p, buckets, series, days: span,
    avgPos: avgOn(0), avgPosPrev: avgOn(span),
    top10Pct, target: p.targetTop10Pct,
    status: seoStatus(top10Pct, p.targetTop10Pct)
  };
}

// Agency roll-up across visible workspaces with SEO Cloud connected.
function seoPortfolio(list) {
  const rows = (list || activeWorkspaces()).filter(w => seoConnected(w.id)).map(w => ({ ws: w, stats: seoStats(w.id, dateRangeDays('agency')) }));
  const by = k => rows.filter(x => x.stats.status.key === k).length;
  const avg = f => rows.length ? rows.reduce((t, x) => t + f(x), 0) / rows.length : 0;
  return {
    rows, clients: rows.length,
    onTrack: by('on'), offTrack: by('off'), critical: by('critical'),
    avgTop10Pct: avg(x => x.stats.top10Pct), avgTarget: avg(x => x.stats.target),
    keywords: rows.reduce((t, x) => t + x.stats.project.tracked, 0),
    contracted: rows.reduce((t, x) => t + x.stats.project.contractedKeywords, 0)
  };
}
