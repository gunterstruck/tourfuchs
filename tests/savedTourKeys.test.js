import { describe, expect, it } from 'vitest';
import { autoDetectMapping, parseRows } from '../src/services/excel.js';
import { customerKey, resolveTour, stampTourKeys } from '../src/features/savedTourKeys.js';

const parse = (rows) => parseRows(rows, autoDetectMapping(Object.keys(rows[0]))).customers;
const byIdIn = (customers) => (id) => customers.find((c) => c.id === id);

// Reproduktion aus der Prüfung: zwei Standorte mit gleichem Namensanfang.
const A = { Kundenname: 'Muster GmbH Standort A', PLZ: '45127', Ort: 'Essen' };
const B = { Kundenname: 'Muster GmbH Standort B', PLZ: '50667', Ort: 'Köln' };

describe('Stabile Kunden-IDs', () => {
    it('hängen nicht an der Zeile – Umsortieren ändert die ID nicht', () => {
        const first = parse([A, B]);
        const sorted = parse([B, A]);
        const idOf = (list, name) => list.find((c) => c.name === name).id;
        expect(idOf(sorted, A.Kundenname)).toBe(idOf(first, A.Kundenname));
        expect(idOf(sorted, B.Kundenname)).toBe(idOf(first, B.Kundenname));
    });

    it('nutzen die Kundennummer, wenn es eine gibt', () => {
        const [c] = parse([{ Kundennummer: '4711', ...A }]);
        expect(c.id).toBe('k-nr:4711');
        expect(customerKey(c)).toBe('nr:4711');
    });
});

describe('Gespeicherte Touren nach Reimport', () => {
    it('Standort A bleibt Standort A – auch bei alten, zeilenbasierten IDs', () => {
        // Altbestand: IDs wie früher aus Zeile + Namensanfang
        const old = [
            { id: 'k0-Muster GmbH ', name: A.Kundenname, plz: '45127' },
            { id: 'k1-Muster GmbH ', name: B.Kundenname, plz: '50667' }
        ];
        const { tour } = stampTourKeys({ id: 't', stopIds: ['k0-Muster GmbH '], start: { lat: 1, lng: 2, label: 'Zuhause' } }, byIdIn(old));
        // Reimport, umsortiert – und, schlimmster Fall, wieder mit den alten Zeilen-IDs
        const reimported = [
            { id: 'k0-Muster GmbH ', name: B.Kundenname, plz: '50667' },
            { id: 'k1-Muster GmbH ', name: A.Kundenname, plz: '45127' }
        ];
        const resolved = resolveTour(tour, reimported);
        expect(resolved.stopIds).toEqual(['k1-Muster GmbH ']);
        expect(resolved.remapped).toBe(1);
        expect(resolved.lost).toBe(0);
    });

    it('lässt einen verschwundenen Kunden weg, statt einen falschen zu nehmen', () => {
        const old = [{ id: 'x1', name: A.Kundenname, plz: '45127' }];
        const { tour } = stampTourKeys({ id: 't', stopIds: ['x1'] }, byIdIn(old));
        const resolved = resolveTour(tour, [{ id: 'x1', name: B.Kundenname, plz: '50667' }]);
        expect(resolved.stopIds).toEqual([]);
        expect(resolved.lost).toBe(1);
    });

    it('hält Start/Ziel-Verknüpfungen richtig; Start bleibt ohne Kunden als Ort', () => {
        const old = [{ id: 'x1', name: A.Kundenname, plz: '45127' }, { id: 'x2', name: B.Kundenname, plz: '50667' }];
        const { tour } = stampTourKeys({
            id: 't', stopIds: [],
            start: { lat: 51.4, lng: 7, label: 'A', customerId: 'x1' },
            destination: { lat: 50.9, lng: 6.9, label: 'B', customerId: 'x2' }
        }, byIdIn(old));
        const resolved = resolveTour(tour, [{ id: 'x2', name: A.Kundenname, plz: '45127' }]);
        expect(resolved.start).toMatchObject({ customerId: 'x2', lat: 51.4 });
        expect(resolved.destination).toBeNull();
        const gone = resolveTour(tour, []);
        expect(gone.start).toEqual({ lat: 51.4, lng: 7, label: 'A' });
    });

    it('Alttour ohne Schlüssel verhält sich wie bisher', () => {
        const resolved = resolveTour({ stopIds: ['a', 'b'] }, [{ id: 'a', name: 'X', plz: '1' }]);
        expect(resolved).toMatchObject({ stopIds: ['a'], lost: 1, remapped: 0 });
    });

    it('stempelt vorhandene Schlüssel nicht um', () => {
        const tour = { stopIds: ['a'], stopKeys: ['nr:1'] };
        const { tour: next, changed } = stampTourKeys(tour, () => ({ nummer: '2' }));
        expect(next.stopKeys).toEqual(['nr:1']);
        expect(changed).toBe(false);
    });
});
