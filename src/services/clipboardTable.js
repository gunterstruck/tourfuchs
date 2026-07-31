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
 * Zwei weitere Quellen sind inzwischen genauso häufig und sahen anders aus:
 *
 *  - **Markdown-Tabellen** (`| Name | PLZ |` mit Trennzeile `|---|---|`), wie sie
 *    Chat-Assistenten, Wikis und Ticketsysteme ausgeben.
 *  - **Tabellen mitten im Fließtext** – der Assistent schreibt „Gerne, hier sind
 *    Ihre Kunden:", dann die Tabelle, dann „Soll ich noch etwas ergänzen?".
 *
 * Beides scheiterte vorher mit „nur eine Spalte erkannt". Deshalb wird jetzt
 * zuerst der Tabellenblock aus der Umgebung herausgeschnitten: die längste
 * zusammenhängende Zeilenfolge mit gleicher Spaltenzahl gewinnt – dieselbe
 * Heuristik, mit der auch das Trennzeichen bestimmt wird.
 *
 * Bewusst ohne DOM und ohne SheetJS: reine Textverarbeitung, unit-testbar.
 */

const DELIMITERS = ['\t', ';', ','];

/**
 * Zeilen in Felder zerlegen; Trennzeichen und Umbrüche in "..." bleiben Text.
 *
 * `keepBlank` behält wirklich leere Zeilen als `['']`. Die Blockerkennung
 * braucht sie: Nur eine leere Zeile trennt die Tabelle vom Fließtext.
 */
