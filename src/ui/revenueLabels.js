/**
 * Feste Beschriftungen im Seitengerüst, die den Betrag nennen („Umsatz von–bis",
 * Cockpit-Spalte …), folgen der eingelesenen Spalte: `data-revenue-term="name"`
 * bzw. `"short"` am Element, optional `data-revenue-suffix`. Siehe
 * features/revenueTerm.js.
 */
import { state, on } from '../core/state.js';
import { revenueTerm } from '../features/revenueTerm.js';

function applyRevenueLabels() {
    const term = revenueTerm(state.revenueKind);
    for (const el of document.querySelectorAll('[data-revenue-term]')) {
        el.textContent = `${term[el.dataset.revenueTerm] ?? term.name}${el.dataset.revenueSuffix || ''}`;
    }
}

export function initRevenueLabels() {
    on('customers:changed', applyRevenueLabels);
    applyRevenueLabels();
}
