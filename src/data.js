// Galaxis Hub demo — shared mock data. Every person, email and number here is a placeholder.
// Modules may add their own domain data, but the entities below are the single source of truth.

const AGENCY_ORG = {
  id: 'agency',
  name: 'OOm Pte Ltd',
  status: 'active',
  country: 'Singapore',
  industry: 'Digital Media',
  site: 'oom.com.sg',
  email: 'contact@example.com',
  description: 'Performance marketing agency managing client advertising, SEO and CRM programmes. [PLACEHOLDER]',
  seats: 20
};

// status: active | new | inactive | attention — matches the Managed Accounts status pill.
const workspaces = [
  { id: 'ws-visual',    name: 'Visual Studio',          industry: 'Digital Media', site: 'visualstudio.example.com', status: 'new',       budget: 60000, seed: 1,  createdAt: '2026-01-02', archived: false },
  { id: 'ws-technova',  name: 'TechNova Solutions',     industry: 'Technology',    site: 'technova.example.com',     status: 'new',       budget: 40000, seed: 2,  createdAt: '2026-02-11', archived: false },
  { id: 'ws-innowave',  name: 'InnoWave Technologies',  industry: 'Technology',    site: 'innowave.example.com',     status: 'attention', budget: 35000, seed: 3,  createdAt: '2025-11-20', archived: false },
  { id: 'ws-kinspired', name: 'K-Inspired Logistics',   industry: 'Logistics',     site: 'kinspired.example.com',    status: 'active',    budget: 25000, seed: 4,  createdAt: '2025-08-14', archived: false },
  { id: 'ws-nexgen',    name: 'NexGen Dynamics',        industry: 'Manufacturing', site: 'nexgen.example.com',       status: 'active',    budget: 30000, seed: 5,  createdAt: '2025-06-03', archived: false },
  { id: 'ws-bright',    name: 'BrightFuture Enterprises', industry: 'Education',   site: 'brightfuture.example.com', status: 'active',    budget: 22000, seed: 6,  createdAt: '2025-05-19', archived: false },
  { id: 'ws-synergy',   name: 'SynergyWorks Inc.',      industry: 'Professional Services', site: 'synergyworks.example.com', status: 'active', budget: 18000, seed: 7, createdAt: '2025-04-07', archived: false },
  { id: 'ws-visionary', name: 'Visionary Ventures',     industry: 'Finance',       site: 'visionary.example.com',    status: 'active',    budget: 26000, seed: 8,  createdAt: '2025-03-22', archived: false },
  { id: 'ws-pinnacle',  name: 'Pinnacle Partners',      industry: 'Property',      site: 'pinnacle.example.com',     status: 'active',    budget: 15000, seed: 9,  createdAt: '2025-02-10', archived: false },
  { id: 'ws-eclipse',   name: 'Eclipse Innovations',    industry: 'Retail',        site: 'eclipse.example.com',      status: 'inactive',  budget: 12000, seed: 10, createdAt: '2024-12-01', archived: false },
  { id: 'ws-lumaforge', name: 'LumaForge Technologies', industry: 'Technology',    site: 'lumaforge.example.com',    status: 'attention', budget: 20000, seed: 11, createdAt: '2025-09-09', archived: false },
  { id: 'ws-grizzly',   name: 'Grizzly Bear Corp',      industry: 'F&B',           site: 'grizzly.example.com',      status: 'new',       budget: 10000, seed: 12, createdAt: '2026-09-28', archived: false },
  { id: 'ws-beantech',  name: 'Bean Tech Pte Ltd',      industry: 'Technology',    site: 'beantech.example.com',     status: 'new',       budget: 8000,  seed: 13, createdAt: '2026-10-02', archived: false }
];

