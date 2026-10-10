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

describe('Nach dem Herauszoomen keine einzelnen Punkte neben ihrem Stapel', () => {
    // PO, 10.10.2026: „wenn ich einmal weggezoomt habe, sind immer noch einzelne
    // Punkte an Kunden da, obwohl die in einem Stapel eingehen müssten".
    // Gemessen (Handy, 12.500 Kunden, 12 → 7): bis zu 35 solcher Punkte und
    // 20 Stapel einer vorigen Zoomstufe blieben stehen.
    const marker = (id, parent) => ({ options: { customerId: id }, __parent: parent });
    const cluster = (zoom, childCount, parent = null) => ({ _zoom: zoom, _childCount: childCount, __parent: parent });

    it('räumt Kunden ab, die auf der aktuellen Stufe in einem Stapel ab Mindestgröße stecken', async () => {
        const { strayStackedMarkers } = await import('../src/features/map.js');
        const big = cluster(9, 12);                 // Stapel auf Stufe 9
        const small = cluster(9, 3);                // kleine Gruppe auf Stufe 9: einzeln zeigen
        const deepUnderBig = cluster(12, 2, cluster(10, 4, big));
        const a = marker('a', deepUnderBig);
        const b = marker('b', cluster(12, 1, small));
        const stale = cluster(11, 7, big);          // Stapel der vorigen Stufe
        const stray = strayStackedMarkers([a, b, big, stale], { zoom: 9, minSize: 6 });
        expect(stray).toEqual([a, stale]);
    });

    it('lässt einen aufgefächerten Stapel (Spinne) in Ruhe', async () => {
        const { strayStackedMarkers } = await import('../src/features/map.js');
        const spider = cluster(18, 8);
        const a = marker('a', spider);
        expect(strayStackedMarkers([a, spider], { zoom: 17, minSize: 6, spiderfied: spider })).toEqual([]);
    });

    it('gleicht nach jeder Stapel-Animation ab – auch nach der Warteschlange von markercluster', () => {
        expect(map).toContain("clusterGroup.on('animationend', scheduleStrayCheck);");
        expect(map).toContain("map.on('zoomend', scheduleStrayCheck);");
        expect(map).toMatch(/const STRAY_CHECK_DELAY_MS = (\d+);/);
        expect(Number(map.match(/const STRAY_CHECK_DELAY_MS = (\d+);/)[1])).toBeGreaterThan(300);
        expect(map).toContain('removeStrayStackedMarkers({ fill: true })');
    });
});

describe('Ebenenwechsel ohne Leerblitzen', () => {
    it('lässt die alte Fläche stehen, bis die neue fertig ist, und nutzt gebaute Flächen wieder', () => {
        const setLevel = map.slice(map.indexOf('export async function setLevel('), map.indexOf('function dropStaleRegionLayer()'));
        expect(setLevel).toContain('staleRegionLayer = regionLayer;');
        expect(setLevel).not.toContain('if (labelLayer) labelLayer.clearLayers();\n    currentLevelData = null;');
        expect(setLevel).toContain('regionLayerCache.get(cacheKey)');
        expect(setLevel.indexOf('dropStaleRegionLayer();', setLevel.indexOf('}).addTo(map);'))).toBeGreaterThan(-1);
    });

    it('zählt Stapel außerhalb der Gebietsplanung, ohne alle Kunden einzusammeln', () => {
        const icon = map.slice(map.indexOf('function customerClusterIcon('), map.indexOf('export function initMap('));
        expect(icon).toContain('new Array(cluster.getChildCount())');
        expect(icon.indexOf('getAllChildMarkers')).toBeGreaterThan(icon.indexOf('planning\n        ?'));
    });
});

describe('Offene Kundenkachel bleibt, während die Verortung im Hintergrund läuft', () => {
    // PO, 10.10.2026: „Nach 30 s oder 1 min verschwindet die Kachel – soll bleiben,
    // solange ich sie nicht selbst schließe." Ursache: Jeder Zwischenstand der
    // adressgenauen Verortung baute alle Kundenpunkte neu (über refreshAll und
    // über applyMode → „mode:changed" in der Seitenleiste) – sichtbar als Zucken.
    const sidebar = read('src/ui/sidebar.js');

    it('verschiebt bei reinen Positionsänderungen nur die vorhandenen Punkte', () => {
        expect(map).toContain("if (info?.reason === 'positions') refreshPositions();");
        const body = map.slice(map.indexOf('function refreshPositions()'), map.indexOf('// ---- Ansicht / Detailgrad'));
        expect(body).toContain('marker.setLatLng([customer.lat, customer.lng]);');
        expect(body).toContain('if (marker.isPopupOpen()) { positionsPending = true; continue; }');
        expect(body).toContain('renderTour({ markers: false });');
        expect(body).not.toContain('renderMarkers(');
        expect(map).toContain("map.on('popupclose', () => { if (positionsPending) setTimeout(refreshPositions, 0); });");
    });

    it('lässt Seitenleiste und Modus bei reinen Positionsänderungen in Ruhe', () => {
        const handler = sidebar.slice(sidebar.indexOf("on('customers:changed', (info) => {"));
        expect(handler.indexOf("if (info?.reason === 'positions') return;")).toBeLessThan(handler.indexOf('applyMode(state.ui.mode'));
    });
});
