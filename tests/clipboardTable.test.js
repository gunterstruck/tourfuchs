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
        // Globales Strg+V nur mit vorheriger Berechtigungs-Bestätigung
        const pasteHandler = wizard.slice(wizard.indexOf("addEventListener('paste'"), wizard.indexOf('function openPasteDialog'));
        expect(pasteHandler).toContain('hasComplianceOptIn()');
        expect(pasteHandler).toContain('looksLikeTable');
        expect(html).toContain('id="paste-dialog"');
        expect(html).toContain('id="btn-paste"');
    });
});
