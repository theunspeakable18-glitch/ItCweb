/* script.js - login page */
Security.redirectIfLoggedIn();   // already logged in? go straight to home.html

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const rememberBox = document.getElementById("rememberMe");
const submitBtn = document.getElementById("submitBtn");

// "Remember me" also remembers the email on this device
const savedEmail = localStorage.getItem("gg_last_email");
if (savedEmail) {
  emailInput.value = savedEmail;
  rememberBox.checked = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value;
  const password = document.getElementById("password").value;
  const remember = rememberBox.checked;

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";
  try {
    await Security.login(email, password, remember);

    if (remember) localStorage.setItem("gg_last_email", email.trim());
    else localStorage.removeItem("gg_last_email");

    Security.redirectAfterLogin();
  } catch (err) {
    Security.showMessage(form, err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Log in";
    document.getElementById("password").value = "";
  }
});

// Forgot Password: sends a reset link to the email typed in the box
document.getElementById("forgotLink").addEventListener("click", async (e) => {
  e.preventDefault();

  if (!emailInput.value.trim()) {
    Security.showMessage(form, "Type your email in the box first, then press Forgot Password.");
    emailInput.focus();
    return;
  }

  try {
    await Security.sendPasswordReset(emailInput.value);
    Security.showMessage(form, "If that email has an account, a reset link is on its way. Check your inbox.", false);
  } catch (err) {
    Security.showMessage(form, err.message);
  }
});
