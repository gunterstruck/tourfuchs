/**
 * Excel-Service
 * Einlesen von Excel-/CSV-Kundenlisten (SheetJS), automatische
 * Spaltenerkennung, Excel-Vorlage und Demo-Daten.
 */

import * as XLSX from 'xlsx';
import { pickLatestRevenueHeader, revenueYearHeaders } from '../features/revenueYears.js';
import { loadDemoStreets, loadPlzCentroids, loadPlzPlaces } from './geocode.js';
import {
    DEMO_DATA_LABEL,
    applyDemoStreets,
    demoCustomerIdentity,
    hasDemoCustomers,
    isDemoCustomer
} from '../core/demoSafety.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ruhige, aber glaubwürdige Besuchslage für die Demo: exakt jeder zwanzigste
 * Kunde ist fällig oder überfällig. Die übrigen 95 % liegen im Rhythmus.
 */
export function demoVisitSchedule(index, rhythmusWochen, now = new Date()) {
    const rhythmDays = Math.max(1, Number(rhythmusWochen) || 6) * 7;
    const overdue = index > 0 && index % 40 === 0;
    const due = index % 40 === 20;
    const daysAgo = overdue ? rhythmDays + 5 : due ? rhythmDays - 3 : Math.min(14, rhythmDays - 10);
    const date = new Date(now.getTime() - Math.max(1, daysAgo) * DAY_MS);
    return {
        status: overdue ? 'ueberfaellig' : due ? 'faellig' : 'ok',
        besuche: [date.toISOString().slice(0, 10)]
    };
}

/** Interne Felder mit deutschen Labels und Erkennungs-Synonymen */
export const FIELDS = [
    { key: 'nummer',  label: 'Kundennummer',           required: false, synonyms: ['kundennummer', 'kundennr', 'kunden-nr', 'nummer', 'nr', 'debitor', 'debitorennummer', 'kdnr', 'kd-nr', 'id'] },
    { key: 'name',    label: 'Kundenname',             required: true,  synonyms: ['kundenname', 'kunde', 'name', 'firma', 'firmenname', 'unternehmen', 'account', 'kunden'] },
    { key: 'strasse', label: 'Straße & Hausnummer',    required: false, synonyms: ['straße', 'strasse', 'str', 'straße und hausnummer', 'adresse', 'anschrift', 'street'] },
    { key: 'plz',     label: 'PLZ',                    required: true,  synonyms: ['plz', 'postleitzahl', 'zip', 'zipcode', 'postcode'] },
    { key: 'ort',     label: 'Ort',                    required: false, synonyms: ['ort', 'stadt', 'city', 'gemeinde', 'wohnort'] },
    { key: 'vb',      label: 'Vertriebsbeauftragter',  required: false, synonyms: ['vertriebsbeauftragter', 'vertriebsbeauftragte', 'vb', 'vb name', 'vb-name', 'betreuer', 'außendienst', 'aussendienst', 'ad', 'vertriebler', 'verkäufer', 'verkaeufer', 'sales rep', 'mitarbeiter', 'ansprechpartner vertrieb', 'gebietsleiter', 'kam'] },
    { key: 'channel', label: 'Vertriebschannel',       required: false, synonyms: ['vertriebschannel', 'vertriebskanal', 'channel', 'kanal', 'absatzkanal', 'vertriebsweg', 'saleschannel', 'sales channel', 'vertriebslinie'] },
    { key: 'gruppe',  label: 'Vertriebsgruppe',        required: false, synonyms: ['vertriebsgruppe', 'gruppe', 'vg neu', 'vg', 'kundengruppe', 'kundenkreis', 'segment', 'kategorie', 'sparte', 'branche', 'klasse', 'team'] },
    { key: 'bezirk',  label: 'Vertriebsbezirk',        required: false, synonyms: ['vertriebsbezirk', 'betriebsbezirk', 'bezirk', 'vbez neu', 'vbez', 'verkaufsbezirk', 'gebietsbezirk', 'außendienstbezirk', 'aussendienstbezirk', 'district'] },
    { key: 'kundentyp', label: 'Kundentyp', required: false, synonyms: ['kundentyp', 'kunden typ', 'kundenart', 'kundentyp bezeichnung', 'customer type', 'account type'] },
    { key: 'gebiet',  label: 'Gebiet (nur Flächenzeile: LK oder PLZ)', required: false, synonyms: ['gebiet', 'landkreis', 'lk', 'kreis', 'plz-gebiet', 'plz gebiet', 'fläche', 'flaeche', 'gebietszuweisung', 'nur gebiet'] },
    { key: 'ansprechpartner', label: 'Hauptansprechpartner', required: false, synonyms: ['hauptansprechpartner', 'haupt ansprechpartner', 'ansprechpartner', 'kontaktperson', 'kontakt', 'hauptkontakt', 'primary contact', 'main contact', 'contact', 'ap', 'ansprechpartner in'] },
    { key: 'telefon', label: 'Telefon',                required: false, synonyms: ['telefon', 'tel', 'telefonnummer', 'phone', 'mobil', 'handy', 'rufnummer', 'festnetz'] },
    { key: 'email',   label: 'E-Mail',                 required: false, synonyms: ['email', 'e-mail', 'mail', 'e mail', 'emailadresse', 'e-mail-adresse'] },
    { key: 'umsatz',  label: 'Umsatz (optional)',      required: false, synonyms: ['umsatz', 'jahresumsatz', 'umsatz €', 'revenue', 'potenzial', 'potential'] },
    { key: 'kontaktPrimaer', label: 'Primärkontakt?',  required: false, synonyms: ['primärkontakt', 'primaerkontakt', 'hauptkontakt ja nein', 'hauptkontakt?', 'primary', 'primary contact flag', 'main contact flag', 'ist hauptkontakt', 'standardkontakt'] },
    { key: 'rhythmusWochen', label: 'Besuchsrhythmus (Wochen)', required: false, synonyms: ['besuchsrhythmus', 'rhythmus', 'rhythmus wochen', 'besuchsintervall', 'intervall', 'turnus', 'besuchsturnus', 'frequenz', 'zyklus wochen'] },
    { key: 'letzterBesuch', label: 'Letzter Besuch (Datum)', required: false, synonyms: ['letzter besuch', 'letzterbesuch', 'besuchsdatum', 'last visit', 'zuletzt besucht', 'letzter kontakt', 'letzter termin'] },
    { key: 'lat',     label: 'Breitengrad (optional)', required: false, synonyms: ['lat', 'latitude', 'breitengrad', 'breite'] },
    { key: 'lng',     label: 'Längengrad (optional)',  required: false, synonyms: ['lng', 'lon', 'longitude', 'längengrad', 'laengengrad', 'länge'] },
    // Die beiden folgenden schreibt der eigene Excel-Export – damit er sich
    // verlustfrei wieder einlesen lässt (ganze Besuchshistorie, Herkunft der
    // Koordinaten). Keine bloßen Teilwörter wie „besuche": „Anzahl Besuche"
    // darf nicht als Historie erkannt werden.
    { key: 'alleBesuche', label: 'Alle Besuche (Historie)', required: false, synonyms: ['alle besuche', 'besuchshistorie', 'besuchsverlauf', 'visit history'] },
    { key: 'weitereKontakte', label: 'Weitere Ansprechpartner', required: false, synonyms: ['weitere ansprechpartner', 'weitere kontakte', 'zusätzliche ansprechpartner', 'zusaetzliche ansprechpartner'] },
    { key: 'verortung', label: 'Verortung (Genauigkeit)', required: false, synonyms: ['verortung', 'verortungsgenauigkeit', 'geo genauigkeit', 'geo-genauigkeit'] },
    // Kontaktlisten (eine Zeile je Kontakt, verknüpft über die Kundennummer):
    // Kundenansprechpartner mit Abteilung, Promotoren mit ihrem Thema.
    { key: 'kontaktArt', label: 'Kontaktart (Promotor/Kunde)', required: false, synonyms: ['kontaktart', 'kontakt art', 'kontakttyp', 'kontakt typ', 'art des kontakts'] },
    { key: 'abteilung', label: 'Abteilung', required: false, synonyms: ['abteilung', 'abteilungsbezeichnung', 'department'] },
    { key: 'thema', label: 'Thema (Promotor)', required: false, synonyms: ['thema', 'themengebiet', 'promotion thema', 'promotet', 'promotes'] },
    // Rückweg der Exportspalte „Promotoren" (wie „Weitere Ansprechpartner").
    { key: 'promotoren', label: 'Promotoren', required: false, synonyms: ['promotoren'] }
];

function normalizeHeader(h) {
    return String(h ?? '').toLowerCase().trim()
        .replace(/[._\-/]/g, ' ')
        .replace(/\s+/g, ' ');
}

