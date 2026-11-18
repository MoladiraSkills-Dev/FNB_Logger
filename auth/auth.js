/**
 * ============================================================================
 * FNB LOGGER - AUTHENTICATION LOGIC (LOGIN & REGISTER)
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  // Check if session already active; if so redirect
  const session = getSession();
  if (session && session.user) {
    if (session.accountType === "Admin") {
      window.location.href = "admin/index.html";
      return;
    } else {
      window.location.href = "employee/index.html";
      return;
    }
  }

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);
  if (registerForm) registerForm.addEventListener("submit", handleRegisterSubmit);
});

function toggleAuthMode(toLogin) {
  hideAlert("authAlert");
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (toLogin) {
    title.innerHTML = 'FNB <span>Logsheet System</span>';
    subtitle.textContent = "Enter your credentials to access workspace logging.";
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  } else {
    title.innerHTML = 'Create <span>Access Account</span>';
    subtitle.textContent = "Register as an employee to record attendance and leave.";
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  hideAlert("authAlert");

  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;

  if (!email || !pass) {
    showAlert("authAlert", "Please enter both email and password.", "error");
    return;
  }

  showSpinner(true, "Verifying FNB credentials...");

  try {
    const res = await api.loginUser(email, pass);
    showSpinner(false);

    if (res.status === "success") {
      saveSession(res.user, res.accountType);

      if (res.accountType === "Admin") {
        window.location.href = "admin/index.html";
      } else {
        window.location.href = "employee/index.html";
      }
    } else {
      showAlert("authAlert", res.message || "Invalid login credentials.", "error");
    }
  } catch (err) {
    showSpinner(false);
    showAlert("authAlert", "Connection error: " + err.message, "error");
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  hideAlert("authAlert");

  const first = document.getElementById("regFirst").value.trim();
  const last = document.getElementById("regLast").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const pass = document.getElementById("regPassword").value;

  if (!first || !last || !email || !pass) {
    showAlert("authAlert", "Please fill in all registration fields.", "error");
    return;
  }

  showSpinner(true, "Registering profile records...");

  try {
    const res = await api.registerUser(email, first, last, pass);
    showSpinner(false);

    if (res.status === "success") {
      document.getElementById("registerForm").reset();
      toggleAuthMode(true);
      showAlert("authAlert", res.message || "Registration successful! You may now sign in.", "success");
    } else {
      showAlert("authAlert", res.message || "Registration failed.", "error");
    }
  } catch (err) {
    showSpinner(false);
    showAlert("authAlert", "Connection error: " + err.message, "error");
  }
}

