// Mobile menu toggle. Waits for the page to load so the navbar exists.
document.addEventListener('DOMContentLoaded', function () {
    const menu = document.querySelector('#mobile-menu');
    const menuLinks = document.querySelector('.navbar__menu');
    if (!menu || !menuLinks) return;

    menu.addEventListener('click', function () {
        menu.classList.toggle('is-active');
        menuLinks.classList.toggle('active');
    });
});