/**
 * Datei einlesen -> { headers, rows } (rows als Objekte je Header)
 */
/**
 * Trennzeichen zählen – aber nur außerhalb von Anführungszeichen.
 *
 * Gezählt wurde bisher über den ganzen Kopf. Ein gültiger Semikolon-CSV mit
 * einem Feldnamen wie `"Gebiet, Kreis, Region"` bringt darin mehr Kommas als
 * Semikolons mit; das Komma gewann, und die Datei wurde vollständig falsch
 * eingelesen. Ein Zeichen innerhalb eines zitierten Feldes ist Text, kein
 * Trennzeichen.
 */
function countOutsideQuotes(line, delimiter) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            // Verdoppeltes "" innerhalb eines Feldes ist ein Anführungszeichen.
            if (quoted && line[i + 1] === '"') { i++; continue; }
            quoted = !quoted;
            continue;
        }
        if (!quoted && char === delimiter) count++;
    }
    return count;
}

/** Wie viele Zeilen am Anfang eines Blattes als Überschriftenzeile in Frage kommen. */
const HEADER_SCAN_ROWS = 30;

const cellText = (value) => String(value ?? '').trim();

/** Bekannte Feldbezeichnungen aus FIELDS – der stärkste Hinweis auf eine Kopfzeile. */
let knownLabels = null;
function isKnownFieldLabel(label) {
    if (!knownLabels) {
        knownLabels = new Set(FIELDS.flatMap((field) => field.synonyms.map(normalizeHeader)));
    }
    const norm = normalizeHeader(label);
    if (!norm) return false;
    if (knownLabels.has(norm)) return true;
    // „Kundenname (Endkunde)" oder „PLZ Rechnung" sollen ebenfalls zählen.
    return [...knownLabels].some((s) => s.length > 3 && norm.startsWith(s));
}

/** Zahl, Betrag oder Datum – in einer Überschriftenzeile praktisch nie zu finden. */
function looksNumeric(text) {
    return /\d/.test(text) && /^[-+]?[\d.,:\s/€%]+$/.test(text);
}

/** Letzte gefüllte Spalte (+1) – die tatsächliche Breite einer Zeile. */
function rowWidth(cells) {
    let width = 0;
    for (let i = 0; i < cells.length; i++) if (cellText(cells[i])) width = i + 1;
    return width;
}

/**
 * Wie sehr sieht Zeile `index` nach einer Überschriftenzeile aus?
 *
 * Excel-Exporte aus Vertriebssystemen tragen über der eigentlichen Tabelle oft
 * Titel-, Filter- oder Stand-Zeilen. SheetJS nimmt stur die erste Zeile des
 * benutzten Bereichs als Kopf – dadurch wurden Datenwerte („Endkunde",
 * ein Mitarbeitername) zu Spaltennamen, die Zuordnung lief ins Leere und die
 * erste echte Datenzeile verschwand als vermeintlicher Kopf.
 *
 * Bewertet werden fünf Signale, das stärkste ist die Wiederholung: Steht ein
 * Wert genauso auch in den Zeilen darunter, ist es eine Datenzeile.
 * @returns {number|null} Punktzahl, oder null wenn die Zeile ausscheidet
 */
function headerScore(grid, index) {
    const cells = grid[index] ?? [];
    const labels = cells.map(cellText);
    const filled = labels.filter(Boolean);
    if (filled.length < 2) return null;

    const below = [];
    for (let i = index + 1; i < grid.length && below.length < 12; i++) {
        if (rowWidth(grid[i]) > 0) below.push(grid[i]);
    }
    if (below.length === 0) return null; // Ohne Datenzeilen darunter keine Kopfzeile

    const width = Math.max(rowWidth(cells), ...below.map(rowWidth), 1);
    const unique = new Set(filled.map((l) => l.toLowerCase())).size;
    const known = filled.filter(isKnownFieldLabel).length;
    const numeric = filled.filter(looksNumeric).length;
    const long = filled.filter((l) => l.length > 60).length;
    const repeated = labels.filter((label, col) => (
        label && below.some((row) => cellText(row[col]).toLowerCase() === label.toLowerCase())
    )).length;

    return (known / filled.length) * 5
        + (unique / filled.length) * 2
        + (filled.length / width) * 2
        - (numeric / filled.length) * 2
        - (repeated / filled.length) * 4
        - (long / filled.length) * 2;
}

/** Beste Kopfzeile im vorderen Bereich; -1 wenn keine Zeile in Frage kommt. */
function detectHeaderRow(grid) {
    let best = -1;
    let bestScore = -Infinity;
    const limit = Math.min(grid.length, HEADER_SCAN_ROWS);
    for (let i = 0; i < limit; i++) {
        const score = headerScore(grid, i);
        // Bei Gleichstand gewinnt die obere Zeile: Sie ist die Überschrift,
        // die darunter liegende wäre schon die erste Datenzeile.
        if (score !== null && score > bestScore) { bestScore = score; best = i; }
    }
    return best;
}

/** Eindeutige, nie leere Spaltennamen – sonst verliert ein Zeilenobjekt Spalten. */
function uniqueHeaders(cells, width) {
    const headers = [];
    const seen = new Set();
    for (let i = 0; i < width; i++) {
        const base = cellText(cells[i]) || `Spalte ${i + 1}`;
        let name = base;
        let suffix = 2;
        while (seen.has(name)) name = `${base} (${suffix++})`;
        seen.add(name);
        headers.push(name);
    }
    return headers;
}

/**
 * Der tatsächlich benutzte Bereich – nicht die Selbstauskunft der Datei.
 *
 * SheetJS übernimmt `!ref` ungeprüft aus dem `<dimension>`-Eintrag der Datei
 * (parse_ws_xml_dim). Mehrere Exportwerkzeuge schreiben dort den Bereich AB
 * der ersten Datenzeile, also z. B. `A2:AE172` statt `A1:AE172`. Die Zellen der
 * Kopfzeile liegen dann zwar geparst im Blatt, `sheet_to_json` liefert sie aber
 * nie aus: Die Tabelle beginnt eine Zeile zu tief, die Spaltennamen fehlen
 * vollständig, und die erste Datenzeile muss den Kopf spielen.
 *
 * Deshalb wird der Bereich aus den vorhandenen Zellen bestimmt, sobald die
 * Angabe der Datei verdächtig ist (Beginn nicht bei A1 oder nur eine Zeile).
 */
function usedRange(sheet) {
    const declared = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
    if (declared && declared.s.r === 0 && declared.s.c === 0 && declared.e.r > declared.s.r) return sheet['!ref'];

    let found = null;
    const include = (r, c) => {
        if (!(r >= 0) || !(c >= 0)) return;
        if (!found) found = { s: { r, c }, e: { r, c } };
        else {
            if (r < found.s.r) found.s.r = r;
            if (c < found.s.c) found.s.c = c;
            if (r > found.e.r) found.e.r = r;
            if (c > found.e.c) found.e.c = c;
        }
    };
    if (Array.isArray(sheet['!data'])) {
        // Speichersparende Form (dense): Zellen liegen zeilenweise in `!data`.
        sheet['!data'].forEach((row, r) => row?.forEach((cell, c) => { if (cell) include(r, c); }));
    } else {
        for (const key of Object.keys(sheet)) {
            if (key.startsWith('!')) continue;
            const { r, c } = XLSX.utils.decode_cell(key);
            include(r, c);
        }
    }
    if (!found) return sheet['!ref'] ?? null;
    // Die Angabe der Datei darf den Bereich erweitern, aber nicht beschneiden.
    if (declared) {
        found.s.r = Math.min(found.s.r, declared.s.r);
        found.s.c = Math.min(found.s.c, declared.s.c);
        found.e.r = Math.max(found.e.r, declared.e.r);
        found.e.c = Math.max(found.e.c, declared.e.c);
    }
    return XLSX.utils.encode_range(found);
}

/**
 * Blatt in `{ headers, rows }` überführen – mit erkannter oder vorgegebener
 * Überschriftenzeile.
 * @param {object} sheet SheetJS-Blatt
 * @param {number|null} headerRow 1-basierte Zeilennummer, oder null für Automatik
 */
