import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Tour-Aktionen: Scan als Einstieg, Navigation prominent, Desktop-Timeline', () => {
    const html = read('index.html');
    const responsive = read('src/styles/responsive.css');
    const components = read('src/styles/components.css');

    it('holt „Tour vom Desktop scannen" nach oben in die Einstiegszone (nur Handy)', () => {
        // Der Scan-Knopf steht in der Einstiegszone – nach der Klappkarte
        // „In der Nähe", nicht unten in der „Meine Tour"-Aktionsliste.
        expect(html).toMatch(/id="btn-tour-scan"[^>]*class="[^"]*only-mobile[^"]*btn-scan-entry/);
        const scanIdx = html.indexOf('id="btn-tour-scan"');
        const nearbyIdx = html.indexOf('id="nearby-card"');
        const optimizeIdx = html.indexOf('id="btn-optimize"'); // erster Knopf des Aktionsstapels
        expect(nearbyIdx).toBeGreaterThan(-1);
        expect(scanIdx).toBeGreaterThan(nearbyIdx);   // direkt nach „In der Nähe"
        expect(scanIdx).toBeLessThan(optimizeIdx);     // nicht mehr im Aktionsstapel
    });

    it('blendet den Scan-Einstieg im Fokus-Modus aus und stylt ihn sekundär', () => {
        // Fokus-Regeln liegen jetzt in components.css (gelten Handy + Desktop).
        expect(components).toContain('body.tour-focus #btn-tour-scan');
        expect(responsive).toContain('.btn-scan-entry');
    });

    it('lässt den Scan-Einstieg immer erreichbar – schmal mit Start, als 📷 im Fokus-Modus', () => {
        // Steht ein Start, wird er nur schmaler – nicht mehr ausgeblendet.
        expect(responsive).toMatch(/body\.tour-has-start #tab-tour\.active #btn-tour-scan \{\s*padding/);
        expect(responsive).not.toContain('body.tour-has-start #tab-tour.active #btn-tour-scan { display: none; }');
        // Vor dem Planer: auch ohne planbare Kunden sichtbar.
        expect(html.indexOf('id="btn-tour-scan"')).toBeLessThan(html.indexOf('id="tour-planner"'));
        // Fokus-Modus: 📷 in der Schrittleiste.
        expect(html).toMatch(/class="tour-step-scan only-mobile" data-tour-scan/);
        expect(components).toContain('body.tour-focus .tour-step-scan');
        // „Eigene Daten laden": eigener Weg für Empfänger ohne Kundendaten.
        const dialog = html.slice(html.indexOf('id="own-data-dialog"'), html.indexOf('id="import-insight-dialog"'));
        expect(dialog).toContain('data-tour-scan');
        expect(read('src/ui/tourQr.js')).toContain("querySelectorAll('[data-tour-scan]')");
    });

    it('macht Navigation zur Hauptaktion und bündelt die übrigen Ausgaben', () => {
        expect(html).toMatch(/id="btn-gmaps"[^>]*class="primary"/);
        expect(html).not.toMatch(/id="btn-optimize"[^>]*class="primary"/);
        const routeActionsStart = html.indexOf('class="tour-route-actions"');
        const routeActionsEnd = html.indexOf('</div>', routeActionsStart);
        const routeActions = html.slice(routeActionsStart, routeActionsEnd);
        expect(routeActions).toContain('id="btn-optimize"');
        expect(routeActions).toContain('id="btn-route-focus"');
        expect(routeActions.indexOf('btn-optimize')).toBeLessThan(routeActions.indexOf('btn-route-focus'));
        const groupStart = html.indexOf('id="tour-share-actions"');
        const groupEnd = html.indexOf('</details>', groupStart);
        const group = html.slice(groupStart, groupEnd);
        expect(group).toContain('data-i18n="tour.action.shareExport"');
        for (const id of [
            'btn-tour-qr',
            'btn-tour-qr-phone',
            'btn-tour-print',
            'btn-tour-ics',
            'btn-tour-copy',
            'btn-day-review',
            'btn-visit-report'
        ]) expect(group).toContain(`id="${id}"`);
        expect(group).not.toContain('id="btn-route-focus"');
        expect(html).toMatch(/id="btn-tour-qr"[^>]*class="[^"]*only-desktop[^"]*qr-handoff/);
        const gmapsIdx = html.indexOf('id="btn-gmaps"');
        expect(routeActionsStart).toBeLessThan(gmapsIdx);
        expect(groupStart).toBeGreaterThan(gmapsIdx);
        expect(components).toContain('.tour-route-actions');
        expect(components).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
        expect(components).toContain('.tour-share-actions > summary');
        expect(components).not.toContain('.qr-handoff:not(:disabled)');
    });

    it('hält „Tour leeren" oben erreichbar und kehrt zur normalen Karte zurück', () => {
        const panel = read('src/ui/tourPanel.js');
        const mineStart = html.indexOf('data-acc="mytour"');
        const stopsIdx = html.indexOf('id="tour-stops"', mineStart);
        const clearIdx = html.indexOf('id="btn-tour-clear"', mineStart);
        expect(clearIdx).toBeGreaterThan(mineStart);
        expect(clearIdx).toBeLessThan(stopsIdx);
        expect(html).toContain('class="tour-clear-action"');
        expect(responsive).toContain('[data-acc="mytour"] .tour-quick-actions');
        expect(panel).toContain('state.tour.mapFocus = false;');
        expect(panel).toContain('showMapView(false);');
        expect(panel).toContain("showToast(t('tour.toast.cleared')");
    });

    it('kennzeichnet das Ziel ruhig violett statt als rote Warnung', () => {
        expect(components).toContain('.stop-row.dest-row { background: #f5f3ff;');
        expect(components).toContain('.stop-row.dest-row .stop-num { background: #7c3aed; }');
        expect(components).toContain('background: #ede9fe;');
        expect(components).not.toContain('.stop-row.dest-row { background: #fef2f2;');
    });

    it.each([
        ['de', 'Teilen & Exportieren'],
        ['en', 'Share & export'],
        ['fr', 'Partager et exporter'],
        ['es', 'Compartir y exportar']
    ])('übersetzt die Aktionsgruppe auf %s', (locale, label) => {
        const messages = read('src/i18n/tourMessages.js');
        expect(messages).toContain(`'tour.action.shareExport': '${label}'`);
    });

    it.each([
        ['de', '⚡ Optimieren', '🗺️ Tour anzeigen'],
        ['en', '⚡ Optimise', '🗺️ Show tour'],
        ['fr', '⚡ Optimiser', '🗺️ Voir la tournée'],
        ['es', '⚡ Optimizar', '🗺️ Ver ruta']
    ])('hält die beiden direkten Touraktionen auf %s kurz', (locale, optimize, showTour) => {
        const messages = read('src/i18n/tourMessages.js');
        expect(messages).toContain(`'tour.action.optimize': '${optimize}'`);
        expect(messages).toContain(`'tour.action.showRoute': '${showTour}'`);
    });

    it('übersetzt auch den dynamischen Feierabend-Knopf', () => {
        const review = read('src/ui/dayReview.js');
        expect(html).toContain('data-i18n="tour.action.dayReview"');
        expect(review).toContain("t('tour.action.dayReviewCount'");
        expect(review).toContain("on('locale:changed', syncButton)");
    });

    it('lässt den gewählten Startpunkt wieder entfernen (nicht nur ersetzen)', () => {
        const panel = read('src/ui/tourPanel.js');
        // Die Start-Chip trägt einen Entfernen-Knopf, der den Start auf null setzt.
        expect(panel).toContain('id="btn-start-clear"');
        const from = panel.indexOf('function renderStart');
        const block = panel.slice(from, panel.indexOf('\nfunction ', from + 10));
        expect(block).toContain("getElementById('btn-start-clear')");
        expect(block).toContain('state.tour.start = null;');
        expect(block).toContain("emit('tour:changed')");
    });

    it('bringt die grüne Tourlinie auch auf den Desktop', () => {
        expect(components).toContain('.stop-row::before');
        expect(components).toContain('.stop-row.stop-first::before { top: 50%; }');
        expect(components).toContain('.stop-row.stop-last::before { bottom: 50%; }');
        // Punkt liegt über der Linie, mit hellem Ring.
        expect(components).toMatch(/\.stop-num \{[\s\S]*z-index: 1;/);
    });
});

describe('Tour per QR von Handy zu Handy', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    it('zeigt am Handy denselben QR-Weg – bewusst ohne Versand-Link', () => {
        expect(html).toMatch(/id="btn-tour-qr-phone"[^>]*class="[^"]*only-mobile[^"]*qr-handoff/);
        expect(html).toContain('📲 Tour per QR teilen');
        expect(html).toContain('📷 Tour per QR übernehmen');
        expect(html).not.toMatch(/navigator\.share|qr-share-send/);
    });
});