// Organisation profile details (Organisation › Business Information). Keyed by org id ('agency' or workspace id).
const orgProfiles = {
  agency: {
    uen: '[PLACEHOLDER UEN]', size: 'SME', founded: '2006',
    address: '[PLACEHOLDER address]', postal: '000000', unit: '', building: '',
    contactName: 'Agency Admin', contactNumber: '+65 0000 0000', contactEmail: 'admin@example.com'
  }
};

// Ad accounts. workspaceId null = discovered but not yet linked (the agency queue).
// Rule (V1): max 1 Google + 1 Meta account per workspace.
const adAccounts = [
  { id: '#778-901-2244', platform: 'google', name: 'Visual Studio — Search',          workspaceId: 'ws-visual' },
  { id: 'act_98241028',  platform: 'meta',   name: 'Visual Studio — Social',          workspaceId: 'ws-visual' },
  { id: '#401-552-1180', platform: 'google', name: 'TechNova — Brand Search',         workspaceId: 'ws-technova' },
  { id: 'act_31029485',  platform: 'meta',   name: 'TechNova — Lead Gen',             workspaceId: 'ws-technova' },
  { id: 'act_55120934',  platform: 'meta',   name: 'InnoWave — Awareness',            workspaceId: 'ws-innowave' },
  { id: '#223-118-9090', platform: 'google', name: 'K-Inspired — Search',             workspaceId: 'ws-kinspired' },
  { id: 'act_77001245',  platform: 'meta',   name: 'K-Inspired — Retargeting',        workspaceId: 'ws-kinspired' },
  { id: '#610-224-7781', platform: 'google', name: 'NexGen — Performance Max',        workspaceId: 'ws-nexgen' },
  { id: '#932-004-1188', platform: 'google', name: 'BrightFuture — Enrolment Search', workspaceId: 'ws-bright' },
  { id: 'act_66129033',  platform: 'meta',   name: 'BrightFuture — Open House',       workspaceId: 'ws-bright' },
  { id: 'act_19283746',  platform: 'meta',   name: 'SynergyWorks — Lead Gen',         workspaceId: 'ws-synergy' },
  { id: '#118-760-3321', platform: 'google', name: 'Visionary — Search',              workspaceId: 'ws-visionary' },
  { id: 'act_44019283',  platform: 'meta',   name: 'Visionary — Social',              workspaceId: 'ws-visionary' },
  { id: '#771-093-4410', platform: 'google', name: 'Pinnacle — Property Search',      workspaceId: 'ws-pinnacle' },
  { id: '#505-662-9013', platform: 'google', name: 'Eclipse — Shopping',              workspaceId: 'ws-eclipse' },
  { id: '#334-871-2209', platform: 'google', name: 'LumaForge — Search',              workspaceId: 'ws-lumaforge' },
  { id: 'act_88120456',  platform: 'meta',   name: 'LumaForge — Social',              workspaceId: 'ws-lumaforge' },
  // Unlinked queue
  { id: '#998-234-1102', platform: 'google', name: 'APAC Search Brand Expansion',     workspaceId: null },
  { id: 'act_4920194820', platform: 'meta',  name: 'Meta CTWA Direct Inbound Promo',  workspaceId: null },
  { id: '#552-901-7744', platform: 'google', name: 'Regional Growth Display Ads',     workspaceId: null },
  { id: 'act_1194028591', platform: 'meta',  name: 'Seasonal Promo — Lead Ads',       workspaceId: null }
];

// Agency-level master connections (from V2).
const masterTokens = {
  google: { label: 'Google Ads Manager Account (MCC)', detail: 'Master token', status: 'valid', expires: '2027-01-15', discovered: 612 },
  meta:   { label: 'Meta Business Manager',            detail: 'System user token', status: 'valid', expires: '2026-12-01', discovered: 142 }
};

