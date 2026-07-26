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
        // Diese drei Stellen reduzieren den Funktionsumfang und müssen dem
        // Handy vorbehalten bleiben – sonst verliert das Tablet Profi,
        // Service-Fokus und die vollen Tabs.
        expect(sidebar).toContain('if (isMobileUi()) depth = ');
        expect(sidebar).toContain("if (isMobileUi() || (mode === 'service' && state.ui.depth !== 'profi')) mode = 'aussendienst';");
        const tabInMode = sidebar.slice(sidebar.indexOf('function tabInMode'), sidebar.indexOf('function tabInMode') + 320);
        expect(tabInMode).toContain('if (isMobileUi())');
        expect(tabInMode).not.toContain('isSheetUi()');
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
