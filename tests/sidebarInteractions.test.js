import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sidebarSource = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');
const tourPanelSource = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
const searchSource = readFileSync(resolve(process.cwd(), 'src/ui/search.js'), 'utf8');
const mapSource = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
const responsiveCss = readFileSync(resolve(process.cwd(), 'src/styles/responsive.css'), 'utf8');
const contractsCss = readFileSync(resolve(process.cwd(), 'src/styles/contracts.css'), 'utf8');
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

describe('Sidebar-Bedienung', () => {
    it('lässt das Mausrad nativ durch den aktiven Inhalt scrollen', () => {
        expect(sidebarSource).not.toMatch(/addEventListener\(['"]wheel['"]/);
    });

    it('setzt den Bewegungs-Merker vor der Ignore-Rückgabe zurück (kein Doppel-Tap)', () => {
        // Nach einem Scroll-Drag darf der nächste Tap auf ein interaktives
        // Element nicht geschluckt werden: moved muss bei jedem pointerdown –
        // also VOR der Ignore-Früh-Rückgabe – zurückgesetzt werden.
        const pd = sidebarSource.indexOf("sidebar.addEventListener('pointerdown'");
        expect(pd).toBeGreaterThan(-1);
        const reset = sidebarSource.indexOf('moved = false;', pd);
        const ignore = sidebarSource.indexOf('SIDEBAR_DRAG_SCROLL_IGNORE', pd);
        expect(reset).toBeGreaterThan(pd);
        expect(reset).toBeLessThan(ignore);
    });

    it('behält die Größensteuerung an Plus, Minus und 100 Prozent', () => {
        expect(doc.querySelector('#panel-zoom-in')).not.toBeNull();
        expect(doc.querySelector('#panel-zoom-out')).not.toBeNull();
        expect(doc.querySelector('#panel-zoom-label')).not.toBeNull();
        expect(sidebarSource).toContain("document.getElementById('panel-zoom-in')?.addEventListener('click'");
        expect(sidebarSource).toContain("document.getElementById('panel-zoom-out')?.addEventListener('click'");
        expect(sidebarSource).toContain("document.getElementById('panel-zoom-label')?.addEventListener('dblclick'");
    });

    it('blendet die reine Desktop-Größensteuerung mobil aus', () => {
        expect(responsiveCss).toMatch(/@media \(max-width: 768px\)[\s\S]*?\.panel-zoom\s*{\s*display: none;/);
    });

    it('vergrößert das Panel mobil per Zwei-Finger-Geste statt per Knopf', () => {
        // Die Knöpfe sind mobil ausgeblendet, weil schwebende Bedienelemente der
        // Karte Platz nehmen. Das ist ein Argument gegen Knöpfe, nicht gegen die
        // Sache – eine Geste kostet keinen Platz. Nebenbei wird ein am
        // Schreibtisch gesetzter Zoom im gedrehten Hochformat wieder änderbar;
        // dort greifen die Knöpfe nicht mehr, --panel-zoom aber schon.
        expect(sidebarSource).toContain('function initPanelPinchZoom(');
        expect(sidebarSource).toContain('initPanelPinchZoom();');

        const start = sidebarSource.indexOf('function initPanelPinchZoom(');
        const pinch = sidebarSource.slice(start, start + 2400);
        // Nur auf dem Blatt: Dort hält `touch-action: pan-y` den Browser von
        // seiner eigenen Lupe ab. Am Schreibtisch bleibt sie unangetastet.
        expect(pinch).toContain('if (!isSheetUi() || ev.touches.length !== 2) return;');
        // Keine zweite Grenze: Es gilt weiter der Bereich aus setPanelZoom().
        expect(pinch).not.toMatch(/PANEL_ZOOM_(MIN|MAX)|0\.8|1\.5/);
        // Gespeichert wird einmal am Ende, nicht bei jeder Zwischenstellung.
        expect(pinch).toContain('setPanelZoom(currentPanelZoom(), true)');
    });

    it('hängt die Geste an die Bewegung und an die Lage, nicht an Aufsetzen und Ziel', () => {
        // Beide Regeln stammen aus einer Handprüfung am echten Browser, keine
        // davon aus dem Quelltext – und ohne sie zoomt die Geste nur manchmal:
        //
        // 1. Ein Touch-Ereignis trägt das Element des ERSTEN Fingers mit sich.
        //    Trifft der einen Akkordeon-Kopf, zeichnet dessen Klick ihn neu; das
        //    Ziel hängt dann nicht mehr im Dokument und das Ereignis ist weg.
        //    Deshalb entscheidet das Rechteck des Panels, nicht `closest()`.
        // 2. Der Zwei-Finger-`touchstart` erreicht das Blatt oft gar nicht,
        //    `touchmove` dagegen zuverlässig. Deshalb wird bei der Bewegung
        //    aktiviert, nicht beim Aufsetzen.
        const start = sidebarSource.indexOf('function initPanelPinchZoom(');
        const pinch = sidebarSource.slice(start, start + 2400);
        expect(pinch).toContain('getBoundingClientRect()');
        expect(pinch).not.toContain("closest('.tab-panel.active')");
        expect(pinch).toContain("sidebar.addEventListener('touchmove'");
        expect(pinch).not.toContain("sidebar.addEventListener('touchstart'");
        // preventDefault braucht einen nicht-passiven Zuhörer.
        expect(pinch).toContain('{ passive: false }');
    });

    it('legt die Ein-Finger-Gesten still, solange zwei Finger auf dem Panel liegen', () => {
        // Auf derselben Fläche liegen Scrollen, Höhe ziehen und das Wegwischen
        // von Experten-Abschnitten. Ohne Abbruch endet ein Aufziehen als Wischen
        // und blendet einen Abschnitt aus – die Sorte Fehler, die kein Review
        // findet, weil jede Geste für sich richtig ist.
        expect(sidebarSource).toContain('let panelPinchActive = false;');
        expect(sidebarSource).toContain('if (panelPinchActive) return;');
        expect(sidebarSource).toContain('stopDragScroll.fn?.();');
        expect(sidebarSource).toContain('export function isPanelPinching()');

        // Das Wegwischen ist die destruktive der beiden Gesten – beim
        // Zusammenziehen wandert der erste Finger nach links wie bei einem
        // Wischer. Deshalb zweifach gesichert: gar nicht erst anfangen, und
        // nicht abschließen, falls der zweite Finger erst unterwegs dazukam.
        expect(tourPanelSource).toContain('tourExpert && isPhoneUi() && !isPanelPinching()');
        const swipeStart = tourPanelSource.indexOf('function initExpertSwipeControls(');
        const swipe = tourPanelSource.slice(swipeStart, swipeStart + 2400);
        expect(swipe).toMatch(/if \(swiping\) \{[\s\S]{0,240}return;\s*\}/);
        expect(swipe).toContain('if (isPanelPinching()) return;');
    });

    it('hält den Service-Kundenscope kompakt, synchron und explizit', () => {
        const scope = doc.getElementById('service-customer-scope');
        expect(scope?.previousElementSibling?.id).toBe('mode-hint');
        expect(scope?.querySelectorAll('[data-service-customer-scope]')).toHaveLength(4);
        expect(contractsCss).toMatch(/\.service-customer-scope\s*{[\s\S]*?display:\s*grid;/);
        expect(sidebarSource).toContain("? 'now'");
        expect(sidebarSource).toContain("emit('mode:changed', mode)");
        expect(sidebarSource).toContain("emit('service-customer-scope:changed'");
        expect(sidebarSource).toContain('serviceCustomerScope: normalizedServiceCustomerScope()');
        expect(sidebarSource).toContain("if (mode === 'service') state.ui.opportunityOnly = false");
    });

    it('wendet den Service-Scope gemeinsam auf Suche und Tourplanung an', () => {
        expect(searchSource).toContain('applyServiceCustomerScope(state.customers)');
        expect(searchSource).toContain("on('mode:changed', close)");
        expect(tourPanelSource).toContain('return modeTourCustomers();');
        expect(tourPanelSource).toContain('const availableCustomers = modeVisibleCustomers();');
        expect(tourPanelSource).toContain("on('service-customer-scope:changed', refreshPlanningScope)");
        expect(tourPanelSource).not.toMatch(/on\('service-customer-scope:changed',[\s\S]{0,100}pruneTourToScope/);
        expect(sidebarSource).toContain('const shown = tourScoped ? modeTourCustomers() : modeVisibleCustomers();');
        expect(sidebarSource).toContain("on('service-customer-scope:changed', updateChancenCount)");
        expect(sidebarSource).toContain("on('tour:scope-changed', updateChancenCount)");
        expect(doc.getElementById('tour-sales-map-view')).not.toBeNull();
        expect(doc.getElementById('tour-sales-priority')).not.toBeNull();
        expect(contractsCss).toMatch(/#tour-sales-priority\[hidden\][\s\S]*?display:\s*none\s*!important;/);
        expect(tourPanelSource).toContain('syncModeSpecificTourControls();');
        expect(tourPanelSource).toContain('Außerhalb Servicefilter');
        expect(mapSource).toContain("state.ui.mode !== 'service' || state.ui.activeTab === 'tour'");
        expect(mapSource).toContain("on('tab:changed', refreshAll)");
    });

    it('verwendet die Vertriebspriorität bei der Umgebungssuche nicht im Service', () => {
        expect(tourPanelSource).toContain("const salesPriority = state.ui.mode !== 'service';");
        expect(tourPanelSource).toContain('new Set(), salesPriority)');
        expect(tourPanelSource).toContain('overdueFirst = salesPriority;');
        expect(tourPanelSource).not.toContain('Servicekunde(n) im Umkreis');
    });
});