// ---------- Products / integrations catalogue ----------
// category: CRM | CCM | CDP | Marketing. provider: oom (internal OOm product) | third (external).
// flow: internal | oauth | api. CRM category obeys the "only one CRM active" rule.
const products = [
  { id: 'crm-lite',   name: 'CRM - lite',  category: 'CRM', provider: 'oom',   flow: 'internal', color: '#5B4BE0', initials: 'G',
    description: 'Track and manage leads generated through chatbot interactions.',
    dataShared: 'Customer profile, Leads, Activities',
    syncs: ['Customer information', 'Leads', 'Activities', 'Deals and closed revenue'],
    requirements: ['Galaxis workspace admin access'] },
  { id: 'aurix',      name: 'Aurix',       category: 'CCM', provider: 'oom',   flow: 'internal', color: '#5B4BE0', initials: 'A',
    description: 'Manage your chat enquiries that come in from your chatbot interactions.',
    dataShared: 'Customer profile, Leads, Activities',
    syncs: ['Chat conversations', 'Lead intent scores', 'Contact details'],
    requirements: ['Aurix subscription'] },
  { id: 'cdp',        name: 'CDP',         category: 'CDP', provider: 'oom',   flow: 'internal', color: '#5B4BE0', initials: 'C',
    description: 'Unify customer profiles and events across every connected product.',
    dataShared: 'Customer profile, Events',
    syncs: ['Customer profiles', 'Events', 'Segments'],
    requirements: ['CDP subscription'] },
  { id: 'seo-cloud',  name: 'SEO Cloud',   category: 'Marketing', provider: 'oom', flow: 'internal', color: '#2CB1B6', initials: 'S',
    description: 'Track keyword rankings, approvals and site health.',
    dataShared: 'Keywords, Rankings, Approvals',
    syncs: ['Keyword rankings', 'Content approvals'],
    requirements: ['SEO Cloud subscription'] },
  { id: 'institute-crm', name: 'Institute CRM', category: 'CRM', provider: 'oom', flow: 'internal', color: '#E4100E', initials: 'O',
    description: 'Manage learners, leads, courses, and operations in one central platform.',
    dataShared: 'Learners, Leads, Enrolments',
    syncs: ['Learner profiles', 'Leads', 'Course enrolments'],
    requirements: ['Institute CRM subscription'] },
  { id: 'salesforce', name: 'Salesforce',  category: 'CRM', provider: 'third', flow: 'oauth', color: '#00A1E0', initials: 'SF',
    description: 'Sync leads, contacts and won opportunities with your Hub.',
    dataShared: 'Leads, Contacts, Opportunities',
    syncs: ['Leads', 'Contacts', 'Accounts', 'Opportunities (closed won)'],
    requirements: ['Salesforce Admin access', 'Authorisation required'] },
  { id: 'hubspot',    name: 'HubSpot',     category: 'CRM', provider: 'third', flow: 'oauth', color: '#FF7A59', initials: 'H',
    description: 'Sync contacts, companies and customer activity with your Hub.',
    dataShared: 'Contacts, Companies, Deals',
    syncs: ['Customer information', 'Contacts', 'Companies', 'Leads', 'Customer activities'],
    requirements: ['HubSpot Admin Access', 'Authorisation required'] },
  { id: 'zoho',       name: 'Zoho CRM',    category: 'CRM', provider: 'third', flow: 'oauth', color: '#1A73E8', initials: 'Z',
    description: 'Sync leads, contacts and deals from Zoho CRM.',
    dataShared: 'Leads, Contacts, Deals',
    syncs: ['Leads', 'Contacts', 'Deals'],
    requirements: ['Zoho CRM Admin access', 'Authorisation required'] },
  { id: 'dynamics',   name: 'Microsoft Dynamic 365', category: 'CRM', provider: 'third', flow: 'oauth', color: '#002050', initials: 'MS',
    description: 'Sync leads and opportunities from Dynamics 365.',
    dataShared: 'Leads, Opportunities',
    syncs: ['Leads', 'Contacts', 'Opportunities'],
    requirements: ['Dynamics 365 Admin access', 'Authorisation required'] },
  { id: 'sleekflow',  name: 'SleekFlow',   category: 'CCM', provider: 'third', flow: 'api', color: '#1C1C59', initials: 'SF',
    description: 'Pull WhatsApp conversations and chat leads into your Hub.',
    dataShared: 'Conversations, Contacts',
    syncs: ['WhatsApp conversations', 'Contacts', 'UTM source'],
    requirements: ['SleekFlow API key', 'Premium or Enterprise plan for webhooks'] },
  { id: 'wati',       name: 'Wati',        category: 'CCM', provider: 'third', flow: 'api', color: '#25D366', initials: 'W',
    description: 'Sync WhatsApp chats and contacts with historical backfill.',
    dataShared: 'Conversations, Contacts',
    syncs: ['WhatsApp conversations', 'Contacts', 'Custom fields'],
    requirements: ['Wati API access token'] },
  { id: 'slack',      name: 'Slack',       category: 'CCM', provider: 'third', flow: 'oauth', color: '#4A154B', initials: 'S',
    description: 'Send lead and alert notifications to your Slack channels.',
    dataShared: 'Notifications',
    syncs: ['Lead notifications', 'Integration alerts'],
    requirements: ['Slack workspace admin', 'Authorisation required'] },
  { id: 'delacon',    name: 'Delacon',     category: 'CDP', provider: 'third', flow: 'api', color: '#E85D04', initials: 'D',
    description: 'Attribute inbound phone calls to the ads that drove them.',
    dataShared: 'Calls, Call sources',
    syncs: ['Call logs', 'Call duration and qualification', 'Ad source / keyword'],
    requirements: ['Delacon API token'] },
  { id: 'mailchimp',  name: 'Mailchimp',   category: 'Marketing', provider: 'third', flow: 'oauth', color: '#FFE01B', initials: 'M',
    description: 'Sync audiences and campaign engagement from Mailchimp.',
    dataShared: 'Audiences, Campaign engagement',
    syncs: ['Audiences', 'Campaign opens and clicks'],
    requirements: ['Mailchimp account owner', 'Authorisation required'] }
];