function tableFromSheet(sheet, headerRow = null) {
    const range = usedRange(sheet);
    const grid = XLSX.utils.sheet_to_json(sheet, {
        header: 1, defval: '', raw: false, blankrows: true, ...(range ? { range } : {})
    });
    const detected = detectHeaderRow(grid);
    const firstFilled = grid.findIndex((row) => rowWidth(row) > 0);
    const index = headerRow
        ? Math.max(0, Math.min(headerRow - 1, grid.length - 1))
        : (detected >= 0 ? detected : firstFilled);

    // Auswahlliste für die Korrektur von Hand: die vorderen gefüllten Zeilen mit Vorschau.
    const options = [];
    for (let i = 0; i < Math.min(grid.length, HEADER_SCAN_ROWS) && options.length < 15; i++) {
        const preview = (grid[i] ?? []).map(cellText).filter(Boolean).slice(0, 4).join(' · ');
        if (preview) options.push({ row: i + 1, preview: preview.slice(0, 80) });
    }

    if (index < 0) return { headers: [], rows: [], headerRow: 0, headerOptions: options, autoHeaderRow: 0 };
    // Die geltende Zeile steht immer zur Auswahl – auch wenn sie weit unten liegt.
    if (!options.some((option) => option.row === index + 1)) {
        options.push({ row: index + 1, preview: (grid[index] ?? []).map(cellText).filter(Boolean).slice(0, 4).join(' · ').slice(0, 80) });
        options.sort((a, b) => a.row - b.row);
    }

    const dataRows = grid.slice(index + 1).filter((row) => rowWidth(row) > 0);
    const width = Math.max(rowWidth(grid[index] ?? []), ...dataRows.map(rowWidth), 0);
    const headers = uniqueHeaders(grid[index] ?? [], width);
    const rows = dataRows.map((cells) => Object.fromEntries(
        headers.map((header, i) => [header, cells[i] ?? ''])
    ));

    return {
        headers,
        rows,
        headerRow: index + 1,
        autoHeaderRow: (detected >= 0 ? detected : firstFilled) + 1,
        // Kein einziger bekannter Feldname in der Kopfzeile: Die Erkennung kann
        // richtig liegen, verdient aber einen ausdrücklichen Blick.
        headerConfident: (grid[index] ?? []).map(cellText).some(isKnownFieldLabel),
        headerOptions: options
    };
}

/** Blätter mit Sichtbarkeit – ausgeblendete Hilfsblätter sind nie die Kundenliste. */
function sheetInfos(workbook) {
    const meta = workbook.Workbook?.Sheets ?? [];
    return workbook.SheetNames.map((name, i) => ({ name, hidden: Number(meta[i]?.Hidden ?? 0) > 0 }));
}

/**
 * Datei einlesen.
 * @param {File} file
 * @param {{ sheet?: string, headerRow?: number, onPhase?: (phase: string) => void }} options  Blatt und
 *        Überschriftenzeile lassen sich von Hand vorgeben (Import-Dialog).
 */
export async function readWorkbook(file, { sheet = null, headerRow = null, onPhase = () => {} } = {}) {
    const buffer = await file.arrayBuffer();
    onPhase('preparing');
    const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
    let workbook;
    if (isCsv) {
        let text;
        try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
            text = new TextDecoder('windows-1252').decode(buffer);
        }
        text = text.replace(/^\uFEFF/, '');
        const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
        const delimiters = [';', ',', '\t'];
        const separator = delimiters.reduce((best, candidate) => (
            countOutsideQuotes(firstLine, candidate) > countOutsideQuotes(firstLine, best) ? candidate : best
        ), ';');
        // CSV-Werte als Text bewahren: SheetJS würde ISO-Daten sonst anhand der
        // System-Locale z. B. zu "7/16/26" umformatieren und IDs als Zahlen
        // interpretieren. Die Fachparser übernehmen Typisierung und Validierung.
        workbook = XLSX.read(text, { type: 'string', FS: separator, raw: true });
    } else {
        // Zuerst nur Blattnamen und Sichtbarkeit (je Blatt eine Zeile). Das ganze
        // Arbeitsbuch auf einmal zu lesen – jedes Blatt vollständig – kostete bei
        // großen Konzernlisten („Alle Bereiche Gesamt") so viel Speicher, dass der
        // Browser am Handy die Seite verwarf und neu lud. Gemessen mit 41 MB,
        // drei Blättern, 80 000 Zeilen: 1 093 MB → 632 MB, 30 s → 9 s.
        workbook = XLSX.read(buffer, { type: 'array', codepage: 65001, sheetRows: 1 });
    }
    // Ein Blatt vollständig laden – bei Excel erst, wenn es gebraucht wird, und
    // in der speichersparenden Form ohne Formatierung und Formeln.
    const loadSheet = (name) => (isCsv
        ? workbook.Sheets[name]
        : XLSX.read(buffer, {
            type: 'array', codepage: 65001, sheets: [name],
            dense: true, cellStyles: false, cellHTML: false, cellFormula: false
        }).Sheets[name]);
    onPhase('columns');
    const infos = sheetInfos(workbook);
    if (infos.length === 0) throw new Error(isCsv ? 'Die CSV-Datei enthält keine Tabelle.' : 'Die Datei enthält kein Tabellenblatt.');

    // Reihenfolge der Auswahl: ausdrücklich gewähltes Blatt, sonst das erste
    // SICHTBARE. Ein ausgeblendetes Hilfsblatt steht in Exporten oft an
    // Position 1 – es zu lesen liefert eine völlig fremde Tabelle.
    const selectable = infos.filter((s) => !s.hidden);
    const pool = selectable.length ? selectable : infos;
    const named = sheet ? pool.filter((s) => s.name === sheet) : [];
    const candidates = named.length ? named : pool;

    let table = null;
    let chosen = null;
    // Eine von Hand gesetzte Überschriftenzeile gilt für das erste Blatt der
    // Auswahl; erst wenn dieses leer bleibt, wird auf dem nächsten wieder erkannt.
    for (const [i, info] of candidates.entries()) {
        const result = tableFromSheet(loadSheet(info.name), i === 0 ? headerRow : null);
        if (result.rows.length > 0) { table = result; chosen = info; break; }
    }
    if (!table) throw new Error(isCsv ? 'Die CSV-Datei enthält keine Datenzeilen.' : 'Das Tabellenblatt enthält keine Datenzeilen.');

    return {
        headers: table.headers,
        rows: table.rows,
        sheetName: chosen.name,
        sheetNames: pool.map((s) => s.name),
        hiddenSheetNames: infos.filter((s) => s.hidden).map((s) => s.name),
        headerRow: table.headerRow,
        autoHeaderRow: table.autoHeaderRow,
        headerConfident: table.headerConfident,
        headerOptions: table.headerOptions
    };
}

/**
 * Automatische Zuordnung: Header -> internes Feld.
 * Liefert { fieldKey: headerName | null }
 */
export function autoDetectMapping(headers) {
    const mapping = {};
    const used = new Set();
    const matchers = [
        { exact: true, fn: (h, s) => h === s },
        { exact: false, fn: (h, s) => h.startsWith(s) },
        { exact: false, fn: (h, s) => h.includes(s) }
    ];

    for (const field of FIELDS) {
        mapping[field.key] = null;
        // exakte Treffer zuerst, dann "beginnt mit"/"enthält"
        for (const matcher of matchers) {
            if (mapping[field.key]) break;
            for (const header of headers) {
                if (used.has(header)) continue;
                const norm = normalizeHeader(header);
                // Ein expliziter Kundentyp darf nicht über „kunde…“ als Name
                // verbraucht werden; dasselbe gilt für andere exakte Feldnamen.
                if (!matcher.exact && FIELDS.some((other) => other.key !== field.key
                    && other.synonyms.some((synonym) => normalizeHeader(synonym) === norm))) continue;
                // Synonyme genauso normalisieren wie die Überschrift: „Kd-Nr." wird zu
                // „kd nr" – das Synonym „kd-nr" muss dann ebenfalls „kd nr" heißen.
                if (field.synonyms.some((s) => (matcher.exact || s.length > 2) && matcher.fn(norm, normalizeHeader(s)))) {
                    mapping[field.key] = header;
                    used.add(header);
                    break;
                }
            }
        }
    }
    // Mehrere Umsatzjahre („Umsatz 2023 … 2025"): der jüngste ist „der" Umsatz.
    mapping.umsatz = pickLatestRevenueHeader(mapping.umsatz, headers);
    applyContactListMapping(mapping, headers);
    return mapping;
}

const PROMOTOR_NAME_HEADER = /^promot(or|er|orin)( name)?$/;

/**
 * Kontaktliste statt Kundenstamm (keine PLZ, aber Abteilung/Thema/Kontaktart
 * oder eine Spalte „Promotor"): Dort ist „Name" die Person, nicht der Kunde.
 */
