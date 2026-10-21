// Galaxis Hub demo — developer toolbar: screen selector and scenario toggles.

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

  document.getElementById('devbar').innerHTML = `
    <span class="devbar-title">Galaxis Hub Demo <span class="tag">DEV</span></span>
    <select aria-label="Jump to screen" onchange="devJump(this.value)">${options}</select>
    <div class="devbar-toggles">
      <span class="lbl">States:</span>
      ${toggles.length ? toggles.map((t, i) => t === 'sep' ? '<span class="lbl">|</span>' :
        `<button type="button" class="dev-toggle ${t.active ? 'active' : ''}" onclick="window.__devToggles[${i}].run()">${esc(t.label)}</button>`).join('') : '<span class="lbl">Default state only</span>'}
    </div>`;
}
