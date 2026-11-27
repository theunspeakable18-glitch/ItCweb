/* reset.js - choose a new password after clicking the link in the reset email */

const form = document.getElementById("resetForm");
const submitBtn = document.getElementById("submitBtn");

// The email link logs the person in for a moment. Without that, the link is invalid or old.
Security.getSession().then((session) => {
  if (!session) {
    Security.showMessage(form, "This link is invalid or has expired. Go to the log in page and press Forgot Password again.");
    submitBtn.disabled = true;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (password !== confirm) {
    Security.showMessage(form, "The two passwords do not match.");
    document.getElementById("confirmPassword").focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";
  try {
    await Security.updatePassword(password);
    Security.showMessage(form, "Password updated! Redirecting...", false);
    setTimeout(() => Security.redirectAfterLogin(), 1200);
  } catch (err) {
    Security.showMessage(form, err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "Save new password";
  }
});
