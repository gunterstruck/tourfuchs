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

    it('bemisst die untere Karten-Aussparung nach der tatsächlichen Blatt-Höhe', () => {
        // Statt fixer 190px: an die sichtbare Blatt-Überdeckung koppeln, damit die
        // Route bei eingeklapptem Blatt die volle Höhe bekommt.
        const fit = map.slice(map.indexOf('function fitPadding('), map.indexOf('function fitPadding(') + 1100);
        expect(fit).toContain('mapRect.bottom - sheetRect.top');
        expect(fit).toContain('Math.min(mobileBottom');
    });
});
