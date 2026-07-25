import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Vorübergehende Angebote treten beim Scrollen zurück (kontextbasiert, ohne Timer)', () => {
    const mod = read('src/ui/offerAutoHide.js');
    const main = read('src/main.js');
    const css = read('src/styles/components.css');

    it('ist als eigenes Modul verdrahtet und wird initialisiert', () => {
        expect(mod).toContain('export function initOfferAutoHide');
        expect(main).toContain("import { initOfferAutoHide } from './ui/offerAutoHide.js'");
        expect(main).toContain('initOfferAutoHide()');
    });

    it('nutzt Scroll (nicht Zeit) als Auslöser und reagiert auf die Inhaltsfläche', () => {
        // Kein Timer als Auslöser: keine setInterval/Zeit-getriebene Ausblendung.
        expect(mod).not.toMatch(/setInterval/);
        // Scroll in der Capture-Phase, gebunden an die aktive Tab-Karte.
        expect(mod).toContain("addEventListener('scroll'");
        expect(mod).toContain("classList.contains('tab-panel')");
        // Hysterese: runter ausblenden, hoch wieder einblenden.
        expect(mod).toContain('setReceded(true)');
        expect(mod).toContain('setReceded(false)');
        expect(mod).toContain("classList.toggle('offers-receded'");
    });

    it('bietet Angebote beim (Wieder-)Betreten erneut an – nie dauerhaft weg', () => {
        expect(mod).toContain("on('tab:changed', () => setReceded(false))");
        expect(mod).toContain("on('mode:changed', () => setReceded(false))");
        // Auf-/Zuklappen des Blatts setzt zurück (Peek zeigt den Streifen).
        expect(mod).toContain('MutationObserver');
    });

    it('lässt in der CSS die angepinnten Angebote sanft einklappen', () => {
        expect(css).toContain('body.offers-receded .basemap-control');
        expect(css).toContain('body.offers-receded #demo-banner');
        expect(css).toMatch(/body\.offers-receded[\s\S]*max-height: 0;/);
        // Reduzierte Bewegung respektiert.
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });
});
