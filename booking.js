const TRAINERS = {
    Valorant: {
        Aim: [
            { id: 'a1', name: 'Mika', role: 'Duelist main', bio: 'Crosshair placement and first-bullet accuracy.', price: 500, days: [1, 2, 3, 4, 5], from: 17, to: 21 },
            { id: 'a2', name: 'Dante', role: 'Sentinel main', bio: 'Spray control and holding angles.', price: 450, days: [0, 2, 4, 6], from: 10, to: 16 },
            { id: 'a3', name: 'Ayla', role: 'Flex player', bio: 'Warm-up routines and fixing bad habits.', price: 400, days: [1, 3, 5, 6], from: 14, to: 20 }
        ],
        Movement: [
            { id: 'm1', name: 'Juno', role: 'Initiator main', bio: 'Shoulder peeks, jiggles and counter-strafing.', price: 450, days: [1, 2, 3, 4], from: 18, to: 22 },
            { id: 'm2', name: 'Rex', role: 'Duelist main', bio: 'Wide swings, trades and crossfires.', price: 500, days: [0, 5, 6], from: 9, to: 15 },
            { id: 'm3', name: 'Sol', role: 'Controller main', bio: 'Positioning and quiet rotations.', price: 400, days: [2, 3, 4, 5], from: 15, to: 19 }
        ],
        Gamesense: [
            { id: 'g1', name: 'Nova', role: 'In-game leader', bio: 'Round reads, calls and team economy.', price: 600, days: [1, 3, 5], from: 16, to: 21 },
            { id: 'g2', name: 'Kai', role: 'Controller main', bio: 'Utility timing and site retakes.', price: 500, days: [0, 2, 4, 6], from: 11, to: 17 },
            { id: 'g3', name: 'Wren', role: 'Analyst', bio: 'Replay reviews and decision making.', price: 450, days: [1, 2, 3, 4, 5], from: 19, to: 22 }
        ]
    },
    CS2: {
        Aim: [
            { id: 'ca1', name: 'Tomas', role: 'Entry fragger', bio: 'Crosshair placement and spray control.', price: 450, days: [1, 2, 3, 4], from: 17, to: 21 },
            { id: 'ca2', name: 'Lena', role: 'AWPer', bio: 'Holding angles and flick consistency.', price: 500, days: [0, 3, 5, 6], from: 12, to: 18 }
        ],
        Movement: [
            { id: 'cm1', name: 'Viktor', role: 'Rifler', bio: 'Counter-strafing and clean peeks.', price: 400, days: [1, 2, 4, 5], from: 18, to: 22 },
            { id: 'cm2', name: 'Pia', role: 'Lurker', bio: 'Quiet movement and map timings.', price: 450, days: [0, 2, 6], from: 10, to: 16 }
        ],
        Gamesense: [
            { id: 'cg1', name: 'Ivo', role: 'In-game leader', bio: 'Economy, defaults and mid-round calls.', price: 600, days: [1, 3, 5], from: 16, to: 21 },
            { id: 'cg2', name: 'Sana', role: 'Support', bio: 'Utility usage, trades and demo reviews.', price: 500, days: [0, 2, 4, 6], from: 11, to: 17 }
        ]
    },
    LoL: {
        Laning: [
            { id: 'ln1', name: 'Bram', role: 'Mid laner', bio: 'Last-hitting, trading and wave control.', price: 500, days: [1, 2, 3, 4], from: 17, to: 21 },
            { id: 'ln2', name: 'Cleo', role: 'ADC main', bio: 'Bot lane spacing and farming under pressure.', price: 450, days: [0, 3, 5, 6], from: 12, to: 18 }
        ],
        Macro: [
            { id: 'mc1', name: 'Hana', role: 'Jungler', bio: 'Pathing, objectives and tempo.', price: 500, days: [1, 2, 4, 5], from: 18, to: 22 },
            { id: 'mc2', name: 'Dmitri', role: 'Support main', bio: 'Vision control and rotations.', price: 400, days: [0, 2, 6], from: 10, to: 16 }
        ],
        Teamfights: [
            { id: 'tf1', name: 'Tala', role: 'Top laner', bio: 'Engage timing and peeling for your carries.', price: 450, days: [1, 3, 5], from: 16, to: 21 },
            { id: 'tf2', name: 'Reuben', role: 'ADC main', bio: 'Positioning and target priority.', price: 500, days: [0, 2, 4, 6], from: 11, to: 17 }
        ]
    }
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let bookings = [];     // every booked slot from the server

// ---------- talking to the database (Supabase) ----------
async function refreshBookings() {
    try {
        const session = await Security.getSession();
        if (!session) throw new Error('not logged in');

        const { data, error } = await Security.client
            .from('bookings')
            .select('id, user_id, game, skill, trainer_id, date, hour');
        if (error) throw error;

        bookings = data.map(r => ({
            id: r.id,
            game: r.game,
            skill: r.skill,
            trainer: r.trainer_id,
            date: r.date,
            hour: r.hour,
            mine: r.user_id === session.id
        }));
    } catch (e) {
        if (e.message !== 'not logged in') console.error('Could not load bookings:', e);
        bookings = [];
    }
}

// Only MY bookings (the account page uses this)
async function loadBookings() {
    await refreshBookings();
    return bookings.filter(b => b.mine);
}

async function cancelBooking(id) {
    // The database only lets you delete your own bookings
    await Security.client.from('bookings').delete().eq('id', id);
}

// Explains why a booking failed. The full technical error is also printed in the console (F12).
function bookingErrorMessage(error) {
    if (error.code === '23505') return 'Sorry, that slot was just taken. Pick another time.';
    if (error.code === 'P0001') return error.message;   // rules from supabase-setup.sql
    if (error.code === '42P01' || error.code === 'PGRST205') {
        return 'The bookings table does not exist yet. Run supabase-setup.sql in your Supabase SQL Editor.';
    }
    if (error.code === '42501' || error.code === 'PGRST301' || /jwt/i.test(error.message || '')) {
        return 'Your login expired or is missing permission. Log out, log in again, then retry.';
    }
    return 'Could not save the booking (error ' + (error.code || 'unknown') + '). Press F12 and open the Console for details.';
}

// Runs once: load the booked slots from the database
const ready = refreshBookings();

// ---------- helpers ----------
function toDateString(d) {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day;
}

function formatTime(hour) {
    const h12 = ((hour + 11) % 12) + 1;
    return h12 + ':00 ' + (hour < 12 ? 'AM' : 'PM');
}

function formatPrice(amount) {
    return '\u20B1' + amount.toLocaleString('en-US');
}

function formatDate(dateString) {
    const parts = dateString.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function isTaken(trainer, date, hour) {
    return bookings.some(b => b.trainer === trainer.id && b.date === date && b.hour === hour);
}

function getOpenSlots(trainer, dateString) {
    const parts = dateString.split('-').map(Number);
    const day = new Date(parts[0], parts[1] - 1, parts[2]);
    const now = new Date();
    const slots = [];

    if (!trainer.days.includes(day.getDay())) return slots;

    for (let h = trainer.from; h < trainer.to; h++) {
        const isToday = toDateString(day) === toDateString(now);
        if (isToday && h <= now.getHours()) continue;
        if (!isTaken(trainer, dateString, h)) slots.push(h);
    }
    return slots;
}

// ---------- the confirmation window ----------
const GAME_NAMES = { Valorant: 'Valorant', CS2: 'Counter-Strike 2', LoL: 'League of Legends' };

function confirmRow(label, value, extraClass) {
    return '<li' + (extraClass ? ' class="' + extraClass + '"' : '') + '><span>' + label + '</span><b>' + value + '</b></li>';
}

// the list of booking details (used before and after booking)
function confirmRows(d) {
    return '<ul class="confirm__rows">' +
        confirmRow('Game', GAME_NAMES[d.game] || d.game) +
        confirmRow('Skill', d.skill) +
        confirmRow('Coach', d.trainer.name + ' (' + d.trainer.role + ')') +
        confirmRow('Date', formatDate(d.date)) +
        confirmRow('Time', formatTime(d.hour) + ', 1 hour') +
        confirmRow('Total', formatPrice(d.trainer.price), 'confirm__total') +
    '</ul>';
}

// Shows the details and asks the player to confirm.
// onConfirm saves the booking and returns an error (or nothing if it worked).
function showConfirm(details, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm';
    overlay.innerHTML =
        '<div class="confirm__box" role="dialog" aria-modal="true">' +
            '<h2>Confirm your booking</h2>' +
            '<p class="confirm__note">Check the details below before you book.</p>' +
            confirmRows(details) +
            '<p class="confirm__note">You can cancel a session from your account or schedule page.</p>' +
            '<div class="confirm__actions">' +
                '<button class="booking__btn confirm__yes">Confirm booking</button>' +
                '<button class="confirm__no">Go back</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    const box = overlay.querySelector('.confirm__box');
    const yesBtn = overlay.querySelector('.confirm__yes');
    const noBtn = overlay.querySelector('.confirm__no');
    yesBtn.focus();

    function close() {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
        if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);

    noBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
    });

    yesBtn.addEventListener('click', async () => {
        yesBtn.disabled = true;
        yesBtn.textContent = 'Booking...';

        const error = await onConfirm();
        if (error) {
            close();
            alert(bookingErrorMessage(error));
            return;
        }

        // it worked: show the confirmation
        box.innerHTML =
            '<h2>Booking confirmed</h2>' +
            '<p class="confirm__note">Your session is booked.</p>' +
            confirmRows(details) +
            '<div class="confirm__actions">' +
                '<button class="booking__btn confirm__schedule">View my schedule</button>' +
                '<button class="confirm__no">Close</button>' +
            '</div>';
        box.querySelector('.confirm__schedule').addEventListener('click', () => {
            location.href = 'schedule.html';
        });
        box.querySelector('.confirm__no').addEventListener('click', close);
    });
}

