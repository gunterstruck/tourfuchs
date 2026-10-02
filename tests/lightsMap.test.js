import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    baseLightRadius, isLightsBasemap, LIGHT_COLORS, lightDotStyle, lightRadius, revenueReference
} from '../src/features/lightsMap.js';
import { CONFIG } from '../src/core/config.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Lichterkarte: jeder Kunde ein Lichtpunkt', () => {
    it('ist ein Kartenstil zur Wahl – dieselben OSM-Kacheln, kein neuer Dienst, nicht Standard', () => {
        const lights = CONFIG.tileLayers.lights;
        expect(lights.label).toContain('Lichterkarte');
        expect(isLightsBasemap(lights)).toBe(true);
        expect(lights.url).toBe(CONFIG.tileLayers.standard.url);
        expect(isLightsBasemap(CONFIG.tileLayers.standard)).toBe(false);
        expect(isLightsBasemap(CONFIG.tileLayers.night)).toBe(false);
        expect(read('src/core/state.js')).toContain("basemap: 'standard'");
        expect(read('src/styles/map.css')).toContain('.leaflet-layer.basemap-lights');
    });

    it('Farbe = Besuchsstatus: gelb im Rhythmus, orange bald fällig, rot überfällig', () => {
        expect(lightDotStyle({ status: 'ok', zoom: 6, revenue: 0, reference: 0 }).fillColor).toBe(LIGHT_COLORS.ok);
        expect(lightDotStyle({ status: 'none', zoom: 6 }).fillColor).toBe(LIGHT_COLORS.ok);
        expect(lightDotStyle({ status: 'faellig', zoom: 6 }).fillColor).toBe(LIGHT_COLORS.faellig);
        expect(lightDotStyle({ status: 'ueberfaellig', zoom: 6 }).fillColor).toBe(LIGHT_COLORS.ueberfaellig);
        expect(lightDotStyle({ status: 'unbekannt', zoom: 6 }).fillColor).toBe(LIGHT_COLORS.none);
    });

    it('Größe = Umsatz, gedeckelt; ein Ausreißer macht nicht alle Punkte klein', () => {
        const ref = revenueReference([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 1e9]);
        expect(ref).toBeLessThan(1e9);
        const base = baseLightRadius(6);
        expect(lightRadius(6, 0, ref)).toBeCloseTo(base * 0.8, 2);
        expect(lightRadius(6, ref, ref)).toBeCloseTo(base * 1.7, 2);
        expect(lightRadius(6, 1e9, ref)).toBeCloseTo(base * 1.7, 2);
        expect(lightRadius(6, ref / 4, ref)).toBeGreaterThan(lightRadius(6, 0, ref));
        expect(revenueReference([undefined, 'x', -5])).toBe(0);
    });

    it('wächst mit dem Zoom – weit draußen winzig, nah dran gut antippbar', () => {
        expect(baseLightRadius(5)).toBeLessThan(baseLightRadius(8));
        expect(baseLightRadius(8)).toBeLessThan(baseLightRadius(10));
        expect(baseLightRadius(10)).toBeLessThan(baseLightRadius(13));
    });

    it('Karte: Punkte statt Kacheln, Live-Demos zeigen weiter den Standard', () => {
        const map = read('src/features/map.js');
        // Auf jeder Zoomstufe zählt jeder Punkt als „auf der Karte" (Lasso, In der Nähe)
        expect(map).toContain('if (!currentView.markers && !lightsActive()) return [];');
        // keine Gebiets-Kacheln in der Lichterkarte
        expect(map).toMatch(/!currentLevelData \|\| lightsActive\(\)\) return;/);
        // Live-Demo braucht Kunden-Kacheln
        expect(map).toContain("on('showcase:running'");
        expect(map).toMatch(/showcaseRunning && isLightsBasemap\(chosen\)/);
        // Beim Zoomen keine aufgeblähten Flecken: Punkte blenden kurz aus
        expect(map).toContain("classList.add('lights-zooming')");
        expect(read('src/styles/map.css')).toMatch(/\.lights-zooming \.leaflet-lights-pane \{ opacity: 0/);
        // Antippen öffnet den Kunden wie gewohnt
        expect(map).toContain('dot.bindPopup(() => customerPopupHtml(customer)');
    });
});
