import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

const sidebar = read('src/ui/sidebar.js');
const css = read('src/styles/responsive.css');
const config = read('vite.config.js');
const state = read('src/core/state.js');

/** Der Block, der auf dem hochkanten Tablet gilt. */
function tabletBlock() {
    const start = css.indexOf('@media (min-width: 769px) and (max-width: 1200px) and (orientation: portrait)');
    expect(start).toBeGreaterThan(-1);
    return css.slice(start);
}

describe('Tablet hochkant: Panel unten', () => {
    it('sperrt die installierte App nicht mehr aufs Hochformat', () => {
        // Die Sperre hat Tablets im Querformat ausgesperrt – genau dort, wo es
        // die bessere Arbeitsfläche ist. Geprüft wird der Schlüssel selbst;
        // der erklärende Kommentar darf den alten Wert nennen.
        expect(config).not.toMatch(/^\s*orientation:/m);
    });

    it('trennt Blatt-Geometrie von der Funktionsreduktion des Handys', () => {
        expect(sidebar).toContain("const sheetQuery = window.matchMedia(");
        expect(sidebar).toContain('(min-width: 769px) and (max-width: 1200px) and (orientation: portrait)');
        expect(sidebar).toContain('function isSheetUi()');
        expect(sidebar).toContain('function isMobileUi()');
    });

    it('behält auf dem Tablet die Desktop-Funktionen', () => {
        // Diese beiden Stellen sperren Funktionen und müssen dem Handy
        // vorbehalten bleiben – sonst verliert das Tablet Gebietsplanung,
        // Service-Fokus und die vollen Tabs. Eine Drehung würde sonst
        // laufende Arbeit (etwa eine Gebietssimulation) verwerfen.
        expect(sidebar).toContain("if (isMobileUi() || (mode === 'service' && state.ui.depth !== 'profi')) mode = 'aussendienst';");
        const tabInMode = sidebar.slice(sidebar.indexOf('function tabInMode'), sidebar.indexOf('function tabInMode') + 320);
        expect(tabInMode).toContain('if (isMobileUi())');
        expect(tabInMode).not.toContain('isSheetUi()');
    });

    it('gibt hochkant nur den Einstieg vor, nicht den Funktionsumfang', () => {
        // Basis-Tiefe ist eine Startvorgabe wie am Handy – „Profi" bleibt ein
        // Tipp entfernt, weil applyDepth davon unberührt bleibt.
        expect(sidebar).toContain("if (isMobileUi() || isPortraitTabletUi()) depth = 'basis'");
        expect(sidebar).toContain('function isPortraitTabletUi()');
        const applyDepth = sidebar.slice(sidebar.indexOf('export function applyDepth'), sidebar.indexOf('export function applyDepth') + 400);
        expect(applyDepth).not.toContain('isPortraitTabletUi');
        expect(applyDepth).not.toContain('isSheetUi');
    });

    it('startet hochkant in der Tour statt im gespeicherten Desktop-Tab', () => {
        const main = read('src/main.js');
        expect(main).toContain('const portraitTabletStartup = isSheetUi() && !phoneStartup;');
        expect(main).toContain("state.ui.activeTab = portraitTabletStartup ? 'tour' : 'karte'");
        expect(main).toContain('else if (portraitTabletStartup) showTourView(false)');
        // Auch breite Tablets (12,9" hochkant = 1024 px) sind erfasst; die alte
        // 900-px-Schwelle bleibt nur noch für gedrehte Handys stehen.
        expect(main).toContain("const phoneStartup = window.matchMedia('(max-width: 768px)').matches;");
        expect(main).toContain("const compactStartup = window.matchMedia('(max-width: 900px)').matches;");
    });

    it('lässt eine Drehung den Modus und die laufende Arbeit nicht anfassen', () => {
        // syncViewport greift nur unterhalb der Handy-Schwelle in den Modus ein.
        // Auf dem Tablet wechselt beim Drehen ausschließlich die Geometrie.
        expect(sidebar).toContain("if (isMobileUi() && state.ui.mode === 'service') applyMode('aussendienst', false);");
        const sync = sidebar.slice(sidebar.indexOf('const syncViewport = () =>'), sidebar.indexOf('const syncViewport = () =>') + 420);
        expect(sync).not.toContain('isPortraitTabletUi');
        expect(sync).not.toContain('activateTab');
    });

    it('bedient den Griff auf dem Tablet wie am Handy: ziehen ändert die Höhe', () => {
        expect(sidebar).toContain("mode = (!isSheetUi() && Math.abs(dx) > Math.abs(dy)) ? 'move' : 'resize';");
        expect(sidebar).toContain("if (mode === 'resize' && isSheetUi() && !state.ui.sidebarOpen) {");
        // Verschieben und Breite ziehen gibt es nur bei seitlichem Panel
        expect(sidebar).toContain('if (!sidebar || !pos || isSheetUi()) return;');
    });

    it('legt das Panel im CSS an den unteren Rand', () => {
        const block = tabletBlock();
        expect(block).toContain('bottom: var(--safe-bottom);');
        expect(block).toContain('width: 100%;');
        expect(block).toContain('transform: translateY(calc(100% - var(--mobile-sheet-peek)));');
        expect(block).toContain('.sidebar.open { transform: translateY(0); }');
        // Ohne diese Variablen rechnet peekPx() mit einem Ersatzwert
        expect(block).toContain('--mobile-sheet-peek:');
        expect(block).toContain('--mobile-sheet-half:');
        // Der schwebende Knopf zentriert über --sidebar-width
        expect(block).toContain('--sidebar-width: 0px;');
    });

    it('blendet aus, was ohne Seitenleiste sinnlos ist', () => {
        const block = tabletBlock();
        expect(block).toContain('.sidebar-resize,');
        expect(block).toContain('.sidebar-drag,');
        expect(block).toContain('.panel-zoom');
    });

    it('gilt nur hochkant – quer bleibt die Seitenleiste', () => {
        const block = tabletBlock();
        expect(block).toContain('(orientation: portrait)');
        // Die Handy-Regeln bleiben unangetastet
        expect(css).toContain('@media (max-width: 768px) {');
    });

    it('startet ab Tablet-Breite mit offenem Panel', () => {
        expect(state).toContain('sidebarOpen: window.innerWidth > 768');
    });

    it('zieht beim Drehen die Geometrie nach', () => {
        expect(sidebar).toContain("sheetQuery.addEventListener('change', syncViewport);");
        expect(sidebar).toContain("mobileQuery.addEventListener('change', syncViewport);");
    });

    it('gestaltet den schwebenden Knopf auch zwischen 769 und 900 Pixeln', () => {
        expect(css).toContain('@media (min-width: 769px) {');
        expect(css).not.toContain('@media (min-width: 901px) {');
    });
});
