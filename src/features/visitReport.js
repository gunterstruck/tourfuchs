/**
 * Besuchsbericht: Besuche vom Handy weitergeben – und am Desktop übernehmen.
 *
 * TourFuchs synchronisiert nichts über einen Server. Was unterwegs als
 * „✓ Heute besucht" eingetragen wurde, verlässt das Handy deshalb bewusst als
 * kleine Excel-Datei: nur die besuchten Kunden, eine Zeile je Besuch. Die
 * Datei geht ins CRM, an eine KI („trag das ein", „schreib den Wochenbericht")
 * oder zurück an den Desktop, der die Besuche über die Kundennummer nachträgt
 * und sonst nichts anfasst.
 *
 * Dieses Modul ist rein (kein DOM, kein XLSX): Auswahl, Zeilen, Erkennung,
 * Zusammenführung und das Gedächtnis „schon weitergegeben".
 */
import { todayIso } from './visits.js';

export const VISIT_REPORT_SHEET = 'Besuchsbericht';
export const VISIT_REPORT_DATE_HEADER = 'Besuchsdatum';
export const VISIT_REPORT_NUMBER_HEADER = 'Kundennummer';

/** Zeiträume in der Reihenfolge, in der sie angeboten werden. */
export const VISIT_REPORT_RANGES = Object.freeze([
    Object.freeze({ id: 'unsent', label: 'Seit dem letzten Bericht' }),
    Object.freeze({ id: 'today', label: 'Heute' }),
    Object.freeze({ id: 'week', label: 'Diese Woche' })
]);

const SENT_KEY = 'tf_visit_report_sent';
// Das Gedächtnis „schon weitergegeben" reicht so weit zurück; ältere Besuche
// zählen für „seit dem letzten Bericht" nicht mehr (sonst stünde beim ersten
// Bericht die ganze Historie aus dem Import darin).
const SENT_WINDOW_DAYS = 60;

function isoDaysBefore(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d - days);
    return todayIso(date);
}

/** Montag der Woche, in der `iso` liegt. */
export function weekStartIso(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const weekday = (date.getDay() + 6) % 7; // Mo = 0
    date.setDate(date.getDate() - weekday);
    return todayIso(date);
}

/** Schlüssel eines Besuchs: Kundennummer (sonst interne ID) plus Datum. */
export function visitKey(customer, date) {
    const who = String(customer?.nummer ?? '').trim() || `id:${customer?.id ?? ''}`;
    return `${who}|${date}`;
}

/** Gibt es schon ein Gedächtnis „weitergegeben"? (Sonst Ausgangsbasis anlegen.) */
export function sentVisitsInitialized(storage = globalThis.localStorage) {
    try { return storage?.getItem(SENT_KEY) != null; } catch { return true; }
}

export function loadSentVisits(storage = globalThis.localStorage) {
    try {
        const list = JSON.parse(storage?.getItem(SENT_KEY) || '[]');
        return new Set(Array.isArray(list) ? list : []);
    } catch {
        return new Set();
    }
}

/** Weitergegebene Besuche merken; Einträge außerhalb des Fensters fallen raus. */
export function rememberSentVisits(entries, { today = todayIso(), storage = globalThis.localStorage } = {}) {
    const sent = loadSentVisits(storage);
    for (const entry of entries) sent.add(visitKey(entry.customer, entry.date));
    const from = isoDaysBefore(today, SENT_WINDOW_DAYS);
    const kept = [...sent].filter((key) => key.slice(key.lastIndexOf('|') + 1) >= from);
    try { storage?.setItem(SENT_KEY, JSON.stringify(kept)); } catch { /* Speicher optional */ }
    return new Set(kept);
}

/**
 * Besuche eines Zeitraums, sortiert nach Datum und Name.
 * @returns {Array<{customer: object, date: string}>}
 */
export function visitReportEntries(customers, { range = 'unsent', today = todayIso(), sent = new Set() } = {}) {
    const from = range === 'today'
        ? today
        : range === 'week' ? weekStartIso(today) : isoDaysBefore(today, SENT_WINDOW_DAYS);
    const entries = [];
    for (const customer of customers || []) {
        const dates = [...new Set((customer?.besuche || []).filter(Boolean))];
        for (const date of dates) {
            if (date < from || date > today) continue;
            if (range === 'unsent' && sent.has(visitKey(customer, date))) continue;
            entries.push({ customer, date });
        }
    }
    return entries.sort((a, b) => a.date.localeCompare(b.date)
        || String(a.customer.name ?? '').localeCompare(String(b.customer.name ?? ''), 'de'));
}

/**
 * Eine Zeile je Besuch. Die Spaltennamen sind bewusst die, die der
 * Kundenimport und die meisten CRM-Importe wiedererkennen; die Originalspalten
 * der Kundenliste reisen mit, damit das CRM eigene Schlüssel findet.
 */
