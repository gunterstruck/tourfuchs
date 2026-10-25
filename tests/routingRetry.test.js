import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRoadRoute } from '../src/services/routing.js';

/**
 * Ein vorübergehender Fehler beim Straßenrouting darf nicht bis zum
 * Neuladen gelten (Prüfbefund 25.10.2026) – nach kurzer Frist wird erneut gefragt.
 */
const POINTS = [{ lat: 51.45, lng: 7.01 }, { lat: 51.48, lng: 7.22 }];
const OK = { code: 'Ok', routes: [{ distance: 12000, duration: 900, geometry: { coordinates: [[7.01, 51.45], [7.22, 51.48]] } }] };

beforeEach(() => {
    localStorage.setItem('gf_routing_consent', 'yes');
    vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

describe('Straßenroute nach einem Fehlschlag', () => {
    it('fragt nach kurzer Frist erneut und liefert dann die Route', async () => {
        const fetch = vi.spyOn(globalThis, 'fetch')
            .mockRejectedValueOnce(new TypeError('offline'))
            .mockResolvedValue({ ok: true, json: async () => OK });

        expect(await getRoadRoute(POINTS)).toBeNull();
        // Sofort danach: kein Dauerfeuer bei jedem Neuzeichnen.
        expect(await getRoadRoute(POINTS)).toBeNull();
        expect(fetch).toHaveBeenCalledTimes(1);

        vi.setSystemTime(Date.now() + 31000);
        const route = await getRoadRoute(POINTS);
        expect(route?.distanceKm).toBe(12);
        expect(fetch).toHaveBeenCalledTimes(2);

        // Erfolg bleibt im Cache.
        await getRoadRoute(POINTS);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
