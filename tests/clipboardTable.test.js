import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectDelimiter, looksLikeTable, parseClipboardTable } from '../src/services/clipboardTable.js';

const excelCopy = [
    'Kundenname\tPLZ\tOrt\tVertriebsbezirk',
    'Muster GmbH\t45136\tEssen\tBezirk West',
    'Beispiel AG\t50667\tKöln\tBezirk Rheinland'
].join('\n');

describe('Zwischenablage-Import', () => {
    it('liest die Tab-getrennte Fassung, die Excel beim Kopieren ablegt', () => {
        const { headers, rows, delimiter } = parseClipboardTable(excelCopy);
        expect(delimiter).toBe('\t');
        expect(headers).toEqual(['Kundenname', 'PLZ', 'Ort', 'Vertriebsbezirk']);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({
            Kundenname: 'Muster GmbH', PLZ: '45136', Ort: 'Essen', Vertriebsbezirk: 'Bezirk West'
        });
    });

    it('erkennt Semikolon und Komma aus CSV-Editoren', () => {
        expect(parseClipboardTable('Name;PLZ\nMuster GmbH;45136').rows[0].PLZ).toBe('45136');
        expect(parseClipboardTable('Name,PLZ\nMuster GmbH,45136').rows[0].PLZ).toBe('45136');
    });

    it('zerlegt Orte mit Komma nicht, wenn Tabs die saubere Tabelle ergeben', () => {
        const text = 'Name\tOrt\nMuster GmbH\tEssen, Nord\nBeispiel AG\tKöln, Süd';
        expect(detectDelimiter(text)).toBe('\t');
        expect(parseClipboardTable(text).rows[0].Ort).toBe('Essen, Nord');
    });

    it('hält Werte in Anführungszeichen zusammen', () => {
        const text = 'Name;Ort\n"Muster GmbH; Werk 2";"Essen"\n"Sagt ""Hallo""";Köln';
        const { rows } = parseClipboardTable(text);
        expect(rows[0].Name).toBe('Muster GmbH; Werk 2');
        expect(rows[1].Name).toBe('Sagt "Hallo"');
    });

    it('macht leere und doppelte Überschriften eindeutig', () => {
        const { headers } = parseClipboardTable('Name\t\tName\nA\tB\tC');
        expect(headers).toEqual(['Name', 'Spalte 2', 'Name (2)']);
    });

    it('überspringt komplett leere Zeilen', () => {
        expect(parseClipboardTable('Name\tPLZ\nA\t1\n\t\nB\t2').rows).toHaveLength(2);
    });

    it('erklärt verständlich, was fehlt', () => {
        expect(() => parseClipboardTable('')).toThrow(/leer/);
        expect(() => parseClipboardTable('Name\tPLZ')).toThrow(/Überschriftenzeile/);
        expect(() => parseClipboardTable('Nur eine Spalte\nWert')).toThrow(/Spalte/);
        // nur Überschrift plus leere Restzeile bleibt „eine Zeile"
        expect(() => parseClipboardTable('Name\tPLZ\n\t')).toThrow(/nur eine Zeile/);
    });

    it('deutet nur echte Tabellen als Import', () => {
        expect(looksLikeTable(excelCopy)).toBe(true);
        expect(looksLikeTable('Bitte melde dich morgen früh beim Kunden.')).toBe(false);
        expect(looksLikeTable('Zeile eins\nZeile zwei')).toBe(false);
        expect(looksLikeTable('')).toBe(false);
    });

    it('ist im Import-Assistenten und im Dialog verdrahtet', () => {
        const wizard = readFileSync(resolve(process.cwd(), 'src/ui/importWizard.js'), 'utf8');
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        expect(wizard).toContain('parseClipboardTable');
        // Globales Strg+V nur mit Berechtigungs-Zusicherung – die aber den
        // eingefügten Inhalt danach selbst übernimmt, statt ihn zu verwerfen.
        const pasteHandler = wizard.slice(wizard.indexOf("addEventListener('paste'"), wizard.indexOf('function openPasteDialog'));
        expect(pasteHandler).toContain('withDataConsent(');
        expect(pasteHandler).toContain('usePastedTable(text)');
        expect(pasteHandler).toContain('looksLikeTable');
        expect(html).toContain('id="paste-dialog"');
        expect(html).toContain('id="btn-paste"');
    });
});

