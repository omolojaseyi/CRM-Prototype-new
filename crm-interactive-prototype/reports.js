/**
 * Reports hub — KPIs and charts (route: reports).
 */

const RPT_FILTER_ALL = "__all__";
const RPT_FILTER_SELFCARE = "selfcare";

let _rptCharts = [];

function rptAuth() {
  return typeof getLoggedInUser === "function" ? getLoggedInUser() : null;
}

function rptAgentLabel(id) {
  if (id === RPT_FILTER_SELFCARE) return "Selfcare portal";
  const login = APP_LOGIN_USERS?.find((u) => u.id === id);
  if (login?.name) return login.name;
  const ag = typeof agentById === "function" ? agentById(id) : null;
  return ag?.name || id || "Unknown";
}

function rptDefaultFilterForAuth(auth) {
  if (!auth) return RPT_FILTER_ALL;
  if (auth.role === "case_agent") return auth.id;
  return RPT_FILTER_ALL;
}

function rptFilterOptions(auth) {
  if (!auth) return [{ id: RPT_FILTER_ALL, label: "All users" }];
  if (auth.role === "case_agent") {
    return [{ id: auth.id, label: rptAgentLabel(auth.id) }];
  }
  if (auth.role === "hcce_coordinator") {
    const opts = [{ id: RPT_FILTER_ALL, label: "All Selfcare cases" }];
    const assignees = new Set();
    for (const c of state.cases.filter((x) => x.source === "selfcare" && x.assignedUserId)) {
      assignees.add(c.assignedUserId);
    }
    for (const id of assignees) {
      opts.push({ id, label: `${rptAgentLabel(id)} (assignee)` });
    }
    return opts;
  }
  if (auth.role === "supervisor") {
    const opts = [{ id: RPT_FILTER_ALL, label: "All team & Selfcare" }];
    for (const id of auth.supervises || []) {
      opts.push({ id, label: rptAgentLabel(id) });
    }
    opts.push({ id: RPT_FILTER_SELFCARE, label: "Selfcare portal" });
    return opts;
  }
  const opts = [{ id: RPT_FILTER_ALL, label: "All users" }];
  for (const ag of state.agents || []) {
    if (ag.id) opts.push({ id: ag.id, label: ag.name || ag.id });
  }
  opts.push({ id: RPT_FILTER_SELFCARE, label: "Selfcare portal" });
  return opts;
}

function rptEffectiveFilterId() {
  const auth = rptAuth();
  const opts = rptFilterOptions(auth);
  const stored = state.reportFilterUserId || rptDefaultFilterForAuth(auth);
  if (opts.some((o) => o.id === stored)) return stored;
  return opts[0]?.id || RPT_FILTER_ALL;
}

function rptMatchesUserFilter(c, filterId) {
  if (!filterId || filterId === RPT_FILTER_ALL) return true;
  if (filterId === RPT_FILTER_SELFCARE) return c.source === "selfcare";
  return c.createdByUserId === filterId || c.assignedUserId === filterId;
}

function rptVisibleCases() {
  const scoped = state.cases.filter(caseVisibleForRole);
  const filterId = rptEffectiveFilterId();
  return scoped.filter((c) => rptMatchesUserFilter(c, filterId));
}

function rptCaseStatus(c) {
  if (typeof cmdCaseStatus === "function") return cmdCaseStatus(c);
  const r = c.resolutionStatus || "Open";
  if (r === "Close") return "Closed";
  if (r === "Escalated") return "Escalated";
  if (r === "unresolved") return "Resolved";
  if (r === "Awaiting info/Paused" || r === "Reopen") return "Pending";
  return "Open";
}

function rptMetSla(c) {
  if (typeof cmdResolvedWithinSla === "function") {
    const closed = c.resolutionStatus === "Close" || rptCaseStatus(c) === "Resolved" || rptCaseStatus(c) === "Closed";
    if (closed) return cmdResolvedWithinSla(c) === true;
  }
  const sla = globalSlaStatus(c);
  if (sla.phase === "ontrack" || sla.phase === "complete") return true;
  return false;
}

