/**
 * CRM ERP — digital service prototype (Selfcare, Celebration, Loyalty, Communications,
 * cases, escalation, SLA). Factory demo: 10 customers × 5 branches; persisted in localStorage (crm_erp_proto_v8).
 */

const STORAGE_KEY = "crm_erp_proto_v8";
const SIDEBAR_KEY = "crm_sidebar_collapsed";
const AUTH_SESSION_KEY = "crm_auth_user_id";

/** Prototype login accounts (demo only — not secure for production). */
const APP_LOGIN_USERS = [
  {
    id: "u_agent",
    username: "ada",
    password: "ada123",
    name: "Ada Okonkwo",
    role: "case_agent",
    teamId: "team_net",
    departmentId: "dept_ops",
  },
  {
    id: "u_agent2",
    username: "bola",
    password: "bola123",
    name: "Bola Mensah",
    role: "case_agent",
    teamId: "team_net",
    departmentId: "dept_ops",
  },
  {
    id: "u_supervisor",
    username: "supervisor",
    password: "super123",
    name: "Chidi Okafor",
    role: "supervisor",
    teamId: "team_net",
    departmentId: "dept_ops",
    supervises: ["u_agent", "u_agent2"],
  },
  {
    id: "u_hcce",
    username: "hcce",
    password: "hcce123",
    name: "HCCE Desk",
    role: "hcce_coordinator",
    teamId: "team_net",
    departmentId: "dept_ops",
    email: "HCCE@vdtcomms.com",
  },
];

function loginUserByUsername(username) {
  const u = (username || "").trim().toLowerCase();
  return APP_LOGIN_USERS.find((x) => x.username === u) || null;
}

function getLoggedInUser() {
  const id = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!id) return null;
  return APP_LOGIN_USERS.find((x) => x.id === id) || null;
}

function setLoggedInUser(userId) {
  if (userId) sessionStorage.setItem(AUTH_SESSION_KEY, userId);
  else sessionStorage.removeItem(AUTH_SESSION_KEY);
}

function syncAuthToState() {
  const u = getLoggedInUser();
  if (!u) return;
  state.currentUserId = u.id;
  state.currentUserTeamId = u.teamId;
  state.currentUserDeptId = u.departmentId;
  if (u.role === "case_agent") state.reportFilterUserId = u.id;
}

function applyCaseCreatorToRow(row, userId) {
  const id = userId || state.currentUserId;
  const login = APP_LOGIN_USERS.find((x) => x.id === id);
  const ag = agentById(id);
  row.createdByUserId = id;
  row.createdByName = login?.name || ag?.name || assigneeDisplayName(id);
}

function caseCreatorDisplay(c) {
  if (c.createdByName) return c.createdByName;
  if (c.source === "selfcare") return "Selfcare portal";
  const ag = agentById(c.createdByUserId);
  return ag?.name || "—";
}

/** Only the agent who created (or was assigned ownership of) the case may set resolution to Close. */
function canUserCloseCase(c, userId) {
  const uid = userId || getLoggedInUser()?.id || state.currentUserId;
  if (!uid || !c?.createdByUserId) return false;
  return c.createdByUserId === uid;
}

function ensureCaseClosureOwner(c) {
  if (c.source === "selfcare" && !c.createdByUserId && c.assignedUserId) {
    applyCaseCreatorToRow(c, c.assignedUserId);
    return true;
  }
  return false;
}

function resolutionStatusSelectHtml(c) {
  const auth = getLoggedInUser();
  const mayClose = canUserCloseCase(c, auth?.id);
  const isClosed = c.resolutionStatus === "Close";
  return RESOLUTION_STATUSES.map((r) => {
    const selected = c.resolutionStatus === r ? "selected" : "";
    if (r === "Close" && !mayClose && !isClosed) {
      const owner = c.createdByUserId ? caseCreatorDisplay(c) : "the assigned agent";
      return `<option value="${escapeHtml(r)}" disabled>Close — ${escapeHtml(owner)} only</option>`;
    }
    return `<option value="${escapeHtml(r)}" ${selected}>${escapeHtml(r)}</option>`;
  }).join("");
}

function caseCloseRestrictionHint(c) {
  const auth = getLoggedInUser();
  if (canUserCloseCase(c, auth?.id)) {
    if (c.resolutionStatus === "Close") return `<p class="muted" style="margin:0.35rem 0 0;font-size:0.82rem">You created this case — you may reopen or keep it closed.</p>`;
    return `<p class="muted" style="margin:0.35rem 0 0;font-size:0.82rem">Only you (<strong>${escapeHtml(caseCreatorDisplay(c))}</strong>) can close this case.</p>`;
  }
  if (!c.createdByUserId && c.source === "selfcare") {
    return `<p class="muted" style="margin:0.35rem 0 0;font-size:0.82rem">Assign an agent first — only that agent can close this Selfcare case.</p>`;
  }
  return `<p class="muted" style="margin:0.35rem 0 0;font-size:0.82rem">Only <strong>${escapeHtml(caseCreatorDisplay(c))}</strong> can close this case.</p>`;
}

const ROLES = [
  { id: "agent", label: "Agent — review all cases" },
  { id: "team_lead", label: "Team Lead — team cases" },
  { id: "hod", label: "HOD — department" },
  { id: "executive", label: "Executive — organization-wide" },
];

/** Configuration routes nested under Settings on the main menu. */
const SETTINGS_NAV_CHILDREN = [
  { id: "case_group", label: "Case group" },
  { id: "case_type", label: "Case type" },
  { id: "priority_config", label: "Impact & urgency" },
  { id: "escalation", label: "Escalation configuration" },
  { id: "escalation_groups", label: "Escalation groups" },
  { id: "sla", label: "Resolution SLA" },
  { id: "architecture", label: "Architecture" },
];

const SETTINGS_NAV_IDS = new Set(SETTINGS_NAV_CHILDREN.map((c) => c.id));

/** Communications submenu routes. */
const COMMUNICATIONS_NAV_CHILDREN = [
  { id: "communications", label: "Timeline" },
  { id: "customer_email", label: "Customer email" },
];

const COMMUNICATIONS_NAV_IDS = new Set(COMMUNICATIONS_NAV_CHILDREN.map((c) => c.id));

const NAV_GROUP_CONFIG = {
  settings: { openStateKey: "settingsNavOpen", routeIds: SETTINGS_NAV_IDS },
  communications_group: { openStateKey: "communicationsNavOpen", routeIds: COMMUNICATIONS_NAV_IDS },
};

/** Agent new-case form (opened from Cases list, not in submenu). */
const CASE_NEW_ROUTE = "new_case";

const CASES_NAV_IDS = new Set(["cases", CASE_NEW_ROUTE]);

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "reports", label: "Reports" },
  { id: "selfcare", label: "Selfcare" },
  { id: "celebration", label: "Celebration" },
  { id: "loyalty", label: "Loyalty" },
  {
    id: "communications_group",
    label: "Communications",
    children: COMMUNICATIONS_NAV_CHILDREN,
  },
  { id: "cases", label: "Cases" },
  { id: "settings", label: "Settings", icon: "⚙", children: SETTINGS_NAV_CHILDREN },
];

function allNavRouteIds() {
  const ids = [];
  for (const n of NAV) {
    if (n.children) ids.push(n.id, ...n.children.map((c) => c.id));
    else ids.push(n.id);
  }
  return ids;
}

function navPageTitle(route) {
  if (route === "dashboard") return "Case management";
  if (route === "reports") return "Reports";
  if (route === "cases") return "Cases";
  if (route === CASE_NEW_ROUTE) return "Cases · New case";
  const commsChild = COMMUNICATIONS_NAV_CHILDREN.find((c) => c.id === route);
  if (commsChild) return `Communications · ${commsChild.label}`;
  const settingsChild = SETTINGS_NAV_CHILDREN.find((c) => c.id === route);
  if (settingsChild) return `Settings · ${settingsChild.label}`;
  const top = NAV.find((n) => n.id === route);
  return top?.label || "Dashboard";
}

function navGroupIsOpen(groupId, routeActive) {
  const cfg = NAV_GROUP_CONFIG[groupId];
  if (!cfg) return false;
  const openFlag = state[cfg.openStateKey];
  return openFlag !== false && (openFlag === true || cfg.routeIds.has(routeActive));
}

function toggleNavGroup(groupId, routeActive) {
  const cfg = NAV_GROUP_CONFIG[groupId];
  if (!cfg) return;
  state[cfg.openStateKey] = !navGroupIsOpen(groupId, routeActive);
}

function navItemLabelHtml(item) {
  if (item.icon) {
    return `<span class="nav-item-inner"><span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${escapeHtml(item.label)}</span></span>`;
  }
  return escapeHtml(item.label);
}

function settingsNavIsOpen(routeActive) {
  return navGroupIsOpen("settings", routeActive);
}

function communicationsNavIsOpen(routeActive) {
  return navGroupIsOpen("communications_group", routeActive);
}

const RESOLUTION_STATUSES = ["Open", "Close", "Reopen", "unresolved", "Escalated", "Awaiting info/Paused"];

/** Functional escalation ladder — one team per level (L1 creates the case). */
const FUNCTIONAL_ESCALATION_LEVELS = [
  {
    id: "resolution",
    step: "Resolution",
    order: 0,
    label: "Level 1",
    team: "Resolution Team",
    groupId: "grp_resolution",
    blurb: "Creates and owns new cases",
  },
  {
    id: "delegation",
    step: "Delegation",
    order: 1,
    label: "Level 2",
    team: "Delegation Team",
    groupId: "grp_delegation",
    blurb: "Delegates work across internal queues",
  },
  {
    id: "consultation",
    step: "Consultation",
    order: 2,
    label: "Level 3",
    team: "Consultation Team",
    groupId: "grp_consultation",
    blurb: "Specialist consultation and advisory",
  },
  {
    id: "external",
    step: "External",
    order: 3,
    label: "Level 4",
    team: "External",
    groupId: "grp_external",
    blurb: "Vendor / partner engagement",
  },
];

const DEFAULT_FUNC_LEVEL_PICKUP_MINS = 5;
const DEFAULT_FUNC_LEVEL_RESOLUTION_MINS = 25;

/** Hierarchical roles on the case ladder (Agent is entry; no notify group). */
const ESCALATION_HIERARCHICAL_LEVELS = ["Agent", "Team Lead", "HOD", "Director", "GMD"];

/** Leadership tiers that receive hierarchical escalation notifications (after Agent). */
const HIERARCHICAL_ESCALATION_ROLES = ["Team Lead", "HOD", "Director", "GMD"];

const HIERARCHICAL_ESCALATION_GROUP_DEFS = [
  { id: "eng_hier_team_lead", role: "Team Lead", label: "Team Lead escalation", email: "teamlead@vdtcomms.com" },
  { id: "eng_hier_hod", role: "HOD", label: "HOD escalation", email: "hod@vdtcomms.com" },
  { id: "eng_hier_director", role: "Director", label: "Director escalation", email: "director@vdtcomms.com" },
  { id: "eng_hier_gmd", role: "GMD", label: "GMD escalation", email: "gmd@vdtcomms.com" },
];

const ESCALATION_GROUPS_VERSION = 2;

function hierarchicalEscalationGroupDef(roleOrId) {
  return HIERARCHICAL_ESCALATION_GROUP_DEFS.find((d) => d.role === roleOrId || d.id === roleOrId) || null;
}

function isHierarchicalEscalationGroup(group) {
  if (!group) return false;
  if (group.hierarchicalRole && HIERARCHICAL_ESCALATION_ROLES.includes(group.hierarchicalRole)) return true;
  return HIERARCHICAL_ESCALATION_GROUP_DEFS.some((d) => d.id === group.id);
}

function hierarchicalEscalationGroupIdForRole(role) {
  return hierarchicalEscalationGroupDef(role)?.id || null;
}

function buildHierarchicalEscalationGroup(def, emailsOverride) {
  const emails = emailsOverride?.length
    ? [...new Set(emailsOverride.map((e) => String(e || "").trim()).filter(Boolean))]
    : def.email
      ? [def.email]
      : [];
  return {
    id: def.id,
    label: def.label,
    hierarchicalRole: def.role,
    emails,
    createdAt: new Date().toISOString(),
  };
}

function ensureHierarchicalEscalationGroups(groups, legacyEmails) {
  const list = Array.isArray(groups) ? [...groups] : [];
  const withoutLegacy = list.filter((g) => g.id !== "eng_hier_leadership");
  const legacy = list.find((g) => g.id === "eng_hier_leadership");
  const legacyPool = [
    ...(legacy?.emails || []),
    ...(legacyEmails || []),
    ...(legacy?.emails?.length ? [] : []),
  ].filter(Boolean);

  for (const def of HIERARCHICAL_ESCALATION_GROUP_DEFS) {
    const idx = withoutLegacy.findIndex((g) => g.id === def.id || g.hierarchicalRole === def.role);
    if (idx >= 0) {
      const cur = withoutLegacy[idx];
      withoutLegacy[idx] = {
        ...cur,
        id: def.id,
        label: cur.label || def.label,
        hierarchicalRole: def.role,
        emails: [...new Set((cur.emails || []).map((e) => String(e || "").trim()).filter(Boolean))],
      };
      continue;
    }
    const seedEmails = def.role === "Team Lead" && legacyPool.length ? legacyPool.slice(0, 2) : def.email ? [def.email] : [];
    withoutLegacy.push(buildHierarchicalEscalationGroup(def, seedEmails));
  }
  return withoutLegacy;
}

function functionalLevelAssignmentLabel(level) {
  if (level.id === "delegation") return "Escalation (Delegation)";
  return level.step;
}

let _escalationAutoTimer = null;
let _globalPickupTimer = null;

const COMM_CHANNELS = [
  "Email",
  "Chat",
  "Virtual meeting",
  "Call",
  "SMS / Text",
  "WhatsApp",
  "Social",
];

const LOYALTY_TABS = [
  { id: "standards", label: "Standards" },
  { id: "schemes", label: "Schemes" },
  { id: "beneficiaries", label: "Beneficiaries" },
  { id: "awards", label: "Awards" },
];

/** Priority labels — derived from Impact × Urgency matrix (Settings → Impact & urgency). */
const SELFCARE_PRIORITIES = ["P1-Critical", "P2-High", "P3-Medium", "P4-Low", "P5-Planning/Request"];
const DEFAULT_CASE_PRIORITY = "P3-Medium";
const IMPACT_LEVELS = ["High", "Medium", "Low"];
const URGENCY_LEVELS = ["High", "Medium", "Low"];
const DEFAULT_IMPACT = "Medium";
const DEFAULT_URGENCY = "Medium";

function defaultPriorityMatrix() {
  return {
    High: { High: "P1-Critical", Medium: "P2-High", Low: "P3-Medium" },
    Medium: { High: "P2-High", Medium: "P3-Medium", Low: "P4-Low" },
    Low: { High: "P3-Medium", Medium: "P4-Low", Low: "P5-Planning/Request" },
  };
}

function normalizePriorityMatrix(matrix) {
  const def = defaultPriorityMatrix();
  const out = {};
  for (const impact of IMPACT_LEVELS) {
    out[impact] = {};
    for (const urgency of URGENCY_LEVELS) {
      const v = matrix?.[impact]?.[urgency];
      out[impact][urgency] = SELFCARE_PRIORITIES.includes(v) ? v : def[impact][urgency];
    }
  }
  return out;
}

function priorityFromImpactUrgency(impact, urgency, matrix) {
  const m = normalizePriorityMatrix(matrix || state.priorityMatrix);
  const i = IMPACT_LEVELS.includes(impact) ? impact : DEFAULT_IMPACT;
  const u = URGENCY_LEVELS.includes(urgency) ? urgency : DEFAULT_URGENCY;
  return m[i][u];
}

function priorityToDefaultImpactUrgency(priority) {
  const map = {
    "P1-Critical": ["High", "High"],
    "P2-High": ["High", "Medium"],
    "P3-Medium": ["Medium", "Medium"],
    "P4-Low": ["Low", "Medium"],
    "P5-Planning/Request": ["Low", "Low"],
  };
  const pair = map[priority] || [DEFAULT_IMPACT, DEFAULT_URGENCY];
  return { impact: pair[0], urgency: pair[1] };
}

/** Agent new-case category (stored on `case.type`). */
const CASE_CATEGORIES = ["Incident", "Request", "Enquiry", "Feedback"];

/** Selfcare portal: public support inbox (mailto + case footers). */
const SELFCARE_SUPPORT_EMAIL = "info@vdtcomms.com";

/** HCCE desk — receives Selfcare case IDs for agent assignment. */
const HCCE_ASSIGNMENT_EMAIL = "HCCE@vdtcomms.com";

/** Source of contact id applied to every Selfcare-submitted case. */
const SELFCARE_CONTACT_SOURCE_ID = "cis_selfcare";

/** Bump when default case group / type catalog changes (Settings → Case group / Case type). */
const CASE_CATALOG_VERSION = 3;

function catalogCaseType(id, label, impact, urgency, slaOverrides = {}) {
  return {
    id,
    label,
    impact: IMPACT_LEVELS.includes(impact) ? impact : DEFAULT_IMPACT,
    urgency: URGENCY_LEVELS.includes(urgency) ? urgency : DEFAULT_URGENCY,
    sla: defaultCaseTypeSla(slaOverrides),
  };
}

function defaultCatalogCaseType(label = "New case type", overrides = {}) {
  const iu = overrides.impact && overrides.urgency
    ? { impact: overrides.impact, urgency: overrides.urgency }
    : priorityToDefaultImpactUrgency(overrides.priority || DEFAULT_CASE_PRIORITY);
  return catalogCaseType(`ct_${uid().slice(3)}`, label, iu.impact, iu.urgency, overrides.sla || {});
}

function defaultCaseGroupCatalog() {
  return [
    {
      id: "cg_link_down",
      label: "Link down",
      escalationKey: "Enterprise",
      caseTypes: [
        catalogCaseType("ct_equipment_damage", "Equipment damage", "High", "Medium", { durationHours: 48, overdueOffsetHours: 12 }),
        catalogCaseType("ct_power_issue", "Power Issue", "High", "High", { durationHours: 8, overdueOffsetHours: 4 }),
        catalogCaseType("ct_link_down", "Link down", "High", "High", { durationHours: 24, overdueOffsetHours: 8 }),
        catalogCaseType("ct_trunk_down", "Trunk down", "High", "High", { durationHours: 24, overdueOffsetHours: 8 }),
      ],
    },
    {
      id: "cg_payment",
      label: "Payment",
      escalationKey: "Billing",
      caseTypes: [
        catalogCaseType("ct_bank_issue", "Bank Issue", "High", "Medium", { durationHours: 24, overdueOffsetHours: 8 }),
        catalogCaseType("ct_failed_transaction", "Failed Transaction", "High", "High", { durationHours: 12, overdueOffsetHours: 4 }),
        catalogCaseType("ct_delay_acknowledgement", "Delay acknowledgement", "Medium", "Medium", { durationHours: 48, overdueOffsetHours: 12 }),
      ],
    },
    {
      id: "cg_pop_down",
      label: "POP down",
      escalationKey: "Enterprise",
      caseTypes: [
        catalogCaseType("ct_power_customer_end", "Power Issue at Customer end", "P2-High", { durationHours: 12, overdueOffsetHours: 4 }),
        catalogCaseType("ct_pop_power", "POP down due to Power", "P1-Critical", { durationHours: 8, overdueOffsetHours: 4 }),
        catalogCaseType("ct_router_failure", "Router Failure", "P1-Critical", { durationHours: 16, overdueOffsetHours: 6 }),
        catalogCaseType("ct_trunk_outage", "Trunk Outage", "P1-Critical", { durationHours: 24, overdueOffsetHours: 8 }),
      ],
    },
    {
      id: "cg_customer_related",
      label: "Customer related issue",
      escalationKey: "Retail",
      caseTypes: [
        catalogCaseType("ct_power_at_site", "Power Issue at Site", "Medium", "Medium", { durationHours: 24, overdueOffsetHours: 8 }),
        catalogCaseType("ct_branch_not_open", "Branch yet to Open", "Low", "Medium", { durationHours: 72, overdueOffsetHours: 24 }),
        catalogCaseType("ct_lan_issue", "LAN issue", "High", "Medium", { durationHours: 24, overdueOffsetHours: 8 }),
        catalogCaseType("ct_bad_cable", "Bad Cable", "Medium", "Medium", { durationHours: 36, overdueOffsetHours: 12 }),
      ],
    },
  ].map((g) => {
    normalizeCaseGroupDef(g);
    return g;
  });
}

function applyFreshCaseCatalog(parsed) {
  parsed.caseGroupCatalog = defaultCaseGroupCatalog();
  parsed.caseCatalogVersion = CASE_CATALOG_VERSION;
  if (!catalogGroupById(parsed.selfcareCaseGroupId, parsed.caseGroupCatalog)) {
    parsed.selfcareCaseGroupId = "cg_link_down";
  }
  if (!catalogTypeById(parsed.selfcareCaseGroupId, parsed.selfcareCaseTypeId, parsed.caseGroupCatalog)) {
    parsed.selfcareCaseTypeId = "ct_power_issue";
  }
}

function defaultCaseTypeSla(overrides = {}) {
  return { durationHours: 24, overdueOffsetHours: 8, ...overrides };
}

function normalizeCaseTypeSla(typeDef) {
  if (!typeDef.sla || typeof typeDef.sla !== "object") typeDef.sla = defaultCaseTypeSla();
  const s = typeDef.sla;
  if (!Number.isFinite(Number(s.durationHours)) || Number(s.durationHours) <= 0) s.durationHours = 24;
  if (!Number.isFinite(Number(s.overdueOffsetHours)) || Number(s.overdueOffsetHours) < 0) s.overdueOffsetHours = 8;
  s.durationHours = Math.round(Number(s.durationHours));
  s.overdueOffsetHours = Math.round(Number(s.overdueOffsetHours));
  return typeDef;
}

function cloneCaseTypeDef(t) {
  const base = normalizeCaseTypeDef({ ...t, sla: { ...(t.sla || {}) } });
  return { id: base.id, label: base.label, impact: base.impact, urgency: base.urgency, sla: { ...base.sla } };
}

function impactSelectHtml(selected, extraAttrs = "") {
  const cur = IMPACT_LEVELS.includes(selected) ? selected : DEFAULT_IMPACT;
  return IMPACT_LEVELS.map(
    (v) => `<option value="${escapeHtml(v)}" ${v === cur ? "selected" : ""} ${extraAttrs}>${escapeHtml(v)}</option>`
  ).join("");
}

function urgencySelectHtml(selected, extraAttrs = "") {
  const cur = URGENCY_LEVELS.includes(selected) ? selected : DEFAULT_URGENCY;
  return URGENCY_LEVELS.map(
    (v) => `<option value="${escapeHtml(v)}" ${v === cur ? "selected" : ""} ${extraAttrs}>${escapeHtml(v)}</option>`
  ).join("");
}

function normalizeCaseTypeDef(typeDef) {
  normalizeCaseTypeSla(typeDef);
  if (!typeDef.impact || !IMPACT_LEVELS.includes(typeDef.impact)) {
    if (typeDef.priority && SELFCARE_PRIORITIES.includes(typeDef.priority)) {
      const iu = priorityToDefaultImpactUrgency(typeDef.priority);
      typeDef.impact = iu.impact;
      typeDef.urgency = iu.urgency;
    } else {
      typeDef.impact = DEFAULT_IMPACT;
    }
  }
  if (!typeDef.urgency || !URGENCY_LEVELS.includes(typeDef.urgency)) {
    typeDef.urgency = DEFAULT_URGENCY;
  }
  if ("priority" in typeDef) delete typeDef.priority;
  return typeDef;
}

function normalizeCaseGroupDef(group) {
  if ("defaultPriority" in group) delete group.defaultPriority;
  for (const t of group.caseTypes || []) normalizeCaseTypeDef(t);
  return group;
}

function caseTypeImpactUrgency(caseType) {
  const t = normalizeCaseTypeDef({ ...caseType });
  return { impact: t.impact, urgency: t.urgency };
}

function caseTypePriority(caseType) {
  const { impact, urgency } = caseTypeImpactUrgency(caseType);
  return priorityFromImpactUrgency(impact, urgency);
}

function caseTypePolicySummary(caseType) {
  const { impact, urgency } = caseTypeImpactUrgency(caseType);
  const pri = priorityFromImpactUrgency(impact, urgency);
  return `${slaPolicySummary(caseType)} · ${impact}/${urgency} → ${pri}`;
}

function slaPolicySummary(caseType) {
  const t = normalizeCaseTypeSla({ ...caseType, sla: { ...(caseType?.sla || {}) } });
  return `${t.sla.durationHours}h due · +${t.sla.overdueOffsetHours}h overdue`;
}

/** Snapshots governance SLA, impact/urgency, and derived priority from the selected case type onto the case row. */
function applyCaseTypeSlaToCase(row, caseType) {
  const t = normalizeCaseTypeDef({ ...caseType, sla: { ...(caseType?.sla || {}) } });
  const prev = row.globalSla || {};
  row.globalSla = {
    durationHours: t.sla.durationHours,
    overdueOffsetHours: t.sla.overdueOffsetHours,
    pauseHours: typeof prev.pauseHours === "number" ? prev.pauseHours : 0,
    pausedReason: prev.pausedReason ?? null,
    simulatedElapsedHours: typeof prev.simulatedElapsedHours === "number" ? prev.simulatedElapsedHours : 0,
  };
  row.slaPolicyLabel = t.label;
  row.slaPolicyTypeId = t.id;
  row.impact = t.impact;
  row.urgency = t.urgency;
  row.priority = priorityFromImpactUrgency(t.impact, t.urgency);
}

function catalogGroupById(groupId, catalog) {
  const list = catalog || state.caseGroupCatalog || [];
  return list.find((g) => g.id === groupId);
}

function catalogTypeById(groupId, typeId, catalog) {
  const g = catalogGroupById(groupId, catalog);
  if (!g?.caseTypes?.length) return null;
  return g.caseTypes.find((t) => t.id === typeId) || g.caseTypes[0];
}

function caseCatalogSummary(c) {
  if (c.caseGroupLabel && c.caseTypeLabel) return `${c.caseGroupLabel} · ${c.caseTypeLabel}`;
  const g = catalogGroupById(c.caseGroupId);
  const t = catalogTypeById(c.caseGroupId, c.caseTypeId);
  if (g && t) return `${g.label} · ${t.label}`;
  return c.caseGroupLabel || c.caseTypeLabel || "—";
}

function caseGroupSelectHtml(selectedGroupId, catalog) {
  const list = catalog || state.caseGroupCatalog || [];
  return list.map((g) => `<option value="${escapeHtml(g.id)}" ${g.id === selectedGroupId ? "selected" : ""}>${escapeHtml(g.label)}</option>`).join("");
}

function caseTypeSelectHtml(groupId, selectedTypeId, catalog) {
  const g = catalogGroupById(groupId, catalog);
  if (!g) return "";
  return g.caseTypes.map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === selectedTypeId ? "selected" : ""}>${escapeHtml(t.label)}</option>`).join("");
}

/** Snapshots catalog labels on the case and applies escalation ladder from the group's template key. */
function attachCaseCatalogToRow(row, groupId, typeId, catalog, escalationByGroup) {
  const list = catalog || state.caseGroupCatalog || [];
  const cg = catalogGroupById(groupId, list) || list[0];
  if (!cg) return;
  const ct = catalogTypeById(cg.id, typeId, list) || cg.caseTypes[0];
  row.caseGroupId = cg.id;
  row.caseTypeId = ct.id;
  row.caseGroupLabel = cg.label;
  row.caseTypeLabel = ct.label;
  applyEscalationSnapshotToCase(row, cg.escalationKey || "Enterprise", escalationByGroup || state.escalationByGroup);
  applyCaseTypeSlaToCase(row, ct);
}

const uid = () => `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const CASE_ID_PREFIX = "CRM";

function parseCaseIdSequence(caseId) {
  const m = String(caseId || "").match(new RegExp(`^${CASE_ID_PREFIX}-(\\d+)$`));
  return m ? parseInt(m[1], 10) : 0;
}

function formatCaseDisplayId(seq) {
  return `${CASE_ID_PREFIX}-${String(seq).padStart(5, "0")}`;
}

function assignMissingCaseIds(parsed) {
  let seq = Number(parsed.caseIdSequence) || 0;
  for (const c of parsed.cases || []) {
    if (c.caseId) seq = Math.max(seq, parseCaseIdSequence(c.caseId));
  }
  for (const c of parsed.cases || []) {
    if (!c.caseId) {
      seq += 1;
      c.caseId = formatCaseDisplayId(seq);
    }
  }
  parsed.caseIdSequence = seq;
  return parsed;
}

function nextCaseDisplayId() {
  let seq = state.caseIdSequence || 0;
  for (const c of state.cases || []) {
    seq = Math.max(seq, parseCaseIdSequence(c.caseId));
  }
  seq += 1;
  state.caseIdSequence = seq;
  return formatCaseDisplayId(seq);
}

function caseDisplayId(c) {
  return c?.caseId || "—";
}

function defaultAgents() {
  return [
    { id: "u_agent", name: "Ada Okonkwo", title: "Network Agent", teamId: "team_net", departmentId: "dept_ops" },
    { id: "u_agent2", name: "Bola Mensah", title: "Service Agent", teamId: "team_net", departmentId: "dept_ops" },
    { id: "u_supervisor", name: "Chidi Okafor", title: "Supervisor", teamId: "team_net", departmentId: "dept_ops" },
    { id: "u_lead", name: "Chidi Okafor", title: "Team Lead", teamId: "team_net", departmentId: "dept_ops" },
    { id: "u_hod", name: "Dera Adeyemi", title: "HOD Operations", teamId: "team_net", departmentId: "dept_ops" },
  ];
}

/** Configurable “source of contact” options for case creation dropdowns. */
function defaultCaseInformationSources() {
  return [
    { id: SELFCARE_CONTACT_SOURCE_ID, label: "Selfcare", active: true },
    { id: "cis_email", label: "Email", active: true },
    { id: "cis_chat", label: "Chat", active: true },
    { id: "cis_whatsapp", label: "WhatsApp", active: true },
    { id: "cis_phone", label: "Phone call", active: true },
    { id: "cis_virtual_meeting", label: "Virtual meeting", active: true },
    { id: "cis_sms", label: "SMS / Text", active: true },
    { id: "cis_social", label: "Social", active: true },
  ];
}

function ensureSelfcareContactSource(list) {
  if (!list.some((s) => s.id === SELFCARE_CONTACT_SOURCE_ID)) {
    list.unshift({ id: SELFCARE_CONTACT_SOURCE_ID, label: "Selfcare", active: true });
  }
  return list;
}

function informationSourceById(id, list) {
  return (list || state.caseInformationSources || []).find((s) => s.id === id);
}

function activeCaseInformationSources() {
  return (state.caseInformationSources || []).filter((s) => s.active !== false);
}

function informationSourceSelectHtml(selectedId, includeInactiveSelected = false) {
  let list = activeCaseInformationSources();
  const sel = selectedId || state.defaultInformationSourceId || list[0]?.id || "";
  if (includeInactiveSelected && selectedId) {
    const cur = informationSourceById(selectedId);
    if (cur && !list.some((s) => s.id === cur.id)) list = [cur, ...list];
  }
  if (!list.length) return `<option value="">— Configure contact sources —</option>`;
  return list
    .map((s) => {
      const inactive = s.active === false ? " (inactive)" : "";
      return `<option value="${escapeHtml(s.id)}" ${s.id === sel ? "selected" : ""}>${escapeHtml(s.label)}${inactive}</option>`;
    })
    .join("");
}

function applyInformationSourceToRow(row, sourceId, catalog) {
  const list = catalog || state.caseInformationSources || [];
  const src = informationSourceById(sourceId, list) || list.find((s) => s.active !== false) || list[0];
  if (!src) return;
  row.informationSourceId = src.id;
  row.informationSourceLabel = src.label;
}