// Per-workspace product state. status: connected | pending | error | disabled. active: bool (CRM: only one active).
// Products not listed for a workspace are "available".
const workspaceProducts = {
  'ws-visual':    { 'crm-lite': { status: 'connected', active: true,  lastSynced: '2026-10-21T11:32:00' },
                    'aurix':    { status: 'connected', active: true,  lastSynced: '2026-10-21T11:32:00' },
                    'cdp':      { status: 'connected', active: true,  lastSynced: '2026-10-21T11:32:00' },
                    'institute-crm': { status: 'connected', active: false, lastSynced: '2026-10-18T09:10:00' } },
  'ws-technova':  { 'hubspot':  { status: 'connected', active: true,  lastSynced: '2026-10-21T10:05:00' },
                    'sleekflow': { status: 'error', active: true, lastSynced: '2026-10-19T08:41:00', error: 'Webhook verification failed. New messaging events are queued until the connection is fixed.' } },
  'ws-innowave':  { 'salesforce': { status: 'pending', active: false, lastSynced: null, error: 'OAuth authorisation incomplete.' } },
  'ws-kinspired': { 'aurix': { status: 'connected', active: true, lastSynced: '2026-10-21T07:00:00' },
                    'seo-cloud': { status: 'connected', active: true, lastSynced: '2026-10-20T23:00:00' } },
  'ws-nexgen':    { 'crm-lite': { status: 'connected', active: true, lastSynced: '2026-10-21T09:15:00' },
                    'delacon': { status: 'error', active: true, lastSynced: '2026-10-17T16:20:00', error: 'Webhook access token expired. Real-time call logs are queued pending token renewal.' } },
  'ws-bright':    { 'institute-crm': { status: 'connected', active: true, lastSynced: '2026-10-21T08:00:00' } },
  'ws-visionary': { 'salesforce': { status: 'connected', active: true, lastSynced: '2026-10-21T06:45:00' } }
};

