import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const saved = [];
vi.mock('../src/services/storage.js', () => ({
    loadGeocodeCache: async () => ({}),
    saveGeocodeCache: async (cache) => { saved.push(structuredClone(cache)); }
}));

const { geocodeExact, abandonGeocodeRuns } = await import('../src/services/geocode.js');
const { mergeVisitReport, rememberSentVisits, loadSentVisits, visitKey } = await import('../src/features/visitReport.js');
const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

const customer = (i) => ({ id: `k${i}`, name: `Kunde ${i}`, strasse: `Weg ${i}`, plz: '45127', ort: 'Essen', geo: 'plz' });

afterEach(() => { vi.unstubAllGlobals(); saved.length = 0; });

describe('Verortung nach „Alle Daten löschen"', () => {
    it('bricht ab, fragt nichts mehr ab und schreibt keinen Cache mehr', async () => {
        const asked = [];
        vi.stubGlobal('fetch', async (url) => {
            asked.push(url);
            // Während der ersten Anfrage löscht jemand alle Daten.
            if (asked.length === 1) abandonGeocodeRuns();
            return { ok: true, json: async () => [{ lat: '51.4', lon: '7.0' }] };
        });
        const list = [customer(1), customer(2), customer(3)];
        const result = await geocodeExact(list).run;
        expect(asked).toHaveLength(1);
        expect(saved).toEqual([]);
        expect(result.cancelled).toBe(true);
        expect(list.every((c) => c.geo === 'plz')).toBe(true);
    });

    it('ein neuer Lauf nach dem Abbruch arbeitet normal', async () => {
        vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => [{ lat: '51.4', lon: '7.0' }] }));
        abandonGeocodeRuns();
        const list = [customer(1)];
        const result = await geocodeExact(list).run;
        expect(result.updated).toBe(1);
        expect(saved.length).toBeGreaterThan(0);
    });

    it('Löschen, Ersetzen und Sperren beenden laufende Verortungen', () => {
        expect(read('src/ui/exactGeocoding.js')).toContain("on('dataset:replacing', abandonGeocodeRuns);");
        expect(read('src/ui/exactGeocoding.js')).toContain("on('dataset:cleared', abandonGeocodeRuns);");
        expect(read('src/core/state.js')).toContain("emit('dataset:replacing');");
    });
});

describe('„Alle Daten löschen" löscht wirklich alles', () => {
    it('stoppt zuerst die Verortung, verwirft den Schlüssel und leert die Nebenspeicher', () => {
        const ui = read('src/ui/sidebar.js');
        const fn = ui.slice(ui.indexOf('async function clearAllData()'), ui.indexOf('export function initSidebar()'));
        expect(fn.indexOf('abandonGeocodeRuns();')).toBeLessThan(fn.indexOf('await clearDataset();'));
        expect(fn).toContain('discardKey();');
        expect(fn).toContain('await clearProtectedStores();');
        expect(read('src/ui/tourPanel.js')).toContain("on('dataset:cleared', () => { savedTours = []; renderSavedTours(); });");
        expect(read('src/ui/cockpit.js')).toContain("on('dataset:cleared', () => { scenarios = []; renderScenarios(); });");
    });
});

describe('Besuchsbericht markiert nur seine eigenen Besuche', () => {
    it('der heutige, noch nicht gemeldete Besuch bleibt offen', () => {
        const data = new Map();
        const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
        const kunde = { id: 'k1', nummer: '1001', name: 'A', besuche: ['2026-10-04'] }; // heute, unversandt
        const result = mergeVisitReport([kunde], [{ Besuchsdatum: '2026-10-03', Kundennummer: '1001' }], { today: '2026-10-04' });
        expect(result.entries.map((e) => e.date)).toEqual(['2026-10-03']);
        rememberSentVisits(result.entries, { today: '2026-10-04', storage });
        const sent = loadSentVisits(storage);
        expect(sent.has(visitKey(kunde, '2026-10-03'))).toBe(true);
        expect(sent.has(visitKey(kunde, '2026-10-04'))).toBe(false);
    });

    it('die Übernahme nutzt genau diese Einträge', () => {
        const ui = read('src/ui/visitReport.js');
        expect(ui).toContain('if (result.entries.length > 0) rememberSentVisits(result.entries);');
        expect(ui).not.toContain('result.touched.flatMap');
    });
});
