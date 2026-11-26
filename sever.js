const express = require('express');
const Database = require('better-sqlite3');

const db = new Database('gitgud.db');
const app = express();
app.use(express.json());
app.use(express.static('.'));   // serves your HTML, CSS and JS files

db.exec(`
CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    trainer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    hour INTEGER NOT NULL,
    UNIQUE (trainer_id, date, hour)
)`);

// Get one user's bookings
app.get('/api/bookings', (req, res) => {
    const rows = db.prepare('SELECT * FROM bookings WHERE username = ?').all(req.query.username);
    res.json(rows);
});

// Make a booking
app.post('/api/bookings', (req, res) => {
    const { username, trainer_id, date, hour } = req.body;
    try {
        db.prepare('INSERT INTO bookings (username, trainer_id, date, hour) VALUES (?, ?, ?, ?)')
          .run(username, trainer_id, date, hour);
        res.json({ ok: true });
    } catch (e) {
        res.status(409).json({ error: 'That slot is already taken.' });
    }
});

app.listen(3000, () => console.log('Running at http://localhost:3000'));