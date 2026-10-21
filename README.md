# Galaxis Hub Demo

A clickable prototype of the Galaxis Hub, built from three sources:

- **Galaxis Hub v1** (`../Hub-V1`). Every v1 feature is included.
- **Galaxis Hub v2** (`../Galaxis Hub v2 Prototype.html`). Only the features v1 lacked are included: the integrations hub, the CRM / ad-only modes with ROAS, the attribution model selector, and Leads with Lead Profile.
- **Galaxis Product Design** (Figma, page "🚧 [WIP] Product Hub"). This sets the information architecture (Dashboard / Organisation / Team & Access / Integrations) and the UI.

All people, companies, emails, numbers and billing figures are placeholders.

## Running it

Open `index.html` directly in a browser. No build step is needed.

Or serve it with Vite:

```bash
npm install
npm run dev        # http://localhost:5173
```

## Single-file build

```bash
npm run build      # python3 scripts/build_standalone.py
```

This writes `standalone.html` and `dist/index.html`, with every stylesheet and script inlined. Google Fonts and Lucide icons still load from a CDN.

## Developer toolbar

The dark bar at the top has two parts:

- **Screen selector:** jump to any screen in the agency context ("My Workspace") or a client workspace.
- **States:** scenario toggles for the current screen, such as alerts on/off, ad-only vs CRM connected, integration error states, or viewing as an Agency Admin vs a Client User.

## Code layout

| File | Purpose |
|---|---|
| `src/design.css` | Figma tokens (colours, fonts, radii, shadows) and shared components |
| `src/data.js` | Shared mock entities: workspaces, ad accounts, products, members, teams, roles |
| `src/core.js` | State, routing (`navigate`, `switchWorkspace`), formatting, modals, drawer, menus, sorting, pagination, date filter |
| `src/shell.js` | Sidebar, page header, workspace switcher |
| `src/devtools.js` | Developer toolbar |
| `src/specs.js` | Spec registry: each module adds its screen specs here as documentation (not shown in the UI) |
| `src/dashboard.js` | Agency and client dashboards |
| `src/organisation.js` | Business Information, Billing, Brand Identity |
| `src/team-access.js` | Members, Teams, Roles & Permissions, Client Organisation, Agency |
| `src/integrations.js` | Product integrations, ad account linking, master tokens |
| `src/leads.js` | Leads list and Lead Profile |
| `src/app.js` | Start-up |

Each module is a plain script loaded in the order listed in `index.html`, so all modules share one set of globals. Each module prefixes its globals (`dash`, `org`, `team`, `integ`, `lead`) to avoid name clashes, and keeps any styles of its own in its matching `.css` file.
