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
// Transaktionen wie im Browser: Schreibvorgänge gelten erst, wenn die ganze
// Transaktion gelingt; scheitert einer, wird keiner übernommen.
const RAW = new Map();
let failWrites = false;
const failKeys = new Set();   // nur diese Schlüssel scheitern
let failPut = null;           // (key) => true: genau dieser Schreibvorgang scheitert
function fakeIndexedDb() {
    const later = (fn) => setTimeout(fn, 0);
    const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore() {},
        close() {},
        transaction() {
            const tx = {};
            const writes = [];   // [key, value | undefined (löschen)]
            let failed = false;
            let finishing = false;
            const finish = () => {
                if (finishing) return;
                finishing = true;
                later(() => {
                    if (failed) {
                        tx.error = new Error('QuotaExceededError');
                        tx.onerror?.();
                        return;
                    }
                    for (const [key, value] of writes) {
                        if (value === undefined) RAW.delete(key);
                        else RAW.set(key, value);
                    }
                    tx.oncomplete?.();
                });
            };
            tx.objectStore = () => ({
                put(value, key) {
                    if (failWrites || failKeys.has(key) || failPut?.(key)) failed = true;
                    else writes.push([key, structuredClone(value)]);
                    finish();
                },
                add(value, key) {
                    const request = {};
                    if (failWrites) failed = true;
                    else if (RAW.has(key)) later(() => request.onerror?.({ preventDefault() {}, stopPropagation() {} }));
                    else writes.push([key, structuredClone(value)]);
                    finish();
                    return request;
                },
                delete(key) { writes.push([key, undefined]); finish(); },
                get(key) {
                    const request = {};
                    later(() => { request.result = structuredClone(RAW.get(key)); request.onsuccess?.(); });
                    finish();
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
    failKeys.clear();
    failPut = null;
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

describe('Teilabbruch beim Deaktivieren: nichts bleibt ohne PIN-Schutz', () => {
    it('scheitert ein Teil, wird nichts übernommen – alles bleibt unter der PIN', async () => {
        await vault.setup(PIN, { recovery: false, iterations: 1000 });
        await storage.saveDataset(DATA);
        await storage.saveTours(TOUR);
        failKeys.add('gespeicherte-touren');   // Kundendaten gingen, Touren nicht
        await expect(storage.moveToDeviceKey(DATA, () => vault.removeVaultMeta())).rejects.toThrow();
        expect(vault.isEnabled()).toBe(true);
        expect(RAW.get('kundendaten').__enc).toBe(1);   // nie __dev, auch nicht kurz
        expect(RAW.get('gespeicherte-touren').__enc).toBe(1);
        failKeys.clear();
        vault.discardKey();
        await vault.unlock(PIN);
        expect(await storage.loadDataset()).toEqual(DATA);
        expect(await storage.loadTours()).toEqual(TOUR);
    });

    it('auch wenn danach jeder weitere Schreibversuch scheitert (Rückweg unmöglich)', async () => {
        await vault.setup(PIN, { recovery: false, iterations: 1000 });
        await storage.saveDataset(DATA);
        await storage.saveTours(TOUR);
        let datasetWrites = 0;
        failPut = (key) => key === 'gespeicherte-touren' || (key === 'kundendaten' && ++datasetWrites > 1);
        await expect(storage.moveToDeviceKey(DATA, () => vault.removeVaultMeta())).rejects.toThrow();
        expect(vault.isEnabled()).toBe(true);
        expect(RAW.get('kundendaten').__enc).toBe(1);
    });

    it('Altlast aus einem früheren Abbruch holt das nächste Entsperren in den Tresor', async () => {
        await vault.setup(PIN, { recovery: false, iterations: 1000 });
        await storage.saveDataset(DATA);
        // So lag es nach einem Teilabbruch vor dem 25.10.2026: Kundendaten mit
        // dem Geräteschlüssel, Tresor aktiv.
        vault.removeVaultMeta();
        await storage.saveDataset(DATA);
        const deviceSealed = RAW.get('kundendaten');
        expect(deviceSealed.__dev).toBe(1);
        await vault.setup(PIN, { recovery: false, iterations: 1000 });
        RAW.set('kundendaten', deviceSealed);

        vault.discardKey();
        await vault.unlock(PIN);
        await storage.reprotectStores();                 // wie beim Entsperren in der Oberfläche
        expect(RAW.get('kundendaten').__enc).toBe(1);
        expect(await storage.loadDataset()).toEqual(DATA);
    });
});

describe('PIN ändern und per Code zurücksetzen nur mit dauerhaft gespeicherter PIN', () => {
    it('PIN ändern: Fehler statt Erfolg, die alte PIN gilt weiter – nichts geht verloren', async () => {
        await vault.setup(PIN, { recovery: true, iterations: 1000 });
        await storage.saveDataset(DATA);
        const before = LOCAL.get('tf_vault');
        failLocal = true;
        await expect(vault.changePin(PIN, '937164')).rejects.toThrow('vault-meta-not-saved');
        failLocal = false;
        expect(LOCAL.get('tf_vault')).toBe(before);
        vault.discardKey();
        await expect(vault.unlock('937164')).rejects.toThrow();
        await vault.unlock(PIN);
        expect(await storage.loadDataset()).toEqual(DATA);
    });

    it('per Wiederherstellungscode: Fehler, Code und alte PIN gelten weiter, bleibt gesperrt', async () => {
        const { recoveryCode } = await vault.setup(PIN, { recovery: true, iterations: 1000 });
        vault.discardKey();
        failLocal = true;
        await expect(vault.resetPinWithRecovery(recoveryCode, '937164')).rejects.toThrow('vault-meta-not-saved');
        failLocal = false;
        expect(vault.isUnlocked()).toBe(false);
        await vault.unlock(PIN);
        vault.discardKey();
        await vault.resetPinWithRecovery(recoveryCode, '937164');
        vault.discardKey();
        await vault.unlock('937164');
    });
});