function informationSourceDisplay(c) {
  if (c.informationSourceLabel) return c.informationSourceLabel;
  const src = informationSourceById(c.informationSourceId);
  return src?.label || "—";
}

function agentById(id) {
  return (state.agents || []).find((a) => a.id === id);
}

function assigneeDisplayName(userId) {
  if (!userId) return "Unassigned";
  const a = agentById(userId);
  if (a) return a.title ? `${a.name} (${a.title})` : a.name;
  return userId;
}

function assigneeSelectHtml(selectedId, includeUnassigned = true) {
  const head = includeUnassigned ? `<option value="" ${!selectedId ? "selected" : ""}>— Unassigned —</option>` : "";
  const opts = (state.agents || [])
    .map(
      (a) =>
        `<option value="${escapeHtml(a.id)}" ${a.id === selectedId ? "selected" : ""}>${escapeHtml(a.name)} · ${escapeHtml(a.title || "Agent")}</option>`
    )
    .join("");
  return head + opts;
}

function normalizeCaseNote(caseRow) {
  if (!caseRow.caseNote) caseRow.caseNote = { body: "", updatedById: null, updatedByName: null, updatedAt: null };
  if (!Array.isArray(caseRow.caseNoteHistory)) caseRow.caseNoteHistory = [];
}

function saveCaseNote(caseRow, body) {
  normalizeCaseNote(caseRow);
  const trimmed = (body || "").trim();
  const now = new Date().toISOString();
  const ag = agentById(state.currentUserId);
  const prev = (caseRow.caseNote.body || "").trim();
  if (prev && prev !== trimmed) {
    caseRow.caseNoteHistory.push({
      body: prev,
      updatedById: caseRow.caseNote.updatedById,
      updatedByName: caseRow.caseNote.updatedByName,
      updatedAt: caseRow.caseNote.updatedAt,
    });
  }
  caseRow.caseNote = {
    body: trimmed,
    updatedById: ag?.id || state.currentUserId,
    updatedByName: ag?.name || assigneeDisplayName(state.currentUserId),
    updatedAt: now,
  };
  caseRow.audit = caseRow.audit || [];
  caseRow.audit.push({ t: now, msg: `Case note updated by ${caseRow.caseNote.updatedByName}` });
}

function defaultEscalationByGroup() {
  return {
    Enterprise: {
      hierarchical: ["Agent", "Team Lead", "HOD", "Director", "GMD"],
      functional: ["Resolution", "Delegation", "Consultation", "External"],
    },
    Retail: {
      hierarchical: ["Agent", "Supervisor", "Area Manager"],
      functional: ["Triage", "Repair", "Verification", "Closure"],
    },
    Billing: {
      hierarchical: ["Agent", "Team Lead", "Finance Controller"],
      functional: ["Review", "Adjustment", "Approval", "Notify Customer"],
    },
  };
}

function defaultFunctionalEscalationConfig() {
  return Object.fromEntries(
    FUNCTIONAL_ESCALATION_LEVELS.map((l) => [
      l.id,
      { pickupMins: DEFAULT_FUNC_LEVEL_PICKUP_MINS, resolutionMins: DEFAULT_FUNC_LEVEL_RESOLUTION_MINS },
    ])
  );
}

function normalizeFunctionalEscalationConfig(cfg) {
  const out = {};
  for (const level of FUNCTIONAL_ESCALATION_LEVELS) {
    const cur = cfg?.[level.id];
    if (typeof cur === "number") {
      out[level.id] = {
        pickupMins: Math.round(cur) > 0 ? Math.round(cur) : DEFAULT_FUNC_LEVEL_PICKUP_MINS,
        resolutionMins: DEFAULT_FUNC_LEVEL_RESOLUTION_MINS,
      };
    } else if (cur && typeof cur === "object") {
      const pickup = Number(cur.pickupMins);
      const resolution = Number(cur.resolutionMins);
      out[level.id] = {
        pickupMins: Number.isFinite(pickup) && pickup > 0 ? Math.round(pickup) : DEFAULT_FUNC_LEVEL_PICKUP_MINS,
        resolutionMins:
          Number.isFinite(resolution) && resolution > 0 ? Math.round(resolution) : DEFAULT_FUNC_LEVEL_RESOLUTION_MINS,
      };
    } else {
      out[level.id] = {
        pickupMins: DEFAULT_FUNC_LEVEL_PICKUP_MINS,
        resolutionMins: DEFAULT_FUNC_LEVEL_RESOLUTION_MINS,
      };
    }
  }
  return out;
}

function functionalEscalationLevelConfig(levelId) {
  const cfg = normalizeFunctionalEscalationConfig(state.functionalEscalationConfig || defaultFunctionalEscalationConfig());
  return cfg[levelId] || { pickupMins: DEFAULT_FUNC_LEVEL_PICKUP_MINS, resolutionMins: DEFAULT_FUNC_LEVEL_RESOLUTION_MINS };
}

function functionalLevelPickupMins(levelId) {
  return functionalEscalationLevelConfig(levelId).pickupMins;
}

function functionalLevelResolutionMins(levelId) {
  return functionalEscalationLevelConfig(levelId).resolutionMins;
}

/** @deprecated use functionalLevelPickupMins */
function functionalLevelTimeoutMins(levelId) {
  return functionalLevelPickupMins(levelId);
}

function functionalLevelByIndex(index) {
  const i = Math.max(0, Math.min(index ?? 0, FUNCTIONAL_ESCALATION_LEVELS.length - 1));
  return FUNCTIONAL_ESCALATION_LEVELS[i];
}

function ensureFunctionalEscalation(c) {
  const steps = FUNCTIONAL_ESCALATION_LEVELS.map((l) => l.step);
  c.functionalSteps = steps;
  if (c.functionalIndex == null) c.functionalIndex = 0;
  c.functionalIndex = Math.max(0, Math.min(c.functionalIndex, steps.length - 1));
  if (!c.trackProgress || typeof c.trackProgress !== "object") {
    c.trackProgress = Object.fromEntries(steps.map((s) => [s, 0]));
  }
  for (const s of steps) {
    if (c.trackProgress[s] == null) c.trackProgress[s] = 0;
  }
  if (!c.functionalEscalation || typeof c.functionalEscalation !== "object") {
    c.functionalEscalation = {
      levelEnteredAt: c.createdAt || new Date().toISOString(),
      history: [],
    };
  }
  if (!Array.isArray(c.functionalEscalation.history)) c.functionalEscalation.history = [];
  if (!c.functionalEscalation.levelEnteredAt) {
    c.functionalEscalation.levelEnteredAt = c.createdAt || new Date().toISOString();
  }
}

function minutesInCurrentFunctionalLevel(c) {
  ensureFunctionalEscalation(c);
  const entered = new Date(c.functionalEscalation.levelEnteredAt);
  if (Number.isNaN(entered.getTime())) return 0;
  return (Date.now() - entered.getTime()) / 60000;
}

