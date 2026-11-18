/**
 * ============================================================================
 * FNB LOGGER - SHARED LEAVE REQUEST MODAL LOGIC
 * ============================================================================
 * Shared between Employee and Admin portals.
 */

function initLeaveModal(onSuccessCallback = null) {
  window._leaveSuccessCallback = onSuccessCallback;
}

function openLeaveModal() {
  const modal = document.getElementById("leaveModal");
  if (!modal) return;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const startEl = document.getElementById("leaveStartDate");
  const endEl = document.getElementById("leaveEndDate");
  
  if (startEl && !startEl.value) startEl.value = todayStr;
  if (endEl && !endEl.value) endEl.value = todayStr;
  
  hideAlert("leaveModalAlert");
  modal.classList.remove("hidden");
}

function closeLeaveModal() {
  const modal = document.getElementById("leaveModal");
  if (modal) modal.classList.add("hidden");
}

async function handleLeaveFormSubmit(e) {
  e.preventDefault();
  
  const session = getSession();
  if (!session || !session.user) {
    alert("Session expired. Please log in again.");
    return;
  }
  
  const leaveType = document.getElementById("leaveType").value;
  const startDate = document.getElementById("leaveStartDate").value;
  const endDate = document.getElementById("leaveEndDate").value;
  
  if (!startDate || !endDate) {
    showAlert("leaveModalAlert", "Please select both start and end dates.", "error");
    return;
  }
  
  if (new Date(startDate) > new Date(endDate)) {
    showAlert("leaveModalAlert", "Start date cannot be after end date.", "error");
    return;
  }
  
  showSpinner(true, "Submitting leave application...");
  
  try {
    const res = await api.submitLeaveRequest(
      session.user.email,
      session.user.firstName,
      session.user.lastName,
      leaveType,
      startDate,
      endDate
    );
    
    showSpinner(false);
    
    if (res.status === "success") {
      closeLeaveModal();
      alert(res.message || "Leave request submitted successfully.");
      if (typeof window._leaveSuccessCallback === "function") {
        window._leaveSuccessCallback(res);
      }
    } else {
      showAlert("leaveModalAlert", res.message || "Failed to submit leave request.", "error");
    }
  } catch (err) {
    showSpinner(false);
    showAlert("leaveModalAlert", "Network or server error: " + err.message, "error");
  }
}