function applyContactListMapping(mapping, headers) {
    // Anschrift oder Koordinaten = Kundenliste, auch mit Spalte „Abteilung".
    if (mapping.plz || mapping.strasse || (mapping.lat && mapping.lng)) return;
    if (!mapping.ansprechpartner) {
        const promotorHeader = headers.find((header) => PROMOTOR_NAME_HEADER.test(normalizeHeader(header)));
        if (promotorHeader) {
            mapping.ansprechpartner = promotorHeader;
            if (mapping.name === promotorHeader) mapping.name = null;
        }
    }
    const contactList = mapping.kontaktArt || mapping.abteilung || mapping.thema
        || (mapping.ansprechpartner && PROMOTOR_NAME_HEADER.test(normalizeHeader(mapping.ansprechpartner)));
    if (!contactList) return;
    if (!mapping.ansprechpartner) {
        const person = headers.find((header) => ['name', 'person', 'kontakt name', 'vor und nachname'].includes(normalizeHeader(header)));
        mapping.ansprechpartner = person || mapping.name;
    }
    // Ein Kundenname macht die Zeile sonst zur (nicht verortbaren) Kundenzeile.
    if (mapping.name === mapping.ansprechpartner || mapping.nummer) mapping.name = null;
}

function cleanPlz(value) {
    const digits = String(value ?? '').trim().match(/\d+/)?.[0] ?? '';
    if (!digits) return '';
    // Excel schneidet führende Nullen ab: 1067 -> 01067
    return digits.padStart(5, '0').slice(0, 5);
}

/**
 * Betrags-/Zahlenspalte robust einlesen. Excel liefert numerische Zellen bereits
 * als Zahl – die darf nicht wie ein deutsch formatierter String behandelt werden
 * (sonst wird z. B. 1234.56 zu 123456). Strings können deutsch (1.234,56),
 * englisch (1,234.56) oder ohne Gruppierung (45000 / 45.5) formatiert sein.
 */
export function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    let str = String(value).replace(/[^\d.,\-]/g, '');
    if (!str) return null;

    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
        // Beide Trennzeichen: das hintere ist das Dezimaltrennzeichen
        str = lastComma > lastDot
            ? str.replace(/\./g, '').replace(',', '.')
            : str.replace(/,/g, '');
    } else if (lastComma !== -1) {
        const parts = str.split(',');
        // Mehrere Kommas in 3er-Gruppen = englische Tausendertrennung, sonst Dezimalkomma
        str = parts.length > 2 && parts.slice(1).every((p) => p.length === 3)
            ? parts.join('')
            : str.replace(/,/g, '.');
    } else if (lastDot !== -1) {
        const parts = str.split('.');
        // Punkte in 3er-Gruppen = deutsche Tausendertrennung (1.234 / 1.234.567),
        // alles andere (45.5, 12.34) ist ein Dezimalpunkt
        if (parts.slice(1).every((p) => p.length === 3)) str = parts.join('');
    }

    const n = parseFloat(str);
    return Number.isFinite(n) ? n : null;
}

/**
 * Aus der Umsatz-Spaltenüberschrift ableiten, ob die Werte in Tausend Euro
 * (T€, TEUR, Tsd €, k€) oder Millionen (Mio €) angegeben sind. In deutschen
 * kaufmännischen Listen steht der Umsatz häufig verkürzt, z. B. „Umsatz T€"
 * mit Wert 45 statt 45000. Rückgabe ist der Multiplikator (1, 1000, 1_000_000).
 */
export function detectRevenueScale(header) {
    const h = normalizeHeader(header).replace(/\s+/g, ' ');
    if (/\bmio\b|million/.test(h)) return 1_000_000;
    // t€/teur/tsd/tausend/k€/keur als eigenständiges Token, um Fehltreffer zu vermeiden.
    // t€/k€ nur nach Zeilenanfang, Leerzeichen oder Ziffer akzeptieren, damit
    // Überschriften wie „Umsatz gesamt€" oder „Rabatt€" nicht fälschlich ×1000 skalieren.
    if (/(?:^|[\s\d])[tk]€|\bteur\b|\bkeur\b|\btsd\b|tausend/.test(h)) return 1000;
    return 1;
}

const scaleNumber = (n, scale) => (n === null ? null : n * scale);

/** Deutsche Schreibweise erzwingen: Punkte = Tausender, Komma = Dezimal. */
function parseGermanAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^\d.,\-]/g, '').replace(/\./g, '').replace(',', '.');
    if (!cleaned || cleaned === '-') return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
}

/**
 * Betragsspalte spaltenweit einlesen. Zahlformate sind pro Wert oft mehrdeutig
 * (deutsch „350.070" vs. englisch „350.07"), aber innerhalb einer Spalte
 * einheitlich. Enthält die Spalte eindeutige deutsche Tausenderpunkte
 * (z. B. „189.245", „1.822") und keine englische Tausendertrennung mit Komma,
 * wird die GANZE Spalte deutsch interpretiert – das verhindert, dass einzelne
 * Werte wie „350.070" fälschlich zu 350,07 (1000× zu klein) werden.
 * @returns {{ values: (number|null)[], format: 'de'|'auto' }}
 */
export function parseAmountColumn(rawValues) {
    let deThousands = 0;
    let enThousands = 0;
    let hasComma = 0;
    for (const raw of rawValues) {
        const s = raw === null || raw === undefined ? '' : String(raw).trim();
        if (!s) continue;
        if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) deThousands++;           // 189.245 / 1.234.567
        if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) enThousands++;      // 1,234 / 1,234.56
        if (s.includes(',')) hasComma++;
    }
    const forceGerman = deThousands > 0 && enThousands === 0 && hasComma === 0;
    return {
        values: rawValues.map((v) => (forceGerman ? parseGermanAmount(v) : parseNumber(v))),
        format: forceGerman ? 'de' : 'auto'
    };
}

