import { describe, expect, it } from 'vitest';
import { attachContacts, autoDetectMapping, parseRows } from '../src/services/excel.js';
import { customerKey, diffCustomerDatasets } from '../src/features/datasetDiff.js';
import { customerKey as tourKey } from '../src/features/savedTourKeys.js';

// Kontaktdatei: nur Kundennummer + Kontakt, Zeile 2 ist die erste Datenzeile.
const contactFile = (name, telefon) => {
    const rows = [{ Kundennummer: '100', Ansprechpartner: name, Telefon: telefon, 'Primärkontakt?': 'ja' }];
    return parseRows(rows, autoDetectMapping(Object.keys(rows[0]))).contactRows;
};

describe('Kontakt-IDs hängen nicht an der Excel-Zeile', () => {
    it('Anna (Import 1, Zeile 2) und Bernd (Import 2, Zeile 2): Bernd wird Hauptkontakt', () => {
        const customer = { id: 'k-nr:100', nummer: '100', name: 'Kunde 100', plz: '45127' };
        attachContacts([customer], contactFile('Anna', '0201 1'));
        attachContacts([customer], contactFile('Bernd', '0201 2'));
        const ids = customer.contacts.map((c) => c.id);
        expect(new Set(ids).size).toBe(2);
        expect(customer.contacts.filter((c) => c.primary).map((c) => c.name)).toEqual(['Bernd']);
        expect(customer.ansprechpartner).toBe('Bernd');
        expect(customer.primaryContactId).toBe(customer.contacts.find((c) => c.name === 'Bernd').id);
    });

    it('Altbestand mit doppelten IDs: trotzdem genau ein Hauptkontakt, IDs werden eindeutig', () => {
        const customer = {
            nummer: '100',
            contacts: [{ id: 'ct-100-2', name: 'Anna', telefon: '', email: '', primary: true }],
            primaryContactId: 'ct-100-2'
        };
        const rows = contactFile('Bernd', '0201 2').map((c) => ({ ...c, id: 'ct-100-2' })); // alte ID-Regel nachgestellt
        attachContacts([customer], rows);
        expect(customer.contacts.filter((c) => c.primary).map((c) => c.name)).toEqual(['Bernd']);
        expect(new Set(customer.contacts.map((c) => c.id)).size).toBe(2);
        expect(customer.ansprechpartner).toBe('Bernd');
    });

    it('eine spätere Zeile ohne Markierung nimmt dem Hauptkontakt die Rolle nicht', () => {
        const customer = { nummer: '100' };
        attachContacts([customer], contactFile('Anna', '0201 1'));
        const plain = contactFile('Anna', '0201 1').map((c) => ({ ...c, primary: false }));
        attachContacts([customer], plain);
        expect(customer.contacts).toHaveLength(1);
        expect(customer.contacts[0].primary).toBe(true);
    });
});

describe('Änderungsbericht nutzt die Identitätsregel des Imports', () => {
    it('AB12 und ab12 bleiben zwei Kunden – unveränderter Reimport meldet nichts', () => {
        const list = [
            { nummer: 'AB12', name: 'Groß', plz: '1' },
            { nummer: 'ab12', name: 'Klein', plz: '2' }
        ];
        const diff = diffCustomerDatasets(list, list.map((c) => ({ ...c })));
        expect(diff.added).toEqual([]);
        expect(diff.removed).toEqual([]);
        expect(diff.hasChanges).toBe(false);
    });

    it('gleich mit gespeicherten Touren und Import-IDs', () => {
        const parsed = parseRows([{ Kundennummer: 'AB12', Kundenname: 'X', PLZ: '45127' }], autoDetectMapping(['Kundennummer', 'Kundenname', 'PLZ'])).customers[0];
        expect(customerKey(parsed)).toBe(tourKey(parsed));
        expect(parsed.id).toBe(`k-${customerKey(parsed)}`);
    });
});