function formatEscalationCountdown(remainMins) {
  const totalSec = Math.max(0, Math.ceil(remainMins * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildEscalationTimerCountdown(remainMins, { breachedLabel, activeSuffix, doneText, showDone = false }) {
  if (showDone) return { text: doneText || "—", cls: "done", breached: false, remainMins: 0 };
  if (remainMins <= 0) return { text: breachedLabel, cls: "breach", breached: true, remainMins: remainMins };
  const warn = remainMins <= 2;
  return {
    text: `${formatEscalationCountdown(remainMins)} ${activeSuffix}`,
    cls: warn ? "warn" : "",
    breached: false,
    remainMins: remainMins,
  };
}

function functionalLevelTimers(c) {
  ensureFunctionalEscalation(c);
  const level = functionalLevelByIndex(c.functionalIndex);
  const pickupLimit = functionalLevelPickupMins(level.id);
  const resolutionLimit = functionalLevelResolutionMins(level.id);
  const combinedLimit = pickupLimit + resolutionLimit;
  const elapsed = minutesInCurrentFunctionalLevel(c);
  const atMax = (c.functionalIndex ?? 0) >= FUNCTIONAL_ESCALATION_LEVELS.length - 1;

  const pickupRemain = pickupLimit - elapsed;
  const pickup = buildEscalationTimerCountdown(pickupRemain, {
    breachedLabel: "Pick-up breached",
    activeSuffix: "pick-up",
    doneText: "Final level",
    showDone: atMax,
  });
  pickup.limit = pickupLimit;
  pickup.elapsed = elapsed;

  let resolution;
  if (elapsed < pickupLimit) {
    resolution = {
      text: `${formatEscalationCountdown(resolutionLimit)} after pick-up`,
      cls: "pending",
      breached: false,
      remainMins: resolutionLimit,
      limit: resolutionLimit,
      elapsed: 0,
      pending: true,
    };
  } else {
    const resolutionRemain = combinedLimit - elapsed;
    resolution = buildEscalationTimerCountdown(resolutionRemain, {
      breachedLabel: "Resolution breached",
      activeSuffix: "resolution",
    });
    resolution.limit = resolutionLimit;
    resolution.elapsed = Math.max(0, elapsed - pickupLimit);
    resolution.pending = false;
  }

  const combinedRemain = combinedLimit - elapsed;
  const combined = buildEscalationTimerCountdown(combinedRemain, {
    breachedLabel: "Level SLA breached",
    activeSuffix: "to escalate",
    doneText: "Final level",
    showDone: atMax,
  });
  combined.limit = combinedLimit;
  combined.elapsed = elapsed;
  combined.pct = combinedLimit > 0 ? Math.min(1, elapsed / combinedLimit) : 1;
  combined.pickupLimit = pickupLimit;
  combined.resolutionLimit = resolutionLimit;

  return { level, pickup, resolution, combined, elapsed, atMax, combinedLimit, pickupLimit, resolutionLimit };
}

function caseEscalationCombinedCounterHtml(t, compact = false) {
  const pct = Math.round((t.combined.pct || 0) * 100);
  const ringCls = t.combined.breached ? "breach" : t.combined.remainMins <= 2 ? "warn" : "";
  const sizeCls = compact ? "compact" : "";
  return `<div class="esc-combined-counter ${sizeCls}" title="Level SLA: pick-up ${t.pickupLimit}m + resolution ${t.resolutionLimit}m">
    <div class="esc-combined-ring ${ringCls}" style="--pct:${pct}">
      <div class="esc-combined-inner">
        <span class="esc-combined-time">${escapeHtml(t.combined.breached ? "0:00" : formatEscalationCountdown(t.combined.remainMins))}</span>
        <span class="esc-combined-label">${t.combined.breached ? "Breached" : "Level SLA"}</span>
      </div>
    </div>
    <span class="esc-combined-meta muted">${t.combined.elapsed.toFixed(0)}m / ${t.combined.limit}m</span>
  </div>`;
}

function caseEscalationTimersHtml(c, compact = false) {
  const t = functionalLevelTimers(c);
  const combined = caseEscalationCombinedCounterHtml(t, compact);
  if (compact) {
    return `<div class="esc-timer-stack compact">
      ${combined}
      <span class="esc-countdown ${t.pickup.cls}" title="Pick-up (${t.pickupLimit}m)">⏱ ${escapeHtml(t.pickup.text)}</span>
      <span class="esc-countdown ${t.resolution.cls}" title="Resolution (${t.resolutionLimit}m after pick-up)">✓ ${escapeHtml(t.resolution.text)}</span>
    </div>`;
  }
  return `<div class="esc-timer-stack">
    ${combined}
    <div class="esc-timer-row"><span class="esc-timer-label">Pick-up</span><span class="esc-countdown ${t.pickup.cls}">${escapeHtml(t.pickup.text)}</span><span class="muted"> / ${t.pickup.limit}m</span></div>
    <div class="esc-timer-row"><span class="esc-timer-label">Resolution</span><span class="esc-countdown ${t.resolution.cls}">${escapeHtml(t.resolution.text)}</span><span class="muted"> / ${t.resolution.limit}m after pick-up</span></div>
  </div>`;
}

function functionalLevelCountdown(c) {
  const { pickup, atMax } = functionalLevelTimers(c);
  return { ...pickup, pickup: pickup.limit, atMax };
}

function escalateCaseFunctional(c, mode = "manual") {
  ensureFunctionalEscalation(c);
  const idx = c.functionalIndex ?? 0;
  if (idx >= FUNCTIONAL_ESCALATION_LEVELS.length - 1) return false;
  const from = functionalLevelByIndex(idx);
  const completedStep = from.step;
  if (c.trackProgress) c.trackProgress[completedStep] = 100;
  c.functionalIndex = idx + 1;
  const to = functionalLevelByIndex(c.functionalIndex);
  const now = new Date().toISOString();
  c.functionalEscalation.levelEnteredAt = now;
  c.functionalEscalation.history.push({
    fromLevelId: from.id,
    toLevelId: to.id,
    at: now,
    mode,
  });
  c.audit = c.audit || [];
  const who = getLoggedInUser()?.name || assigneeDisplayName(state.currentUserId);
  const pickupNote = mode === "auto" ? " (pick-up + resolution SLA breached)" : "";
  c.audit.push({
    t: now,
    msg: `${mode === "auto" ? "Auto" : "Manual"} escalation: ${from.team} → ${to.team}${pickupNote}${who ? ` · ${who}` : ""}`,
  });
  if (c.functionalIndex >= 1 && c.resolutionStatus === "Open") {
    c.resolutionStatus = "Escalated";
  }
  state.notifications.push({
    id: uid(),
    text: `${mode === "auto" ? "Auto" : "Manual"} escalation on "${caseTitleShort(c)}" → ${to.team}`,
    at: now,
  });
  return true;
}

function caseTitleShort(c) {
  const t = c.title || "";
  const i = t.indexOf(" — ");
  return i > 0 ? t.slice(0, i) : t || c.id;
}

function processAutoFunctionalEscalations() {
  let count = 0;
  for (const c of state.cases) {
    if (!caseVisibleForRole(c)) continue;
    ensureFunctionalEscalation(c);
    const idx = c.functionalIndex ?? 0;
    if (idx >= FUNCTIONAL_ESCALATION_LEVELS.length - 1) continue;
    const level = functionalLevelByIndex(idx);
    const pickup = functionalLevelPickupMins(level.id);
    const resolution = functionalLevelResolutionMins(level.id);
    if (minutesInCurrentFunctionalLevel(c) >= pickup + resolution) {
      if (escalateCaseFunctional(c, "auto")) count++;
    }
  }
  if (count > 0) saveState();
  return count;
}

function cleanupEscalationAutoTimer() {
  if (_escalationAutoTimer) {
    clearInterval(_escalationAutoTimer);
    _escalationAutoTimer = null;
  }
}

function cleanupGlobalPickupTimer() {
  if (_globalPickupTimer) {
    clearInterval(_globalPickupTimer);
    _globalPickupTimer = null;
  }
}

function ensureGlobalPickupTimer() {
  if (_globalPickupTimer || !getLoggedInUser()) return;
  let ticks = 0;
  _globalPickupTimer = setInterval(() => {
    if (!getLoggedInUser()) return;
    ticks++;
    let escalated = 0;
    if (ticks % 5 === 0) escalated = processAutoFunctionalEscalations();
    const onTimerView = state.route === "escalation" || state.route === "cases" || !!state.detailCaseId;
    if (escalated > 0 || onTimerView) render();
  }, 1000);
}

function defaultCustomerEmailTemplates() {
  return [
    {
      id: "cet_ack",
      label: "Service acknowledgement",
      subject: "We received your request — {{customer_name}}",
      body: "Dear {{contact_name}},\n\nThank you for contacting our support team. We have logged your request and assigned it to the Resolution Team.\n\nYou will receive updates as your case progresses.\n\nRegards,\nCustomer Care",
    },
    {
      id: "cet_maintenance",
      label: "Planned maintenance notice",
      subject: "Scheduled maintenance — {{customer_name}}",
      body: "Dear {{contact_name}},\n\nThis is to inform you of a planned maintenance window affecting your services. Our teams are coordinating to minimize disruption.\n\nIf you have questions, reply to this email or open a case in the selfcare portal.\n\nRegards,\nNetwork Operations",
    },
    {
      id: "cet_followup",
      label: "Case follow-up",
      subject: "Follow-up on your open case — {{customer_name}}",
      body: "Dear {{contact_name}},\n\nWe are following up on your open service case. Please let us know if the issue persists or if you need additional assistance.\n\nRegards,\nCustomer Success",
    },
    {
      id: "cet_closure",
      label: "Case closure notice",
      subject: "Case closed — {{case_id}} ({{customer_name}})",
      body: "Dear {{contact_name}},\n\nYour service case has been closed.\n\nCase ID: {{case_id}}\nSubject: {{case_title}}\nResolution: {{resolution_status}}\n\nThank you for working with us. If you need further assistance, reply to this email or use the Selfcare portal.\n\nRegards,\nCustomer Care",
    },
  ];
}

/** All customer contact emails (HQ rep, branches, rep–branch links). */
function allCustomerContactEmailRecipients() {
  const seen = new Set();
  const rows = [];
  for (const cust of state.customers || []) {
    const contactIds = new Set();
    if (cust.primaryRepresentativeContactId) contactIds.add(cust.primaryRepresentativeContactId);
    if (cust.contactId) contactIds.add(cust.contactId);
    for (const b of (state.branches || []).filter((x) => x.customerId === cust.id)) {
      if (b.contactId) contactIds.add(b.contactId);
    }
    for (const link of (state.repBranchLinks || []).filter((x) => x.customerId === cust.id)) {
      if (link.contactId) contactIds.add(link.contactId);
      if (link.representativeContactId) contactIds.add(link.representativeContactId);
    }
    for (const contactId of contactIds) {
      const ct = contactById(contactId);
      const email = ct?.email?.trim();
      if (!email) continue;
      const key = `${cust.id}:${contactId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        key,
        customerId: cust.id,
        customerName: cust.name,
        contactId,
        contactName: contactDisplayName(ct),
        email,
      });
    }
  }
  return rows.sort((a, b) => a.customerName.localeCompare(b.customerName) || a.contactName.localeCompare(b.contactName));
}

function customerEmailRecipientKeys(recipients) {
  return recipients.map((r) => r.key);
}

function customerEmailSelectedSet(recipients) {
  const allKeys = customerEmailRecipientKeys(recipients);
  const stored = Array.isArray(state.customerEmailSelectedKeys) ? state.customerEmailSelectedKeys : [];
  if (!stored.length) return new Set(allKeys);
  const valid = stored.filter((k) => allKeys.includes(k));
  return new Set(valid.length ? valid : allKeys);
}

const CUSTOMER_EMAIL_SOURCE_DIRECTORY = "__directory__";

function defaultCustomerEmailGroups() {
  return [
    {
      id: "ceg_enterprise",
      label: "Enterprise broadcast",
      members: [
        {
          id: "cegm_1",
          customerId: "cust_1",
          contactId: "ct_org_1",
          customerName: "NorthLink Telecom Ltd",
          contactName: "Executive lead 1",
          email: "hq.cust1@demo.ng",
        },
        {
          id: "cegm_2",
          customerId: "cust_2",
          contactId: "ct_org_2",
          customerName: "Greenfield Retail Co",
          contactName: "Executive lead 2",
          email: "hq.cust2@demo.ng",
        },
      ],
      createdAt: new Date().toISOString(),
    },
  ];
}

function normalizeCustomerEmailGroups(groups) {
  if (!Array.isArray(groups)) return defaultCustomerEmailGroups();
  if (!groups.length) return [];
  return groups.map((g) => ({
    id: g.id || uid(),
    label: (g.label || "Untitled group").trim(),
    members: (g.members || [])
      .map((m) => ({
        id: m.id || uid(),
        customerId: m.customerId || null,
        contactId: m.contactId || null,
        customerName: (m.customerName || "").trim(),
        contactName: (m.contactName || "").trim(),
        email: (m.email || "").trim(),
      }))
      .filter((m) => m.email && m.customerName),
    createdAt: g.createdAt || new Date().toISOString(),
  }));
}

function customerEmailGroupById(groupId) {
  return (state.customerEmailGroups || []).find((g) => g.id === groupId);
}

function defaultEscalationNotifyGroups() {
  const functional = [
    {
      id: "eng_resolution",
      label: "Resolution Team",
      emails: ["resolution.team@vdtcomms.com"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "eng_escalation",
      label: "Escalation Team",
      emails: ["escalation.team@vdtcomms.com"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "eng_consultation",
      label: "Consultation Team",
      emails: ["consultation.team@vdtcomms.com"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "eng_external",
      label: "External Partners",
      emails: ["external.partners@vdtcomms.com"],
      createdAt: new Date().toISOString(),
    },
  ];
  const hierarchical = HIERARCHICAL_ESCALATION_GROUP_DEFS.map((def) => buildHierarchicalEscalationGroup(def));
  return [...functional, ...hierarchical];
}

function normalizeEscalationNotifyGroups(groups) {
  if (!Array.isArray(groups)) return defaultEscalationNotifyGroups();
  const merged = ensureHierarchicalEscalationGroups(groups);
  if (!merged.length) return defaultEscalationNotifyGroups();
  return merged.map((g) => ({
    id: g.id || uid(),
    label: (g.label || "Untitled group").trim(),
    hierarchicalRole: g.hierarchicalRole || hierarchicalEscalationGroupDef(g.id)?.role || null,
    emails: [...new Set((g.emails || []).map((e) => String(e || "").trim()).filter(Boolean))],
    createdAt: g.createdAt || new Date().toISOString(),
  }));
}

function defaultEscalationLevelAssignments() {
  return {
    functional: Object.fromEntries(
      FUNCTIONAL_ESCALATION_LEVELS.map((l) => [
        l.id,
        l.id === "resolution"
          ? "eng_resolution"
          : l.id === "delegation"
            ? "eng_escalation"
            : l.id === "consultation"
              ? "eng_consultation"
              : l.id === "external"
                ? "eng_external"
                : null,
      ])
    ),
    hierarchical: Object.fromEntries([
      ["Agent", null],
      ...HIERARCHICAL_ESCALATION_ROLES.map((role) => [role, hierarchicalEscalationGroupIdForRole(role)]),
    ]),
  };
}

function normalizeEscalationLevelAssignments(assignments, groups) {
  const def = defaultEscalationLevelAssignments();
  const validIds = new Set((groups || []).map((g) => g.id));
  const pick = (id, fallback) => (id && validIds.has(id) ? id : fallback && validIds.has(fallback) ? fallback : null);
  const functional = {};
  for (const level of FUNCTIONAL_ESCALATION_LEVELS) {
    functional[level.id] = pick(assignments?.functional?.[level.id], def.functional[level.id]);
  }
  const hierarchical = {};
  for (const lvl of ESCALATION_HIERARCHICAL_LEVELS) {
    hierarchical[lvl] = pick(assignments?.hierarchical?.[lvl], def.hierarchical[lvl]);
  }
  return { functional, hierarchical };
}

function escalationNotifyGroupById(groupId) {
  if (!groupId) return null;
  return (state.escalationNotifyGroups || []).find((g) => g.id === groupId) || null;
}

function escalationNotifyGroupSelectHtml(selectedId, includeNone = true, filterHierarchical = null) {
  let groups = state.escalationNotifyGroups || [];
  if (filterHierarchical === true) groups = groups.filter((g) => isHierarchicalEscalationGroup(g));
  else if (filterHierarchical === false) groups = groups.filter((g) => !isHierarchicalEscalationGroup(g));
  const head = includeNone
    ? `<option value="" ${!selectedId ? "selected" : ""}>— None —</option>`
    : "";
  const opts = groups
    .map(
      (g) =>
        `<option value="${escapeHtml(g.id)}" ${g.id === selectedId ? "selected" : ""}>${escapeHtml(g.label)} (${(g.emails || []).length} email(s))</option>`
    )
    .join("");
  return head + opts;
}

function hierarchicalEscalationGroupsComplete() {
  return HIERARCHICAL_ESCALATION_ROLES.every((role) =>
    (state.escalationNotifyGroups || []).some(
      (g) => g.hierarchicalRole === role || g.id === hierarchicalEscalationGroupIdForRole(role)
    )
  );
}

function escalationGroupForFunctionalLevel(levelId) {
  const gid = state.escalationLevelAssignments?.functional?.[levelId];
  return escalationNotifyGroupById(gid);
}

function escalationGroupForHierarchicalLevel(levelName) {
  const gid = state.escalationLevelAssignments?.hierarchical?.[levelName];
  return escalationNotifyGroupById(gid);
}

function escalationGroupEmailsDisplay(group) {
  if (!group?.emails?.length) return "—";
  return group.emails.join(", ");
}

function customerEmailGroupRecipientKey(groupId, memberId) {
  return `group:${groupId}:${memberId}`;
}

function customerEmailGroupRecipients(group) {
  if (!group) return [];
  return (group.members || []).map((m) => ({
    key: customerEmailGroupRecipientKey(group.id, m.id),
    customerId: m.customerId,
    customerName: m.customerName,
    contactId: m.contactId,
    contactName: m.contactName || m.customerName,
    email: m.email,
    groupId: group.id,
    memberId: m.id,
  }));
}

function customerEmailActiveSource() {
  const id = state.customerEmailActiveGroupId;
  if (!id || id === CUSTOMER_EMAIL_SOURCE_DIRECTORY) return CUSTOMER_EMAIL_SOURCE_DIRECTORY;
  return customerEmailGroupById(id) ? id : CUSTOMER_EMAIL_SOURCE_DIRECTORY;
}

function customerEmailRecipientsForActiveSource() {
  const source = customerEmailActiveSource();
  if (source === CUSTOMER_EMAIL_SOURCE_DIRECTORY) return allCustomerContactEmailRecipients();
  return customerEmailGroupRecipients(customerEmailGroupById(source));
}

function customerEmailPrimaryContactForCustomer(customerId) {
  const cust = customerById(customerId);
  if (!cust) return null;
  const repId = cust.primaryRepresentativeContactId || cust.contactId;
  const ct = contactById(repId);
  if (!ct?.email?.trim()) return null;
  return {
    customerId: cust.id,
    customerName: cust.name,
    contactId: ct.id,
    contactName: contactDisplayName(ct),
    email: ct.email.trim(),
  };
}

/** One outbound row per customer (HQ / primary representative email). */
function allCustomerEmailRecipients() {
  const rows = [];
  for (const cust of state.customers || []) {
    const repId = cust.primaryRepresentativeContactId || cust.contactId;
    const rep = contactById(repId) || contactById(cust.contactId);
    const email = rep?.email?.trim();
    if (!email) continue;
    rows.push({
      customerId: cust.id,
      customerName: cust.name,
      contactId: rep.id,
      contactName: contactDisplayName(rep),
      email,
    });
  }
  return rows;
}

/** All contact emails tied to a customer account (HQ rep, branches, rep–branch links). */
function caseCustomerContactRecipients(caseRow) {
  const customerId = caseRow?.customerId;
  if (!customerId) return [];
  const cust = customerById(customerId);
  const contactIds = new Set();
  if (cust?.primaryRepresentativeContactId) contactIds.add(cust.primaryRepresentativeContactId);
  if (cust?.contactId) contactIds.add(cust.contactId);
  for (const b of (state.branches || []).filter((x) => x.customerId === customerId)) {
    if (b.contactId) contactIds.add(b.contactId);
  }
  for (const link of (state.repBranchLinks || []).filter((x) => x.customerId === customerId)) {
    if (link.contactId) contactIds.add(link.contactId);
  }
  const rows = [];
  for (const contactId of contactIds) {
    const ct = contactById(contactId);
    const email = ct?.email?.trim();
    if (!email) continue;
    rows.push({
      customerId,
      customerName: cust?.name || "",
      contactId,
      contactName: contactDisplayName(ct),
      email,
    });
  }
  return rows;
}

function applyCaseClosureEmail(caseRow, recipient) {
  const tpl =
    (state.customerEmailTemplates || []).find((t) => t.id === "cet_closure") ||
    defaultCustomerEmailTemplates().find((t) => t.id === "cet_closure");
  const vars = {
    "{{customer_name}}": recipient.customerName || "",
    "{{contact_name}}": recipient.contactName || "",
    "{{email}}": recipient.email || "",
    "{{case_id}}": caseDisplayId(caseRow),
    "{{case_title}}": caseRow.title || "",
    "{{resolution_status}}": caseRow.resolutionStatus || "Close",
  };
  let subject = tpl?.subject || "Case closed — {{case_id}}";
  let body = tpl?.body || "Your case {{case_id}} has been closed.";
  for (const [k, v] of Object.entries(vars)) {
    subject = subject.split(k).join(v);
    body = body.split(k).join(v);
  }
  return { subject, body };
}

function logOutboundEmail({ contactId, subject, body, channel = "Email" }) {
  state.communications.push({
    id: uid(),
    contactId: contactId || null,
    channel,
    direction: "out",
    subject,
    body,
    meetingUrl: "",
    at: new Date().toISOString(),
  });
}

function sendCaseClosureEmails(caseRow) {
  const recipients = caseCustomerContactRecipients(caseRow);
  if (!recipients.length) {
    toast("Case closed — no customer contact emails found to notify.");
    return 0;
  }
  let opened = 0;
  for (const r of recipients) {
    const filled = applyCaseClosureEmail(caseRow, r);
    const mailto = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(filled.subject)}&body=${encodeURIComponent(filled.body)}`;
    window.open(mailto, "_blank");
    logOutboundEmail({ contactId: r.contactId, subject: filled.subject, body: filled.body });
    opened++;
  }
  caseRow.closureEmailSentAt = new Date().toISOString();
  caseRow.audit = caseRow.audit || [];
  caseRow.audit.push({
    t: caseRow.closureEmailSentAt,
    msg: `Closure email opened for ${opened} customer contact(s)`,
  });
  state.notifications.push({
    id: uid(),
    text: `Closure emails prepared for ${opened} contact(s) on case ${caseDisplayId(caseRow)}.`,
    at: new Date().toISOString(),
  });
  toast(`Case closed — ${opened} closure email draft(s) opened for customer contacts.`);
  return opened;
}

function notifyHcceSelfcareCase(caseRow) {
  const caseIdLabel = caseDisplayId(caseRow);
  const custName = customerById(caseRow.customerId)?.name || "Customer";
  const subject = `Selfcare case ${caseIdLabel} — assign agent`;
  const body = `A new Selfcare case requires agent assignment.

Case ID: ${caseIdLabel}
Title: ${caseRow.title || "—"}
Customer: ${custName}
Category: ${caseRow.type || "—"}
Impact/Urgency: ${caseRow.impact || "—"}/${caseRow.urgency || "—"}
Priority: ${caseRow.priority || "—"}

Sign in to the CRM as HCCE (${HCCE_ASSIGNMENT_EMAIL}) using username hcce to assign an agent.

— CRM prototype`;
  const mailto = `mailto:${encodeURIComponent(HCCE_ASSIGNMENT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, "_blank");
  logOutboundEmail({ contactId: null, subject, body });
  caseRow.hcceNotifiedAt = new Date().toISOString();
  caseRow.audit = caseRow.audit || [];
  caseRow.audit.push({ t: caseRow.hcceNotifiedAt, msg: `HCCE notified at ${HCCE_ASSIGNMENT_EMAIL} for assignment (case ${caseIdLabel})` });
  state.notifications.push({
    id: uid(),
    text: `HCCE notified for Selfcare case ${caseIdLabel} — assign an agent.`,
    at: new Date().toISOString(),
  });
}

function userCanAssignAnyCase() {
  const auth = getLoggedInUser();
  return auth?.role === "supervisor" || auth?.role === "hcce_coordinator";
}

function applyCustomerEmailTemplate(tpl, recipient) {
  const vars = {
    "{{customer_name}}": recipient.customerName || "",
    "{{contact_name}}": recipient.contactName || "",
    "{{email}}": recipient.email || "",
  };
  let subject = tpl.subject || "";
  let body = tpl.body || "";
  for (const [k, v] of Object.entries(vars)) {
    subject = subject.split(k).join(v);
    body = body.split(k).join(v);
  }
  return { subject, body };
}

function applyEscalationSnapshotToCase(c, groupId, groups) {
  const gMap = groups && typeof groups === "object" ? groups : {};
  const vals = Object.values(gMap).filter(Boolean);
  const g = gMap[groupId] || gMap.Enterprise || vals[0];
  if (!g || !Array.isArray(g.hierarchical) || !g.hierarchical.length) {
    c.escalationTemplate = groupId || "Enterprise";
    c.hierarchicalLevels = ["Agent", "Team Lead"];
    c.hierarchicalIndex = 0;
  } else {
    c.escalationTemplate = groupId;
    c.hierarchicalLevels = [...g.hierarchical];
    c.hierarchicalIndex = c.hierarchicalIndex ?? 0;
  }
  c.functionalSteps = FUNCTIONAL_ESCALATION_LEVELS.map((l) => l.step);
  if (c.functionalIndex == null) c.functionalIndex = 0;
  c.trackProgress = Object.fromEntries(c.functionalSteps.map((s) => [s, c.trackProgress?.[s] ?? 0]));
  ensureFunctionalEscalation(c);
}

/** Demo dataset: 10 customers, each with 5 branch locations (HQ is separate; branches use br_1…br_50). */
function buildDemoCustomersTen(now) {
  const names = [
    "NorthLink Telecom Ltd",
    "Greenfield Retail Co",
    "Summit Microfinance Bank",
    "Harbour Logistics NG",
    "Apex Health Systems",
    "Bright Academy Trust",
    "Cascade Software Ltd",
    "Delta Agronomy Co-op",
    "Evergreen Utilities PLC",
    "Falcon Security Services",
  ];
  const segments = ["Enterprise", "Retail", "Billing", "Enterprise", "Retail", "Enterprise", "Retail", "Billing", "Enterprise", "Retail"];
  const cityRow = ["Abuja", "Lagos", "Port Harcourt", "Ibadan", "Kano"];
  const contacts = [];
  const customers = [];
  const branches = [];
  for (let i = 0; i < 10; i++) {
    const n = i + 1;
    const custId = `cust_${n}`;
    const hqId = `ct_org_${n}`;
    contacts.push({
      id: hqId,
      contactType: "Organization",
      orgName: names[i],
      primaryName: `Executive lead ${n}`,
      phone: `+234801${String(1000000 + n).padStart(7, "0")}`,
      email: `hq.cust${n}@demo.ng`,
    });
    customers.push({
      id: custId,
      contactId: hqId,
      segment: segments[i],
      name: names[i],
      primaryRepresentativeContactId: hqId,
      createdAt: new Date(now - 86400000 * (45 - i * 2)).toISOString(),
    });
    for (let j = 0; j < 5; j++) {
      const brIdx = i * 5 + j + 1;
      const bctId = `ct_br_${brIdx}`;
      const city = cityRow[j];
      contacts.push({
        id: bctId,
        contactType: "Organization",
        branchName: `${names[i]} — ${city}`,
        primaryName: `${city} site supervisor`,
        phone: `+234802${String(100000 + brIdx).padStart(6, "0")}`,
        email: `loc${brIdx}@demo.ng`,
      });
      branches.push({
        id: `br_${brIdx}`,
        customerId: custId,
        contactId: bctId,
        name: `${names[i]} · ${city}`,
        city,
      });
    }
  }
  return { contacts, customers, branches };
}

function defaultState() {
  const now = Date.now();
  const { contacts, customers, branches } = buildDemoCustomersTen(now);
  const caseGroupCatalog = defaultCaseGroupCatalog();
  const escalationByGroup = defaultEscalationByGroup();

  const caseParent = {
    id: "case_1",
    caseId: "CRM-00001",
    parentCaseId: null,
    customerId: "cust_1",
    branchId: null,
    title: "Enterprise WAN degradation — HQ",
    type: "Incident",
    priority: "P1-Critical",
    impact: "High",
    urgency: "High",
    status: "In Progress",
    resolutionStatus: "Open",
    caseGroupId: "cg_link_down",
    caseTypeId: "ct_trunk_down",
    caseGroupLabel: "Link down",
    caseTypeLabel: "Trunk down",
    escalationTemplate: "Enterprise",
    hierarchicalLevels: [],
    functionalSteps: [],
    hierarchicalIndex: 1,
    functionalIndex: 1,
    assignedUserId: "u_agent",
    createdByUserId: "u_agent",
    createdByName: "Ada Okonkwo",
    teamId: "team_net",
    departmentId: "dept_ops",
    description: "Intermittent packet loss on primary MPLS.",
    createdAt: new Date(now - 3600000 * 6).toISOString(),
    globalSla: {
      durationHours: 24,
      overdueOffsetHours: 8,
      pauseHours: 0,
      pausedReason: null,
      simulatedElapsedHours: 10,
    },
    slaPolicyLabel: "Trunk down",
    slaPolicyTypeId: "ct_trunk_down",
    trackProgress: {},
    source: "agent",
    informationSourceId: "cis_phone",
    informationSourceLabel: "Phone call",
    caseNote: {
      body: "Customer reports intermittent loss on primary MPLS; monitoring graphs attached.",
      updatedById: "u_agent",
      updatedByName: "Ada Okonkwo",
      updatedAt: new Date(now - 3600000 * 4).toISOString(),
    },
    caseNoteHistory: [],
    audit: [
      { t: new Date(now - 3600000 * 6).toISOString(), msg: "Case created (HQ)" },
      { t: new Date(now - 3600000 * 5).toISOString(), msg: "Assigned to Ada Okonkwo" },
    ],
  };
  const caseChild = {
    id: "case_2",
    caseId: "CRM-00002",
    parentCaseId: "case_1",
    customerId: "cust_1",
    branchId: "br_1",
    title: "Branch circuit health check — Abuja",
    type: "Task",
    priority: "P2-High",
    impact: "High",
    urgency: "Medium",
    status: "Assigned",
    resolutionStatus: "unresolved",
    caseGroupId: "cg_pop_down",
    caseTypeId: "ct_router_failure",
    caseGroupLabel: "POP down",
    caseTypeLabel: "Router Failure",
    escalationTemplate: "Enterprise",
    hierarchicalLevels: [],
    functionalSteps: [],
    hierarchicalIndex: 0,
    functionalIndex: 0,
    assignedUserId: "u_agent2",
    createdByUserId: "u_agent2",
    createdByName: "Bola Mensah",
    teamId: "team_net",
    departmentId: "dept_ops",
    description: "Child case linked to parent.",
    createdAt: new Date(now - 3600000 * 3).toISOString(),
    globalSla: {
      durationHours: 16,
      overdueOffsetHours: 6,
      pauseHours: 0,
      pausedReason: null,
      simulatedElapsedHours: 4,
    },
    slaPolicyLabel: "Router Failure",
    slaPolicyTypeId: "ct_router_failure",
    trackProgress: {},
    source: "agent",
    informationSourceId: "cis_email",
    informationSourceLabel: "Email",
    caseNote: { body: "", updatedById: null, updatedByName: null, updatedAt: null },
    caseNoteHistory: [],
    audit: [
      { t: new Date(now - 3600000 * 3).toISOString(), msg: "Child case created (Branch)" },
      { t: new Date(now - 3600000 * 2.5).toISOString(), msg: "Assigned to Ada Okonkwo" },
    ],
  };

  applyEscalationSnapshotToCase(caseParent, caseParent.escalationTemplate, escalationByGroup);
  applyEscalationSnapshotToCase(caseChild, caseChild.escalationTemplate, escalationByGroup);
  caseParent.hierarchicalIndex = 1;
  caseParent.functionalIndex = 0;
  caseParent.functionalEscalation = {
    levelEnteredAt: new Date(now - 25 * 60000).toISOString(),
    history: [],
  };
  caseParent.trackProgress = { Resolution: 55, Delegation: 0, Consultation: 0, External: 0 };
  caseChild.functionalIndex = 1;
  caseChild.functionalEscalation = {
    levelEnteredAt: new Date(now - 35 * 60000).toISOString(),
    history: [
      {
        fromLevelId: "resolution",
        toLevelId: "delegation",
        at: new Date(now - 35 * 60000).toISOString(),
        mode: "manual",
      },
    ],
  };
  caseChild.trackProgress = { Resolution: 100, Delegation: 25, Consultation: 0, External: 0 };
  const loyaltySchemeId = "loy_s1";
  const loyaltySchemes = [
    {
      id: loyaltySchemeId,
      name: "NorthLink Rewards Plus",
      standardRef: "LOY-ISO-style-001",
      accrualRule: "1 point per ₦100 spend (configurable)",
      expiryMonths: 24,
      active: true,
    },
  ];
  const loyaltyStandards = [
    {
      id: "std_1",
      code: "LP-TR-01",
      title: "Transparent earning rules",
      description: "Members must see how points accrue and expire.",
    },
    {
      id: "std_2",
      code: "LP-FR-02",
      title: "Fair redemption",
      description: "Award catalogue pricing reviewed quarterly.",
    },
  ];
  const loyaltyBeneficiaries = [
    {
      id: "ben_1",
      schemeId: loyaltySchemeId,
      customerId: "cust_1",
      tier: "Gold",
      pointsBalance: 12400,
      status: "Active",
      enrolledAt: new Date(now - 86400000 * 120).toISOString(),
    },
  ];
  const loyaltyAwards = [
    {
      id: "awd_1",
      schemeId: loyaltySchemeId,
      name: "Bill credit ₦5,000",
      pointsCost: 5000,
      description: "One-time statement credit",
      active: true,
    },
    {
      id: "awd_2",
      schemeId: loyaltySchemeId,
      name: "Priority support 30 days",
      pointsCost: 2500,
      description: "Fast-lane queue for incidents",
      active: true,
    },
  ];

  const communications = [
    {
      id: "com_1",
      contactId: "ct_org_1",
      channel: "Email",
      direction: "out",
      subject: "Maintenance notice",
      body: "Scheduled window Saturday 02:00–04:00.",
      meetingUrl: "",
      at: new Date(now - 3600000 * 5).toISOString(),
    },
    {
      id: "com_2",
      contactId: "ct_br_1",
      channel: "Virtual meeting",
      direction: "out",
      subject: "QBR",
      body: "Quarterly business review — link below.",
      meetingUrl: "https://meet.example.com/northlink-qbr",
      at: new Date(now - 86400000 * 2).toISOString(),
    },
  ];

  const st = {
    route: "dashboard",
    detailCaseId: null,
    slaFocusCaseId: null,
    loyaltyTab: "standards",
    selfcareCustomerIds: ["cust_1"],
    selfcareBranchesByCustomerId: { cust_1: ["__hq__"] },
    selfcareCaseGroupId: "cg_link_down",
    selfcareCaseTypeId: "ct_power_issue",
    selfcareInformationSourceId: SELFCARE_CONTACT_SOURCE_ID,
    caseInformationSources: defaultCaseInformationSources(),
    defaultInformationSourceId: "cis_email",
    caseGroupCatalog,
    caseCatalogVersion: CASE_CATALOG_VERSION,
    commFilterContact: "",
    commFilterChannel: "",
    currentUserId: "u_agent",
    currentUserTeamId: "team_net",
    currentUserDeptId: "dept_ops",
    role: "agent",
    agents: defaultAgents(),
    contacts,
    customers,
    branches,
    cases: [caseParent, caseChild],
    caseIdSequence: 2,
    escalationByGroup,
    functionalEscalationConfig: defaultFunctionalEscalationConfig(),
    priorityMatrix: defaultPriorityMatrix(),
    customerEmailTemplates: defaultCustomerEmailTemplates(),
    customerEmailTemplateId: "cet_ack",
    customerEmailSelectedKeys: [],
    customerEmailGroups: defaultCustomerEmailGroups(),
    customerEmailActiveGroupId: CUSTOMER_EMAIL_SOURCE_DIRECTORY,
    customerEmailManageGroupId: "ceg_enterprise",
    escalationNotifyGroups: defaultEscalationNotifyGroups(),
    escalationLevelAssignments: defaultEscalationLevelAssignments(),
    escalationNotifyManageGroupId: "eng_resolution",
    escalationGroupsVersion: ESCALATION_GROUPS_VERSION,
    interactions: [
      {
        id: "int_1",
        contactId: "ct_org_1",
        channel: "Email",
        summary: "Customer acknowledged maintenance window.",
        followUpAt: null,
        at: new Date(now - 3600000 * 4).toISOString(),
      },
    ],
    notifications: [{ id: "n1", text: "SLA warning: case case_1 approaching governance window", at: new Date(now - 1800000).toISOString() }],
    repBranchLinks: [
      {
        id: "rbl_demo",
        customerId: "cust_1",
        representativeContactId: "ct_org_1",
        branchId: "br_1",
        createdAt: new Date(now - 86400000 * 3).toISOString(),
      },
    ],
    loyaltySchemes,
    loyaltyStandards,
    loyaltyBeneficiaries,
    loyaltyAwards,
    communications,
    caseDashSearch: "",
    caseDashFilterStatus: "",
    caseDashFilterPriority: "",
    caseDashFilterCreator: "",
    caseDashSortCol: "createdAt",
    caseDashSortDir: "desc",
    reportFilterUserId: "",
  };
  return st;
}

function hydrateState(parsed) {
  const d = defaultState();
  if (!parsed || !Array.isArray(parsed.cases)) return d;
  if (!parsed.escalationByGroup) parsed.escalationByGroup = JSON.parse(JSON.stringify(d.escalationByGroup));
  for (const [k, v] of Object.entries(d.escalationByGroup)) {
    if (!parsed.escalationByGroup[k]) parsed.escalationByGroup[k] = JSON.parse(JSON.stringify(v));
  }
  if (!Array.isArray(parsed.caseGroupCatalog) || !parsed.caseGroupCatalog.length) {
    parsed.caseGroupCatalog = JSON.parse(JSON.stringify(d.caseGroupCatalog));
  }
  if (parsed.caseCatalogVersion !== CASE_CATALOG_VERSION) {
    applyFreshCaseCatalog(parsed);
  }
  for (const g of parsed.caseGroupCatalog) {
    if (!g.id) g.id = uid();
    if (!g.label) g.label = "Case group";
    if (!g.escalationKey) g.escalationKey = "Enterprise";
    normalizeCaseGroupDef(g);
    if (!Array.isArray(g.caseTypes) || !g.caseTypes.length) {
      g.caseTypes = [defaultCatalogCaseType("Case type")];
    }
    for (const t of g.caseTypes) {
      if (!t.id) t.id = uid();
      if (!t.label) t.label = "Case type";
      normalizeCaseTypeDef(t);
    }
  }
  if (!Array.isArray(parsed.agents) || !parsed.agents.length) parsed.agents = defaultAgents();
  if (!Array.isArray(parsed.caseInformationSources) || !parsed.caseInformationSources.length) {
    parsed.caseInformationSources = JSON.parse(JSON.stringify(d.caseInformationSources));
  }
  ensureSelfcareContactSource(parsed.caseInformationSources);
  for (const s of parsed.caseInformationSources) {
    if (!s.id) s.id = uid();
    if (!s.label) s.label = "Source";
    if (s.active === undefined) s.active = true;
  }
  if (!parsed.defaultInformationSourceId) parsed.defaultInformationSourceId = "cis_email";
  if (!informationSourceById(parsed.defaultInformationSourceId, parsed.caseInformationSources)) {
    const emailSrc = informationSourceById("cis_email", parsed.caseInformationSources);
    parsed.defaultInformationSourceId = emailSrc?.id || parsed.caseInformationSources.find((s) => s.id !== SELFCARE_CONTACT_SOURCE_ID)?.id || parsed.caseInformationSources[0]?.id;
  }
  parsed.selfcareInformationSourceId = SELFCARE_CONTACT_SOURCE_ID;
  if (!Array.isArray(parsed.contacts)) parsed.contacts = d.contacts;
  if (!Array.isArray(parsed.customers)) parsed.customers = d.customers;
  if (!Array.isArray(parsed.branches)) parsed.branches = d.branches;
  if (!parsed.interactions) parsed.interactions = d.interactions;
  if (!Array.isArray(parsed.notifications)) parsed.notifications = d.notifications;
  if (!Array.isArray(parsed.repBranchLinks)) parsed.repBranchLinks = d.repBranchLinks || [];
  if (!Array.isArray(parsed.loyaltySchemes)) parsed.loyaltySchemes = d.loyaltySchemes || [];
  if (!Array.isArray(parsed.loyaltyStandards)) parsed.loyaltyStandards = d.loyaltyStandards || [];
  if (!Array.isArray(parsed.loyaltyBeneficiaries)) parsed.loyaltyBeneficiaries = d.loyaltyBeneficiaries || [];
  if (!Array.isArray(parsed.loyaltyAwards)) parsed.loyaltyAwards = d.loyaltyAwards || [];
  if (!Array.isArray(parsed.communications)) parsed.communications = [];
  if (parsed.communications.length === 0 && Array.isArray(parsed.interactions) && parsed.interactions.length) {
    parsed.communications = parsed.interactions.map((i) => ({
      id: i.id || uid(),
      contactId: i.contactId,
      channel: i.channel || "Email",
      direction: "out",
      subject: "",
      body: i.summary || "",
      meetingUrl: "",
      at: i.at || new Date().toISOString(),
    }));
  }
  if (!Array.isArray(parsed.selfcareCustomerIds) || !parsed.selfcareCustomerIds.length) {
    if (parsed.selfcareCustomerId) parsed.selfcareCustomerIds = [parsed.selfcareCustomerId];
    else if (parsed.customers?.[0]?.id) parsed.selfcareCustomerIds = [parsed.customers[0].id];
    else parsed.selfcareCustomerIds = [];
  }
  parsed.selfcareCustomerIds = parsed.selfcareCustomerIds.filter((id) => parsed.customers?.some((c) => c.id === id));
  if (!parsed.selfcareCustomerIds.length && parsed.customers?.[0]?.id) parsed.selfcareCustomerIds = [parsed.customers[0].id];
  if (parsed.selfcareCustomerIds.length > 1) parsed.selfcareCustomerIds = [parsed.selfcareCustomerIds[0]];
  hydrateSelfcareBranchesMap(parsed);
  if (!LOYALTY_TABS.some((t) => t.id === parsed.loyaltyTab)) parsed.loyaltyTab = "standards";
  for (const cu of parsed.customers || []) {
    if (cu.primaryRepresentativeContactId === undefined) cu.primaryRepresentativeContactId = "";
  }
  const cat0 = parsed.caseGroupCatalog[0];
  if (!parsed.selfcareCaseGroupId && cat0) parsed.selfcareCaseGroupId = cat0.id;
  if (!parsed.selfcareCaseTypeId && cat0?.caseTypes?.[0]) parsed.selfcareCaseTypeId = cat0.caseTypes[0].id;
  if (parsed.selfcareCaseGroupId) {
    const sg = catalogGroupById(parsed.selfcareCaseGroupId, parsed.caseGroupCatalog);
    if (!sg) parsed.selfcareCaseGroupId = cat0?.id;
    if (sg && !catalogTypeById(parsed.selfcareCaseGroupId, parsed.selfcareCaseTypeId, parsed.caseGroupCatalog)) {
      parsed.selfcareCaseTypeId = sg.caseTypes[0].id;
    }
  }
  for (const c of parsed.cases) {
    if (!c.resolutionStatus) c.resolutionStatus = "Open";
    if (!c.caseGroupId && cat0) {
      c.caseGroupId = cat0.id;
      c.caseTypeId = cat0.caseTypes[0].id;
    }
    const cg = catalogGroupById(c.caseGroupId, parsed.caseGroupCatalog);
    if (cg) {
      c.caseGroupLabel = cg.label;
      const ct = catalogTypeById(c.caseGroupId, c.caseTypeId, parsed.caseGroupCatalog) || cg.caseTypes[0];
      c.caseTypeId = ct.id;
      c.caseTypeLabel = ct.label;
      if (!c.slaPolicyLabel) c.slaPolicyLabel = ct.label;
      if (!c.slaPolicyTypeId) c.slaPolicyTypeId = ct.id;
    }
    if (!c.globalSla && cg) {
      const ct = catalogTypeById(c.caseGroupId, c.caseTypeId, parsed.caseGroupCatalog);
      if (ct) applyCaseTypeSlaToCase(c, ct);
    }
    if (!c.impact || !IMPACT_LEVELS.includes(c.impact) || !c.urgency || !URGENCY_LEVELS.includes(c.urgency)) {
      const ct = catalogTypeById(c.caseGroupId, c.caseTypeId, parsed.caseGroupCatalog);
      if (ct) {
        const { impact, urgency } = caseTypeImpactUrgency(ct);
        c.impact = impact;
        c.urgency = urgency;
      } else if (c.priority && SELFCARE_PRIORITIES.includes(c.priority)) {
        const iu = priorityToDefaultImpactUrgency(c.priority);
        c.impact = iu.impact;
        c.urgency = iu.urgency;
      } else {
        c.impact = DEFAULT_IMPACT;
        c.urgency = DEFAULT_URGENCY;
      }
    }
    if (!c.priority || !SELFCARE_PRIORITIES.includes(c.priority)) {
      c.priority = priorityFromImpactUrgency(c.impact, c.urgency, parsed.priorityMatrix);
    }
    if (!c.escalationTemplate) {
      c.escalationTemplate = cg?.escalationKey || (c.caseGroup && parsed.escalationByGroup[c.caseGroup] ? c.caseGroup : "Enterprise");
    }
    const g = parsed.escalationByGroup[c.escalationTemplate];
    const defEnt = d.escalationByGroup.Enterprise || {};
    const hierFallback = Array.isArray(defEnt.hierarchical) && defEnt.hierarchical.length ? defEnt.hierarchical : ["Agent", "Team Lead"];
    const funcFallback = Array.isArray(defEnt.functional) && defEnt.functional.length ? defEnt.functional : ["Resolution", "Closure"];
    const hierSrc = Array.isArray(g?.hierarchical) && g.hierarchical.length ? g.hierarchical : hierFallback;
    const funcSrc = Array.isArray(g?.functional) && g.functional.length ? g.functional : funcFallback;
    if (!c.hierarchicalLevels?.length) {
      c.hierarchicalLevels = [...hierSrc];
    }
    if (!c.functionalSteps?.length) {
      c.functionalSteps = [...funcSrc];
    }
    if (c.hierarchicalIndex == null) c.hierarchicalIndex = 0;
    if (c.functionalIndex == null) c.functionalIndex = 0;
    if (!c.trackProgress || Object.keys(c.trackProgress).length === 0) {
      c.trackProgress = Object.fromEntries(c.functionalSteps.map((s) => [s, 0]));
    }
    for (const step of c.functionalSteps) {
      if (c.trackProgress[step] == null) c.trackProgress[step] = 0;
    }
    if (!c.source) c.source = "agent";
    if (!c.informationSourceId) {
      applyInformationSourceToRow(c, parsed.defaultInformationSourceId, parsed.caseInformationSources);
    } else {
      const src = informationSourceById(c.informationSourceId, parsed.caseInformationSources);
      if (src) c.informationSourceLabel = src.label;
      else applyInformationSourceToRow(c, parsed.defaultInformationSourceId, parsed.caseInformationSources);
    }
    normalizeCaseNote(c);
    if (!c.teamId) c.teamId = parsed.currentUserTeamId || "team_net";
    if (!c.departmentId) c.departmentId = parsed.currentUserDeptId || "dept_ops";
    if (!c.createdByUserId && c.source !== "selfcare") {
      c.createdByUserId = c.assignedUserId || "u_agent";
    }
    if (c.source === "selfcare" && !c.createdByUserId && c.assignedUserId) {
      applyCaseCreatorToRow(c, c.assignedUserId);
    }
    if (!c.createdByName && c.createdByUserId) {
      const ag = (parsed.agents || []).find((a) => a.id === c.createdByUserId);
      c.createdByName = ag?.name || c.createdByUserId;
    }
  }
  if (parsed.route === "contact_links") parsed.route = "celebration";
  if (parsed.route === "comms") parsed.route = "communications";
  if (parsed.route === "prioritize_selfcare") parsed.route = "selfcare";
  if (parsed.route === "case_catalog") parsed.route = "case_group";
  if (parsed.route === "case_info_source") parsed.route = CASE_NEW_ROUTE;
  const navIds = new Set(allNavRouteIds());
  if (!navIds.has(parsed.route)) parsed.route = "dashboard";
  if (CASES_NAV_IDS.has(parsed.route) && parsed.casesNavOpen == null) parsed.casesNavOpen = true;
  if (SETTINGS_NAV_IDS.has(parsed.route) && parsed.settingsNavOpen == null) parsed.settingsNavOpen = true;
  if (COMMUNICATIONS_NAV_IDS.has(parsed.route) && parsed.communicationsNavOpen == null) parsed.communicationsNavOpen = true;
  if (!Array.isArray(parsed.customerEmailSelectedKeys)) parsed.customerEmailSelectedKeys = [];
  if (!Array.isArray(parsed.customerEmailGroups)) parsed.customerEmailGroups = defaultCustomerEmailGroups();
  parsed.customerEmailGroups = normalizeCustomerEmailGroups(parsed.customerEmailGroups);
  if (!parsed.customerEmailActiveGroupId) parsed.customerEmailActiveGroupId = CUSTOMER_EMAIL_SOURCE_DIRECTORY;
  if (
    parsed.customerEmailActiveGroupId !== CUSTOMER_EMAIL_SOURCE_DIRECTORY &&
    !parsed.customerEmailGroups.some((g) => g.id === parsed.customerEmailActiveGroupId)
  ) {
    parsed.customerEmailActiveGroupId = CUSTOMER_EMAIL_SOURCE_DIRECTORY;
  }
  if (!parsed.customerEmailManageGroupId || !parsed.customerEmailGroups.some((g) => g.id === parsed.customerEmailManageGroupId)) {
    parsed.customerEmailManageGroupId = parsed.customerEmailGroups[0]?.id || null;
  }
  if (!Array.isArray(parsed.escalationNotifyGroups)) parsed.escalationNotifyGroups = defaultEscalationNotifyGroups();
  if (parsed.escalationGroupsVersion !== ESCALATION_GROUPS_VERSION) {
    parsed.escalationNotifyGroups = ensureHierarchicalEscalationGroups(parsed.escalationNotifyGroups);
    parsed.escalationLevelAssignments = defaultEscalationLevelAssignments();
    parsed.escalationGroupsVersion = ESCALATION_GROUPS_VERSION;
  }
  parsed.escalationNotifyGroups = normalizeEscalationNotifyGroups(parsed.escalationNotifyGroups);
  if (!parsed.escalationLevelAssignments) parsed.escalationLevelAssignments = defaultEscalationLevelAssignments();
  parsed.escalationLevelAssignments = normalizeEscalationLevelAssignments(
    parsed.escalationLevelAssignments,
    parsed.escalationNotifyGroups
  );
  if (
    !parsed.escalationNotifyManageGroupId ||
    !parsed.escalationNotifyGroups.some((g) => g.id === parsed.escalationNotifyManageGroupId)
  ) {
    parsed.escalationNotifyManageGroupId = parsed.escalationNotifyGroups[0]?.id || null;
  }
  if (parsed.caseDashSearch == null) parsed.caseDashSearch = "";
  if (parsed.caseDashFilterStatus == null) parsed.caseDashFilterStatus = "";
  if (parsed.caseDashFilterPriority == null) parsed.caseDashFilterPriority = "";
  if (parsed.caseDashFilterCreator == null) parsed.caseDashFilterCreator = "";
  if (!parsed.caseDashSortCol) parsed.caseDashSortCol = "createdAt";
  if (!parsed.caseDashSortDir) parsed.caseDashSortDir = "desc";
  if (parsed.reportFilterUserId == null) parsed.reportFilterUserId = "";
  if (!parsed.functionalEscalationConfig) parsed.functionalEscalationConfig = defaultFunctionalEscalationConfig();
  parsed.functionalEscalationConfig = normalizeFunctionalEscalationConfig(parsed.functionalEscalationConfig);
  parsed.priorityMatrix = normalizePriorityMatrix(parsed.priorityMatrix || d.priorityMatrix);
  for (const c of parsed.cases) ensureFunctionalEscalation(c);
  assignMissingCaseIds(parsed);
  if (!Array.isArray(parsed.customerEmailTemplates) || !parsed.customerEmailTemplates.length) {
    parsed.customerEmailTemplates = defaultCustomerEmailTemplates();
  } else {
    const defaults = defaultCustomerEmailTemplates();
    for (const def of defaults) {
      if (!parsed.customerEmailTemplates.some((t) => t.id === def.id)) {
        parsed.customerEmailTemplates.push(def);
      }
    }
  }
  if (!parsed.customerEmailTemplateId) {
    parsed.customerEmailTemplateId = parsed.customerEmailTemplates[0]?.id || "cet_ack";
  }
  return parsed;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return hydrateState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

function contactDisplayName(c) {
  if (!c) return "";
  if (c.contactType === "Organization") {
    return c.branchName || c.orgName || c.primaryName || c.id;
  }
  return `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.id;
}

function resolutionBadgeClass(rs) {
  const key = String(rs || "Open")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (key.includes("awaiting")) return "awaiting";
  return key || "open";
}

function globalSlaStatus(c) {
  const g = c.globalSla;
  if (!g || typeof g.simulatedElapsedHours !== "number" || !Number.isFinite(g.simulatedElapsedHours)) {
    return { label: "No SLA data", cls: "ontrack", phase: "unknown" };
  }
  const pause = typeof g.pauseHours === "number" && Number.isFinite(g.pauseHours) ? g.pauseHours : 0;
  const effective = g.simulatedElapsedHours + pause;
  const due = typeof g.durationHours === "number" && Number.isFinite(g.durationHours) && g.durationHours > 0 ? g.durationHours : null;
  if (due == null) {
    return { label: "SLA window not configured", cls: "ontrack", phase: "unknown" };
  }
  const overdueOff = typeof g.overdueOffsetHours === "number" && Number.isFinite(g.overdueOffsetHours) ? g.overdueOffsetHours : 0;
  const overdueLine = due + overdueOff;
  if (c.resolutionStatus === "Close") {
    return { label: "Case closed (resolution)", cls: "ontrack", phase: "complete" };
  }
  if (effective > overdueLine) return { label: "Overdue (governance)", cls: "overdue", phase: "overdue" };
  if (effective > due) return { label: "Breached", cls: "breached", phase: "breached" };
  const pct = Math.min(100, Math.round((effective / due) * 100));
  return { label: `On track (${pct}% of global window)`, cls: "ontrack", phase: "ontrack", pct };
}

function caseVisibleForRole(c) {
  const auth = getLoggedInUser();
  if (auth) {
    if (auth.role === "hcce_coordinator") return c.source === "selfcare";
    if (auth.role === "supervisor" || auth.role === "case_agent") return true;
  }
  const r = state.role;
  if (r === "executive") return true;
  if (r === "hod") return c.departmentId === state.currentUserDeptId;
  if (r === "team_lead") return c.teamId === state.currentUserTeamId;
  if (!c.assignedUserId) return c.teamId === state.currentUserTeamId;
  return c.assignedUserId === state.currentUserId;
}

function customerById(id) {
  return state.customers.find((x) => x.id === id);
}

function branchById(id) {
  return state.branches.find((x) => x.id === id);
}

function contactById(id) {
  return state.contacts.find((x) => x.id === id);
}

function initSidebar() {
  const app = document.getElementById("appRoot");
  const setCollapsed = (v) => {
    localStorage.setItem(SIDEBAR_KEY, v ? "1" : "0");
    app.classList.toggle("sidebar-collapsed", v);
  };
  setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
  document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    setCollapsed(!app.classList.contains("sidebar-collapsed"));
  });
  document.getElementById("sidebarClose")?.addEventListener("click", () => setCollapsed(true));
  document.getElementById("sidebarFab")?.addEventListener("click", () => setCollapsed(false));
}

function navItemsForUser() {
  const auth = getLoggedInUser();
  return NAV.filter((n) => !(auth?.role === "case_agent" && n.id === "selfcare"));
}

function renderNav() {
  const nav = document.getElementById("nav");
  const navItems = navItemsForUser();
  const routeActive = state.detailCaseId ? "cases" : state.route || "dashboard";

  const html = navItems
    .map((n) => {
      if (n.children?.length) {
        const isOpen = navGroupIsOpen(n.id, routeActive);
        const parentActive = n.children.some((c) => c.id === routeActive);
        const subButtons = n.children
          .map(
            (c) =>
              `<button type="button" data-route="${c.id}" class="nav-item nav-sub-item ${routeActive === c.id ? "active" : ""}">${escapeHtml(c.label)}</button>`
          )
          .join("");
        return `
    <div class="nav-group ${isOpen ? "is-open" : ""}" data-nav-group="${escapeHtml(n.id)}">
      <div class="nav-group-head">
        <button type="button" class="nav-item nav-parent nav-settings-parent ${parentActive ? "nav-parent-active" : ""}" data-nav-parent="${escapeHtml(n.id)}" aria-expanded="${isOpen ? "true" : "false"}">${navItemLabelHtml(n)}</button>
        <button type="button" class="nav-chevron" data-nav-toggle="${escapeHtml(n.id)}" aria-expanded="${isOpen ? "true" : "false"}" aria-label="Toggle ${escapeHtml(n.label)} menu" title="Toggle submenu">▾</button>
      </div>
      <div class="nav-sub" role="group" aria-label="${escapeHtml(n.label)} submenu">${subButtons}</div>
    </div>`;
      }
      const active =
        routeActive === n.id || (n.id === "cases" && (routeActive === CASE_NEW_ROUTE || !!state.detailCaseId));
      return `<button type="button" data-route="${n.id}" class="nav-item ${active ? "active" : ""}">${navItemLabelHtml(n)}</button>`;
    })
    .join("");

  nav.innerHTML = html;

  nav.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.route = btn.dataset.route;
      state.detailCaseId = null;
      if (SETTINGS_NAV_IDS.has(state.route)) state.settingsNavOpen = true;
      if (COMMUNICATIONS_NAV_IDS.has(state.route)) state.communicationsNavOpen = true;
      saveState();
      render();
    });
  });
  nav.querySelectorAll("[data-nav-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const groupId = btn.dataset.navToggle;
      if (NAV_GROUP_CONFIG[groupId]) {
        toggleNavGroup(groupId, routeActive);
        saveState();
        renderNav();
      }
    });
  });
  nav.querySelectorAll("[data-nav-parent]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const groupId = btn.dataset.navParent;
      if (NAV_GROUP_CONFIG[groupId]) {
        toggleNavGroup(groupId, routeActive);
        saveState();
        renderNav();
      }
    });
  });
}