describe('Tabellen aus Chat, Wiki und Mail', () => {
    // Ein Assistent gibt selten eine nackte Tabelle aus: Er schreibt einen Satz
    // davor, formatiert als Markdown und fragt hinterher nach. Genau das kam
    // vorher mit „nur eine Spalte erkannt" zurück.
    const chatAntwort = [
        'Gerne! Hier sind Ihre drei wichtigsten Kunden:',
        '',
        '| **Kundenname** | PLZ | Ort | Umsatz |',
        '|---|---:|:--|---|',
        '| Muster Technik GmbH | 45136 | Essen | 120000 |',
        '| Beispiel Maschinenbau AG | 44135 | Dortmund | 98000 |',
        '',
        'Möchten Sie die Liste erweitern?'
    ].join('\n');

    it('liest eine Markdown-Tabelle samt Fließtext drumherum', () => {
        const { headers, rows, delimiter } = parseClipboardTable(chatAntwort);
        expect(delimiter).toBe('markdown');
        expect(headers).toEqual(['Kundenname', 'PLZ', 'Ort', 'Umsatz']);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({
            Kundenname: 'Muster Technik GmbH', PLZ: '45136', Ort: 'Essen', Umsatz: '120000'
        });
        // Der einleitende Satz darf nicht als Zeile auftauchen
        expect(rows.some((row) => String(row.Kundenname).includes('Gerne'))).toBe(false);
    });

    it('nimmt Fettschrift und Ausrichtungs-Doppelpunkte aus den Zellen', () => {
        const { headers } = parseClipboardTable(chatAntwort);
        expect(headers[0]).toBe('Kundenname');
        expect(headers.some((h) => h.includes('*') || h.includes(':'))).toBe(false);
    });

    it('schneidet auch eine CSV-Tabelle aus dem Fließtext heraus', () => {
        const text = [
            'Klar, hier die Auswertung:',
            'Kundenname;PLZ;Ort',
            'Muster GmbH;45136;Essen',
            'Beispiel AG;44135;Dortmund',
            'Soll ich noch etwas ergänzen?'
        ].join('\n');
        const { headers, rows } = parseClipboardTable(text);
        expect(headers).toEqual(['Kundenname', 'PLZ', 'Ort']);
        expect(rows).toHaveLength(2);
    });

    it('nimmt die größere Tabelle, wenn der Text mehrere enthält', () => {
        const text = [
            'Zusammenfassung:',
            'Kennzahl;Wert',
            'Summe;3',
            '',
            'Und die Kunden:',
            'Kundenname;PLZ;Ort',
            'A GmbH;45136;Essen',
            'B AG;44135;Dortmund',
            'C KG;50667;Köln'
        ].join('\n');
        const { headers, rows } = parseClipboardTable(text);
        expect(headers).toEqual(['Kundenname', 'PLZ', 'Ort']);
        expect(rows).toHaveLength(3);
    });

    it('lässt die bewährten Wege unverändert', () => {
        // Excel-Kopie: unverändert Tab-getrennt
        expect(parseClipboardTable(excelCopy).delimiter).toBe('\t');
        // Ort mit Komma zerlegt weiterhin nicht die Tabelle
        const text = 'Name\tOrt\nMuster GmbH\tEssen, Nord\nBeispiel AG\tKöln, Süd';
        expect(parseClipboardTable(text).rows[0].Ort).toBe('Essen, Nord');
    });
});

describe('Das globale Strg+V bleibt streng', () => {
    // Im Dialog hat der Nutzer sich entschieden – dort darf großzügig gelesen
    // werden. Das globale Strg+V greift ungefragt in eine fremde Absicht ein.
    it('erkennt eine Markdown-Tabelle als Tabelle', () => {
        expect(looksLikeTable('| A | B |\n|---|---|\n| 1 | 2 |')).toBe(true);
    });

    it('hält Fließtext mit Kommas heraus', () => {
        const brief = [
            'Sehr geehrte Frau Meier, wie besprochen,',
            'melde ich mich, wie vereinbart, morgen.'
        ].join('\n');
        expect(looksLikeTable(brief)).toBe(false);
    });

    it('verlangt bei Komma-Trennung eine Zeile mehr als bei Tab und Semikolon', () => {
        expect(looksLikeTable('Name,PLZ\nA,45136')).toBe(false);
        expect(looksLikeTable('Name,PLZ\nA,45136\nB,44135')).toBe(true);
        // Tabulator ist in Prosa praktisch nie zu finden – zwei Zeilen genügen
        expect(looksLikeTable('Name\tPLZ\nA\t45136')).toBe(true);
    });
});

describe('Auffindbarkeit des Einfüge-Wegs', () => {
    const wizard = readFileSync(resolve(process.cwd(), 'src/ui/importWizard.js'), 'utf8');
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    it('steht als eigener Weg im Willkommen, nicht nur im Untermenü', () => {
        expect(html).toContain('id="btn-demo-welcome-paste"');
        expect(wizard).toContain("getElementById('btn-demo-welcome-paste')");
    });

    it('führt am Schreibtisch, folgt am Handy', () => {
        const order = wizard.slice(wizard.indexOf('function applyDataWayOrder'), wizard.indexOf('function renderPasteSteps'));
        expect(order).toContain('const desktop = !mobileQuery.matches');
        expect(order).toContain('desktop ? paste : upload');
        // Beide Knöpfe kommen ohne feste Gewichtung aus dem Markup
        const ways = html.slice(html.indexOf('own-data-ways'), html.indexOf('own-data-way-hint'));
        expect(ways).not.toContain('class="primary"');
    });

    it('sagt am Handy nirgends „Strg"', () => {
        const steps = wizard.slice(wizard.indexOf('function renderPasteSteps'), wizard.indexOf('function offerPasteAfterCancel'));
        const mobileBranch = steps.slice(steps.indexOf('mobileQuery.matches'), steps.indexOf(': `<li>'));
        expect(mobileBranch).not.toMatch(/Strg|⌘/);
        expect(mobileBranch).toContain('gedrückt halten');
        // Der Desktop-Zweig darf und soll es sagen
        expect(steps).toContain('<b>Strg</b> + <b>V</b>');
    });

    it('bietet den Weg genau dann an, wenn der Datei-Dialog ohne Auswahl endet', () => {
        const offer = wizard.slice(wizard.indexOf('function offerPasteAfterCancel'), wizard.indexOf('function initPasteImport'));
        expect(offer).toContain('if (!awaitingFilePick) return;');
        // nicht am Handy, nicht zweimal, nicht über einen offenen Dialog
        expect(offer).toContain('pasteHintShown');
        expect(offer).toContain('mobileQuery.matches');
        expect(offer).toContain("document.querySelector('dialog[open]')");
        // Ein erfolgreicher Datei-Import löst ihn nicht aus
        expect(wizard).toContain('awaitingFilePick = false;\n        if (e.target.files[0]) handleFile');
    });
});
