// auth-ui.js - small helpers for the log in, sign up and reset pages
// (wrapped in a function so its names never clash with the page scripts)
(function () {

    // ----- Show / Hide buttons next to password boxes -----
    document.querySelectorAll(".auth__eye").forEach(function (button) {
        button.addEventListener("click", function () {
            var input = document.getElementById(button.dataset.target);
            var show = input.type === "password";
            input.type = show ? "text" : "password";
            button.textContent = show ? "Hide" : "Show";
            button.setAttribute("aria-label", show ? "Hide password" : "Show password");
        });
    });

    // ----- Caps Lock warning -----
    var capsWarning = document.querySelector(".auth__caps");

    document.querySelectorAll(".auth__pw").forEach(function (input) {
        function check(e) {
            if (capsWarning && e.getModifierState) {
                capsWarning.hidden = !e.getModifierState("CapsLock");
            }
        }
        input.addEventListener("keydown", check);
        input.addEventListener("keyup", check);
        input.addEventListener("blur", function () {
            if (capsWarning) capsWarning.hidden = true;
        });
    });

    // ----- Username hint (sign up page) -----
    var usernameInput = document.getElementById("username");
    var usernameHint = document.getElementById("usernameHint");

    if (usernameInput && usernameHint) {
        usernameInput.addEventListener("input", function () {
            var text = usernameInput.value;
            var good = /^[A-Za-z0-9_]{3,20}$/.test(text);

            usernameHint.classList.toggle("auth__hint--ok", text !== "" && good);
            usernameHint.classList.toggle("auth__hint--bad", text !== "" && !good);
            usernameHint.textContent = text === "" || !good
                ? "3-20 letters, numbers or underscores"
                : "Looks good";
        });
    }

    // ----- Password checklist and strength bar (sign up and reset pages) -----
    var passwordInput = document.getElementById("password");
    var confirmInput = document.getElementById("confirmPassword");
    var bar = document.getElementById("pwBar");
    var strengthText = document.getElementById("pwStrength");
    var ruleItems = document.querySelectorAll("#pwRules li");
    var matchHint = document.getElementById("matchHint");

    var passwordRules = {
        length: function (p) { return p.length >= 8; },
        lower: function (p) { return /[a-z]/.test(p); },
        upper: function (p) { return /[A-Z]/.test(p); },
        number: function (p) { return /[0-9]/.test(p); }
    };

    function checkPassword() {
        var p = passwordInput.value;
        var met = 0;

        ruleItems.forEach(function (item) {
            var ok = passwordRules[item.dataset.rule](p);
            item.classList.toggle("met", ok);
            if (ok) met++;
        });

        bar.className = "auth__bar" + (p ? " auth__bar--" + met : "");
        strengthText.textContent = p
            ? ["Too weak", "Weak", "Weak", "Okay", "Strong"][met]
            : "Enter a password";
    }

    function checkMatch() {
        if (!confirmInput || !matchHint) return;

        var same = confirmInput.value === passwordInput.value;
        matchHint.classList.toggle("auth__hint--ok", confirmInput.value !== "" && same);
        matchHint.classList.toggle("auth__hint--bad", confirmInput.value !== "" && !same);
        matchHint.textContent = confirmInput.value === ""
            ? ""
            : (same ? "Passwords match" : "Passwords do not match");
    }

    if (passwordInput && bar && strengthText) {
        passwordInput.addEventListener("input", function () {
            checkPassword();
            checkMatch();
        });
        if (confirmInput) confirmInput.addEventListener("input", checkMatch);
        checkPassword();

        // lets the page scripts refresh the bar after they clear the boxes
        window.refreshPasswordHints = function () {
            checkPassword();
            checkMatch();
        };
    }

})();
