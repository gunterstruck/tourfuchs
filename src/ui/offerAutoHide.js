import { on, emit } from '../core/state.js';
import { nextRecededState } from '../features/offerAutoHide.js';

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
 *
 * Zurücktreten nur, wenn es sich lohnt: Gäben die Angebote mehr Platz frei, als
 * der Inhalt an Überhang hat, dann passte der Inhalt danach ganz ins Fenster –
 * es gäbe nichts mehr zu scrollen und damit kein Ereignis, das sie zurückholt.
 * Die Regel dazu steht prüfbar in features/offerAutoHide.js.
 */
/**
 * Die Elemente, die beim Zurücktreten Platz freigeben.
 *
 * Die Erste-Schritte-Karte gehört dazu: Sie klappt zwar nur zur schmalen Zeile
 * ein statt ganz zu verschwinden, ist aber mit Abstand das größte Angebot. Ihre
 * volle Höhe zu zählen überschätzt den Gewinn um die Höhe der Zeile – und das
 * ist die harmlose Richtung: Wer zu viel veranschlagt, tritt im Zweifel nicht
 * zurück. Wer zu wenig veranschlagt, landet in der Einbahnstraße.
 */
const OFFERS = ['.basemap-control', '#demo-banner', '#first-steps'];

/** Außenhöhe inklusive Ränder: genau das, was beim Zurücktreten auf 0 geht. */
function outerHeight(el) {
    const rect = el.getBoundingClientRect();
    if (!rect.height) return 0;
    const style = getComputedStyle(el);
    return rect.height
        + (parseFloat(style.marginTop) || 0)
        + (parseFloat(style.marginBottom) || 0);
}

/** Wie viel Platz das Zurücktreten der Angebote gerade freigäbe. */
function recedableSpace() {
    let total = 0;
    for (const selector of OFFERS) {
        document.querySelectorAll(selector).forEach((el) => { total += outerHeight(el); });
    }
    return total;
}

export function initOfferAutoHide() {
    let receded = false;
    let locked = false;

    function setReceded(on) {
        if (on === receded) return;
        receded = on;
        document.body.classList.toggle('offers-receded', on);
        // Die Erste-Schritte-Karte ist das größte Angebot auf der Fläche. Sie hat
        // eine eigene Einklapp-Logik (ui/firstSteps.js) und klappt hier nur zur
        // schmalen Zeile ein – ein Klick holt sie zurück.
        emit('offers:receded', on);
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
        const next = nextRecededState({
            receded,
            scrollTop: el.scrollTop,
            overflow: el.scrollHeight - el.clientHeight,
            freed: recedableSpace()
        });
        if (next !== null) setReceded(next);
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
