/**
 * Feste Beschriftungen im Seitengerüst, die den Betrag nennen („Umsatz von–bis",
 * Cockpit-Spalte …), folgen der eingelesenen Spalte: `data-revenue-term="name"`
 * bzw. `"short"` am Element (optional `data-revenue-suffix`) oder ein ganzer Text
 * als `data-revenue-template="{name} von–bis"`. Siehe features/revenueTerm.js.
 */
import { state, on } from '../core/state.js';
import { revenueTerm } from '../features/revenueTerm.js';

function applyRevenueLabels() {
    const term = revenueTerm(state.revenueKind);
    for (const el of document.querySelectorAll('[data-revenue-term]')) {
        el.textContent = `${term[el.dataset.revenueTerm] ?? term.name}${el.dataset.revenueSuffix || ''}`;
    }
    // Ganze Texte mit Platzhaltern („{name} von–bis"): kein Zusatz-Element im
    // Text, das fremde Formatierung erben könnte.
    for (const el of document.querySelectorAll('[data-revenue-template]')) {
        el.textContent = el.dataset.revenueTemplate.replace(/\{(\w+)\}/g, (_, key) => term[key] ?? term.name);
    }
}

export function initRevenueLabels() {
    on('customers:changed', applyRevenueLabels);
    applyRevenueLabels();
}
