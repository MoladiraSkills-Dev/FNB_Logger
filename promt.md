# System Role & Objective
You are an expert full-stack developer specializing in Google Apps Script (Backend/API) and modern vanilla JavaScript + CSS (Frontend). Build a comprehensive **Geolocation Attendance, Leave, and Device Management System** (a "Logger") for a company. Replace the placeholder brand  with the new client's brand name and palette.

## Architecture Constraint (Decoupled Deployment for Security)

**Frontend:** A static multi-page web app (HTML/JS/CSS) hosted on GitHub Pages. It talks to the backend only through asynchronous `fetch()` `POST` requests.
**Backend:** A Google Apps Script (`Code.gs`) deployed as a Web App executing as the script owner (Who has access: "Anyone"). It uses `doPost(e)` to route API requests and returns JSON.
**Security:** API keys, Google Sheet references, hashing logic and database operations MUST stay in `Code.gs`. The frontend only knows the Web App URL (set once in `shared/js/api.js`).

## Step 1: Database Initialization Script
Provide a standalone Apps Script function `setupDatabase()` (see the end of this file) that is run once to create all Google Sheets and columns. The schema must be exactly:

- **Users:** [Email, First Name, Last Name, Password Hash, Salt, Account Type, Status, Verification Token]
- **Activity_Logs:** [Log ID, Email, First Name, Last Name, Date, Time, Action, Latitude, Longitude, Resolved Location Name, Edited By]
- **Daily_Summaries:** [First Name, Last Name, Summary ID, Date, Email, Clock In Time, Clock Out Time, Clock-In Floor Time, Clock-Out Floor Time, Total Hours worked, Status, Worked Overtime]
- **Weekly_Summaries:** [First Name, Last Name, Email, Week Identifier, Total Hours Worked, Total Overtime, Days Worked, Compliance Status, Last Updated]
- **Monthly_Summaries:** [First Name, Last Name, Email, Month, Total Hours Worked, Total Overtime, Days Worked, Last Updated]
- **Leave_Requests:** [Request ID, Email, First Name, Last Name, Leave Type, Start Date, End Date, Status, Submitted Date]

## Step 2: Core Business Logic (Backend, `Code.gs`)

1. **Custom Authentication:** Validate against the Users sheet using SHA-256 hashing with a unique salt per user. Account Type is `Employee` or `Admin`; Status `Blocked` denies login.
2. **Geolocation Logging:** On Clock In/Out accept GPS coordinates, reverse-geocode them (e.g. LocationIQ) and store the physical address. Block a duplicate action of the same type on the same day.
3. **Floor Times (Crucial):**
   - **Clock-In Floor Time** = the employee's *exact* clock-in time, shown as `HH:mm` (**no seconds**). Write it on Clock In, and keep it after Clock Out.
   - **Clock-Out Floor Time** = standard end time: `17:00` Mon-Fri, `13:00` Saturday. For admin-edited shifts it is the actual edited clock-out.
   - **Hours worked = Floor Clock-Out − Floor Clock-In**, then deduct exactly 1 hour for lunch when the standard work minutes exceed 1 hour (no lunch deduction on Saturday).
   - Provide a helper such as `formatTimeWithoutSeconds()` that accepts `HH:mm:ss`, `HH:mm`, AM/PM strings and Sheets Date objects, and use it everywhere floor-in is written or read.
4. **Overtime Lockdown:** Normal clock-outs lock overtime to `0 mins`. Overtime is only awarded when an Admin explicitly edits the shift (admin edit flag), and only for time beyond the standard end time.
5. **Auto-Failsafes:** If a shift is still "In Progress" from a previous day, auto-log the user out at the standard end time. If a user clocks out without a clock-in today, auto-log them in first.
6. **Summaries:** Keep Weekly (ISO week; compliance: min 45h, max 55h) and Monthly summaries synced whenever a daily summary is completed, edited or deleted.
7. **Exports:** Provide PDF, CSV and ZIP timesheet exports. **The PDF/CSV Start and End times MUST come from the Clock-In Floor Time and Clock-Out Floor Time columns** (fallback to 08:00 / 17:00 or 13:00 Saturday only when blank). Show the lunch deduction and weekly/monthly totals.
8. **Maintenance utilities & Smart Sync:** Provide runnable backend functions to re-sync historical data (e.g. `extractExistingLogsToDailySummaries()` and `resetMorningFloorClockInTimes()`). Note: All data synchronization and maintenance utilities are handled strictly in the backend (`Code.gs`) or via Apps Script triggers, and are NOT exposed on the frontend.
9. **API Routing:** Use a central `handleApiRequest` function. **CRITICAL:** Handle CORS by reading data from `e.parameter.payload` inside `doPost(e)`. Do NOT rely on `e.postData.contents`. Return `ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)`.

## Step 3: Frontend Requirements (GitHub Pages)

