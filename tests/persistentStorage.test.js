import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * PO 24.10.2026: Kundendaten liegen nur im Browser – TourFuchs bittet ihn,
 * den Speicher dauerhaft zu halten, sobald eigene Kunden da sind.
 */
const fakeStorage = ({ persisted = false, grant = true } = {}) => ({
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => grant)
});

let mod;
let core;
beforeEach(async () => {
    vi.resetModules();
    core = await import('../src/core/state.js');
    mod = await import('../src/core/persistentStorage.js');
});
afterEach(() => {
    core.setCustomers([]);
    vi.unstubAllGlobals();
});

describe('Speicher dauerhaft halten', () => {
    it('fragt nur, wenn der Speicher noch nicht dauerhaft ist', async () => {
        const fresh = fakeStorage();
        expect(await mod.requestPersistentStorage(fresh)).toBe('granted');
        expect(fresh.persist).toHaveBeenCalledTimes(1);
        const already = fakeStorage({ persisted: true });
        expect(await mod.requestPersistentStorage(already)).toBe('granted');
        expect(already.persist).not.toHaveBeenCalled();
        expect(await mod.requestPersistentStorage(fakeStorage({ grant: false }))).toBe('denied');
    });

    it('ohne Unterstützung oder bei Fehler: still weiter', async () => {
        expect(await mod.requestPersistentStorage(undefined)).toBe('unsupported');
        expect(await mod.requestPersistentStorage({})).toBe('unsupported');
        expect(await mod.requestPersistentStorage({ persist: async () => { throw new Error('gesperrt'); } })).toBe('unsupported');
    });

    it('erst mit eigenen Kunden, nicht mit Beispieldaten – und nur einmal', async () => {
        const storage = fakeStorage();
        vi.stubGlobal('navigator', { storage });
        mod.initPersistentStorage();
        expect(storage.persist).not.toHaveBeenCalled();
        core.setCustomers([{ id: 'd1', name: 'TourFuchs Demo · Muster', dataOrigin: 'tourfuchs-demo', demo: true }]);
        await Promise.resolve();
        expect(storage.persisted).not.toHaveBeenCalled();
        core.setCustomers([{ id: 'k1', nummer: '1', name: 'Muster GmbH', plz: '45136' }]);
        await vi.waitFor(() => expect(storage.persist).toHaveBeenCalledTimes(1));
        core.setCustomers([{ id: 'k2', nummer: '2', name: 'Beispiel AG', plz: '45127' }]);
        await Promise.resolve();
        expect(storage.persisted).toHaveBeenCalledTimes(1);
    });

    it('wird beim Start eingerichtet', () => {
        expect(readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8')).toContain('initPersistentStorage()');
    });
});
