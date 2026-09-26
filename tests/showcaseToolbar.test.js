import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bestToolbarSpot, chooseToolbarLayout, focusWeight, overlapArea, toolbarCandidates, TOOLBAR_GAP } from '../src/features/showcaseToolbar.js';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const FULL = { w: 620, h: 44 };
const SMALL = { w: 200, h: 42 };

describe('Steuerleiste der Live-Schulungen: Platzwahl', () => {
    it('rechnet Überdeckung als Fläche', () => {
        expect(overlapArea(rect(0, 0, 10, 10), rect(5, 5, 20, 20))).toBe(25);
        expect(overlapArea(rect(0, 0, 10, 10), rect(10, 0, 20, 10))).toBe(0);
    });

    it('bleibt ohne Hindernis oben mittig, wie bisher', () => {
        const spot = bestToolbarSpot(FULL.w, FULL.h, 1440, 900, []);
        expect(spot).toMatchObject({ x: (1440 - FULL.w) / 2, y: TOOLBAR_GAP, cost: 0 });
    });

    it('weicht dem Kopf eines Dialogs aus, statt darauf zu liegen', () => {
        // Import-Dialog mittig, Überschrift oben: Die Leiste darf nicht auf den Kopf.
        const dialog = rect(420, 80, 1020, 560);
        const heading = rect(440, 96, 900, 130);
        const spot = bestToolbarSpot(FULL.w, FULL.h, 1440, 900, [
            { r: dialog, weight: 1 },
            { r: heading, weight: 6 }
        ]);
        expect(spot.cost).toBe(0);
        expect(overlapArea(rect(spot.x, spot.y, spot.x + FULL.w, spot.y + FULL.h), dialog)).toBe(0);
    });

    it('verdeckt nie das vorgeführte Ziel, wenn es irgendwo Platz gibt', () => {
        const target = rect(600, 0, 900, 60); // Suchfeld oben mittig
        const spot = bestToolbarSpot(FULL.w, FULL.h, 1440, 900, [{ r: target, weight: 40 }]);
        expect(overlapArea(rect(spot.x, spot.y, spot.x + FULL.w, spot.y + FULL.h), target)).toBe(0);
    });

    it('schrumpft zur Symbol-Pille, wenn ein Dialog den Schirm füllt', () => {
        // Handy: Dialog fast bildschirmfüllend, oben Überschrift, unten Knöpfe.
        const layout = chooseToolbarLayout({
            full: { w: 560, h: 44 },
            compact: SMALL,
            vw: 390,
            vh: 844,
            obstacles: [
                { r: rect(6, 6, 384, 838), weight: 1 },
                { r: rect(20, 20, 300, 60), weight: 6 },
                { r: rect(20, 770, 370, 820), weight: 6 }
            ]
        });
        expect(layout.compact).toBe(true);
    });

    it('nimmt die volle Leiste, wenn sie frei steht', () => {
        const layout = chooseToolbarLayout({ full: FULL, compact: SMALL, vw: 1440, vh: 900, obstacles: [] });
        expect(layout).toMatchObject({ compact: false, cost: 0 });
    });

    it('behandelt ein bildschirmgroßes Erklär-Element als Fläche, nicht als Klickziel', () => {
        expect(focusWeight(40 * 200, 390 * 844)).toBe(40);
        expect(focusWeight(378 * 700, 390 * 844)).toBeLessThan(6);
    });

    it('springt nicht wegen weniger Pixel hin und her', () => {
        const current = toolbarCandidates(FULL.w, FULL.h, 1440, 900)[1]; // unten mittig
        const spot = bestToolbarSpot(FULL.w, FULL.h, 1440, 900, [], current);
        expect(spot).toMatchObject({ x: current.x, y: current.y });
    });

    it('bleibt stehen, solange der Platz frei ist, und weicht erst aus, wenn er etwas verdeckt', () => {
        const current = toolbarCandidates(FULL.w, FULL.h, 1440, 900)[1];
        const elsewhere = rect(0, 0, 100, 100);
        expect(bestToolbarSpot(FULL.w, FULL.h, 1440, 900, [{ r: elsewhere, weight: 40 }], current))
            .toMatchObject({ x: current.x, y: current.y, cost: 0 });
        const onTop = rect(current.x, current.y, current.x + 50, current.y + 20);
        expect(bestToolbarSpot(FULL.w, FULL.h, 1440, 900, [{ r: onTop, weight: 40 }], current).y).not.toBe(current.y);
    });
});

describe('Steuerleiste der Live-Schulungen: Einbindung', () => {
    const showcase = readFileSync(resolve(process.cwd(), 'src/ui/showcase.js'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/styles/showcase.css'), 'utf8');

    it('sucht vor jedem gezeigten Ziel und jeder Sprechblase einen neuen Platz', () => {
        expect(showcase).toContain('setToolbarFocus(el);');
        expect(showcase).toContain('if (anchor) setToolbarFocus(anchor); else scheduleToolbarPlacement();');
        expect(showcase).toMatch(/observe\(document\.body, \{ subtree: true, attributes: true, attributeFilter: \['open', 'hidden'\] \}\)/);
    });

    it('löst Dialoge während der Schulung aus ihrem Transform-Bezugsrahmen', () => {
        expect(css).toMatch(/body\.sc-running dialog\[open\] \{\s*animation-name: sc-dialog-fade !important;\s*transform: none !important;/);
        expect(css).toMatch(/@keyframes sc-dialog-fade \{\s*from \{ opacity: 0; \}/);
    });

    it('behält in der Kompaktform zugängliche Namen für die Symbolknöpfe', () => {
        for (const name of ['Pause', 'Beenden']) expect(showcase).toContain(`aria-label="${name}"`);
        expect(css).toContain('.sc-toolbar.sc-compact .sc-txt { display: none; }');
    });
});

describe('Steuerleiste ohne „Weiter“-Knopf', () => {
    const showcase = readFileSync(resolve(process.cwd(), 'src/ui/showcase.js'), 'utf8');
    it('bietet nur Musik, Pause und Beenden an', () => {
        // „»“ übersprang nur Lesepausen, war die meiste Zeit gesperrt und
        // verkürzte den Film wegen der Mindestlaufzeit nicht – ein Knopf, bei
        // dem scheinbar nichts passiert. Eingreifen geht per Tipp auf die Fläche.
        const toolbar = showcase.slice(showcase.indexOf("toolbarEl.innerHTML = `"), showcase.indexOf('document.body.append(shieldEl, toolbarEl);'));
        expect(toolbar).not.toContain('sc-next');
        expect(toolbar).not.toContain('»');
    });
});
