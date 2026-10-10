/**
 * Umsätze nach Geschäftsjahr.
 *
 * Viele Umsatzlisten bringen mehrere Jahre nebeneinander mit – „Umsatz 2023",
 * „Umsatz 2024", „Umsatz GJ 2025". TourFuchs nutzt für Karte, Cockpit und
 * Filter weiterhin genau einen Umsatz (den jüngsten Jahrgang, siehe
 * `pickLatestRevenueHeader`). Die übrigen Jahre zeigt die Kundenkachel auf
 * Knopfdruck als „GJ26", „GJ25" …
 *
 * Bewusst allgemein: Ein Geschäftsjahr heißt nach dem Jahr, in dem es
 * überwiegend liegt – so benennen es die Firmen selbst (GJ26 = Okt. 2025 bis
 * Sep. 2026 ebenso wie Jan. bis Dez. 2026). TourFuchs kennt den Startmonat
 * nicht und braucht ihn nicht; es übernimmt das Jahr aus der Überschrift. Ein
 * Doppeljahr („2025/26") zählt zum hinteren Jahr. Plan-, Ziel-, Budget- und
 * Potenzialspalten sind keine Ist-Umsätze und werden nicht erkannt.
 * Reine Logik, ohne DOM.
 */

const norm = (header) => String(header ?? '').toLowerCase().replace(/[._\-/]/g, ' ').replace(/\s+/g, ' ').trim();

const REVENUE_WORD = /\b(umsatz|umsätze|umsaetze|ums|revenue|sales|ist)\b|umsatz/;
const FISCAL_PREFIX = /^(gj|fy|geschäftsjahr|geschaeftsjahr|wj)\s?\d/;
const NOT_ACTUAL = /plan|ziel|budget|forecast|prognose|potenzial|potential|soll|delta|abweichung|veränderung|veraenderung|%/;

/** Wie viele Geschäftsjahre die Kachel zeigt. */
export const REVENUE_YEAR_SLOTS = 4;

/**
 * Geschäftsjahr aus einer Spaltenüberschrift oder null.
 * „Umsatz 2025" → 2025 · „Umsatz GJ 24" → 2024 · „Umsatz 2024/25" → 2025 ·
 * „GJ 2023" → 2023 · „Umsatz" / „Umsatzziel 2026" → null
 */
export function revenueYearOfHeader(header) {
    const h = norm(header);
    if (!h || NOT_ACTUAL.test(h)) return null;
    if (!REVENUE_WORD.test(h) && !FISCAL_PREFIX.test(h)) return null;
    // Doppeljahr: „2024 25" oder „2024 2025" → hinteres Jahr
    const span = h.match(/\b(20\d{2})\s(\d{2}|20\d{2})\b/);
    if (span) return span[2].length === 2 ? 2000 + Number(span[2]) : Number(span[2]);
    const years = h.match(/\b(?:19|20)\d{2}\b/g);
    if (years) return Number(years[years.length - 1]);
    const short = h.match(/\b(?:gj|fy|wj)\s?(\d{2})\b/);
    if (short) return 2000 + Number(short[1]);
    return null;
}

/** Überschriften mit Geschäftsjahr: [{ header, year }], jüngstes Jahr zuerst. */
export function revenueYearHeaders(headers = []) {
    return headers
        .map((header) => ({ header, year: revenueYearOfHeader(header) }))
        .filter((entry) => entry.year !== null)
        .sort((a, b) => b.year - a.year);
}

/**
 * Hat die automatische Zuordnung eine Jahres-Umsatzspalte als „Umsatz"
 * gewählt, soll es die jüngste sein – nicht die erste von links.
 */
export function pickLatestRevenueHeader(currentHeader, headers = []) {
    if (!currentHeader || revenueYearOfHeader(currentHeader) === null) return currentHeader;
    return revenueYearHeaders(headers)[0]?.header ?? currentHeader;
}

/**
 * Die vier Zeilen der Kachel, jüngstes Jahr zuerst. Oben steht das jüngere
 * von aktuellem Kalenderjahr und jüngstem Jahr in den Daten: Hat die Liste
 * schon GJ27 (z. B. bei Start im Oktober), beginnt sie dort; fehlt das
 * laufende Jahr noch, steht es leer oben („noch keine Zahlen").
 * @returns {{ year:number, value:number|null, change:number|null }[]}
 *   change = Veränderung zum Vorjahr in Prozent (nur wenn beide Jahre Werte haben)
 */
export function revenueYearRows(customer, today = new Date()) {
    const years = customer?.umsatzJahre || {};
    const dataYears = Object.keys(years).map(Number).filter(Number.isFinite);
    const top = Math.max(today.getFullYear(), ...dataYears);
    const valueOf = (year) => {
        const value = years[year];
        return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
    };
    const rows = [];
    for (let offset = 0; offset < REVENUE_YEAR_SLOTS; offset++) {
        const year = top - offset;
        const value = valueOf(year);
        const before = valueOf(year - 1);
        const change = value !== null && before !== null && before !== 0
            ? Math.round(((value - before) / Math.abs(before)) * 100)
            : null;
        rows.push({ year, value, change });
    }
    return rows;
}

/** Gibt es überhaupt Jahreswerte, die die Kachel zeigen könnte? */
export function hasRevenueYears(customer, today = new Date()) {
    return revenueYearRows(customer, today).some((row) => row.value !== null);
}

/** 2026 → „GJ26" (Präfix je Sprache: FY26, Ex.26 …). */
export function fiscalYearLabel(year, prefix = 'GJ') {
    return `${prefix}${String(year).slice(-2)}`;
}

/**
 * Zeile fürs KI-Briefing: nur Jahre mit Werten, jüngstes zuerst.
 * @param {(value:number)=>string} format  Betragsformat (z. B. formatRevenueShort)
 */
export function revenueBriefingLine(customer, format, today = new Date()) {
    const rows = revenueYearRows(customer, today).filter((row) => row.value !== null);
    if (!rows.length) return '';
    const parts = rows.map((row) => {
        const change = row.change === null ? '' : ` (${row.change > 0 ? '+' : ''}${row.change} % zum Vorjahr)`;
        return `${fiscalYearLabel(row.year)}: ${format(row.value)}${change}`;
    });
    return `- Umsatz nach Geschäftsjahr: ${parts.join('; ')}`;
}