function renderRole() {
  const auth = getLoggedInUser();
  const authPill = document.getElementById("authPill");
  const rolePill = document.getElementById("rolePill");
  const nameEl = document.getElementById("sidebarUserName");
  const labelEl = document.getElementById("sidebarUserLabel");
  if (auth) {
    if (rolePill) rolePill.hidden = true;
    if (authPill) {
      authPill.hidden = false;
      authPill.textContent =
        auth.role === "supervisor"
          ? `${auth.name} · Supervisor`
          : auth.role === "hcce_coordinator"
            ? `${auth.name} · HCCE`
            : `${auth.name} · Agent`;
    }
    if (nameEl) nameEl.textContent = auth.name;
    if (labelEl) {
      labelEl.textContent =
        auth.role === "supervisor"
          ? "Supervisor (all cases for review)"
          : auth.role === "hcce_coordinator"
            ? "HCCE (Selfcare queue)"
            : "Agent (all cases for review)";
    }
    return;
  }
  if (authPill) authPill.hidden = true;
  if (rolePill) {
    rolePill.hidden = false;
    rolePill.textContent = "Not signed in";
  }
}

function statCards() {
  const cases = state.cases.filter(caseVisibleForRole);
  let breached = 0;
  let overdue = 0;
  for (const c of cases) {
    const s = globalSlaStatus(c);
    if (s.phase === "breached") breached++;
    if (s.phase === "overdue") overdue++;
  }
  const openCases = cases.filter((c) => c.resolutionStatus !== "Close").length;
  const escH = cases.filter((c) => (c.hierarchicalIndex || 0) > 0).length;
  const escF = cases.filter((c) => (c.functionalIndex || 0) > 0).length;
  const selfcareN = state.cases.filter((c) => c.source === "selfcare").length;
  const commN = (state.communications || []).length;
  const loyN = (state.loyaltyBeneficiaries || []).length;
  const custN = (state.customers || []).length;
  const brN = (state.branches || []).length;
  const ctN = (state.contacts || []).length;
  const tmplN = Object.keys(state.escalationByGroup || {}).length;
  const catG = (state.caseGroupCatalog || []).length;
  const catT = (state.caseGroupCatalog || []).reduce((n, g) => n + (g.caseTypes?.length || 0), 0);
  const brPer = custN ? Math.round(brN / custN) : 0;
  return `
    <div class="card dashboard-banner">
      <p class="dashboard-banner-text"><strong>Prototype snapshot</strong> — this build ships with <strong>${custN}</strong> demo customers, <strong>${brN}</strong> branch rows (${brPer} per customer), and <strong>${state.cases.length}</strong> seeded cases. Case catalog: <strong>${catG}</strong> groups, <strong>${catT}</strong> case types (configurable). Selfcare: customer dropdown, multi-location, support <strong>${escapeHtml(SELFCARE_SUPPORT_EMAIL)}</strong>; persistence is <code class="mono-tag">${STORAGE_KEY}</code>. Use <strong>Reset demo data</strong> to restore fixtures.</p>
    </div>
    <div class="grid cols-4">
      <div class="card"><h3>Open cases (your scope)</h3><div class="stat-value">${openCases}</div><div class="stat-sub">Resolution ≠ Close</div></div>
      <div class="card"><h3>Global SLA breached</h3><div class="stat-value">${breached}</div><div class="stat-sub">Governance timer</div></div>
      <div class="card"><h3>Global SLA overdue</h3><div class="stat-value">${overdue}</div><div class="stat-sub">Past overdue offset</div></div>
      <div class="card"><h3>Escalation activity</h3><div class="stat-value">${escH + escF}</div><div class="stat-sub">${escH} hierarchical · ${escF} functional steps moved</div></div>
    </div>
    <div class="grid cols-4" style="margin-top:1rem">
      <div class="card"><h3>Selfcare cases</h3><div class="stat-value">${selfcareN}</div><div class="stat-sub">Raised from customer portal</div></div>
      <div class="card"><h3>Communications</h3><div class="stat-value">${commN}</div><div class="stat-sub">Logged across channels</div></div>
      <div class="card"><h3>Loyalty members</h3><div class="stat-value">${loyN}</div><div class="stat-sub">Active beneficiaries</div></div>
      <div class="card"><h3>Rep–branch links</h3><div class="stat-value">${(state.repBranchLinks || []).length}</div><div class="stat-sub">Celebration hub</div></div>
    </div>
    <div class="grid cols-4" style="margin-top:1rem">
      <div class="card"><h3>Customers</h3><div class="stat-value">${custN}</div><div class="stat-sub">Master accounts (demo)</div></div>
      <div class="card"><h3>Branches</h3><div class="stat-value">${brN}</div><div class="stat-sub">Customer locations</div></div>
      <div class="card"><h3>Contacts</h3><div class="stat-value">${ctN}</div><div class="stat-sub">HQ + site directory</div></div>
      <div class="card"><h3>Case catalog</h3><div class="stat-value">${catG} / ${catT}</div><div class="stat-sub">Groups / types · ${tmplN} escalation ladder(s)</div></div>
    </div>
    <div class="two-col" style="margin-top:1rem">
      <div class="card">
        <h3>Recent notifications</h3>
        <ul class="muted" style="margin:0;padding-left:1.1rem;font-size:0.9rem">
          ${state.notifications
            .slice(-6)
            .reverse()
            .map((n) => `<li>${escapeHtml(n.text)} <span class="muted">— ${formatDateTime(n.at)}</span></li>`)
            .join("") || "<li>No notifications yet.</li>"}
        </ul>
      </div>
      <div class="card">
        <h3>Escalation model</h3>
        <p class="muted" style="margin:0 0 0.75rem;font-size:0.9rem"><strong>Hierarchical</strong> paths are configurable per <strong>case group</strong> (management chain). <strong>Functional</strong> paths are separate operational steps, also per group.</p>
        <div class="escalation-tree">Per case (snapshot at creation):
├── hierarchicalLevels[] + hierarchicalIndex
└── functionalSteps[] + functionalIndex + track progress</div>
      </div>
    </div>`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function branchSelectOptionsHtml(customerId, selectedBranchId) {
  const brs = state.branches.filter((b) => b.customerId === customerId);
  const cur = selectedBranchId == null || selectedBranchId === "" ? "__hq__" : selectedBranchId;
  const sel = (id) => (id === cur ? "selected" : "");
  const opts = [
    `<option value="__hq__" ${sel("__hq__")}>HQ / Parent (no branch)</option>`,
    ...brs.map((b) => `<option value="${b.id}" ${sel(b.id)}>${escapeHtml(b.name)}</option>`),
  ];
  return opts.join("");
}

function branchMultiSelectOptionsHtml(customerId, selectedTokens) {
  const set = new Set(Array.isArray(selectedTokens) ? selectedTokens : selectedTokens ? [String(selectedTokens)] : []);
  if (!set.size) set.add("__hq__");
  const brs = state.branches.filter((b) => b.customerId === customerId);
  const sel = (id) => (set.has(id) ? "selected" : "");
  return [
    `<option value="__hq__" ${sel("__hq__")}>HQ / Parent (no branch)</option>`,
    ...brs.map((b) => `<option value="${b.id}" ${sel(b.id)}>${escapeHtml(b.name)}</option>`),
  ].join("");
}

function branchCheckboxListHtml(customerId, selectedTokens) {
  const tokens = normalizeBranchTokenArray(customerId, selectedTokens, state.branches);
  const set = new Set(tokens);
  const brs = state.branches.filter((b) => b.customerId === customerId);
  const items = [{ id: "__hq__", label: "HQ / Parent (no branch)" }, ...brs.map((b) => ({ id: b.id, label: b.name }))];
  return items
    .map(
      (item) => `<label class="sc-loc-chk">
        <input type="checkbox" class="sc-loc-cb" data-sc-cust="${escapeHtml(customerId)}" value="${escapeHtml(item.id)}" ${set.has(item.id) ? "checked" : ""} />
        <span>${escapeHtml(item.label)}</span>
      </label>`
    )
    .join("");
}

function selfcareCaseCountPreviewText(customerId, tokens) {
  if (!customerId) return "Select a customer, then register one or more locations.";
  const normalized = normalizeBranchTokenArray(customerId, tokens, state.branches, true);
  if (!normalized.length) return "Register at least one location to create cases.";
  if (normalized.length === 1) return "1 location registered — 1 case will be created.";
  return `${normalized.length} locations registered — ${normalized.length} cases will be created (one per location).`;
}

function normalizeBranchTokenArray(customerId, raw, branchesList, allowEmpty = false) {
  const bl = branchesList || state.branches || [];
  let arr = Array.isArray(raw) ? raw.map(String) : raw == null || raw === "" ? [] : [String(raw)];
  arr = [...new Set(arr)].filter((t) => t === "__hq__" || bl.some((b) => b.id === t && b.customerId === customerId));
  if (!arr.length && !allowEmpty) arr = ["__hq__"];
  return arr;
}

function branchLocationLabel(customerId, token, branchesList) {
  if (token === "__hq__") return "HQ / Parent (no branch)";
  const br = (branchesList || state.branches || []).find((b) => b.id === token && b.customerId === customerId);
  return br?.name || token;
}

function branchLocationPickOptionsHtml(customerId, registeredTokens) {
  const registered = new Set(normalizeBranchTokenArray(customerId, registeredTokens, state.branches, true));
  const branchIds = (state.branches || []).filter((b) => b.customerId === customerId).map((b) => b.id);
  const allCandidates = ["__hq__", ...branchIds];
  const available = allCandidates.filter((t) => !registered.has(t));
  const opts = available.map(
    (t) => `<option value="${escapeHtml(t)}">${escapeHtml(branchLocationLabel(customerId, t))}</option>`
  );
  return `<option value="">— Select location to add —</option>${opts.join("")}`;
}

function selfcareRegisteredLocationsHtml(customerId, tokens) {
  const normalized = normalizeBranchTokenArray(customerId, tokens, state.branches, true);
  if (!normalized.length) {
    return `<li class="sc-loc-reg-empty muted">No locations registered — pick a site from the dropdown and click <strong>Add location</strong>.</li>`;
  }
  return normalized
    .map(
      (t) => `<li class="sc-loc-reg-item">
        <span class="sc-loc-reg-label">${escapeHtml(branchLocationLabel(customerId, t))}</span>
        <button type="button" class="link sm" data-sc-loc-rm="${escapeHtml(customerId)}" data-sc-loc-token="${escapeHtml(t)}">Remove</button>
      </li>`
    )
    .join("");
}

/** Normalise Selfcare per-customer branch multi-select (HQ token and/or branch ids for that customer). Migrates legacy single-value map. */
function hydrateSelfcareBranchesMap(parsed) {
  const custIds = new Set((parsed.customers || []).map((c) => c.id));
  const branchesList = parsed.branches || [];
  const legacy = parsed.selfcareBranchByCustomerId;
  let m = parsed.selfcareBranchesByCustomerId;
  if (!m || typeof m !== "object" || Array.isArray(m)) m = {};
  const out = { ...m };
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    for (const [k, v] of Object.entries(legacy)) {
      if (k in out) continue;
      out[k] = normalizeBranchTokenArray(k, Array.isArray(v) ? v : [v], branchesList);
    }
  }
  for (const k of Object.keys(out)) {
    if (!custIds.has(k)) delete out[k];
  }
  for (const cid of parsed.selfcareCustomerIds || []) {
    out[cid] = normalizeBranchTokenArray(cid, out[cid], branchesList);
  }
  parsed.selfcareBranchesByCustomerId = out;
  delete parsed.selfcareBranchByCustomerId;
}

function syncSelfcareBranchesMapForCustomerIds(customerIds) {
  const m = { ...(state.selfcareBranchesByCustomerId || {}) };
  for (const k of Object.keys(m)) {
    if (!customerIds.includes(k)) delete m[k];
  }
  for (const cid of customerIds) {
    m[cid] = normalizeBranchTokenArray(cid, m[cid] == null ? [] : m[cid], state.branches, true);
  }
  state.selfcareBranchesByCustomerId = m;
}

