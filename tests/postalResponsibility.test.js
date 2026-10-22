import { describe, expect, it } from 'vitest';
import { accountManager, isPostalQuery, postalResponsibility, teamsChatUrl } from '../src/features/postalResponsibility.js';
import { customerFocusText, responsibilityResultsHtml } from '../src/ui/postalResponsibility.js';
import { autoDetectMapping } from '../src/services/excel.js';
import { salesMainMapping } from '../src/features/salesWorkbook.js';

const customers = [
    { id: 'a', plz: '01067', bezirk: 'Dresden', vb: 'Eva 0171 1234567', umsatz: 100, umsatzJahre: { 2026: 100 } },
    { id: 'b', plz: '01069', bezirk: 'Dresden', vb: 'Eva 0171 1234567', umsatz: 0 },
    { id: 'c', plz: '01099', bezirk: 'Elbe', vb: 'Jan', umsatz: null },
    { id: 'd', plz: '01100', bezirk: 'Andere', umsatz: 9000 }
];
describe('PLZ-Zuständigkeit', () => {
    it('uses customer types retained in historical workbooks and maps them in new imports', () => {
        expect(salesMainMapping(['Kundenart']).kundentyp).toBe('Kundenart');
        expect(salesMainMapping(['Kundentyp', 'Kundenart']).kundentyp).toBe('Kundentyp');
        const stock = [
            { id: '1', plz: '45127', bezirk: 'X', extra: { Kundenart: 'Partner' } },
            { id: '2', plz: '45128', bezirk: 'X', kundentyp: 'Endkunde', extra: { Kundenart: 'Partner' } }
        ];
        expect(postalResponsibility(stock, '451').groups[0].profile.top).toEqual([{ name: 'Endkunde', count: 1 }, { name: 'Partner', count: 1 }]);
    });
    it('separates sales groups and uses the entire district stock for customer focus', () => {
        const stock = [
            { id: '1', plz: '45127', bezirk: 'HxMx', gruppe: 'Maschinenbau', kundentyp: 'Partner', vb: 'Eva' },
            { id: '2', plz: '01067', bezirk: 'HxMx', gruppe: 'Maschinenbau', kundentyp: 'Endkunde', vb: 'Jan' },
            { id: '3', plz: '', bezirk: 'HxMx', gruppe: 'Maschinenbau', kundentyp: 'Endkunde' },
            { id: '4', plz: '45127', bezirk: 'HxMx', gruppe: 'Handel', kundentyp: 'Fachhändler' },
            { id: '5', plz: '45128', bezirk: 'HxMx', gruppe: 'Maschinenbau' }
        ];
        const result = postalResponsibility([...stock, stock[0]], '451');
        expect(result.count).toBe(3);
        const group = result.groups.find((g) => g.salesGroup === 'Maschinenbau' && g.manager.name === 'Eva');
        expect(group.profile).toEqual({ count: 4, missing: 1, top: [{ name: 'Endkunde', count: 2 }] });
        expect(customerFocusText(group.profile)).toBe('Endkunde (2/4 Kunden · 50 %) · 1 ohne Kundentyp');
        const html = responsibilityResultsHtml(result);
        expect(html).toContain('Vertriebsgruppe: <b>Maschinenbau</b>');
        expect(html).toContain('Häufigste Kundenart im VBZ');
        expect(html).toContain('Fachhändler (1/1 Kunden · 100 %)');
    });
    it('shows ties and missing data honestly, without decoding company-specific district codes', () => {
        const stock = ['Partner', 'Endkunde', ' partner ', 'Endkunde', ''].map((kundentyp, i) => ({ id: String(i), plz: '45127', bezirk: 'HxPx', kundentyp }));
        const group = postalResponsibility(stock, '45127').groups[0];
        expect(group.profile.top).toEqual([{ name: 'Endkunde', count: 2 }, { name: 'Partner', count: 2 }]);
        expect(customerFocusText(group.profile)).toContain('Gleichstand · 1 ohne Kundentyp');
        expect(responsibilityResultsHtml(postalResponsibility(stock, '451'))).not.toContain('ISL');
        expect(customerFocusText(postalResponsibility([{ id: 'x', plz: '45127', bezirk: 'X' }], '451').groups[0].profile)).toContain('Nicht hinterlegt');
        expect(customerFocusText(postalResponsibility([{ id: 'x', plz: '45127', kundentyp: 'Partner' }], '451').groups[0].profile)).toContain('Vertriebsbezirk fehlt');
    });
    it('does not import employee phone or email as customer contact fields', () => {
        const mapping = autoDetectMapping(['Kundenname', 'PLZ', 'Account Manager Telefon', 'Account Manager Email', 'VB Telefon', 'VB Email']);
        expect(mapping.telefon).toBeNull();
        expect(mapping.email).toBeNull();
        expect(mapping.name).toBe('Kundenname');
    });
    it('starts at three digits and retains leading zeroes; rejects invalid input', () => {
        for (const value of ['01', '010670', 'abc', '010*']) expect(isPostalQuery(value)).toBe(false);
        expect(postalResponsibility(customers, '010').count).toBe(3);
        expect(postalResponsibility(customers, '0106').count).toBe(2);
        expect(postalResponsibility(customers, '01067').count).toBe(1);
        expect(postalResponsibility(customers, '010').revenue).toBe(100);
        expect(postalResponsibility(customers, '010').missingRevenue).toBe(1);
        expect(postalResponsibility(customers, '999').groups).toEqual([]);
    });
    it('counts a record once and groups by district and manager, not by revenue rank', () => {
        const result = postalResponsibility([...customers, customers[0]], '010');
        expect(result.count).toBe(3);
        expect(result.groups.map((g) => [g.district, g.count])).toEqual([['Dresden', 2], ['Elbe', 1]]);
        expect(result.unknownYear).toBe(true);
        expect(result.years).toEqual([2026]);
    });
    it('keeps explicit overlapping territory rules separate, including areas without customers', () => {
        const territories = { 'plz2:plz-01': { bezirk: 'Nord' }, 'plz5:plz-01067': { bezirk: 'Spezial' }, 'plz3:plz-451': { bezirk: 'West' }, 'kreise:01067': { bezirk: 'Kreis' } };
        expect(postalResponsibility([], '010', territories).assignments).toEqual([{ prefix: '01', district: 'Nord' }, { prefix: '01067', district: 'Spezial' }]);
        expect(postalResponsibility([], '01068', territories).assignments).toHaveLength(1);
    });
    it('never uses customer contact data and prefers explicit Account Manager over VB', () => {
        expect(accountManager({ vb: 'Eva', telefon: '030123456', email: 'customer@example.org' })).toEqual({ name: 'Eva', phone: '', tel: '', upn: '' });
        const manager = accountManager({ vb: 'Other 030999999', extra: { 'Account Manager': 'Eva', 'Account Manager Telefon': '+49 171 1234567', 'Account Manager UPN': 'eva@example.org', 'VB Email': 'other@example.org' } });
        expect(manager).toEqual({ name: 'Eva', phone: '+49 171 1234567', tel: '+491711234567', upn: 'eva@example.org' });
        expect(teamsChatUrl(manager.upn)).toContain('users=eva%40example.org');
        expect(teamsChatUrl('Eva')).toBe('');
    });
    it('escapes imported text and reports absent revenue rather than inventing zero turnover', () => {
        const result = postalResponsibility([{ id: 'x', plz: '45127', bezirk: '<img src=x onerror=alert(1)>', vb: 'A <script>' }], '451');
        const html = responsibilityResultsHtml(result);
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<script>');
        expect(html).toContain('Kein Umsatz hinterlegt');
        expect(html).toContain('keine verbindliche Neukundenzuständigkeit');
    });
});
