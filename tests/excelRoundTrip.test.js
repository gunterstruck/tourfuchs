import { describe, expect, it } from 'vitest';
import { autoDetectMapping, parseRows } from '../src/services/excel.js';

/**
 * Den Excel-Export gibt es seit 24.10.2026 nicht mehr (Kundendaten verlassen
 * TourFuchs nur verschlüsselt). Früher exportierte Dateien liegen aber noch
 * bei Nutzern – sie müssen sich weiter verlustfrei einlesen lassen.
 */
const readBack = (rows) => {
    const mapping = autoDetectMapping(Object.keys(rows[0]));
    return { mapping, ...parseRows(rows, mapping) };
};

// Eine Zeile im Format des früheren Exports (Spalten wie damals).
const oldExport = (overrides = {}) => ({
    'Datenstatus': '', 'Kundennummer': '4711', 'Kundenname': 'Muster GmbH', 'Straße': 'Domkloster 4',
    'PLZ': '50667', 'Ort': 'Köln', 'Vertriebsbeauftragter': '', 'Vertriebschannel': '', 'Vertriebsgruppe': '',
    'Vertriebsbezirk': '', 'Kundentyp': '', 'Hauptansprechpartner': '', 'Telefon': '', 'E-Mail': '', 'Umsatz': '',
    'Besuchsrhythmus (Wochen)': '', 'Letzter Besuch': '', 'Lat': '', 'Lng': '', 'Verortung': 'nicht verortet',
    'Anzahl Besuche': 0, 'Alle Besuche': '', 'Weitere Ansprechpartner': '', ...overrides
});

describe('Früher exportierte TourFuchs-Dateien lassen sich weiter verlustfrei einlesen', () => {
    it('erkennt „Alle Besuche" und „Verortung" automatisch', () => {
        const { mapping } = readBack([oldExport({ 'Letzter Besuch': '2026-09-01', Lat: 50.94, Lng: 6.96, Verortung: 'adressgenau', 'Anzahl Besuche': 1, 'Alle Besuche': '2026-09-01' })]);
        expect(mapping.alleBesuche).toBe('Alle Besuche');
        expect(mapping.verortung).toBe('Verortung');
        expect(mapping.ort).toBe('Ort');
        expect(mapping.letzterBesuch).toBe('Letzter Besuch');
    });

    it('behält die ganze Besuchshistorie', () => {
        const { customers } = readBack([oldExport({ 'Letzter Besuch': '2026-09-30', 'Anzahl Besuche': 3, 'Alle Besuche': '2026-07-03; 2026-08-14; 2026-09-30' })]);
        expect(customers[0].besuche).toEqual(['2026-07-03', '2026-08-14', '2026-09-30']);
        expect(customers[0].extra).not.toHaveProperty('Anzahl Besuche');
        expect(customers[0].extra).not.toHaveProperty('Alle Besuche');
    });

    it('PLZ-Mitte bleibt PLZ-Mitte – und damit Kandidat für die adressgenaue Verortung', () => {
        const { customers } = readBack([
            oldExport({ Lat: 50.94, Lng: 6.96, Verortung: 'PLZ-Mitte' }),
            oldExport({ Kundennummer: '4712', Lat: 50.9413, Lng: 6.9583, Verortung: 'adressgenau' })
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