function viewSelfcare() {
  if (!state.customers?.length) {
    return `<p class="muted">No customers configured. Load demo data or add customers in a full deployment.</p>`;
  }
  const currentId = (state.selfcareCustomerIds || [])[0] || "";
  const custOpts = [
    `<option value="" ${!currentId ? "selected" : ""}>— Select customer —</option>`,
    ...state.customers.map(
      (k) => `<option value="${escapeHtml(k.id)}" ${currentId === k.id ? "selected" : ""}>${escapeHtml(k.name)}</option>`
    ),
  ].join("");
  const selected = currentId ? state.customers.filter((k) => k.id === currentId) : [];
  const bMap = state.selfcareBranchesByCustomerId || {};
  const locHint = !currentId
    ? `<p class="muted" style="margin:0 0 0.35rem;font-size:0.82rem">Choose a customer, then use the <strong>location dropdown</strong> to register sites for multi-case creation.</p>`
    : `<p class="muted" style="margin:0 0 0.35rem;font-size:0.82rem"><strong>Multi-case:</strong> add each location to the registered list below. One case is created per registered location.</p>`;
  const registeredTokens = currentId ? normalizeBranchTokenArray(currentId, bMap[currentId], state.branches, true) : [];
  const regCount = registeredTokens.length;
  const branchRows =
    selected.length === 0
      ? ""
      : selected
          .map((k) => {
            const tokens = normalizeBranchTokenArray(k.id, bMap[k.id], state.branches, true);
            const registered = new Set(tokens);
            const branchIds = (state.branches || []).filter((b) => b.customerId === k.id).map((b) => b.id);
            const availableCount = ["__hq__", ...branchIds].filter((t) => !registered.has(t)).length;
            const pickOpts = branchLocationPickOptionsHtml(k.id, tokens);
            const regList = selfcareRegisteredLocationsHtml(k.id, tokens);
            const count = tokens.length;
            return `<div class="sc-br-row" data-sc-cust="${escapeHtml(k.id)}">
          <div class="sc-br-row-label">${escapeHtml(k.name)}</div>
          <div class="sc-loc-picker">
            <div class="field-row sc-loc-add-row">
              <div class="field" style="flex:1;margin:0">
                <label for="sc_loc_pick">Location dropdown</label>
                <select id="sc_loc_pick" class="field" aria-label="Select location to register" ${availableCount ? "" : "disabled"}>${pickOpts}</select>
              </div>
              <button type="button" class="btn sm" id="sc_loc_add" ${availableCount ? "" : "disabled"}>Add location</button>
            </div>
            <div class="sc-loc-registered-box" aria-live="polite">
              <div class="sc-loc-registered-head">
                <strong>Registered locations</strong>
                <span class="sc-loc-count-badge" id="sc_loc_count">${count} location${count === 1 ? "" : "s"}</span>
              </div>
              <ul id="sc_loc_registered" class="sc-loc-registered-list">${regList}</ul>
              <div class="toolbar sc-loc-toolbar" style="margin:0.5rem 0 0">
                <button type="button" class="btn sm ghost" id="sc_clear_registered" ${!count ? "disabled" : ""}>Clear all</button>
              </div>
            </div>
          </div>
        </div>`;
          })
          .join("");
  const casePreview = selfcareCaseCountPreviewText(currentId, registeredTokens);
  const scGrp = state.selfcareCaseGroupId || state.caseGroupCatalog[0]?.id || "";
  const scTyp = state.selfcareCaseTypeId || catalogGroupById(scGrp)?.caseTypes[0]?.id || "";
  const scTypeDef = catalogTypeById(scGrp, scTyp);
  const scGroupDef = catalogGroupById(scGrp);
  const scPolicyPreview = scTypeDef ? caseTypePolicySummary(scTypeDef) : "—";
  const groupOpts = caseGroupSelectHtml(scGrp);
  const typeOpts = caseTypeSelectHtml(scGrp, scTyp);
  const catOptsSc = CASE_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${c === "Request" ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  const infoSrcOpts = informationSourceSelectHtml(SELFCARE_CONTACT_SOURCE_ID);
  const mailto = `mailto:${SELFCARE_SUPPORT_EMAIL}`;
  return `
    <div class="card selfcare-hero">
      <div class="selfcare-icon" aria-hidden="true">🛟</div>
      <div>
        <h3 style="margin:0 0 0.35rem">Customer selfcare</h3>
        <p class="muted" style="margin:0;font-size:0.95rem">Raise one or more service cases for a single customer by choosing <strong>multiple locations</strong>. Submissions appear in <strong>Cases</strong> with source <span class="badge open">Selfcare</span>.</p>
        <p class="sc-support-email" style="margin:0.75rem 0 0;font-size:0.9rem">
          <strong>Email support</strong>
          <a class="link" href="${mailto}">${escapeHtml(SELFCARE_SUPPORT_EMAIL)}</a>
          <span class="muted" style="font-size:0.82rem"> — direct enquiries and follow-up here.</span>
        </p>
      </div>
    </div>
    <div class="card" style="margin-top:1rem;max-width:640px">
      <div class="field"><label for="sc_customer">Customer *</label>
        <p class="muted" style="margin:0 0 0.5rem;font-size:0.85rem">Pick the account you are reporting for.</p>
        <select id="sc_customer" class="field" aria-label="Customer">${custOpts}</select>
      </div>
      <div class="field-row">
        <div class="field"><label>State *</label><select class="field" id="sc_nigeria_state">${nigeriaStateSelectHtml("")}</select></div>
        <div class="field"><label>Local government area *</label><select class="field" id="sc_nigeria_lga">${nigeriaLgaSelectHtml("", "")}</select></div>
      </div>
      <div class="field"><label>Case title *</label><input class="input" id="sc_title" placeholder="Brief summary" /></div>
      <div class="field"><label>Category</label>
        <select class="field" id="sc_type">${catOptsSc}</select>
      </div>
      <div class="field"><label>Source of Contact *</label>
        <select class="field" id="sc_info_source">${infoSrcOpts}</select>
        <p class="muted" style="margin:0.35rem 0 0;font-size:0.82rem">Selfcare cases default to <strong>Selfcare</strong> as the source of contact.</p>
      </div>
      <div class="field-row">
        <div class="field"><label>Case group *</label>
          <select class="field" id="sc_case_group">${groupOpts}</select>
        </div>
        <div class="field"><label>Case type *</label>
          <select class="field" id="sc_case_type">${typeOpts}</select>
        </div>
      </div>
      <p class="muted" style="margin:0 0 0.5rem;font-size:0.82rem">Case <strong>type</strong> is a child of the selected <strong>case group</strong>. Impact, urgency, and resolution SLA come from the configured case type; priority is derived from the Impact × Urgency matrix.</p>
      <p class="sc-sla-preview" id="sc_sla_preview">Policy for selected type: <strong>${escapeHtml(scPolicyPreview)}</strong> (applied when the case is created)</p>
      <div class="field"><label>Locations *</label>
        ${locHint}
        <div id="sc_branch_rows" class="sc-branch-rows">${branchRows || `<p class="muted" style="margin:0.35rem 0 0;font-size:0.85rem">Select a customer to register locations.</p>`}</div>
        <p class="sc-case-preview" id="sc_case_preview" style="margin:0.65rem 0 0;font-size:0.88rem;font-weight:600">${escapeHtml(casePreview)}</p>
      </div>
      <div class="field"><label>Describe the issue *</label><textarea class="textarea" id="sc_desc" placeholder="What should we help with?"></textarea></div>
      <div class="toolbar" style="margin-bottom:0">
        <button type="button" class="btn" id="sc_submit">Submit case(s)</button>
      </div>
    </div>`;
}

function viewCelebration() {
  if (!state.customers?.length) {
    return `<p class="muted">No customers to display.</p>`;
  }
  const repOpts = (cid) => {
    const prim = customerById(cid)?.primaryRepresentativeContactId ?? "";
    const head = `<option value="" ${!prim ? "selected" : ""}>— Select representative —</option>`;
    const rest = state.contacts
      .map((ct) => `<option value="${ct.id}" ${prim && prim === ct.id ? "selected" : ""}>${escapeHtml(contactDisplayName(ct))}</option>`)
      .join("");
    return head + rest;
  };
  const gala = state.customers
    .map((k) => {
      const links = state.repBranchLinks.filter((r) => r.customerId === k.id).length;
      return `<div class="gala-card card">
        <div class="gala-icon" aria-hidden="true">🎉</div>
        <h4 style="margin:0 0 0.35rem">${escapeHtml(k.name)}</h4>
        <p class="muted" style="margin:0 0 0.65rem;font-size:0.85rem">${escapeHtml(k.segment)} · ${links} rep–branch link(s)</p>
        <div class="field"><label>Primary representative</label>
          <select class="field cel-prim-rep" data-customer-id="${k.id}">${repOpts(k.id)}</select>
        </div>
      </div>`;
    })
    .join("");
  return `
    <div class="celebration-hero card">
      <span class="celebration-burst" aria-hidden="true">✨</span>
      <div>
        <h2 style="margin:0 0 0.35rem;font-size:1.35rem">Celebration hub</h2>
        <p class="muted" style="margin:0;font-size:0.95rem">Configure <strong>every customer</strong> and their <strong>representatives</strong>. Primary rep is the account anchor; detailed <strong>branch links</strong> are managed below.</p>
      </div>
      <span class="celebration-burst" aria-hidden="true">⭐</span>
    </div>
    <div class="gala-grid">${gala}</div>
    <h3 class="muted" style="margin:1.5rem 0 0.75rem;font-size:0.9rem;text-transform:uppercase;letter-spacing:0.06em">Representative ↔ branch links</h3>
    ${viewContactLinks()}`;
}

function viewLoyaltyStandards() {
  const rows = state.loyaltyStandards
    .map(
      (s) => `<tr>
      <td>${escapeHtml(s.code)}</td>
      <td>${escapeHtml(s.title)}</td>
      <td class="muted" style="font-size:0.88rem">${escapeHtml(s.description)}</td>
      <td><button type="button" class="link sm" data-del-std="${s.id}">Remove</button></td>
    </tr>`
    )
    .join("");
  return `
    <div class="card">
      <p class="muted" style="margin-top:0">Programme standards (policy layer). Add or remove rows; these labels surface on schemes and awards.</p>
      <div class="toolbar">
        <button type="button" class="btn sm" id="btnAddStandard">+ Add standard</button>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Code</th><th>Title</th><th>Description</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="muted">No standards yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function viewLoyaltySchemes() {
  const rows = state.loyaltySchemes
    .map(
      (s) => `<tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.standardRef || "—")}</td>
      <td class="muted" style="font-size:0.85rem">${escapeHtml(s.accrualRule || "")}</td>
      <td>${s.expiryMonths ?? "—"}</td>
      <td><span class="badge ${s.active ? "open" : "closed"}">${s.active ? "Active" : "Paused"}</span></td>
      <td><button type="button" class="link sm" data-toggle-scheme="${s.id}">Toggle</button>
          <button type="button" class="link sm" data-del-scheme="${s.id}">Remove</button></td>
    </tr>`
    )
    .join("");
  return `
    <div class="card">
      <p class="muted" style="margin-top:0">Schemes define earning logic and tie to standards references.</p>
      <div class="toolbar">
        <button type="button" class="btn sm" id="btnAddScheme">+ Add scheme</button>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Name</th><th>Standard ref</th><th>Accrual rule</th><th>Expiry (mo)</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="muted">No schemes.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function viewLoyaltyBeneficiaries() {
  const rows = state.loyaltyBeneficiaries
    .map((b) => {
      const cust = customerById(b.customerId);
      const sch = state.loyaltySchemes.find((x) => x.id === b.schemeId);
      return `<tr>
        <td>${escapeHtml(sch?.name || b.schemeId)}</td>
        <td>${escapeHtml(cust?.name || b.customerId)}</td>
        <td>${escapeHtml(b.tier || "—")}</td>
        <td>${b.pointsBalance ?? 0}</td>
        <td><span class="badge open">${escapeHtml(b.status || "Active")}</span></td>
        <td><button type="button" class="link sm" data-del-ben="${b.id}">Remove</button></td>
      </tr>`;
    })
    .join("");
  return `
    <div class="card">
      <p class="muted" style="margin-top:0">Beneficiaries enrol customers onto a scheme with tier and points.</p>
      <div class="toolbar">
        <button type="button" class="btn sm" id="btnAddBeneficiary">+ Add beneficiary</button>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Scheme</th><th>Customer</th><th>Tier</th><th>Points</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="muted">No beneficiaries.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function viewLoyaltyAwards() {
  const rows = state.loyaltyAwards
    .map((a) => {
      const sch = state.loyaltySchemes.find((x) => x.id === a.schemeId);
      return `<tr>
        <td>${escapeHtml(sch?.name || a.schemeId)}</td>
        <td>${escapeHtml(a.name)}</td>
        <td>${a.pointsCost ?? 0}</td>
        <td class="muted" style="font-size:0.85rem">${escapeHtml(a.description || "")}</td>
        <td><span class="badge ${a.active ? "open" : "closed"}">${a.active ? "Listed" : "Hidden"}</span></td>
        <td><button type="button" class="link sm" data-toggle-award="${a.id}">Toggle</button>
            <button type="button" class="link sm" data-del-award="${a.id}">Remove</button></td>
      </tr>`;
    })
    .join("");
  return `
    <div class="card">
      <p class="muted" style="margin-top:0">Awards are redeemable catalogue items per scheme (points cost configurable).</p>
      <div class="toolbar">
        <button type="button" class="btn sm" id="btnAddAward">+ Add award</button>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Scheme</th><th>Award</th><th>Points</th><th>Description</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="muted">No awards.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function viewLoyalty() {
  const tab = state.loyaltyTab || "standards";
  const tabs = LOYALTY_TABS.map(
    (t) =>
      `<button type="button" class="loy-tab ${tab === t.id ? "active" : ""}" data-loy-tab="${t.id}">${t.label}</button>`
  ).join("");
  let body = "";
  if (tab === "standards") body = viewLoyaltyStandards();
  else if (tab === "schemes") body = viewLoyaltySchemes();
  else if (tab === "beneficiaries") body = viewLoyaltyBeneficiaries();
  else if (tab === "awards") body = viewLoyaltyAwards();
  return `<div class="loy-tabs">${tabs}</div>${body}`;
}

function commChannelBadgeClass(ch) {
  const k = String(ch || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return k || "email";
}

function viewCommunicationsHub() {
  const chOpts = [`<option value="">All channels</option>`, ...COMM_CHANNELS.map((c) => `<option value="${escapeHtml(c)}" ${state.commFilterChannel === c ? "selected" : ""}>${escapeHtml(c)}</option>`)].join(
    ""
  );
  const ctOpts = [
    `<option value="">All contacts</option>`,
    ...state.contacts.map((c) => `<option value="${c.id}" ${state.commFilterContact === c.id ? "selected" : ""}>${escapeHtml(contactDisplayName(c))}</option>`),
  ].join("");
  let list = [...(state.communications || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  if (state.commFilterContact) list = list.filter((x) => x.contactId === state.commFilterContact);
  if (state.commFilterChannel) list = list.filter((x) => x.channel === state.commFilterChannel);
  const rows = list
    .map((m) => {
      const co = contactById(m.contactId);
      const prev = escapeHtml((m.body || "").slice(0, 80)) + ((m.body || "").length > 80 ? "…" : "");
      const meet = m.meetingUrl ? `<a class="link" href="${escapeHtml(m.meetingUrl)}" target="_blank" rel="noopener">Join link</a>` : "—";
      return `<tr>
        <td><span class="muted" style="font-size:0.8rem">${formatDateTime(m.at)}</span></td>
        <td>${escapeHtml(co ? contactDisplayName(co) : m.contactId)}</td>
        <td><span class="chan-badge chan-${commChannelBadgeClass(m.channel)}">${escapeHtml(m.channel)}</span></td>
        <td><span class="badge ${m.direction === "in" ? "pending" : "open"}">${m.direction === "in" ? "In" : "Out"}</span></td>
        <td><strong>${escapeHtml(m.subject || "(no subject)")}</strong><div class="muted" style="font-size:0.85rem;margin-top:0.2rem">${prev}</div></td>
        <td>${meet}</td>
      </tr>`;
    })
    .join("");
  return `
    <p class="muted" style="margin-top:0">Reach any configured <strong>contact</strong> across channels: email, chat, virtual meeting, phone, SMS/text, WhatsApp, and social.</p>
    <div class="toolbar">
      <div class="field" style="min-width:200px;margin:0"><label class="muted">Contact</label>
        <select class="field" id="comm_f_ct">${ctOpts}</select></div>
      <div class="field" style="min-width:180px;margin:0"><label class="muted">Channel</label>
        <select class="field" id="comm_f_ch">${chOpts}</select></div>
      <button type="button" class="btn sm" id="comm_apply_filter">Apply filters</button>
      <button type="button" class="btn" id="btnNewComm">+ New communication</button>
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>When</th><th>Contact</th><th>Channel</th><th>Dir</th><th>Subject / message</th><th>Meeting</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="muted">No messages match filters.</td></tr>`}</tbody>
      </table>
    </div>`;
}

function viewCustomerEmail() {
  const templates = state.customerEmailTemplates || defaultCustomerEmailTemplates();
  const selectedId = state.customerEmailTemplateId || templates[0]?.id;
  const tpl = templates.find((t) => t.id === selectedId) || templates[0];
  const groups = state.customerEmailGroups || [];
  const activeSource = customerEmailActiveSource();
  const recipients = customerEmailRecipientsForActiveSource();
  const selectedSet = customerEmailSelectedSet(recipients);
  const selectedCount = recipients.filter((r) => selectedSet.has(r.key)).length;
  const manageGroupId = state.customerEmailManageGroupId || groups[0]?.id || null;
  const manageGroup = manageGroupId ? customerEmailGroupById(manageGroupId) : null;

  const tplOpts = templates
    .map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === tpl?.id ? "selected" : ""}>${escapeHtml(t.label)}</option>`)
    .join("");

  const sourceOpts = [
    `<option value="${CUSTOMER_EMAIL_SOURCE_DIRECTORY}" ${activeSource === CUSTOMER_EMAIL_SOURCE_DIRECTORY ? "selected" : ""}>All CRM contacts (directory)</option>`,
    ...groups.map(
      (g) =>
        `<option value="${escapeHtml(g.id)}" ${activeSource === g.id ? "selected" : ""}>${escapeHtml(g.label)} (${(g.members || []).length})</option>`
    ),
  ].join("");

  const previewRecipient = recipients.find((r) => selectedSet.has(r.key)) ||
    recipients[0] || {
      customerName: "Sample Customer",
      contactName: "Primary contact",
      email: "contact@example.com",
    };
  const preview = tpl ? applyCustomerEmailTemplate(tpl, previewRecipient) : { subject: "", body: "" };
  const allChecked = recipients.length > 0 && selectedCount === recipients.length;

  const recipientRows = recipients
    .map(
      (r) => `<tr class="ce-recipient-row" data-ce-key="${escapeHtml(r.key)}">
        <td><label class="ce-recipient-chk"><input type="checkbox" class="ce_recipient_cb" value="${escapeHtml(r.key)}" ${selectedSet.has(r.key) ? "checked" : ""} /><span class="sr-only">Select ${escapeHtml(r.contactName)}</span></label></td>
        <td>${escapeHtml(r.customerName)}</td>
        <td>${escapeHtml(r.contactName)}</td>
        <td><a class="link" href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a></td>
      </tr>`
    )
    .join("");

  const groupList = groups
    .map(
      (g) => `<li class="ce-group-item ${g.id === manageGroupId ? "active" : ""}">
        <button type="button" class="ce-group-pick link" data-ceg-pick="${escapeHtml(g.id)}">${escapeHtml(g.label)}</button>
        <span class="muted">${(g.members || []).length} member(s)</span>
        <button type="button" class="link sm" data-ceg-use="${escapeHtml(g.id)}">Use for send</button>
        <button type="button" class="link sm" data-ceg-del="${escapeHtml(g.id)}">Delete</button>
      </li>`
    )
    .join("");

  const memberRows = (manageGroup?.members || [])
    .map(
      (m) => `<tr>
        <td>${escapeHtml(m.customerName)}</td>
        <td>${escapeHtml(m.contactName || "—")}</td>
        <td><a class="link" href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a></td>
        <td><button type="button" class="link sm" data-ceg-rm="${escapeHtml(manageGroup.id)}" data-ceg-member="${escapeHtml(m.id)}">Remove</button></td>
      </tr>`
    )
    .join("");

  const custPickOpts = [
    `<option value="">— Enter manually or pick customer —</option>`,
    ...(state.customers || []).map(
      (c) => `<option value="${escapeHtml(c.id)}" ${manageGroupId ? "" : ""}>${escapeHtml(c.name)}</option>`
    ),
  ].join("");

  const sourceLabel =
    activeSource === CUSTOMER_EMAIL_SOURCE_DIRECTORY
      ? "CRM directory"
      : customerEmailGroupById(activeSource)?.label || "Group";

  return `
    <p class="muted" style="margin-top:0">Create <strong>customer email groups</strong> for bulk communication, add customers with their email addresses, then send using a group or the full CRM contact directory.</p>

    <div class="two-col ce-groups-layout">
      <div class="card">
        <h3 style="margin-top:0">Email groups</h3>
        <p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem">Build lists of customers and emails for recurring bulk sends.</p>
        <div class="field-row ce-group-create">
          <div class="field" style="flex:1;margin:0">
            <label for="ceg_new_label">New group name</label>
            <input class="input" id="ceg_new_label" placeholder="e.g. VIP enterprise clients" />
          </div>
          <button type="button" class="btn sm" id="ceg_create" style="align-self:flex-end">Create group</button>
        </div>
        <ul class="ce-group-list">${groupList || `<li class="muted">No groups yet — create one above.</li>`}</ul>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Add customer to group</h3>
        ${
          manageGroup
            ? `<p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem">Adding to <strong>${escapeHtml(manageGroup.label)}</strong></p>
        <div class="field">
          <label for="ceg_add_customer">Pick customer (optional)</label>
          <select class="field" id="ceg_add_customer">${custPickOpts}</select>
          <p class="muted" style="margin:0.35rem 0 0;font-size:0.78rem">Selecting a customer fills name and email from their primary contact.</p>
        </div>
        <div class="field"><label for="ceg_add_customer_name">Customer name *</label>
          <input class="input" id="ceg_add_customer_name" placeholder="Customer / organisation name" /></div>
        <div class="field"><label for="ceg_add_contact_name">Contact name</label>
          <input class="input" id="ceg_add_contact_name" placeholder="Recipient name" /></div>
        <div class="field"><label for="ceg_add_email">Email for communication *</label>
          <input class="input" id="ceg_add_email" type="email" placeholder="name@company.com" /></div>
        <div class="toolbar" style="margin-bottom:0">
          <button type="button" class="btn sm" id="ceg_add_member">Add to group</button>
        </div>
        <div class="table-wrap" style="margin-top:1rem">
          <table class="data data-compact">
            <thead><tr><th>Customer</th><th>Contact</th><th>Email</th><th></th></tr></thead>
            <tbody>${memberRows || `<tr><td colspan="4" class="muted">No members in this group yet.</td></tr>`}</tbody>
          </table>
        </div>`
            : `<p class="muted">Create or select a group to add customers.</p>`
        }
      </div>
    </div>

    <div class="card cust-email-card" style="margin-top:1rem">
      <div class="field-row">
        <div class="field" style="flex:1">
          <label for="ce_recipient_source">Recipient list</label>
          <select class="field" id="ce_recipient_source">${sourceOpts}</select>
        </div>
        <div class="field" style="flex:1">
          <label for="ce_template">Message template</label>
          <select class="field" id="ce_template">${tplOpts}</select>
        </div>
      </div>
      <div class="field">
        <label for="ce_subject">Subject</label>
        <input class="input" id="ce_subject" value="${escapeHtml(preview.subject)}" />
      </div>
      <div class="field">
        <label for="ce_body">Body</label>
        <textarea class="textarea" id="ce_body" rows="8">${escapeHtml(preview.body)}</textarea>
        <p class="muted" style="margin:0.35rem 0 0;font-size:0.82rem">Placeholders: <code>{{customer_name}}</code>, <code>{{contact_name}}</code>, <code>{{email}}</code></p>
      </div>
      <div class="toolbar" style="margin-bottom:0">
        <button type="button" class="btn" id="ce_send_selected">Send to selected (${selectedCount})</button>
        <button type="button" class="btn ghost" id="ce_preview_sample">Refresh preview</button>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <div class="ce-recipient-head">
        <div>
          <h3 style="margin:0">Recipients — ${escapeHtml(sourceLabel)}</h3>
          <p class="muted" style="font-size:0.85rem;margin:0.35rem 0 0">${recipients.length} contact(s) · ${selectedCount} selected</p>
        </div>
        <div class="toolbar ce-recipient-actions">
          <label class="ce-recipient-chk ce-select-all"><input type="checkbox" id="ce_select_all" ${allChecked ? "checked" : ""} /> Select all</label>
          <button type="button" class="btn sm ghost" id="ce_clear_all">Clear</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data ce-recipient-table">
          <thead><tr><th style="width:2.5rem"></th><th>Customer</th><th>Contact</th><th>Email</th></tr></thead>
          <tbody>${recipientRows || `<tr><td colspan="4" class="muted">No recipients in this list.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function viewContactLinks() {
  const custOpts = state.customers.map((k) => `<option value="${k.id}">${escapeHtml(k.name)}</option>`).join("");
  const repOpts = state.contacts
    .map((c) => `<option value="${c.id}">${escapeHtml(contactDisplayName(c))}</option>`)
    .join("");
  const linkRows = state.repBranchLinks
    .map((row) => {
      const cust = customerById(row.customerId);
      const rep = contactById(row.representativeContactId);
      const br =
        row.branchId && row.branchId !== "__hq__"
          ? branchById(row.branchId)
          : null;
      const loc = br ? br.name : "HQ / Parent";
      return `<tr>
        <td>${escapeHtml(cust?.name || row.customerId)}</td>
        <td>${escapeHtml(rep ? contactDisplayName(rep) : row.representativeContactId)}</td>
        <td>${escapeHtml(loc)}</td>
        <td><span class="muted" style="font-size:0.8rem">${formatDateTime(row.createdAt)}</span></td>
        <td><button type="button" class="link sm" data-remove-rbl="${row.id}">Remove</button></td>
      </tr>`;
    })
    .join("");
  return `
    <div class="two-col">
      <div class="card">
        <h3>Assign representative to branches</h3>
        <p class="muted" style="margin-top:0;font-size:0.9rem">Choose the <strong>customer</strong>, the <strong>customer representative</strong> (contact), then add one or more <strong>branch links</strong>. Each row is a separate link (same person can cover HQ and multiple sites).</p>
        <div class="field"><label>Customer *</label>
          <select class="field" id="cr_customer">${custOpts}</select>
        </div>
        <div class="field"><label>Customer representative (contact) *</label>
          <select class="field" id="cr_rep">${repOpts}</select>
        </div>
        <div class="field">
          <label>Branch links (one branch per row)</label>
          <div id="cr_branch_rows" class="cr-branch-rows"></div>
          <button type="button" class="btn sm ghost" id="cr_add_row" style="margin-top:0.5rem">+ Add branch link</button>
        </div>
        <div class="toolbar" style="margin-top:0.75rem;margin-bottom:0">
          <button type="button" class="btn" id="cr_save">Save links</button>
        </div>
      </div>
      <div class="card">
        <h3>Saved representative–branch links</h3>
        <p class="muted" style="margin-top:0;font-size:0.85rem">Each record ties one contact as representative to one customer location.</p>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Customer</th><th>Representative</th><th>Branch / location</th><th>Created</th><th></th></tr></thead>
            <tbody>${linkRows || `<tr><td colspan="5" class="muted">No links yet.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function viewCases() {
  const auth = getLoggedInUser();
  const visibleCases = state.cases.filter(caseVisibleForRole);
  const hcceBanner =
    auth?.role === "hcce_coordinator"
      ? `<p class="muted" style="margin:0 0 1rem;font-size:0.9rem"><strong>HCCE queue</strong> — ${visibleCases.filter((c) => !c.assignedUserId).length} unassigned Selfcare case(s). Open a case and choose an agent under <strong>Assignee</strong>.</p>`
      : "";
  const rows = visibleCases
    .map((c) => {
      const cust = customerById(c.customerId);
      const br = c.branchId ? branchById(c.branchId) : null;
      const parent = c.parentCaseId ? state.cases.find((x) => x.id === c.parentCaseId) : null;
      const sla = globalSlaStatus(c);
      const rb = resolutionBadgeClass(c.resolutionStatus);
      const hi = c.hierarchicalLevels[c.hierarchicalIndex] || "—";
      const fi = c.functionalSteps[c.functionalIndex] || "—";
      const escTimers = caseEscalationTimersHtml(c, true);
      return `<tr class="case-row-open" tabindex="0" data-open-case="${escapeHtml(c.id)}" role="button" aria-label="Review case ${escapeHtml(caseDisplayId(c))}">
        <td><code class="mono-tag">${escapeHtml(caseDisplayId(c))}</code></td>
        <td class="case-title-cell">${escapeHtml(c.title)}</td>
        <td><span class="badge ${rb}">${escapeHtml(c.resolutionStatus || "Open")}</span></td>
        <td>${escapeHtml(caseCatalogSummary(c))}</td>
        <td>${escapeHtml(c.type || "—")}</td>
        <td>${cust ? escapeHtml(cust.name) : "—"}${br ? ` · ${escapeHtml(br.name)}` : " · HQ"}${c.nigeriaState ? ` · ${escapeHtml(c.nigeriaState)}/${escapeHtml(c.nigeriaLga || "—")}` : ""}</td>
        <td>${escapeHtml(caseCreatorDisplay(c))}</td>
        <td>${escapeHtml(assigneeDisplayName(c.assignedUserId))}</td>
        <td>${parent ? `<span class="muted">Child of</span> ${escapeHtml(caseDisplayId(parent))}` : "Parent"}</td>
        <td><span class="muted" style="font-size:0.8rem">${escapeHtml(hi)} / ${escapeHtml(fi)}</span><div style="margin-top:0.25rem">${escTimers}</div></td>
        <td><span class="badge ${sla.cls}">${sla.label}</span></td>
        <td>${escapeHtml(informationSourceDisplay(c))}</td>
        <td>${escapeHtml(c.source === "selfcare" ? "Selfcare" : "Agent")}</td>
        <td><button type="button" class="btn sm ghost case-review-btn" data-open-case="${escapeHtml(c.id)}">Review</button></td>
      </tr>`;
    })
    .join("");
  const scopeNote =
      auth?.role === "supervisor"
      ? "You are signed in as <strong>supervisor</strong> — all cases are open for review. Only the creating agent may close a case."
      : auth?.role === "hcce_coordinator"
        ? "You are signed in as <strong>HCCE</strong> — viewing Selfcare cases for agent assignment."
      : auth?.role === "case_agent"
        ? "You are signed in as <strong>agent</strong> — all cases are open for review. Only the agent who created a case may set it to <strong>Close</strong>."
        : "Case management: assign owners and update notes in case detail.";
  return `
    ${hcceBanner}
    <p class="muted" style="margin-top:0">${scopeNote}</p>
    <div class="toolbar">
      <button type="button" class="btn" id="btnNewCase">+ New case</button>
    </div>
    <div class="table-wrap cases-registry-wrap">
      <div class="cases-registry-head">
        <span class="muted" style="font-size:0.82rem">${visibleCases.length} case(s) · click a row or <strong>Review</strong> to open</span>
      </div>
      <table class="data cases-registry-table">
        <thead><tr><th>Case ID</th><th>Title</th><th>Resolution</th><th>Group / type</th><th>Category</th><th>Customer / Location</th><th>Created by</th><th>Assignee</th><th>Hierarchy</th><th>Escalation</th><th>SLA</th><th>Source of contact</th><th>Intake</th><th>Review</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="14" class="muted">No cases in your scope.</td></tr>`}</tbody>
      </table>
    </div>`;
}

function viewCaseGroups() {
  const escKeys = Object.keys(state.escalationByGroup || {});
  const cards = (state.caseGroupCatalog || [])
    .map((g) => {
      const escOpts = escKeys
        .map((k) => `<option value="${escapeHtml(k)}" ${g.escalationKey === k ? "selected" : ""}>${escapeHtml(k)}</option>`)
        .join("");
      return `<div class="config-card catalog-group-card" data-cat-group="${escapeHtml(g.id)}">
        <div class="catalog-group-head">
          <h4>${escapeHtml(g.label)}</h4>
          <button type="button" class="link sm" data-cat-del-group="${escapeHtml(g.id)}">Remove group</button>
        </div>
        <div class="field-row">
          <div class="field"><label>Group label</label>
            <input class="input" data-cat-label="${escapeHtml(g.id)}" value="${escapeHtml(g.label)}" /></div>
          <div class="field"><label>Escalation ladder template</label>
            <select class="field" data-cat-esc="${escapeHtml(g.id)}">${escOpts}</select></div>
        </div>
        <button type="button" class="btn sm" data-cat-save-group="${escapeHtml(g.id)}">Save group</button>
      </div>`;
    })
    .join("");
  return `
    <p class="muted" style="margin-top:0">Configure <strong>case groups</strong>. Selfcare and agent case creation use these as the parent dropdown. Each group maps to an escalation ladder template. Set default <strong>impact & urgency</strong> per case type under <strong>Case type</strong>; priority is derived from the matrix under <strong>Impact & urgency</strong>.</p>
    <div class="toolbar">
      <input class="input" id="cat_new_group_label" placeholder="New case group label" style="max-width:280px" />
      <button type="button" class="btn sm" id="cat_add_group">+ Add case group</button>
    </div>
    <div class="config-grid">${cards || "<p class=\"muted\">No case groups configured.</p>"}</div>`;
}

function infoSourceConfigPanelHtml() {
  const rows = (state.caseInformationSources || [])
    .map(
      (s) => `<tr data-cis-row="${escapeHtml(s.id)}">
        <td><input class="input" data-cis-label="${escapeHtml(s.id)}" value="${escapeHtml(s.label)}" /></td>
        <td><label class="sc-loc-chk" style="margin:0"><input type="checkbox" data-cis-active="${escapeHtml(s.id)}" ${s.active !== false ? "checked" : ""} /> Active</label></td>
        <td><button type="button" class="link sm" data-cis-save="${escapeHtml(s.id)}">Save</button>
          <button type="button" class="link sm" data-cis-del="${escapeHtml(s.id)}">Remove</button></td>
      </tr>`
    )
    .join("");
  return `
    <div class="toolbar" style="margin-top:0.5rem;margin-bottom:0.5rem">
      <input class="input" id="cis_new_label" placeholder="New source (e.g. Walk-in)" style="max-width:260px" />
      <button type="button" class="btn sm" id="cis_add">+ Add source</button>
    </div>
    <div class="table-wrap">
      <table class="data data-compact">
        <thead><tr><th>Label</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="muted">No sources configured.</td></tr>`}</tbody>
      </table>
    </div>
    <p class="muted" style="margin:0.5rem 0 0;font-size:0.8rem">Inactive sources stay on existing cases but are hidden from new-case dropdowns.</p>`;
}

function refreshNewCaseInfoSourceUi() {
  const panel = document.getElementById("info_source_config_panel");
  if (panel) panel.innerHTML = infoSourceConfigPanelHtml();
  const sel = document.getElementById("nc_info_source");
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = informationSourceSelectHtml(cur || state.defaultInformationSourceId);
  }
  bindCaseInformationSourceHandlers({ inNewCaseForm: true });
}

function viewNewCase() {
  const custOpts = state.customers.map((k) => `<option value="${k.id}">${escapeHtml(k.name)}</option>`).join("");
  const ncGrp0 = state.caseGroupCatalog[0]?.id || "";
  const ncTyp0 = state.caseGroupCatalog[0]?.caseTypes[0]?.id || "";
  const groupOptsNc = caseGroupSelectHtml(ncGrp0);
  const typeOptsNc = caseTypeSelectHtml(ncGrp0, ncTyp0);
  const catOptsNc = CASE_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${c === "Request" ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  const resOpts = RESOLUTION_STATUSES.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  const assigneeOpts = assigneeSelectHtml(state.currentUserId, true);
  const infoSrcOptsNc = informationSourceSelectHtml(state.defaultInformationSourceId);
  const cid = state.customers[0]?.id || "";
  const brs = cid ? state.branches.filter((b) => b.customerId === cid) : [];
  const locOpts = `<option value="__hq__">HQ / Parent (no branch)</option>${brs.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("")}`;
  const parOpts = state.cases
    .filter((c) => !c.parentCaseId && c.customerId === cid)
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(caseDisplayId(p))}</option>`)
    .join("");
  return `
    <button type="button" class="btn ghost sm" data-route="cases" style="margin-bottom:1rem">← Cases</button>
    <div class="card nc-new-case-card">
      <h3 style="margin-top:0">New case</h3>
      <p class="muted" style="margin:0 0 1rem;font-size:0.9rem">Create a single agent case. For multiple locations, use <strong>Selfcare</strong>.</p>
      <div id="nc_info_block">
        <div class="field"><label>Source of Contact *</label>
          <select class="field" id="nc_info_source">${infoSrcOptsNc}</select>
        </div>
        <details class="nc-info-sources-config">
          <summary class="nc-info-sources-summary">Configure source of contact options</summary>
          <div id="info_source_config_panel">${infoSourceConfigPanelHtml()}</div>
        </details>
      </div>
      <div class="field"><label>Title *</label><input class="input" id="nc_title" /></div>
      <div class="field-row">
        <div class="field"><label>Customer *</label><select class="field" id="nc_cust">${custOpts}</select></div>
        <div class="field"><label>Location *</label><select class="field" id="nc_loc">${locOpts}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>State *</label><select class="field" id="nc_nigeria_state">${nigeriaStateSelectHtml("")}</select></div>
        <div class="field"><label>Local government area *</label><select class="field" id="nc_nigeria_lga">${nigeriaLgaSelectHtml("", "")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Case group *</label><select class="field" id="nc_case_group">${groupOptsNc}</select></div>
        <div class="field"><label>Case type *</label><select class="field" id="nc_case_type">${typeOptsNc}</select></div>
      </div>
      <div class="field"><label>Category *</label><select class="field" id="nc_category">${catOptsNc}</select></div>
      <div class="field-row">
        <div class="field"><label>Resolution status *</label><select class="field" id="nc_res">${resOpts}</select></div>
        <div class="field"><label>Assignee</label><select class="field" id="nc_assignee">${assigneeOpts}</select></div>
      </div>
      <p class="muted" style="margin:0 0 0.75rem;font-size:0.82rem">Only the agent who creates a case may later set its resolution to <strong>Close</strong>.</p>
      <div class="field"><label>Parent case ID (optional)</label><select class="field" id="nc_par"><option value="">— None —</option>${parOpts}</select></div>
      <div class="field"><label>Description</label><textarea class="textarea" id="nc_desc"></textarea></div>
      <div class="toolbar" style="margin-bottom:0">
        <button type="button" class="btn ghost" data-route="cases">Cancel</button>
        <button type="button" class="btn" id="ncs">Create case</button>
      </div>
    </div>`;
}

function viewCaseTypes() {
  const cards = (state.caseGroupCatalog || [])
    .map((g) => {
      const typeRows = (g.caseTypes || [])
        .map((t) => {
          normalizeCaseTypeDef(t);
          return `<li class="catalog-type-row catalog-type-sla-row">
          <div class="catalog-type-main"><strong>${escapeHtml(t.label)}</strong></div>
          <div class="catalog-type-sla-fields">
            <label class="sla-mini-label">Impact</label>
            <select class="field sla-mini-input" data-cat-impact="${escapeHtml(g.id)}" data-type-id="${escapeHtml(t.id)}">${impactSelectHtml(t.impact)}</select>
            <label class="sla-mini-label">Urgency</label>
            <select class="field sla-mini-input" data-cat-urgency="${escapeHtml(g.id)}" data-type-id="${escapeHtml(t.id)}">${urgencySelectHtml(t.urgency)}</select>
            <span class="sla-mini-label muted" title="Derived from Impact & urgency matrix">→ ${escapeHtml(priorityFromImpactUrgency(t.impact, t.urgency))}</span>
            <label class="sla-mini-label">Due (h)</label>
            <input type="number" class="input sla-mini-input" min="1" step="1" data-cat-sla-dur="${escapeHtml(g.id)}" data-type-id="${escapeHtml(t.id)}" value="${t.sla.durationHours}" />
            <label class="sla-mini-label">Overdue + (h)</label>
            <input type="number" class="input sla-mini-input" min="0" step="1" data-cat-sla-over="${escapeHtml(g.id)}" data-type-id="${escapeHtml(t.id)}" value="${t.sla.overdueOffsetHours}" />
            <button type="button" class="btn sm" data-cat-save-sla="${escapeHtml(g.id)}" data-type-id="${escapeHtml(t.id)}">Save policy</button>
            <button type="button" class="link sm" data-cat-del-type="${escapeHtml(g.id)}" data-type-id="${escapeHtml(t.id)}">Remove</button>
          </div>
        </li>`;
        })
        .join("");
      return `<div class="config-card catalog-group-card" data-cat-group="${escapeHtml(g.id)}">
        <div class="catalog-group-head">
          <h4>${escapeHtml(g.label)}</h4>
        </div>
        <div class="field"><label>Case types, impact/urgency & SLA policies</label>
          <p class="muted" style="margin:0 0 0.5rem;font-size:0.82rem">Impact and urgency are snapshotted onto each case; <strong>priority</strong> is derived from the matrix under <strong>Impact & urgency</strong>.</p>
          <ul class="catalog-type-list">${typeRows || "<li class=\"muted\">No types yet.</li>"}</ul>
          <div class="toolbar" style="margin-top:0.5rem;margin-bottom:0">
            <input class="input" data-cat-new-type-label="${escapeHtml(g.id)}" placeholder="New case type label" style="max-width:240px" />
            <button type="button" class="btn sm ghost" data-cat-add-type="${escapeHtml(g.id)}">+ Add type</button>
          </div>
        </div>
      </div>`;
    })
    .join("");
  return `
    <p class="muted" style="margin-top:0">Configure <strong>case types</strong> with default <strong>impact</strong>, <strong>urgency</strong>, and <strong>resolution SLA windows</strong>. Priority is calculated from the Impact × Urgency matrix at case creation.</p>
    <div class="config-grid">${cards || "<p class=\"muted\">No case groups configured. Add a group under <strong>Case group</strong> first.</p>"}</div>`;
}

function viewPriorityConfig() {
  const matrix = normalizePriorityMatrix(state.priorityMatrix);
  const headerCells = URGENCY_LEVELS.map((u) => `<th scope="col">${escapeHtml(u)} urgency</th>`).join("");
  const bodyRows = IMPACT_LEVELS.map((impact) => {
    const cells = URGENCY_LEVELS.map((urgency) => {
      const cur = matrix[impact][urgency];
      const opts = SELFCARE_PRIORITIES.map(
        (p) => `<option value="${escapeHtml(p)}" ${p === cur ? "selected" : ""}>${escapeHtml(p)}</option>`
      ).join("");
      return `<td><select class="field pri-matrix-cell" data-pri-impact="${escapeHtml(impact)}" data-pri-urgency="${escapeHtml(urgency)}" aria-label="${escapeHtml(impact)} impact, ${escapeHtml(urgency)} urgency">${opts}</select></td>`;
    }).join("");
    return `<tr><th scope="row">${escapeHtml(impact)} impact</th>${cells}</tr>`;
  }).join("");
  return `
    <p class="muted" style="margin-top:0">Configure how <strong>Impact</strong> and <strong>Urgency</strong> combine to set case <strong>priority</strong>. Case types define default impact/urgency; the resulting priority is snapshotted when a case is created.</p>
    <div class="card pri-matrix-card">
      <h3 style="margin-top:0">Priority matrix</h3>
      <div class="table-wrap">
        <table class="data pri-matrix-table">
          <thead><tr><th scope="col">Impact ↓ / Urgency →</th>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <button type="button" class="btn sm" id="pri_matrix_save" style="margin-top:0.85rem">Save matrix</button>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3 style="margin-top:0">How it works</h3>
      <ul class="muted arch-list" style="margin:0">
        <li><strong>Case type</strong> — set default impact and urgency per type under Settings → Case type.</li>
        <li><strong>Case creation</strong> — Selfcare and agent flows snapshot impact/urgency from the selected type.</li>
        <li><strong>Priority</strong> — looked up from this matrix and stored on <code class="mono-tag">case.priority</code>.</li>
      </ul>
    </div>`;
}

function viewEscalationGroups() {
  const groups = state.escalationNotifyGroups || [];
  const assignments = state.escalationLevelAssignments || defaultEscalationLevelAssignments();
  const customGroups = groups.filter((g) => !isHierarchicalEscalationGroup(g));
  const manageGroupId = state.escalationNotifyManageGroupId || customGroups[0]?.id || null;
  const manageGroup = manageGroupId ? escalationNotifyGroupById(manageGroupId) : null;
  const hierComplete = hierarchicalEscalationGroupsComplete();

  const groupList = customGroups
    .map((g) => {
      const emailPreview = (g.emails || []).slice(0, 2).join(", ");
      const more = (g.emails || []).length > 2 ? ` +${g.emails.length - 2} more` : "";
      return `<li class="eng-group-item ${g.id === manageGroupId ? "active" : ""}">
        <button type="button" class="eng-group-pick link" data-eng-pick="${escapeHtml(g.id)}">${escapeHtml(g.label)}</button>
        <span class="muted eng-group-emails">${escapeHtml(emailPreview || "No emails")}${escapeHtml(more)}</span>
        <button type="button" class="link sm" data-eng-del="${escapeHtml(g.id)}">Delete</button>
      </li>`;
    })
    .join("");

  const emailRows = (manageGroup?.emails || [])
    .map(
      (email) => `<li class="eng-email-item">
        <a class="link" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
        <button type="button" class="link sm" data-eng-rm-email="${escapeHtml(manageGroup.id)}" data-eng-email="${escapeHtml(email)}">Remove</button>
      </li>`
    )
    .join("");

  const hierarchicalCards = HIERARCHICAL_ESCALATION_ROLES.map((role, i) => {
    const def = hierarchicalEscalationGroupDef(role);
    const group =
      escalationNotifyGroupById(hierarchicalEscalationGroupIdForRole(role)) ||
      groups.find((g) => g.hierarchicalRole === role);
    const exists = !!group;
    const emailList = (group?.emails || [])
      .map(
        (email) => `<li class="eng-email-item">
          <a class="link" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
          ${
            exists
              ? `<button type="button" class="link sm" data-eng-rm-email="${escapeHtml(group.id)}" data-eng-email="${escapeHtml(email)}">Remove</button>`
              : ""
          }
        </li>`
      )
      .join("");
    return `<article class="eng-hier-card ${exists ? "ready" : "missing"}" data-hier-role="${escapeHtml(role)}">
      <header class="eng-hier-card-head">
        <span class="eng-hier-step">${i + 1}</span>
        <div>
          <h4>${escapeHtml(role)}</h4>
          <p class="muted eng-hier-sub">${i === 0 ? "First leadership tier after Agent" : `Escalates from ${escapeHtml(HIERARCHICAL_ESCALATION_ROLES[i - 1])}`}</p>
        </div>
        ${exists ? `<span class="badge new">Active</span>` : `<span class="badge reopen">Not created</span>`}
      </header>
      ${
        exists
          ? `<div class="field-row eng-email-add">
          <div class="field" style="flex:1;margin:0">
            <label for="eng_hier_email_${def.id}">Add email for ${escapeHtml(role)}</label>
            <input class="input" id="eng_hier_email_${def.id}" type="email" placeholder="${escapeHtml(def.email)}" data-eng-hier-add-input="${escapeHtml(group.id)}" />
          </div>
          <button type="button" class="btn sm" data-eng-hier-add="${escapeHtml(group.id)}" style="align-self:flex-end">Add email</button>
        </div>
        <ul class="eng-email-list">${emailList || `<li class="muted">No emails yet — add one above.</li>`}</ul>`
          : `<p class="muted" style="margin:0 0 0.65rem;font-size:0.85rem">Create this group to receive hierarchical alerts at the <strong>${escapeHtml(role)}</strong> tier.</p>
        <button type="button" class="btn sm" data-eng-hier-create="${escapeHtml(role)}">Create ${escapeHtml(role)} group</button>`
      }
    </article>`;
  }).join("");

  const functionalAssignRows = FUNCTIONAL_ESCALATION_LEVELS.map((level) => {
    const selected = assignments.functional?.[level.id] || "";
    return `<div class="field eng-assign-field">
      <label for="eng_func_${level.id}">${escapeHtml(functionalLevelAssignmentLabel(level))}</label>
      <select class="field" id="eng_func_${level.id}" data-eng-func="${escapeHtml(level.id)}">${escalationNotifyGroupSelectHtml(selected, true, false)}</select>
      <p class="muted eng-assign-hint">${escapeHtml(level.team)} · ${escapeHtml(escalationGroupEmailsDisplay(escalationNotifyGroupById(selected)))}</p>
    </div>`;
  }).join("");

  const hierarchicalAssignRows = [
    `<div class="field eng-assign-field eng-assign-agent">
      <label>Agent</label>
      <p class="muted eng-assign-hint" style="margin:0">Entry tier — cases are created here. No notification group (escalation continues to leadership tiers below).</p>
    </div>`,
    ...HIERARCHICAL_ESCALATION_ROLES.map((role) => {
      const selected = assignments.hierarchical?.[role] || hierarchicalEscalationGroupIdForRole(role) || "";
      const slug = role.replace(/\s+/g, "_").toLowerCase();
      return `<div class="field eng-assign-field">
      <label for="eng_hier_${slug}">${escapeHtml(role)}</label>
      <select class="field" id="eng_hier_${slug}" data-eng-hier-key="${escapeHtml(role)}" data-eng-hier-only="1">${escalationNotifyGroupSelectHtml(selected, true, true)}</select>
      <p class="muted eng-assign-hint">${escapeHtml(escalationGroupEmailsDisplay(escalationNotifyGroupById(selected)))}</p>
    </div>`;
    }),
  ].join("");

  return `
    <p class="muted" style="margin-top:0">Create <strong>functional notification groups</strong> for Resolution / Escalation / Consultation / External, and <strong>four hierarchical groups</strong> for leadership tiers after Agent: Team Lead → HOD → Director → GMD.</p>

    <div class="card eng-hier-panel" style="margin-bottom:1rem">
      <div class="eng-hier-panel-head">
        <div>
          <h3 style="margin:0 0 0.35rem">Hierarchical escalation groups</h3>
          <p class="muted" style="margin:0;font-size:0.85rem">After <strong>Agent</strong>, cases escalate through four leadership tiers — each tier has its own email group.</p>
        </div>
        <button type="button" class="btn sm ${hierComplete ? "ghost" : ""}" id="eng_create_all_hierarchical" ${hierComplete ? "disabled" : ""}>Create all 4 groups</button>
      </div>
      <div class="eng-hier-ladder muted" aria-hidden="true">
        <span>Agent</span><span class="arrow">→</span><span>Team Lead</span><span class="arrow">→</span><span>HOD</span><span class="arrow">→</span><span>Director</span><span class="arrow">→</span><span>GMD</span>
      </div>
      <div class="eng-hier-grid">${hierarchicalCards}</div>
    </div>

    <div class="two-col eng-groups-layout">
      <div class="card">
        <h3 style="margin-top:0">Functional & custom groups</h3>
        <p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem">Groups for functional escalation levels (Resolution, Escalation, Consultation, External).</p>
        <div class="field-row eng-group-create">
          <div class="field" style="flex:1;margin:0">
            <label for="eng_new_label">New group name</label>
            <input class="input" id="eng_new_label" placeholder="e.g. Resolution L1 desk" />
          </div>
          <button type="button" class="btn sm" id="eng_create" style="align-self:flex-end">Create group</button>
        </div>
        <ul class="eng-group-list">${groupList || `<li class="muted">No custom groups yet — create one above.</li>`}</ul>
      </div>

      <div class="card">
        <h3 style="margin-top:0">Group email addresses</h3>
        ${
          manageGroup && !isHierarchicalEscalationGroup(manageGroup)
            ? `<p class="muted" style="font-size:0.85rem;margin:0 0 0.75rem">Editing <strong>${escapeHtml(manageGroup.label)}</strong></p>
        <div class="field-row eng-email-add">
          <div class="field" style="flex:1;margin:0">
            <label for="eng_add_email">Email address</label>
            <input class="input" id="eng_add_email" type="email" placeholder="team@company.com" />
          </div>
          <button type="button" class="btn sm" id="eng_add_email_btn" style="align-self:flex-end">Add email</button>
        </div>
        <ul class="eng-email-list">${emailRows || `<li class="muted">No emails in this group yet.</li>`}</ul>`
            : `<p class="muted">Select a functional/custom group to manage emails, or use the hierarchical cards above for Team Lead, HOD, Director, and GMD.</p>`
        }
      </div>
    </div>

    <div class="card eng-assign-panel" style="margin-top:1rem">
      <h3 style="margin-top:0">Assign groups to escalation levels</h3>
      <p class="muted" style="font-size:0.85rem;margin:0 0 1rem">Functional levels use any custom group. Hierarchical levels use the four leadership groups created above.</p>
      <div class="eng-assign-grid">
        <section class="eng-assign-section">
          <h4>Functional levels</h4>
          <div class="eng-assign-stack">${functionalAssignRows}</div>
        </section>
        <section class="eng-assign-section">
          <h4>Hierarchical levels</h4>
          <div class="eng-assign-stack">${hierarchicalAssignRows}</div>
        </section>
      </div>
      <button type="button" class="btn sm" id="eng_save_assignments">Save level assignments</button>
    </div>`;
}

function viewEscalation() {
  processAutoFunctionalEscalations();
  const visible = state.cases.filter(caseVisibleForRole);
  const byLevel = FUNCTIONAL_ESCALATION_LEVELS.map((level) => ({
    level,
    cases: visible.filter((c) => (c.functionalIndex ?? 0) === level.order),
  }));

  const pipeline = FUNCTIONAL_ESCALATION_LEVELS.map((level, i) => {
    const count = byLevel[i].cases.length;
    return `<div class="esc-pipe-step ${count ? "has-cases" : ""}">
      <span class="esc-pipe-badge">${escapeHtml(level.label)}</span>
      <strong>${escapeHtml(level.team)}</strong>
      <span class="muted">${escapeHtml(level.blurb)}</span>
      <span class="esc-pipe-count">${count} case(s)</span>
      ${i < FUNCTIONAL_ESCALATION_LEVELS.length - 1 ? '<span class="esc-pipe-arrow" aria-hidden="true">→</span>' : ""}
    </div>`;
  }).join("");

  const configRows = FUNCTIONAL_ESCALATION_LEVELS.map((level) => {
    const cfg = functionalEscalationLevelConfig(level.id);
    return `<div class="field esc-timeout-field">
      <label>${escapeHtml(level.label)} — ${escapeHtml(level.team)}</label>
      <div class="esc-timeout-pair">
        <div class="esc-timeout-input">
          <input type="number" class="input" min="1" step="1" id="esc_pickup_${level.id}" value="${cfg.pickupMins}" />
          <span class="muted">min pick-up</span>
        </div>
        <div class="esc-timeout-input">
          <input type="number" class="input" min="1" step="1" id="esc_resolution_${level.id}" value="${cfg.resolutionMins}" />
          <span class="muted">min resolution</span>
        </div>
      </div>
    </div>`;
  }).join("");

  const levelPanels = byLevel
    .map(({ level, cases: levelCases }) => {
      const cards = levelCases
        .map((c) => {
          const maxIdx = FUNCTIONAL_ESCALATION_LEVELS.length - 1;
          const canEsc = (c.functionalIndex ?? 0) < maxIdx;
          const next = canEsc ? functionalLevelByIndex((c.functionalIndex ?? 0) + 1) : null;
          return `<article class="esc-case-card">
            <div class="esc-case-head">
              <h4>${escapeHtml(caseTitleShort(c))}</h4>
              <code class="mono-tag">${escapeHtml(caseDisplayId(c))}</code>
            </div>
            <p class="muted" style="margin:0.35rem 0;font-size:0.82rem">Created by ${escapeHtml(caseCreatorDisplay(c))}</p>
            ${caseEscalationTimersHtml(c)}
            <div class="toolbar" style="margin:0.5rem 0 0">
              <button type="button" class="btn sm" data-esc-manual="${escapeHtml(c.id)}" ${canEsc ? "" : "disabled"}>Escalate to ${escapeHtml(next?.team || "—")}</button>
              <button type="button" class="btn sm ghost" data-open-case="${escapeHtml(c.id)}">Open case</button>
            </div>
          </article>`;
        })
        .join("");
      const notifyGroup = escalationGroupForFunctionalLevel(level.id);
      return `<section class="esc-level-panel">
        <header class="esc-level-head">
          <h3>${escapeHtml(level.label)} — ${escapeHtml(level.team)}</h3>
          <span class="pill">${levelCases.length} active</span>
        </header>
        <p class="muted" style="margin:0 0 0.75rem;font-size:0.85rem">Group <code class="mono-tag">${escapeHtml(level.groupId)}</code> · Pick-up <strong>${functionalLevelPickupMins(level.id)}</strong> min + Resolution <strong>${functionalLevelResolutionMins(level.id)}</strong> min = <strong>${functionalLevelPickupMins(level.id) + functionalLevelResolutionMins(level.id)}</strong> min level SLA (breach → next level)</p>
        <p class="muted" style="margin:0 0 0.75rem;font-size:0.82rem">Notify group: <strong>${escapeHtml(notifyGroup?.label || "—")}</strong>${notifyGroup?.emails?.length ? ` · <a class="link" href="mailto:${escapeHtml(notifyGroup.emails[0])}">${escapeHtml(escalationGroupEmailsDisplay(notifyGroup))}</a>` : ""} · <button type="button" class="link sm" data-route="escalation_groups">Configure groups</button></p>
        <div class="esc-case-grid">${cards || '<p class="muted">No cases at this level in your scope.</p>'}</div>
      </section>`;
    })
    .join("");

  return `
    <div class="esc-hub">
      <p class="muted" style="margin-top:0">Four functional groups: <strong>Resolution Team</strong> (creates cases) → <strong>Delegation</strong> → <strong>Consultation</strong> → <strong>External</strong>. Each level has configurable <strong>pick-up</strong> (default 5 min) and <strong>resolution</strong> (default 25 min, starts after pick-up). When the combined level SLA is breached, the case auto-escalates to the next team. Live counters appear on every case.</p>
      <div class="card esc-config-card">
        <h3 style="margin-top:0">Level timers (pick-up & resolution)</h3>
        <p class="muted" style="font-size:0.85rem;margin:0 0 1rem">Defaults: <strong>5 minutes</strong> pick-up + <strong>25 minutes</strong> resolution per level. Auto-escalation fires when pick-up + resolution time is exceeded (checked every 5s across all levels).</p>
        <div class="esc-timeout-grid">${configRows}</div>
        <button type="button" class="btn sm" id="esc_save_timeouts">Save level timers</button>
      </div>
      <div class="esc-pipeline card">${pipeline}</div>
      <div class="esc-level-stack">${levelPanels}</div>
      <details class="esc-template-details">
        <summary>Hierarchical ladder templates (advanced)</summary>
        ${viewEscalationTemplates()}
      </details>
    </div>`;
}

function viewEscalationTemplates() {
  const groups = state.escalationByGroup;
  const cards = Object.entries(groups)
    .map(([name, cfg]) => {
      const h = (cfg.hierarchical || []).join("\n");
      return `<div class="config-card" data-group-card="${escapeHtml(name)}">
        <h4>${escapeHtml(name)}</h4>
        <div class="field"><label>Hierarchical (one role per line)</label>
          <textarea class="textarea" rows="4" data-esc-h="${escapeHtml(name)}">${escapeHtml(h)}</textarea></div>
        <p class="muted" style="font-size:0.8rem">Functional steps are fixed to the four teams above.</p>
        <button type="button" class="btn sm" data-save-group="${escapeHtml(name)}">Save hierarchical</button>
      </div>`;
    })
    .join("");
  return `<div class="toolbar" style="margin-top:0.75rem">
      <input class="input" id="newGroupName" placeholder="New template name" style="max-width:220px" />
      <button type="button" class="btn sm ghost" id="btnAddGroup">Add template</button>
    </div>
    <div class="config-grid">${cards}</div>`;
}

function renderCaseDetail(caseId) {
  const c = state.cases.find((x) => x.id === caseId);
  if (!c || !caseVisibleForRole(c)) {
    return `<p class="muted">Case not found or not visible for your role.</p>
      <button type="button" class="btn ghost sm" data-route="cases">← Back to cases</button>`;
  }
  const sla = globalSlaStatus(c);
  const g = c.globalSla;
  const children = state.cases.filter((k) => k.parentCaseId === c.id);
  const hLevels = c.hierarchicalLevels || [];
  const fSteps = c.functionalSteps || [];
  const hi = Math.min(c.hierarchicalIndex ?? 0, Math.max(0, hLevels.length - 1));
  const fi = Math.min(c.functionalIndex ?? 0, Math.max(0, fSteps.length - 1));

  const hierHtml = hLevels
    .map((lvl, i) => `<span class="${i === hi ? "esc-current" : ""}">${escapeHtml(lvl)}</span>${i < hLevels.length - 1 ? '<span class="arrow">→</span>' : ""}`)
    .join("");

  const funcFlow = fSteps
    .map((s, i) => `<span class="${i === fi ? "esc-current" : ""}">${escapeHtml(s)}</span>${i < fSteps.length - 1 ? '<span class="arrow">→</span>' : ""}`)
    .join("");

  const tracksHtml = fSteps.map((t) => {
    const pct = c.trackProgress[t] ?? 0;
    return `<div class="track">
      <h4>${escapeHtml(t)}</h4>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="toolbar" style="margin-top:0.5rem;margin-bottom:0">
        <button type="button" class="btn sm ghost" data-track-advance="${c.id}" data-track="${escapeHtml(t)}">+10%</button>
      </div>
    </div>`;
  }).join("");

  const resOpts = resolutionStatusSelectHtml(c);
  normalizeCaseNote(c);
  const noteMeta =
    c.caseNote?.updatedAt && c.caseNote?.updatedByName
      ? `Last updated by <strong>${escapeHtml(c.caseNote.updatedByName)}</strong> · ${escapeHtml(formatDateTime(c.caseNote.updatedAt))}`
      : "Not yet saved.";
  const noteHistoryHtml = (c.caseNoteHistory || [])
    .slice()
    .reverse()
    .map(
      (n) => `<li class="case-note-history-item">
        <p class="muted" style="margin:0 0 0.35rem;font-size:0.8rem">${escapeHtml(n.updatedByName || "—")} · ${escapeHtml(formatDateTime(n.updatedAt))}</p>
        <p style="margin:0;font-size:0.9rem">${escapeHtml(n.body || "")}</p>
      </li>`
    )
    .join("");

  const backRoute = state.caseReturnRoute || "cases";
  const backLabel = backRoute === "dashboard" ? "Case management" : "Cases";

  return `
    <button type="button" class="btn ghost sm" data-route="${escapeHtml(backRoute)}" style="margin-bottom:1rem">← ${escapeHtml(backLabel)}</button>
    <div class="two-col">
      <div class="card">
        <h3>${escapeHtml(c.title)}</h3>
        <p class="muted" style="margin:0 0 0.75rem"><strong>Case ID:</strong> <code class="mono-tag">${escapeHtml(caseDisplayId(c))}</code></p>
        ${
          c.source === "selfcare" && !c.assignedUserId
            ? `<p class="muted hcce-assign-banner" style="margin:0 0 0.75rem;padding:0.65rem 0.85rem;border-radius:10px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.35);font-size:0.88rem"><strong>HCCE assignment</strong> — Selfcare case awaiting agent. Select an assignee below or sign in as <code>hcce</code> (${escapeHtml(HCCE_ASSIGNMENT_EMAIL)}).</p>`
            : ""
        }
        ${
          c.source === "selfcare" && c.hcceNotifiedAt
            ? `<p class="muted" style="margin:0 0 0.75rem;font-size:0.82rem">HCCE notified: ${escapeHtml(formatDateTime(c.hcceNotifiedAt))} · <a class="link" href="mailto:${escapeHtml(HCCE_ASSIGNMENT_EMAIL)}">${escapeHtml(HCCE_ASSIGNMENT_EMAIL)}</a></p>`
            : ""
        }
        <p class="muted" style="margin:0 0 0.75rem">${escapeHtml(c.description || "")}</p>
        <div class="field"><label>Assignee</label>
          <select class="field" id="detailAssignee" data-case-id="${c.id}">${assigneeSelectHtml(c.assignedUserId)}</select>
        </div>
        <div class="field"><label>Source of Contact</label>
          <select class="field" id="detailInfoSource" data-case-id="${c.id}">${informationSourceSelectHtml(c.informationSourceId, true)}</select>
        </div>
        <div class="field"><label>Resolution status</label>
          <select class="field" id="detailResolution" data-case-id="${c.id}">${resOpts}</select>
          ${caseCloseRestrictionHint(c)}
        </div>
        <p class="hint">Intake: <span class="badge ${c.source === "selfcare" ? "reopen" : "new"}">${escapeHtml(c.source === "selfcare" ? "Selfcare" : "Agent / ops")}</span> · Category: <strong>${escapeHtml(c.type || "—")}</strong> · Impact: <strong>${escapeHtml(c.impact || "—")}</strong> · Urgency: <strong>${escapeHtml(c.urgency || "—")}</strong> · Priority: <strong>${escapeHtml(c.priority || "—")}</strong> · Source of contact: <strong>${escapeHtml(informationSourceDisplay(c))}</strong> · Case <strong>${escapeHtml(caseCatalogSummary(c))}</strong> · Escalation ladder: <strong>${escapeHtml(c.escalationTemplate || "—")}</strong> (snapshot). Operational status: <span class="badge new">${escapeHtml(c.status)}</span>${
          c.source === "selfcare"
            ? ` · Selfcare email: <a class="link" href="mailto:${escapeHtml(c.selfcareReplyEmail || SELFCARE_SUPPORT_EMAIL)}">${escapeHtml(c.selfcareReplyEmail || SELFCARE_SUPPORT_EMAIL)}</a>`
            : ""
        }${
          c.nigeriaState
            ? ` · Location: <strong>${escapeHtml(c.nigeriaState)}</strong> / <strong>${escapeHtml(c.nigeriaLga || "—")}</strong>`
            : ""
        }</p>
        <h3 style="margin-top:1rem">Hierarchical escalation</h3>
        <p class="muted" style="font-size:0.85rem;margin:0 0 0.5rem">Current tier: <strong>${escapeHtml(hLevels[hi] || "—")}</strong></p>
        <div class="flow" style="margin-bottom:0.75rem">${hierHtml || "<span class=\"muted\">No levels</span>"}</div>
        <div class="toolbar">
          <button type="button" class="btn sm" data-hier-esc="${c.id}" ${hi >= hLevels.length - 1 ? "disabled" : ""}>Escalate to next tier</button>
        </div>
        <h3 style="margin-top:1rem">Functional escalation</h3>
        ${(() => {
          ensureFunctionalEscalation(c);
          const lvl = functionalLevelByIndex(fi);
          const next = fi < FUNCTIONAL_ESCALATION_LEVELS.length - 1 ? functionalLevelByIndex(fi + 1) : null;
          return `<p class="muted" style="font-size:0.85rem;margin:0 0 0.5rem">Active: <strong>${escapeHtml(lvl.team)}</strong> (${escapeHtml(lvl.label)}) · Group <code class="mono-tag">${escapeHtml(lvl.groupId)}</code></p>
        ${caseEscalationTimersHtml(c)}
        <div class="flow" style="margin-bottom:0.75rem;margin-top:0.5rem">${funcFlow || "<span class=\"muted\">No steps</span>"}</div>
        <div class="toolbar">
          <button type="button" class="btn sm" data-func-advance="${c.id}" ${fi >= fSteps.length - 1 ? "disabled" : ""}>Escalate to ${escapeHtml(next?.team || "next level")}</button>
          <button type="button" class="btn sm ghost" data-route="escalation">Escalation configuration</button>
        </div>`;
        })()}
        <h3 style="margin-top:1.25rem">Child cases</h3>
        ${
          children.length
            ? `<ul>${children.map((ch) => `<li><button type="button" class="link" data-open-case="${ch.id}">${escapeHtml(caseDisplayId(ch))}</button></li>`).join("")}</ul>`
            : "<p class=\"muted\">No child cases.</p>"
        }
        <h3 style="margin-top:1.25rem">Case note</h3>
        <p class="muted case-note-meta" id="caseNoteMeta" style="margin:0 0 0.5rem;font-size:0.85rem">${noteMeta}</p>
        <textarea class="textarea" id="caseNoteBody" rows="4" placeholder="Working note for agents…">${escapeHtml(c.caseNote?.body || "")}</textarea>
        <div class="toolbar" style="margin-top:0.5rem;margin-bottom:0">
          <button type="button" class="btn sm" id="caseNoteSave" data-case-id="${c.id}">Save note</button>
        </div>
        ${
          noteHistoryHtml
            ? `<h4 class="muted" style="margin:1rem 0 0.5rem;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.05em">Previous versions</h4><ul class="case-note-history">${noteHistoryHtml}</ul>`
            : ""
        }
      </div>
      <div class="card">
        <h3>Global SLA (governance)</h3>
        <p class="muted" style="font-size:0.9rem">Policy from case type: <strong>${escapeHtml(c.slaPolicyLabel || c.caseTypeLabel || "—")}</strong> (snapshot at creation). Due = T0 + ${g.durationHours}h + pause ${g.pauseHours}h. Overdue line = +${g.overdueOffsetHours}h after due.</p>
        <p>Simulated elapsed: <strong>${g.simulatedElapsedHours}h</strong> · Pause: <strong>${g.pauseHours}h</strong> ${g.pausedReason ? `(${escapeHtml(g.pausedReason)})` : ""}</p>
        <p>Status: <span class="badge ${sla.cls}">${sla.label}</span></p>
        <div class="toolbar">
          <button type="button" class="btn sm" data-sim-hours="${c.id}" data-delta="4">+4h</button>
          <button type="button" class="btn sm" data-sim-hours="${c.id}" data-delta="12">+12h</button>
          <button type="button" class="btn sm ghost" data-toggle-pause="${c.id}">${g.pauseHours > 0 ? "Clear pause" : "Pause (awaiting info)"}</button>
        </div>
        <h3 style="margin-top:1rem">Functional track progress</h3>
        <div class="sla-tracks">${tracksHtml}</div>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>Audit trail</h3>
      <div class="timeline">
        ${(c.audit || [])
          .slice()
          .reverse()
          .map((a) => `<div class="timeline-item"><span class="muted">${formatDateTime(a.t)}</span><br/>${escapeHtml(a.msg)}</div>`)
          .join("")}
      </div>
    </div>`;
}

function viewSla() {
  const policyRows = (state.caseGroupCatalog || [])
    .flatMap((grp) =>
      (grp.caseTypes || []).map((t) => {
        normalizeCaseTypeDef(t);
        return `<tr><td>${escapeHtml(grp.label)}</td><td>${escapeHtml(t.label)}</td><td>${escapeHtml(t.impact)}/${escapeHtml(t.urgency)}</td><td>${escapeHtml(priorityFromImpactUrgency(t.impact, t.urgency))}</td><td>${t.sla.durationHours}h</td><td>+${t.sla.overdueOffsetHours}h</td></tr>`;
      })
    )
    .join("");
  const policyCard = `
    <div class="card" style="margin-bottom:1rem">
      <h3 style="margin-top:0">Resolution SLA policies (by case type)</h3>
      <p class="muted" style="margin:0 0 0.75rem;font-size:0.9rem">Edit resolution windows under <strong>Settings → Case type</strong>. Impact/urgency defaults and the priority matrix are under <strong>Impact & urgency</strong>.</p>
      <div class="table-wrap">
        <table class="data compact">
          <thead><tr><th>Case group</th><th>Case type</th><th>Impact/Urgency</th><th>Priority</th><th>Due window</th><th>Overdue offset</th></tr></thead>
          <tbody>${policyRows || `<tr><td colspan="6" class="muted">No case types configured.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
  const cases = state.cases.filter(caseVisibleForRole);
  const opts = cases.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("");
  const selected = state.slaFocusCaseId && cases.some((c) => c.id === state.slaFocusCaseId) ? state.slaFocusCaseId : cases[0]?.id;
  state.slaFocusCaseId = selected;
  if (!selected) {
    return `<p class="muted" style="margin-top:0">Simulate governance <strong>resolution SLA</strong> windows and overdue behaviour per case type.</p>${policyCard}<p class="muted">No cases visible for SLA simulation.</p>`;
  }
  return `<p class="muted" style="margin-top:0">Simulate governance <strong>resolution SLA</strong> windows (due + overdue) snapshotted from case type at creation.</p>${policyCard}
    <div class="toolbar">
      <label class="muted">Focus case (simulation)</label>
      <select id="slaCaseSelect" class="select" style="max-width:420px">${opts}</select>
    </div>
    <div id="slaDetail">${renderCaseDetail(selected)}</div>`;
}

function viewArchitecture() {
  const nc = (state.customers || []).length;
  const nb = (state.branches || []).length;
  const nct = (state.contacts || []).length;
  const nCases = (state.cases || []).length;
  const tmplN = Object.keys(state.escalationByGroup || {}).length;
  const brPer = nc ? Math.round(nb / nc) : 0;
  return `
    <div class="card arch-hero">
      <h3 style="margin-top:0">What this prototype represents</h3>
      <p class="muted" style="margin:0 0 1rem;font-size:0.95rem">A <strong>read-write UI model</strong> of CRM capabilities aligned to an ERP narrative: customer and site-aware service, omnichannel communications, loyalty configuration, and operational cases with <strong>escalation snapshots</strong> plus <strong>global SLA</strong> simulation. Nothing here calls a real backend; state round-trips through <code class="mono-tag">${STORAGE_KEY}</code>.</p>
      <dl class="arch-stats">
        <div><dt>Demo master data</dt><dd>${nc} customers · ${nb} branches (${brPer} per customer) · ${nct} contacts in directory</dd></div>
        <div><dt>Cases & channels</dt><dd>${nCases} cases in store · communications, interactions, and loyalty entities as first-class lists</dd></div>
        <div><dt>Case catalog</dt><dd>${(state.caseGroupCatalog || []).length} case group(s) with child case types (under <strong>Settings</strong> menu)</dd></div>
        <div><dt>Contact sources</dt><dd>${(state.caseInformationSources || []).length} configurable channel(s) for case creation (includes <strong>Selfcare</strong>)</dd></div>
        <div><dt>Escalation ladders</dt><dd>${tmplN} ladder template(s) mapped per case group and snapshotted at creation</dd></div>
      </dl>
    </div>
    <div class="two-col" style="margin-top:1rem">
      <div class="card">
        <h3>Logical flow</h3>
        <div class="arch-diagram">Cases → case list, new case, detail<br />Settings → Case group · Case type · Impact & urgency · Escalation configuration · Resolution SLA · Architecture<br />Communications → Timeline · Customer email<br />Selfcare → Cases (case group + type, source of contact, multi-branch)<br />Celebration → Customers, primary reps, rep–branch links<br />Loyalty → Standards · Schemes · Beneficiaries · Awards</div>
      </div>
      <div class="card">
        <h3>Domain modules</h3>
        <ul class="muted arch-list">
          <li><strong>Cases</strong> — resolution status, parent/child, <strong>intake</strong> (agent vs selfcare), configurable <strong>source of contact</strong> (Selfcare, email, chat, etc.), branch location, <strong>case group / type</strong>, escalation ladder snapshot, <strong>SLA snapshot from case type</strong>.</li>
          <li><strong>Selfcare</strong> — customer <strong>dropdown</strong>, location checkboxes (one case per site), <strong>source of contact</strong> (defaults to Selfcare), <strong>case group</strong> and <strong>case type</strong>, public reply email <strong>${escapeHtml(SELFCARE_SUPPORT_EMAIL)}</strong>.</li>
          <li><strong>Loyalty</strong> — configurable standards, schemes, beneficiaries, awards.</li>
          <li><strong>Communications</strong> — email, chat, virtual meeting, call, SMS/text, WhatsApp, social.</li>
        </ul>
      </div>
    </div>`;
}

function renderView() {
  const view = document.getElementById("view");
  if (state.route !== "dashboard" && typeof cleanupCaseDashboard === "function") cleanupCaseDashboard();
  if (state.route !== "reports" && typeof cleanupReports === "function") cleanupReports();
  if (state.route !== "escalation") cleanupEscalationAutoTimer();
  if (state.detailCaseId) {
    const pt = document.getElementById("pageTitle");
    if (pt) pt.textContent = "Case detail";
    view.innerHTML = renderCaseDetail(state.detailCaseId);
    bindCaseDetailHandlers(view);
    return;
  }
  state.route = state.route || "dashboard";
  const pt = document.getElementById("pageTitle");
  if (pt) pt.textContent = navPageTitle(state.route);

  switch (state.route) {
    case "dashboard":
      view.innerHTML = viewCaseDashboard();
      bindCaseDashboardHandlers();
      break;
    case "reports":
      view.innerHTML = viewReports();
      bindReportsHandlers();
      break;
    case "selfcare":
      view.innerHTML = viewSelfcare();
      bindSelfcareHandlers();
      break;
    case "celebration":
      view.innerHTML = viewCelebration();
      bindCelebrationHandlers();
      bindContactLinksHandlers();
      break;
    case "loyalty":
      view.innerHTML = viewLoyalty();
      bindLoyaltyHandlers();
      break;
    case "communications":
      view.innerHTML = viewCommunicationsHub();
      bindCommunicationsHandlers();
      break;
    case "customer_email":
      view.innerHTML = viewCustomerEmail();
      bindCustomerEmailHandlers();
      break;
    case "cases":
      view.innerHTML = viewCases();
      bindCasesHandlers();
      break;
    case "case_group":
      view.innerHTML = viewCaseGroups();
      bindCaseCatalogHandlers();
      break;
    case "case_type":
      view.innerHTML = viewCaseTypes();
      bindCaseCatalogHandlers();
      break;
    case "priority_config":
      view.innerHTML = viewPriorityConfig();
      bindPriorityConfigHandlers();
      break;
    case CASE_NEW_ROUTE:
      view.innerHTML = viewNewCase();
      bindNewCaseHandlers();
      break;
    case "escalation":
      view.innerHTML = viewEscalation();
      bindEscalationHandlers();
      break;
    case "escalation_groups":
      view.innerHTML = viewEscalationGroups();
      bindEscalationGroupsHandlers();
      break;
    case "sla":
      view.innerHTML = viewSla();
      bindSlaHandlers(view);
      break;
    case "architecture":
      view.innerHTML = viewArchitecture();
      break;
    default:
      view.innerHTML = statCards();
  }
}

function openCaseForReview(caseId, returnRoute = "cases") {
  state.detailCaseId = caseId;
  state.route = "cases";
  state.caseReturnRoute = returnRoute;
  saveState();
  render();
}

function bindCaseDetailHandlers(root) {
  if (!root) return;
  root.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.route === "cases" || btn.dataset.route === "dashboard") state.detailCaseId = null;
      state.route = btn.dataset.route;
      if (btn.dataset.route === "dashboard") state.caseReturnRoute = "dashboard";
      saveState();
      render();
    });
  });
  root.querySelectorAll("[data-open-case]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openCaseForReview(btn.dataset.openCase, state.caseReturnRoute || "cases");
    });
  });
  root.querySelector("#detailResolution")?.addEventListener("change", (e) => {
    const id = e.target.dataset.caseId;
    const c = state.cases.find((x) => x.id === id);
    if (!c) return;
    const prev = c.resolutionStatus;
    const next = e.target.value;
    if (next === "Close" && !canUserCloseCase(c)) {
      e.target.value = prev;
      const owner = c.createdByUserId ? caseCreatorDisplay(c) : "the assigned agent";
      toast(`Only ${owner} can close this case.`);
      return;
    }
    c.resolutionStatus = next;
    c.audit = c.audit || [];
    c.audit.push({ t: new Date().toISOString(), msg: `Resolution status → ${c.resolutionStatus}` });
    if (next === "Close" && prev !== "Close") {
      sendCaseClosureEmails(c);
    }
    saveState();
    if (next !== "Close" || prev === "Close") toast("Resolution status updated.");
    render();
  });
  root.querySelector("#detailInfoSource")?.addEventListener("change", (e) => {
    const id = e.target.dataset.caseId;
    const c = state.cases.find((x) => x.id === id);
    if (!c) return;
    const prev = informationSourceDisplay(c);
    applyInformationSourceToRow(c, e.target.value);
    c.audit = c.audit || [];
    c.audit.push({ t: new Date().toISOString(), msg: `Source of contact: ${prev} → ${informationSourceDisplay(c)}` });
    saveState();
    toast("Source of contact updated.");
    render();
  });
  root.querySelector("#detailAssignee")?.addEventListener("change", (e) => {
    const id = e.target.dataset.caseId;
    const c = state.cases.find((x) => x.id === id);
    if (!c) return;
    const prev = assigneeDisplayName(c.assignedUserId);
    c.assignedUserId = e.target.value || null;
    const ag = agentById(c.assignedUserId);
    if (ag) {
      c.teamId = ag.teamId;
      c.departmentId = ag.departmentId;
    }
    if (ensureCaseClosureOwner(c)) {
      c.audit = c.audit || [];
      c.audit.push({
        t: new Date().toISOString(),
        msg: `Case ownership set to ${c.createdByName} — only this agent may close the case`,
      });
    }
    const next = assigneeDisplayName(c.assignedUserId);
    c.audit = c.audit || [];
    c.audit.push({ t: new Date().toISOString(), msg: `Assignee changed: ${prev} → ${next}` });
    saveState();
    toast(`Assignee set to ${next}.`);
    render();
  });
  root.querySelector("#caseNoteSave")?.addEventListener("click", () => {
    const id = root.querySelector("#caseNoteSave")?.dataset.caseId;
    const c = state.cases.find((x) => x.id === id);
    if (!c) return;
    const body = root.querySelector("#caseNoteBody")?.value ?? "";
    saveCaseNote(c, body);
    saveState();
    toast("Case note saved.");
    render();
  });
  root.querySelectorAll("[data-hier-esc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = state.cases.find((x) => x.id === btn.dataset.hierEsc);
      if (!c) return;
      const max = (c.hierarchicalLevels || []).length - 1;
      if (c.hierarchicalIndex >= max) return;
      c.hierarchicalIndex = (c.hierarchicalIndex || 0) + 1;
      const name = c.hierarchicalLevels[c.hierarchicalIndex];
      c.audit = c.audit || [];
      c.audit.push({ t: new Date().toISOString(), msg: `Hierarchical escalation → ${name}` });
      if (c.resolutionStatus !== "Escalated") {
        c.resolutionStatus = "Escalated";
        c.audit.push({ t: new Date().toISOString(), msg: "Resolution auto-tagged Escalated" });
      }
      state.notifications.push({ id: uid(), text: `Hierarchical escalation on "${c.title}" → ${name}`, at: new Date().toISOString() });
      saveState();
      render();
    });
  });
  root.querySelectorAll("[data-func-advance]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = state.cases.find((x) => x.id === btn.dataset.funcAdvance);
      if (!c) return;
      if (escalateCaseFunctional(c, "manual")) {
        saveState();
        toast(`Escalated to ${functionalLevelByIndex(c.functionalIndex).team}.`);
        render();
      }
    });
  });
  root.querySelectorAll("[data-sim-hours]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = state.cases.find((x) => x.id === btn.dataset.simHours);
      if (!c) return;
      const d = Number(btn.dataset.delta) || 0;
      c.globalSla.simulatedElapsedHours += d;
      c.audit = c.audit || [];
      c.audit.push({ t: new Date().toISOString(), msg: `Simulated +${d}h on global SLA clock` });
      maybeNotifySla(c);
      saveState();
      render();
    });
  });
  root.querySelectorAll("[data-toggle-pause]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = state.cases.find((x) => x.id === btn.dataset.togglePause);
      if (!c) return;
      if (c.globalSla.pauseHours > 0) {
        c.globalSla.pauseHours = 0;
        c.globalSla.pausedReason = null;
        c.audit.push({ t: new Date().toISOString(), msg: "Global SLA pause cleared" });
      } else {
        c.globalSla.pauseHours += 6;
        c.globalSla.pausedReason = "Awaiting info / vendor";
        c.resolutionStatus = "Awaiting info/Paused";
        c.audit.push({ t: new Date().toISOString(), msg: "Global SLA paused (+6h); resolution → Awaiting info/Paused" });
      }
      saveState();
      render();
    });
  });
  root.querySelectorAll("[data-track-advance]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = state.cases.find((x) => x.id === btn.dataset.trackAdvance);
      if (!c) return;
      const t = btn.dataset.track;
      c.trackProgress[t] = Math.min(100, (c.trackProgress[t] || 0) + 10);
      c.audit.push({ t: new Date().toISOString(), msg: `Track "${t}" +10%` });
      saveState();
      render();
    });
  });
}

function maybeNotifySla(c) {
  if (!c?.globalSla) return;
  const s = globalSlaStatus(c);
  const push = (text) => state.notifications.push({ id: uid(), text, at: new Date().toISOString() });
  if (s.phase === "breached") push(`Global SLA BREACHED on "${c.title}"`);
  if (s.phase === "overdue") push(`Global SLA OVERDUE on "${c.title}"`);
}

function bindSlaHandlers(root) {
  const sel = root.querySelector("#slaCaseSelect");
  const detail = root.querySelector("#slaDetail");
  if (sel) {
    sel.value = state.slaFocusCaseId || sel.value;
    sel.addEventListener("change", () => {
      state.slaFocusCaseId = sel.value;
      state.detailCaseId = null;
      saveState();
      render();
    });
  }
  if (detail) bindCaseDetailHandlers(detail);
}

function openModal(title, bodyHtml, footHtml) {
  const m = document.getElementById("modal");
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalFoot").innerHTML = footHtml;
  m.showModal();
}

function closeModal() {
  document.getElementById("modal").close();
}

function updateSelfcareCaseCountPreview() {
  const el = document.getElementById("sc_case_preview");
  const cid = document.getElementById("sc_customer")?.value?.trim() || "";
  if (!el) return;
  const tokens = cid
    ? normalizeBranchTokenArray(cid, state.selfcareBranchesByCustomerId?.[cid], state.branches, true)
    : [];
  el.textContent = selfcareCaseCountPreviewText(cid, tokens);
}

function addSelfcareRegisteredLocation(customerId, token) {
  if (!customerId || !token) return false;
  const cur = normalizeBranchTokenArray(customerId, state.selfcareBranchesByCustomerId?.[customerId], state.branches, true);
  if (cur.includes(token)) return false;
  state.selfcareBranchesByCustomerId = { ...(state.selfcareBranchesByCustomerId || {}), [customerId]: [...cur, token] };
  return true;
}

function removeSelfcareRegisteredLocation(customerId, token) {
  if (!customerId) return;
  const cur = normalizeBranchTokenArray(customerId, state.selfcareBranchesByCustomerId?.[customerId], state.branches, true);
  state.selfcareBranchesByCustomerId = {
    ...(state.selfcareBranchesByCustomerId || {}),
    [customerId]: cur.filter((t) => t !== token),
  };
}

function updateSelfcareTypePolicyPreview() {
  const el = document.getElementById("sc_sla_preview");
  if (!el) return;
  const scGrp = document.getElementById("sc_case_group")?.value || state.selfcareCaseGroupId;
  const scTyp = document.getElementById("sc_case_type")?.value || state.selfcareCaseTypeId;
  const g = catalogGroupById(scGrp);
  const t = catalogTypeById(scGrp, scTyp);
  const preview = t ? caseTypePolicySummary(t) : "—";
  el.innerHTML = `Policy for selected type: <strong>${escapeHtml(preview)}</strong> (applied when the case is created)`;
}

function bindSelfcareHandlers() {
  document.getElementById("sc_customer")?.addEventListener("change", (e) => {
    const v = e.target.value;
    state.selfcareCustomerIds = v ? [v] : [];
    syncSelfcareBranchesMapForCustomerIds(state.selfcareCustomerIds);
    saveState();
    render();
  });
  document.getElementById("sc_case_group")?.addEventListener("change", (e) => {
    state.selfcareCaseGroupId = e.target.value;
    const g = catalogGroupById(state.selfcareCaseGroupId);
    state.selfcareCaseTypeId = g?.caseTypes[0]?.id;
    saveState();
    render();
  });
  document.getElementById("sc_case_type")?.addEventListener("change", (e) => {
    state.selfcareCaseTypeId = e.target.value;
    saveState();
    updateSelfcareTypePolicyPreview();
  });
  document.getElementById("sc_info_source")?.addEventListener("change", () => {
    state.selfcareInformationSourceId = SELFCARE_CONTACT_SOURCE_ID;
    saveState();
  });
  document.getElementById("sc_loc_add")?.addEventListener("click", () => {
    const cid = document.getElementById("sc_customer")?.value?.trim();
    const pick = document.getElementById("sc_loc_pick")?.value;
    if (!cid) {
      toast("Select a customer first.");
      return;
    }
    if (!pick) {
      toast("Select a location from the dropdown.");
      return;
    }
    if (!addSelfcareRegisteredLocation(cid, pick)) {
      toast("That location is already registered.");
      return;
    }
    saveState();
    render();
  });
  document.querySelectorAll("[data-sc-loc-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeSelfcareRegisteredLocation(btn.dataset.scLocRm, btn.dataset.scLocToken);
      saveState();
      render();
    });
  });
  document.getElementById("sc_clear_registered")?.addEventListener("click", () => {
    const cid = document.getElementById("sc_customer")?.value?.trim();
    if (!cid) return;
    state.selfcareBranchesByCustomerId = { ...(state.selfcareBranchesByCustomerId || {}), [cid]: [] };
    saveState();
    render();
  });
  updateSelfcareCaseCountPreview();
  updateSelfcareTypePolicyPreview();
  const scInfoSel = document.getElementById("sc_info_source");
  if (scInfoSel) scInfoSel.value = SELFCARE_CONTACT_SOURCE_ID;
  bindNigeriaLocationCascade("sc_nigeria_state", "sc_nigeria_lga");
  document.getElementById("sc_submit")?.addEventListener("click", () => {
    const custEl = document.getElementById("sc_customer");
    const customerId = custEl?.value?.trim() || "";
    const title = document.getElementById("sc_title")?.value?.trim();
    const desc = document.getElementById("sc_desc")?.value?.trim();
    if (!customerId) {
      toast("Select a customer.");
      return;
    }
    if (!title || !desc) {
      toast("Title and description are required.");
      return;
    }
    const customerIds = [customerId];
    const tokens = normalizeBranchTokenArray(
      customerId,
      state.selfcareBranchesByCustomerId?.[customerId],
      state.branches,
      true
    );
    if (!tokens.length) {
      toast("Register at least one location.");
      return;
    }
    syncSelfcareBranchesMapForCustomerIds(customerIds);
    const caseGroupId = document.getElementById("sc_case_group")?.value || state.selfcareCaseGroupId;
    const caseTypeId = document.getElementById("sc_case_type")?.value || state.selfcareCaseTypeId;
    const categoryEl = document.getElementById("sc_type");
    const requestCategory = categoryEl?.value && CASE_CATEGORIES.includes(categoryEl.value) ? categoryEl.value : "Request";
    const infoSourceId = SELFCARE_CONTACT_SOURCE_ID;
    if (!informationSourceById(infoSourceId)) {
      toast("Selfcare contact source is not configured.");
      return;
    }
    const nigeriaState = document.getElementById("sc_nigeria_state")?.value?.trim() || "";
    const nigeriaLga = document.getElementById("sc_nigeria_lga")?.value?.trim() || "";
    if (!nigeriaState || !nigeriaLga) {
      toast("Select state and local government area.");
      return;
    }
    state.selfcareInformationSourceId = SELFCARE_CONTACT_SOURCE_ID;
    const createdIds = [];
    for (const customerId of customerIds) {
      const cust = customerById(customerId);
      let tokens = state.selfcareBranchesByCustomerId?.[customerId] || [];
      tokens = normalizeBranchTokenArray(customerId, tokens, state.branches, true);
      for (const raw of tokens) {
        const branchId = raw && raw !== "__hq__" ? raw : null;
        const validBr = branchId && state.branches.some((b) => b.id === branchId && b.customerId === customerId);
        const useBid = validBr ? branchId : null;
        const br = useBid ? branchById(useBid) : null;
        const suffix = useBid ? br?.name || "Branch" : "HQ";
        const id = uid();
        const caseId = nextCaseDisplayId();
        const row = {
          id,
          caseId,
          parentCaseId: null,
          customerId,
          branchId: useBid,
          nigeriaState,
          nigeriaLga,
          title: `${title} — ${cust?.name || "Customer"} · ${suffix} (Selfcare)`,
          type: requestCategory,
          status: "New",
          resolutionStatus: "Open",
          assignedUserId: null,
          teamId: "team_net",
          departmentId: "dept_ops",
          description: `${desc}\n\n— Selfcare contact: ${SELFCARE_SUPPORT_EMAIL}`,
          createdAt: new Date().toISOString(),
          trackProgress: {},
          source: "selfcare",
          caseNote: { body: "", updatedById: null, updatedByName: null, updatedAt: null },
          caseNoteHistory: [],
          selfcareReplyEmail: SELFCARE_SUPPORT_EMAIL,
          audit: [
            {
              t: new Date().toISOString(),
              msg: `Selfcare case ${caseId} created (${suffix}); ${nigeriaState}/${nigeriaLga}; reply email ${SELFCARE_SUPPORT_EMAIL}`,
            },
          ],
        };
        applyInformationSourceToRow(row, infoSourceId);
        attachCaseCatalogToRow(row, caseGroupId, caseTypeId, state.caseGroupCatalog, state.escalationByGroup);
        ensureFunctionalEscalation(row);
        const slaNote = row.globalSla ? ` SLA: ${row.globalSla.durationHours}h due, +${row.globalSla.overdueOffsetHours}h overdue` : "";
        row.audit[row.audit.length - 1].msg += ` · Source of contact: ${row.informationSourceLabel} · Priority: ${row.priority}${slaNote}`;
        state.cases.push(row);
        createdIds.push(id);
        notifyHcceSelfcareCase(row);
      }
    }
    state.selfcareCaseGroupId = caseGroupId;
    state.selfcareCaseTypeId = caseTypeId;
    state.selfcareCustomerIds = customerIds;
    saveState();
    state.notifications.push({
      id: uid(),
      text: `Selfcare: ${createdIds.length} case(s) created.`,
      at: new Date().toISOString(),
    });
    toast(`${createdIds.length} case(s) submitted.`);
    state.route = "cases";
    render();
  });
}

function bindCelebrationHandlers() {
  document.querySelectorAll(".cel-prim-rep").forEach((sel) => {
    sel.addEventListener("change", () => {
      const id = sel.dataset.customerId;
      const k = state.customers.find((x) => x.id === id);
      if (!k) return;
      k.primaryRepresentativeContactId = sel.value || "";
      saveState();
      toast("Primary representative saved.");
    });
  });
}

function bindLoyaltyHandlers() {
  document.querySelectorAll("[data-loy-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.loyaltyTab = btn.dataset.loyTab;
      saveState();
      render();
    });
  });
  document.getElementById("btnAddStandard")?.addEventListener("click", () => {
    openModal(
      "Add loyalty standard",
      `<div class="field"><label>Code *</label><input class="input" id="ls_code" placeholder="e.g. LP-XX-03" /></div>
      <div class="field"><label>Title *</label><input class="input" id="ls_title" /></div>
      <div class="field"><label>Description</label><textarea class="textarea" id="ls_desc"></textarea></div>`,
      `<button type="button" class="btn ghost" id="lsx">Cancel</button><button type="button" class="btn" id="lss">Save</button>`
    );
    document.getElementById("lsx").onclick = closeModal;
    document.getElementById("lss").onclick = () => {
      const code = document.getElementById("ls_code")?.value?.trim();
      const title = document.getElementById("ls_title")?.value?.trim();
      if (!code || !title) {
        toast("Code and title required.");
        return;
      }
      state.loyaltyStandards.push({
        id: uid(),
        code,
        title,
        description: document.getElementById("ls_desc")?.value?.trim() || "",
      });
      saveState();
      closeModal();
      toast("Standard added.");
      render();
    };
  });
  document.querySelectorAll("[data-del-std]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.loyaltyStandards = state.loyaltyStandards.filter((x) => x.id !== btn.dataset.delStd);
      saveState();
      render();
    });
  });
  document.getElementById("btnAddScheme")?.addEventListener("click", () => {
    openModal(
      "Add loyalty scheme",
      `<div class="field"><label>Name *</label><input class="input" id="sch_name" /></div>
      <div class="field"><label>Standard reference</label><input class="input" id="sch_ref" placeholder="Link to governance code" /></div>
      <div class="field"><label>Accrual rule</label><textarea class="textarea" id="sch_acc"></textarea></div>
      <div class="field"><label>Expiry (months)</label><input class="input" type="number" id="sch_exp" value="24" min="0" /></div>`,
      `<button type="button" class="btn ghost" id="schx">Cancel</button><button type="button" class="btn" id="schs">Save</button>`
    );
    document.getElementById("schx").onclick = closeModal;
    document.getElementById("schs").onclick = () => {
      const name = document.getElementById("sch_name")?.value?.trim();
      if (!name) {
        toast("Name required.");
        return;
      }
      state.loyaltySchemes.push({
        id: uid(),
        name,
        standardRef: document.getElementById("sch_ref")?.value?.trim() || "",
        accrualRule: document.getElementById("sch_acc")?.value?.trim() || "",
        expiryMonths: Number(document.getElementById("sch_exp")?.value) || 0,
        active: true,
      });
      saveState();
      closeModal();
      toast("Scheme added.");
      render();
    };
  });
  document.querySelectorAll("[data-toggle-scheme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = state.loyaltySchemes.find((x) => x.id === btn.dataset.toggleScheme);
      if (s) s.active = !s.active;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-del-scheme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.delScheme;
      state.loyaltySchemes = state.loyaltySchemes.filter((x) => x.id !== id);
      state.loyaltyBeneficiaries = state.loyaltyBeneficiaries.filter((x) => x.schemeId !== id);
      state.loyaltyAwards = state.loyaltyAwards.filter((x) => x.schemeId !== id);
      saveState();
      render();
    });
  });
  document.getElementById("btnAddBeneficiary")?.addEventListener("click", () => {
    if (!state.loyaltySchemes.length) {
      toast("Create a loyalty scheme first.");
      return;
    }
    const schOpts = state.loyaltySchemes.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    const custOpts = state.customers.map((k) => `<option value="${k.id}">${escapeHtml(k.name)}</option>`).join("");
    openModal(
      "Add beneficiary",
      `<div class="field"><label>Scheme *</label><select class="field" id="ben_sch">${schOpts}</select></div>
      <div class="field"><label>Customer *</label><select class="field" id="ben_cust">${custOpts}</select></div>
      <div class="field-row">
        <div class="field"><label>Tier</label><input class="input" id="ben_tier" value="Member" /></div>
        <div class="field"><label>Opening points</label><input class="input" type="number" id="ben_pts" value="0" min="0" /></div>
      </div>`,
      `<button type="button" class="btn ghost" id="benx">Cancel</button><button type="button" class="btn" id="bens">Save</button>`
    );
    document.getElementById("benx").onclick = closeModal;
    document.getElementById("bens").onclick = () => {
      state.loyaltyBeneficiaries.push({
        id: uid(),
        schemeId: document.getElementById("ben_sch").value,
        customerId: document.getElementById("ben_cust").value,
        tier: document.getElementById("ben_tier").value.trim() || "Member",
        pointsBalance: Number(document.getElementById("ben_pts").value) || 0,
        status: "Active",
        enrolledAt: new Date().toISOString(),
      });
      saveState();
      closeModal();
      toast("Beneficiary enrolled.");
      render();
    };
  });
  document.querySelectorAll("[data-del-ben]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.loyaltyBeneficiaries = state.loyaltyBeneficiaries.filter((x) => x.id !== btn.dataset.delBen);
      saveState();
      render();
    });
  });
  document.getElementById("btnAddAward")?.addEventListener("click", () => {
    if (!state.loyaltySchemes.length) {
      toast("Create a loyalty scheme first.");
      return;
    }
    const schOpts = state.loyaltySchemes.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    openModal(
      "Add award",
      `<div class="field"><label>Scheme *</label><select class="field" id="awd_sch">${schOpts}</select></div>
      <div class="field"><label>Award name *</label><input class="input" id="awd_name" /></div>
      <div class="field"><label>Points cost *</label><input class="input" type="number" id="awd_cost" min="0" value="1000" /></div>
      <div class="field"><label>Description</label><textarea class="textarea" id="awd_desc"></textarea></div>`,
      `<button type="button" class="btn ghost" id="awdx">Cancel</button><button type="button" class="btn" id="awds">Save</button>`
    );
    document.getElementById("awdx").onclick = closeModal;
    document.getElementById("awds").onclick = () => {
      const name = document.getElementById("awd_name")?.value?.trim();
      if (!name) {
        toast("Award name required.");
        return;
      }
      state.loyaltyAwards.push({
        id: uid(),
        schemeId: document.getElementById("awd_sch").value,
        name,
        pointsCost: Number(document.getElementById("awd_cost").value) || 0,
        description: document.getElementById("awd_desc")?.value?.trim() || "",
        active: true,
      });
      saveState();
      closeModal();
      toast("Award added.");
      render();
    };
  });
  document.querySelectorAll("[data-toggle-award]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = state.loyaltyAwards.find((x) => x.id === btn.dataset.toggleAward);
      if (a) a.active = !a.active;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-del-award]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.loyaltyAwards = state.loyaltyAwards.filter((x) => x.id !== btn.dataset.delAward);
      saveState();
      render();
    });
  });
}

function bindContactLinksHandlers() {
  const custSel = document.getElementById("cr_customer");
  const rowsEl = document.getElementById("cr_branch_rows");
  if (!custSel || !rowsEl) return;

  function rowHtml(customerId, selectedBranch) {
    const opts = branchSelectOptionsHtml(customerId, selectedBranch || "__hq__");
    return `<div class="cr-branch-row card" style="padding:0.65rem 0.75rem;margin-bottom:0.5rem;display:flex;gap:0.75rem;align-items:flex-end;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:200px">
        <label>Branch for this link</label>
        <select class="field cr-br-sel">${opts}</select>
      </div>
      <button type="button" class="btn ghost sm cr-br-rm">Remove</button>
    </div>`;
  }

  function refreshRemoveButtons() {
    const rows = rowsEl.querySelectorAll(".cr-branch-row");
    rows.forEach((row) => {
      const rm = row.querySelector(".cr-br-rm");
      if (rm) rm.style.visibility = rows.length > 1 ? "visible" : "hidden";
    });
  }

  function rebuildRows(preserveSelections) {
    const cid = custSel.value;
    const prev = preserveSelections
      ? Array.from(rowsEl.querySelectorAll(".cr-br-sel")).map((s) => s.value)
      : [];
    const count = preserveSelections && prev.length ? prev.length : 1;
    rowsEl.innerHTML = "";
    for (let i = 0; i < count; i++) {
      rowsEl.insertAdjacentHTML("beforeend", rowHtml(cid, prev[i] || "__hq__"));
    }
    refreshRemoveButtons();
  }

  rowsEl.addEventListener("click", (e) => {
    const rm = e.target.closest(".cr-br-rm");
    if (!rm || !rowsEl.contains(rm)) return;
    if (rowsEl.querySelectorAll(".cr-branch-row").length <= 1) return;
    rm.closest(".cr-branch-row")?.remove();
    refreshRemoveButtons();
  });

  custSel.onchange = () => rebuildRows(false);
  rebuildRows(false);

  document.getElementById("cr_add_row")?.addEventListener("click", () => {
    const cid = custSel.value;
    rowsEl.insertAdjacentHTML("beforeend", rowHtml(cid, "__hq__"));
    refreshRemoveButtons();
  });

  document.getElementById("cr_save")?.addEventListener("click", () => {
    const customerId = custSel.value;
    const representativeContactId = document.getElementById("cr_rep")?.value;
    if (!customerId || !representativeContactId) {
      toast("Select customer and representative.");
      return;
    }
    const branchVals = Array.from(rowsEl.querySelectorAll(".cr-br-sel")).map((s) => s.value);
    if (!branchVals.length) {
      toast("Add at least one branch link.");
      return;
    }
    const seen = new Set();
    let added = 0;
    for (const bv of branchVals) {
      const branchId = bv === "__hq__" ? null : bv;
      const key = `${customerId}|${representativeContactId}|${branchId || "__hq__"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const dup = state.repBranchLinks.some(
        (x) =>
          x.customerId === customerId &&
          x.representativeContactId === representativeContactId &&
          (x.branchId || null) === branchId
      );
      if (dup) continue;
      state.repBranchLinks.push({
        id: uid(),
        customerId,
        representativeContactId,
        branchId,
        createdAt: new Date().toISOString(),
      });
      added++;
    }
    if (!added) {
      toast("No new links (duplicates skipped).");
      return;
    }
    saveState();
    toast(`Saved ${added} link(s).`);
    render();
  });

  document.querySelectorAll("[data-remove-rbl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.removeRbl;
      state.repBranchLinks = state.repBranchLinks.filter((x) => x.id !== id);
      saveState();
      toast("Link removed.");
      render();
    });
  });
}

