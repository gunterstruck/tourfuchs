import { afterEach, describe, expect, it, vi } from 'vitest';
import { autoDetectMapping, customerExportRows, parseRows } from '../src/services/excel.js';
import { lastVisit, markVisitedToday } from '../src/features/visits.js';

afterEach(() => vi.useRealTimers());

const roundTrip = (customers) => {
    const rows = customerExportRows(customers);
    return parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
};

describe('Weitere Ansprechpartner überstehen Export und Wiederimport', () => {
    it('Anna bleibt Hauptkontakt, Bernd und Clara kommen als Kontakte zurück', () => {
        const kunde = {
            id: 'a', nummer: '100', name: 'Muster GmbH', plz: '45127',
            ansprechpartner: 'Anna', telefon: '0201 1', email: 'anna@muster.de',
            contacts: [
                { id: 'c1', name: 'Anna', telefon: '0201 1', email: 'anna@muster.de', primary: true },
                { id: 'c2', name: 'Bernd Kurz', telefon: '0201 2', email: '', primary: false },
                { id: 'c3', name: 'Clara', telefon: '', email: 'clara@muster.de', primary: false }
            ]
        };
        const { customers } = roundTrip([kunde]);
        const back = customers[0];
        expect(back.contacts.map((c) => [c.name, c.telefon, c.email, c.primary])).toEqual([
            ['Anna', '0201 1', 'anna@muster.de', true],
            ['Bernd Kurz', '0201 2', '', false],
            ['Clara', '', 'clara@muster.de', false]
        ]);
        expect(back.ansprechpartner).toBe('Anna');
        expect(back.extra).not.toHaveProperty('Weitere Ansprechpartner');
        expect(new Set(back.contacts.map((c) => c.id)).size).toBe(3);
    });
});

describe('Besuchsdaten bleiben sortiert und ohne Zukunft', () => {
    it('„Heute besucht" prüft die ganze Historie und sortiert', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-04T10:00:00'));
        const kunde = { besuche: ['2026-10-04', '2026-10-05', '2026-09-01'] };
        markVisitedToday(kunde);
        expect(kunde.besuche).toEqual(['2026-09-01', '2026-10-04', '2026-10-05']);
    });

    it('lastVisit liefert das späteste Datum auch bei unsortiertem Altbestand', () => {
        expect(lastVisit({ besuche: ['2026-10-01', '2026-08-01'] })).toBe('2026-10-01');
        expect(lastVisit({ besuche: [] })).toBeNull();
    });

    it('der Import übernimmt keine Besuche aus der Zukunft und meldet sie', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-04T10:00:00'));
        const rows = [{ Kundenname: 'X', PLZ: '45127', 'Alle Besuche': '2026-10-04; 2026-10-05', 'Letzter Besuch': '2026-10-05' }];
        const { customers, errors } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        expect(customers[0].besuche).toEqual(['2026-10-04']);
        expect(errors.some((e) => e.Typ === 'Hinweis' && e.Grund.includes('in der Zukunft') && e.Grund.includes('2026-10-05'))).toBe(true);
    });
});
