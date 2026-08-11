/**
 * Zwei Gesichter, kein drittes.
 *
 * Diese Datei hieß „Tablet hochkant: Panel unten" und schrieb die Entscheidung
 * vom 31.07.2026 fest: hochkant mobiler Einstieg, aber **voller** Desktop-
 * Funktionsumfang. Auf einem Galaxy Tab S6 Lite (~800 px hochkant) war das
 * Ergebnis ein Zwitter – Blatt unten, aber Desktop-Kartenpopups, Desktop-
 * Tourpanel und offenes Cockpit. Der Nutzer hat es am Gerät gesehen.
 *
 * Seit Version 3.2 gibt es genau zwei Gesichter, und dieser Test bewacht, dass
 * es dabei bleibt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PHONE_FACE_MEDIA } from '../src/core/viewport.js';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

const sidebar = read('src/ui/sidebar.js');
const css = read('src/styles/responsive.css');
const config = read('vite.config.js');
const main = read('src/main.js');
const viewport = read('src/core/viewport.js');

/** Der Aufsatz-Block für die größere Fläche eines hochkanten Tablets. */
function tabletBlock() {
    const start = css.indexOf('@media (min-width: 769px) and (max-width: 1200px) and (orientation: portrait)');
    expect(start).toBeGreaterThan(-1);
    return css.slice(start);
}

