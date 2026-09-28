import { describe, expect, it } from 'vitest';
import { customerExportRows, autoDetectMapping } from '../src/services/excel.js';

const base = {
    id: 'k1', nummer: '4711', name: 'Alpha GmbH', strasse: 'Hauptstr. 1', plz: '45127', ort: 'Essen',
    vb: 'Anna', gruppe: 'Nord', bezirk: 'West', umsatz: 1000, rhythmusWochen: 6
};

describe('Excel-Export: alle Spalten', () => {
    it('nimmt jede Originalspalte der Importdatei mit – auch wenn nur einzelne Kunden sie haben', () => {
        const rows = customerExportRows([
            { ...base, extra: { 'Branche intern': 'Maschinenbau', 'CRM-ID': 'A-1' } },
            { ...base, id: 'k2', nummer: '4712', extra: { 'Notiz Innendienst': 'Rückruf' } }
        ]);
        for (const row of rows) {
            expect(Object.keys(row)).toEqual(expect.arrayContaining(['Branche intern', 'CRM-ID', 'Notiz Innendienst']));
        }
        expect(rows[0]['CRM-ID']).toBe('A-1');
        expect(rows[1]['Notiz Innendienst']).toBe('Rückruf');
        expect(rows[1]['CRM-ID']).toBe('');
    });

    it('überschreibt keine TourFuchs-Spalte mit einer gleichnamigen Originalspalte', () => {
        const [row] = customerExportRows([{ ...base, extra: { Umsatz: 'alt' } }]);
        expect(row.Umsatz).toBe(1000);
        expect(row['Umsatz (Original)']).toBe('alt');
    });

    it('exportiert die ganze Besuchshistorie, die Verortung und weitere Ansprechpartner', () => {
        const [row] = customerExportRows([{
            ...base,
            lat: 51.45, lng: 7.01, geo: 'exakt',
            besuche: ['2026-09-01', '2026-03-10', '2026-06-15'],
            contacts: [
                { id: 'c1', name: 'Frau Haupt', primary: true },
                { id: 'c2', name: 'Herr Technik', telefon: '0201 1', email: 't@x.de', primary: false }
            ]
        }]);
        expect(row['Letzter Besuch']).toBe('2026-09-01');
        expect(row['Alle Besuche']).toBe('2026-03-10; 2026-06-15; 2026-09-01');
        expect(row['Anzahl Besuche']).toBe(3);
        expect(row.Verortung).toBe('adressgenau');
        expect(row.Lat).toBe(51.45);
        expect(row['Weitere Ansprechpartner']).toBe('Herr Technik · 0201 1 · t@x.de');
        const [plz] = customerExportRows([{ ...base, lat: 51.4, lng: 7, geo: 'plz' }]);
        expect(plz.Verortung).toBe('PLZ-Mitte');
    });

    it('lässt sich wieder einlesen: die Kernspalten werden erkannt', () => {
        const headers = Object.keys(customerExportRows([{ ...base, extra: {} }])[0]);
        const mapping = autoDetectMapping(headers);
        expect(mapping.name).toBe('Kundenname');
        expect(mapping.nummer).toBe('Kundennummer');
        expect(mapping.plz).toBe('PLZ');
        expect(mapping.ansprechpartner).toBe('Hauptansprechpartner');
        expect(mapping.letzterBesuch).toBe('Letzter Besuch');
        expect(mapping.lat).toBe('Lat');
    });
});
