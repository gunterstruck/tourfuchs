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

describe('CSV-Trennzeichen zählt nur außerhalb von Anführungszeichen', () => {
    // Externer Prüfbericht, P2: Gezählt wurde über den ganzen Kopf. Ein gültiger
    // Semikolon-CSV mit einem Feldnamen wie "Gebiet, Kreis, Region" brachte mehr
    // Kommas als Semikolons mit – das Komma gewann, die Datei wurde falsch gelesen.
    const excel = readFileSync(resolve(process.cwd(), 'src/services/excel.js'), 'utf8');
    const zaehler = new Function(`${excel.slice(excel.indexOf('function countOutsideQuotes'), excel.indexOf('export async function readWorkbook'))}; return countOutsideQuotes;`)();
    const trennzeichen = (zeile) => [';', ',', '\t'].reduce(
        (best, c) => (zaehler(zeile, c) > zaehler(zeile, best) ? c : best), ';'
    );

    it('lässt sich von Kommas in zitierten Feldnamen nicht täuschen', () => {
        expect(trennzeichen('Kunde;"Gebiet, Kreis, Region, Zone"')).toBe(';');
        expect(trennzeichen('Kunde;"Ort, Kreis";PLZ')).toBe(';');
    });

    it('erkennt die einfachen Fälle unverändert', () => {
        expect(trennzeichen('Kunde;PLZ;Ort')).toBe(';');
        expect(trennzeichen('Kunde,PLZ,Ort')).toBe(',');
        expect(trennzeichen('Kunde\tPLZ\tOrt')).toBe('\t');
    });

    it('behandelt verdoppelte Anführungszeichen als Text', () => {
        expect(zaehler('a;"b""c";d', ';')).toBe(2);
    });
});
