// myschedule.js - schedule page: your booked sessions for the next 8 days
// Bookings come from booking.js (loaded from Supabase).
// To book a new session, go to a game page. You can cancel a session here.

var gameInfo = {
    Valorant: { name: "Valorant", page: "val.html" },
    LoL: { name: "League of Legends", page: "lol.html" },
    CS2: { name: "Counter-Strike 2", page: "cs2.html" }
};

var weekBox = document.getElementById("weekList");
var totalText = document.getElementById("planTotal");

// the date and time a booking starts
function bookingTime(b) {
    var parts = b.date.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], b.hour);
}

// find a trainer's name from the trainer id
function trainerLabel(id) {
    var all = Object.values(TRAINERS).flatMap(function (game) { return Object.values(game); }).flat();
    var found = all.find(function (t) { return t.id === id; });
    return found ? found.name : "Trainer";
}

// one booked session
function makeSession(b, now) {
    var game = gameInfo[b.game];

    var item = document.createElement("div");
    item.className = "week__session";

    // clicking the session opens its game page
    var link = document.createElement("a");
    link.className = "week__link";
    link.href = game.page;
    var title = document.createElement("b");
    var small = document.createElement("small");
    title.textContent = formatTime(b.hour) + " " + b.skill;
    small.textContent = game.name + " with " + trainerLabel(b.trainer);
    link.appendChild(title);
    link.appendChild(small);
    item.appendChild(link);

    // you can only cancel sessions that have not started yet
    if (bookingTime(b) > now) {
        var cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "week__remove";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", function () {
            if (!confirm("Cancel this session?")) return;
            cancelBooking(b.id).then(showWeek);
        });
        item.appendChild(cancel);
    }

    return item;
}

// one row for a day
function makeDay(day, index, sessionsForDay, now) {
    var row = document.createElement("div");
    row.className = "week__day dash__card" + (index === 0 ? " today" : "");

    var name = document.createElement("b");
    var date = document.createElement("small");
    name.className = "week__name";
    name.appendChild(document.createTextNode(DAY_NAMES[day.getDay()]));
    name.appendChild(document.createElement("br"));
    date.textContent = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    name.appendChild(date);

    var box = document.createElement("div");
    box.className = "week__sessions";

    if (sessionsForDay.length === 0) {
        var free = document.createElement("span");
        free.className = "week__free";
        free.textContent = "Rest day";
        box.appendChild(free);
    }

    sessionsForDay.forEach(function (b) {
        box.appendChild(makeSession(b, now));
    });

    row.appendChild(name);
    row.appendChild(box);
    return row;
}

// today and the next 7 days (the game pages let you book up to 7 days ahead)
function showWeek() {
    loadBookings().then(function (all) {
        var now = new Date();
        var total = 0;

        weekBox.innerHTML = "";

        for (var i = 0; i < 8; i++) {
            var day = new Date();
            day.setDate(day.getDate() + i);
            var dateString = toDateString(day);

            var sessionsForDay = all.filter(function (b) {
                return b.date === dateString && gameInfo[b.game];
            });
            sessionsForDay.sort(function (a, b) { return a.hour - b.hour; });

            total += sessionsForDay.length;
            weekBox.appendChild(makeDay(day, i, sessionsForDay, now));
        }

        totalText.textContent = total + (total === 1 ? " session" : " sessions") + " in the next 8 days";
    });
}

ready.then(showWeek);