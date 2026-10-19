import { describe, expect, it } from 'vitest';
import { autoDetectMapping, parseRows } from '../src/services/excel.js';
import { isPromotorColumn, promotorColumns, PROMOTOR_COLUMN_SOURCE } from '../src/features/promotorColumns.js';
import { mergeWithPrevious } from '../src/features/importMerge.js';
import { customerContactGroups, promotorNames, promotorTopics } from '../src/features/customerContacts.js';

const parse = (rows) => {
    const headers = Object.keys(rows[0]);
    const mapping = autoDetectMapping(headers);
    return { mapping, headers, ...parseRows(rows, mapping) };
};

describe('Promotoren als nummerierte Spalten (Promotor N / Promotor N TPE-Thema)', () => {
    it('erkennt die Schreibweisen und ordnet Name und TPE-Thema paarweise zu', () => {
        const headers = ['Kundenname', 'Promotor 1', 'Promotor 1 TPE-Thema', 'Promotor_2_Name', 'Promotor_2_TPE-Thema',
            'Promotor 10', 'Promotor 3 Bereich', 'Promotoren', 'Promotor', 'Thema'];
        expect(promotorColumns(headers)).toEqual([
            { n: 1, name: 'Promotor 1', thema: 'Promotor 1 TPE-Thema' },
            { n: 2, name: 'Promotor_2_Name', thema: 'Promotor_2_TPE-Thema' },
            { n: 10, name: 'Promotor 10', thema: null }
        ]);
        expect(isPromotorColumn('Promotor 3 Bereich')).toBe(true);
        // Bestehende Spalten bleiben, was sie sind.
        for (const header of ['Promotoren', 'Promotor', 'Thema', 'Kundenname']) expect(isPromotorColumn(header)).toBe(false);
    });

    it('macht aus einer Kundenzeile Promotoren mit TPE-Thema – ohne Kontaktlisten-Erkennung auszulösen', () => {
        const { mapping, customers } = parse([{
            Kundennummer: '1596596', Kundenname: 'SCIO Automation', PLZ: '47051', VK: 'Boehlen Lara',
            'Promotor 1': 'Eva Ost', 'Promotor 1 TPE-Thema': 'TPE Antriebe',
            'Promotor 2': 'Jan Nord', 'Promotor 2 TPE-Thema': 'TPE Automatisierung',
            'Promotor 3': '', 'Promotor 3 TPE-Thema': ''
        }]);
        // „TPE-Thema" enthält „thema" – darf trotzdem nicht als Kontaktlisten-Feld zählen.
        expect(mapping.thema).toBeNull();
        expect(mapping.name).toBe('Kundenname');
        const [customer] = customers;
        expect(customer.name).toBe('SCIO Automation');
        expect(Object.keys(customer.extra)).toEqual(['VK']);
        const { promotors } = customerContactGroups(customer);
        expect(promotors.map((p) => [p.name, p.thema])).toEqual([['Eva Ost', 'TPE Antriebe'], ['Jan Nord', 'TPE Automatisierung']]);
        expect(customer.contacts.every((c) => c.quelle === PROMOTOR_COLUMN_SOURCE && !c.primary)).toBe(true);
        expect(promotorNames(customer)).toEqual(['Eva Ost', 'Jan Nord']);
        expect(promotorTopics(customer)).toEqual(['TPE Antriebe', 'TPE Automatisierung']);
    });

    it('erlaubt denselben Promotor für mehrere TPE-Themen mit eigenen IDs', () => {
        const { customers } = parse([{
            Kundennummer: '1', Kundenname: 'A', PLZ: '45127',
            'Promotor 1': 'Eva Ost', 'Promotor 1 TPE-Thema': 'TPE Antriebe',
            'Promotor 2': 'Eva Ost', 'Promotor 2 TPE-Thema': 'TPE Software'
        }]);
        const ids = customers[0].contacts.map((c) => c.id);
        expect(new Set(ids).size).toBe(2);
        expect(promotorNames(customers[0])).toEqual(['Eva Ost']);
    });

    it('Reimport mit Promotor-Spalten ersetzt die alten Spalten-Promotoren, andere Kontakte bleiben', () => {
        const old = parse([{
            Kundennummer: '1', Kundenname: 'A', PLZ: '45127', Ansprechpartner: 'Kai Kunde',
            'Promotor 1': 'Eva Ost', 'Promotor 1 TPE-Thema': 'TPE Antriebe'
        }]).customers;
        // Promotor aus einer separaten Kontaktliste
        old[0].contacts.push({ id: 'ct-1-x', art: 'promotor', name: 'Lisa Liste', thema: 'Messe', kontaktliste: true });

        const next = parse([{
            Kundennummer: '1', Kundenname: 'A', PLZ: '45127',
            'Promotor 1': 'Jan Nord', 'Promotor 1 TPE-Thema': 'TPE Antriebe'
        }]);
        mergeWithPrevious(old, next.customers, { mapping: next.mapping, headers: next.headers });
        const names = next.customers[0].contacts.map((c) => c.name).sort();
        expect(names).toEqual(['Jan Nord', 'Kai Kunde', 'Lisa Liste']);
    });

    it('Reimport ohne Promotor-Spalten (z. B. Kundenstamm) lässt sie stehen', () => {
        const old = parse([{
            Kundennummer: '1', Kundenname: 'A', PLZ: '45127',
            'Promotor 1': 'Eva Ost', 'Promotor 1 TPE-Thema': 'TPE Antriebe'
        }]).customers;
        const next = parse([{ Kundennummer: '1', Kundenname: 'A', PLZ: '45127', Ort: 'Essen' }]);
        mergeWithPrevious(old, next.customers, { mapping: next.mapping, headers: next.headers });
        expect(promotorNames(next.customers[0])).toEqual(['Eva Ost']);

        // Auch wenn die neue Datei eigene Ansprechpartner mitbringt.
        const withContact = parse([{ Kundennummer: '1', Kundenname: 'A', PLZ: '45127', Ansprechpartner: 'Kai Kunde' }]);
        mergeWithPrevious(old, withContact.customers, { mapping: withContact.mapping, headers: withContact.headers });
        expect(promotorNames(withContact.customers[0])).toEqual(['Eva Ost']);
    });

    it('leert die Spalten-Promotoren, wenn die Datei die Spalten führt, aber leer lässt', () => {
        const old = parse([{
            Kundennummer: '1', Kundenname: 'A', PLZ: '45127',
            'Promotor 1': 'Eva Ost', 'Promotor 1 TPE-Thema': 'TPE Antriebe'
        }]).customers;
        const next = parse([{ Kundennummer: '1', Kundenname: 'A', PLZ: '45127', 'Promotor 1': '', 'Promotor 1 TPE-Thema': '' }]);
        mergeWithPrevious(old, next.customers, { mapping: next.mapping, headers: next.headers });
        expect(promotorNames(next.customers[0])).toEqual([]);
    });
});