function bindCaseInformationSourceHandlers(opts = {}) {
  const afterChange = () => {
    saveState();
    if (opts.inNewCaseForm) refreshNewCaseInfoSourceUi();
    else render();
  };
  document.getElementById("cis_add")?.addEventListener("click", () => {
    const label = document.getElementById("cis_new_label")?.value?.trim();
    if (!label) {
      toast("Enter a source label.");
      return;
    }
    const id = `cis_${uid().slice(4)}`;
    state.caseInformationSources = state.caseInformationSources || [];
    state.caseInformationSources.push({ id, label, active: true });
    toast(`Added contact source "${label}".`);
    afterChange();
  });
  document.querySelectorAll("[data-cis-save]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.cisSave;
      const row = state.caseInformationSources.find((s) => s.id === id);
      if (!row) return;
      const label = document.querySelector(`[data-cis-label="${id}"]`)?.value?.trim();
      if (!label) {
        toast("Label cannot be empty.");
        return;
      }
      row.label = label;
      row.active = document.querySelector(`[data-cis-active="${id}"]`)?.checked !== false;
      for (const c of state.cases) {
        if (c.informationSourceId === id) c.informationSourceLabel = row.label;
      }
      toast("Contact source saved.");
      afterChange();
    });
  });
  document.querySelectorAll("[data-cis-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.cisDel;
      if ((state.caseInformationSources || []).length <= 1) {
        toast("Keep at least one contact source.");
        return;
      }
      const inUse = state.cases.some((c) => c.informationSourceId === id);
      if (inUse) {
        toast("Source is used on cases; deactivate instead of removing.");
        return;
      }
      state.caseInformationSources = state.caseInformationSources.filter((s) => s.id !== id);
      if (state.defaultInformationSourceId === id) {
        state.defaultInformationSourceId = state.caseInformationSources[0]?.id;
      }
      if (state.selfcareInformationSourceId === id) {
        state.selfcareInformationSourceId = state.defaultInformationSourceId;
      }
      toast("Contact source removed.");
      afterChange();
    });
  });
}

