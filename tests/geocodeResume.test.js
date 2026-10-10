import { describe, expect, it, vi, beforeEach } from 'vitest';

// Adress-Cache im Speicher statt IndexedDB – so lässt sich ein „Neustart" nachstellen.
const memory = { cache: {} };
vi.mock('../src/services/storage.js', () => ({
    loadGeocodeCache: async () => structuredClone(memory.cache),
    saveGeocodeCache: async (cache) => { memory.cache = structuredClone(cache); }
}));

const { CONFIG } = await import('../src/core/config.js');
const { geocodeExact, groupExactGeocodeCandidates, exactGeocodeMisses } = await import('../src/services/geocode.js');

const own = (i, extra = {}) => ({ id: `k-${i}`, name: `Kunde ${i}`, strasse: `Weg ${i}`, plz: '45127', ort: 'Essen', geo: 'plz', ...extra });

describe('Verortung nach einem Neustart', () => {
    let calls;
    beforeEach(() => {
        memory.cache = {};
        calls = [];
        CONFIG.nominatim.delayMs = 0;
        // Weg 3 kennt OpenStreetMap nicht, alles andere schon.
        globalThis.fetch = async (url) => {
            calls.push(String(url));
            const miss = String(url).includes('Weg+3') || String(url).includes('Weg%203');
            return { ok: true, status: 200, json: async () => (miss ? [] : [{ lat: '51.4', lon: '7.0' }]) };
        };
    });

    it('übernimmt Bekanntes sofort aus dem Speicher und zählt nur, was wirklich neu gefragt wird', async () => {
        const first = [own(1), own(2), own(3)];
        const firstRun = await geocodeExact(first).run;
        expect(firstRun.updated).toBe(2);
        expect(calls).toHaveLength(3);

        // „Neustart": dieselben Kunden, aber die Positionen wurden nicht mehr gesichert.
        calls = [];
        const again = [own(1), own(2), own(3), own(4)];
        const progress = [];
        const handle = geocodeExact(again, (done, total, info) => progress.push([done, total, info?.fromCache]));
        const result = await handle.run;
        expect(calls).toHaveLength(1);                   // nur Weg 4 ist neu
        expect(progress[0]).toEqual([0, 1, 2]);           // Zähler: 0 von 1, zwei aus dem Speicher
        expect(result).toMatchObject({ updated: 1, fromCache: 2 });
        expect(again.filter((c) => c.geo === 'exakt')).toHaveLength(3);
    });

    it('zählt nicht gefundene Anschriften nicht immer wieder als offen – bis sich die Anschrift ändert', async () => {
        const customers = [own(1), own(3)];
        await geocodeExact(customers).run;
        expect(customers[1].geo).toBe('plz');
        expect(exactGeocodeMisses(customers)).toBe(1);
        expect(groupExactGeocodeCandidates(customers)).toHaveLength(0);

        customers[1].strasse = 'Weg 30';
        expect(groupExactGeocodeCandidates(customers)).toHaveLength(1);
        expect(exactGeocodeMisses(customers)).toBe(0);
    });
});
