// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Geräteschlüssel (PO 24.10.2026): Kundendaten liegen auch ohne PIN-Tresor
 * nur verschlüsselt im Browser. Wer die Datenbankdateien kopiert, sieht nichts.
 */
// Minimale IndexedDB im Speicher – genau so viel, wie storage.js benutzt.
const RAW = new Map();
function fakeIndexedDb() {
    const later = (fn) => setTimeout(fn, 0);
    const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore() {},
        close() {},
        transaction() {
            const tx = {};
            tx.objectStore = () => ({
                put(value, key) { RAW.set(key, structuredClone(value)); later(() => tx.oncomplete?.()); },
                add(value, key) {
                    const request = {};
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

const vault = await import('../src/services/vault.js');
const storage = await import('../src/services/storage.js');

const DATA = { customers: [{ id: 'k1', nummer: '7654321', name: 'Muster Mineral GmbH', strasse: 'Testweg 1' }] };
const TOUR = [{ id: 't1', name: 'Dienstag', start: { strasse: 'Rosenweg 7' }, stopIds: ['k1'] }];
const plainText = () => JSON.stringify([...RAW.entries()].filter(([key]) => key !== 'geraeteschluessel'));

beforeEach(async () => {
    await vault.wipe();
    await storage.clearDataset();
    RAW.clear();
});

describe('Geräteschlüssel', () => {
    it('speichert ohne Tresor verschlüsselt und liest es wieder', async () => {
        expect(await storage.saveDataset(DATA)).toBe(true);
        expect(RAW.get('kundendaten').__dev).toBe(1);
        expect(plainText()).not.toContain('Muster Mineral');
        expect(plainText()).not.toContain('7654321');
        expect(await storage.loadDataset()).toEqual(DATA);
    });

    it('der Schlüssel ist nicht auslesbar', async () => {
        await storage.saveDataset(DATA);
        const key = RAW.get('geraeteschluessel');
        expect(key.extractable).toBe(false);
        expect(key.algorithm.name).toBe('AES-GCM');
        await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toThrow();
    });

    it('Nebenspeicher (Touren) ebenso', async () => {
        await storage.saveTours(TOUR);
        expect(RAW.get('gespeicherte-touren').__dev).toBe(1);
        expect(plainText()).not.toContain('Rosenweg');
        expect(await storage.loadTours()).toEqual(TOUR);
    });

    it('verschlüsselt Altbestand im Klartext beim Start (sealStoredData)', async () => {
        RAW.set('kundendaten', structuredClone(DATA));
        RAW.set('gespeicherte-touren', structuredClone(TOUR));
        expect(plainText()).toContain('Muster Mineral');
        await storage.sealStoredData();
        expect(RAW.get('kundendaten').__dev).toBe(1);
        expect(RAW.get('gespeicherte-touren').__dev).toBe(1);
        expect(plainText()).not.toContain('Muster Mineral');
        expect(plainText()).not.toContain('Rosenweg');
        expect(await storage.loadDataset()).toEqual(DATA);
    });

    it('zwei gleichzeitige erste Speichervorgänge nutzen denselben Schlüssel', async () => {
        await Promise.all([storage.saveDataset(DATA), storage.saveTours(TOUR)]);
        expect(await storage.loadDataset()).toEqual(DATA);
        expect(await storage.loadTours()).toEqual(TOUR);
    });

    it('passt der Schlüssel nicht, wird der Bestand nicht überschrieben', async () => {
        await storage.saveDataset(DATA);
        const sealed = structuredClone(RAW.get('kundendaten'));
        RAW.delete('geraeteschluessel');   // z. B. Speicher teilweise geleert
        expect(await storage.loadDataset()).toBeNull();
        expect(await storage.saveDataset({ customers: [] })).toBe(false);
        expect(RAW.get('kundendaten')).toEqual(sealed);
        // Erst bewusstes Löschen gibt den Speicher wieder frei.
        await storage.clearDataset();
        expect(await storage.saveDataset(DATA)).toBe(true);
    });

    it('mit PIN-Tresor verschlüsselt der Tresor, nicht der Geräteschlüssel', async () => {
        await vault.setup('123456', { iterations: 1000, autoLockMs: 0 });
        await storage.saveDataset(DATA);
        expect(RAW.get('kundendaten').__enc).toBe(1);
        expect(RAW.get('kundendaten').__dev).toBeUndefined();
    });

    it('wird beim Start angestoßen', () => {
        expect(readFileSync('src/main.js', 'utf8')).toContain('if (!vaultEnabled()) sealStoredData();');
    });
});
