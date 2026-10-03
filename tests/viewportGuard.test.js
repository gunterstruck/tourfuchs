import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyViewportHeight, currentViewportHeight } from '../src/ui/viewportGuard.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('iPhone, installierte App: Statusleiste und Fensterhöhe', () => {
    it('setzt --app-height aus der Layout-Höhe und setzt eine verrutschte Seite zurück', () => {
        const scrolls = [];
        const doc = { documentElement: { clientHeight: 667, style: document.documentElement.style } };
        const win = { innerHeight: 667.4, visualViewport: { height: 420, scale: 1 }, scrollY: 40, scrollX: 0, scrollTo: (x, y) => scrolls.push([x, y]) };
        expect(currentViewportHeight(win, doc)).toBe(667); // Tastatur offen: volle Höhe behalten
        applyViewportHeight({ win, doc });
        expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('667px');
        expect(scrolls).toEqual([[0, 0]]);
    });

    it('bleibt beim Heranzoomen (iOS, Eingabefeld) bei der vollen Höhe', () => {
        const doc = { documentElement: { clientHeight: 667 } };
        const zoomed = { innerHeight: 310, visualViewport: { height: 310, scale: 2.1 } };
        expect(currentViewportHeight(zoomed, doc)).toBe(667);
    });

    it('Eingabefelder haben auf Touch-Geräten mindestens 16px (kein Auto-Zoom in iOS)', () => {
        const css = read('src/styles/responsive.css');
        const block = css.slice(css.lastIndexOf('@media (hover: none) and (pointer: coarse)'));
        expect(block).toContain('textarea');
        expect(block).toContain('font-size: max(16px, 1em) !important;');
    });

    it('die App-Höhe kommt aus --app-height, mit 100dvh als Rückfall', () => {
        expect(read('src/styles/layout.css')).toContain('height: var(--app-height, 100dvh);');
        expect(read('src/main.js')).toContain('initViewportGuard();');
    });

    it('die Kopfzeile wächst um die Statusleiste und rückt ihren Inhalt darunter', () => {
        const vars = read('src/styles/variables.css');
        expect(vars).toContain('--safe-top: env(safe-area-inset-top, 0px);');
        expect(vars).toContain('--topbar-height: calc(52px + var(--safe-top));');
        const layout = read('src/styles/layout.css');
        const topbar = layout.slice(layout.indexOf('.topbar {'), layout.indexOf('}', layout.indexOf('.topbar {')));
        expect(topbar).toContain('padding: var(--safe-top, 0px)');
    });

    it('die Willkommens-Karte ragt nie über ihren Rahmen hinaus', () => {
        const css = read('src/styles/components.css');
        const card = css.slice(css.indexOf('.demo-welcome-card {'), css.indexOf('}', css.indexOf('.demo-welcome-card {')));
        expect(card).toContain('max-height: 100%;');
        expect(card).toContain('overflow-y: auto;');
    });
});
