// schedule.js - home page: schedule, stats and transactions
// Everything comes from your bookings. booking.js loads them from Supabase.

var gameInfo = {
    Valorant: { name: "Valorant", page: "val.html" },
    LoL: { name: "League of Legends", page: "lol.html" },
    CS2: { name: "Counter-Strike 2", page: "cs2.html" }
};

// the date and time a booking starts
function bookingTime(b) {
    var parts = b.date.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], b.hour);
}

// find a trainer from the trainer id
function findTrainer(id) {
    var all = Object.values(TRAINERS).flatMap(function (game) { return Object.values(game); }).flat();
    return all.find(function (t) { return t.id === id; });
}

function trainerLabel(id) {
    var found = findTrainer(id);
    return found ? found.name : "Trainer";
}

// the two boxes at the top: sessions in the next 7 days, and the next session
function showStats(upcoming, inAWeek) {
    var thisWeek = upcoming.filter(function (b) { return bookingTime(b) < inAWeek; });
    document.getElementById("statCount").textContent = thisWeek.length;

    if (upcoming.length > 0) {
        var next = upcoming[0];
        document.getElementById("statNext").textContent =
            bookingTime(next).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        document.getElementById("statNextInfo").textContent =
            formatTime(next.hour) + ", " + gameInfo[next.game].name + ": " + next.skill;
    }
}

// the schedule panel: each session is a link to its game page
function showSchedule(upcoming) {
    var list = document.getElementById("schedList");
    var emptyText = document.getElementById("schedEmpty");

    list.innerHTML = "";
    emptyText.hidden = upcoming.length > 0;

    upcoming.slice(0, 6).forEach(function (b) {
        var game = gameInfo[b.game];

        var link = document.createElement("a");
        link.className = "dash__session";
        link.href = game.page;

        var info = document.createElement("div");
        var title = document.createElement("b");
        var when = document.createElement("small");
        title.textContent = b.skill + " with " + trainerLabel(b.trainer);
        when.textContent = formatDate(b.date) + " at " + formatTime(b.hour);
        info.appendChild(title);
        info.appendChild(when);

        var tag = document.createElement("span");
        tag.className = "dash__tag";
        tag.textContent = game.name;

        link.appendChild(info);
        link.appendChild(tag);
        list.appendChild(link);
    });
}

// the transactions card: your latest bookings, with the coach's price
function showTransactions(all, now) {
    var txList = document.getElementById("txList");
    var txEmpty = document.getElementById("txEmpty");

    var latest = all.slice().sort(function (a, b) { return bookingTime(b) - bookingTime(a); }).slice(0, 5);

    txList.innerHTML = "";
    txEmpty.hidden = latest.length > 0;

    latest.forEach(function (b) {
        var row = document.createElement("div");
        row.className = "dash__txrow";

        var left = document.createElement("div");
        var title = document.createElement("b");
        var info = document.createElement("small");
        title.textContent = gameInfo[b.game].name + ": " + b.skill + " with " + trainerLabel(b.trainer);
        info.textContent = formatDate(b.date) + " at " + formatTime(b.hour);
        left.appendChild(title);
        left.appendChild(info);

        // right: the coach's price and the status
        var trainer = findTrainer(b.trainer);
        var right = document.createElement("div");
        var amount = document.createElement("b");
        var status = document.createElement("small");
        right.className = "dash__txright";
        amount.textContent = trainer ? formatPrice(trainer.price) : "";
        status.textContent = bookingTime(b) > now ? "Confirmed" : "Completed";
        right.appendChild(amount);
        right.appendChild(status);

        row.appendChild(left);
        row.appendChild(right);
        txList.appendChild(row);
    });
}

// load your bookings, then fill in the page
function showHome() {
    loadBookings().then(function (all) {
        var now = new Date();
        var inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // only bookings for our three games
        all = all.filter(function (b) { return gameInfo[b.game]; });

        var upcoming = all.filter(function (b) { return bookingTime(b) > now; });
        upcoming.sort(function (a, b) { return bookingTime(a) - bookingTime(b); });

        showStats(upcoming, inAWeek);
        showSchedule(upcoming);
        showTransactions(all, now);
    });
}

ready.then(showHome);