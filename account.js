Security.requireLogin('account.html');

// ---------- helpers ----------
function sessionTime(b) {
    const parts = b.date.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], b.hour);
}

function trainerName(id) {
    const all = Object.values(TRAINERS).flatMap(game => Object.values(game)).flat();
    const found = all.find(t => t.id === id);
    return found ? found.name : 'Trainer';
}

// ---------- profile ----------
Security.getSession().then(session => {
    if (!session) return;

    const name = session.u;
    document.getElementById('acctName').textContent = name;
    document.getElementById('acctAvatar').textContent = name.charAt(0).toUpperCase();

    if (session.created) {
        document.getElementById('acctSince').textContent =
            'Member since ' + new Date(session.created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    document.getElementById('acctExpiry').textContent = session.email || '';
});

document.getElementById('acctLogout').addEventListener('click', async () => {
    await Security.logout();
    location.replace('index.html');
});

// ---------- sessions ----------
function makeItem(b, canCancel) {
    const game = b.game || 'Valorant';
    const li = document.createElement('li');
    li.innerHTML = '<div><b>' + game + ' ' + b.skill + ' with ' + trainerName(b.trainer) + '</b>' +
        '<small>' + formatDate(b.date) + ' at ' + formatTime(b.hour) + '</small></div>';

    if (canCancel) {
        const cancel = document.createElement('button');
        cancel.className = 'acct__cancel';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', async () => {
            if (!confirm('Cancel this session?')) return;
            await cancelBooking(b.id);
            renderSessions();
        });
        li.appendChild(cancel);
    }
    return li;
}

async function renderSessions() {
    const now = new Date();
    const all = (await loadBookings()).sort((a, b) => sessionTime(a) - sessionTime(b));
    const upcoming = all.filter(b => sessionTime(b) > now);
    const past = all.filter(b => sessionTime(b) <= now).reverse();

    document.getElementById('statTotal').textContent = all.length;
    document.getElementById('statUpcoming').textContent = upcoming.length;
    document.getElementById('statDone').textContent = past.length;

    const upList = document.getElementById('acctUpcoming');
    const pastList = document.getElementById('acctPast');
    upList.innerHTML = '';
    pastList.innerHTML = '';
    pastList.classList.add('is-past');

    if (upcoming.length === 0) {
        upList.innerHTML = '<li class="acct__empty">No upcoming sessions. Pick a game to book one: ' +
            '<a href="val.html">Valorant</a>, <a href="lol.html">LoL</a> or <a href="cs2.html">CS2</a>.</li>';
    } else {
        upcoming.forEach(b => upList.appendChild(makeItem(b, true)));
    }

    if (past.length === 0) {
        pastList.innerHTML = '<li class="acct__empty">Your finished sessions will show up here.</li>';
    } else {
        past.forEach(b => pastList.appendChild(makeItem(b, false)));
    }
}

ready.then(renderSessions);