function bindNewCaseHandlers() {
  const view = document.getElementById("view");
  view?.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.route = btn.dataset.route;
      if (btn.dataset.route === "cases") state.detailCaseId = null;
      saveState();
      render();
    });
  });
  bindCaseInformationSourceHandlers({ inNewCaseForm: true });
  bindNigeriaLocationCascade("nc_nigeria_state", "nc_nigeria_lga");

  const custSel = document.getElementById("nc_cust");
  const locSel = document.getElementById("nc_loc");
  const parSel = document.getElementById("nc_par");
  const ncGrp = document.getElementById("nc_case_group");
  const ncTyp = document.getElementById("nc_case_type");
  function refillNcTypes() {
    if (!ncGrp || !ncTyp) return;
    const g = catalogGroupById(ncGrp.value);
    ncTyp.innerHTML = (g?.caseTypes || [])
      .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</option>`)
      .join("");
  }
  function refillLocs() {
    const cid = custSel?.value;
    const brs = state.branches.filter((b) => b.customerId === cid);
    if (!locSel) return;
    locSel.innerHTML = `<option value="__hq__">HQ / Parent (no branch)</option>${brs.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("")}`;
  }
  function refillParents() {
    const cid = custSel?.value;
    const pars = state.cases.filter((c) => !c.parentCaseId && c.customerId === cid);
    if (!parSel) return;
    parSel.innerHTML = `<option value="">— None —</option>${pars.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(caseDisplayId(p))}</option>`).join("")}`;
  }
  ncGrp?.addEventListener("change", refillNcTypes);
  custSel?.addEventListener("change", () => {
    refillLocs();
    refillParents();
  });
  document.getElementById("ncs")?.addEventListener("click", () => {
    const title = document.getElementById("nc_title")?.value?.trim();
    if (!title) {
      toast("Title required.");
      return;
    }
    const customerId = custSel?.value;
    const locVal = locSel?.value || "__hq__";
    const branchId = locVal === "__hq__" ? null : locVal;
    const br = branchId ? branchById(branchId) : null;
    const suffix = locVal === "__hq__" ? "HQ" : br?.name || "Location";
    const caseGroupId = ncGrp?.value || state.caseGroupCatalog[0]?.id;
    const caseTypeId = ncTyp?.value || state.caseGroupCatalog[0]?.caseTypes[0]?.id;
    const parentCaseId = parSel?.value || null;
    const resolutionStatus = document.getElementById("nc_res")?.value;
    const categoryEl = document.getElementById("nc_category");
    const type = categoryEl?.value && CASE_CATEGORIES.includes(categoryEl.value) ? categoryEl.value : "Request";
    const description = document.getElementById("nc_desc")?.value ?? "";
    const assigneeId = document.getElementById("nc_assignee")?.value || state.currentUserId;
    const infoSourceId = document.getElementById("nc_info_source")?.value;
    if (!infoSourceId || !informationSourceById(infoSourceId)) {
      toast("Select a source of contact.");
      return;
    }
    const nigeriaState = document.getElementById("nc_nigeria_state")?.value?.trim() || "";
    const nigeriaLga = document.getElementById("nc_nigeria_lga")?.value?.trim() || "";
    if (!nigeriaState || !nigeriaLga) {
      toast("Select state and local government area.");
      return;
    }
    state.defaultInformationSourceId = infoSourceId;
    const ag = agentById(assigneeId);
    const id = uid();
    const caseId = nextCaseDisplayId();
    const row = {
      id,
      caseId,
      parentCaseId,
      customerId,
      branchId,
      nigeriaState,
      nigeriaLga,
      title: `${title} — ${suffix}`,
      type,
      status: "New",
      resolutionStatus,
      assignedUserId: assigneeId || null,
      teamId: ag?.teamId || state.currentUserTeamId,
      departmentId: ag?.departmentId || state.currentUserDeptId,
      description,
      createdAt: new Date().toISOString(),
      trackProgress: {},
      source: "agent",
      caseNote: { body: "", updatedById: null, updatedByName: null, updatedAt: null },
      caseNoteHistory: [],
      audit: [{ t: new Date().toISOString(), msg: `Case ${caseId} created (${suffix}); assignee ${assigneeDisplayName(assigneeId)}` }],
    };
    applyInformationSourceToRow(row, infoSourceId);
    attachCaseCatalogToRow(row, caseGroupId, caseTypeId, state.caseGroupCatalog, state.escalationByGroup);
    ensureFunctionalEscalation(row);
    applyCaseCreatorToRow(row, state.currentUserId);
    const slaNote = row.globalSla ? ` SLA: ${row.globalSla.durationHours}h due, +${row.globalSla.overdueOffsetHours}h overdue` : "";
    row.audit[row.audit.length - 1].msg += ` · Created by ${row.createdByName} · Category: ${type} · Priority: ${row.priority} · Source of contact: ${row.informationSourceLabel} · ${nigeriaState}/${nigeriaLga}${slaNote}`;
    state.cases.push(row);
    state.notifications.push({
      id: uid(),
      text: `Created case ${caseId} "${row.title}".`,
      at: new Date().toISOString(),
    });
    saveState();
    toast("Case created.");
    state.route = "cases";
    state.detailCaseId = id;
    render();
  });
}

