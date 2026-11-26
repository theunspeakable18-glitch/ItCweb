/* signup.js */
Security.redirectIfLoggedIn();   // already logged in? go straight to home.html

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector("button[type=submit]");
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const remember = document.getElementById("rememberMe").checked;

  btn.disabled = true;
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
      btn.disabled = false;
      return;
    }
    Security.showMessage(form, "Account created! Redirecting...", false);
    setTimeout(() => Security.redirectAfterLogin(), 600);
  } catch (err) {
    Security.showMessage(form, err.message);
    btn.disabled = false;
  }
});
