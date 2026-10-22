import { afterEach, describe, expect, it, vi } from 'vitest';
import { companyLink, DUVE_TEMPLATE, readCompanyLink, validCompanyLink } from '../src/features/companyLink.js';
afterEach(() => vi.unstubAllGlobals());
describe('Optional company bookmark', () => {
    const config = { label: 'DUVE', template: DUVE_TEMPLATE };
    it('builds the documented DUVE search with encoded number and preserves zeros', () => {
        expect(companyLink({ nummer: '008676083' }, config).url).toBe('https://duve.siemens.com/duve-ui/search?clusterType=all&searchTerm=008676083');
        expect(companyLink({ nummer: 'A&B #1' }, config).url).toContain('searchTerm=A%26B%20%231');
        expect(companyLink({ nummer: '' }, config)).toBeNull();
        expect(companyLink({ nummer: '1' }, null)).toBeNull();
    });
    it('rejects unsafe templates, credentials and a missing placeholder', () => {
        for (const template of ['javascript:alert({kundennummer})', 'http://example.org/{kundennummer}', 'https:example.org/{kundennummer}', 'https://user:pass@example.org/{kundennummer}', 'https://example.org/', 'https://{kundennummer}.example.org/']) expect(validCompanyLink({ label: 'Link', template })).toBe(false);
    });
    it('tolerates corrupt or blocked browser storage', () => {
        vi.stubGlobal('localStorage', { getItem: () => '{broken' });
        expect(readCompanyLink()).toBeNull();
        vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); } });
        expect(readCompanyLink()).toBeNull();
    });
});
