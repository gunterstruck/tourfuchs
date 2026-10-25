// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Tresor und Geräteschlüssel dürfen Daten nie unlesbar machen und nie still
 * auf Klartext zurückfallen (Prüfbefunde vom 25.10.2026):
 *  1. Tresor deaktivieren: Schlüssel erst verwerfen, wenn alles umgeschlüsselt ist.
 *  2. Tresor einrichten: abbrechen, wenn die Schlüssel-Metadaten nicht dauerhaft liegen.
 *  3. Geräteschlüssel nicht nutzbar: nicht im Klartext speichern, sondern melden.
 */
// Minimale IndexedDB im Speicher, mit abschaltbarem Schreiben („Speicher voll").
const RAW = new Map();
let failWrites = false;
function fakeIndexedDb() {
    const later = (fn) => setTimeout(fn, 0);
    const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore() {},
        close() {},
        transaction() {
            const tx = {};
            const fail = () => later(() => { tx.error = new Error('QuotaExceededError'); tx.onerror?.(); });
            tx.objectStore = () => ({
                put(value, key) {
                    if (failWrites) return fail();
                    RAW.set(key, structuredClone(value)); later(() => tx.oncomplete?.());
                },
                add(value, key) {
                    const request = {};
                    if (failWrites) { fail(); return request; }
                    if (RAW.has(key)) later(() => { request.onerror?.({ preventDefault() {}, stopPropagation() {} }); tx.oncomplete?.(); });
                    else { RAW.set(key, structuredClone(value)); later(() => tx.oncomplete?.()); }
                    return request;
                },
                delete(key) { RAW.delete(key); later(() => tx.oncomplete?.()); },
                get(key) {
                    const request = {};
                    later(() => { request.result = structuredClone(RAW.get(key)); request.onsuccess?.(); tx.oncomplete?.(); });
                    return request;
                }
            });
            return tx;
        }
    };
    return {
        open() {
            const request = {};
            later(() => { request.result = db; request.onsuccess?.(); });
            return request;
        }
    };
}
globalThis.indexedDB = fakeIndexedDb();

// localStorage, das sich bei Bedarf weigert (QuotaExceededError).
const LOCAL = new Map();
let failLocal = false;
globalThis.localStorage = {
    getItem: (key) => (LOCAL.has(key) ? LOCAL.get(key) : null),
    setItem: (key, value) => {
        if (failLocal) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
        LOCAL.set(key, String(value));
    },
    removeItem: (key) => { LOCAL.delete(key); }
};

const vault = await import('../src/services/vault.js');
const storage = await import('../src/services/storage.js');

const DATA = { customers: [{ id: 'k1', nummer: '7654321', name: 'Muster Mineral GmbH', strasse: 'Testweg 1' }] };
const TOUR = [{ id: 't1', name: 'Dienstag', start: { strasse: 'Rosenweg 7' }, stopIds: ['k1'] }];
const PIN = '482917';
const plainText = () => JSON.stringify([...RAW.entries()].filter(([key]) => key !== 'geraeteschluessel'));

beforeEach(async () => {
    failWrites = false;
    failLocal = false;
    await vault.wipe();
    await storage.clearDataset();
    RAW.clear();
    LOCAL.clear();
});

afterEach(() => { vi.restoreAllMocks(); });