// ---------- People ----------
// org: 'agency' (OOm staff) or a workspace id (client staff).
// status: active | pending | inactive | deactivated. workspaces: agency members' assigned client workspaces.
const members = [
  // Agency (OOm) members
  { id: 'm-a1', org: 'agency', name: 'Jungkook Jeon', email: 'jk@example.com',          teamId: 't-a-mgmt', roleId: 'r-a-owner',   status: 'active',  products: ['aurix', 'seo-cloud', 'crm-lite'], lastActive: '15min ago', lastProduct: 'Aurix', workspaces: ['*'] },
  { id: 'm-a2', org: 'agency', name: 'Mary Lim',      email: 'mary.lim@example.com',    teamId: 't-a-seo',  roleId: 'r-a-seolead', status: 'active',  products: ['seo-cloud'], lastActive: '2min ago', lastProduct: 'SEO Cloud', workspaces: ['ws-visual', 'ws-technova', 'ws-kinspired'] },
  { id: 'm-a3', org: 'agency', name: 'Joseph Tan',    email: 'joseph.tan@example.com',  teamId: 't-a-mkt',  roleId: 'r-a-am',      status: 'active',  products: ['aurix'], lastActive: 'Yesterday', lastProduct: 'Aurix', workspaces: ['ws-visual', 'ws-innowave'] },
  { id: 'm-a4', org: 'agency', name: 'Serah Chua',    email: 'serah.chua@example.com',  teamId: 't-a-proj', roleId: 'r-a-pl',      status: 'active',  products: ['aurix', 'seo-cloud', 'crm-lite'], lastActive: '1hr ago', lastProduct: 'CRM - lite', workspaces: ['ws-visual', 'ws-nexgen', 'ws-bright'] },
  { id: 'm-a5', org: 'agency', name: 'Melson Ng',     email: 'melson.ng@example.com',   teamId: 't-a-sales', roleId: 'r-a-am',     status: 'active',  products: ['aurix', 'seo-cloud'], lastActive: '3hr ago', lastProduct: 'SEO Cloud', workspaces: ['ws-technova'] },
  { id: 'm-a6', org: 'agency', name: 'Ada Anand',     email: 'ada.anand@example.com',   teamId: 't-a-mgmt', roleId: 'r-a-admin',   status: 'active',  products: ['aurix', 'seo-cloud'], lastActive: '10min ago', lastProduct: 'Aurix', workspaces: ['*'] },
  { id: 'm-a7', org: 'agency', name: 'Pending User',  email: 'new.analyst@example.com', teamId: 't-a-mkt',  roleId: 'r-a-analyst', status: 'pending', products: [], lastActive: null, lastProduct: null, workspaces: [] },
  { id: 'm-a8', org: 'agency', name: 'Ravi Kumar',    email: 'ravi.kumar@example.com',  teamId: 't-a-mkt',  roleId: 'r-a-viewer',  status: 'inactive', products: ['aurix'], lastActive: '12 Aug 2026', lastProduct: 'Aurix', workspaces: [] },
  // Visual Studio (client) members — mirrors the Figma Members frame, with placeholder emails
  { id: 'm-v1', org: 'ws-visual', name: 'Jon Doe',      email: 'jon.doe@example.com',      teamId: 't-v-admin', roleId: 'r-c-super',  status: 'active',   products: ['aurix', 'seo-cloud', 'crm-lite'], lastActive: '15min ago', lastProduct: 'Aurix', isPrimary: true },
  { id: 'm-v2', org: 'ws-visual', name: 'Xiao Chen',    email: 'xiao.chen@example.com',    teamId: 't-v-admin', roleId: 'r-c-admin',  status: 'active',   products: ['aurix', 'seo-cloud'], lastActive: '2min ago', lastProduct: 'SEO Cloud' },
  { id: 'm-v3', org: 'ws-visual', name: 'Aisha Tan',    email: 'aisha.tan@example.com',    teamId: 't-v-mkt',   roleId: 'r-c-hom',    status: 'active',   products: ['aurix'], lastActive: 'Yesterday', lastProduct: 'Aurix' },
  { id: 'm-v4', org: 'ws-visual', name: 'Mei Ling',     email: 'mei.ling@example.com',     teamId: 't-v-mkt',   roleId: 'r-c-mexec',  status: 'active',   products: ['aurix'], lastActive: '2hr ago', lastProduct: 'Aurix' },
  { id: 'm-v5', org: 'ws-visual', name: 'Jin Wei',      email: 'jin.wei@example.com',      teamId: 't-v-seo',   roleId: 'r-c-hor',    status: 'active',   products: ['seo-cloud'], lastActive: '9min ago', lastProduct: 'SEO Cloud' },
  { id: 'm-v6', org: 'ws-visual', name: 'Brandon Lim',  email: 'brandon.lim@example.com',  teamId: 't-v-dhat',  roleId: 'r-c-exec',   status: 'pending',  products: ['seo-cloud'], lastActive: null, lastProduct: null },
  { id: 'm-v7', org: 'ws-visual', name: 'Hafiz Rahman', email: 'hafiz.rahman@example.com', teamId: 't-v-bp',    roleId: 'r-c-exec',   status: 'inactive', products: ['seo-cloud'], lastActive: '7days ago', lastProduct: 'SEO Cloud' },
  { id: 'm-v8', org: 'ws-visual', name: 'Fatimah Noor', email: 'fatimah.noor@example.com', teamId: 't-v-dhat',  roleId: 'r-c-sales',  status: 'active',   products: ['aurix'], lastActive: '12min ago', lastProduct: 'Aurix' },
  { id: 'm-v9', org: 'ws-visual', name: 'Kumar Singh',  email: 'kumar.singh@example.com',  teamId: 't-v-bp',    roleId: 'r-c-sales',  status: 'inactive', products: ['aurix'], lastActive: '12 Aug 2026', lastProduct: 'Aurix' },
  // A few other clients so per-workspace lists differ
  { id: 'm-t1', org: 'ws-technova', name: 'Sarah Jenkins', email: 'sarah.j@example.com', teamId: null, roleId: 'r-c-super', status: 'active', products: ['crm-lite'], lastActive: '1hr ago', lastProduct: 'CRM - lite', isPrimary: true },
  { id: 'm-t2', org: 'ws-technova', name: 'David Lim',     email: 'david.lim@example.com', teamId: null, roleId: 'r-c-exec', status: 'active', products: [], lastActive: 'Yesterday', lastProduct: null },
  { id: 'm-i1', org: 'ws-innowave', name: 'Priya Nair',    email: 'priya.nair@example.com', teamId: null, roleId: 'r-c-super', status: 'active', products: [], lastActive: '3 days ago', lastProduct: null, isPrimary: true }
];

