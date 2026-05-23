/**
 * Case management dashboard — dynamic registry table (route: dashboard).
 */

const CMD_STATUSES = ["Open", "Pending", "Escalated", "Resolved", "Closed"];

const CMD_TEAM_LABELS = {
  team_net: "Network Support",
  team_cust: "Customer Care",
};

const CMD_DEPT_LABELS = {
  dept_ops: "Operations",
  dept_eng: "Engineering",
};

let _cmdSlaTimer = null;
let _cmdCharts = [];

function cmdIsResolved(c) {
  const st = cmdCaseStatus(c);
  return st === "Resolved" || st === "Closed";
}

/** True = resolved within global SLA window; false = outside; null = no SLA data. */
function cmdResolvedWithinSla(c) {
  const g = c.globalSla;
  if (!g || !Number.isFinite(g.simulatedElapsedHours) || !Number.isFinite(g.durationHours) || g.durationHours <= 0) {
    return null;
  }
  const pause = g.pauseHours || 0;
  const effective = g.simulatedElapsedHours + pause;
  return effective <= g.durationHours;
}

function cmdBuildChartData(cases) {
  const resolved = cases.filter(cmdIsResolved);
  let withinSla = 0;
  let outsideSla = 0;
  let unknownSla = 0;
  for (const c of resolved) {
    const ok = cmdResolvedWithinSla(c);
    if (ok === true) withinSla++;
    else if (ok === false) outsideSla++;
    else unknownSla++;
  }
  return {
    total: cases.length,
    resolved: resolved.length,
    open: cases.length - resolved.length,
    withinSla,
    outsideSla,
    unknownSla,
  };
}

function cmdCaseStatus(c) {
  const r = c.resolutionStatus || "Open";
  if (r === "Close") return "Closed";
  if (r === "Escalated") return "Escalated";
  if (r === "unresolved") return "Resolved";
  if (r === "Awaiting info/Paused" || r === "Reopen") return "Pending";
  return "Open";
}

function cmdStatusClass(st) {
  return st.toLowerCase();
}

function cmdCaseTitle(c) {
  const t = c.title || "";
  const i = t.indexOf(" — ");
  return i > 0 ? t.slice(0, i) : t || "—";
}

function cmdCaseCreator(c) {
  if (typeof caseCreatorDisplay === "function") return caseCreatorDisplay(c);
  if (c.createdByName) return c.createdByName;
  if (c.source === "selfcare") return "Selfcare portal";
  const ag = typeof agentById === "function" ? agentById(c.createdByUserId || c.assignedUserId) : null;
  return ag?.name || "System";
}

function cmdTeamDept(c) {
  const team = CMD_TEAM_LABELS[c.teamId] || c.teamId || "—";
  const dept = CMD_DEPT_LABELS[c.departmentId] || c.departmentId || "";
  return dept ? `${team} · ${dept}` : team;
}

function cmdLastUpdated(c) {
  const audits = c.audit || [];
  if (!audits.length) return c.createdAt;
  return audits.reduce((max, a) => (a.t > max ? a.t : max), c.createdAt);
}

function cmdSlaText(c) {
  const g = c.globalSla;
  if (!g || !Number.isFinite(g.durationHours)) return { text: "—", cls: "" };
  const pause = g.pauseHours || 0;
  const elapsed = (g.simulatedElapsedHours || 0) + pause;
  const remain = g.durationHours - elapsed;
  const sla = globalSlaStatus(c);
  if (sla.phase === "breached" || sla.phase === "overdue") {
    return { text: `+${Math.abs(Math.round(remain))}h over`, cls: "breach" };
  }
  if (remain <= 4) return { text: `${Math.max(0, Math.round(remain))}h left`, cls: "warn" };
  return { text: `${Math.max(0, Math.round(remain))}h left`, cls: "" };
}

function cmdPriorityClass(p) {
  const s = String(p || "").toLowerCase();
  if (s.includes("p1") || s.includes("p2") || s.includes("critical") || s.includes("high")) return "high";
  return "";
}

function cmdCaseCreatorKey(c) {
  if (c.createdByUserId) return c.createdByUserId;
  if (c.source === "selfcare") return "__selfcare__";
  return "__other__";
}