describe('Befund 1: Tresor deaktivieren verliert keine Daten', () => {
    async function vaultWithData() {
        await vault.setup(PIN, { recovery: false, iterations: 1000 });
        await storage.saveDataset(DATA);
        await storage.saveTours(TOUR);
        expect(RAW.get('kundendaten').__enc).toBe(1);
    }

    it('scheitert das Umschlüsseln, bleibt der Tresor aktiv und alles lesbar', async () => {
        await vaultWithData();
        failWrites = true;
        await expect(storage.moveToDeviceKey(DATA, () => vault.removeVaultMeta())).rejects.toThrow();
        failWrites = false;
        expect(vault.isEnabled()).toBe(true);

        // „Neustart": Schlüssel weg, mit der PIN wieder entsperren.
        vault.discardKey();
        await vault.unlock(PIN);
        expect(await storage.loadDataset()).toEqual(DATA);
        expect(await storage.loadTours()).toEqual(TOUR);
    });

    it('gelingt es, liegt alles mit dem Geräteschlüssel – und der Tresor ist aus', async () => {
        await vaultWithData();
        await storage.moveToDeviceKey(DATA, () => vault.removeVaultMeta());
        vault.discardKey();
        expect(vault.isEnabled()).toBe(false);
        expect(RAW.get('kundendaten').__dev).toBe(1);
        expect(RAW.get('gespeicherte-touren').__dev).toBe(1);
        expect(plainText()).not.toContain('Muster Mineral');
        expect(await storage.loadDataset()).toEqual(DATA);
        expect(await storage.loadTours()).toEqual(TOUR);
    });

    it('die Oberfläche entfernt die Tresor-Metadaten erst danach', () => {
        const ui = readFileSync('src/ui/lockVault.js', 'utf8');
        const disable = ui.slice(ui.indexOf('async function disableVault'), ui.indexOf('// ---- Auto-Lock'));
        expect(disable).toContain('moveToDeviceKey(dataset, () => vault.removeVaultMeta())');
        expect(disable).not.toMatch(/vault\.removeVaultMeta\(\);/);
    });
});

describe('Befund 2: Tresor einrichten nur mit dauerhaft gespeichertem Schlüssel', () => {
    it('bricht ab, wenn localStorage die Metadaten nicht annimmt', async () => {
        failLocal = true;
        await expect(vault.setup(PIN, { recovery: true, iterations: 1000 })).rejects.toThrow();
        expect(vault.isEnabled()).toBe(false);
        expect(vault.isUnlocked()).toBe(false);
        // Weiter mit dem Geräteschlüssel – nach dem Neuladen lesbar.
        failLocal = false;
        await storage.saveDataset(DATA);
        expect(RAW.get('kundendaten').__dev).toBe(1);
        expect(await storage.loadDataset()).toEqual(DATA);
    });

    it('legt die Metadaten bei Erfolg wirklich in localStorage ab', async () => {
        await vault.setup(PIN, { recovery: true, iterations: 1000 });
        expect(LOCAL.get('tf_vault')).toBeTruthy();
    });
});

describe('Befund 3: kein stiller Rückfall auf Klartext', () => {
    it('ohne nutzbaren Geräteschlüssel wird nicht gespeichert und einmal gemeldet', async () => {
        const reported = [];
        storage.onEncryptionUnavailable(() => reported.push('x'));
        vi.spyOn(globalThis.crypto.subtle, 'generateKey').mockRejectedValue(new Error('nicht verfügbar'));

        expect(await storage.saveDataset(DATA)).toBe(false);
        expect(await storage.saveTours(TOUR)).toBe(false);
        expect(RAW.has('kundendaten')).toBe(false);
        expect(plainText()).not.toContain('Muster Mineral');
        expect(plainText()).not.toContain('Rosenweg');
        expect(reported).toHaveLength(1);
    });
});

describe('Befund 1, Randfall: Auto-Sperre mitten im Deaktivieren', () => {
    it('bricht ab, statt einen Nebenspeicher mit dem verworfenen Schlüssel liegen zu lassen', async () => {
        await vault.setup(PIN, { recovery: false, iterations: 1000 });
        await storage.saveTours(TOUR);
        vault.discardKey();   // gesperrt, Metadaten noch da
        await expect(storage.moveToDeviceKey(DATA, () => vault.removeVaultMeta())).rejects.toThrow();
        expect(vault.isEnabled()).toBe(true);
        await vault.unlock(PIN);
        expect(await storage.loadTours()).toEqual(TOUR);
    });
});
