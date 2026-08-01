import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Schwebender „nächster Schritt"-Fuchs (Desktop + mobil)', () => {
    const html = read('index.html');
    const css = read('src/styles/responsive.css');
    const sidebar = read('src/ui/sidebar.js');
    const components = read('src/styles/components.css');

    it('ist ein eigenes Element, getrennt vom Blatt', () => {
        expect(html).toContain('id="mobile-next-step"');
        expect(html).toContain('class="mns-label"');
        // Der Knopf liegt außerhalb der <aside id="sidebar"> – bewusst getrennt.
        const asideEnd = html.indexOf('</aside>');
        expect(html.indexOf('id="mobile-next-step"')).toBeGreaterThan(asideEnd);
    });

    it('schwebt mobil deutlich über der Griff-Leiste (kein Überlagern des Blatts)', () => {
        // Platzierung und Aussehen kommen seit der gemeinsamen Knopfzeile aus
        // `.map-fab-row` / `.map-fab` – der Fuchs teilt sie sich mit dem
        // Lasso-Knopf. Der klare Abstand zum eingeklappten Blatt bleibt.
        expect(css).toContain('.map-fab-row {');
        expect(css).toContain('bottom: calc(var(--mobile-sheet-peek, 46px) + var(--safe-bottom, 0px) + 30px)');
        expect(css).toMatch(/max-width: 4\d vw|max-width: 4\dvw/); // nicht die volle Breite
    });

    it('erscheint jetzt auch auf dem Desktop (kein pauschales Ausblenden mehr)', () => {
        // Der frühere Hard-Hide ab 769px ist entfernt; die Platzierung unten
        // mittig über der Karte liefert die gemeinsame Knopfzeile.
        // Nur der pauschale Hard-Hide ist weg – die Demo-Ausnahme
        // (body.sc-running) blendet weiterhin aus und muss bleiben.
        expect(css).not.toContain('\n    .mobile-next-step { display: none !important; }');
        expect(css).toContain('(min-width: 769px) and (orientation: landscape)');
        const desktopBlock = css.slice(css.indexOf('@media (min-width: 1201px)'));
        expect(desktopBlock).toContain('.mobile-next-step {');
        expect(components).toContain('.map-fab-row {');
        expect(components).toContain('position: fixed');
    });

    it('ruht während einer laufenden Live-Demo (kein Überlagern der Vorführung)', () => {
        const showcase = read('src/ui/showcase.js');
        expect(css).toContain('body.sc-running .mobile-next-step { display: none !important; }');
        expect(showcase).toContain("classList.add('sc-running')");
        expect(showcase).toContain("classList.remove('sc-running')");
    });

    it('führt als Kette durch den Flow und mobil nur bei zugeklapptem Blatt', () => {
        expect(sidebar).toContain('function updateMobileNextStep');
        // Bei unten liegendem Blatt (Handy, Tablet hochkant) nur zugeklappt,
        // bei seitlichem Panel immer.
        expect(sidebar).toContain('isSheetUi() ? !state.ui.sidebarOpen : true');
        expect(sidebar).toContain("state.ui.mode === 'aussendienst'");
        // Drei Kettenschritte: Nähe → Tour ab hier planen → Route auf die Karte.
        expect(sidebar).toContain('Kunden in meiner Nähe');
        expect(sidebar).toContain('Tour ab hier planen');
        expect(sidebar).toContain('Route auf die Karte');
        // „Planen" führt mit gesetztem Start ins Tour-Blatt.
        expect(sidebar).toContain('function goToTourPlanning');
        expect(sidebar).toContain("activateTab('tour')");
        // Funktionsspezifische Icons statt Fuchs als Haupt-Icon.
        expect(html).toContain('class="mns-icon"');
        expect(sidebar).toContain('function initMobileNextStep');
    });

    it('weicht der Straßenroute-Leiste, sobald die Route auf der Karte liegt', () => {
        // Bug: Bei liegender Route fiel der Nudge auf den Default „Nähe" zurück
        // und überdeckte die Route-Leiste. Jetzt aus dem State gelesen und weg.
        expect(sidebar).toContain('const routeShown = state.tour.mapFocus && !!state.tour.start');
        expect(sidebar).toContain('&& !routeShown');
        // Kein DOM-Wettrennen mehr über den versteckten Route-Balken.
        expect(sidebar).not.toContain("const routeVisible = !document.getElementById('route-mode-bar')");
    });
});

describe('Blatt wieder vollständig einklappbar (mobil)', () => {
    const sidebar = read('src/ui/sidebar.js');

    it('klappt beim Ziehen bis zum Boden ganz zu, statt bei der Mindesthöhe zu hängen', () => {
        expect(sidebar).toContain('function collapseSheetFully');
        // Beim Ziehen wird die ungeklammerte Wunschhöhe verfolgt.
        expect(sidebar).toContain('rawHeight = startH - dy');
        // Unter der Mindesthöhe = ganz einklappen.
        expect(sidebar).toContain('rawHeight <= SHEET_MIN_HEIGHT');
        expect(sidebar).toContain("sidebar?.classList.remove('sheet-sized')");
    });
});
