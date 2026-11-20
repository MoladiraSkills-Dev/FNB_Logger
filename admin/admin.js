/**
 * ============================================================================
 * FNB LOGGER - ADMIN DASHBOARD CLIENT LOGIC
 * ============================================================================
 */

const LOGIN_URL = "../index.html";
let currentSession = null;

let CACHED_LOGS = [];
let CACHED_SUMMARIES = [];
let CACHED_WEEKLY = [];
let CACHED_MONTHLY = [];
let CACHED_LEAVE = [];
let CACHED_EMPLOYEES = [];

document.addEventListener("DOMContentLoaded", () => {
  currentSession = requireSession("Admin", LOGIN_URL);
  if (!currentSession) return;

  const adminNameEl = document.getElementById("adminGreetingName");
  if (adminNameEl && currentSession.user) {
    adminNameEl.textContent = `${currentSession.user.firstName} ${currentSession.user.lastName}`;
  }

  // Set default filter date to today
  const todayStr = new Date().toISOString().split("T")[0];
  const monthStr = todayStr.substring(0, 7);
  
  if (document.getElementById("filterDate")) document.getElementById("filterDate").value = todayStr;
  if (document.getElementById("filterSummaryDate")) document.getElementById("filterSummaryDate").value = todayStr;
  if (document.getElementById("filterMonthlyMonth")) document.getElementById("filterMonthlyMonth").value = monthStr;
  if (document.getElementById("exportStart")) document.getElementById("exportStart").value = todayStr;
  if (document.getElementById("exportEnd")) document.getElementById("exportEnd").value = todayStr;

  initLeaveModal(() => {
    loadDashboardData();
  });

  loadDashboardData();
});

function handleLogout() {
  logout(LOGIN_URL);
}

function toggleAdminClockBox() {
  const panel = document.getElementById("adminClockPanel");
  const toggleBtnText = document.getElementById("adminClockToggleBtnText");
  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");
    toggleBtnText.textContent = "Hide My Clock Panel";
  } else {
    panel.classList.add("hidden");
    toggleBtnText.textContent = "My Clock In / Out";
  }
}

function triggerAdminClock(actionType) {
  hideAlert("adminSelfAlert");
  showSpinner(true, "Capturing device coordinates...");

  if (!navigator.geolocation) {
    showSpinner(false);
    showAlert("adminSelfAlert", "Geolocation is not supported by your browser.", "error");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      showSpinner(true, `Recording ${actionType} for admin attendance...`);
      
      try {
        const res = await api.processActivityLog(
          currentSession.user.email,
          currentSession.user.firstName,
          currentSession.user.lastName,
          actionType,
          lat,
          lon
        );
        
        showSpinner(false);
        
        if (res.status === "success") {
          showAlert("adminSelfAlert", `${res.action} recorded at ${res.time}. Location: ${res.location}`, "success");
          loadDashboardData();
        } else {
          showAlert("adminSelfAlert", res.message || "Failed to log action.", "error");
        }
      } catch (err) {
        showSpinner(false);
        showAlert("adminSelfAlert", "Error: " + err.message, "error");
      }
    },
    (geoError) => {
      showSpinner(false);
      showAlert("adminSelfAlert", "GPS access denied. Please allow location permissions.", "error");
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

async function loadDashboardData() {
  showSpinner(true, "Synchronizing dashboard database...");
  
  try {
    const res = await api.getAdminDashboardData();
    showSpinner(false);
    
    if (res.status === "success") {
      CACHED_LOGS = res.logs || [];
      CACHED_SUMMARIES = res.summaries || [];
      CACHED_WEEKLY = res.weeklySummaries || [];
      CACHED_MONTHLY = res.monthlySummaries || [];
      CACHED_LEAVE = res.leaveRequests || [];
      CACHED_EMPLOYEES = res.employees || [];
      
      // Update employee dropdown for timesheet exports
      populateExportEmployeesDropdown(CACHED_EMPLOYEES);

      // Render tab datasets
      applyActivityLogFilters();
      applySummaryFilters();
      applyWeeklyFilters();
      applyMonthlyFilters();
      renderLeaveRequestsTable(CACHED_LEAVE);
      renderStaffProfilesTable(CACHED_EMPLOYEES);

    } else {
      alert("Database error: " + (res.message || "Unable to fetch dashboard data."));
    }
  } catch (err) {
    showSpinner(false);
    alert("Connection failure: " + err.message);
  }
}

function switchTab(tabId) {
  const tabs = ['logsTab', 'summariesTab', 'weeklyTab', 'monthlyTab', 'leaveTab', 'staffTab', 'exportTab'];
  
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const panel = document.getElementById(`panel-${t}`);
    if (t === tabId) {
      if (btn) btn.classList.add("active");
      if (panel) panel.classList.remove("hidden");
    } else {
      if (btn) btn.classList.remove("active");
      if (panel) panel.classList.add("hidden");
    }
  });
}

