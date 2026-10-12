import { describe, expect, it } from 'vitest';
import { normalizeImportSnapshot } from '../tools/importReference.mjs';

describe('Datumsstabile Import-Referenz', () => {
    it.each(['2026-10-11', '2026-10-12', '2026-10-13'])('erhält feste Fälligkeiten am Prüftag %s', (today) => {
        const value = { serviceVisits: [{ dueDate: '2026-10-12', scheduledAt: '2026-10-12T09:00:00.000Z' }] };
        expect(normalizeImportSnapshot(value, today)).toEqual(value);
    });
    it('normalisiert ausschließlich heutige Importzeitpunkte, auch in verschachtelten Quellen', () => {
        const value = {
            importedAt: '2026-10-12T12:34:56.000Z',
            sources: [{ importedAt: '2026-10-12T13:00:00.000Z' }, { importedAt: '2026-10-11T13:00:00.000Z' }],
            name: '2026-10-12',
            dueDate: '2026-10-12'
        };
        expect(normalizeImportSnapshot(value, '2026-10-12')).toEqual({
            ...value, importedAt: '<Importzeit>',
            sources: [{ importedAt: '<Importzeit>' }, value.sources[1]]
        });
        expect(value.importedAt).toBe('2026-10-12T12:34:56.000Z');
    });
});
