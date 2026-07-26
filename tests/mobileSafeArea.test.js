import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Untere System-Navigationsleiste (Android/iOS) verdeckt das Blatt nicht', () => {
    const css = read('src/styles/responsive.css');
    const html = read('index.html');
    const sidebar = read('src/ui/sidebar.js');

    it('rendert im Edge-to-Edge-Modus (viewport-fit=cover), damit env(safe-area-*) greift', () => {
        expect(html).toMatch(/viewport-fit=cover/);
    });

    it('definiert mobil eine sichere untere Zone aus env(safe-area-inset-bottom)', () => {
        // Fallback 0px: ohne sichtbare Leiste (oder eingeklappt) kein Nachteil.
        expect(css).toContain('--safe-bottom: env(safe-area-inset-bottom, 0px)');
    });

    it('hebt das gesamte Blatt über die sichere Zone (Griff + Beispieldaten sichtbar)', () => {
        // Das Blatt sitzt auf --safe-bottom auf; der eingeklappte Peek liegt damit
        // vollständig oberhalb der Navigationsleiste. Der Peek bleibt der reine
        // Inhaltswert, sonst würde die Anhebung doppelt gezählt.
        expect(css).toContain('--mobile-sheet-peek: 46px');
        const mobileBlock = css.slice(css.indexOf('.sidebar {'));
        expect(mobileBlock).toContain('bottom: var(--safe-bottom)');
    });

    it('hebt auch die schwebenden Overlays über Peek UND sichere Zone', () => {
        // Fuchs-Pille, Straßenrouten-Umschalter und Willkommens-Hinweis hängen am
        // Peek und müssen zusätzlich die Navigationsleiste überspringen.
        // Fuchs-Pille, Lasso und Routen-Umschalter teilen sich seit dem Umbau
        // EINE Zeile – ein Abstand genügt für alle drei.
        expect(css).toContain('bottom: calc(var(--mobile-sheet-peek, 46px) + var(--safe-bottom, 0px) + 30px)'); // Knopfzeile
        expect(css).toContain('bottom: calc(var(--mobile-sheet-peek, 46px) + var(--safe-bottom, 0px) + 12px)'); // Willkommen
    });

    it('zeigt bei Beispieldaten den ganzen Upload-Streifen im eingeklappten Peek', () => {
        // Body-Klasse wird gesetzt, solange die Demo läuft …
        expect(sidebar).toContain("classList.toggle('demo-data-active', demoActive)");
        // … und hebt dann die Peek-Höhe, damit der Streifen komplett sichtbar ist.
        expect(css).toContain('body.demo-data-active {');
        const demoBlock = css.slice(css.indexOf('body.demo-data-active {'));
        expect(demoBlock).toMatch(/--mobile-sheet-peek:\s*100px/);
    });
});
