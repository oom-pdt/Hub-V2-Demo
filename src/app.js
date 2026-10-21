// Galaxis Hub demo — start-up. Loaded last, after every screen module has registered itself.

function initApp() {
  // Core pages first in the dev screen selector, then any extra screens modules registered (role editor, lead profile…).
  const extras = devScreens.splice(0);
  const pages = [['dashboard', 'Dashboard'], ['organisation', 'Organisation'], ['team', 'Team & Access'], ['integrations', 'Integrations'], ['leads', 'Leads']];
  pages.forEach(([page, label]) => {
    const def = screens[page];
    if (!def) return;
    // Modules with sub-screens (e.g. one per tab) register their own entries instead.
    const owned = ctx => extras.some(e => e.key === `${ctx}-${page}` || e.key.startsWith(`${ctx}-${page}-`));
    if (owned('agency') || owned('client')) return;
    if (!def.contexts || def.contexts.includes('agency')) registerDevScreen('Agency', `agency-${page}`, label, () => { state.ctx = null; state.persona = 'agency'; navigate(page); });
    if (!def.contexts || def.contexts.includes('client')) registerDevScreen('Client workspace', `client-${page}`, label, () => { state.ctx = devClientCtx(); navigate(page); });
  });
  devScreens.push(...extras);
  devScreens.sort((a, b) => (a.group === b.group ? 0 : a.group === 'Agency' ? -1 : 1));
  render();
}

initApp();
