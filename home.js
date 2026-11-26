Security.requireLogin('home.html');

// Show the logged-in username
Security.getSession().then(session => {
    const nameEl = document.getElementById('userName');
    if (session && nameEl) {
        nameEl.textContent = session.u;
    }
});