function rptHasSlaData(c) {
  const g = c.globalSla;
  return g && Number.isFinite(g.durationHours) && g.durationHours > 0;
}

function rptPendingClosure(c) {
  if (c.resolutionStatus === "Close") return false;
  return ["unresolved", "Awaiting info/Paused", "Reopen"].includes(c.resolutionStatus);
}

function rptClosed(c) {
  return c.resolutionStatus === "Close" || rptCaseStatus(c) === "Closed";
}

function rptEscalated(c) {
  return rptCaseStatus(c) === "Escalated" || (c.functionalIndex ?? 0) > 0 || (c.hierarchicalIndex ?? 0) > 0;
}

function rptBuildMetrics(cases, filterId) {
  let metSla = 0;
  let slaEligible = 0;
  for (const c of cases) {
    if (rptHasSlaData(c)) {
      slaEligible++;
      if (rptMetSla(c)) metSla++;
    }
  }
  const customerIds = new Set(cases.map((c) => c.customerId).filter(Boolean));
  const totalCustomers =
    !filterId || filterId === RPT_FILTER_ALL ? (state.customers || []).length : customerIds.size;
  return {
    totalCustomers,
    openCases: cases.filter((c) => c.resolutionStatus !== "Close").length,
    escalatedCases: cases.filter(rptEscalated).length,
    closedCases: cases.filter(rptClosed).length,
    metSla,
    slaEligible,
    pendingClosure: cases.filter(rptPendingClosure).length,
    totalCases: cases.length,
  };
}

function rptStatusCounts(cases) {
  const counts = { Open: 0, Pending: 0, Escalated: 0, Resolved: 0, Closed: 0 };
  for (const c of cases) {
    const st = rptCaseStatus(c);
    if (counts[st] != null) counts[st]++;
  }
  return counts;
}

function rptAgentPerformance(cases) {
  const byAgent = new Map();
  const ensure = (id, name) => {
    if (!byAgent.has(id)) byAgent.set(id, { id, name, created: 0, closed: 0, metSla: 0 });
    return byAgent.get(id);
  };
  for (const ag of state.agents || []) ensure(ag.id, ag.name);
  ensure(RPT_FILTER_SELFCARE, "Selfcare portal");
  for (const c of cases) {
    const creatorId = c.source === "selfcare" ? RPT_FILTER_SELFCARE : c.createdByUserId || c.assignedUserId || "unknown";
    const creatorName =
      c.source === "selfcare"
        ? "Selfcare portal"
        : c.createdByName || (typeof agentById === "function" ? agentById(creatorId)?.name : null) || "Unknown";
    const row = ensure(creatorId, creatorName);
    row.created++;
    if (rptClosed(c)) row.closed++;
    if (rptMetSla(c) && rptHasSlaData(c)) row.metSla++;
  }
  return [...byAgent.values()].filter((a) => a.created > 0).sort((a, b) => b.closed - a.closed || b.created - a.created);
}

function rptCsatScore(c) {
  if (!rptClosed(c)) return null;
  const ok = typeof cmdResolvedWithinSla === "function" ? cmdResolvedWithinSla(c) : rptMetSla(c);
  const seed = String(c.id || "")
    .split("")
    .reduce((n, ch) => n + ch.charCodeAt(0), 0);
  if (ok === true) return 4.2 + (seed % 8) * 0.1;
  if (ok === false) return 2.6 + (seed % 6) * 0.1;
  return 3.4 + (seed % 5) * 0.1;
}

function rptCaseLastUpdated(c) {
  if (typeof cmdLastUpdated === "function") return cmdLastUpdated(c);
  const audits = c.audit || [];
  if (!audits.length) return c.createdAt;
  return audits.reduce((max, a) => (a.t > max ? a.t : max), c.createdAt);
}

