import { beforeEach, describe, expect, it } from 'vitest';
import { FIELDS, autoDetectMapping, parseRows, customerExportRows } from '../src/services/excel.js';
import { state, setCustomers, visibleCustomers, datasetSnapshot, filterDimensionDefs, DIMENSIONS } from '../src/core/state.js';

beforeEach(() => {
    state.dims = {};
    state.filters.revenue = { enabled: false, min: null, max: null };
});

describe('Kundentyp vom Import bis zum Filter', () => {
    it.each(['Kundentyp', 'Kundenart', 'Customer Type', 'Account Type'])('erkennt %s ohne Verwechslung mit Name oder Vertriebsgruppe', (header) => {
        const mapping = autoDetectMapping([header, 'Kundenname', 'PLZ', 'Vertriebsgruppe']);
        expect(mapping.kundentyp).toBe(header);
        expect(mapping.name).toBe('Kundenname');
        expect(mapping.gruppe).toBe('Vertriebsgruppe');
        expect(FIELDS.find(f => f.key === 'kundentyp').required).toBe(false);
    });

    it('reserviert den expliziten Typ auch ohne erkannte Namensspalte', () => {
        expect(autoDetectMapping(['Kundentyp', 'PLZ'])).toMatchObject({ kundentyp: 'Kundentyp', name: null });
    });

    it('filtert Kategorien einschließlich leerer Werte und kombiniert sie mit Bezirk und Umsatz', () => {
        const rows = [
            { Kundenname: 'A', PLZ: '44135', Kundentyp: ' Endkunde ', Vertriebsbezirk: 'West', Umsatz: 200 },
            { Kundenname: 'B', PLZ: '44135', Kundentyp: 'Partner', Vertriebsbezirk: 'West', Umsatz: 5 },
            { Kundenname: 'C', PLZ: '44135', Kundentyp: '', Vertriebsbezirk: 'Ost', Umsatz: 100 },
        ];
        const { customers } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        expect(customers.map(c => c.kundentyp)).toEqual(['Endkunde', 'Partner', '']);
        expect(customers[0].extra).not.toHaveProperty('Kundentyp');
        setCustomers(customers);
        expect(state.dims.kundentyp.active).toBe(true);
        state.dims.kundentyp.values.get('Partner').visible = false;
        expect(visibleCustomers().map(c => c.name)).toEqual(['A', 'C']);
        state.dims.bezirk.values.get('Ost').visible = false;
        expect(visibleCustomers().map(c => c.name)).toEqual(['A']);
        state.filters.revenue = { enabled: true, min: 300, max: null };
        expect(visibleCustomers()).toEqual([]);
        expect(datasetSnapshot().customers[0].kundentyp).toBe('Endkunde');
        expect(DIMENSIONS.some(d => d.id === 'kundentyp')).toBe(false);
    });

    it('erscheint bereits bei einer einzigen Kategorie, aber nicht bei vollständig leeren Typen', () => {
        setCustomers([{ id: 'a', name: 'A', kundentyp: '1' }]);
        expect(state.dims.kundentyp.active).toBe(true);
        expect(filterDimensionDefs().some(d => d.id === 'kundentyp')).toBe(true);
        setCustomers([{ id: 'b', name: 'B', kundentyp: '  ' }]);
        expect(state.dims.kundentyp.active).toBe(false);
    });

    it('erhält Kundentyp beim Excel-Export und Wiederimport', () => {
        const rows = customerExportRows([{ id: 'a', name: 'A', plz: '44135', kundentyp: 'Partner' }]);
        expect(rows[0].Kundentyp).toBe('Partner');
        expect(parseRows(rows, autoDetectMapping(Object.keys(rows[0]))).customers[0].kundentyp).toBe('Partner');
    });
});
