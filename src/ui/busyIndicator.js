/**
 * „Bitte warten" für lange Vorgänge – Start mit vielen Kunden, Neuaufbau der
 * Karte nach einem Filter. Ohne Hinweis wirkt TourFuchs bei über 10.000
 * Kunden für Sekunden eingefroren, und man fragt sich, ob es noch arbeitet.
 *
 * Die Anzeige erscheint erst nach kurzer Verzögerung (CSS): Was schnell geht,
 * blinkt nicht auf. Mehrere Vorgänge können gleichzeitig laufen; sichtbar
 * bleibt sie, bis der letzte fertig ist, mit dem Text des jüngsten.
 */
const active = new Map();   // Schlüssel -> Text

function element() {
    return typeof document === 'undefined' ? null : document.getElementById('app-busy');
}

function render() {
    const box = element();
    if (!box) return;
    const texts = [...active.values()];
    box.hidden = texts.length === 0;
    const text = box.querySelector('.app-busy-text');
    if (text && texts.length) text.textContent = texts[texts.length - 1];
}

/** Hinweis zeigen oder Text aktualisieren (z. B. Fortschritt). */
export function showBusy(key, text) {
    active.delete(key);      // jüngster Text zuletzt
    active.set(key, text);
    render();
}

export function hideBusy(key) {
    if (!active.delete(key)) return;
    render();
}

export function isBusy(key) {
    return key ? active.has(key) : active.size > 0;
}
