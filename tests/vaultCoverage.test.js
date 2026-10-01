// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const OPTS = { iterations: 1000, autoLockMs: 0 };
const TOUR = [{ id: 't1', name: 'Dienstag', start: { label: 'Zuhause', strasse: 'Rosenweg 7', plz: '45127', ort: 'Essen' }, stopIds: ['20001'] }];
const GEO = { 'Rosenweg 7, 45127 Essen': [51.45, 7.01] };

beforeEach(async () => {
    await vault.wipe();
    RAW.clear();
});

describe('Tresor schützt auch Adress-Cache, Touren und Szenarien', () => {
    it('speichert bei aktivem Tresor nur verschlüsselt', async () => {
        await vault.setup('123456', OPTS);
        await storage.saveTours(TOUR);
        await storage.saveGeocodeCache(GEO);
        await storage.saveScenarios([{ name: 'A', assign: { 20001: 'Nord' } }]);
        const everything = JSON.stringify([...RAW.values()]);
        expect(everything).not.toContain('Rosenweg');
        expect(everything).not.toContain('20001');
        expect(await storage.loadTours()).toEqual(TOUR);
        expect(await storage.loadGeocodeCache()).toEqual(GEO);
    });

    it('liefert gesperrt nichts und schreibt gesperrt nichts', async () => {
        await vault.setup('123456', OPTS);
        await storage.saveTours(TOUR);
        vault.lock();
        expect(await storage.loadTours()).toEqual([]);
        await storage.saveTours([]); // darf die verschlüsselten Touren nicht überschreiben
        await vault.unlock('123456');
        expect(await storage.loadTours()).toEqual(TOUR);
    });

    it('verschlüsselt Altbestand im Klartext beim Einrichten/Entsperren (reprotectStores)', async () => {
        await storage.saveTours(TOUR);
        await storage.saveGeocodeCache(GEO);
        expect(JSON.stringify([...RAW.values()])).toContain('Rosenweg');
        await vault.setup('123456', OPTS);
        await storage.reprotectStores();
        expect(JSON.stringify([...RAW.values()])).not.toContain('Rosenweg');
        expect(await storage.loadTours()).toEqual(TOUR);
    });

    it('entschlüsselt beim Deaktivieren wieder in Klartext', async () => {
        await vault.setup('123456', OPTS);
        await storage.saveTours(TOUR);
        vault.removeVaultMeta(); // DEK noch im Speicher – wie in disableVault()
        await storage.reprotectStores();
        vault.lock();
        expect(await storage.loadTours()).toEqual(TOUR);
    });

    it('räumt die Nebenspeicher beim Wipe mit ab', async () => {
        await vault.setup('123456', OPTS);
        await storage.saveTours(TOUR);
        await storage.saveGeocodeCache(GEO);
        await vault.wipe();
        expect(RAW.size).toBe(0);
    });

    it('ist in der Oberfläche angebunden (Einrichten, Entsperren, Deaktivieren, Nachladen)', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/lockVault.js'), 'utf8');
        expect(ui.match(/await reprotectStores\(\);/g)).toHaveLength(4); // Einrichten, Entsperren, Deaktivieren, Demo-Rest entfernen
        const tourPanel = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
        expect(tourPanel).toContain("on('app:ready', reloadTours);");
        expect(tourPanel).toContain("on('vault:locked', () => { savedTours = []; renderSavedTours(); });");
    });
});

describe('Besuchsbericht-Gedächtnis ohne Kundennummern im Klartext', () => {
    it('speichert nur Prüfsummen und übernimmt alte Einträge', async () => {
        const { rememberSentVisits, loadSentVisits, visitKey } = await import('../src/features/visitReport.js');
        const data = new Map([['tf_visit_report_sent', JSON.stringify(['20001|2026-09-30'])]]);
        const store = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
        const customer = { nummer: '20001' };
        expect(loadSentVisits(store).has(visitKey(customer, '2026-09-30'))).toBe(true);
        rememberSentVisits([{ customer: { nummer: '20002' }, date: '2026-09-30' }], { today: '2026-09-30', storage: store });
        expect(data.get('tf_visit_report_sent')).not.toMatch(/2000[12]/);
    });
});
