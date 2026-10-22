import { describe, expect, it } from 'vitest';
import { accountManager, isPostalQuery, postalResponsibility, teamsChatUrl } from '../src/features/postalResponsibility.js';
import { responsibilityResultsHtml } from '../src/ui/postalResponsibility.js';
import { autoDetectMapping } from '../src/services/excel.js';

const customers = [
    { id: 'a', plz: '01067', bezirk: 'Dresden', vb: 'Eva 0171 1234567', umsatz: 100, umsatzJahre: { 2026: 100 } },
    { id: 'b', plz: '01069', bezirk: 'Dresden', vb: 'Eva 0171 1234567', umsatz: 0 },
    { id: 'c', plz: '01099', bezirk: 'Elbe', vb: 'Jan', umsatz: null },
    { id: 'd', plz: '01100', bezirk: 'Andere', umsatz: 9000 }
];
describe('PLZ-Zuständigkeit', () => {
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
