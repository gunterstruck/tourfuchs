/**
 * Reine Rechnungen für die Gebiets-Pillen über der Karte (siehe
 * src/ui/mapPills.js): Reihenfolge fürs Briefing, Bezeichnung des Gebiets,
 * Dateiname fürs Excel. Ohne DOM, damit sie sich einzeln prüfen lassen.
 */
import { UNASSIGNED } from '../core/state.js';
import { visitStatus, lastVisit } from './visits.js';

const STATUS_RANK = { ueberfaellig: 0, faellig: 1 };

/** Überfällige zuerst, dann bald fällige, dann die am längsten nicht Besuchten. */
export function briefingOrder(customers, now = new Date()) {
    const rank = (c) => STATUS_RANK[visitStatus(c, now)] ?? 2;
    // Besuche liegen als ISO-Datum vor („2026-05-01“); ohne Besuch zählt es als ältester.
    const last = (c) => Date.parse(lastVisit(c) || '') || 0;
    return [...customers].sort((a, b) => rank(a) - rank(b) || last(a) - last(b));
}

/** „Bezirk West" bei genau einem sichtbaren Bezirk, sonst eine ehrliche Sammelbezeichnung. */
export function territoryLabel(customers) {
    const districts = new Set(customers.map((c) => String(c.bezirk ?? '').trim() || UNASSIGNED));
    if (districts.size === 1) {
        const [only] = districts;
        return only === UNASSIGNED ? 'Kunden ohne Bezirk' : `Bezirk ${only.replace(/^Bezirk\s+/i, '')}`;
    }
    return `${districts.size} Bezirke im aktuellen Kartenausschnitt`;
}

/** Dateiname-tauglich: „Bezirk West" → „bezirk-west". */
export function fileSlug(label) {
    return String(label || 'gebiet')
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'gebiet';
}

