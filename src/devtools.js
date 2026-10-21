// Galaxis Hub demo — developer toolbar: screen selector, scenario toggles and the specs drawer.

const devScreens = [];

// group: 'Agency' | 'Client workspace'. go() must put the app on that screen.
function registerDevScreen(group, key, label, go) { devScreens.push({ group, key, label, go }); }

function devJump(key) {
  const s = devScreens.find(d => d.key === key);
  if (s) s.go();
}

// Default client workspace used when jumping to a client screen from the agency context.
function devClientCtx() { return state.ctx || 'ws-visual'; }

function renderDevBar() {
  const key = screenKey();
  const groups = ['Agency', 'Client workspace'];
  const options = groups.map(g => `<optgroup label="${g}">${devScreens.filter(s => s.group === g).map(s =>
    `<option value="${s.key}" ${s.key === key ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</optgroup>`).join('');

  const toggles = [];
  if (!isAgency()) {
    toggles.push({ label: 'Viewing as Agency Admin', active: state.persona === 'agency', run: () => { state.persona = 'agency'; render(); } });
    toggles.push({ label: 'Viewing as Client User', active: state.persona === 'client', run: () => { state.persona = 'client'; render(); } });
  }
  const own = devToggleRegistry[key] ? devToggleRegistry[key]() : [];
  if (own.length && toggles.length) toggles.push('sep');
  toggles.push(...own);
  window.__devToggles = toggles;

  const spec = getScreenSpec(key);
  document.getElementById('devbar').innerHTML = `
    <span class="devbar-title">Galaxis Hub Demo <span class="tag">DEV</span></span>
    <select aria-label="Jump to screen" onchange="devJump(this.value)">${options}</select>
    <div class="devbar-toggles">
      <span class="lbl">States:</span>
      ${toggles.length ? toggles.map((t, i) => t === 'sep' ? '<span class="lbl">|</span>' :
        `<button type="button" class="dev-toggle ${t.active ? 'active' : ''}" onclick="window.__devToggles[${i}].run()">${esc(t.label)}</button>`).join('') : '<span class="lbl">Default state only</span>'}
    </div>
    <button type="button" class="dev-specs-btn" onclick="toggleSpecs()"><i data-lucide="file-text"></i>Specs${spec.status ? ` · ${esc(spec.status)}` : ''}</button>`;
  if (document.getElementById('specs-drawer').classList.contains('open')) renderSpecs();
}

// ---------- Specs drawer ----------
function getScreenSpec(key) {
  return (typeof screenSpecs !== 'undefined' && screenSpecs[key]) || { title: 'No specifications written yet', status: '', author: '', updatedAt: '', notes: '' };
}

function toggleSpecs() {
  const d = document.getElementById('specs-drawer');
  if (d.classList.contains('open')) { closeSpecs(); return; }
  renderSpecs();
  d.classList.add('open');
}
function closeSpecs() { document.getElementById('specs-drawer').classList.remove('open'); }

function renderSpecs() {
  const s = getScreenSpec(screenKey());
  const badge = s.status ? `<span class="specs-badge specs-badge-${s.status.toLowerCase().replace(/\s+/g, '').replace('inreview', 'review')}">${esc(s.status)}</span>` : '';
  document.getElementById('specs-drawer').innerHTML = `
    <div class="specs-inner">
      <div class="specs-head">
        <div>
          <h2 class="specs-title">${esc(s.title)}</h2>
          <div class="specs-meta">${badge}${s.author ? `<span>Specifications by ${esc(s.author)}</span>` : ''}${s.updatedAt ? `<span>· Last updated ${esc(s.updatedAt)}</span>` : ''}<span class="mono">${esc(screenKey())}</span></div>
        </div>
        <div class="row">
          <button type="button" class="btn btn-outline btn-sm" onclick="copySpecs()"><i data-lucide="copy"></i>Copy Markdown</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="closeSpecs()"><i data-lucide="x"></i>Close</button>
        </div>
      </div>
      <div class="specs-md">${formatMarkdown(s.notes)}</div>
    </div>`;
  refreshIcons();
}

function copySpecs() {
  const s = getScreenSpec(screenKey());
  const md = `# ${s.title}\n\n${(s.notes || '').trim()}\n`;
  const done = () => showToast('Specs copied as Markdown', 'clipboard-check');
  if (navigator.clipboard) navigator.clipboard.writeText(md).then(done, () => fallbackCopy(md, done));
  else fallbackCopy(md, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { showToast('Copy failed — select the text manually', 'triangle-alert'); }
  ta.remove();
}

// Small markdown renderer (ported from V1): headings, nested lists, bold, italic, code.
function formatMarkdown(text) {
  if (!text) return '<p class="t-muted"><em>No notes entered yet.</em></p>';
  const inline = s => esc(s).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code>$1</code>');
  let html = '';
  const stack = [];
  const closeAll = () => { while (stack.length) { stack.pop(); html += '</li></ul>'; } };
  for (const raw of text.split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith('### ')) { closeAll(); html += `<h3>${inline(t.slice(4))}</h3>`; continue; }
    if (t.startsWith('## ')) { closeAll(); html += `<h2>${inline(t.slice(3))}</h2>`; continue; }
    const m = raw.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (m) {
      const indent = m[1].replace(/\t/g, '  ').length;
      const content = inline(m[3]);
      if (!stack.length || indent > stack[stack.length - 1]) { stack.push(indent); html += '<ul><li>' + content; }
      else if (indent === stack[stack.length - 1]) html += '</li><li>' + content;
      else {
        while (stack.length && stack[stack.length - 1] > indent) { stack.pop(); html += '</li></ul>'; }
        if (!stack.length) { stack.push(indent); html += '<ul><li>' + content; } else html += '</li><li>' + content;
      }
      continue;
    }
    if (stack.length) {
      const indent = (raw.match(/^(\s*)/) || ['', ''])[1].length;
      if (indent >= 2) { html += `<div class="t-secondary">${inline(t)}</div>`; continue; }
      closeAll();
    }
    html += `<p>${inline(t)}</p>`;
  }
  closeAll();
  return html;
}
