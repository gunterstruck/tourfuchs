import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aggregateByRegion } from '../src/features/territory.js';

// Mit 12.000 eigenen Kunden ruckelte jeder Zoom über die Kundenschwelle
// sekundenlang, und kurz standen Kundenpunkte und Gebietskacheln zugleich da
// (PO, 10.10.2026). Gemessen: Punkt-in-Polygon je Ebenenwechsel ~0,8 s, alle
// Kundenpunkte neu bauen bei jedem Wechsel, Neuberechnung nach jedem
// Mausrad-Schritt.
const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const map = read('src/features/map.js');
const showcase = read('src/ui/showcase.js');

const square = (ars, x0, y0) => ({
    properties: { ars, gen: `Kreis ${ars}` },
    geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x0 + 1, y0], [x0 + 1, y0 + 1], [x0, y0 + 1], [x0, y0]]] },
    _bbox: [x0, y0, x0 + 1, y0 + 1]
});

describe('Landkreis-Zuordnung wird je Kunde gemerkt', () => {
    it('liefert dasselbe Ergebnis und rechnet nach Koordinatenänderung neu', () => {
        const kreise = { features: [square('A', 8, 50), square('B', 9, 50)] };
        const customer = { id: 1, lat: 50.5, lng: 8.5, vb: 'X' };
        expect([...aggregateByRegion('kreise', kreise, [customer]).keys()]).toEqual(['krs-A']);
        // Zweiter Lauf (gemerkt) – unverändert.
        expect([...aggregateByRegion('kreise', kreise, [customer]).keys()]).toEqual(['krs-A']);
        // Exakt verortet: neue Koordinaten, neuer Kreis.
        customer.lng = 9.5;
        expect([...aggregateByRegion('kreise', kreise, [customer]).keys()]).toEqual(['krs-B']);
        // Andere Kreisdaten: neu berechnen statt alten Schlüssel liefern.
        const other = { features: [square('C', 9, 50)] };
        expect([...aggregateByRegion('kreise', other, [customer]).keys()]).toEqual(['krs-C']);
    });
});

describe('Zoomen bleibt bei großen Beständen flüssig', () => {
    it('rechnet erst nach dem letzten Mausrad-Schritt nach', () => {
        expect(map).toMatch(/const ZOOM_SETTLE_MS = \d+;/);
        expect(map).toContain('zoomSettleTimer = setTimeout(afterZoom, ZOOM_SETTLE_MS);');
    });

    it('blendet Kundenpunkte beim Zoomen nur aus und ein, statt sie neu zu bauen', () => {
        expect(map).toContain("if (!levelChanged && state.colorMode === 'auto') applyView({ zoomOnly: true });");
        expect(map).toContain('renderMarkers({ keep: zoomOnly });');
        const draw = map.slice(map.indexOf('function drawMarkers()'), map.indexOf('function finishMarkers()'));
        expect(draw).toContain('map.removeLayer(clusterGroup)');
        expect(draw).toContain('builtMarkerSignature === markerSignature()');
        // Alles andere (Filter, Tour, Besuche …) baut weiterhin neu.
        const render = map.slice(map.indexOf('function renderMarkers('), map.indexOf('function drawMarkers()'));
        expect(render).toContain('if (!keep) markersDirty = true;');
    });
});

describe('Live-Demos klicken auch nach dem Verschieben der Karte', () => {
    it('setzt Leaflets Klicksperre nach dem Ziehen vor jedem Demo-Klick zurück', () => {
        expect(showcase).toContain('function releaseMapClickGuard()');
        const click = showcase.slice(showcase.indexOf('async function clickEl('), showcase.indexOf('async function typeInto('));
        expect(click.indexOf('releaseMapClickGuard();')).toBeGreaterThan(-1);
        expect(click.indexOf('releaseMapClickGuard();')).toBeLessThan(click.indexOf('.click();'));
    });

    it('klickt erst, wenn ein weit gescrollter Knopf im Bild steht', () => {
        // Simulation mit vielen eigenen Bezirken: „Auswahl zuweisen" lag beim Klick noch außerhalb.
        const move = showcase.slice(showcase.indexOf('async function moveToEl('), showcase.indexOf('async function positionSettled('));
        expect(move.indexOf('await positionSettled(el);')).toBeGreaterThan(move.indexOf('scrollIntoView'));
        expect(move.indexOf('await positionSettled(el);')).toBeLessThan(move.indexOf('centerOf(el)'));
    });

    it('wartet nach dem Zoomen, bis Kacheln und Punkte nachgezogen sind', () => {
        const settle = Number(map.match(/const ZOOM_SETTLE_MS = (\d+);/)[1]);
        const body = showcase.slice(showcase.indexOf('async function mapSettled('), showcase.indexOf('function releaseMapClickGuard()'));
        const wait = Number([...body.matchAll(/await sleep\((\d+)\);/g)].at(-1)[1]);
        expect(wait).toBeGreaterThan(settle);
    });
});
