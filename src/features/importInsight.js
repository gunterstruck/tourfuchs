/**
 * Der Befund nach dem ersten eigenen Import.
 *
 * Bisher passierte nach dem Import: Die Karte ist voll. Das ist ein Zustand,
 * kein Erlebnis. Es fehlte der Satz, der sagt, was die App im Bestand
 * **gesehen** hat – und genau der ist der Moment, in dem TourFuchs aufhört,
 * eine Landkarte zu sein.
 *
 * Sämtliche Zahlen liegen bereits vor; hier wird nur ausgesprochen, was ohnehin
 * da ist. Reine Logik, ohne DOM.
 *
 * Grundregel: **Nur Auffälliges wird gesagt.** Eine gleichmäßige Verteilung ist
 * keine Nachricht. Wer alles meldet, meldet nichts.
 */

import { visitStatus } from './visits.js';

// Unterhalb dieses Faktors ist eine Ungleichverteilung normal und keine Meldung
// wert. 1,5 ist zugleich der Zielwert des Ausgewogenheits-Assistenten.
const IMBALANCE_THRESHOLD = 1.5;

function text(value) {
    return String(value ?? '').trim();
}

function amount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function districtStats(customers) {
    const byDistrict = new Map();
    for (const customer of customers) {
        const name = text(customer.bezirk);
        if (!name) continue;
        const entry = byDistrict.get(name) || { name, count: 0, umsatz: 0 };
        entry.count++;
        entry.umsatz += amount(customer.umsatz);
        byDistrict.set(name, entry);
    }
    return [...byDistrict.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));
}

/**
 * @returns {{
 *   total: number, located: number, unlocated: number,
 *   districts: object[], withoutDistrict: number,
 *   imbalance: {top: object, bottom: object, factor: number}|null,
 *   overdue: number, dueSoon: number, withRhythm: number,
 *   revenueTotal: number
 * }}
 */
export function datasetInsight(customers = [], now = new Date()) {
    const districts = districtStats(customers);
    const withRhythm = customers.filter((customer) => customer.rhythmusWochen);

    let imbalance = null;
    if (districts.length >= 2) {
        const top = districts[0];
        const bottom = districts[districts.length - 1];
        const factor = bottom.count > 0 ? top.count / bottom.count : Infinity;
        if (factor >= IMBALANCE_THRESHOLD) imbalance = { top, bottom, factor };
    }

    return {
        total: customers.length,
        located: customers.filter((customer) => Number.isFinite(customer.lat) && Number.isFinite(customer.lng)).length,
        unlocated: customers.filter((customer) => !Number.isFinite(customer.lat) || !Number.isFinite(customer.lng)).length,
        districts,
        withoutDistrict: customers.filter((customer) => !text(customer.bezirk)).length,
        imbalance,
        overdue: withRhythm.filter((customer) => visitStatus(customer, now) === 'ueberfaellig').length,
        dueSoon: withRhythm.filter((customer) => visitStatus(customer, now) === 'faellig').length,
        withRhythm: withRhythm.length,
        revenueTotal: customers.reduce((total, customer) => total + amount(customer.umsatz), 0)
    };
}

/**
 * Die Aussagen des Befunds – in der Reihenfolge, in der sie interessieren.
 * Jede Aussage trägt einen `action`-Schlüssel, wenn sich daraus unmittelbar
 * etwas tun lässt.
 *
 * @returns {{key: string, text: string, tone?: string, action?: string}[]}
 */
export function insightStatements(insight) {
    const statements = [];
    const plural = (count, one, many) => `${count.toLocaleString('de-DE')} ${count === 1 ? one : many}`;

    if (insight.unlocated > 0) {
        statements.push({
            key: 'unlocated',
            tone: 'warn',
            text: `${plural(insight.unlocated, 'Kunde konnte', 'Kunden konnten')} nicht verortet werden – meist fehlt oder stimmt die PLZ.`
        });
    }

    if (insight.districts.length >= 2) {
        statements.push({
            key: 'districts',
            text: `Die Liste enthält ${plural(insight.districts.length, 'Vertriebsbezirk', 'Vertriebsbezirke')}.`
        });
    }

    if (insight.imbalance) {
        const { top, bottom, factor } = insight.imbalance;
        statements.push({
            key: 'imbalance',
            tone: 'notable',
            text: Number.isFinite(factor)
                ? `„${top.name}" betreut ${factor.toLocaleString('de-DE', { maximumFractionDigits: 1 })}× so viele Kunden wie „${bottom.name}".`
                : `„${top.name}" betreut ${plural(top.count, 'Kunden', 'Kunden')}, „${bottom.name}" keinen einzigen.`
            // Bewusst ohne `action`: Der Drill-down wäre das Gebiets-Cockpit,
            // und das gibt es nur am Schreibtisch im Profi-Modus. Ein Knopf,
            // der auf dem Handy oder in Basis ins Leere führt, wäre schlimmer
            // als keiner – und ein dritter Knopf im allerersten Befund-Dialog
            // widerspräche dessen Zweck. Die Zeile sagt, was zu sehen ist;
            // gehandelt wird im Gebiets-Tab.
        });
    }

    if (insight.overdue > 0) {
        statements.push({
            key: 'overdue',
            tone: 'notable',
            text: `${plural(insight.overdue, 'Kunde ist', 'Kunden sind')} überfällig.`,
            action: 'overdue'
        });
    } else if (insight.withRhythm === 0) {
        statements.push({
            key: 'no-rhythm',
            tone: 'hint',
            text: 'Ein Besuchsrhythmus ist nicht hinterlegt – mit ihm zeigt TourFuchs, wer überfällig ist.'
        });
    }

    if (insight.withoutDistrict > 0 && insight.districts.length > 0) {
        statements.push({
            key: 'without-district',
            tone: 'hint',
            text: `${plural(insight.withoutDistrict, 'Kunde läuft', 'Kunden laufen')} unter „Ohne Zuordnung".`
        });
    }

    return statements;
}

/** Die eine Zeile, die immer stimmt. */
export function insightHeadline(insight) {
    if (insight.total === 0) return 'Keine Kunden importiert.';
    const kunden = `${insight.total.toLocaleString('de-DE')} ${insight.total === 1 ? 'Kunde' : 'Kunden'}`;
    return `${kunden} auf der Karte.`;
}

/**
 * Lohnt sich der Befund überhaupt? Bei einer Handvoll Kunden ohne Bezirke und
 * ohne Rhythmus weiß der Nutzer alles schon – dann bleibt es beim Toast.
 */
export function isInsightWorthShowing(insight) {
    if (insight.total === 0) return false;
    return insight.total >= 10
        || insight.districts.length >= 2
        || insight.overdue > 0
        || insight.unlocated > 0;
}
