import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Nach dem Entsperren des Tresors stellt die App ihren Zustand wieder her und
// löst dabei viele Ereignisse direkt nacheinander aus. Zeichnete jedes davon
// alle Kundenmarker neu, stand das Handy bei großen Beständen sekundenlang
// still – es wirkte eingefroren.
const map = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
const exact = readFileSync(resolve(process.cwd(), 'src/ui/exactGeocoding.js'), 'utf8');

describe('Reaktionsfähig nach dem Entsperren', () => {
    it('fasst mehrere Neuzeichnungen der Kundenmarker zu einer zusammen', () => {
        const body = map.slice(map.indexOf('function renderMarkers()'), map.indexOf('function drawMarkers()'));
        expect(body).toContain('if (markersQueued) return;');
        expect(body).toContain('queueMicrotask');
        expect(body).not.toContain('clearLayers');
    });

    it('misst die Popup-Abstände einmal je Durchlauf, nicht je Kunde', () => {
        const body = map.slice(map.indexOf('function drawMarkers()'), map.indexOf('// ---- Tour-Anzeige'));
        expect(body.match(/customerPopupOptions\(\)/g)).toHaveLength(1);
        expect(body.indexOf('customerPopupOptions()')).toBeLessThan(body.indexOf('customersOnMap()'));
        // Die Marker-Erzeugung bekommt die gemessenen Abstände nur übergeben.
        expect(body).toContain('function customerMarkersFor(customers, popupOptionsForCustomers)');
    });

    it('sichert den Verortungsfortschritt nach Zeit, nicht alle paar Adressen', () => {
        expect(exact).toMatch(/const CHECKPOINT_MS = \d{5,}/);
        expect(exact).not.toContain('done % 20');
    });
});
