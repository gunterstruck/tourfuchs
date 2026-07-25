/**
 * Feierabend-Rückblick.
 *
 * Das Abhaken unterwegs gibt es längst – nur wird es nirgends zurückgespiegelt.
 * Der Nutzer trägt Besuche ein und bekommt dafür: nichts. Das ist die Sorte
 * Pflichteingabe, die nach drei Wochen einschläft.
 *
 * Der Rückblick dreht das um: Am Ende des Tages steht da, was der Tag gebracht
 * hat – Besuche, gefahrene Strecke, abgearbeitete Überfällige und was liegen
 * geblieben ist. Reine Logik, ohne DOM: der Rechenweg gehört getestet, die
 * Darstellung liegt in der UI.
 */

import { lastVisit, visitStatus } from './visits.js';
import { routeDistance } from './tour.js';

function isoToday(now = new Date()) {
    // Lokaler Tag, nicht UTC: Ein Besuch um 22:30 gehört zum heutigen Tag,
    // toISOString() würde ihn in Zeitzonen östlich von UTC auf morgen schieben.
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function visitedOn(customer, day) {
    return Array.isArray(customer?.besuche) && customer.besuche.includes(day);
}

/**
 * War der Kunde vor dem heutigen Besuch überfällig? Dafür wird der heutige
 * Eintrag gedanklich zurückgenommen und der Status auf den Vortag gerechnet –
 * sonst wäre nach dem Abhaken jeder Kunde „im Rhythmus" und die Antwort immer 0.
 */
export function wasOverdueBeforeVisit(customer, day, now = new Date()) {
    if (!customer?.rhythmusWochen) return false;
    const before = (customer.besuche || []).filter((date) => date < day);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return visitStatus({ ...customer, besuche: before }, yesterday) === 'ueberfaellig';
}

function summarize(customer, day) {
    const previous = (customer.besuche || []).filter((date) => date < day).at(-1) || null;
    return {
        id: customer.id,
        name: String(customer.name ?? '').trim(),
        ort: String(customer.ort ?? '').trim(),
        plz: String(customer.plz ?? '').trim(),
        bezirk: String(customer.bezirk ?? '').trim(),
        umsatz: Number.isFinite(Number(customer.umsatz)) ? Number(customer.umsatz) : 0,
        previousVisit: previous
    };
}

/**
 * Der Tag in Zahlen.
 *
 * Besuche zählen unabhängig von der geplanten Tour – wer spontan zwei Kunden
 * mitnimmt, soll sie im Rückblick wiederfinden. Die Strecke dagegen kann nur
 * die geplante Tour liefern; sie wird deshalb ehrlich als Schätzung geführt.
 *
 * @returns {{
 *   day: string, visited: object[], visitedCount: number,
 *   overdueCleared: number, spontaneous: object[],
 *   openStops: object[], plannedCount: number,
 *   roadKmEstimate: number, revenueVisited: number, hasAnything: boolean
 * }}
 */
export function dayReview({ customers = [], tour = null, now = new Date() } = {}) {
    const day = isoToday(now);
    const visitedCustomers = customers.filter((customer) => visitedOn(customer, day));
    const plannedIds = new Set(Array.isArray(tour?.stops) ? tour.stops : []);

    const visited = visitedCustomers.map((customer) => ({
        ...summarize(customer, day),
        planned: plannedIds.has(customer.id),
        wasOverdue: wasOverdueBeforeVisit(customer, day, now)
    }));

    const openStops = customers
        .filter((customer) => plannedIds.has(customer.id) && !visitedOn(customer, day))
        .map((customer) => ({ ...summarize(customer, day), lastVisit: lastVisit(customer) }));

    // Strecke: nur die geplante Tour ist bekannt. Ohne Start kein Weg.
    const stopPoints = (Array.isArray(tour?.stops) ? tour.stops : [])
        .map((id) => customers.find((customer) => customer.id === id))
        .filter((customer) => customer && Number.isFinite(customer.lat) && Number.isFinite(customer.lng))
        .map((customer) => ({ lat: customer.lat, lng: customer.lng }));
    const start = tour?.start && Number.isFinite(tour.start.lat) ? tour.start : null;
    const roadKmEstimate = start && stopPoints.length
        ? routeDistance(start, stopPoints, Boolean(tour?.roundTrip)).roadKmEstimate
        : 0;

    return {
        day,
        visited,
        visitedCount: visited.length,
        overdueCleared: visited.filter((entry) => entry.wasOverdue).length,
        spontaneous: visited.filter((entry) => !entry.planned),
        openStops,
        plannedCount: plannedIds.size,
        roadKmEstimate,
        revenueVisited: visited.reduce((total, entry) => total + entry.umsatz, 0),
        hasAnything: visited.length > 0 || openStops.length > 0
    };
}

/** Eine Zeile fürs Gefühl: „4 Besuche · 2 Überfällige abgearbeitet". */
export function dayReviewHeadline(review) {
    if (!review.visitedCount) return 'Heute noch kein Besuch eingetragen.';
    const parts = [`${review.visitedCount} ${review.visitedCount === 1 ? 'Besuch' : 'Besuche'}`];
    if (review.roadKmEstimate >= 1) parts.push(`${Math.round(review.roadKmEstimate)} km`);
    if (review.overdueCleared) {
        parts.push(`${review.overdueCleared} ${review.overdueCleared === 1 ? 'Überfälliger' : 'Überfällige'} abgearbeitet`);
    }
    return parts.join(' · ');
}

/** Nachweis zum Weitergeben – bewusst schlichter Text, kein Layout. */
export function dayReviewText(review, { formatDate = (iso) => iso } = {}) {
    const lines = [`TourFuchs – Tagesabschluss ${formatDate(review.day)}`, ''];
    lines.push(dayReviewHeadline(review), '');

    if (review.visited.length) {
        lines.push('Besucht:');
        for (const entry of review.visited) {
            const place = [entry.plz, entry.ort].filter(Boolean).join(' ');
            const marks = [
                place,
                entry.wasOverdue ? 'war überfällig' : '',
                entry.planned ? '' : 'spontan'
            ].filter(Boolean).join(' · ');
            lines.push(`- ${entry.name}${marks ? ` (${marks})` : ''}`);
        }
        lines.push('');
    }

    if (review.openStops.length) {
        lines.push('Offen geblieben:');
        for (const entry of review.openStops) {
            const place = [entry.plz, entry.ort].filter(Boolean).join(' ');
            lines.push(`- ${entry.name}${place ? ` (${place})` : ''}`);
        }
        lines.push('');
    }

    if (review.roadKmEstimate >= 1) {
        lines.push(`Geplante Strecke: rund ${Math.round(review.roadKmEstimate)} km (Schätzung).`);
    }
    return lines.join('\n').trim();
}
