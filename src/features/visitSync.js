/**
 * Abgleich Handy ↔ Desktop (Weg B, PO 20.10.2026): eine kleine Datei, die in
 * beide Richtungen dasselbe tut – Besuche ergänzen, nie überschreiben.
 *
 * TourFuchs synchronisiert nichts über einen Server. Der Nutzer trägt die
 * Datei selbst über die Wege seiner Firma (Mail, Teams, OneDrive). Damit sie
 * unterwegs nichts preisgibt, steht darin kein Kundenname und keine
 * Kundennummer: je Besuch nur eine Prüfsumme des Kundenschlüssels und das
 * Datum. Zuordnen kann sie nur ein TourFuchs mit derselben Kundenliste – er
 * bildet dieselben Prüfsummen über seine eigenen Kunden.
 *
 * Dateiname endet auf `.txt`: Das Teilen-Menü der Handys nimmt nur bekannte
 * Dateitypen an. Erkannt wird die Datei am Inhalt (`__tfsync`).
 *
 * Rein (kein DOM): Datei bauen, erkennen, zusammenführen.
 */
import { todayIso } from './visits.js';
import { customerKey } from './savedTourKeys.js';
import { parseVisitDate } from './visitReport.js';

export const SYNC_MAGIC = '__tfsync';
export const SYNC_VERSION = 1;

/**
 * 53-Bit-Prüfsumme (cyrb53). Kein Geheimnis, nur „nicht lesbar": Wer die
 * Kundenliste nicht hat, sieht Ziffern und Daten. 53 Bit halten Verwechslungen
 * auch bei 15.000 Kunden praktisch aus (≈ 1 : 100 Mio.).
 */
function cyrb53(text) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Prüfsumme eines Kunden – gleich auf jedem Gerät mit derselben Liste. */
export function customerToken(customer) {
    const key = customerKey(customer);
    return key ? cyrb53(`tfsync1|${key}`) : null;
}

export function syncFileName(today = todayIso()) {
    return `TourFuchs-Abgleich-${today}.txt`;
}

/** Abgleich-Inhalt aus Besuchen ({customer, date}); doppelte fallen weg. */
export function buildSyncPayload(entries, { now = new Date() } = {}) {
    const seen = new Set();
    const visits = [];
    for (const { customer, date } of entries || []) {
        const k = customerToken(customer);
        if (!k || !date || seen.has(`${k}|${date}`)) continue;
        seen.add(`${k}|${date}`);
        visits.push({ k, d: date });
    }
    return { [SYNC_MAGIC]: 1, v: SYNC_VERSION, createdAt: now.toISOString(), count: visits.length, visits };
}

/** Ist das eine Abgleich-Datei? Nimmt Objekt oder Dateitext. */
export function parseSyncPayload(input) {
    let data = input;
    if (typeof input === 'string') {
        if (!input.includes(SYNC_MAGIC)) return null;
        try { data = JSON.parse(input); } catch { return null; }
    }
    return data && data[SYNC_MAGIC] === 1 && Array.isArray(data.visits) ? data : null;
}

/**
 * Besuche aus einer Abgleich-Datei ergänzen – nur `besuche` ändert sich.
 * Unbekannte Prüfsummen werden gezählt, nicht angelegt.
 * `entries` sind genau die Besuche aus der Datei (neu oder schon bekannt):
 * Sie gelten danach als abgeglichen und wandern nicht zurück.
 *
 * @returns {{ added: number, known: number, unknown: number, invalid: number, touched: object[], entries: Array<{customer: object, date: string}> }}
 */
export function mergeSyncPayload(customers, payload, { today = todayIso() } = {}) {
    const byToken = new Map();
    for (const customer of customers || []) {
        const token = customer ? customerToken(customer) : null;
        if (token && !byToken.has(token)) byToken.set(token, customer);
    }
    const result = { added: 0, known: 0, unknown: 0, invalid: 0, touched: [], entries: [] };
    const touched = new Set();
    for (const visit of payload?.visits || []) {
        const date = typeof visit?.d === 'string' ? parseVisitDate(visit.d) : null;
        if (!visit?.k || !date || date > today) { result.invalid += 1; continue; }
        const customer = byToken.get(visit.k);
        if (!customer) { result.unknown += 1; continue; }
        const visits = Array.isArray(customer.besuche) ? customer.besuche : [];
        result.entries.push({ customer, date });
        if (visits.includes(date)) { result.known += 1; continue; }
        customer.besuche = [...visits, date].sort();
        result.added += 1;
        touched.add(customer);
    }
    result.touched = [...touched];
    return result;
}

/** Kurzmeldung nach dem Übernehmen. */
export function syncSummary({ added, known, unknown, invalid }) {
    const parts = [added === 1 ? '1 Besuch übernommen' : `${added} Besuche übernommen`];
    if (known) parts.push(`${known} ${known === 1 ? 'war' : 'waren'} schon eingetragen`);
    if (unknown) parts.push(`${unknown} zu ${unknown === 1 ? 'einem Kunden' : 'Kunden'}, die hier nicht in der Liste stehen`);
    if (invalid) parts.push(`${invalid} ohne gültiges Datum`);
    return `${parts.join(' · ')}.`;
}
