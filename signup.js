/* signup.js */
Security.redirectIfLoggedIn();   // already logged in? go straight to home.html

const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirmPassword").value;
  const remember = document.getElementById("rememberMe").checked;

  if (password !== confirm) {
    Security.showMessage(form, "The two passwords do not match.");
    document.getElementById("confirmPassword").focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account...";
  try {
    const result = await Security.register(username, email, password, remember);

    // This email already has an account: send them to log in
    if (result.exists) {
      Security.showMessage(form, "That email already has an account. Taking you to log in...", false);
      setTimeout(() => Security.redirectToLogin(), 1500);
      return;
    }

    if (result.needsConfirm) {
      Security.showMessage(form, "Account created! Check your email to confirm it, then log in.", false);
      document.getElementById("password").value = "";
      document.getElementById("confirmPassword").value = "";
      if (window.refreshPasswordHints) window.refreshPasswordHints();
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign Up";
      return;
    }

    Security.showMessage(form, "Account created! Redirecting...", false);
    setTimeout(() => Security.redirectAfterLogin(), 600);
  } catch (err) {
    Security.showMessage(form, err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign Up";
  }
});
