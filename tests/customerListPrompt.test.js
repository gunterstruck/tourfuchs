import { describe, expect, it } from 'vitest';
import { buildCustomerListPrompt, CUSTOMER_LIST_COLUMNS } from '../src/features/customerListPrompt.js';
import { autoDetectMapping, FIELDS } from '../src/services/excel.js';
import { parseClipboardTable } from '../src/services/clipboardTable.js';

describe('Kundenliste von der Firmen-KI', () => {
    it('jede erbetene Überschrift trifft genau ein TourFuchs-Feld', () => {
        const headers = CUSTOMER_LIST_COLUMNS.map((c) => c.header);
        const mapping = autoDetectMapping(headers);
        const mapped = Object.values(mapping).filter(Boolean);
        expect(new Set(mapped).size).toBe(headers.length);
        expect(mapped.sort()).toEqual([...headers].sort());
        for (const field of FIELDS.filter((f) => f.required)) {
            expect(mapping[field.key], field.key).toBeTruthy();
        }
        expect(mapping.name).toBe('Kundenname');
        expect(mapping.vb).toBe('Vertriebsbeauftragter');
        expect(mapping.ansprechpartner).toBe('Hauptansprechpartner');
        expect(mapping.rhythmusWochen).toBe('Besuchsrhythmus');
        expect(mapping.letzterBesuch).toBe('Letzter Besuch');
    });

    it('der Prompt nennt alle Überschriften und die harten Regeln', () => {
        const prompt = buildCustomerListPrompt();
        for (const { header } of CUSTOMER_LIST_COLUMNS) expect(prompt).toContain(`- ${header}`);
        expect(prompt).toMatch(/Erfinde nichts/);
        expect(prompt).toMatch(/keinen Zugriff/);
        expect(prompt).toMatch(/Quellen/);
        expect(prompt).toMatch(/die mir als Vertriebsmitarbeiter zugeordnet sind/);
    });

    it('eine so gebaute Tabelle läuft durch das Einfügen', () => {
        const headers = CUSTOMER_LIST_COLUMNS.map((c) => c.header);
        const row = ['4711', 'Muster GmbH', 'Hauptstr. 1', '45136', 'Essen', 'Eva Beispiel', 'West',
            'Max Muster', '0201 123', 'max@muster.de', '125000', '6', '12.09.2026'];
        const table = parseClipboardTable(`${headers.join('\t')}\n${row.join('\t')}`);
        expect(table.headers).toEqual(headers);
        expect(table.rows).toHaveLength(1);
    });

    it('auch die Chat-Antwort mit Markdown-Tabelle und Begleittext läuft durch', () => {
        const headers = CUSTOMER_LIST_COLUMNS.map((c) => c.header);
        const line = (cells) => `| ${cells.join(' | ')} |`;
        const answer = [
            'Gerne, hier ist deine Kundenliste:', '',
            line(headers), line(headers.map(() => '---')),
            line(['4711', 'Muster GmbH', 'Hauptstr. 1', '45136', 'Essen', '', '', '', '', '', '', '', '']),
            line(['4712', 'Beispiel AG', '', '44135', 'Dortmund', '', '', '', '', '', '', '', '']),
            '', 'Quellen: CRM-Export Q3/2026.'
        ].join('\n');
        const table = parseClipboardTable(answer);
        expect(table.headers).toEqual(headers);
        expect(table.rows).toHaveLength(2);
        expect(autoDetectMapping(table.headers).plz).toBe('PLZ');
    });
});

describe('Einstieg im Dialog „Eigene Daten laden"', () => {
    it('liegt als dritter, leiser Weg in der Listen-Option und führt in Einfügen oder Datei', async () => {
        const { readFileSync } = await import('node:fs');
        const html = readFileSync('index.html', 'utf8');
        const ownData = html.slice(html.indexOf('id="own-data-dialog"'), html.indexOf('</dialog>', html.indexOf('id="own-data-dialog"')));
        expect(ownData).toMatch(/id="btn-ki-list"[^>]*class="linklike"/);
        const ki = html.slice(html.indexOf('id="ki-list-dialog"'), html.indexOf('</dialog>', html.indexOf('id="ki-list-dialog"')));
        for (const id of ['ki-list-prompt', 'ki-list-assistant', 'ki-list-launch', 'ki-list-paste', 'ki-list-file']) {
            expect(ki).toContain(`id="${id}"`);
        }
        const wizard = readFileSync('src/ui/importWizard.js', 'utf8');
        expect(wizard).toMatch(/ki-list-paste[\s\S]{0,120}openPasteDialog\(\)/);
        expect(wizard).toMatch(/ki-list-file[\s\S]{0,120}openFilePicker\(\)/);
    });
});
