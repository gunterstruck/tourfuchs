// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { optimizeOrder, routeDistance } from '../src/features/tour.js';

const start = { lat: 51.45, lng: 7 };
// Gegenbeispiel aus dem PO-Review: Die vorhandene Reihenfolge ist kürzer
// als der Nearest-Neighbor-/2-Opt-Vorschlag (113,0 statt 118,8 km Luftlinie).
const stops = [
    { id: 'B', lat: 51.3079, lng: 6.8632 },
    { id: 'C', lat: 51.2095, lng: 6.8668 },
    { id: 'D', lat: 51.367, lng: 7.2297 },
    { id: 'F', lat: 51.6357, lng: 7.0494 },
    { id: 'A', lat: 51.6023, lng: 6.9336 },
    { id: 'E', lat: 51.6779, lng: 6.8156 }
];
const length = (route, end = null) => routeDistance(start, end ? [...route, end] : route).airKm;

describe('Optimierung verschlechtert keine vorhandene Tour', () => {
    it('behält die kürzere manuell gewählte Reihenfolge unverändert', () => {
        expect(length(stops)).toBeCloseTo(112.995, 3);
        const result = optimizeOrder(start, stops);
        expect(result).toEqual(stops);
        expect(result).not.toBe(stops);
    });

    it.each([null, start, { lat: 51.7, lng: 7.3 }])('berücksichtigt auch den festen Endpunkt %j', (end) => {
        for (let offset = 0; offset < stops.length; offset++) {
            const original = [...stops.slice(offset), ...stops.slice(0, offset)];
            const before = structuredClone(original);
            const result = optimizeOrder(start, original, end);
            expect(length(result, end)).toBeLessThanOrEqual(length(original, end) + 1e-9);
            expect(result.map((p) => p.id).sort()).toEqual(original.map((p) => p.id).sort());
            expect(original).toEqual(before);
        }
    });

    it('verbessert weiterhin eine ungünstige Reihenfolge', () => {
        const original = [stops[0], stops[5], stops[1], stops[4], stops[2], stops[3]];
        expect(length(optimizeOrder(start, original))).toBeLessThan(length(original) - 1);
    });

    it('ändert bei gleicher Strecke die Reihenfolge nicht', () => {
        const coincident = [{ ...start, id: 'A' }, { ...start, id: 'B' }];
        expect(optimizeOrder(start, coincident)).toEqual(coincident);
    });
});
