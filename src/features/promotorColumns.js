/**
 * Promotoren als nummerierte Spalten einer Kunden- oder Zuständigkeitsliste:
 *
 *   Promotor 1 | Promotor 1 TPE-Thema | Promotor 2 | Promotor 2 TPE-Thema | …
 *
 * (auch `Promotor_1_Name`, `Promotor 1 Bereich`, `Promotor 1 Thema`). Jedes
 * Paar wird ein Promotor des Kunden – mit dem TPE-Thema (Technologie-
 * Portfolio-Element) als Thema – und erscheint wie Promotoren aus einer
 * Kontaktliste unter „📣 Promotoren" und in den Filtern „Promotor" und
 * „Promotor-Thema". Die Spalten gehören der Datei: Ein Reimport mit diesen
 * Spalten ersetzt die Promotoren aus Spalten, nicht die aus Kontaktlisten.
 * Reine Logik, ohne DOM.
 */

export const PROMOTOR_COLUMN_SOURCE = 'promotor-spalten';

const normalize = (header) => String(header ?? '').toLowerCase().trim()
    .replace(/[._\-/]/g, ' ').replace(/\s+/g, ' ');
const NAME = /^promot(?:or|er|orin) ?(\d+)(?: name)?$/;
const TOPIC = /^promot(?:or|er|orin) ?(\d+) (?:tpe thema|tpe|thema|bereich)$/;

export function isPromotorColumn(header) {
    const key = normalize(header);
    return NAME.test(key) || TOPIC.test(key);
}

/** Spaltenpaare je Nummer, aufsteigend; ohne Namensspalte kein Paar. */
export function promotorColumns(headers = []) {
    const byNumber = new Map();
    for (const header of headers) {
        const key = normalize(header);
        const name = key.match(NAME);
        const topic = key.match(TOPIC);
        const n = Number((name || topic)?.[1]);
        if (!n && n !== 0) continue;
        const entry = byNumber.get(n) || { n, name: null, thema: null };
        if (name && !entry.name) entry.name = header;
        if (topic && !entry.thema) entry.thema = header;
        byNumber.set(n, entry);
    }
    return [...byNumber.values()].filter((entry) => entry.name).sort((a, b) => a.n - b.n);
}

/** Kontakt stammt aus den Promotor-Spalten (nicht aus einer Kontaktliste). */
export const isColumnPromotor = (contact) => contact?.quelle === PROMOTOR_COLUMN_SOURCE;