/* ==========================================================================
   TAB 1: ACTIVITY LOGS
   ========================================================================== */
function applyActivityLogFilters() {
  const dateVal = document.getElementById("filterDate").value.trim();
  const searchVal = document.getElementById("filterSearch").value.trim().toLowerCase();

  let loginsToday = 0;
  let logoutsToday = 0;

  const filtered = CACHED_LOGS.filter(log => {
    const matchesDate = !dateVal || log.date === dateVal;
    const nameMatch = `${log.firstName} ${log.lastName}`.toLowerCase().includes(searchVal);
    const emailMatch = (log.email || "").toLowerCase().includes(searchVal);
    const matchesSearch = !searchVal || nameMatch || emailMatch;

    if (matchesDate && matchesSearch) {
      if (log.action === "Clock In") loginsToday++;
      if (log.action === "Clock Out") logoutsToday++;
      return true;
    }
    return false;
  });

  const statLoginsEl = document.getElementById("statLogins");
  const statLogoutsEl = document.getElementById("statLogouts");
  const statDateEl = document.getElementById("statDateDisplay");
  if (statLoginsEl) statLoginsEl.textContent = loginsToday;
  if (statLogoutsEl) statLogoutsEl.textContent = logoutsToday;
  if (statDateEl) statDateEl.textContent = dateVal || "All Dates";

  const tbody = document.getElementById("logsTableBody");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 2rem;">No telemetry logs match the selected filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(log => {
    const coordsBadge = (log.lat && log.lon && log.lat !== "0") 
      ? `<span class="badge badge-teal" style="font-size: 0.65rem; margin-top: 4px;">GPS: ${log.lat}, ${log.lon}</span>`
      : `<span class="badge badge-secondary" style="font-size: 0.65rem; margin-top: 4px;">No GPS Coordinates</span>`;

    const editBadge = log.editedBy 
      ? `<span class="badge badge-purple" style="font-size: 0.65rem;">Edited by: ${log.editedBy}</span>` 
      : `<span style="color: var(--text-light); font-size: 0.75rem;">—</span>`;

    const actionBadge = log.action === "Clock In" 
      ? `<span class="badge badge-teal">Clock In</span>` 
      : `<span class="badge badge-warning">Clock Out</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${log.firstName} ${log.lastName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${log.email}</div>
        </td>
        <td>
          <div>${log.date}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-mono;">${log.time}</div>
        </td>
        <td>${actionBadge}</td>
        <td>
          <div style="font-size: 0.8125rem;">${log.location}</div>
          ${coordsBadge}
        </td>
        <td>${editBadge}</td>
      </tr>
    `;
  }).join("");
}