describe('Zwei Gesichter: Touransicht und Schreibtisch', () => {
    it('sperrt die installierte App nicht mehr aufs Hochformat', () => {
        expect(config).not.toMatch(/^\s*orientation:/m);
    });

    it('befreit auch Altinstallationen, die die Sperre geerbt haben', () => {
        // Eine installierte PWA behält das Manifest ihres Installations-
        // zeitpunkts. Ohne diesen Aufruf bleibt jedes vor dem 26.07.2026
        // eingerichtete Gerät im Hochformat gefangen – nachgewiesen auf einem
        // Galaxy Tab S6 Lite.
        expect(viewport).toContain('screen?.orientation?.unlock?.()');
        expect(main).toContain('releaseInheritedOrientationLock();');
    });

    it('kennt nur noch einen Begriff für „mobil"', () => {
        // Vorher: isMobileUi (Funktionen, 768) UND isSheetUi (Geometrie, 1200
        // hochkant) UND isPortraitTabletUi dazwischen. Genau der Spalt war der
        // Zwitter.
        expect(sidebar).toContain('function isMobileUi() {\n    return isPhoneUi();');
        expect(sidebar).toContain('export function isSheetUi() {\n    return isPhoneUi();');
        expect(sidebar).not.toContain('isPortraitTabletUi');
        expect(sidebar).not.toContain("matchMedia('(max-width: 768px)')");
    });

    it('nimmt dem hochkanten Tablet dieselben Funktionen wie dem Handy', () => {
        // Diese beiden Stellen reduzieren den Funktionsumfang. Weil isMobileUi
        // jetzt auch hochkant gilt, greifen sie dort mit – Absicht.
        expect(sidebar).toContain("if (isMobileUi() || (mode === 'service' && state.ui.depth !== 'profi')) mode = 'aussendienst';");
        const tabInMode = sidebar.slice(sidebar.indexOf('function tabInMode'), sidebar.indexOf('function tabInMode') + 320);
        expect(tabInMode).toContain('if (isMobileUi())');
    });

    it('startet hochkant exakt wie das Handy – kein eigener Tablet-Einstieg', () => {
        expect(main).toContain('const tourFace = isPhoneUi();');
        expect(main).toContain("state.ui.activeTab = state.customers.length === 0 ? 'daten' : 'tour';");
        // Die drei alten Startweichen sind weg.
        expect(main).not.toContain('portraitTabletStartup');
        expect(main).not.toContain('compactStartup');
        expect(main).not.toContain('phoneStartup');
    });

    it('setzt beim Drehen die Darstellung zurück, aber nicht die Arbeit', () => {
        expect(sidebar).toContain('onFaceChange((face) => {');
        expect(sidebar).toContain("if (face === 'phone') applyDepth('basis', false);");
        expect(sidebar).toContain('applyMode(state.ui.mode, false, false);');
        // Eine Drehung darf niemals Kunden, Tour oder Bezirk anfassen.
        const handler = sidebar.slice(sidebar.indexOf('onFaceChange((face) => {'), sidebar.indexOf('onFaceChange((face) => {') + 400);
        expect(handler).not.toContain('state.tour');
        expect(handler).not.toContain('setCustomers');
        expect(handler).not.toContain('reload');
    });

    it('zieht dieselbe Grenze in CSS und JavaScript', () => {
        // Die schärfste Fassung dieser Prüfung: Das CSS muss genau die
        // Zeichenkette enthalten, die viewport.js exportiert – Teil für Teil.
        // Laufen die beiden auseinander, ist der Zwitter zurück.
        for (const clause of PHONE_FACE_MEDIA.split(',').map((part) => part.trim())) {
            expect(css).toContain(clause);
        }
    });

    it('legt das Panel im CSS an den unteren Rand', () => {
        const block = tabletBlock();
        expect(block).toContain('bottom: var(--safe-bottom);');
        expect(block).toContain('width: 100%;');
        expect(block).toContain('transform: translateY(calc(100% - var(--mobile-sheet-peek)));');
        expect(block).toContain('.sidebar.open { transform: translateY(0); }');
        expect(block).toContain('--mobile-sheet-peek:');
        expect(block).toContain('--mobile-sheet-half:');
        expect(block).toContain('--sidebar-width: 0px;');
    });

    it('blendet aus, was ohne Seitenleiste sinnlos ist', () => {
        const block = tabletBlock();
        expect(block).toContain('.sidebar-resize,');
        expect(block).toContain('.sidebar-drag,');
        expect(block).toContain('.panel-zoom');
    });

    it('gilt nur hochkant – quer bleibt der Schreibtisch', () => {
        expect(tabletBlock()).toContain('(orientation: portrait)');
        // Der Schreibtisch-Block darf hochkant nicht mitgreifen.
        expect(css).toContain('(min-width: 769px) and (orientation: landscape)');
    });

    it('bedient den Griff auf dem Tablet wie am Handy: ziehen ändert die Höhe', () => {
        expect(sidebar).toContain("mode = (!isSheetUi() && Math.abs(dx) > Math.abs(dy)) ? 'move' : 'resize';");
        expect(sidebar).toContain("if (mode === 'resize' && isSheetUi() && !state.ui.sidebarOpen) {");
        expect(sidebar).toContain('if (!sidebar || !pos || isSheetUi()) return;');
    });

    it('startet im Schreibtisch mit offenem Panel, in der Touransicht geschlossen', () => {
        expect(read('src/core/state.js')).toContain('sidebarOpen: !isPhoneUi()');
    });

    it('hängt die Karten-Knopfzeile unter den Kopf-Streifen, nicht unter die Topbar', () => {
        // Der Befund (touch-check, 01.08.2026): Auf dem hochkanten Tablet wandert
        // die Knopfzeile an den oberen Kartenrand, weil unten das Blatt steht.
        // Dort lag aber schon der schwebende Kopf-Streifen mit Basis/Profi und
        // den Reitern – aus genau demselben Grund. Gegen `--topbar-height`
        // gerechnet landete der Lasso-Knopf hinter der Basis/Profi-Pille und
        // ließ sich nicht mehr antippen. Zwei richtige Entscheidungen, ein Platz.
        const block = tabletBlock();
        const regel = block.slice(block.indexOf('.map-fab-row'));
        expect(regel).toContain('var(--mobile-topnav-bottom, var(--topbar-height))');
        // Die Unterkante wird gemessen, nicht geschätzt: Der Streifen ist mal
        // ein-, mal zweizeilig und im Onboarding gar nicht da.
        expect(sidebar).toContain("style.setProperty('--mobile-topnav-bottom'");
        expect(sidebar).toContain('new ResizeObserver(syncTopnavMetrics)');
    });
});
