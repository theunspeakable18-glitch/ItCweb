const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// ---------- settings ----------
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';   // set this when you deploy over HTTPS
const COOKIE_NAME = 'gg_sid';
const BCRYPT_COST = 12;
const SESSION_SHORT_MS = 2 * 60 * 60 * 1000;             // 2 hours
const SESSION_REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;     // 7 days
const MAX_UPCOMING_BOOKINGS = 10;
const GAMES = ['Valorant', 'CS2', 'LoL'];

// Pages that need a login. The server refuses to send them to logged-out visitors.
const PROTECTED_PAGES = ['/home.html', '/val.html', '/lol.html', '/cs2.html', '/account.html'];

// ---------- database ----------
const db = new Database('gitgud.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Upgrade: the first version of the bookings table had no user_id column
const oldBookings = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'").get();
if (oldBookings && !/user_id/.test(oldBookings.sql)) {
    db.exec('ALTER TABLE bookings RENAME TO bookings_old');
    console.log('Old bookings table was renamed to bookings_old.');
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,          -- lowercase, used for lookups
    display_name  TEXT NOT NULL,                 -- as the person typed it
    password_hash TEXT NOT NULL,                 -- bcrypt hash, never the password
    created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,                 -- SHA-256 of the cookie value
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game       TEXT NOT NULL,
    skill      TEXT NOT NULL,
    trainer_id TEXT NOT NULL,
    date       TEXT NOT NULL,
    hour       INTEGER NOT NULL,
    UNIQUE (trainer_id, date, hour)              -- the database blocks double bookings
);
`);

// Remove expired sessions every hour
setInterval(() => {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}, 60 * 60 * 1000).unref();

// ---------- helpers ----------
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// Used when a username doesn't exist, so the response time doesn't reveal valid usernames
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

function parseCookies(header) {
    const out = {};
    (header || '').split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i > 0) {
            try {
                out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
            } catch (e) { /* ignore broken cookie */ }
        }
    });
    return out;
}

function validateUsername(u) {
    return /^[A-Za-z0-9_]{3,20}$/.test(u)
        ? null
        : 'Username must be 3-20 characters: letters, numbers, underscore.';
}

function validatePassword(p) {
    if (p.length < 8) return 'Password must be at least 8 characters.';
    if (p.length > 72) return 'Password must be 72 characters or fewer.';
    if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) {
        return 'Password needs an uppercase letter, a lowercase letter, and a number.';
    }
    return null;
}

function startSession(res, userId, remember) {
    const token = crypto.randomBytes(32).toString('hex');
    const ttl = remember ? SESSION_REMEMBER_MS : SESSION_SHORT_MS;

    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .run(sha256(token), userId, Date.now() + ttl);

    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,            // JavaScript in the page can't read it
        sameSite: 'strict',        // not sent from other websites
        secure: IS_PROD,           // HTTPS only when deployed
        path: '/',
        maxAge: remember ? ttl : undefined   // no "remember me" = ends when the browser closes
    });
}

function getUser(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) return null;

    const row = db.prepare(`
        SELECT u.id, u.display_name, u.created_at, s.expires_at
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`).get(sha256(token));

    if (!row || row.expires_at < Date.now()) return null;
    return row;
}

function requireAuth(req, res, next) {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in.' });
    req.user = user;
    next();
}

// ---------- app + middleware ----------
const app = express();

// Print every API call in the terminal, so you can see what the browser sends
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.on('finish', () => console.log(req.method + ' ' + req.path + ' -> ' + res.statusCode));
    }
    next();
});

// Security headers. CSP is off for now because your pages use inline scripts.
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json({ limit: '10kb' }));

// Block requests that come from a different website
app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin) {
            let host = null;
            try { host = new URL(origin).host; } catch (e) { /* bad origin */ }
            if (host !== req.headers.host) {
                return res.status(403).json({ error: 'Request blocked.' });
            }
        }
    }
    next();
});

// Logged-out visitors never receive protected pages
app.use((req, res, next) => {
    if (PROTECTED_PAGES.includes(req.path.toLowerCase()) && !getUser(req)) {
        return res.redirect('/index.html');
    }
    next();
});

// Serve the site from a "public" folder if you have one, otherwise from this folder.
const SITE_DIR = fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : __dirname;

// Only normal website files are ever sent. The database, server code and node_modules never are.
const SERVED_TYPES = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.mp4', '.webm', '.woff', '.woff2', '.ttf']);
const NEVER_SERVE = /(^|\/)(node_modules|\.[^/]*)(\/|$)|^\/(server|sever)[^/]*\.js$/i;

app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/')) return next();

    let p;
    try { p = decodeURIComponent(req.path); } catch (e) { return res.status(400).send('Bad request'); }

    const ext = path.extname(p).toLowerCase();
    if (p === '/' || ext === '') return next();   // "/" shows index.html
    if (!SERVED_TYPES.has(ext) || NEVER_SERVE.test(p)) return res.status(404).send('Not found');
    next();
});

app.use(express.static(SITE_DIR, { dotfiles: 'ignore' }));

// ---------- rate limits ----------
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,                       // 10 failed logins per 15 minutes per IP
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in a few minutes.' }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,                       // 10 new accounts per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-ups from this connection. Try again later.' }
});

// ---------- account routes ----------
app.post('/api/register', registerLimiter, async (req, res) => {
    const { username, password, remember } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Enter a username and password.' });
    }

    const name = username.trim();
    const problem = validateUsername(name) || validatePassword(password);
    if (problem) return res.status(400).json({ error: problem });

    try {
        const hash = await bcrypt.hash(password, BCRYPT_COST);
        const result = db.prepare(
            'INSERT INTO users (username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)'
        ).run(name.toLowerCase(), name, hash, Date.now());

        startSession(res, result.lastInsertRowid, !!remember);
        res.json({ username: name });
    } catch (e) {
        if (String(e.code).startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ error: 'That username is already taken.' });
        }
        console.error(e);
        res.status(500).json({ error: 'Server error. Try again.' });
    }
});

app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password, remember } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Enter a username and password.' });
    }

    try {
        const user = db.prepare(
            'SELECT id, display_name, password_hash FROM users WHERE username = ?'
        ).get(username.trim().toLowerCase());

        // Always run bcrypt, even for unknown usernames
        const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

        if (!user || !ok) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        startSession(res, user.id, !!remember);
        res.json({ username: user.display_name });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error. Try again.' });
    }
});

app.post('/api/logout', (req, res) => {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
    res.json({
        username: req.user.display_name,
        created: req.user.created_at,
        expires: req.user.expires_at
    });
});

// ---------- booking routes ----------
// Everyone sees which slots are taken, but never who took them.
app.get('/api/bookings', requireAuth, (req, res) => {
    const rows = db.prepare(
        'SELECT id, user_id, game, skill, trainer_id, date, hour FROM bookings'
    ).all();

    res.json(rows.map((r) => ({
        id: r.id,
        game: r.game,
        skill: r.skill,
        trainer: r.trainer_id,
        date: r.date,
        hour: r.hour,
        mine: r.user_id === req.user.id
    })));
});

app.post('/api/bookings', requireAuth, (req, res) => {
    const { game, skill, trainer, date, hour } = req.body || {};

    const valid =
        GAMES.includes(game) &&
        typeof skill === 'string' && /^[A-Za-z]{2,20}$/.test(skill) &&
        typeof trainer === 'string' && /^[a-z0-9]{2,6}$/.test(trainer) &&
        typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        Number.isInteger(hour) && hour >= 0 && hour <= 23;

    if (!valid) return res.status(400).json({ error: 'Invalid booking details.' });

    // Real calendar date, not in the past
    const [y, m, d] = date.split('-').map(Number);
    const when = new Date(y, m - 1, d, hour);
    if (when.getFullYear() !== y || when.getMonth() !== m - 1 || when.getDate() !== d) {
        return res.status(400).json({ error: 'Invalid date.' });
    }
    if (when <= new Date()) {
        return res.status(400).json({ error: 'That time has already passed.' });
    }

    // Stop one account from grabbing every slot
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
    const upcoming = db.prepare(
        'SELECT COUNT(*) AS n FROM bookings WHERE user_id = ? AND date >= ?'
    ).get(req.user.id, todayStr).n;
    if (upcoming >= MAX_UPCOMING_BOOKINGS) {
        return res.status(429).json({ error: 'You can have up to ' + MAX_UPCOMING_BOOKINGS + ' upcoming sessions.' });
    }

    try {
        db.prepare(
            'INSERT INTO bookings (user_id, game, skill, trainer_id, date, hour) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(req.user.id, game, skill, trainer, date, hour);
        res.json({ ok: true });
    } catch (e) {
        res.status(409).json({ error: 'Sorry, that slot was just taken. Pick another time.' });
    }
});

// You can only cancel your own bookings
app.delete('/api/bookings/:id', requireAuth, (req, res) => {
    const result = db.prepare('DELETE FROM bookings WHERE id = ? AND user_id = ?')
        .run(Number(req.params.id), req.user.id);
    res.json({ ok: result.changes > 0 });
});

// Bad JSON etc.
app.use((err, req, res, next) => {
    res.status(400).json({ error: 'Bad request.' });
});

app.listen(PORT, () => {
    console.log('GitGud is running at http://localhost:' + PORT);
    console.log('Serving site files from: ' + SITE_DIR);
    ['index.html', 'Login.html', 'SignUp.html', 'istyles.css'].forEach((f) => {
        if (!fs.existsSync(path.join(SITE_DIR, f))) console.log('WARNING: ' + f + ' was not found in that folder.');
    });
    console.log('Open the site at http://localhost:' + PORT + ' (not Live Server, not a file).');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('Port ' + PORT + ' is already in use. An older server is probably still running: close it (Ctrl+C) and try again.');
    } else {
        console.log(err);
    }
});
