/* security.js - login for GitGud, powered by Supabase Auth.
   Passwords are handled by Supabase (this site never stores them).
   Your data is protected by the Row Level Security rules in supabase-setup.sql.

   Every page only needs <script src="security.js"></script>.
   If a page doesn't already load the Supabase library and config.js, this file loads them itself. */
const Security = (() => {
  const GUEST_PAGE = "index.html";
  const HOME_PAGE = "home.html";
  const LOGIN_PAGE = "Login.html";
  const RETURN_KEY = "gg_return";
  const REMEMBER_KEY = "gg_remember";
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  const SETUP_HINT =
    "The site isn't connected to Supabase yet. Open config.js and paste your project URL and key.";
  const LOAD_HINT =
    "Can't load the login system. Check your internet connection, and that config.js is in the same folder as your pages.";

  // "Remember me" ticked  -> the login is kept in localStorage (survives closing the browser).
  // "Remember me" unticked -> it is kept in sessionStorage (ends when the browser closes).
  const storage = {
    getItem: (key) => sessionStorage.getItem(key) ?? localStorage.getItem(key),
    setItem: (key, value) => {
      const keep = localStorage.getItem(REMEMBER_KEY) === "1";
      (keep ? localStorage : sessionStorage).setItem(key, value);
      (keep ? sessionStorage : localStorage).removeItem(key);
    },
    removeItem: (key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };

  // ---------- connect to Supabase (loads what is missing, once) ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(el);
    });
  }

  let client = null;
  let clientPromise = null;

  function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        try {
          if (typeof window.supabase === "undefined") await loadScript(SUPABASE_CDN);
          if (typeof SUPABASE_URL === "undefined") await loadScript("config.js");
        } catch (e) {
          throw new Error(LOAD_HINT);
        }

        const configured =
          typeof window.supabase !== "undefined" &&
          typeof SUPABASE_URL !== "undefined" && !SUPABASE_URL.includes("PASTE") &&
          typeof SUPABASE_ANON_KEY !== "undefined" && !SUPABASE_ANON_KEY.includes("PASTE");
        if (!configured) {
          console.error("GitGud: " + SETUP_HINT);
          throw new Error(SETUP_HINT);
        }

        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
        return client;
      })().catch((e) => {
        clientPromise = null;   // allow a retry on the next call
        throw e;
      });
    }
    return clientPromise;
  }

  // ---------- validation ----------
  function validateUsername(u) {
    return /^[A-Za-z0-9_]{3,20}$/.test(u)
      ? null
      : "Username must be 3-20 characters: letters, numbers, underscore.";
  }

  function validateEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? null : "Enter a valid email address.";
  }

  function validatePassword(p) {
    if (p.length < 8) return "Password must be at least 8 characters.";
    if (p.length > 72) return "Password must be 72 characters or fewer.";
    if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p))
      return "Password needs an uppercase letter, a lowercase letter, and a number.";
    return null;
  }

  // Turn Supabase's technical errors into plain sentences
  function friendly(error) {
    const msg = String((error && error.message) || "");
    if (/invalid login credentials/i.test(msg)) return "Invalid email or password.";
    if (/email not confirmed/i.test(msg)) return "Please confirm your email first. Check your inbox.";
    if (/already registered|already been registered/i.test(msg)) return "That email already has an account. Try logging in.";
    if (/database error saving new user/i.test(msg)) return "That username is already taken.";
    if (/rate limit|too many/i.test(msg) || (error && error.status === 429)) return "Too many attempts. Wait a minute and try again.";
    if (/failed to fetch|network/i.test(msg)) return "Can't reach the server. Check your internet connection.";
    return msg || "Something went wrong. Try again.";
  }

  const nameOf = (user) => (user.user_metadata && user.user_metadata.username) || user.email;

  // ---------- public API ----------
  // Returns { username, needsConfirm }
  async function register(username, email, password, remember) {
    const name = (username || "").trim();
    const mail = (email || "").trim();
    const problem = validateUsername(name) || validateEmail(mail) || validatePassword(password || "");
    if (problem) throw new Error(problem);

    const c = await getClient();
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    const { data, error } = await c.auth.signUp({
      email: mail,
      password,
      options: {
        data: { username: name },
        emailRedirectTo: new URL("Login.html", location.href).href,
      },
    });
        if (error) {
      // Some Supabase settings answer "already registered" with an error
      if (/already registered|already been registered/i.test(error.message || "")) {
        return { username: name, exists: true };
      }
      throw new Error(friendly(error));
    }

    // Other settings answer with a fake user that has no identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { username: name, exists: true };
    }

    // No session yet means Supabase is waiting for the person to confirm their email
    return { username: name, needsConfirm: !data.session, exists: false };
  }

  async function login(email, password, remember) {
    const c = await getClient();
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    const { data, error } = await c.auth.signInWithPassword({
      email: (email || "").trim(),
      password,
    });
    if (error) throw new Error(friendly(error));
    return nameOf(data.user);
  }

  // Kept so older pages that still call it don't break. Logging in already made the session.
  async function createSession() {}

  async function logout() {
    try { (await getClient()).auth.signOut({ scope: "local" }); } catch (e) { /* already logged out */ }
  }

  // Returns { u, email, id, created, exp } or null when nobody is logged in
  async function getSession() {
    try {
      const { data } = await (await getClient()).auth.getSession();
      const session = data && data.session;
      if (!session) return null;
      return {
        u: nameOf(session.user),
        email: session.user.email,
        id: session.user.id,
        created: Date.parse(session.user.created_at),
        exp: session.expires_at * 1000,
      };
    } catch (e) {
      return null;
    }
  }

  // For pages that need a login: logged-out visitors are sent to index.html
  async function requireLogin() {
    document.documentElement.style.visibility = "hidden"; // avoid content flash
    const session = await getSession();
    if (!session) {
      location.replace(GUEST_PAGE);
      return;
    }
    document.documentElement.style.visibility = "visible";
  }

  // For public pages (index, log in, sign up): logged-in visitors go straight to the home page
  async function redirectIfLoggedIn() {
    document.documentElement.style.visibility = "hidden"; // avoid content flash
    const session = await getSession();                   // never throws, null on any problem
    if (session) {
      location.replace(HOME_PAGE);
      return;
    }
    document.documentElement.style.visibility = "visible";
  }

  // After logging in or signing up, always go to the home page
  function redirectAfterLogin() {
    sessionStorage.removeItem(RETURN_KEY);   // clears any old saved page from earlier versions
    location.replace(HOME_PAGE);
  }

  // ---------- tiny UI helper ----------
  function showMessage(form, text, isError = true) {
    let el = form.querySelector(".form__message");
    if (!el) {
      el = document.createElement("p");
      el.className = "form__message";
      el.setAttribute("role", "alert");
      form.insertBefore(el, form.querySelector("button[type=submit]"));
    }
    el.textContent = text; // textContent, never innerHTML
    el.style.color = isError ? "#ff4d4d" : "#4dff88";
    el.style.fontSize = "0.9rem";
    el.style.margin = "8px 0";
  }

  return {
    // The database client. It exists once any Security call has finished (booking.js relies on this).
    get client() { return client; },
    getClient, register, login, logout, getSession, requireLogin,
    redirectIfLoggedIn, createSession, redirectAfterLogin, showMessage,
  };
})();
