import { afterEach, describe, expect, it, vi } from 'vitest';
import { companyLink, COMPANY_LINK_KEY, DUVE_TEMPLATE, readCompanyLink, validCompanyLink } from '../src/features/companyLink.js';
afterEach(() => vi.unstubAllGlobals());
describe('Optional company bookmark', () => {
    const config = { label: 'DUVE', template: DUVE_TEMPLATE };
    const customer = (nummer) => ({ nummer, extra: { 'SieSales Link': 'https://crm.example/customer' } });
    it('builds the documented DUVE search with encoded number and preserves zeros', () => {
        expect(companyLink(customer('2498159'), config).url).toBe('https://duve.siemens.com/duve-ui/search?clusterType=case&searchTerm=2498159');
        expect(companyLink(customer('008676083'), config).url).toBe('https://duve.siemens.com/duve-ui/search?clusterType=case&searchTerm=008676083');
        expect(companyLink(customer('A&B #1'), config).url).toContain('searchTerm=A%26B%20%231');
        expect(companyLink({ nummer: '' }, config)).toBeNull();
        expect(companyLink({ nummer: '1' }, null)).toBeNull();
    });
    it('rejects unsafe templates, credentials and a missing placeholder', () => {
        for (const template of ['javascript:alert({kundennummer})', 'http://example.org/{kundennummer}', 'https:example.org/{kundennummer}', 'https://user:pass@example.org/{kundennummer}', 'https://example.org/', 'https://{kundennummer}.example.org/']) expect(validCompanyLink({ label: 'Link', template })).toBe(false);
    });
    it('upgrades the old stored DUVE preset while preserving custom templates', () => {
        const legacy = { label: 'DUVE intern', template: DUVE_TEMPLATE.replace('clusterType=case', 'clusterType=all') };
        vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(legacy) });
        expect(readCompanyLink()).toEqual({ label: 'DUVE intern', template: DUVE_TEMPLATE });
        expect(companyLink(customer('2498159')).url).toBe('https://duve.siemens.com/duve-ui/search?clusterType=case&searchTerm=2498159');
        expect(companyLink(customer('2498159'), legacy).url).toContain('clusterType=case&searchTerm=2498159');
        const custom = { label: 'Anderes Portal', template: 'https://example.org/search?clusterType=all&searchTerm={kundennummer}' };
        vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(custom) });
        expect(readCompanyLink()).toEqual(custom);
        expect(companyLink(customer('2498159')).url).toContain('clusterType=all');
    });
    it('tolerates corrupt or blocked browser storage', () => {
        vi.stubGlobal('localStorage', { getItem: () => '{broken' });
        expect(readCompanyLink()).toEqual(config);
        vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
        expect(readCompanyLink()).toEqual(config);
    });
    it('automatically offers DUVE only alongside a valid SieSales link and a number', () => {
        vi.stubGlobal('localStorage', { getItem: () => null });
        expect(companyLink(customer('123')).label).toBe('DUVE');
        expect(companyLink({ nummer: '123' })).toBeNull();
        expect(companyLink({ nummer: '123', extra: { 'SieSales Link': 'javascript:alert(1)' } })).toBeNull();
        expect(companyLink(customer(''))).toBeNull();
        expect(companyLink({ ...customer('123'), demo: true })).toBeNull();
    });
    it('respects an explicit opt-out and preserves a saved custom target', () => {
        vi.stubGlobal('localStorage', { getItem: (key) => key === COMPANY_LINK_KEY ? JSON.stringify({ disabled: true }) : null });
        expect(companyLink(customer('123'))).toBeNull();
        const custom = { label: 'Firmenportal', template: 'https://example.org/?id={kundennummer}' };
        vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(custom) });
        expect(companyLink(customer('123'))).toEqual({ label: 'Firmenportal', url: 'https://example.org/?id=123' });
        expect(companyLink({ nummer: '123' })).toBeNull();
    });
});
