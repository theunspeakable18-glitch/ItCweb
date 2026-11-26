// transactions.js - saves booking transactions and shows them on the home page
// Transactions are saved in localStorage under "gg_transactions".
//
// To record one, add this line to your booking code (val.html, lol.html, cs2.html)
// right after a booking is confirmed:
//
// addTransaction({ game: "valorant", skill: "Aim", trainer: "Trainer name", amount: 500 });
//
// game is "valorant", "lol" or "cs2". amount is a number in pesos (leave it out for a free session).
// status is "Paid" unless you add status: "Pending" or status: "Cancelled".

var gameNames = {
    valorant: "Valorant",
    lol: "League of Legends",
    cs2: "Counter-Strike 2"
};

function loadTransactions() {
    try {
        return JSON.parse(localStorage.getItem("gg_transactions")) || [];
    } catch (e) {
        return [];
    }
}

function addTransaction(t) {
    var all = loadTransactions();
    t.id = Date.now();
    t.date = t.date || new Date().toISOString().slice(0, 10);
    t.status = t.status || "Paid";
    all.push(t);
    try {
        localStorage.setItem("gg_transactions", JSON.stringify(all));
    } catch (e) {}
}

// the rest only runs on the home page
var txList = document.getElementById("txList");
var txEmpty = document.getElementById("txEmpty");

if (txList) {
    var transactions = loadTransactions();

    // newest first, show the last 5
    transactions.sort(function (a, b) { return b.id - a.id; });
    transactions = transactions.slice(0, 5);

    txEmpty.hidden = transactions.length > 0;

    transactions.forEach(function (t) {
        var row = document.createElement("div");
        row.className = "dash__txrow";

        // left: what was booked
        var left = document.createElement("div");
        var title = document.createElement("b");
        var info = document.createElement("small");
        var date = new Date(t.date + "T00:00:00");

        title.textContent = (gameNames[t.game] || t.game) + ": " + t.skill;
        info.textContent = (t.trainer ? t.trainer + ", " : "") +
            date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        left.appendChild(title);
        left.appendChild(info);

        // right: amount and status
        var right = document.createElement("div");
        var amount = document.createElement("b");
        var status = document.createElement("small");
        right.className = "dash__txright";
        amount.textContent = t.amount ? "\u20B1" + t.amount : "Free";
        status.textContent = t.status;
        if (t.status === "Cancelled") status.className = "cancelled";
        right.appendChild(amount);
        right.appendChild(status);

        row.appendChild(left);
        row.appendChild(right);
        txList.appendChild(row);
    });
}