function resetActivityLogFilters() {
  document.getElementById("filterDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("filterSearch").value = "";
  applyActivityLogFilters();
}

/* ==========================================================================
   TAB 2: DAILY SUMMARIES
   ========================================================================== */
function applySummaryFilters() {
  const dateVal = document.getElementById("filterSummaryDate").value.trim();
  const searchVal = document.getElementById("filterSummarySearch").value.trim().toLowerCase();

  const filtered = CACHED_SUMMARIES.filter(sum => {
    const matchesDate = !dateVal || sum.date === dateVal;
    const nameMatch = `${sum.firstName} ${sum.lastName}`.toLowerCase().includes(searchVal);
    const emailMatch = (sum.email || "").toLowerCase().includes(searchVal);
    const matchesSearch = !searchVal || nameMatch || emailMatch;
    return matchesDate && matchesSearch;
  });

  const tbody = document.getElementById("summariesTableBody");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding: 2rem;">No daily shift summaries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(sum => {
    const statusBadge = sum.status === "Completed"
      ? `<span class="badge badge-success">Completed</span>`
      : `<span class="badge badge-warning">In Progress</span>`;

    const otBadge = (sum.overtime && sum.overtime !== "0 mins" && sum.overtime !== "N/A")
      ? `<span class="badge badge-purple">${sum.overtime}</span>`
      : `<span style="color: var(--text-muted); font-size: 0.8125rem;">${sum.overtime}</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${sum.firstName} ${sum.lastName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${sum.email}</div>
        </td>
        <td style="font-weight: 600;">${sum.date}</td>
        <td>
          <div style="font-size: 0.75rem;">In: <strong>${sum.clockIn}</strong></div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Out: <strong>${sum.clockOut}</strong></div>
        </td>
        <td>
          <div style="font-size: 0.8125rem; font-weight: 700; color: var(--fnb-teal);">In: ${sum.floorIn}</div>
          <div style="font-size: 0.8125rem; font-weight: 700; color: var(--fnb-orange);">Out: ${sum.floorOut}</div>
        </td>
        <td style="font-weight: 800; color: var(--text-main);">${sum.totalHours}</td>
        <td>${otBadge}</td>
        <td>${statusBadge}</td>
        <td style="white-space: nowrap; text-align: right;">
          <button onclick="openEditSummaryModal('${sum.summaryId}', '${sum.firstName} ${sum.lastName}', '${sum.date}', '${sum.clockIn}', '${sum.clockOut}')" class="btn btn-secondary btn-sm" style="margin-right: 4px;">Edit</button>
          <button onclick="deleteSummaryRecord('${sum.summaryId}', '${sum.date}', '${sum.email}')" class="btn btn-danger-outline btn-sm">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

function resetSummaryFilters() {
  document.getElementById("filterSummaryDate").value = "";
  document.getElementById("filterSummarySearch").value = "";
  applySummaryFilters();
}

function openEditSummaryModal(summaryId, name, date, clockIn, clockOut) {
  document.getElementById("editSumId").value = summaryId;
  document.getElementById("editSumEmployee").textContent = name;
  document.getElementById("editSumDateDisplay").textContent = `Date: ${date}`;
  
  const formatTime = (t) => {
    if (!t || t === "--" || t === "N/A") return "";
    const p = t.split(":");
    return p.length >= 2 ? `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}` : "";
  };

  document.getElementById("editSumIn").value = formatTime(clockIn);
  document.getElementById("editSumOut").value = formatTime(clockOut);

  document.getElementById("editSummaryModal").classList.remove("hidden");
}

function closeEditSummaryModal() {
  document.getElementById("editSummaryModal").classList.add("hidden");
}

async function handleSaveSummaryEdit(e) {
  e.preventDefault();
  const summaryId = document.getElementById("editSumId").value;
  const newIn = document.getElementById("editSumIn").value;
  const newOut = document.getElementById("editSumOut").value;

  showSpinner(true, "Saving shift timestamp adjustments...");

  try {
    const res = await api.adminUpdateDailySummary(summaryId, newIn, newOut, currentSession.user.email);
    showSpinner(false);

    if (res.status === "success") {
      closeEditSummaryModal();
      loadDashboardData();
    } else {
      alert("Error updating summary: " + res.message);
    }
  } catch (err) {
    showSpinner(false);
    alert("Connection error: " + err.message);
  }
}

async function deleteSummaryRecord(summaryId, date, email) {
  if (!confirm(`Are you sure you want to delete shift ${summaryId} (${date})? This will also remove the corresponding telemetry activity logs.`)) {
    return;
  }

  showSpinner(true, "Deleting shift record...");

  try {
    const res = await api.adminDeleteDailySummary(summaryId, date, email, currentSession.user.email);
    showSpinner(false);

    if (res.status === "success") {
      loadDashboardData();
    } else {
      alert("Error: " + res.message);
    }
  } catch (err) {
    showSpinner(false);
    alert("Connection error: " + err.message);
  }
}

/* ==========================================================================
   TAB 3: WEEKLY SUMMARIES
   ========================================================================== */
function applyWeeklyFilters() {
  const weekVal = document.getElementById("filterWeeklyKey").value.trim().toUpperCase();
  const searchVal = document.getElementById("filterWeeklySearch").value.trim().toLowerCase();

  const filtered = CACHED_WEEKLY.filter(w => {
    const matchesWeek = !weekVal || (w.weekKey || "").toUpperCase().includes(weekVal);
    const nameMatch = `${w.firstName} ${w.lastName}`.toLowerCase().includes(searchVal);
    const emailMatch = (w.email || "").toLowerCase().includes(searchVal);
    const matchesSearch = !searchVal || nameMatch || emailMatch;
    return matchesWeek && matchesSearch;
  });

  const tbody = document.getElementById("weeklyTableBody");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 2rem;">No weekly summaries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(w => {
    let complianceBadge = `<span class="badge badge-warning">Under Target (&lt;45 hrs)</span>`;
    if (w.complianceStatus.includes("MAX CAP ALERT")) {
      complianceBadge = `<span class="badge badge-danger">🔴 55+ hrs (Legal Max Exceeded)</span>`;
    } else if (w.complianceStatus.includes("Target Met")) {
      complianceBadge = `<span class="badge badge-success">Target Met (45-54 hrs)</span>`;
    }

    const otBadge = (w.totalOvertime && w.totalOvertime !== "0 mins")
      ? `<span class="badge badge-purple">${w.totalOvertime}</span>`
      : `<span style="color: var(--text-muted); font-size: 0.8125rem;">${w.totalOvertime}</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${w.firstName} ${w.lastName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${w.email}</div>
        </td>
        <td style="font-weight: 700; color: var(--fnb-teal); font-family: monospace;">${w.weekKey}</td>
        <td style="font-weight: 800;">${w.totalHours}</td>
        <td>${otBadge}</td>
        <td style="font-weight: 600;">${w.daysWorked} days</td>
        <td>${complianceBadge}</td>
      </tr>
    `;
  }).join("");
}

function resetWeeklyFilters() {
  document.getElementById("filterWeeklyKey").value = "";
  document.getElementById("filterWeeklySearch").value = "";
  applyWeeklyFilters();
}

/* ==========================================================================
   TAB 4: MONTHLY SUMMARIES
   ========================================================================== */
function applyMonthlyFilters() {
  const monthVal = document.getElementById("filterMonthlyMonth").value.trim();
  const searchVal = document.getElementById("filterMonthlySearch").value.trim().toLowerCase();

  const filtered = CACHED_MONTHLY.filter(m => {
    const matchesMonth = !monthVal || (m.month || "").startsWith(monthVal);
    const nameMatch = `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchVal);
    const emailMatch = (m.email || "").toLowerCase().includes(searchVal);
    const matchesSearch = !searchVal || nameMatch || emailMatch;
    return matchesMonth && matchesSearch;
  });

  const tbody = document.getElementById("monthlyTableBody");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 2rem;">No monthly summaries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const otBadge = (m.totalOvertime && m.totalOvertime !== "0 mins")
      ? `<span class="badge badge-purple">${m.totalOvertime}</span>`
      : `<span style="color: var(--text-muted); font-size: 0.8125rem;">${m.totalOvertime}</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${m.firstName} ${m.lastName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${m.email}</div>
        </td>
        <td style="font-weight: 700; color: var(--fnb-teal);">${m.month}</td>
        <td style="font-weight: 800;">${m.totalHours}</td>
        <td>${otBadge}</td>
        <td style="font-weight: 600;">${m.daysWorked} days</td>
        <td style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${m.lastUpdated}</td>
      </tr>
    `;
  }).join("");
}

