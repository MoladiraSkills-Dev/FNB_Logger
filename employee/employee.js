/**
 * ============================================================================
 * FNB LOGGER - EMPLOYEE PORTAL CLIENT LOGIC
 * ============================================================================
 */

const LOGIN_URL = "../index.html";
let currentSession = null;

document.addEventListener("DOMContentLoaded", () => {
  currentSession = requireSession("Employee", LOGIN_URL);
  if (!currentSession) return;

  const greeting = document.getElementById("employeeGreeting");
  if (greeting && currentSession.user) {
    greeting.textContent = `Welcome, ${currentSession.user.firstName}!`;
  }

  const userEmailElem = document.getElementById("employeeEmail");
  if (userEmailElem && currentSession.user) {
    userEmailElem.textContent = currentSession.user.email;
  }

  initLeaveModal(() => {
    showAlert("employeeAlert", "Your leave application has been submitted to management for review.", "success");
  });
});

function handleLogout() {
  logout(LOGIN_URL);
}

function triggerClock(actionType) {
  hideAlert("employeeAlert");
  showSpinner(true, "Requesting device GPS coordinates...");

  if (!navigator.geolocation) {
    showSpinner(false);
    showAlert("employeeAlert", "Geolocation is not supported by your device browser.", "error");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      showSpinner(true, `Recording ${actionType} with telemetry verification...`);
      
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
          const msg = `Success: ${res.action} logged at ${res.time}. Resolved Location: ${res.location}`;
          showAlert("employeeAlert", msg, "success");
        } else {
          showAlert("employeeAlert", res.message || `Failed to record ${actionType}.`, "error");
        }
      } catch (err) {
        showSpinner(false);
        showAlert("employeeAlert", "Network or server error: " + err.message, "error");
      }
    },
    (geoError) => {
      showSpinner(false);
      let errMsg = "Location access blocked. Please allow location permissions in your browser.";
      if (geoError.code === geoError.TIMEOUT) {
        errMsg = "Location request timed out. Please retry in an open area.";
      }
      showAlert("employeeAlert", errMsg, "error");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