function rptCloseMonth(c) {
  if (c.resolutionStatus !== "Close") return null;
  const audits = c.audit || [];
  const closeEntry = [...audits].reverse().find((a) => /→\s*Close/i.test(a.msg || "") || /closed/i.test(a.msg || ""));
  const iso = closeEntry?.t || rptCaseLastUpdated(c) || c.createdAt;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rptSatisfactionTrend(cases) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const buckets = Object.fromEntries(months.map((m) => [m, []]));
  for (const c of cases) {
    const m = rptCloseMonth(c);
    const score = rptCsatScore(c);
    if (m && score != null && buckets[m]) buckets[m].push(score);
  }
  const labels = months.map((m) => {
    const [y, mo] = m.split("-");
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleString(undefined, { month: "short", year: "2-digit" });
  });
  const data = months.map((m) => {
    const arr = buckets[m];
    if (!arr.length) return null;
    return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10;
  });
  return { labels, data, months };
}

function rptCaseDetailRows(cases) {
  return cases.map((c) => {
    const cust = typeof customerById === "function" ? customerById(c.customerId) : null;
    const sla = globalSlaStatus(c);
    let slaMet = "";
    if (rptHasSlaData(c)) slaMet = rptMetSla(c) ? "Yes" : "No";
    return [
      typeof caseDisplayId === "function" ? caseDisplayId(c) : c.caseId || c.id,
      c.title || "",
      rptCaseStatus(c),
      c.priority || "",
      cust?.name || "",
      typeof caseCreatorDisplay === "function" ? caseCreatorDisplay(c) : c.createdByName || "",
      typeof assigneeDisplayName === "function" ? assigneeDisplayName(c.assignedUserId) : "",
      c.resolutionStatus || "",
      slaMet,
      sla.label || "",
      typeof formatDateTime === "function" ? formatDateTime(c.createdAt) : c.createdAt || "",
      typeof formatDateTime === "function" ? formatDateTime(rptCaseLastUpdated(c)) : "",
      c.source === "selfcare" ? "Selfcare" : "Agent",
    ];
  });
}

