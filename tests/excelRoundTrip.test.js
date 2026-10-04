import { describe, expect, it } from 'vitest';
import { autoDetectMapping, customerExportRows, parseRows } from '../src/services/excel.js';

const roundTrip = (customers) => {
    const rows = customerExportRows(customers);
    const mapping = autoDetectMapping(Object.keys(rows[0]));
    return { mapping, ...parseRows(rows, mapping) };
};

const base = { id: 'a', nummer: '4711', name: 'Muster GmbH', strasse: 'Domkloster 4', plz: '50667', ort: 'Köln' };

describe('Eigener Excel-Export lässt sich verlustfrei wieder einlesen', () => {
    it('erkennt „Alle Besuche" und „Verortung" automatisch', () => {
        const { mapping } = roundTrip([{ ...base, besuche: ['2026-09-01'], lat: 50.94, lng: 6.96, geo: 'exakt' }]);
        expect(mapping.alleBesuche).toBe('Alle Besuche');
        expect(mapping.verortung).toBe('Verortung');
        expect(mapping.ort).toBe('Ort');
        expect(mapping.letzterBesuch).toBe('Letzter Besuch');
    });

    it('behält die ganze Besuchshistorie', () => {
        const { customers } = roundTrip([{ ...base, besuche: ['2026-07-03', '2026-08-14', '2026-09-30'] }]);
        expect(customers[0].besuche).toEqual(['2026-07-03', '2026-08-14', '2026-09-30']);
        expect(customers[0].extra).not.toHaveProperty('Anzahl Besuche');
        expect(customers[0].extra).not.toHaveProperty('Alle Besuche');
    });

    it('PLZ-Mitte bleibt PLZ-Mitte – und damit Kandidat für die adressgenaue Verortung', () => {
        const { customers } = roundTrip([
            { ...base, lat: 50.94, lng: 6.96, geo: 'plz' },
            { ...base, id: 'b', nummer: '4712', lat: 50.9413, lng: 6.9583, geo: 'exakt' }
        ]);
        expect(customers.map((c) => c.geo)).toEqual(['plz', 'exakt']);
        expect(customers[0].extra).not.toHaveProperty('Verortung');
    });

    it('fremde Dateien: Koordinaten ohne Verortungsspalte gelten weiter als genau', () => {
        const rows = [{ Kundenname: 'X', PLZ: '50667', Lat: '50.9', Lng: '6.9' }];
        expect(parseRows(rows, autoDetectMapping(Object.keys(rows[0]))).customers[0].geo).toBe('exakt');
    });

    it('prüft Datumswerte der Historie und meldet Unlesbares als Hinweis', () => {
        const rows = [{ Kundenname: 'X', PLZ: '50667', 'Alle Besuche': '2026-09-01; 31.02.2026; 15.09.2026; morgen' }];
        const { customers, errors } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        expect(customers[0].besuche).toEqual(['2026-09-01', '2026-09-15']);
        const visitNotes = errors.filter((e) => e.Grund.startsWith('Besuchsdatum'));
        expect(visitNotes).toHaveLength(1);
        expect(visitNotes[0]).toMatchObject({ Typ: 'Hinweis' });
        expect(visitNotes[0].Grund).toContain('31.02.2026');
        expect(visitNotes[0].Grund).toContain('morgen');
    });

    it('„Anzahl Besuche" in einer fremden Datei wird nicht als Historie gelesen', () => {
        const mapping = autoDetectMapping(['Kundenname', 'PLZ', 'Anzahl Besuche', 'Ortsteil']);
        expect(mapping.alleBesuche).toBeNull();
        expect(mapping.verortung).toBeNull();
    });
});