function resetMonthlyFilters() {
  document.getElementById("filterMonthlyMonth").value = "";
  document.getElementById("filterMonthlySearch").value = "";
  applyMonthlyFilters();
}

/* ==========================================================================
   TAB 5: LEAVE MANAGEMENT
   ========================================================================== */
function renderLeaveRequestsTable(requests) {
  const tbody = document.getElementById("leaveTableBody");
  if (!tbody) return;

  if (!requests || requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 2rem;">No leave requests currently logged in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = requests.map(req => {
    let statusBadge = `<span class="badge badge-warning">Pending</span>`;
    if (req.status === "Approved") statusBadge = `<span class="badge badge-success">Approved</span>`;
    if (req.status === "Rejected") statusBadge = `<span class="badge badge-danger">Rejected</span>`;

    const actions = req.status === "Pending" ? `
      <button onclick="handleLeaveDecision('${req.reqId}', 'Approved')" class="btn btn-secondary btn-sm" style="color: #059669; margin-right: 4px;">Approve</button>
      <button onclick="handleLeaveDecision('${req.reqId}', 'Rejected')" class="btn btn-danger-outline btn-sm">Reject</button>
    ` : `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Resolved</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${req.firstName} ${req.lastName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${req.email}</div>
        </td>
        <td style="font-weight: 600;">${req.type} Leave</td>
        <td>
          <div style="font-size: 0.8125rem;">${req.startDate} &rarr; ${req.endDate}</div>
          <div style="font-size: 0.6875rem; color: var(--text-muted);">Applied: ${req.submittedDate}</div>
        </td>
        <td>${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 4px; flex-wrap: wrap;">
            <button onclick="downloadLeaveApplicationForm('${req.reqId}')" class="btn btn-secondary btn-sm" title="Download filled PDF leave form" style="color: var(--fnb-teal-dark);">📥 Form (PDF)</button>
            <button onclick="downloadLeaveApplicationFormWord('${req.reqId}')" class="btn btn-secondary btn-sm" title="Download filled Word leave form" style="color: #2563eb;">📝 Form (Doc)</button>
            ${actions}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function downloadLeaveApplicationForm(reqId) {
  showSpinner(true, "Generating filled Leave Request Form (PDF)...");
  try {
    const res = await api.exportLeaveForm(reqId, "pdf");
    showSpinner(false);
    if (res.status === "success") {
      triggerFileDownload(res.base64, res.mimeType, res.filename);
    } else {
      alert("Error generating leave form: " + (res.message || "Failed"));
    }
  } catch (err) {
    showSpinner(false);
    alert("Connection error: " + err.message);
  }
}

async function downloadLeaveApplicationFormWord(reqId) {
  showSpinner(true, "Generating filled Leave Request Form (Word)...");
  try {
    const res = await api.exportLeaveForm(reqId, "doc");
    showSpinner(false);
    if (res.status === "success") {
      triggerFileDownload(res.base64, res.mimeType, res.filename);
    } else {
      alert("Error generating leave form: " + (res.message || "Failed"));
    }
  } catch (err) {
    showSpinner(false);
    alert("Connection error: " + err.message);
  }
}

async function handleLeaveDecision(reqId, decision) {
  showSpinner(true, `Marking leave request as ${decision}...`);

  try {
    const res = await api.adminUpdateLeaveStatus(reqId, decision);
    showSpinner(false);

    if (res.status === "success") {
      loadDashboardData();
    } else {
      alert("Error: " + res.message);
    }
  } catch (err) {
    showSpinner(false);
    alert("Connection error: " + err.message);
  }
}

/* ==========================================================================
   TAB 6: STAFF PROFILES
   ========================================================================== */
function renderStaffProfilesTable(employees) {
  const tbody = document.getElementById("staffTableBody");
  if (!tbody) return;

  if (!employees || employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 2rem;">No registered staff profiles in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = employees.map(emp => {
    const workStatusBadge = emp.workStatus === "On Leave"
      ? `<span class="badge badge-warning">On Leave</span>`
      : `<span class="badge badge-success">Active</span>`;

    const standingBadge = emp.accountStanding === "Verified"
      ? `<span class="badge badge-teal">Verified</span>`
      : `<span class="badge badge-danger">Blocked</span>`;

    const roleBadge = emp.accountType === "Admin"
      ? `<span class="badge badge-purple">Admin</span>`
      : `<span class="badge badge-secondary">Employee</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight: 700;">${emp.firstName} ${emp.lastName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${emp.email}</div>
        </td>
        <td>${roleBadge}</td>
        <td>${workStatusBadge}</td>
        <td>${standingBadge}</td>
        <td style="text-align: right;">
          <button onclick="openEditStaffModal('${emp.email}', '${emp.firstName}', '${emp.lastName}', '${emp.accountStanding}')" class="btn btn-secondary btn-sm">Edit Profile</button>
        </td>
      </tr>
    `;
  }).join("");
}

function openEditStaffModal(email, first, last, status) {
  document.getElementById("editStaffEmail").value = email;
  document.getElementById("editStaffEmailDisplay").textContent = email;
  document.getElementById("editStaffFirst").value = first;
  document.getElementById("editStaffLast").value = last;
  document.getElementById("editStaffStatus").value = status || "Verified";
  document.getElementById("editStaffPassword").value = "";

  document.getElementById("editStaffModal").classList.remove("hidden");
}

function closeEditStaffModal() {
  document.getElementById("editStaffModal").classList.add("hidden");
}

async function handleSaveStaffProfile(e) {
  e.preventDefault();

  const email = document.getElementById("editStaffEmail").value;
  const first = document.getElementById("editStaffFirst").value.trim();
  const last = document.getElementById("editStaffLast").value.trim();
  const status = document.getElementById("editStaffStatus").value;
  const pass = document.getElementById("editStaffPassword").value;

  showSpinner(true, "Updating staff directory profile...");

  try {
    const res = await api.adminUpdateUser(email, first, last, status, pass);
    showSpinner(false);

    if (res.status === "success") {
      closeEditStaffModal();
      loadDashboardData();
    } else {
      alert("Error updating profile: " + res.message);
    }
  } catch (err) {
    showSpinner(false);
    alert("Connection error: " + err.message);
  }
}

/* ==========================================================================
   TAB 7: TIMESHEET EXPORTS (PDF, CSV, ZIP)
   ========================================================================== */
function populateExportEmployeesDropdown(employees) {
  const sel = document.getElementById("exportEmployeeSelect");
  if (!sel) return;

  sel.innerHTML = `
    <option value="ALL">All Staff Members (ZIP Archive Only)</option>
    ${employees.map(e => `<option value="${e.email}">${e.firstName} ${e.lastName} (${e.email})</option>`).join("")}
  `;
}

async function handleTimesheetExport(format) {
  const email = document.getElementById("exportEmployeeSelect").value;
  const startDate = document.getElementById("exportStart").value;
  const endDate = document.getElementById("exportEnd").value;

  if (email === "ALL") {
    showAlert("exportAlert", "Single PDF, Word and CSV exports require selecting a specific employee. To export everyone at once, use the ZIP Export button below.", "error");
    return;
  }

  if (!startDate || !endDate) {
    showAlert("exportAlert", "Please specify both Start Date and End Date.", "error");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showAlert("exportAlert", "Start date cannot be after end date.", "error");
    return;
  }

  hideAlert("exportAlert");
  showSpinner(true, `Compiling ${format.toUpperCase()} timesheet report...`);

  try {
    const res = await api.exportTimesheetData(email, startDate, endDate, format);
    showSpinner(false);

    if (res.status === "success") {
      triggerFileDownload(res.base64, res.mimeType, res.filename);
      showAlert("exportAlert", `${format.toUpperCase()} report downloaded successfully.`, "success");
    } else {
      showAlert("exportAlert", res.message || "Failed to generate timesheet.", "error");
    }
  } catch (err) {
    showSpinner(false);
    showAlert("exportAlert", "Connection error: " + err.message, "error");
  }
}

async function handleZipExport() {
  const email = document.getElementById("exportEmployeeSelect").value;
  const startDate = document.getElementById("exportStart").value;
  const endDate = document.getElementById("exportEnd").value;

  if (!startDate || !endDate) {
    showAlert("exportAlert", "Please select both a Start Date and an End Date.", "error");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showAlert("exportAlert", "Start date cannot be after end date.", "error");
    return;
  }

  hideAlert("exportAlert");
  showSpinner(true, "Bundling timesheet PDFs into ZIP archive...");

  try {
    const res = await api.generateTimesheetsZip(email, startDate, endDate);
    showSpinner(false);

    if (res.status === "success") {
      triggerFileDownload(res.base64, res.mimeType, res.filename);
      showAlert("exportAlert", "ZIP Archive created and downloaded successfully.", "success");
    } else {
      showAlert("exportAlert", res.message || "Failed to generate ZIP archive.", "error");
    }
  } catch (err) {
    showSpinner(false);
    showAlert("exportAlert", "Connection error: " + err.message, "error");
  }
}