function parseCoord(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function parseWeeks(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseInt(String(value).match(/\d+/)?.[0] ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBool(value) {
    const str = String(value ?? '').trim().toLowerCase();
    return ['1', 'ja', 'j', 'yes', 'y', 'true', 'wahr', 'x', 'primär', 'primaer', 'haupt'].includes(str);
}

/** Kurze, stabile Prüfsumme (FNV-1a) – für IDs, nicht für Sicherheit. */
function shortHash(value) {
    let hash = 0x811c9dc5;
    for (const char of String(value)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
}

/** „Promotor", „Promoter", „PRO" … → 'promotor', alles andere → 'kunde'. */
export function contactKind(value) {
    return /promot|^pro$/i.test(String(value ?? '').trim()) ? 'promotor' : 'kunde';
}

function contactFromValues({ nummer, name, telefon, email, primary, sheetRow, art, abteilung, thema }) {
    const cleanName = String(name ?? '').trim();
    const cleanPhone = String(telefon ?? '').trim();
    const cleanEmail = String(email ?? '').trim();
    if (!cleanName && !cleanPhone && !cleanEmail) return null;
    const cleanNummer = String(nummer ?? '').trim();
    const details = {};
    if (art === 'promotor') details.art = 'promotor';
    if (String(abteilung ?? '').trim()) details.abteilung = String(abteilung).trim();
    if (String(thema ?? '').trim()) details.thema = String(thema).trim();
    return {
        ...details,
        // Aus dem Inhalt, nicht aus der Excel-Zeile: Zwei Importe mit je einem
        // Kontakt in „Zeile 2" ergaben sonst dieselbe ID für Anna und Bernd.
        id: `ct-${cleanNummer || sheetRow}-${shortHash(`${cleanName.toLowerCase()}|${cleanPhone}|${cleanEmail.toLowerCase()}`)}`,
        nummer: String(nummer ?? '').trim(),
        name: cleanName,
        telefon: cleanPhone,
        email: cleanEmail,
        primary: !!primary,
        _sheetRow: sheetRow
    };
}

/**
 * Rückweg der Exportspalte „Weitere Ansprechpartner":
 * „Bernd Kurz · 0201 123 · b@firma.de | Clara · c@firma.de".
 * Leere Teile fehlen im Export – deshalb wird jeder Teil an seiner Form
 * erkannt (E-Mail an „@", Telefon an Ziffern), nicht an seiner Position.
 */
// Übliche Schreibweisen: „0234 123456", „(0234) 123456", „+49 (0)234 12-34",
// „0234/123456". Mindestens 5 Ziffern, sonst nur Zeichen, die in Nummern vorkommen.
const PHONE_PATTERN = /^[+(]?[\d\s/().-]+$/;
const looksLikePhone = (part) => PHONE_PATTERN.test(part) && (part.match(/\d/g) || []).length >= 5;

function parseOtherContacts(value, nummer, sheetRow, onUnknown = () => {}, art = 'kunde') {
    // Zweiter freier Teil: Abteilung (Ansprechpartner) bzw. Thema (Promotor).
    const detailKey = art === 'promotor' ? 'thema' : 'abteilung';
    return String(value ?? '')
        .split(/\s*\|\s*|\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const found = { name: '', telefon: '', email: '', [detailKey]: '' };
            for (const part of entry.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean)) {
                if (!found.email && part.includes('@')) found.email = part;
                else if (!found.telefon && looksLikePhone(part)) found.telefon = part;
                else if (!found.name) found.name = part;
                else if (!found[detailKey]) found[detailKey] = part;
                else onUnknown(part); // nichts still verwerfen
            }
            return contactFromValues({ nummer, ...found, art, primary: false, sheetRow });
        })
        .filter(Boolean);
}

function syncPrimaryContact(customer) {
    const contacts = Array.isArray(customer.contacts) ? customer.contacts.filter(Boolean) : [];
    if (contacts.length === 0) {
        delete customer.contacts;
        return customer;
    }
    // Hauptansprechpartner ist immer ein Kontakt des Kunden – nie ein Promotor.
    const candidates = contacts.filter((c) => c.art !== 'promotor');
    const primary = candidates.find((c) => c.primary) || candidates.find((c) => c.name) || candidates[0] || null;
    // Genau ein Hauptkontakt – über das Objekt, nicht über die ID: Ältere
    // Bestände können doppelte IDs tragen. Doppelte IDs werden dabei eindeutig.
    const seenIds = new Set();
    customer.contacts = contacts.map((c, i) => {
        let id = c.id || `ct-${i}`;
        while (seenIds.has(id)) id = `${id}-${i}`;
        seenIds.add(id);
        return { ...c, id, primary: c === primary };
    });
    if (!primary) {
        delete customer.primaryContactId;
        return customer;
    }
    const chosen = customer.contacts[contacts.indexOf(primary)];
    customer.primaryContactId = chosen.id;
    customer.ansprechpartner = chosen.name || '';
    customer.telefon = chosen.telefon || '';
    customer.email = chosen.email || '';
    return customer;
}

/**
 * Gibt es diesen Kalendertag wirklich?
 *
 * Ohne diese Prüfung wanderten „31.02.2026" (rollt still auf den 03.03.) und
 * „2026-13-40" (gar kein Datum) in den Bestand. Das zweite ist das
 * gefährlichere: `new Date()` liefert dafür NaN, beide Fälligkeitsvergleiche
 * schlagen fehl, und der Kunde erscheint als **unkritisch** statt überfällig.
 * Eine unbrauchbare Angabe soll in der Fehlerliste landen, nicht in einer
 * stillen Fehleinschätzung.
 */
function isRealCalendarDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return false;
    const [, y, mo, d] = m.map(Number);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    const probe = new Date(Date.UTC(y, mo - 1, d));
    return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/** Datum robust nach ISO (YYYY-MM-DD) parsen; unterstützt dd.mm.yyyy, ISO, Excel-Seriennummer */
function localTodayIso(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseDateIso(value) {
    if (value === null || value === undefined || value === '') return null;
    const str = String(value).trim();

    // Excel-Seriennummer (Tage seit 1899-12-30)
    if (/^\d{5}$/.test(str)) {
        const ms = (parseInt(str, 10) - 25569) * 86400 * 1000;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    // dd.mm.yyyy oder dd/mm/yyyy
    let m = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
    if (m) {
        let [, d, mo, y] = m;
        if (y.length === 2) y = `20${y}`;
        const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
        return isRealCalendarDate(iso) ? iso : null;
    }
    // yyyy-mm-dd (evtl. mit Zeitanteil)
    m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
        const [, y, mo, d] = m;
        const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
        return isRealCalendarDate(iso) ? iso : null;
    }
    return null;
}

/**
 * Zeilen anhand Mapping einlesen und dabei auf Plausibilität prüfen.
 *
 * Unterscheidet:
 *  - Kundenzeilen (Kundenname vorhanden)
 *  - Flächenzeilen (kein Kundenname, aber „Gebiet" gefüllt) → Gebietszuordnung
 *
 * @returns {{ customers, areaRows, errors, skipped }}
 *   errors: [{ Zeile, Typ: 'Fehler'|'Hinweis', Grund, ...Originalspalten }]
 */
export function parseRows(rows, mapping) {
    const customers = [];
    const areaRows = [];
    const contactRows = [];
    const errors = [];
    const seen = new Map(); // Dublettenschlüssel -> erste Zeilennummer
    // Umsatzjahre („Umsatz 2024", „GJ 2025") bleiben als Originalspalte in
    // `extra` – auch die als „Umsatz" zugeordnete –, damit Export und Reimport
    // sie verlustfrei wiederfinden. Kontaktart/Thema gehören nur in
    // Kontaktzeilen; in einer Kundenzeile bleiben sie Zusatzspalte.
    const allHeaders = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
    const yearHeaders = revenueYearHeaders(allHeaders);
    const keptInExtra = new Set([...yearHeaders.map((entry) => entry.header), mapping.kontaktArt, mapping.thema].filter(Boolean));
    const mappedHeaders = new Set(Object.values(mapping).filter((header) => header && !keptInExtra.has(header)));
    const yearColumns = yearHeaders.map(({ header, year }) => {
        const scale = detectRevenueScale(header);
        const { values } = parseAmountColumn(rows.map((row) => row[header]));
        return { year, values: values.map((n) => scaleNumber(n, scale)) };
    });
    let skipped = 0;

    const err = (sheetRow, grund, raw, typ = 'Fehler') => errors.push({ Zeile: sheetRow, Typ: typ, Grund: grund, ...raw });

    // Umsatz spaltenweit einlesen (einheitliches Zahlformat) + optionale
    // Skalierung aus der Überschrift (z. B. „Umsatz T€" → ×1000).
    const umsatzScale = mapping.umsatz ? detectRevenueScale(mapping.umsatz) : 1;
    const umsatzColumn = mapping.umsatz
        ? parseAmountColumn(rows.map((r) => r[mapping.umsatz]))
        : { values: [], format: 'auto' };
    const umsatzByRow = umsatzColumn.values.map((n) => scaleNumber(n, umsatzScale));
    if (mapping.umsatz) {
        const total = umsatzByRow.reduce((sum, n) => sum + (n || 0), 0);
        const hinweise = [];
        if (umsatzColumn.format === 'de') hinweise.push('deutsche Tausendertrennung (Punkt) erkannt');
        if (umsatzScale !== 1) hinweise.push(`Einheit ${umsatzScale === 1_000_000 ? 'Millionen' : 'Tausend'} Euro (×${umsatzScale.toLocaleString('de-DE')})`);
        // Immer die erkannte Gesamtsumme melden – so lässt sich sofort prüfen,
        // ob die Umsätze korrekt eingelesen wurden.
        const format = hinweise.length ? `${hinweise.join(', ')}. ` : '';
        errors.push({
            Zeile: '—', Typ: 'Hinweis',
            Grund: `Umsatzspalte „${mapping.umsatz}": ${format}erkannte Gesamtsumme ${Math.round(total).toLocaleString('de-DE')} €. Bitte prüfen, ob das plausibel ist.`
        });
    }

    rows.forEach((row, index) => {
        const sheetRow = index + 2; // Kopfzeile = Zeile 1
        const get = (key) => (mapping[key] ? String(row[mapping[key]] ?? '').trim() : '');
        const name = get('name');
        const gebiet = get('gebiet');
        const nummer = get('nummer');
        const contactRow = !name && !gebiet;
        // Art des Kontakts: ausdrücklich („Kontaktart"), sonst verrät es die
        // Liste – ein Thema oder eine Spalte „Promotor" gibt es nur bei Promotoren.
        const art = get('kontaktArt')
            ? contactKind(get('kontaktArt'))
            : contactRow && (get('thema') || /promot/i.test(mapping.ansprechpartner || '')) ? 'promotor' : 'kunde';
        const contact = contactFromValues({
            nummer,
            name: get('ansprechpartner'),
            telefon: get('telefon'),
            email: get('email'),
            primary: parseBool(get('kontaktPrimaer')),
            art: contactRow ? art : 'kunde',
            abteilung: get('abteilung'),
            thema: contactRow ? get('thema') : '',
            sheetRow
        });

        // Leere Zeile
        if (!name && !gebiet && !contact) { skipped++; return; }

        // Kontaktdatei: kein Kundenstamm, aber Kontaktinfos mit Kundennummer
        if (contactRow && contact) {
            if (!nummer) { err(sheetRow, 'Kontaktzeile ohne Kundennummer - Zuordnung nicht möglich', row); return; }
            // Ein Promotor ist nie Hauptansprechpartner des Kunden.
            contactRows.push({ ...contact, primary: contact.art === 'promotor' ? false : contact.primary, raw: row });
            return;
        }

        // Flächenzeile (Gebietszuordnung ohne Kunde)
        if (!name && gebiet) {
            const bezirk = get('bezirk');
            const vb = get('vb');
            if (!bezirk) { err(sheetRow, 'Flächenzeile ohne Vertriebsbezirk', row); return; }
            areaRows.push({ gebiet, bezirk, vb, sheetRow, raw: row });
            return;
        }

        // Kundenzeile – ein fehlender Vertriebsbezirk ist kein Ausschlussgrund:
        // Der Kunde läuft dann unter „Ohne Zuordnung" und kann später per neuem
        // Import einem Bezirk zugeordnet werden. Die typische erste Liste eines
        // Nutzers (Name + PLZ) soll ohne Hürde auf der Karte landen.
        const bezirk = get('bezirk');

        const plz = cleanPlz(get('plz'));
        const lat = parseCoord(mapping.lat ? row[mapping.lat] : null);
        const lng = parseCoord(mapping.lng ? row[mapping.lng] : null);
        const hasCoords = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        if (!plz && !hasCoords) { err(sheetRow, 'Weder PLZ noch Koordinaten – nicht verortbar', row); return; }

        const dupKey = nummer ? `nr:${nummer}` : `np:${name.toLowerCase()}|${plz}`;
        if (seen.has(dupKey)) {
            err(sheetRow, `Dublette – ${nummer ? `gleiche Kundennummer` : `gleicher Name + PLZ`} wie Zeile ${seen.get(dupKey)}`, row);
            return;
        }
        seen.set(dupKey, sheetRow);

        const letzterBesuch = mapping.letzterBesuch ? parseDateIso(row[mapping.letzterBesuch]) : null;
        const besuche = new Set(letzterBesuch ? [letzterBesuch] : []);
        // Ein Besuch liegt nie in der Zukunft – solche Daten sind Termine oder
        // Tippfehler. Sie würden „Zuletzt besucht" verfälschen; als Hinweis melden.
        const future = [];
        if (mapping.alleBesuche) {
            const invalid = [];
            for (const part of String(row[mapping.alleBesuche] ?? '').split(/[;,|\n]/).map((p) => p.trim()).filter(Boolean)) {
                const date = parseDateIso(part);
                if (date) besuche.add(date); else invalid.push(part);
            }
            if (invalid.length) err(sheetRow, `Besuchsdatum nicht lesbar, übersprungen: ${invalid.slice(0, 3).join(', ')}`, row, 'Hinweis');
        }
        const today = localTodayIso();
        for (const date of [...besuche]) {
            if (date > today) { besuche.delete(date); future.push(date); }
        }
        if (future.length) err(sheetRow, `Besuchsdatum in der Zukunft, nicht als Besuch übernommen: ${future.sort().slice(0, 3).join(', ')}`, row, 'Hinweis');
        const extra = Object.fromEntries(Object.entries(row)
            .filter(([header, value]) => !mappedHeaders.has(header) && String(value ?? '').trim() !== '')
            // Abgeleitete Exportspalte: wird aus der Historie neu berechnet, nicht als
            // veralteter Zusatzwert mitgeschleppt.
            .filter(([header]) => !(mapping.alleBesuche && normalizeHeader(header) === normalizeHeader('Anzahl Besuche')))
            .map(([header, value]) => [header, String(value ?? '').trim()]));
        const customer = {
            // Stabile ID aus dem fachlichen Schlüssel (eindeutig dank Dublettenprüfung
            // oben), nicht aus der Zeilennummer: Nach Umsortieren und Reimport muss
            // dieselbe ID denselben Kunden meinen – gespeicherte Touren und
            // Szenarien hängen daran.
            id: `k-${dupKey}`,
            nummer, name,
            strasse: get('strasse'),
            plz,
            ort: get('ort'),
            vb: get('vb'),
            channel: get('channel'),
            gruppe: get('gruppe'),
            bezirk,
            kundentyp: get('kundentyp'),
            ansprechpartner: get('ansprechpartner'),
            telefon: get('telefon'),
            email: get('email'),
            umsatz: umsatzByRow[index] ?? null,
            ...(yearColumns.length ? { umsatzJahre: revenueYearsOfRow(yearColumns, index) } : {}),
            rhythmusWochen: parseWeeks(mapping.rhythmusWochen ? row[mapping.rhythmusWochen] : null),
            besuche: [...besuche].sort(),
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lng : null,
            // Fremde Koordinaten gelten als genau – außer der eigene Export sagt
            // etwas anderes („PLZ-Mitte"): Dann bleibt der Kunde ein Kandidat
            // für die adressgenaue Verortung.
            geo: hasCoords ? geoFromExportLabel(mapping.verortung ? row[mapping.verortung] : null) : 'none',
            extra,
            _sheetRow: sheetRow,
            _raw: row
        };
        const unknownParts = [];
        const others = [
            ...(mapping.weitereKontakte
                ? parseOtherContacts(row[mapping.weitereKontakte], nummer, sheetRow, (part) => unknownParts.push(part))
                : []),
            ...(mapping.promotoren
                ? parseOtherContacts(row[mapping.promotoren], nummer, sheetRow, (part) => unknownParts.push(part), 'promotor')
                : [])
        ];
        if (unknownParts.length) {
            err(sheetRow, `Weitere Ansprechpartner: nicht zuordenbare Angabe übersprungen: ${unknownParts.slice(0, 3).join(', ')}`, row, 'Hinweis');
        }
        if (contact || others.length) {
            customer.contacts = [...(contact ? [{ ...contact, primary: true }] : []), ...others];
            if (contact) customer.primaryContactId = contact.id;
        }
        customers.push(syncPrimaryContact(customer));
    });

    const ohneBezirk = customers.filter((c) => !String(c.bezirk ?? '').trim()).length;
    if (ohneBezirk > 0) {
        errors.push({
            Zeile: '—', Typ: 'Hinweis',
            Grund: `${ohneBezirk} Kunde${ohneBezirk === 1 ? '' : 'n'} ohne Vertriebsbezirk importiert – ${ohneBezirk === 1 ? 'er erscheint' : 'sie erscheinen'} unter „Ohne Zuordnung". Bezirke können jederzeit per neuem Import ergänzt werden.`
        });
    }

    return { customers, areaRows, contactRows, errors, skipped };
}

/** { 2025: 1200, 2024: 1100 } – nur Jahre mit lesbarem Wert. */
function revenueYearsOfRow(yearColumns, index) {
    const years = {};
    for (const { year, values } of yearColumns) {
        const value = values[index];
        if (value !== null && value !== undefined && Number.isFinite(value) && !(year in years)) years[year] = value;
    }
    return years;
}

export function attachContacts(customers, contactRows, errors = []) {
    const byNumber = new Map(customers
        .filter((c) => String(c.nummer ?? '').trim())
        .map((c) => [String(c.nummer).trim(), c]));
    let matched = 0;

    for (const contact of contactRows) {
        const customer = byNumber.get(String(contact.nummer ?? '').trim());
        if (!customer) {
            errors.push({
                Zeile: contact._sheetRow,
                Typ: 'Fehler',
                Grund: `Kontakt konnte keiner Kundennummer zugeordnet werden: ${contact.nummer}`,
                ...(contact.raw || {})
            });
            continue;
        }
        const existing = Array.isArray(customer.contacts) ? customer.contacts : [];
        const next = {
            id: contact.id,
            name: contact.name,
            telefon: contact.telefon,
            email: contact.email,
            primary: contact.primary,
            ...(contact.art ? { art: contact.art } : {}),
            ...(contact.abteilung ? { abteilung: contact.abteilung } : {}),
            ...(contact.thema ? { thema: contact.thema } : {}),
            // Kommt aus einer eigenen Kontaktliste: Ein späterer Reimport des
            // Kundenstamms (mit eigenen Kontaktspalten) lässt ihn stehen.
            kontaktliste: true
        };
        const duplicate = existing.find((c) =>
            (c.name || '') === next.name && (c.telefon || '') === next.telefon && (c.email || '') === next.email
            && (c.art || 'kunde') === (next.art || 'kunde'));
        // Eine spätere Zeile ohne Haupt-Markierung nimmt einem bestehenden
        // Hauptkontakt die Rolle nicht weg.
        const entry = duplicate ? Object.assign(duplicate, next, { primary: duplicate.primary || next.primary }) : next;
        if (!duplicate) existing.push(next);
        customer.contacts = existing;
        // Ausdrücklich als Hauptkontakt markiert (oder noch keiner da): genau
        // dieser Eintrag – über das Objekt, damit gleiche IDs nichts verwechseln.
        if (next.art !== 'promotor' && (next.primary || !customer.primaryContactId)) {
            customer.contacts.forEach((c) => { c.primary = c === entry; });
        }
        syncPrimaryContact(customer);
        matched++;
    }

    return { matched, unmatched: contactRows.length - matched };
}

/** Fehler-/Hinweisliste als Excel herunterladen */
export function exportErrors(errors, fileBase = 'tourfuchs') {
    const ws = XLSX.utils.json_to_sheet(errors);
    ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fehler & Hinweise');
    XLSX.writeFile(wb, `${fileBase}-importfehler-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** Excel-Vorlage mit Beispielzeilen erzeugen und herunterladen */
export function downloadTemplate() {
    const first = demoCustomerIdentity(0, 'Autohaus');
    const second = demoCustomerIdentity(1, 'Bäckerei');
    const third = demoCustomerIdentity(2, 'Elektro');
    const rows = [
        {
            'Datenstatus': DEMO_DATA_LABEL,
            'Kundennummer': '10001', 'Kundenname': first.name,
            'Straße': '', 'PLZ': '50667', 'Ort': 'Köln',
            'Vertriebsbeauftragter': 'Demo Vertrieb West',
            'Vertriebschannel': 'Fachhandel', 'Vertriebsgruppe': 'Handel', 'Vertriebsbezirk': 'Bezirk West',
            'Kundentyp': 'Fachhändler',
            'Gebiet (LK/PLZ)': '',
            'Hauptansprechpartner': first.ansprechpartner, 'Telefon': first.telefon, 'E-Mail': first.email,
            'Umsatz': 125000, 'Besuchsrhythmus (Wochen)': 6, 'Letzter Besuch': '12.05.2026'
        },
        {
            'Datenstatus': DEMO_DATA_LABEL,
            'Kundennummer': '10002', 'Kundenname': second.name,
            'Straße': '', 'PLZ': '80331', 'Ort': 'München',
            'Vertriebsbeauftragter': 'Demo Vertrieb Süd',
            'Vertriebschannel': 'Direktvertrieb', 'Vertriebsgruppe': 'Lebensmittel', 'Vertriebsbezirk': 'Bezirk Süd',
            'Kundentyp': 'Endkunde',
            'Hauptansprechpartner': second.ansprechpartner, 'Telefon': second.telefon, 'E-Mail': second.email,
            'Umsatz': 48000, 'Besuchsrhythmus (Wochen)': 4, 'Letzter Besuch': '28.06.2026'
        },
        {
            'Datenstatus': DEMO_DATA_LABEL,
            'Kundennummer': '10003', 'Kundenname': third.name,
            'Straße': '', 'PLZ': '04109', 'Ort': 'Leipzig',
            'Vertriebsbeauftragter': 'Demo Vertrieb Ost',
            'Vertriebschannel': 'Direktvertrieb', 'Vertriebsgruppe': 'Handwerk', 'Vertriebsbezirk': 'Bezirk Ost',
            'Kundentyp': 'Partner',
            'Gebiet (LK/PLZ)': '',
            'Hauptansprechpartner': third.ansprechpartner, 'Telefon': third.telefon, 'E-Mail': third.email,
            'Umsatz': 87500, 'Besuchsrhythmus (Wochen)': 8, 'Letzter Besuch': ''
        },
        {
            // Flächenzeile: nur ein Gebiet einem Bezirk/VB zuordnen (ohne Kunde).
            // „Gebiet" = Landkreis-Name oder PLZ/PLZ-Präfix (z. B. 46 oder 46045).
            'Datenstatus': DEMO_DATA_LABEL,
            'Kundennummer': '', 'Kundenname': '',
            'Straße': '', 'PLZ': '', 'Ort': '',
            'Vertriebsbeauftragter': '',
            'Vertriebschannel': '', 'Vertriebsgruppe': '', 'Vertriebsbezirk': 'Bezirk West',
            'Gebiet (LK/PLZ)': 'Oberhausen',
            'Hauptansprechpartner': '', 'Telefon': '', 'E-Mail': '',
            'Umsatz': '', 'Besuchsrhythmus (Wochen)': '', 'Letzter Besuch': ''
        }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 8 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 12 }, { wch: 20 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunden');
    XLSX.writeFile(wb, 'tourfuchs-kundenliste-vorlage.xlsx');
}

/** Wie ein Kunde auf die Karte kam – für die Spalte „Verortung". */
const GEO_EXPORT_LABEL = {
    exakt: 'adressgenau',
    plz: 'PLZ-Mitte',
    strasse: 'Straße (Beispieldaten)',
    none: 'nicht verortet'
};

/** Rückweg der Spalte „Verortung" beim Wiederimport (bei vorhandenen Koordinaten). */
function geoFromExportLabel(label) {
    const text = String(label ?? '').trim().toLowerCase();
    if (text === GEO_EXPORT_LABEL.plz.toLowerCase()) return 'plz';
    if (text === GEO_EXPORT_LABEL.strasse.toLowerCase()) return 'strasse';
    return 'exakt';
}

function contactExportText(contact) {
    // Name zuerst, dann Abteilung bzw. Thema: Der Rückweg erkennt die freien
    // Teile an ihrer Reihenfolge, Telefon und E-Mail an ihrer Form.
    return [contact?.name, contact?.art === 'promotor' ? contact?.thema : contact?.abteilung, contact?.telefon, contact?.email]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' · ');
}

/**
 * Eine Zeile je Kunde – **alles**, was TourFuchs über ihn weiß.
 *
 * Neben den bekannten Feldern gehören dazu: jede Spalte der Originaldatei,
 * die keinem Feld zugeordnet war (`extra` – sonst ginge sie beim Weitergeben
 * ins CRM verloren), die ganze Besuchshistorie statt nur des letzten Besuchs,
 * wie genau der Kunde verortet ist (nach der Hintergrund-Verortung
 * „adressgenau") und weitere Ansprechpartner aus einer Kontaktdatei.
 *
 * Die ersten Spaltennamen sind bewusst die, die der Import wiedererkennt: Die
 * Datei lässt sich wieder einlesen.
 */
export function customerExportRows(customers) {
    const list = customers || [];
    // Originalspalten: Vereinigung über alle Kunden, in der Reihenfolge ihres
    // ersten Auftretens – jede Zeile bekommt jede Spalte (leer, wo nichts steht).
    const extraHeaders = [];
    const seenHeaders = new Set();
    for (const c of list) {
        for (const header of Object.keys(c?.extra || {})) {
            if (!seenHeaders.has(header)) { seenHeaders.add(header); extraHeaders.push(header); }
        }
    }
    const allContacts = list.flatMap((c) => (c?.contacts || []).filter(Boolean));
    const withDepartment = allContacts.some((contact) => contact.primary && contact.abteilung);
    const withPromotors = allContacts.some((contact) => contact.art === 'promotor');
    return list.map((c) => {
        const visits = [...new Set((c.besuche || []).filter(Boolean))].sort();
        const contacts = (c.contacts || []).filter(Boolean);
        const others = contacts.filter((contact) => !contact.primary && contact.art !== 'promotor').map(contactExportText).filter(Boolean);
        const promotors = contacts.filter((contact) => contact.art === 'promotor').map(contactExportText).filter(Boolean);
        const primary = contacts.find((contact) => contact.primary);
        const row = {
            'Datenstatus': isDemoCustomer(c) ? DEMO_DATA_LABEL : '',
            'Kundennummer': c.nummer,
            'Kundenname': c.name,
            'Straße': c.strasse,
            'PLZ': c.plz,
            'Ort': c.ort,
            'Vertriebsbeauftragter': c.vb,
            'Vertriebschannel': c.channel ?? '',
            'Vertriebsgruppe': c.gruppe,
            'Vertriebsbezirk': c.bezirk ?? '',
            'Kundentyp': c.kundentyp ?? '',
            'Hauptansprechpartner': c.ansprechpartner ?? '',
            'Telefon': c.telefon ?? '',
            'E-Mail': c.email ?? '',
            'Umsatz': c.umsatz ?? '',
            'Besuchsrhythmus (Wochen)': c.rhythmusWochen ?? '',
            'Letzter Besuch': visits.length ? visits[visits.length - 1] : '',
            'Lat': c.lat ?? '',
            'Lng': c.lng ?? '',
            'Verortung': GEO_EXPORT_LABEL[c.geo] || (c.lat !== null && c.lat !== undefined ? 'verortet' : 'nicht verortet'),
            'Anzahl Besuche': visits.length,
            'Alle Besuche': visits.join('; '),
            'Weitere Ansprechpartner': others.join(' | ')
        };
        // Nur wenn es sie im Bestand gibt – die übliche Liste bleibt schmal.
        if (withDepartment) row['Abteilung'] = primary?.abteilung ?? '';
        if (withPromotors) row['Promotoren'] = promotors.join(' | ');
        for (const header of extraHeaders) {
            // Eine Originalspalte, die wie eine TourFuchs-Spalte heißt, überschreibt sie nicht.
            const key = header in row ? `${header} (Original)` : header;
            row[key] = c.extra?.[header] ?? '';
        }
        return row;
    });
}

/**
 * Umbuchungsliste einer Gebietssimulation als Excel (Roadmap 3.1).
 *
 * Gegenstück zur gedruckten Entscheidungsvorlage: Die Vorlage bleibt
 * aggregiert und geht in die Sitzung, diese Datei nennt die Kunden namentlich
 * und geht an die Person, die die Umbuchung ausführt.
 *
 * @param {Array<object>} rows  aus `reassignmentRows()` – bereits mit
 *                              sprechenden deutschen Spaltenköpfen
 * @param {{ demo?: boolean }} options
 * @returns {boolean} false, wenn es nichts zu exportieren gibt
 */
export function exportReassignments(rows, { demo = false } = {}) {
    if (!Array.isArray(rows) || rows.length === 0) return false;
    const marked = demo
        ? rows.map((row) => ({ 'Datenstatus': DEMO_DATA_LABEL, ...row }))
        : rows;
    const ws = XLSX.utils.json_to_sheet(marked);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, demo ? 'DEMO-Umbuchungen' : 'Umbuchungen');
    const prefix = demo ? 'tourfuchs-DEMO-nicht-produktiv-umbuchungen' : 'tourfuchs-umbuchungen';
    XLSX.writeFile(wb, `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return true;
}

/**
 * Besuchsbericht als Excel-Datei im Speicher (zum Teilen oder Herunterladen).
 * @param {Array<object>} rows  aus `visitReportRows()`
 * @returns {{ file: File, fileName: string }}
 */
export function visitReportFile(rows, { demo = false, today = new Date().toISOString().slice(0, 10) } = {}) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Besuchsbericht');
    const fileName = `${demo ? 'tourfuchs-DEMO-nicht-produktiv-besuche' : 'tourfuchs-besuche'}-${today}.xlsx`;
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([data], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return { file, fileName };
}

/** Aktuelle Kundenliste als Excel exportieren (inkl. Besuchsdaten) */
export function exportCustomers(customers, { fileLabel = '' } = {}) {
    const demo = hasDemoCustomers(customers);
    const rows = customerExportRows(customers);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, demo ? 'DEMO-Kunden' : 'Kunden');
    // Gebietsexport: „tourfuchs-kunden-bezirk-west-2026-09-26.xlsx"
    const base = demo ? 'tourfuchs-DEMO-nicht-produktiv' : 'tourfuchs-kunden';
    const prefix = fileLabel ? `${base}-${fileLabel}` : base;
    XLSX.writeFile(wb, `${prefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Demo-Datensatz: 3 Vertriebsbeauftragte, je 2 geografisch zusammenhängende
 * Vertriebsbezirke (benachbarte Städte/Kreise), quer durch Deutschland.
 * Spalten: [name, straße, plz, ort, vb, gruppe, umsatz, bezirk]
 */
/**
 * Umfangreiche, flächendeckende Demodaten.
 * Hierarchie: Channel „Digital" → Vertriebsgruppe (Nord/Ost/Süd) →
 * Vertriebsbezirk (viele, je eine Farbe). Jeder Bezirk ist ein zusammenhängendes
 * Gebiet aus mehreren Landkreisen – realisiert über eine Nächster-Anker-Zuordnung
 * (Voronoi) aller echten deutschen PLZ zu Bezirks-Ankern. So füllt sich ganz
 * Deutschland; die Färbung hängt am Vertriebsbezirk.
 */
export function createDemoCustomers(centroids, places) {
    // Bezirks-Anker (Name, Vertriebsgruppe, optionaler VB, Position)
    const anchors = [
        // Nord (inkl. West)
        { name: 'Bezirk Hamburg-Küste',   gruppe: 'Nord', vb: 'Lena Krüger',    lat: 53.55, lng: 9.99 },
        { name: 'Bezirk Bremen-Weser',    gruppe: 'Nord', vb: '',               lat: 53.08, lng: 8.80 },
        { name: 'Bezirk Hannover-Leine',  gruppe: 'Nord', vb: 'Jonas Weber',    lat: 52.37, lng: 9.73 },
        { name: 'Bezirk Ruhr-Dortmund',   gruppe: 'Nord', vb: 'Max Mustermann', lat: 51.51, lng: 7.47 },
        { name: 'Bezirk Rheinland-Köln',  gruppe: 'Nord', vb: 'Max Mustermann', lat: 50.94, lng: 6.96 },
        // Ost
        { name: 'Bezirk Berlin-Spree',    gruppe: 'Ost',  vb: 'Tim Schulz',     lat: 52.52, lng: 13.40 },
        { name: 'Bezirk Rostock-Ostsee',  gruppe: 'Ost',  vb: '',               lat: 54.09, lng: 12.13 },
        { name: 'Bezirk Magdeburg-Elbe',  gruppe: 'Ost',  vb: 'Tim Schulz',     lat: 52.13, lng: 11.63 },
        { name: 'Bezirk Leipzig-Sachsen', gruppe: 'Ost',  vb: 'Nina Hoffmann',  lat: 51.34, lng: 12.37 },
        { name: 'Bezirk Dresden-Elbland', gruppe: 'Ost',  vb: 'Nina Hoffmann',  lat: 51.05, lng: 13.74 },
        // Süd (inkl. Mitte)
        { name: 'Bezirk Frankfurt-Main',  gruppe: 'Süd',  vb: 'Sofia Richter',  lat: 50.11, lng: 8.68 },
        { name: 'Bezirk Stuttgart-Neckar', gruppe: 'Süd', vb: 'Sofia Richter',  lat: 48.78, lng: 9.18 },
        { name: 'Bezirk Freiburg-Schwarzwald', gruppe: 'Süd', vb: '',           lat: 48.00, lng: 7.85 },
        { name: 'Bezirk Franken-Nürnberg', gruppe: 'Süd', vb: 'Anna Beispiel',  lat: 49.45, lng: 11.08 },
        { name: 'Bezirk München-Oberbayern', gruppe: 'Süd', vb: 'Anna Beispiel', lat: 48.14, lng: 11.58 }
    ];

    // Jede PLZ dem nächstgelegenen Anker zuordnen (Voronoi -> zusammenhängende Bezirke)
    const pools = anchors.map(() => []);
    for (const plz in centroids) {
        if (!places[plz]) continue;
        const [la, ln] = centroids[plz];
        let best = 0, bestD = Infinity;
        for (let a = 0; a < anchors.length; a++) {
            const dl = la - anchors[a].lat, dn = ln - anchors[a].lng;
            const d = dl * dl + dn * dn;
            if (d < bestD) { bestD = d; best = a; }
        }
        pools[best].push(plz);
    }

    // Deterministischer Pseudo-Zufall, damit die Demo bei jedem Laden gleich aussieht
    let seed = 0x9e3779b9;
    const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

    const branchen = ['Autohaus', 'Bäckerei', 'Metallbau', 'Getränke', 'MedTech', 'Baustoffe', 'Elektro', 'Logistik', 'Hotel', 'Feinkost', 'Werkzeuge', 'Maschinenbau', 'Sanitär', 'Druckerei', 'Gartenbau', 'Fliesen', 'Dachdecker', 'Kfz-Service', 'Textil', 'Optik'];
    const umsatzChoices = [24000, 33000, 48000, 61000, 79000, 104000, 138000, 176000, 224000, 295000, 360000];
    const rhythmChoices = [4, 6, 6, 8, 12];
    const PER_BEZIRK = 150;
    const out = [];
    let i = 0;
    anchors.forEach((anchor, ai) => {
        const pool = pools[ai];
        if (pool.length === 0) return;
        for (let n = 0; n < PER_BEZIRK; n++) {
            const plz = pool[Math.floor(rnd() * pool.length)];
            const identity = demoCustomerIdentity(i, pick(branchen));
            // Die frühere Namens- und Straßenwahl verbrauchte vier Zufallswerte.
            // Weiterziehen erhält die bewährte geografische Demo-Verteilung.
            rnd(); rnd(); rnd(); rnd();
            const rhythmusWochen = rhythmChoices[i % rhythmChoices.length];
            const { besuche } = demoVisitSchedule(i, rhythmusWochen);
            out.push({
                id: `demo-${i}`,
                nummer: String(20000 + i),
                ...identity,
                strasse: '',
                plz,
                ort: places[plz] || '',
                vb: anchor.vb,
                channel: 'Digital',
                gruppe: anchor.gruppe,
                bezirk: anchor.name,
                umsatz: pick(umsatzChoices),
                rhythmusWochen,
                besuche,
                lat: null, lng: null, geo: 'none'
            });
            i++;
        }
    });
    return out;
}

export async function demoCustomers() {
    const [centroids, places, streets] = await Promise.all([loadPlzCentroids(), loadPlzPlaces(), loadDemoStreets()]);
    const customers = createDemoCustomers(centroids, places);
    applyDemoStreets(customers, streets);
    return customers;
}
