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
        // Zwei Zeilen: Hinweis mit Demo-Übersicht, darunter „In Aktion sehen" · „Eigene Daten laden".
        expect(demoBlock).toMatch(/--mobile-sheet-peek:\s*124px/);
    });
});

describe('iPhone quer: Kopfzeile bleibt seitlich frei von Notch und runden Ecken', () => {
    it('polstert die Kopfzeile links und rechts mit env(safe-area-inset-*)', () => {
        const layout = read('src/styles/layout.css');
        const topbar = layout.slice(layout.indexOf('.topbar {'), layout.indexOf('}', layout.indexOf('.topbar {')));
        expect(topbar).toContain('env(safe-area-inset-left, 0px)');
        expect(topbar).toContain('env(safe-area-inset-right, 0px)');
    });
});

describe('iPhone SE: Karten-Pillen nebeneinander, nie über einer Kachel', () => {
    const responsive = read('src/styles/responsive.css');
    const map = read('src/features/map.js');

    it('bricht die Knopfzeile am Handy nicht um, sondern lässt die Pillen schrumpfen', () => {
        expect(responsive).toContain('.map-fab-row { flex-wrap: nowrap; }');
        expect(responsive).toMatch(/\.map-fab \{\s*flex: 0 1 auto;\s*min-width: 0;/);
    });

    it('nimmt auf kleinen Telefonen den Zierfuchs aus den Pillen', () => {
        expect(responsive).toMatch(/@media \(max-width: 400px\) \{\s*\.map-fab \.mns-fox \{ display: none; \}/);
    });

    it('blendet die Knopfzeile aus, solange eine Kachel offen ist', () => {
        expect(responsive).toContain('body.map-popup-open .map-fab-row { display: none; }');
        expect(map).toContain("document.body.classList.add('map-popup-open')");
        expect(map).toContain("document.body.classList.remove('map-popup-open')");
    });
});

describe('Kleine Telefone: kompakter Text und Demo-Abschluss mit sichtbarem Countdown', () => {
    const responsive = read('src/styles/responsive.css');
    const showcase = read('src/styles/showcase.css');

    it('verkleinert auf kleinen Telefonen den Grundtext (rem-basiert)', () => {
        const tail = responsive.slice(responsive.lastIndexOf('@media (max-width: 400px) and (max-height: 700px)'));
        expect(tail).toContain('html, body { font-size: 13.5px; }');
    });

    it('stellt den Countdown-Ring neben „Als Nächstes"', () => {
        expect(showcase).toMatch(/\.sc-outcome-body \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) auto;/);
        expect(showcase).toContain('.sc-countdown { width: 66px; height: 66px; }');
    });
});