export function visitReportRows(entries, { demo = false } = {}) {
    const extraHeaders = [];
    const seen = new Set();
    for (const { customer } of entries) {
        for (const header of Object.keys(customer?.extra || {})) {
            if (!seen.has(header)) { seen.add(header); extraHeaders.push(header); }
        }
    }
    return entries.map(({ customer: c, date }) => {
        const row = {
            ...(demo ? { 'Datenstatus': 'DEMO – nicht produktiv' } : {}),
            [VISIT_REPORT_DATE_HEADER]: date,
            [VISIT_REPORT_NUMBER_HEADER]: c.nummer ?? '',
            'Kundenname': c.name ?? '',
            'Straße': c.strasse ?? '',
            'PLZ': c.plz ?? '',
            'Ort': c.ort ?? '',
            'Vertriebsbezirk': c.bezirk ?? '',
            'Vertriebsbeauftragter': c.vb ?? '',
            'Hauptansprechpartner': c.ansprechpartner ?? ''
        };
        for (const header of extraHeaders) {
            const key = header in row ? `${header} (Original)` : header;
            row[key] = c.extra?.[header] ?? '';
        }
        return row;
    });
}

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase();

/** Ist das ein Besuchsbericht (und keine Kundenliste)? */
export function isVisitReportHeaders(headers) {
    const set = new Set((headers || []).map(normalizeHeader));
    return set.has(normalizeHeader(VISIT_REPORT_DATE_HEADER)) && set.has(normalizeHeader(VISIT_REPORT_NUMBER_HEADER));
}

function realDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? iso : null;
}

/** ISO, dd.mm.yyyy oder Excel-Seriennummer -> yyyy-mm-dd (sonst null). */
export function parseVisitDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return todayIso(value);
    const str = String(value).trim();
    if (/^\d{5}(\.\d+)?$/.test(str)) {
        const date = new Date(Math.round((parseFloat(str) - 25569) * 86400 * 1000));
        return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    }
    let m = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (m) {
        const y = m[3].length === 2 ? `20${m[3]}` : m[3];
        return realDate(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
    }
    m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return realDate(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
    return null;
}

/**
 * Besuche aus einem Bericht nachtragen – nur `besuche` ändert sich.
 * Zeilen ohne passende Kundennummer werden gemeldet, nicht angelegt.
 *
 * @param {Array<object>} customers  wird an Ort und Stelle ergänzt
 * @param {Array<object>} rows       Tabellenzeilen (Kopf -> Wert)
 * @returns {{ added: number, known: number, unknown: string[], invalid: number, touched: object[] }}
 */
export function mergeVisitReport(customers, rows, { today = todayIso() } = {}) {
    const byNumber = new Map();
    for (const customer of customers || []) {
        const nummer = String(customer?.nummer ?? '').trim();
        if (nummer && !byNumber.has(nummer)) byNumber.set(nummer, customer);
    }
    const headerOf = (row, wanted) => Object.keys(row || {}).find((key) => normalizeHeader(key) === normalizeHeader(wanted));
    const result = { added: 0, known: 0, unknown: [], invalid: 0, touched: [] };
    const unknown = new Set();
    const touched = new Set();
    for (const row of rows || []) {
        const nummer = String(row?.[headerOf(row, VISIT_REPORT_NUMBER_HEADER)] ?? '').trim();
        const date = parseVisitDate(row?.[headerOf(row, VISIT_REPORT_DATE_HEADER)]);
        if (!nummer || !date || date > today) { result.invalid += 1; continue; }
        const customer = byNumber.get(nummer);
        if (!customer) { unknown.add(nummer); continue; }
        const visits = Array.isArray(customer.besuche) ? customer.besuche : [];
        if (visits.includes(date)) { result.known += 1; continue; }
        customer.besuche = [...visits, date].sort();
        result.added += 1;
        touched.add(customer);
    }
    result.unknown = [...unknown];
    result.touched = [...touched];
    return result;
}

/** Kurzmeldung nach dem Übernehmen. */
export function mergeSummary({ added, known, unknown, invalid }) {
    const parts = [added === 1 ? '1 Besuch übernommen' : `${added} Besuche übernommen`];
    if (known) parts.push(`${known} ${known === 1 ? 'war' : 'waren'} schon eingetragen`);
    if (unknown.length) parts.push(`${unknown.length} ${unknown.length === 1 ? 'Kunde' : 'Kunden'} nicht gefunden (${unknown.slice(0, 3).join(', ')}${unknown.length > 3 ? ' …' : ''})`);
    if (invalid) parts.push(`${invalid} ${invalid === 1 ? 'Zeile' : 'Zeilen'} ohne gültiges Datum oder Kundennummer`);
    return `${parts.join(' · ')}.`;
}