// ---------- the booking box ----------
function setupBooking(box) {
    const game = box.dataset.game || 'Valorant';
    const skill = box.dataset.skill;
    const trainers = TRAINERS[game][skill];
    const state = { trainer: null, date: null, time: null };

    box.innerHTML =
        '<h2>Book a session</h2>' +
        '<div class="booking__trainers"></div>' +
        '<div class="booking__schedule" hidden>' +
            '<h3>Pick a day</h3><div class="booking__days"></div>' +
            '<h3>Pick a time</h3><div class="booking__times"></div>' +
        '</div>' +
        '<div class="booking__confirm">' +
            '<button class="booking__btn" disabled>Book session</button>' +
            '<span class="booking__summary">Choose a trainer, day and time.</span>' +
        '</div>' +
        '<h3>Your ' + skill + ' sessions</h3>' +
        '<ul class="booking__list"></ul>';

    const trainerBox = box.querySelector('.booking__trainers');
    const schedule = box.querySelector('.booking__schedule');
    const daysBox = box.querySelector('.booking__days');
    const timesBox = box.querySelector('.booking__times');
    const bookBtn = box.querySelector('.booking__btn');
    const summary = box.querySelector('.booking__summary');
    const list = box.querySelector('.booking__list');

    function renderTrainers() {
        trainerBox.innerHTML = '';
        trainers.forEach(t => {
            const btn = document.createElement('button');
            btn.className = 'booking__trainer' + (state.trainer === t ? ' selected' : '');
            btn.innerHTML = '<b>' + t.name + '</b><small>' + t.role + '</small><small>' + formatPrice(t.price) + ' per session</small><span>' + t.bio + '</span>';
            btn.addEventListener('click', () => {
                state.trainer = t;
                state.date = null;
                state.time = null;
                renderAll();
            });
            trainerBox.appendChild(btn);
        });
    }

    function renderSchedule() {
        schedule.hidden = !state.trainer;
        if (!state.trainer) return;

        daysBox.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateString = toDateString(d);
            const hasSlots = getOpenSlots(state.trainer, dateString).length > 0;

            const btn = document.createElement('button');
            btn.className = 'booking__day' + (state.date === dateString ? ' selected' : '');
            btn.innerHTML = '<small>' + DAY_NAMES[d.getDay()] + '</small>' + d.getDate();
            btn.disabled = !hasSlots;
            btn.addEventListener('click', () => {
                state.date = dateString;
                state.time = null;
                renderAll();
            });
            daysBox.appendChild(btn);
        }

        timesBox.innerHTML = '';
        if (!state.date) {
            timesBox.innerHTML = '<p class="booking__empty">Select a day to see open times.</p>';
            return;
        }
        getOpenSlots(state.trainer, state.date).forEach(h => {
            const btn = document.createElement('button');
            btn.className = 'booking__time' + (state.time === h ? ' selected' : '');
            btn.textContent = formatTime(h);
            btn.addEventListener('click', () => {
                state.time = h;
                renderAll();
            });
            timesBox.appendChild(btn);
        });
    }

    function renderConfirm() {
        const ready = state.trainer && state.date && state.time !== null;
        bookBtn.disabled = !ready;
        summary.textContent = ready
            ? skill + ' with ' + state.trainer.name + ', ' + formatDate(state.date) + ' at ' + formatTime(state.time) + ' (' + formatPrice(state.trainer.price) + ')'
            : 'Choose a trainer, day and time.';
    }

    function renderList() {
        const mine = bookings
            .filter(b => b.mine && b.game === game && b.skill === skill)
            .sort((a, b) => (a.date + String(a.hour).padStart(2, '0')).localeCompare(b.date + String(b.hour).padStart(2, '0')));

        list.innerHTML = mine.length ? '' : '<li class="booking__empty">No sessions booked yet.</li>';

        mine.forEach(b => {
            const trainer = trainers.find(t => t.id === b.trainer);
            const li = document.createElement('li');
            li.innerHTML = '<div><b>' + trainer.name + '</b><small>' + formatDate(b.date) + ' at ' + formatTime(b.hour) + '</small></div>';

            const cancel = document.createElement('button');
            cancel.className = 'booking__cancel';
            cancel.textContent = 'Cancel';
            cancel.addEventListener('click', async () => {
                await cancelBooking(b.id);
                await refreshBookings();
                renderAll();
            });

            li.appendChild(cancel);
            list.appendChild(li);
        });
    }

    function renderAll() {
        renderTrainers();
        renderSchedule();
        renderConfirm();
        renderList();
    }

    bookBtn.addEventListener('click', () => {
        const details = { game: game, skill: skill, trainer: state.trainer, date: state.date, hour: state.time };

        // the confirmation window runs this when the player presses Confirm
        showConfirm(details, async () => {
            const { error } = await Security.client.from('bookings').insert({
                game: game,
                skill: skill,
                trainer_id: details.trainer.id,
                date: details.date,
                hour: details.hour
            });

            if (error) console.error('Booking failed:', error);

            state.date = null;
            state.time = null;
            await refreshBookings();
            renderAll();
            return error;
        });
    });

    renderAll();
}

// Wait for the server data, then build the boxes
ready.then(() => document.querySelectorAll('.booking').forEach(setupBooking));