// Teams. org as above.
const teams = [
  { id: 't-a-mgmt',  org: 'agency', name: 'Management', status: 'active', products: ['aurix', 'seo-cloud', 'crm-lite'], createdAt: '2026-01-02' },
  { id: 't-a-seo',   org: 'agency', name: 'SEO Research', status: 'active', products: ['seo-cloud'], createdAt: '2026-01-02' },
  { id: 't-a-mkt',   org: 'agency', name: 'Marketing', status: 'active', products: ['aurix'], createdAt: '2026-01-02' },
  { id: 't-a-proj',  org: 'agency', name: 'Project', status: 'active', products: ['aurix', 'seo-cloud', 'crm-lite'], createdAt: '2026-02-14' },
  { id: 't-a-sales', org: 'agency', name: 'Sales', status: 'active', products: ['aurix', 'seo-cloud'], createdAt: '2026-03-01' },
  { id: 't-v-admin', org: 'ws-visual', name: 'Admin', status: 'active', products: ['aurix', 'seo-cloud', 'crm-lite'], createdAt: '2026-01-02' },
  { id: 't-v-mkt',   org: 'ws-visual', name: 'Marketing', status: 'active', products: ['aurix'], createdAt: '2026-01-02' },
  { id: 't-v-seo',   org: 'ws-visual', name: 'SEO', status: 'active', products: ['seo-cloud'], createdAt: '2026-01-02' },
  { id: 't-v-dhat',  org: 'ws-visual', name: 'DHAT', status: 'active', products: ['aurix', 'seo-cloud'], createdAt: '2026-01-02' },
  { id: 't-v-bp',    org: 'ws-visual', name: 'BP', status: 'inactive', products: ['aurix', 'seo-cloud'], createdAt: '2026-01-02' }
];

