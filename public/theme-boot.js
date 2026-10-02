/*
 * Darstellung vor dem ersten Bild festlegen (kein Hell-Dunkel-Flackern).
 * Gleiche Regel wie src/ui/theme.js: gespeicherte Wahl „light“/„dark“ gilt,
 * sonst („auto“ oder nichts gespeichert) folgt TourFuchs dem Gerät.
 */
(function () {
    var choice = 'auto';
    try { choice = localStorage.getItem('tf_theme') || 'auto'; } catch (e) { /* privat/gesperrt */ }
    var dark = choice === 'dark'
        || (choice !== 'light' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    if (dark) document.documentElement.classList.add('aurora-dark');
})();