function cmdCaseCreatorLabel(key, sampleCase) {
  if (key === "__selfcare__") return "Selfcare intake";
  if (key === "__other__") return "Other / unassigned";
  if (sampleCase) return cmdCaseCreator(sampleCase);
  const ag = typeof agentById === "function" ? agentById(key) : null;
  return ag?.name || key;
}

function cmdCreatorGroups(cases) {
  const groups = new Map();
  for (const c of cases) {
    const key = cmdCaseCreatorKey(c);
    if (!groups.has(key)) groups.set(key, { key, cases: [] });
    groups.get(key).cases.push(c);
  }
  return [...groups.values()].sort((a, b) => b.cases.length - a.cases.length);
}

function cmdVisibleCases() {
  let list = state.cases.filter(caseVisibleForRole);
  const q = (state.caseDashSearch || "").trim().toLowerCase();
  if (q) {
    list = list.filter((c) =>
      [c.id, typeof caseDisplayId === "function" ? caseDisplayId(c) : c.id, c.title, cmdCaseTitle(c), cmdCaseCreator(c), cmdCaseStatus(c), c.priority, cmdTeamDept(c)]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  if (state.caseDashFilterStatus) {
    list = list.filter((c) => cmdCaseStatus(c) === state.caseDashFilterStatus);
  }
  if (state.caseDashFilterPriority) {
    list = list.filter((c) => (c.priority || "").includes(state.caseDashFilterPriority));
  }
  if (state.caseDashFilterCreator) {
    list = list.filter((c) => cmdCaseCreatorKey(c) === state.caseDashFilterCreator);
  }
  return list;
}

function cmdMetrics(cases) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let slaRisk = 0;
  let resolvedToday = 0;
  for (const c of cases) {
    const st = cmdCaseStatus(c);
    const sla = globalSlaStatus(c);
    if (sla.phase === "breached" || sla.phase === "overdue") slaRisk++;
    if ((st === "Resolved" || st === "Closed") && new Date(cmdLastUpdated(c)) >= today) resolvedToday++;
  }
  const open = cases.filter((c) => {
    const st = cmdCaseStatus(c);
    return st === "Open" || st === "Pending" || st === "Escalated";
  }).length;
  return {
    total: cases.length,
    open,
    escalated: cases.filter((c) => cmdCaseStatus(c) === "Escalated").length,
    slaRisk,
    resolvedToday,
  };
}

function cmdSortCases(list) {
  const col = state.caseDashSortCol || "createdAt";
  const dir = state.caseDashSortDir === "asc" ? 1 : -1;
  const sorted = [...list];
  sorted.sort((a, b) => {
    let va;
    let vb;
    switch (col) {
      case "title":
        va = cmdCaseTitle(a);
        vb = cmdCaseTitle(b);
        break;
      case "creator":
        va = cmdCaseCreator(a);
        vb = cmdCaseCreator(b);
        break;
      case "id":
        va = a.id;
        vb = b.id;
        break;
      case "status":
        va = cmdCaseStatus(a);
        vb = cmdCaseStatus(b);
        break;
      case "priority":
        va = a.priority || "";
        vb = b.priority || "";
        break;
      case "team":
        va = cmdTeamDept(a);
        vb = cmdTeamDept(b);
        break;
      case "updated":
        va = cmdLastUpdated(a);
        vb = cmdLastUpdated(b);
        break;
      default:
        va = a.createdAt;
        vb = b.createdAt;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return sorted;
}

function viewCaseDashboard() {
  const all = state.cases.filter(caseVisibleForRole);
  const filtered = cmdVisibleCases();
  const metrics = cmdMetrics(all);
  const mFiltered = cmdMetrics(filtered);
  const chartData = cmdBuildChartData(all);
  const creatorGroups = cmdCreatorGroups(all);
  const auth = typeof getLoggedInUser === "function" ? getLoggedInUser() : null;
  const scopeBanner = auth
    ? auth.role === "supervisor"
      ? `<p class="muted" style="margin:0 0 1rem;font-size:0.85rem"><strong>Supervisor</strong> — all ${all.length} case(s) listed below. Click any row or <strong>Review</strong> to open a case for update.</p>`
      : auth.role === "hcce_coordinator"
        ? `<p class="muted" style="margin:0 0 1rem;font-size:0.85rem"><strong>HCCE</strong> — Selfcare cases for assignment. Click a row to review.</p>`
        : `<p class="muted" style="margin:0 0 1rem;font-size:0.85rem"><strong>${escapeHtml(auth.name)}</strong> — all ${all.length} case(s) in the registry. Review or update any case; only the creator may close.</p>`
    : "";
  const agentChips = creatorGroups
    .map((g) => {
      const label = cmdCaseCreatorLabel(g.key, g.cases[0]);
      const active = state.caseDashFilterCreator === g.key ? " active" : "";
      return `<button type="button" class="cmd-agent-chip${active}" data-cmd-creator="${escapeHtml(g.key)}">${escapeHtml(label)} <span class="cmd-chip-count">${g.cases.length}</span></button>`;
    })
    .join("");
  const allChipActive = !state.caseDashFilterCreator ? " active" : "";
  const rows = cmdSortCases(filtered);
  const sortCol = state.caseDashSortCol || "createdAt";
  const sortDir = state.caseDashSortDir || "desc";

  function th(col, label) {
    const active = sortCol === col;
    const ind = active ? (sortDir === "asc" ? "↑" : "↓") : "↕";
    return `<th class="${active ? "sorted" : ""}" data-sort="${col}" scope="col">${escapeHtml(label)}<span class="sort-ind">${ind}</span></th>`;
  }

  const tableBody = rows.length
    ? rows
        .map((c) => {
          const st = cmdCaseStatus(c);
          const sla = cmdSlaText(c);
          return `<tr tabindex="0" data-open-case="${escapeHtml(c.id)}" role="button" aria-label="Review case ${escapeHtml(typeof caseDisplayId === "function" ? caseDisplayId(c) : c.id)}">
        <td class="title-cell">${escapeHtml(cmdCaseTitle(c))}</td>
        <td>${escapeHtml(cmdCaseCreator(c))}</td>
        <td><code class="mono-tag">${escapeHtml(typeof caseDisplayId === "function" ? caseDisplayId(c) : c.id)}</code></td>
        <td>${escapeHtml(formatDateTime(c.createdAt))}</td>
        <td><span class="cmd-status ${cmdStatusClass(st)}">${escapeHtml(st)}</span></td>
        <td><span class="cmd-priority ${cmdPriorityClass(c.priority)}">${escapeHtml(c.priority || "—")}</span></td>
        <td><span class="cmd-sla ${sla.cls}" data-sla-id="${escapeHtml(c.id)}">${escapeHtml(sla.text)}</span></td>
        <td>${escapeHtml(cmdTeamDept(c))}</td>
        <td>${escapeHtml(formatDateTime(cmdLastUpdated(c)))}</td>
        <td><button type="button" class="btn sm ghost cmd-review-btn" data-open-case="${escapeHtml(c.id)}">Review</button></td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="10" class="cmd-empty">No cases match your filters.</td></tr>`;

  return `
    <div class="cmd">
      ${scopeBanner}
      <div class="cmd-toolbar">
        <h2><span class="cmd-live" aria-hidden="true"></span>Case management</h2>
        <div class="cmd-search">
          <input type="search" id="cmd_search" placeholder="Search title, ID, agent, team…" value="${escapeHtml(state.caseDashSearch || "")}" aria-label="Search cases" />
        </div>
        <div class="cmd-filters">
          <select id="cmd_f_status" aria-label="Filter by status">
            <option value="">All statuses</option>
            ${CMD_STATUSES.map((s) => `<option value="${s}" ${state.caseDashFilterStatus === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <select id="cmd_f_priority" aria-label="Filter by priority">
            <option value="">All priorities</option>
            ${["P1", "P2", "P3", "P4", "P5"].map((p) => `<option value="${p}" ${state.caseDashFilterPriority === p ? "selected" : ""}>${p}</option>`).join("")}
          </select>
        </div>
        <button type="button" class="btn sm ghost" id="cmd_export">Export CSV</button>
        <button type="button" class="btn sm" data-route="${CASE_NEW_ROUTE}">+ New case</button>
      </div>

      <div class="cmd-kpis">
        <div class="cmd-kpi" style="--kpi-color:#0891b2">
          <p class="cmd-kpi-label">Total cases</p>
          <p class="cmd-kpi-value">${metrics.total}</p>
          <p class="cmd-kpi-sub">${mFiltered.total} shown</p>
        </div>
        <div class="cmd-kpi" style="--kpi-color:#6366f1">
          <p class="cmd-kpi-label">Open / active</p>
          <p class="cmd-kpi-value">${metrics.open}</p>
          <p class="cmd-kpi-sub">Open, pending, escalated</p>
        </div>
        <div class="cmd-kpi" style="--kpi-color:#e11d48">
          <p class="cmd-kpi-label">Escalated</p>
          <p class="cmd-kpi-value">${metrics.escalated}</p>
          <p class="cmd-kpi-sub">Needs attention</p>
        </div>
        <div class="cmd-kpi" style="--kpi-color:#b45309">
          <p class="cmd-kpi-label">SLA at risk</p>
          <p class="cmd-kpi-value">${metrics.slaRisk}</p>
          <p class="cmd-kpi-sub">Breached or overdue</p>
        </div>
        <div class="cmd-kpi" style="--kpi-color:#10b981">
          <p class="cmd-kpi-label">Resolved today</p>
          <p class="cmd-kpi-value">${metrics.resolvedToday}</p>
          <p class="cmd-kpi-sub">Closed or resolved</p>
        </div>
      </div>

      <div class="cmd-charts">
        <div class="cmd-chart-card">
          <h3>Total vs resolved cases</h3>
          <p>${chartData.total} cases in your scope · ${chartData.resolved} resolved or closed · ${chartData.open} still open</p>
          <div class="cmd-chart-canvas"><canvas id="cmd_chart_total_resolved" aria-label="Total cases compared to resolved cases"></canvas></div>
        </div>
        <div class="cmd-chart-card">
          <h3>Resolved cases — SLA performance</h3>
          <p>${chartData.resolved ? `${chartData.withinSla} within SLA · ${chartData.outsideSla} outside SLA` : "No resolved cases yet"}${chartData.unknownSla ? ` · ${chartData.unknownSla} no SLA data` : ""}</p>
          <div class="cmd-chart-canvas"><canvas id="cmd_chart_resolved_sla" aria-label="Resolved cases within SLA versus outside SLA"></canvas></div>
        </div>
      </div>

      <div class="cmd-table-wrap">
        <div class="cmd-table-head">
          <h3>Case registry — all cases</h3>
          <span class="muted" style="font-size:0.82rem">${rows.length} of ${all.length} · click a row or Review to open</span>
        </div>
        <div class="cmd-agent-chips" role="toolbar" aria-label="Filter by agent">
          <button type="button" class="cmd-agent-chip${allChipActive}" data-cmd-creator="">All agents <span class="cmd-chip-count">${all.length}</span></button>
          ${agentChips}
        </div>
        <div class="cmd-table-scroll">
          <table class="cmd-table" id="cmd_case_table">
            <thead>
              <tr>
                ${th("title", "Case creation title")}
                ${th("creator", "Agent who created")}
                ${th("id", "Case ID")}
                ${th("createdAt", "Date created")}
                ${th("status", "Current status")}
                ${th("priority", "Priority level")}
                <th scope="col">SLA countdown</th>
                ${th("team", "Team / department")}
                ${th("updated", "Last updated")}
                <th scope="col">Review</th>
              </tr>
            </thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function cmdExportCsv() {
  const rows = cmdSortCases(cmdVisibleCases());
  const headers = [
    "Case Creation Title",
    "Agent Who Created the Case",
    "Case ID",
    "Date Created",
    "Current Status",
    "Priority Level",
    "SLA Countdown/Response Time",
    "Assigned Team/Department",
    "Last Updated Timestamp",
  ];
  const data = rows.map((c) => {
    const sla = cmdSlaText(c);
    return [
      cmdCaseTitle(c),
      cmdCaseCreator(c),
      c.id,
      formatDateTime(c.createdAt),
      cmdCaseStatus(c),
      c.priority || "",
      sla.text,
      cmdTeamDept(c),
      formatDateTime(cmdLastUpdated(c)),
    ];
  });
  const csv = [headers, ...data].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cases-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Exported to CSV.");
}

function cmdRefreshSlaCells() {
  document.querySelectorAll("[data-sla-id]").forEach((el) => {
    const c = state.cases.find((x) => x.id === el.dataset.slaId);
    if (!c) return;
    const sla = cmdSlaText(c);
    el.textContent = sla.text;
    el.className = `cmd-sla ${sla.cls}`;
  });
}

function destroyCmdCharts() {
  _cmdCharts.forEach((ch) => {
    try {
      ch.destroy();
    } catch (_) {}
  });
  _cmdCharts = [];
}

function initCmdCharts(chartData) {
  if (typeof Chart === "undefined") return;
  destroyCmdCharts();

  const totalEl = document.getElementById("cmd_chart_total_resolved");
  if (totalEl) {
    const ch1 = new Chart(totalEl, {
      type: "bar",
      data: {
        labels: ["Total cases", "Resolved / closed", "Still open"],
        datasets: [
          {
            label: "Case count",
            data: [chartData.total, chartData.resolved, chartData.open],
            backgroundColor: ["#0891b2", "#10b981", "#94a3b8"],
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel(ctx) {
                if (ctx.dataIndex === 0 && chartData.total) {
                  const pct = Math.round((chartData.resolved / chartData.total) * 100);
                  return `${pct}% resolved`;
                }
                return "";
              },
            },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    });
    _cmdCharts.push(ch1);
  }

  const slaEl = document.getElementById("cmd_chart_resolved_sla");
  if (slaEl) {
    const labels = ["Within SLA", "Outside SLA"];
    const data = [chartData.withinSla, chartData.outsideSla];
    const colors = ["#10b981", "#e11d48"];
    if (chartData.unknownSla > 0) {
      labels.push("No SLA data");
      data.push(chartData.unknownSla);
      colors.push("#94a3b8");
    }
    const ch2 = new Chart(slaEl, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: chartData.resolved ? data : [1],
            backgroundColor: chartData.resolved ? colors : ["#e2e8f0"],
            borderWidth: 0,
          },
        ],
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
                const sum = chartData.resolved || 1;
                return `${ctx.label}: ${v} (${Math.round((v / sum) * 100)}%)`;
              },
            },
          },
        },
      },
    });
    _cmdCharts.push(ch2);
  }
}

function cleanupCaseDashboard() {
  destroyCmdCharts();
  if (_cmdSlaTimer) {
    clearInterval(_cmdSlaTimer);
    _cmdSlaTimer = null;
  }
}

function bindCaseDashboardHandlers() {
  cleanupCaseDashboard();

  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  document.getElementById("cmd_search")?.addEventListener(
    "input",
    debounce((e) => {
      state.caseDashSearch = e.target.value;
      saveState();
      render();
    }, 220)
  );

  document.getElementById("cmd_f_status")?.addEventListener("change", (e) => {
    state.caseDashFilterStatus = e.target.value;
    saveState();
    render();
  });

  document.getElementById("cmd_f_priority")?.addEventListener("change", (e) => {
    state.caseDashFilterPriority = e.target.value;
    saveState();
    render();
  });

  document.querySelectorAll("[data-cmd-creator]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.caseDashFilterCreator = btn.dataset.cmdCreator || "";
      saveState();
      render();
    });
  });

  document.getElementById("cmd_export")?.addEventListener("click", cmdExportCsv);

  document.querySelectorAll("#cmd_case_table th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (state.caseDashSortCol === col) {
        state.caseDashSortDir = state.caseDashSortDir === "asc" ? "desc" : "asc";
      } else {
        state.caseDashSortCol = col;
        state.caseDashSortDir = "desc";
      }
      saveState();
      render();
    });
  });

  const view = document.getElementById("view");
  const openCase = (caseId) => {
    if (typeof openCaseForReview === "function") openCaseForReview(caseId, "dashboard");
    else {
      state.detailCaseId = caseId;
      state.route = "cases";
      state.caseReturnRoute = "dashboard";
      saveState();
      render();
    }
  };

  view?.querySelectorAll("#cmd_case_table tbody tr[data-open-case]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".cmd-review-btn")) return;
      openCase(row.dataset.openCase);
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCase(row.dataset.openCase);
      }
    });
  });

  view?.querySelectorAll(".cmd-review-btn[data-open-case]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openCase(btn.dataset.openCase);
    });
  });

  view?.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.route = btn.dataset.route;
      state.detailCaseId = null;
      saveState();
      render();
    });
  });

  _cmdSlaTimer = setInterval(cmdRefreshSlaCells, 60000);

  const chartCases = state.cases.filter(caseVisibleForRole);
  initCmdCharts(cmdBuildChartData(chartCases));
}