// Roles. locked = system role (view only). perms = permission ids from permissionCatalogue (team-access.js).
// '*' means every permission. Client roles use org 'client' and are shared by all client workspaces.
const roles = [
  { id: 'r-a-owner',   org: 'agency', name: 'Owner',            description: 'Full agency access', locked: true,  perms: ['*'], createdAt: '2026-01-02' },
  { id: 'r-a-admin',   org: 'agency', name: 'Agency Admin',     description: 'Full access across all client workspaces', locked: true, perms: ['*'], createdAt: '2026-01-02' },
  { id: 'r-a-am',      org: 'agency', name: 'Account Manager',  description: 'Manage assigned clients and ad accounts', locked: false, perms: [], createdAt: '2026-01-02' },
  { id: 'r-a-seolead', org: 'agency', name: 'SEO Lead',         description: 'Manage SEO delivery', locked: false, perms: [], createdAt: '2026-02-10' },
  { id: 'r-a-pl',      org: 'agency', name: 'Project Lead',     description: 'Manage project delivery', locked: false, perms: [], createdAt: '2026-02-14' },
  { id: 'r-a-analyst', org: 'agency', name: 'Data Analyst',     description: 'View analytics and manage clients', locked: false, perms: [], createdAt: '2026-03-01' },
  { id: 'r-a-viewer',  org: 'agency', name: 'Viewer',           description: 'View only', locked: false, perms: [], createdAt: '2026-01-02' },
  { id: 'r-c-super',   org: 'client', name: 'Super Admin',          description: 'Full organisation access', locked: true, perms: ['*'], createdAt: '2026-01-02' },
  { id: 'r-c-admin',   org: 'client', name: 'Admin',                description: 'Full access on product', locked: false, perms: [], createdAt: '2026-01-02' },
  { id: 'r-c-hom',     org: 'client', name: 'Head of Marketing',    description: 'Manage marketing activities', locked: false, perms: [], createdAt: '2026-01-02' },
  { id: 'r-c-mexec',   org: 'client', name: 'Marketing Executive',  description: 'Manage day-to-day marketing', locked: false, perms: [], createdAt: '2026-01-02' },
  { id: 'r-c-hor',     org: 'client', name: 'Head of Research',     description: 'Manage performance activities', locked: false, perms: [], createdAt: '2026-01-02' },
  { id: 'r-c-exec',    org: 'client', name: 'Executive',            description: 'Manage day-to-day performance', locked: false, perms: [], createdAt: '2026-01-02' },
  { id: 'r-c-sales',   org: 'client', name: 'Sales',                description: 'Manage sales activities', locked: false, perms: [], createdAt: '2026-01-02' },
  { id: 'r-c-employee', org: 'client', name: 'Employee',            description: 'Base access to products', locked: false, perms: [], createdAt: '2026-01-02' }
];

// ---------- Deterministic random ----------
function seededRandom(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