function splitRows(text, delimiter, { keepBlank = false } = {}) {
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
    if (keepBlank) return rows;
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

/** Auszeichnungen aus einer Markdown-Zelle nehmen: **fett**, *kursiv*, `code`. */
function stripEmphasis(cell) {
    return String(cell ?? '').trim()
        .replace(/^\*\*([\s\S]*)\*\*$/, '$1')
        .replace(/^__([\s\S]*)__$/, '$1')
        .replace(/^\*([\s\S]*)\*$/, '$1')
        .replace(/^`([\s\S]*)`$/, '$1')
        .trim();
}

/** Eine Markdown-Zeile in Zellen zerlegen (führende/schließende Pipe entfällt). */
function splitMarkdownRow(line) {
    let text = line.trim();
    if (text.startsWith('|')) text = text.slice(1);
    if (text.endsWith('|')) text = text.slice(0, -1);
    return text.split('|').map(stripEmphasis);
}

/** Die Trennzeile einer Markdown-Tabelle: `|---|:--:|` – nur Striche und Doppelpunkte. */
function isMarkdownSeparator(line) {
    if (!line.includes('|') && !line.includes('-')) return false;
    const cells = splitMarkdownRow(line);
    return cells.length >= 2 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/**
 * Markdown-Tabelle im Text finden. Erkennungsmerkmal ist die Trennzeile: Was
 * unmittelbar darüber steht, ist die Überschrift; was darunter folgt, sind die
 * Datenzeilen. Umgebender Fließtext endet die Tabelle, weil er keine Pipe hat.
 */
export function extractMarkdownGrid(text) {
    const lines = String(text ?? '').split(/\r?\n/);
    const separator = lines.findIndex((line, index) => index > 0 && isMarkdownSeparator(line));
    if (separator < 1) return null;

    let start = separator - 1;
    while (start > 0 && lines[start - 1].includes('|')) start--;
    let end = separator + 1;
    while (end < lines.length && lines[end].includes('|')) end++;

    const grid = [...lines.slice(start, separator), ...lines.slice(separator + 1, end)]
        .map(splitMarkdownRow)
        .filter((cells) => cells.length >= 2);
    return grid.length >= 2 ? grid : null;
}

/**
 * Den Tabellenblock aus umgebendem Fließtext schneiden: die längste
 * zusammenhängende Folge von Zeilen mit identischer Spaltenzahl (mindestens
 * zwei Spalten, mindestens zwei Zeilen). Gibt es keine, war es keine Tabelle –
 * dann bleibt es beim bisherigen Weg samt seiner Fehlermeldungen.
 */
export function extractDelimitedGrid(text) {
    const raw = String(text ?? '');
    let best = null;

    for (const delimiter of DELIMITERS) {
        // Erst die Anführungszeichen auswerten, dann den Block suchen.
        //
        // Vorher wurde hier physisch an jedem Zeilenumbruch zerlegt – also
        // BEVOR bekannt war, welche Umbrüche innerhalb einer Zelle liegen.
        // Eine aus Excel kopierte Zelle mit Zeilenumbruch ("Notiz Zeile 1 /
        // Zeile 2") zerfiel dadurch in zwei Zeilen mit falscher Spaltenzahl,
        // der Block brach genau dort ab, und alle folgenden Kundenzeilen
        // gingen **lautlos** verloren – ohne Fehler, ohne Fehlerliste, mit
        // einer Erfolgsmeldung über zu wenige Kunden.
        const rows = splitRows(raw, delimiter, { keepBlank: true });
        // Eine Zeile aus lauter Trennzeichen ("\t" oder ";;") ist eine LEERE
        // ZEILE INNERHALB der Tabelle – sie darf den Block nicht abschneiden.
        // Nur eine wirklich leere Zeile trennt die Tabelle vom Fließtext.
        const counts = rows.map((cells) => (
            cells.length === 1 && cells[0].trim() === '' ? 0 : cells.length
        ));
        let index = 0;
        while (index < counts.length) {
            if (counts[index] < 2) { index++; continue; }
            let last = index;
            while (last + 1 < counts.length && counts[last + 1] === counts[index]) last++;
            const length = last - index + 1;
            if (length >= 2) {
                const candidate = { delimiter, start: index, end: last, columns: counts[index], length };
                const better = !best
                    || candidate.length > best.length
                    || (candidate.length === best.length && candidate.columns > best.columns);
                if (better) best = candidate;
            }
            index = last + 1;
        }
    }
    if (!best) return null;
    const rows = splitRows(raw, best.delimiter, { keepBlank: true });
    return { grid: rows.slice(best.start, best.end + 1), delimiter: best.delimiter };
}

/**
 * Eingefügten Text in dieselbe Struktur bringen wie `readWorkbook`:
 * `{ headers, rows }` mit einem Objekt je Datenzeile.
 */
export function parseClipboardTable(text) {
    const raw = String(text ?? '').replace(/^﻿/, '').replace(/\s+$/, '');
    if (!raw.trim()) throw new Error('Die Zwischenablage ist leer.');

    // Reihenfolge: Markdown ist eindeutig erkennbar und geht vor. Danach der
    // Tabellenblock im Fließtext. Zuletzt der bisherige Weg über den ganzen
    // Text – er trägt die vertrauten Fehlermeldungen.
    const markdown = extractMarkdownGrid(raw);
    const delimited = markdown ? null : extractDelimitedGrid(raw);
    const delimiter = markdown ? 'markdown' : (delimited?.delimiter ?? detectDelimiter(raw));
    const grid = markdown || delimited?.grid || splitRows(raw, delimiter);

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
 *
 * **Bewusst strenger als der Parser.** Im Einfüge-Dialog hat der Nutzer sich
 * entschieden – dort darf großzügig gelesen werden. Das globale Strg+V dagegen
 * greift ungefragt in eine fremde Absicht ein, also müssen die Anzeichen
 * eindeutig sein:
 *
 *  - eine Markdown-Tabelle ist eindeutig,
 *  - Tabulatoren und Semikolon sind in Fließtext praktisch nie zu finden,
 *  - **Kommas dagegen schon** – „Sehr geehrte Frau Meier, wie besprochen, …".
 *    Deshalb reichen dort zwei gleichförmige Zeilen nicht; es müssen
 *    mindestens drei sein.
 */
export function looksLikeTable(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return false;
    if (raw.split(/\r?\n/).filter((line) => line.trim() !== '').length < 2) return false;

    if (extractMarkdownGrid(raw)) return true;

    const block = extractDelimitedGrid(raw);
    if (!block) return false;
    // Komma ist das einzige Trennzeichen, das auch in Prosa vorkommt.
    const minimumLines = block.delimiter === ',' ? 3 : 2;
    return block.grid.length >= minimumLines;
}
