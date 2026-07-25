import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORIES, visibleStorySteps } from '../src/features/stories.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Kartenansicht (Kunden/Status/Chancen) nur am Desktop, nicht im mobilen Tour-Flow', () => {
    const css = read('src/styles/responsive.css');

    it('blendet die Karten-Einfärbung mobil aus (Desktop bleibt unberührt)', () => {
        // Regel steht in der mobilen Media-Query.
        const mobileBlock = css.slice(css.indexOf('@media (max-width: 768px)'));
        expect(mobileBlock).toContain('#tour-sales-map-view { display: none; }');
        // Keine globale Ausblendung – Desktop behält sie.
        const beforeMedia = css.slice(0, css.indexOf('@media (max-width: 768px)'));
        expect(beforeMedia).not.toContain('#tour-sales-map-view { display: none; }');
    });

    it('überspringt die Chancen-Einfärbung der Live-Demo auf dem Handy', () => {
        const chancen = STORIES.find((s) => s.id === 'chancen');
        const chancenOn = chancen.steps.find((s) => s.key === 'chancenOn');
        expect(chancenOn.desktopOnly).toBe(true);
        // Auf dem Handy fällt der Schritt weg …
        const mobileSteps = visibleStorySteps(chancen, { isDesktop: false });
        expect(mobileSteps.some((s) => s.key === 'chancenOn')).toBe(false);
        // … am Desktop bleibt er.
        const desktopSteps = visibleStorySteps(chancen, { isDesktop: true });
        expect(desktopSteps.some((s) => s.key === 'chancenOn')).toBe(true);
    });
});