function rptBuildExportWorkbook(cases, metrics, filterId) {
  if (typeof XLSX === "undefined") return null;
  const auth = rptAuth();
  const slaPct = metrics.slaEligible ? Math.round((metrics.metSla / metrics.slaEligible) * 100) : 0;
  const missed = Math.max(0, metrics.slaEligible - metrics.metSla);
  const wb = XLSX.utils.book_new();

  const summary = [
    ["CRM Reports Export"],
    ["Generated", new Date().toLocaleString()],
    ["Report scope", filterId === RPT_FILTER_ALL ? "All in scope" : rptSelectedLabel(filterId)],
    ["Signed in as", auth?.name || "—"],
    ["Role", auth?.role || "—"],
    [],
    ["Metric", "Value", "Notes"],
    ["Total customers", metrics.totalCustomers, filterId === RPT_FILTER_ALL ? "Master accounts" : "In filtered cases"],
    ["Open cases", metrics.openCases, "Not yet closed"],
    ["Escalated cases", metrics.escalatedCases, "Status or ladder moved"],
    ["Closed cases", metrics.closedCases, "Resolution = Close"],
    ["Met SLA", metrics.metSla, metrics.slaEligible ? `${slaPct}% of ${metrics.slaEligible} with SLA` : "No SLA data"],
    ["Pending closure", metrics.pendingClosure, "Resolved / awaiting close"],
    ["Total cases (scope)", metrics.totalCases, ""],
    ["SLA compliance %", slaPct, ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  const status = rptStatusCounts(cases);
  const statusRows = [["Status", "Count", "% of total"]];
  for (const [label, count] of Object.entries(status)) {
    const pct = metrics.totalCases ? Math.round((count / metrics.totalCases) * 100) : 0;
    statusRows.push([label, count, pct]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(statusRows), "Case Status");

  let agents = rptAgentPerformance(cases);
  if (filterId && filterId !== RPT_FILTER_ALL) agents = agents.filter((a) => a.id === filterId);
  const agentRows = [["Agent", "Cases created", "Cases closed", "Met SLA"]];
  for (const a of agents) agentRows.push([a.name, a.created, a.closed, a.metSla]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(agentRows), "Agent Performance");

  const slaRows = [
    ["SLA compliance"],
    ["Met SLA", metrics.metSla],
    ["Missed SLA", missed],
    ["Total with SLA data", metrics.slaEligible],
    ["Compliance %", slaPct],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(slaRows), "SLA Compliance");

  const trend = rptSatisfactionTrend(cases);
  const csatRows = [["Month", "Average CSAT (1-5)"]];
  trend.labels.forEach((label, i) => csatRows.push([label, trend.data[i] ?? ""]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(csatRows), "CSAT Trend");

  const caseHeader = [
    "Case ID",
    "Title",
    "Status",
    "Priority",
    "Customer",
    "Created by",
    "Assignee",
    "Resolution",
    "Met SLA",
    "SLA status",
    "Date created",
    "Last updated",
    "Intake",
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([caseHeader, ...rptCaseDetailRows(cases)]),
    "Case Detail"
  );

  return wb;
}

function rptExportExcel() {
  if (typeof XLSX === "undefined") {
    toast("Excel export library not loaded. Check your network connection.");
    return;
  }
  const filterId = rptEffectiveFilterId();
  const cases = rptVisibleCases();
  const metrics = rptBuildMetrics(cases, filterId);
  const wb = rptBuildExportWorkbook(cases, metrics, filterId);
  if (!wb) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const scope =
    filterId === RPT_FILTER_ALL ? "all" : String(rptSelectedLabel(filterId)).replace(/[^\w-]+/g, "-").slice(0, 24);
  XLSX.writeFile(wb, `crm-reports-${scope}-${stamp}.xlsx`);
  toast("Report exported — open in Microsoft Excel.");
}

function rptFilterSelectHtml(auth, selectedId) {
  const opts = rptFilterOptions(auth);
  const cur = rptEffectiveFilterId();
  const disabled = auth?.role === "case_agent";
  return `<select id="rpt_user_filter" class="field rpt-user-select" aria-label="Report for user or agent" ${disabled ? "disabled" : ""}>
    ${opts.map((o) => `<option value="${escapeHtml(o.id)}" ${o.id === cur ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}
  </select>`;
}

function rptSelectedLabel(filterId) {
  if (filterId === RPT_FILTER_ALL) return "all users in scope";
  return rptAgentLabel(filterId);
}

function viewReports() {
  const auth = rptAuth();
  const filterId = rptEffectiveFilterId();
  state.reportFilterUserId = filterId;
  const cases = rptVisibleCases();
  const m = rptBuildMetrics(cases, filterId);
  const slaPct = m.slaEligible ? Math.round((m.metSla / m.slaEligible) * 100) : 0;
  const filterNote =
    filterId === RPT_FILTER_ALL
      ? auth?.role === "hcce_coordinator"
        ? "Showing all Selfcare cases."
        : auth?.role === "supervisor"
          ? "Showing all team and Selfcare cases."
          : "Showing all cases in your scope."
      : `Showing report for <strong>${escapeHtml(rptSelectedLabel(filterId))}</strong> (${m.totalCases} case${m.totalCases === 1 ? "" : "s"}).`;

  return `
    <div class="rpt">
      <div class="rpt-head">
        <div class="rpt-head-row">
          <div>
            <h2>Reports</h2>
            <p class="muted">Operational KPIs and analytics — filter by user or agent. Export multi-sheet workbook for Microsoft Excel.</p>
          </div>
          <div class="rpt-head-actions">
            <div class="rpt-filter-wrap">
              <label for="rpt_user_filter" class="rpt-filter-label">Report for</label>
              ${rptFilterSelectHtml(auth, filterId)}
            </div>
            <button type="button" class="btn sm" id="rpt_export_excel" title="Download .xlsx for Microsoft Excel">Export to Excel</button>
          </div>
        </div>
        <p class="muted rpt-scope">${filterNote}</p>
      </div>

      <div class="rpt-kpis">
        <div class="rpt-kpi" style="--kpi-color:#0891b2">
          <p class="rpt-kpi-label">Total customers</p>
          <p class="rpt-kpi-value">${m.totalCustomers}</p>
          <p class="rpt-kpi-sub">${filterId === RPT_FILTER_ALL ? "Master accounts" : "In filtered cases"}</p>
        </div>
        <div class="rpt-kpi" style="--kpi-color:#6366f1">
          <p class="rpt-kpi-label">Open cases</p>
          <p class="rpt-kpi-value">${m.openCases}</p>
          <p class="rpt-kpi-sub">Not yet closed</p>
        </div>
        <div class="rpt-kpi" style="--kpi-color:#e11d48">
          <p class="rpt-kpi-label">Escalated cases</p>
          <p class="rpt-kpi-value">${m.escalatedCases}</p>
          <p class="rpt-kpi-sub">Status or ladder moved</p>
        </div>
        <div class="rpt-kpi" style="--kpi-color:#10b981">
          <p class="rpt-kpi-label">Closed cases</p>
          <p class="rpt-kpi-value">${m.closedCases}</p>
          <p class="rpt-kpi-sub">Resolution = Close</p>
        </div>
        <div class="rpt-kpi" style="--kpi-color:#d4af37">
          <p class="rpt-kpi-label">Met SLA</p>
          <p class="rpt-kpi-value">${m.metSla}</p>
          <p class="rpt-kpi-sub">${m.slaEligible ? `${slaPct}% of ${m.slaEligible} with SLA` : "No SLA data"}</p>
        </div>
        <div class="rpt-kpi" style="--kpi-color:#b45309">
          <p class="rpt-kpi-label">Pending closure</p>
          <p class="rpt-kpi-value">${m.pendingClosure}</p>
          <p class="rpt-kpi-sub">Resolved / awaiting close</p>
        </div>
      </div>

      <div class="rpt-charts">
        <div class="rpt-chart-card">
          <h3>Case status</h3>
          <p>Distribution by current resolution status</p>
          <div class="rpt-chart-canvas rpt-chart-pie"><canvas id="rpt_chart_status" aria-label="Case status pie chart"></canvas></div>
        </div>
        <div class="rpt-chart-card">
          <h3>Agent performance</h3>
          <p>${filterId === RPT_FILTER_ALL ? "Closed cases by creating agent" : "Performance for selected user"}</p>
          <div class="rpt-chart-canvas rpt-chart-bar"><canvas id="rpt_chart_agents" aria-label="Agent performance bar chart"></canvas></div>
        </div>
        <div class="rpt-chart-card">
          <h3>SLA compliance</h3>
          <p>${m.metSla} met · ${Math.max(0, m.slaEligible - m.metSla)} missed (${slaPct}% compliant)</p>
          <div class="rpt-gauge-wrap">
            <div class="rpt-chart-canvas rpt-chart-gauge"><canvas id="rpt_chart_sla" aria-label="SLA compliance gauge"></canvas></div>
            <div class="rpt-gauge-center" aria-hidden="true"><strong>${slaPct}%</strong><span>compliant</span></div>
          </div>
        </div>
        <div class="rpt-chart-card">
          <h3>Customer satisfaction trend</h3>
          <p>Average CSAT from closed cases (demo model)</p>
          <div class="rpt-chart-canvas rpt-chart-line"><canvas id="rpt_chart_csat" aria-label="Customer satisfaction trend"></canvas></div>
        </div>
      </div>
    </div>`;
}

function destroyRptCharts() {
  _rptCharts.forEach((ch) => {
    try {
      ch.destroy();
    } catch (_) {}
  });
  _rptCharts = [];
}

function initRptCharts(cases, metrics, filterId) {
  if (typeof Chart === "undefined") return;
  destroyRptCharts();

  const status = rptStatusCounts(cases);
  const statusEl = document.getElementById("rpt_chart_status");
  if (statusEl) {
    const labels = Object.keys(status);
    const data = Object.values(status);
    const colors = ["#6366f1", "#b45309", "#e11d48", "#10b981", "#0891b2"];
    _rptCharts.push(
      new Chart(statusEl, {
        type: "pie",
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label(ctx) {
                  const v = ctx.raw || 0;
                  const sum = metrics.totalCases || 1;
                  return `${ctx.label}: ${v} (${Math.round((v / sum) * 100)}%)`;
                },
              },
            },
          },
        },
      })
    );
  }

  let agents = rptAgentPerformance(cases);
  if (filterId && filterId !== RPT_FILTER_ALL) {
    agents = agents.filter((a) => a.id === filterId);
  }
  const agentEl = document.getElementById("rpt_chart_agents");
  if (agentEl) {
    _rptCharts.push(
      new Chart(agentEl, {
        type: "bar",
        data: {
          labels: agents.length ? agents.map((a) => a.name) : ["No cases"],
          datasets: [
            {
              label: "Closed",
              data: agents.length ? agents.map((a) => a.closed) : [0],
              backgroundColor: "#10b981",
              borderRadius: 4,
            },
            {
              label: "Created",
              data: agents.length ? agents.map((a) => a.created) : [0],
              backgroundColor: "#0891b2",
              borderRadius: 4,
            },
            {
              label: "Met SLA",
              data: agents.length ? agents.map((a) => a.metSla) : [0],
              backgroundColor: "#d4af37",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } },
          scales: {
            x: { stacked: false, ticks: { font: { size: 10 }, maxRotation: 45 } },
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
          },
        },
      })
    );
  }

  const slaEl = document.getElementById("rpt_chart_sla");
  const missed = Math.max(0, metrics.slaEligible - metrics.metSla);
  if (slaEl) {
    _rptCharts.push(
      new Chart(slaEl, {
        type: "doughnut",
        data: {
          labels: ["Met SLA", "Missed SLA"],
          datasets: [
            {
              data: metrics.slaEligible ? [metrics.metSla, missed] : [0, 1],
              backgroundColor: ["#10b981", "#fecdd3"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          rotation: -90,
          circumference: 180,
          cutout: "72%",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(ctx) {
                  const v = ctx.raw || 0;
                  const sum = metrics.slaEligible || 1;
                  return `${ctx.label}: ${v} (${Math.round((v / sum) * 100)}%)`;
                },
              },
            },
          },
        },
      })
    );
  }

  const trend = rptSatisfactionTrend(cases);
  const csatEl = document.getElementById("rpt_chart_csat");
  if (csatEl) {
    _rptCharts.push(
      new Chart(csatEl, {
        type: "line",
        data: {
          labels: trend.labels,
          datasets: [
            {
              label: "Avg CSAT (1–5)",
              data: trend.data,
              borderColor: "#d4af37",
              backgroundColor: "rgba(212, 175, 55, 0.15)",
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              pointBackgroundColor: "#d4af37",
              spanGaps: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 1, max: 5, ticks: { stepSize: 0.5 } },
          },
        },
      })
    );
  }
}

function cleanupReports() {
  destroyRptCharts();
}

function bindReportsHandlers() {
  cleanupReports();

  document.getElementById("rpt_user_filter")?.addEventListener("change", (e) => {
    state.reportFilterUserId = e.target.value;
    saveState();
    render();
  });

  document.getElementById("rpt_export_excel")?.addEventListener("click", rptExportExcel);

  const filterId = rptEffectiveFilterId();
  const cases = rptVisibleCases();
  const metrics = rptBuildMetrics(cases, filterId);
  initRptCharts(cases, metrics, filterId);
}