function bindCaseCatalogHandlers() {
  document.getElementById("cat_add_group")?.addEventListener("click", () => {
    const label = document.getElementById("cat_new_group_label")?.value?.trim();
    if (!label) {
      toast("Enter a case group label.");
      return;
    }
    const id = `cg_${uid().slice(3)}`;
    state.caseGroupCatalog.push({
      id,
      label,
      escalationKey: "Enterprise",
      caseTypes: [defaultCatalogCaseType("Case type")],
    });
    saveState();
    toast(`Added case group "${label}".`);
    render();
  });
  document.querySelectorAll("[data-cat-save-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.catSaveGroup;
      const g = catalogGroupById(gid);
      if (!g) return;
      const labelInp = document.querySelector(`[data-cat-label="${gid}"]`);
      const escSel = document.querySelector(`[data-cat-esc="${gid}"]`);
      const label = labelInp?.value?.trim();
      if (!label) {
        toast("Group label is required.");
        return;
      }
      g.label = label;
      g.escalationKey = escSel?.value || g.escalationKey || "Enterprise";
      delete g.defaultPriority;
      saveState();
      toast(`Saved case group "${g.label}".`);
      render();
    });
  });
  document.querySelectorAll("[data-cat-save-sla]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.catSaveSla;
      const tid = btn.dataset.typeId;
      const g = catalogGroupById(gid);
      const t = g?.caseTypes?.find((x) => x.id === tid);
      if (!t) return;
      const durInp = document.querySelector(`[data-cat-sla-dur="${gid}"][data-type-id="${tid}"]`);
      const overInp = document.querySelector(`[data-cat-sla-over="${gid}"][data-type-id="${tid}"]`);
      const impactSel = document.querySelector(`[data-cat-impact="${gid}"][data-type-id="${tid}"]`);
      const urgencySel = document.querySelector(`[data-cat-urgency="${gid}"][data-type-id="${tid}"]`);
      const durationHours = Number(durInp?.value);
      const overdueOffsetHours = Number(overInp?.value);
      const impact = impactSel?.value;
      const urgency = urgencySel?.value;
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        toast("Due hours must be a positive number.");
        return;
      }
      if (!Number.isFinite(overdueOffsetHours) || overdueOffsetHours < 0) {
        toast("Overdue offset must be zero or greater.");
        return;
      }
      if (!impact || !IMPACT_LEVELS.includes(impact)) {
        toast("Select a valid impact.");
        return;
      }
      if (!urgency || !URGENCY_LEVELS.includes(urgency)) {
        toast("Select a valid urgency.");
        return;
      }
      t.sla = { durationHours: Math.round(durationHours), overdueOffsetHours: Math.round(overdueOffsetHours) };
      t.impact = impact;
      t.urgency = urgency;
      normalizeCaseTypeDef(t);
      saveState();
      toast(`Saved policy for "${t.label}".`);
      render();
    });
  });
  document.querySelectorAll("[data-cat-add-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.catAddType;
      const g = catalogGroupById(gid);
      if (!g) return;
      const inp = document.querySelector(`[data-cat-new-type-label="${gid}"]`);
      const label = inp?.value?.trim();
      if (!label) {
        toast("Enter a case type label.");
        return;
      }
      g.caseTypes.push(defaultCatalogCaseType(label));
      saveState();
      toast(`Added type "${label}".`);
      render();
    });
  });
  document.querySelectorAll("[data-cat-del-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.catDelType;
      const tid = btn.dataset.typeId;
      const g = catalogGroupById(gid);
      if (!g || g.caseTypes.length <= 1) {
        toast("Each group must keep at least one case type.");
        return;
      }
      const inUse = state.cases.some((c) => c.caseGroupId === gid && c.caseTypeId === tid);
      if (inUse && !confirm("Cases reference this type. Remove anyway?")) return;
      g.caseTypes = g.caseTypes.filter((t) => t.id !== tid);
      saveState();
      toast("Case type removed.");
      render();
    });
  });
  document.querySelectorAll("[data-cat-del-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.catDelGroup;
      if ((state.caseGroupCatalog || []).length <= 1) {
        toast("At least one case group is required.");
        return;
      }
      const inUse = state.cases.some((c) => c.caseGroupId === gid);
      if (inUse && !confirm("Cases reference this group. Remove anyway?")) return;
      state.caseGroupCatalog = state.caseGroupCatalog.filter((g) => g.id !== gid);
      if (state.selfcareCaseGroupId === gid) {
        state.selfcareCaseGroupId = state.caseGroupCatalog[0]?.id;
        state.selfcareCaseTypeId = state.caseGroupCatalog[0]?.caseTypes[0]?.id;
      }
      saveState();
      toast("Case group removed.");
      render();
    });
  });
}

function bindPriorityConfigHandlers() {
  document.getElementById("pri_matrix_save")?.addEventListener("click", () => {
    const next = defaultPriorityMatrix();
    for (const impact of IMPACT_LEVELS) {
      for (const urgency of URGENCY_LEVELS) {
        const sel = document.querySelector(`[data-pri-impact="${impact}"][data-pri-urgency="${urgency}"]`);
        const v = sel?.value;
        next[impact][urgency] = SELFCARE_PRIORITIES.includes(v) ? v : next[impact][urgency];
      }
    }
    state.priorityMatrix = normalizePriorityMatrix(next);
    saveState();
    toast("Priority matrix saved.");
    render();
  });
}

function bindEscalationGroupsHandlers() {
  function addEmailToGroup(gid, rawEmail) {
    const g = escalationNotifyGroupById(gid);
    if (!g) {
      toast("Group not found.");
      return false;
    }
    const email = (rawEmail || "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("Enter a valid email address.");
      return false;
    }
    g.emails = g.emails || [];
    if (g.emails.includes(email)) {
      toast("Email already in this group.");
      return false;
    }
    g.emails.push(email);
    saveState();
    toast("Email added.");
    render();
    return true;
  }

  function createHierarchicalEscalationGroup(role) {
    const def = hierarchicalEscalationGroupDef(role);
    if (!def) return false;
    state.escalationNotifyGroups = state.escalationNotifyGroups || [];
    const exists = state.escalationNotifyGroups.some((g) => g.id === def.id || g.hierarchicalRole === role);
    if (exists) return false;
    state.escalationNotifyGroups.push(buildHierarchicalEscalationGroup(def));
    const assignments = state.escalationLevelAssignments || defaultEscalationLevelAssignments();
    assignments.hierarchical = assignments.hierarchical || {};
    assignments.hierarchical[role] = def.id;
    state.escalationLevelAssignments = assignments;
    return true;
  }

  document.getElementById("eng_create_all_hierarchical")?.addEventListener("click", () => {
    let created = 0;
    for (const role of HIERARCHICAL_ESCALATION_ROLES) {
      if (createHierarchicalEscalationGroup(role)) created += 1;
    }
    if (!created) {
      toast("All four hierarchical groups already exist.");
      return;
    }
    saveState();
    toast(`Created ${created} hierarchical group(s).`);
    render();
  });

  document.querySelectorAll("[data-eng-hier-create]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.dataset.engHierCreate;
      if (!createHierarchicalEscalationGroup(role)) {
        toast(`${role} group already exists.`);
        return;
      }
      saveState();
      toast(`Created ${role} escalation group.`);
      render();
    });
  });

  document.querySelectorAll("[data-eng-hier-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.engHierAdd;
      const input = document.querySelector(`[data-eng-hier-add-input="${gid}"]`);
      addEmailToGroup(gid, input?.value);
      if (input) input.value = "";
    });
  });

  document.getElementById("eng_create")?.addEventListener("click", () => {
    const label = document.getElementById("eng_new_label")?.value?.trim();
    if (!label) {
      toast("Enter a group name.");
      return;
    }
    const id = `eng_${uid().slice(3)}`;
    state.escalationNotifyGroups = state.escalationNotifyGroups || [];
    state.escalationNotifyGroups.push({ id, label, emails: [], createdAt: new Date().toISOString() });
    state.escalationNotifyManageGroupId = id;
    saveState();
    toast(`Created group "${label}".`);
    render();
  });

  document.querySelectorAll("[data-eng-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.escalationNotifyManageGroupId = btn.dataset.engPick;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-eng-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.engDel;
      const target = escalationNotifyGroupById(gid);
      if (isHierarchicalEscalationGroup(target)) {
        toast("Hierarchical groups are managed in the leadership section above — use Remove email instead.");
        return;
      }
      if (!confirm("Delete this escalation group? Level assignments using it will be cleared.")) return;
      state.escalationNotifyGroups = (state.escalationNotifyGroups || []).filter((g) => g.id !== gid);
      const assignments = state.escalationLevelAssignments || defaultEscalationLevelAssignments();
      for (const level of FUNCTIONAL_ESCALATION_LEVELS) {
        if (assignments.functional?.[level.id] === gid) assignments.functional[level.id] = null;
      }
      for (const lvl of ESCALATION_HIERARCHICAL_LEVELS) {
        if (assignments.hierarchical?.[lvl] === gid) assignments.hierarchical[lvl] = null;
      }
      state.escalationLevelAssignments = assignments;
      if (state.escalationNotifyManageGroupId === gid) {
        state.escalationNotifyManageGroupId = state.escalationNotifyGroups[0]?.id || null;
      }
      saveState();
      toast("Group deleted.");
      render();
    });
  });

  document.getElementById("eng_add_email_btn")?.addEventListener("click", () => {
    const gid = state.escalationNotifyManageGroupId;
    const g = escalationNotifyGroupById(gid);
    if (!g || isHierarchicalEscalationGroup(g)) {
      toast("Select a functional/custom group first.");
      return;
    }
    const email = document.getElementById("eng_add_email")?.value?.trim();
    if (addEmailToGroup(gid, email)) {
      const input = document.getElementById("eng_add_email");
      if (input) input.value = "";
    }
  });

  document.querySelectorAll("[data-eng-rm-email]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.engRmEmail;
      const email = btn.dataset.engEmail;
      const g = escalationNotifyGroupById(gid);
      if (!g) return;
      g.emails = (g.emails || []).filter((e) => e !== email);
      saveState();
      toast("Email removed.");
      render();
    });
  });

  document.querySelectorAll("[data-eng-func]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const hint = sel.closest(".eng-assign-field")?.querySelector(".eng-assign-hint");
      const group = escalationNotifyGroupById(sel.value || null);
      if (hint) hint.textContent = group ? escalationGroupEmailsDisplay(group) : "—";
    });
  });

  document.querySelectorAll("[data-eng-hier-key]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const hint = sel.closest(".eng-assign-field")?.querySelector(".eng-assign-hint");
      const group = escalationNotifyGroupById(sel.value || null);
      if (hint) hint.textContent = group ? escalationGroupEmailsDisplay(group) : "—";
    });
  });

  document.getElementById("eng_save_assignments")?.addEventListener("click", () => {
    const functional = {};
    for (const level of FUNCTIONAL_ESCALATION_LEVELS) {
      const sel = document.querySelector(`[data-eng-func="${level.id}"]`);
      functional[level.id] = sel?.value || null;
    }
    const hierarchical = { Agent: null };
    document.querySelectorAll("[data-eng-hier-key]").forEach((sel) => {
      hierarchical[sel.dataset.engHierKey] = sel.value || null;
    });
    state.escalationLevelAssignments = normalizeEscalationLevelAssignments(
      { functional, hierarchical },
      state.escalationNotifyGroups
    );
    saveState();
    toast("Escalation level assignments saved.");
    render();
  });
}

function bindEscalationHandlers() {
  document.getElementById("esc_save_timeouts")?.addEventListener("click", () => {
    const next = {};
    for (const level of FUNCTIONAL_ESCALATION_LEVELS) {
      const pickupEl = document.getElementById(`esc_pickup_${level.id}`);
      const resolutionEl = document.getElementById(`esc_resolution_${level.id}`);
      const pickup = Number(pickupEl?.value);
      const resolution = Number(resolutionEl?.value);
      next[level.id] = {
        pickupMins:
          Number.isFinite(pickup) && pickup > 0 ? Math.round(pickup) : DEFAULT_FUNC_LEVEL_PICKUP_MINS,
        resolutionMins:
          Number.isFinite(resolution) && resolution > 0 ? Math.round(resolution) : DEFAULT_FUNC_LEVEL_RESOLUTION_MINS,
      };
    }
    state.functionalEscalationConfig = normalizeFunctionalEscalationConfig(next);
    saveState();
    toast("Level timers saved.");
    render();
  });

  document.querySelectorAll("[data-esc-manual]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = state.cases.find((x) => x.id === btn.dataset.escManual);
      if (!c) return;
      if (escalateCaseFunctional(c, "manual")) {
        saveState();
        toast(`Case escalated to ${functionalLevelByIndex(c.functionalIndex).team}.`);
        render();
      }
    });
  });

  document.querySelectorAll("[data-open-case]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (typeof openCaseForReview === "function") openCaseForReview(btn.dataset.openCase, "cases");
      else {
        state.detailCaseId = btn.dataset.openCase;
        state.route = "cases";
        saveState();
        render();
      }
    });
  });

  document.querySelectorAll("[data-save-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".config-card");
      const name = btn.dataset.saveGroup;
      const taH = card?.querySelector("textarea[data-esc-h]");
      const hierarchical = (taH?.value || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!hierarchical.length) {
        toast("Enter at least one hierarchical role.");
        return;
      }
      const prev = state.escalationByGroup[name] || {};
      state.escalationByGroup[name] = {
        hierarchical,
        functional: FUNCTIONAL_ESCALATION_LEVELS.map((l) => l.step),
      };
      saveState();
      toast(`Saved hierarchical template "${name}".`);
      render();
    });
  });

  document.getElementById("btnAddGroup")?.addEventListener("click", () => {
    const raw = document.getElementById("newGroupName")?.value?.trim();
    if (!raw) {
      toast("Enter a template name.");
      return;
    }
    const name = raw.replace(/\s+/g, " ");
    if (state.escalationByGroup[name]) {
      toast("Template already exists.");
      return;
    }
    state.escalationByGroup[name] = {
      hierarchical: ["Agent", "Lead", "Manager"],
      functional: FUNCTIONAL_ESCALATION_LEVELS.map((l) => l.step),
    };
    saveState();
    toast(`Added template "${name}".`);
    render();
  });
}

function bindCasesHandlers() {
  document.getElementById("btnNewCase")?.addEventListener("click", () => {
    state.route = CASE_NEW_ROUTE;
    state.detailCaseId = null;
    saveState();
    render();
  });

  const openFromList = (caseId) => openCaseForReview(caseId, "cases");

  document.querySelectorAll(".cases-registry-table tbody tr[data-open-case]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".case-review-btn")) return;
      openFromList(row.dataset.openCase);
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFromList(row.dataset.openCase);
      }
    });
  });

  document.querySelectorAll(".case-review-btn[data-open-case]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openFromList(btn.dataset.openCase);
    });
  });
}

/*
function __removedBindCasesHandlersModal() {
  if (false) openModal(
      "New case",
      `<div class="field"><label>Title *</label><input class="input" id="nc_title" /></div>
      <div class="field-row">
        <div class="field"><label>Customer *</label><select class="field" id="nc_cust">${custOpts}</select></div>
        <div class="field"><label>Location *</label><select class="field" id="nc_loc"><option value="__hq__">HQ / Parent</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Case group *</label><select class="field" id="nc_case_group">${groupOptsNc}</select></div>
        <div class="field"><label>Case type *</label><select class="field" id="nc_case_type">${typeOptsNc}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Source of information *</label><select class="field" id="nc_info_source">${infoSrcOptsNc}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Priority</label><select class="field" id="nc_pr">${prOptsNc}</select></div>
        <div class="field"><label>Resolution status *</label><select class="field" id="nc_res">${resOpts}</select></div>
        <div class="field"><label>Assignee</label><select class="field" id="nc_assignee">${assigneeOpts}</select></div>
      </div>
      <div class="field"><label>Parent case (optional)</label><select class="field" id="nc_par"><option value="">— None —</option></select></div>
      <div class="field"><label>Description</label><textarea class="textarea" id="nc_desc"></textarea></div>
      <p class="muted" style="margin:0;font-size:0.82rem">For multiple locations, use <strong>Selfcare</strong> (one case per branch).</p>`,
      `<button type="button" class="btn ghost" id="ncx">Cancel</button><button type="button" class="btn" id="ncs">Create case</button>`
    );
    const custSel = document.getElementById("nc_cust");
    const locSel = document.getElementById("nc_loc");
    const parSel = document.getElementById("nc_par");
    const ncGrp = document.getElementById("nc_case_group");
    const ncTyp = document.getElementById("nc_case_type");
    function refillNcTypes() {
      if (!ncGrp || !ncTyp) return;
      const g = catalogGroupById(ncGrp.value);
      ncTyp.innerHTML = (g?.caseTypes || [])
        .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</option>`)
        .join("");
    }
    function refillLocs() {
      const cid = custSel.value;
      const brs = state.branches.filter((b) => b.customerId === cid);
      if (!locSel) return;
      locSel.innerHTML = `<option value="__hq__">HQ / Parent (no branch)</option>${brs.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("")}`;
    }
    function refillParents() {
      const cid = custSel.value;
      const pars = state.cases.filter((c) => !c.parentCaseId && c.customerId === cid);
      parSel.innerHTML = `<option value="">— None —</option>${pars.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(caseDisplayId(p))}</option>`).join("")}`;
    }
    ncGrp.onchange = () => refillNcTypes();
    custSel.onchange = () => {
      refillLocs();
      refillParents();
    };
    refillNcTypes();
    refillLocs();
    refillParents();
    document.getElementById("ncx").onclick = closeModal;
    document.getElementById("ncs").onclick = () => {
      const title = document.getElementById("nc_title").value.trim();
      if (!title) {
        toast("Title required.");
        return;
      }
      const customerId = custSel.value;
      const locVal = locSel?.value || "__hq__";
      const branchId = locVal === "__hq__" ? null : locVal;
      const br = branchId ? branchById(branchId) : null;
      const suffix = locVal === "__hq__" ? "HQ" : br?.name || "Location";
      const caseGroupId = ncGrp?.value || state.caseGroupCatalog[0]?.id;
      const caseTypeId = ncTyp?.value || state.caseGroupCatalog[0]?.caseTypes[0]?.id;
      const parentCaseId = parSel.value || null;
      const resolutionStatus = document.getElementById("nc_res").value;
      const type = document.getElementById("nc_type").value;
      const prEl = document.getElementById("nc_pr");
      const priority = prEl?.value && SELFCARE_PRIORITIES.includes(prEl.value) ? prEl.value : "P3-Medium";
      const description = document.getElementById("nc_desc").value;
      const assigneeId = document.getElementById("nc_assignee")?.value || state.currentUserId;
      const infoSourceId = document.getElementById("nc_info_source")?.value;
      if (!infoSourceId || !informationSourceById(infoSourceId)) {
        toast("Select a source of contact.");
        return;
      }
*/

function bindCommunicationsHandlers() {
  document.getElementById("comm_apply_filter")?.addEventListener("click", () => {
    state.commFilterContact = document.getElementById("comm_f_ct")?.value || "";
    state.commFilterChannel = document.getElementById("comm_f_ch")?.value || "";
    saveState();
    render();
  });
  document.getElementById("btnNewComm")?.addEventListener("click", () => {
    const opts = state.contacts.map((c) => `<option value="${c.id}">${escapeHtml(contactDisplayName(c))}</option>`).join("");
    const chOpts = COMM_CHANNELS.map((c) => `<option>${escapeHtml(c)}</option>`).join("");
    openModal(
      "New communication",
      `<div class="field"><label>Contact *</label><select class="field" id="ncm_ct">${opts}</select></div>
      <div class="field-row">
        <div class="field"><label>Channel *</label><select class="field" id="ncm_ch">${chOpts}</select></div>
        <div class="field"><label>Direction</label>
          <select class="field" id="ncm_dir"><option value="out">Outbound</option><option value="in">Inbound</option></select>
        </div>
      </div>
      <div class="field"><label>Subject</label><input class="input" id="ncm_sub" placeholder="Thread subject" /></div>
      <div class="field"><label>Message *</label><textarea class="textarea" id="ncm_body" placeholder="Email body, chat transcript note, call summary…"></textarea></div>
      <div class="field"><label>Virtual meeting URL (optional)</label><input class="input" id="ncm_url" placeholder="https://…" /></div>`,
      `<button type="button" class="btn ghost" id="ncmx">Cancel</button><button type="button" class="btn" id="ncms">Send / log</button>`
    );
    document.getElementById("ncmx").onclick = closeModal;
    document.getElementById("ncms").onclick = () => {
      const body = document.getElementById("ncm_body")?.value?.trim();
      if (!body) {
        toast("Message body required.");
        return;
      }
      const rec = {
        id: uid(),
        contactId: document.getElementById("ncm_ct").value,
        channel: document.getElementById("ncm_ch").value,
        direction: document.getElementById("ncm_dir").value || "out",
        subject: document.getElementById("ncm_sub")?.value?.trim() || "",
        body,
        meetingUrl: document.getElementById("ncm_url")?.value?.trim() || "",
        at: new Date().toISOString(),
      };
      state.communications.push(rec);
      state.interactions.push({
        id: rec.id,
        contactId: rec.contactId,
        channel: rec.channel,
        summary: rec.subject ? `${rec.subject}: ${rec.body}`.slice(0, 500) : rec.body,
        followUpAt: null,
        at: rec.at,
      });
      saveState();
      closeModal();
      toast("Communication logged.");
      render();
    };
  });
}

function bindCustomerEmailHandlers() {
  const templates = state.customerEmailTemplates || defaultCustomerEmailTemplates();
  const tplSel = document.getElementById("ce_template");
  const subjectEl = document.getElementById("ce_subject");
  const bodyEl = document.getElementById("ce_body");

  function updateSendCount() {
    const n = document.querySelectorAll(".ce_recipient_cb:checked").length;
    const sendBtn = document.getElementById("ce_send_selected");
    if (sendBtn) sendBtn.textContent = `Send to selected (${n})`;
  }

  function persistSelectedFromDom() {
    const keys = [...document.querySelectorAll(".ce_recipient_cb:checked")].map((el) => el.value);
    state.customerEmailSelectedKeys = keys;
    saveState();
  }

  function fillFromTemplate() {
    const tpl = templates.find((t) => t.id === tplSel?.value) || templates[0];
    if (!tpl) return;
    state.customerEmailTemplateId = tpl.id;
    const recipients = customerEmailRecipientsForActiveSource();
    const selectedSet = customerEmailSelectedSet(recipients);
    const sample =
      recipients.find((r) => selectedSet.has(r.key)) ||
      recipients[0] || {
        customerName: "Sample Customer",
        contactName: "Primary contact",
        email: "contact@example.com",
      };
    const filled = applyCustomerEmailTemplate(tpl, sample);
    if (subjectEl) subjectEl.value = filled.subject;
    if (bodyEl) bodyEl.value = filled.body;
    saveState();
  }

  tplSel?.addEventListener("change", fillFromTemplate);
  document.getElementById("ce_preview_sample")?.addEventListener("click", fillFromTemplate);

  document.getElementById("ce_recipient_source")?.addEventListener("change", (e) => {
    state.customerEmailActiveGroupId = e.target.value;
    state.customerEmailSelectedKeys = [];
    saveState();
    render();
  });

  document.getElementById("ceg_create")?.addEventListener("click", () => {
    const label = document.getElementById("ceg_new_label")?.value?.trim();
    if (!label) {
      toast("Enter a group name.");
      return;
    }
    const id = `ceg_${uid().slice(3)}`;
    state.customerEmailGroups = state.customerEmailGroups || [];
    state.customerEmailGroups.push({ id, label, members: [], createdAt: new Date().toISOString() });
    state.customerEmailManageGroupId = id;
    state.customerEmailActiveGroupId = id;
    state.customerEmailSelectedKeys = [];
    saveState();
    toast(`Created group "${label}".`);
    render();
  });

  document.querySelectorAll("[data-ceg-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.customerEmailManageGroupId = btn.dataset.cegPick;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-ceg-use]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.customerEmailActiveGroupId = btn.dataset.cegUse;
      state.customerEmailSelectedKeys = [];
      saveState();
      toast("Recipient list switched to this group.");
      render();
    });
  });

  document.querySelectorAll("[data-ceg-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.cegDel;
      if (!confirm("Delete this email group and all its members?")) return;
      state.customerEmailGroups = (state.customerEmailGroups || []).filter((g) => g.id !== gid);
      if (state.customerEmailManageGroupId === gid) {
        state.customerEmailManageGroupId = state.customerEmailGroups[0]?.id || null;
      }
      if (state.customerEmailActiveGroupId === gid) {
        state.customerEmailActiveGroupId = CUSTOMER_EMAIL_SOURCE_DIRECTORY;
        state.customerEmailSelectedKeys = [];
      }
      saveState();
      toast("Group deleted.");
      render();
    });
  });

  document.querySelectorAll("[data-ceg-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const gid = btn.dataset.cegRm;
      const mid = btn.dataset.cegMember;
      const g = customerEmailGroupById(gid);
      if (!g) return;
      g.members = (g.members || []).filter((m) => m.id !== mid);
      state.customerEmailSelectedKeys = (state.customerEmailSelectedKeys || []).filter(
        (k) => k !== customerEmailGroupRecipientKey(gid, mid)
      );
      saveState();
      toast("Member removed.");
      render();
    });
  });

  document.getElementById("ceg_add_customer")?.addEventListener("change", (e) => {
    const cid = e.target.value;
    if (!cid) return;
    const info = customerEmailPrimaryContactForCustomer(cid);
    if (!info) {
      toast("No email on file for that customer's primary contact.");
      return;
    }
    const nameEl = document.getElementById("ceg_add_customer_name");
    const contactEl = document.getElementById("ceg_add_contact_name");
    const emailEl = document.getElementById("ceg_add_email");
    if (nameEl) {
      nameEl.value = info.customerName;
      nameEl.dataset.customerId = info.customerId;
      nameEl.dataset.contactId = info.contactId;
    }
    if (contactEl) contactEl.value = info.contactName;
    if (emailEl) emailEl.value = info.email;
  });

  document.getElementById("ceg_add_member")?.addEventListener("click", () => {
    const gid = state.customerEmailManageGroupId;
    const g = customerEmailGroupById(gid);
    if (!g) {
      toast("Select or create a group first.");
      return;
    }
    const customerName = document.getElementById("ceg_add_customer_name")?.value?.trim();
    const contactName = document.getElementById("ceg_add_contact_name")?.value?.trim();
    const email = document.getElementById("ceg_add_email")?.value?.trim();
    const nameEl = document.getElementById("ceg_add_customer_name");
    if (!customerName || !email) {
      toast("Customer name and email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("Enter a valid email address.");
      return;
    }
    const dup = (g.members || []).some((m) => m.email.toLowerCase() === email.toLowerCase());
    if (dup) {
      toast("That email is already in this group.");
      return;
    }
    g.members.push({
      id: `cegm_${uid().slice(3)}`,
      customerId: nameEl?.dataset.customerId || null,
      contactId: nameEl?.dataset.contactId || null,
      customerName,
      contactName: contactName || customerName,
      email,
    });
    document.getElementById("ceg_add_customer_name").value = "";
    document.getElementById("ceg_add_contact_name").value = "";
    document.getElementById("ceg_add_email").value = "";
    if (nameEl) {
      delete nameEl.dataset.customerId;
      delete nameEl.dataset.contactId;
    }
    const custSel = document.getElementById("ceg_add_customer");
    if (custSel) custSel.value = "";
    saveState();
    toast(`Added ${customerName} to "${g.label}".`);
    render();
  });

  document.querySelectorAll(".ce_recipient_cb").forEach((cb) => {
    cb.addEventListener("change", () => {
      persistSelectedFromDom();
      const all = document.querySelectorAll(".ce_recipient_cb");
      const selectAll = document.getElementById("ce_select_all");
      if (selectAll) selectAll.checked = all.length > 0 && [...all].every((x) => x.checked);
      updateSendCount();
    });
  });

  document.getElementById("ce_select_all")?.addEventListener("change", (e) => {
    const on = e.target.checked;
    document.querySelectorAll(".ce_recipient_cb").forEach((cb) => {
      cb.checked = on;
    });
    persistSelectedFromDom();
    updateSendCount();
  });

  document.getElementById("ce_clear_all")?.addEventListener("click", () => {
    document.querySelectorAll(".ce_recipient_cb").forEach((cb) => {
      cb.checked = false;
    });
    const selectAll = document.getElementById("ce_select_all");
    if (selectAll) selectAll.checked = false;
    persistSelectedFromDom();
    updateSendCount();
  });

  document.getElementById("ce_send_selected")?.addEventListener("click", () => {
    const allRecipients = customerEmailRecipientsForActiveSource();
    const selectedSet = customerEmailSelectedSet(allRecipients);
    const recipients = allRecipients.filter((r) => selectedSet.has(r.key));
    if (!recipients.length) {
      toast("Select at least one recipient.");
      return;
    }
    const subject = subjectEl?.value?.trim();
    const body = bodyEl?.value?.trim();
    if (!subject || !body) {
      toast("Subject and body are required.");
      return;
    }
    let opened = 0;
    for (const r of recipients) {
      const filled = applyCustomerEmailTemplate({ subject, body }, r);
      const mailto = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(filled.subject)}&body=${encodeURIComponent(filled.body)}`;
      window.open(mailto, "_blank");
      state.communications.push({
        id: uid(),
        contactId: r.contactId || null,
        channel: "Email",
        direction: "out",
        subject: filled.subject,
        body: filled.body,
        meetingUrl: "",
        at: new Date().toISOString(),
      });
      opened++;
    }
    saveState();
    toast(`Opened ${opened} email draft(s) for selected recipients.`);
  });
}

function renderLogin() {
  cleanupGlobalPickupTimer();
  const loginScreen = document.getElementById("loginScreen");
  const appRoot = document.getElementById("appRoot");
  if (loginScreen) loginScreen.hidden = false;
  if (appRoot) appRoot.hidden = true;
}

function bindLoginHandlers() {
  document.getElementById("loginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = document.getElementById("loginError");
    const username = document.getElementById("loginUsername")?.value || "";
    const password = document.getElementById("loginPassword")?.value || "";
    const user = loginUserByUsername(username);
    if (!user || user.password !== password) {
      if (err) {
        err.textContent = "Invalid username or password.";
        err.hidden = false;
      }
      return;
    }
    setLoggedInUser(user.id);
    syncAuthToState();
    if (err) err.hidden = true;
    state.route = "dashboard";
    state.detailCaseId = null;
    saveState();
    toast(`Welcome, ${user.name}.`);
    render();
  });
}

function logoutUser() {
  cleanupGlobalPickupTimer();
  cleanupEscalationAutoTimer();
  setLoggedInUser(null);
  state.detailCaseId = null;
  state.route = "dashboard";
  render();
}

function render() {
  const auth = getLoggedInUser();
  if (!auth) {
    renderLogin();
    return;
  }
  const loginScreen = document.getElementById("loginScreen");
  const appRoot = document.getElementById("appRoot");
  if (loginScreen) loginScreen.hidden = true;
  if (appRoot) appRoot.hidden = false;
  syncAuthToState();
  if (auth.role === "case_agent" && state.route === "selfcare") {
    state.route = "dashboard";
  }
  renderNav();
  renderRole();
  renderView();
  ensureGlobalPickupTimer();
}

document.getElementById("btnResetDemo")?.addEventListener("click", () => {
  if (confirm("Reset all prototype data to factory demo?")) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("crm_erp_proto_v6");
    localStorage.removeItem("crm_erp_proto_v5");
    localStorage.removeItem("crm_erp_proto_v4");
    localStorage.removeItem("crm_erp_proto_v2");
    localStorage.removeItem("crm_erp_proto_v7");
    state = defaultState();
    state.route = "dashboard";
    state.detailCaseId = null;
    saveState();
    toast("Demo data reset.");
    render();
  }
});

initSidebar();
bindLoginHandlers();
document.getElementById("btnLogout")?.addEventListener("click", () => {
  if (confirm("Sign out?")) logoutUser();
});
render();