### Folder structure (separate Admin and Employee code)
```
index.html              ← login / register page only
auth/auth.js            ← login/register logic; redirects by role
shared/
  css/base.css          ← design tokens, layout, buttons, inputs, alerts, badges, modal, utilities
  js/api.js             ← API client, google.script.run shim, session helpers, spinner/alert helpers
  js/leave.js           ← leave modal logic shared by both portals
employee/
  index.html, employee.css, employee.js   ← clock in/out, leave request
admin/
  index.html, admin.css, admin.js         ← tabs, tables, filters, exports, staff + leave management
```
Rules for this structure:
- Role-specific CSS/JS/HTML stays inside its own folder; only genuinely shared code goes in `shared/`.
- Pages load `../shared/css/base.css` first, then their own stylesheet; and `../shared/js/api.js` (plus `leave.js` if needed) before their own script.
- `auth.js` calls `saveSession(user, accountType)` and redirects: `Admin` → `admin/index.html`, everyone else → `employee/index.html`.
- Each portal calls `requireSession(role, loginUrl)` on load and redirects to the login page if the session is missing or the role is wrong. Logout clears `sessionStorage` and returns to login.
- Inline `onclick` handlers may use globals such as `LOGIN_URL`, so declare them with top-level `const` in each page script.

### Requirements
1. **Design System:** Pure vanilla CSS with CSS variables for the brand palette. Rich, premium, modern look (gradients, cards, micro-animations, Inter font). Do NOT use Tailwind CSS.
2. **Mobile Responsiveness:** Every HTML page has `<meta name="viewport" content="width=device-width, initial-scale=1.0">`. All grid/flex layouts stack on mobile. The employee portal is a narrow card; the admin dashboard uses a wide container (`.admin-wide`).
3. **Employee Portal:** Greeting, Clock In / Clock Out buttons (browser geolocation required), Request Leave modal.
4. **Admin Dashboard:** Own clock in/out panel + leave registration, and tabs: Activity Logs (date/search filters, login/logout counters), Daily Summaries (actual times, floor times in `HH:mm`, net hours, overtime, edit/delete), Weekly, Monthly, Leave (approve/reject), Staff (edit name, block/verify, reset password), Export (PDF/CSV/ZIP). Note: Historical "Smart Sync" is intentionally excluded from the admin frontend and managed in the `Code.gs` backend.
5. **API Communication:** Use `fetch()` with `method: "POST"`, `headers: { "Content-Type": "application/x-www-form-urlencoded" }` and a `URLSearchParams` body containing `payload` (JSON `{method, args}`). This avoids CORS preflight. Do NOT use real `google.script.run`; a small shim in `shared/js/api.js` may expose the same `.withSuccessHandler().method()` style on top of `fetch`.
6. **SEO/Semantics:** One `<h1>` per page, a `<title>` and meta description per page, semantic elements, unique IDs on interactive elements.

## Step 4: Deployment Checklist
1. Create a Google Sheet, open Apps Script, paste `Code.gs`, run `setupDatabase()` once.
2. Deploy as Web App (Execute as: Me, Access: Anyone) and copy the `/exec` URL into `APPS_SCRIPT_WEB_APP_URL` in `shared/js/api.js`.
3. Add the geocoding API key to `Code.gs` only (never in the frontend).
4. Push the static files (`index.html`, `auth/`, `shared/`, `employee/`, `admin/`) to GitHub Pages.
5. Register one user, then set its Account Type to `Admin` directly in the Users sheet.
6. After any change to floor-time logic or to re-sync historical logs, run the maintenance utilities directly in Google Apps Script (`Code.gs`) rather than from the frontend.

---

### 🛠️ The Database Initialization Script
*(Paste into a blank Code.gs file in a new Google Sheet and hit Run once.)*

```javascript
/**
 * Run this function ONCE in a new Google Sheet to instantly 
 * build the entire Database Architecture for the Logger.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const schemas = {
    "Users": ["Email", "First Name", "Last Name", "Password Hash", "Salt", "Account Type", "Status", "Verification Token"],
    "Activity_Logs": ["Log ID", "Email", "First Name", "Last Name", "Date", "Time", "Action", "Latitude", "Longitude", "Resolved Location Name", "Edited By"],
    "Daily_Summaries": ["First Name", "Last Name", "Summary ID", "Date", "Email", "Clock In Time", "Clock Out Time", "Clock-In Floor Time", "Clock-Out Floor Time", "Total Hours worked", "Status", "Worked Overtime"],
    "Weekly_Summaries": ["First Name", "Last Name", "Email", "Week Identifier", "Total Hours Worked", "Total Overtime", "Days Worked", "Compliance Status", "Last Updated"],
    "Monthly_Summaries": ["First Name", "Last Name", "Email", "Month", "Total Hours Worked", "Total Overtime", "Days Worked", "Last Updated"],
    "Leave_Requests": ["Request ID", "Email", "First Name", "Last Name", "Leave Type", "Start Date", "End Date", "Status", "Submitted Date"]
  };

  for (const [sheetName, headers] of Object.entries(schemas)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#f8fafc");
    headerRange.setBorder(true, true, true, true, false, false);
    
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  const sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  return "Database Setup Complete! All tables have been generated with formatting.";
}
```