/**
 * ============================================================================
 * FNB LOGGER - SHARED API CLIENT & HELPERS
 * ============================================================================
 * 
 * Rules:
 * - Talks to Google Apps Script Web App URL via POST (avoiding CORS preflight).
 * - google.script.run compatible shim for seamless invocation.
 * - Session state management via sessionStorage.
 * - Global loaders and alerts.
 */

// Deployment Web App URL: Updated once after deploying Code.gs as Web App (Execute as: Me, Access: Anyone)
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwZLaBkO66h2M3cyswaRo9-R93LLh347VuygSb6oxDuJZwjQnT_tVseRLFLBgbd590qLQ/exec";

/**
 * Universal API Request Method using URL-encoded POST with a `payload` parameter
 * to avoid CORS preflight triggers.
 */
async function callBackendApi(method, args = []) {
  if (!APPS_SCRIPT_WEB_APP_URL || APPS_SCRIPT_WEB_APP_URL.includes("YOUR_APPS_SCRIPT_WEB_APP_URL_HERE")) {
    console.warn("[FNB Logger] APPS_SCRIPT_WEB_APP_URL is not configured yet in shared/js/api.js.");
    // Fallback error simulation for when URL is not configured
    return {
      status: "error",
      message: "Backend API URL is not set. Please deploy Code.gs and update APPS_SCRIPT_WEB_APP_URL in shared/js/api.js"
    };
  }

  const payload = JSON.stringify({ method, args });
  const body = new URLSearchParams();
  body.append("payload", payload);

  try {
    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return json;
  } catch (error) {
    console.error("[FNB Logger API Error]", error);
    return { status: "error", message: error.message || "Failed to communicate with FNB Logger API server." };
  }
}

/**
 * google.script.run Client Shim
 * Emulates Apps Script client-side syntax:
 *   api.withSuccessHandler(cb).withFailureHandler(cb).someMethod(...args)
 */
class ScriptRunShim {
  constructor() {
    this.successHandler = null;
    this.failureHandler = null;
  }

  withSuccessHandler(callback) {
    const clone = Object.create(this);
    clone.successHandler = callback;
    return clone;
  }

  withFailureHandler(callback) {
    const clone = Object.create(this);
    clone.failureHandler = callback;
    return clone;
  }

  async invoke(method, ...args) {
    try {
      const result = await callBackendApi(method, args);
      if (this.successHandler) {
        this.successHandler(result);
      }
      return result;
    } catch (err) {
      if (this.failureHandler) {
        this.failureHandler(err);
      } else {
        console.error("API Failure:", err);
      }
    }
  }

  // Explicit methods for autocomplete and convenience
  registerUser(email, first, last, pass) { return this.invoke("registerUser", email, first, last, pass); }
  loginUser(email, pass) { return this.invoke("loginUser", email, pass); }
  processActivityLog(email, first, last, action, lat, lon) { return this.invoke("processActivityLog", email, first, last, action, lat, lon); }
  getAdminDashboardData() { return this.invoke("getAdminDashboardData"); }
  adminUpdateDailySummary(id, clockIn, clockOut, adminEmail) { return this.invoke("adminUpdateDailySummary", id, clockIn, clockOut, adminEmail); }
  adminDeleteDailySummary(id, date, email, adminEmail) { return this.invoke("adminDeleteDailySummary", id, date, email, adminEmail); }
  submitLeaveRequest(email, first, last, type, start, end) { return this.invoke("submitLeaveRequest", email, first, last, type, start, end); }
  adminUpdateLeaveStatus(reqId, status) { return this.invoke("adminUpdateLeaveStatus", reqId, status); }
  adminUpdateUser(email, first, last, status, pass) { return this.invoke("adminUpdateUser", email, first, last, status, pass); }
  exportTimesheetData(email, start, end, format) { return this.invoke("exportTimesheetData", email, start, end, format); }
  generateTimesheetsZip(email, start, end) { return this.invoke("generateTimesheetsZip", email, start, end); }
  exportLeaveForm(reqId, format) { return this.invoke("exportLeaveForm", reqId, format); }
}

const api = new ScriptRunShim();

// Also expose as window.google.script.run for complete backward compatibility
if (typeof window !== "undefined") {
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = api;
}

/* ==========================================================================
   SESSION HELPERS
   ========================================================================== */

const SESSION_STORAGE_KEY = "fnb_logger_session";

function saveSession(user, accountType) {
  const sessionData = {
    user: user,
    accountType: accountType,
    loginTimestamp: new Date().getTime()
  };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
}

function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function requireSession(requiredRole, loginUrl = "../index.html") {
  const session = getSession();
  if (!session || !session.user) {
    window.location.href = loginUrl;
    return null;
  }
  if (requiredRole && session.accountType !== requiredRole) {
    // If Admin attempts to view Employee portal or vice versa, redirect appropriately
    if (session.accountType === "Admin") {
      window.location.href = loginUrl.includes("../") ? "../admin/index.html" : "admin/index.html";
    } else {
      window.location.href = loginUrl.includes("../") ? "../employee/index.html" : "employee/index.html";
    }
    return null;
  }
  return session;
}

function logout(loginUrl = "../index.html") {
  clearSession();
  window.location.href = loginUrl;
}

/* ==========================================================================
   SPINNER & ALERT UI HELPERS
   ========================================================================== */

function showSpinner(show, message = "Processing request...") {
  let spinner = document.getElementById("globalSpinner");
  if (!spinner) {
    spinner = document.createElement("div");
    spinner.id = "globalSpinner";
    spinner.className = "spinner-overlay hidden";
    spinner.innerHTML = `
      <div class="spinner"></div>
      <div class="spinner-text" id="globalSpinnerText">${message}</div>
    `;
    document.body.appendChild(spinner);
  }
  const textElem = document.getElementById("globalSpinnerText");
  if (textElem) textElem.textContent = message;

  if (show) {
    spinner.classList.remove("hidden");
  } else {
    spinner.classList.add("hidden");
  }
}

function showAlert(alertElementId, message, type = "error") {
  const el = document.getElementById(alertElementId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert ${type === "error" ? "alert-error" : type === "success" ? "alert-success" : "alert-info"}`;
  el.classList.remove("hidden");
}

function hideAlert(alertElementId) {
  const el = document.getElementById(alertElementId);
  if (el) el.classList.add("hidden");
}

function triggerFileDownload(base64Data, contentType, filename) {
  const byteCharacters = atob(base64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  const blob = new Blob(byteArrays, { type: contentType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

