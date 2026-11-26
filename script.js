/* script.js - login page */
Security.redirectIfLoggedIn();   // already logged in? go straight to home.html

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector("button[type=submit]");
  // the email box is id="email" (older pages used id="username")
  const emailInput = document.getElementById("email") || document.getElementById("username");
  const email = emailInput.value;
  const password = document.getElementById("password").value;
  const remember = document.getElementById("rememberMe").checked;

  btn.disabled = true;
  try {
    await Security.login(email, password, remember);
    Security.redirectAfterLogin();
  } catch (err) {
    Security.showMessage(form, err.message);
    btn.disabled = false;
    document.getElementById("password").value = "";
  }
});
