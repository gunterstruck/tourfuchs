import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Route-Reveal auf dem Handy: Karte frei, Tour nicht nach oben gequetscht', () => {
    const showcase = read('src/ui/showcase.js');
    const sidebar = read('src/ui/sidebar.js');
    const map = read('src/features/map.js');

    it('klappt das Blatt für den Karten-Reveal ein (Demo)', () => {
        expect(sidebar).toContain('export function collapseSheetForDemo(');
        expect(showcase).toContain('collapseSheetForDemo');
        // Sowohl beim ersten Route-Einblenden als auch beim Straßen-Umschalten.
        const focus = showcase.slice(showcase.indexOf('async focusTourRoute('), showcase.indexOf('async focusTourRoute(') + 300);
        expect(focus).toContain('collapseSheetForDemo()');
        const road = showcase.slice(showcase.indexOf('async showRoadRoute('), showcase.indexOf('async showRoadRoute(') + 900);
        expect(road).toContain('collapseSheetForDemo()');
    });

    it('zeigt die Route, ohne den Tour-Reiter zu verlassen', () => {
        // Befund: „Route auf Karte anzeigen" sprang auf dem Handy in den
        // Karten-Reiter. Nötig war das nie – frei wird die Karte, weil das Blatt
        // schließt, nicht weil der Reiter wechselt. Wer die Route ansah, verlor
        // dabei seine Stopps aus dem Blatt und fand „In der Nähe" vor.
        const view = sidebar.slice(sidebar.indexOf('export function showRouteView('),
            sidebar.indexOf('export function showRouteView(') + 260);
        expect(view).toContain('state.ui.sidebarOpen = false');
        expect(view).not.toContain('activateTab');

        const tourPanel = read('src/ui/tourPanel.js');
        const show = tourPanel.slice(tourPanel.indexOf('function showRouteOnMap('),
            tourPanel.indexOf('function showRouteOnMap(') + 900);
        expect(show).toContain('showRouteView()');
        expect(show).not.toContain('showMapView()');
    });

    it('kennt keinen versteckten Luftlinie/Straße-Umschalter am Karten-Reiter', () => {
        // Ein zweiter Tipp auf den Karten-Reiter schaltete früher die Linienart
        // um – unsichtbar, und deckungsgleich mit dem beschrifteten
        // `#btn-route-mode` über der Karte. Doppelte Griffe für dieselbe Frage
        // sind der teuerste Fund aus dem Gestaltprinzip (§2.4).
        const reveal = sidebar.slice(sidebar.indexOf('function handleMapTabRouteReveal('),
            sidebar.indexOf('function handleMapTabRouteReveal(') + 400);
        expect(reveal).not.toContain("=== 'road' ? 'air' : 'road'");
        expect(sidebar).not.toContain('handleMapTabRouteToggle');
    });

    it('bemisst die untere Karten-Aussparung nach der tatsächlichen Blatt-Höhe', () => {
        // Statt fixer 190px: an die sichtbare Blatt-Überdeckung koppeln, damit die
        // Route bei eingeklapptem Blatt die volle Höhe bekommt.
        const fit = map.slice(map.indexOf('function fitPadding('), map.indexOf('function fitPadding(') + 1100);
        expect(fit).toContain('mapRect.bottom - sheetRect.top');
        expect(fit).toContain('Math.min(mobileBottom');
    });
});
