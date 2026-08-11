import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Mobile Außendienst & Tour am Desktop', () => {
    it('bietet den Teaser nur einmal, nach App-Start und mit Kundendaten an', async () => {
        window.matchMedia = vi.fn((query) => ({
            matches: query.includes('min-width'),
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));
        const { canOfferMobilePreviewTeaser, shouldFocusPreviewData } = await import('../src/ui/mobilePreview.js');

        expect(canOfferMobilePreviewTeaser({
            desktop: true,
            appReady: true,
            hasCustomers: true
        })).toBe(true);
        for (const blocker of [
            { desktop: false, appReady: true, hasCustomers: true },
            { desktop: true, appReady: false, hasCustomers: true },
            { desktop: true, appReady: true, hasCustomers: false },
            { desktop: true, appReady: true, hasCustomers: true, seen: true },
            { desktop: true, appReady: true, hasCustomers: true, blocked: true }
        ]) {
            expect(canOfferMobilePreviewTeaser(blocker)).toBe(false);
        }
        expect(shouldFocusPreviewData({ requestedFocus: 'tour' })).toBe(false);
        expect(shouldFocusPreviewData({ requestedFocus: 'daten' })).toBe(true);
    });

    it('öffnet die vorbereitete Tour-Vorschau ruhig und kehrt zum Einstieg zurück', () => {
        const source = readFileSync(resolve(process.cwd(), 'src/ui/mobilePreview.js'), 'utf8');
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');

        expect(source).toContain("[FOCUS_PARAM]: 'daten'");
        expect(source).toContain('AUTO_TEASER_PREVIEW_MS = 2600');
        expect(source).toContain("PREVIEW_READY_MESSAGE = 'tourfuchs:mobile-preview-ready'");
        expect(source).toContain('type: PREVIEW_READY_MESSAGE, hasCustomers');
        expect(source).toContain("on('demo:loaded', refreshOpenPreview)");
        expect(source).toContain("on('data:imported', refreshOpenPreview)");
        expect(source).toContain("on('customers:changed'");
        expect(source).toContain("on('app:ready'");
        expect(source).toContain('showLocationHint()');
        expect(sidebar).toContain('export function showDataView(persist = false)');
        expect(sidebar).toContain('sheetMaxHeight() * 0.88');
    });

    it('startet mobil in Basis – mit Daten auf der Karte, ohne Daten im Daten-Tab', () => {
        const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');

        // Das Handy startet weiterhin auf der Karte – aber nicht mehr über
        // einen Reiter „Karte", sondern über den einzigen Zustand, der die
        // Karte freilegt: das eingeklappte Blatt. Der aktive Bereich dahinter
        // ist die Tour.
        expect(main).toContain("state.ui.activeTab = state.customers.length === 0 ? 'daten' : 'tour'");
        expect(main).toContain("if (state.customers.length === 0) showDataView(false)");
        expect(main).toContain('else showMapView(false)');
        expect(sidebar).toContain("if (isMobileUi()) depth = 'basis'");
    });

    it('zeigt nach dem Laden von Beispieldaten mobil die Karte mit eingeklapptem Blatt', () => {
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');

        // demo:loaded schaltet mobil auf die Karte (statt das Datenblatt weit zu öffnen),
        // damit die neuen Kunden sofort sichtbar sind und die Sidebar unten einklappt.
        expect(sidebar).toMatch(/on\('demo:loaded', \(\) => \{[\s\S]*if \(isMobileUi\(\)\) showMapView\(\);/);
    });

    it('lässt den Desktop-Datenbereich unverändert und gruppiert nur mobil per JS', () => {
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');

        // Desktop-kanonische Reihenfolge steht direkt im HTML (eine Spalte),
        // der Sichere Umzug bleibt im Tresor – keine Gruppen-Labels im Markup.
        expect(html).toContain('id="data-primary-actions"');
        expect(html).toContain('id="safe-transfer-actions"');
        expect(html).not.toContain('class="data-section-label"');
        // Nur mobil hängt JS dieselben Knöpfe in Gruppen um.
        expect(sidebar).toContain('export function applyDataPanelLayout');
        // Beim Wechsel der Viewport-Klasse wird die Gruppierung nachgezogen.
        const syncViewport = sidebar.slice(sidebar.indexOf('const syncViewport = () => {'), sidebar.indexOf("mobileQuery.addEventListener('change', syncViewport)"));
        expect(syncViewport).toContain('applyDataPanelLayout();');
        expect(sidebar).toContain("onFaceChange((face) => {");
    });

    it('zeigt mobil genau einen Bereich – ohne Reiterleiste', () => {
        const sidebar = readFileSync(resolve(process.cwd(), 'src/ui/sidebar.js'), 'utf8');
        const responsiveCss = readFileSync(resolve(process.cwd(), 'src/styles/responsive.css'), 'utf8');

        // Mit Daten bleibt nur die Tour. „Karte" war nie ein Bereich, sondern
        // ein zweiter Griff ans Blatt – Griff und ☰ tun dasselbe.
        expect(sidebar).toContain("const MOBILE_DATA_TABS = new Set(['tour'])");
        // Ohne Daten führt der Daten-Blick weiterhin durch das Onboarding.
        expect(sidebar).toContain("const MOBILE_EMPTY_TABS = new Set(['daten'])");
        // Ein Bereich braucht keine Reiterleiste.
        expect(responsiveCss).toContain('.sidebar .tabs { display: none; }');
        // Der Kopf-Streifen trägt nur noch die Ansichtstiefe – einzeilig.
        expect(responsiveCss).toContain('.mobile-topnav .depth-switch {');
        expect(responsiveCss).not.toContain('.mobile-topnav .tabs');
        expect(responsiveCss).not.toContain('.mobile-topnav .tab-button');
        // Die Blatt-Höhe folgt der Geometrie (Handy und Tablet hochkant).
        expect(sidebar).toContain("else if (isSheetUi() && btn.dataset.tab === 'daten')");
        expect(sidebar).toContain('setSheetHeight(Math.round(sheetMaxHeight() * 0.88), true)');
        expect(responsiveCss).toContain('touch-action: pan-y;');
        expect(responsiveCss).toContain('-webkit-overflow-scrolling: touch;');
    });

    it('benennt den mobilen Nutzen und blendet den Einstieg mobil aus', () => {
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/components.css'), 'utf8');
        const showcase = readFileSync(resolve(process.cwd(), 'src/ui/showcase.js'), 'utf8');

        expect(html).toContain('Mobile Außendienst &amp; Tour');
        expect(html).toContain('Kunden, Briefing &amp; Tour');
        // Der Einstieg entfällt genau auf dem Handy – dort ist die Vorschau
        // sinnlos. Auf dem Tablet gehört er dazu: Im Band 769–900px wurde sonst
        // die QR-Demo angeboten, deren Schritt 9 diesen Knopf braucht.
        expect(css).toContain('@media (max-width: 768px) { .mobile-preview-entry { display: none; } }');
        expect(css).not.toContain('@media (max-width: 900px) { .mobile-preview-entry { display: none; } }');
        expect(css).toContain('inset: var(--topbar-height) 0 0;');
        expect(css).toContain('calc(100dvh - var(--topbar-height) - 16px)');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(showcase).toContain('if (insideMobilePreview) return;');
    });
});
