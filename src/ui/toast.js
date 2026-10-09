/**
 * Kleine, unaufdringliche Statusmeldungen (Toasts).
 */

import { on } from '../core/state.js';

let container = null;

export function initToasts() {
    container = document.getElementById('toasts');
    // `ms` ist optional: Kurzlebige Hinweise sollen nicht ausgerechnet das
    // verdecken, was sie ankündigen (etwa den Auswahlstreifen des Lassos).
    on('toast', ({ type = 'info', text, ms, prominent = false }) => (
        showToast(text, type, ms, { prominent })
    ));
}

/**
 * Meldungen in die oberste Ebene des Browsers heben (Popover).
 *
 * Ein per showModal() geöffneter Dialog liegt über allen normalen Elementen –
 * auch über der Meldungsleiste. Eine Fehlermeldung aus einem offenen Dialog
 * (etwa „Datei konnte nicht gelesen werden" beim Empfang einer Umzugsdatei)
 * war deshalb unsichtbar: Für den Nutzer „passierte nichts". Erneutes Öffnen
 * legt die Leiste über den zuletzt geöffneten Dialog. Ohne Popover-Unterstützung
 * bleibt alles wie bisher.
 */
function raise() {
    if (typeof container.showPopover !== 'function') return;
    try {
        if (container.matches(':popover-open')) container.hidePopover();
        container.showPopover();
    } catch { /* ohne Popover: wie bisher */ }
}

export function showToast(text, type = 'info', durationMs = 4000, { prominent = false } = {}) {
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}${prominent ? ' toast-prominent' : ''}`;
    el.textContent = text;
    container.appendChild(el);
    raise();
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => {
            el.remove();
            if (!container.childElementCount && typeof container.hidePopover === 'function') {
                try { container.hidePopover(); } catch { /* schon zu */ }
            }
        }, 300);
    }, durationMs);
}
