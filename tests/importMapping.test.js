import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Import-Assistent: wichtige Felder zuerst, optionale auf Abruf (Konzept A)', () => {
    const html = read('index.html');
    const wiz = read('src/ui/importWizard.js');

    it('trennt Zuordnung in Haupt- und optionale Felder (eingeklapptes <details>)', () => {
        expect(html).toContain('<tbody id="mapping-rows"></tbody>');
        expect(html).toContain('<details id="mapping-more"');
        expect(html).toContain('<tbody id="mapping-rows-optional"></tbody>');
        expect(html).toContain('id="mapping-more-count"');
    });

    it('rendert die wichtigen Felder oben, den Rest in den optionalen Block', () => {
        expect(wiz).toContain("const IMPORTANT = new Set(['name', 'plz', 'strasse', 'ort', 'bezirk', 'gruppe', 'umsatz'])");
        expect(wiz).toContain("FIELDS.filter((f) => IMPORTANT.has(f.key))");
        expect(wiz).toContain("FIELDS.filter((f) => !IMPORTANT.has(f.key))");
        expect(wiz).toContain("getElementById('mapping-rows-optional')");
        // Kurzstatus: wie viele optionale Felder automatisch erkannt wurden.
        expect(wiz).toContain('automatisch erkannt');
        // Standardmäßig eingeklappt (Überblick zuerst).
        expect(wiz).toContain('moreDetails.open = false');
    });

    it('liest beim Import weiterhin ALLE Felder (Haupt + optional)', () => {
        // Kein Feld darf verloren gehen, nur weil es eingeklappt ist.
        expect(wiz).toContain("document.querySelectorAll('#import-dialog select[data-field]')");
        expect(wiz).not.toContain("document.querySelectorAll('#mapping-rows select')");
    });
});
