import { on } from '../core/state.js';

/**
 * Kontextbasiertes Zurücktreten vorübergehender Angebote – ohne Timer.
 *
 * Idee (Product Owner): Angebots-Elemente wie der Kartenstil-Wähler oder der
 * Beispieldaten-Streifen sollen nicht dauerhaft Platz belegen. Sobald sich der
 * Nutzer dem eigentlichen Prozess zuwendet – erkennbar daran, dass er in den
 * Inhalt scrollt – treten sie sanft zurück und geben der Prozessfläche mehr
 * Raum (spürbar auf kleinen Handys). Bewusst KEIN Timer: der Nutzer löst es
 * selbst aus, es ist jederzeit umkehrbar (Hochscrollen), und beim (Wieder-)
 * Betreten eines Bereichs werden die Angebote erneut angeboten – nie dauerhaft
 * weg. Die Prozess-Schritte selbst bleiben immer sichtbar.
 */
export function initOfferAutoHide() {
    let receded = false;
    let locked = false;

    function setReceded(on) {
        if (on === receded) return;
        receded = on;
        document.body.classList.toggle('offers-receded', on);
        // Kurze Sperre: Das Ein-/Ausklappen löst einen Reflow aus, der selbst ein
        // Scroll-Ereignis feuern kann. Ohne die Sperre könnte der Zustand sofort
        // zurückkippen (Flackern).
        locked = true;
        setTimeout(() => { locked = false; }, 400);
    }

    // Scroll bubbelt nicht – daher in der Capture-Phase am Dokument lauschen und
    // nur auf die Haupt-Inhaltsfläche (die aktive Tab-Karte) reagieren. Etwas
    // Hysterese (48 px runter, 8 px hoch) verhindert Zittern am Umschaltpunkt.
    document.addEventListener('scroll', (ev) => {
        const el = ev.target;
        if (locked || !(el instanceof Element) || !el.classList || !el.classList.contains('tab-panel')) return;
        const y = el.scrollTop;
        if (!receded && y > 48) setReceded(true);
        else if (receded && y < 8) setReceded(false);
    }, true);

    // (Wieder-)Betreten eines Bereichs bietet die Angebote erneut an.
    on('tab:changed', () => setReceded(false));
    on('mode:changed', () => setReceded(false));

    // Auf-/Zuklappen des mobilen Blatts setzt ebenfalls zurück: Der eingeklappte
    // Peek zeigt bewusst den Beispieldaten-Streifen – dort darf nichts
    // „zurückgetreten" sein.
    const sidebar = document.getElementById('sidebar');
    if (sidebar && typeof MutationObserver !== 'undefined') {
        let wasOpen = sidebar.classList.contains('open');
        new MutationObserver(() => {
            const openNow = sidebar.classList.contains('open');
            if (openNow !== wasOpen) { wasOpen = openNow; setReceded(false); }
        }).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }
}
