// admin.js - admin page: change coach prices and the home page text
// Only accounts with role = 'admin' in the profiles table can save changes.
// This page also sends everyone else back to the home page, but that is only to be tidy.
// The database rules (admin-setup.sql) do the real protecting.

var DEFAULT_BANNER = "Pick a game, choose a skill and book a session with a trainer.";

var priceBox = document.getElementById("priceList");
var priceMessage = document.getElementById("priceMessage");
var bannerInput = document.getElementById("bannerInput");
var bannerMessage = document.getElementById("bannerMessage");

var priceInputs = [];   // one { id, input } for every coach

// one row for every coach, with a box for the price
function showPrices() {
    Object.keys(TRAINERS).forEach(function (game) {
        Object.keys(TRAINERS[game]).forEach(function (skill) {
            TRAINERS[game][skill].forEach(function (t) {
                var row = document.createElement("label");
                var name = document.createElement("span");
                var input = document.createElement("input");

                row.className = "admin__row";
                name.textContent = t.name + " (" + GAME_NAMES[game] + ", " + skill + ")";

                input.type = "number";
                input.className = "admin__input";
                input.min = "0";
                input.max = "100000";
                input.step = "10";
                input.value = t.price;

                row.appendChild(name);
                row.appendChild(input);
                priceBox.appendChild(row);
                priceInputs.push({ id: t.id, input: input });
            });
        });
    });
}

// save every price
document.getElementById("savePrices").addEventListener("click", function () {
    var rows = [];

    for (var i = 0; i < priceInputs.length; i++) {
        var price = Number(priceInputs[i].input.value);
        if (!Number.isInteger(price) || price < 0 || price > 100000) {
            priceMessage.textContent = "Prices must be whole numbers from 0 to 100000.";
            return;
        }
        rows.push({ trainer_id: priceInputs[i].id, price: price });
    }

    priceMessage.textContent = "Saving...";
    Security.client.from("trainer_prices").upsert(rows).then(function (result) {
        priceMessage.textContent = result.error
            ? "Could not save: " + result.error.message
            : "Prices saved.";
    });
});

// the home page text
function showBanner() {
    Security.client.from("site_settings").select("value").eq("key", "home_banner").maybeSingle().then(function (result) {
        bannerInput.value = (result.data && result.data.value) || DEFAULT_BANNER;
    });
}

document.getElementById("saveBanner").addEventListener("click", function () {
    var text = bannerInput.value.trim();

    if (text.length < 1 || text.length > 300) {
        bannerMessage.textContent = "The text must be between 1 and 300 characters.";
        return;
    }

    bannerMessage.textContent = "Saving...";
    Security.client.from("site_settings").upsert({ key: "home_banner", value: text }).then(function (result) {
        bannerMessage.textContent = result.error
            ? "Could not save: " + result.error.message
            : "Text saved.";
    });
});

// only admins get to see the page
ready.then(function () {
    if (!Security.client) {
        location.replace("home.html");
        return;
    }

    Security.client.rpc("is_admin").then(function (result) {
        if (result.data !== true) {
            location.replace("home.html");
            return;
        }

        document.documentElement.style.visibility = "visible";
        showPrices();
        showBanner();
    });
});
