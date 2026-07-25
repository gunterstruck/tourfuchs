/**
 * Tabelle aus der Zwischenablage lesen.
 *
 * Die größte Hürde beim Erstausstieg ist nicht das Zuordnen der Spalten, sondern
 * der Weg zur Datei: „Erst mal aus SAP exportieren, speichern, wiederfinden."
 * Wer seine Liste ohnehin in Excel offen hat, markiert sie, drückt Strg+C und
 * fügt sie hier ein – TourFuchs landet danach im normalen Import-Assistenten.
 *
 * Excel legt beim Kopieren eine **Tab-getrennte** Fassung in die Zwischenablage;
 * aus Web-Tabellen und CSV-Editoren kommen Semikolon oder Komma. Alle drei
 * werden erkannt. Anführungszeichen nach RFC-4180-Art werden aufgelöst, damit
 * Werte mit Trennzeichen oder Zeilenumbruch heil bleiben.
 *
 * Bewusst ohne DOM und ohne SheetJS: reine Textverarbeitung, unit-testbar.
 */

const DELIMITERS = ['\t', ';', ','];

/** Zeilen in Felder zerlegen; Trennzeichen und Umbrüche in "..." bleiben Text. */
function splitRows(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } // verdoppeltes " = ein "
                else quoted = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"' && field === '') { quoted = true; continue; }
        if (char === delimiter) { row.push(field); field = ''; continue; }
        if (char === '\r') continue;
        if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
        field += char;
    }

    row.push(field);
    rows.push(row);
    // abschließender Zeilenumbruch erzeugt eine leere Restzeile
    return rows.filter((entry) => entry.length > 1 || entry[0].trim() !== '');
}

/**
 * Das Trennzeichen, das die gleichmäßigste Tabelle ergibt. Entscheidend ist
 * nicht die höchste Spaltenzahl, sondern dass alle Zeilen gleich viele Spalten
 * haben – sonst zerlegt ein Komma in „Musterstadt, Nord" die halbe Datei.
 */
export function detectDelimiter(text) {
    const sample = text.split(/\r?\n/).filter((line) => line.trim() !== '').slice(0, 10);
    if (sample.length === 0) return '\t';

    let best = { delimiter: '\t', columns: 0, consistent: false };
    for (const delimiter of DELIMITERS) {
        const counts = sample.map((line) => splitRows(line, delimiter)[0].length);
        const columns = counts[0];
        if (columns < 2) continue;
        const consistent = counts.every((count) => count === columns);
        const better = (consistent && !best.consistent)
            || (consistent === best.consistent && columns > best.columns);
        if (better) best = { delimiter, columns, consistent };
    }
    return best.delimiter;
}

/**
 * Eingefügten Text in dieselbe Struktur bringen wie `readWorkbook`:
 * `{ headers, rows }` mit einem Objekt je Datenzeile.
 */
export function parseClipboardTable(text) {
    const raw = String(text ?? '').replace(/^﻿/, '').replace(/\s+$/, '');
    if (!raw.trim()) throw new Error('Die Zwischenablage ist leer.');

    const delimiter = detectDelimiter(raw);
    const grid = splitRows(raw, delimiter);
    if (grid.length < 2) {
        throw new Error('Es wurde nur eine Zeile gefunden. Bitte die Überschriftenzeile mit markieren.');
    }

    const headers = [];
    const seen = new Set();
    grid[0].forEach((cell, index) => {
        // Leere oder doppelte Überschriften bekommen einen stabilen Ersatznamen,
        // damit die Zeilenobjekte keine Spalte verlieren.
        let header = String(cell ?? '').trim() || `Spalte ${index + 1}`;
        let unique = header;
        let suffix = 2;
        while (seen.has(unique)) unique = `${header} (${suffix++})`;
        seen.add(unique);
        headers.push(unique);
    });

    if (headers.length < 2) {
        throw new Error('Es wurde nur eine Spalte erkannt. Bitte mehrere Spalten aus der Tabelle markieren.');
    }

    const rows = grid.slice(1)
        .filter((cells) => cells.some((cell) => String(cell ?? '').trim() !== ''))
        .map((cells) => Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? '').trim()])));

    if (rows.length === 0) throw new Error('Unter der Überschriftenzeile stehen keine Datenzeilen.');

    return { headers, rows, delimiter };
}

/**
 * Sieht der eingefügte Text nach einer Tabelle aus? Schützt den globalen
 * Einfügen-Kurzweg davor, jeden beliebigen kopierten Satz als Import zu deuten.
 */
export function looksLikeTable(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return false;
    const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) return false;
    const delimiter = detectDelimiter(raw);
    return lines.slice(0, 5).every((line) => line.split(delimiter).length >= 2);
}
