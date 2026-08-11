import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

/**
 * Der Karte/Tour-Reiter am Handy ist gestrichen.
 *
 * Er war kein Bereichswechsel, sondern ein Blatt-Schalter: `activateTab('karte')`
 * klappte das Blatt ein, jeder andere Reiter zog es auf. Griff und „☰" tun
 * dasselbe – drei Bedienelemente für einen booleschen Zustand, zum Preis einer
 * Pillenzeile am oberen Rand. Sein einziger eigener Inhalt („In der Nähe") ist
 * geblieben und sitzt jetzt als eingeklappte Karte über dem Tour-Prozess.
 */
describe('Handy: ein Bereich statt Karte/Tour-Reiter', () => {
    const html = read('index.html');
    const sidebar = read('src/ui/sidebar.js');
    const responsive = read('src/styles/responsive.css');

    it('kennt weder Karten-Reiter noch Karten-Panel', () => {
        expect(html).not.toContain('data-tab="karte"');
        expect(html).not.toContain('id="tab-karte"');
        expect(html).not.toContain('mobile-map-tab');
        expect(sidebar).not.toContain("'karte'");
    });

    it('blendet die Reiterleiste mobil aus – am Schreibtisch bleibt sie', () => {
        expect(responsive).toContain('.sidebar .tabs { display: none; }');
        // Die Leiste selbst steht weiterhin im HTML (Daten · Filter · Gebiete · Tour).
        expect(html).toContain('<nav class="tabs" role="tablist">');
        expect(html).toContain('data-tab="daten"');
    });

    it('hebt nur noch die Ansichtstiefe in den Kopf-Streifen', () => {
        const sync = sidebar.slice(sidebar.indexOf('function syncTopnavPlacement'),
            sidebar.indexOf('function syncTopnavPlacement') + 700);
        expect(sync).toContain("document.getElementById('depth-switch')");
        expect(sync).not.toContain(".tabs");
    });

    it('trennt „Panel aktivieren" von „Blatt öffnen"', () => {
        // Sonst reißt jedes applyMode() nach einer Datenänderung das Blatt auf,
        // während der Nutzer auf der Karte arbeitet.
        const activate = sidebar.slice(sidebar.indexOf('function activateTab(tab)'),
            sidebar.indexOf('function activateTab(tab)') + 500);
        expect(activate).not.toContain('sidebarOpen');
        expect(activate).not.toContain('applySidebar');
        // Wer das Blatt will, sagt es selbst.
        const tourView = sidebar.slice(sidebar.indexOf('export function showTourView'),
            sidebar.indexOf('export function showTourView') + 320);
        expect(tourView).toContain('state.ui.sidebarOpen = true');
    });

    it('legt die Karte durch Einklappen frei, nicht durch Reiterwechsel', () => {
        const mapView = sidebar.slice(sidebar.indexOf('export function showMapView'),
            sidebar.indexOf('export function showMapView') + 320);
        expect(mapView).toContain('state.ui.sidebarOpen = false');
        expect(mapView).not.toContain('activateTab');
    });

    it('zeigt die geplante Route, wenn Griff oder ☰ die Karte freigeben', () => {
        // Früher hing das am Tipp auf den Karten-Reiter. Gemeint war immer „die
        // Karte wird frei" – und das ist das Einklappen des Blatts.
        expect(sidebar).toContain('function revealRouteOnUncover()');
        expect(sidebar).not.toContain('handleMapTabRouteReveal');
        const toggle = sidebar.slice(sidebar.indexOf('function toggleSheet()'),
            sidebar.indexOf('function toggleSheet()') + 500);
        expect(toggle).toContain('if (state.ui.sidebarOpen) revealRouteOnUncover();');
        // Nicht beim Start und nicht aus der Live-Demo: eine Geste, kein Ablauf.
        const mapView = sidebar.slice(sidebar.indexOf('export function showMapView'),
            sidebar.indexOf('export function showMapView') + 320);
        expect(mapView).not.toContain('revealRouteOnUncover');
    });

    it('startet mobil mit Daten im Tour-Bereich bei eingeklapptem Blatt', () => {
        const main = read('src/main.js');
        expect(main).toContain("state.ui.activeTab = state.customers.length === 0 ? 'daten' : 'tour'");
        expect(main).toContain('else showMapView(false)');
    });
});

describe('„In der Nähe" als Klappkarte über dem Tour-Prozess', () => {
    const html = read('index.html');
    const nearby = read('src/ui/nearby.js');
    const components = read('src/styles/components.css');

    it('steht über dem Prozess und außerhalb des Planers', () => {
        const card = html.indexOf('id="nearby-card"');
        const scope = html.indexOf('id="tour-scope"');
        const planner = html.indexOf('id="tour-planner"');
        const start = html.indexOf('data-acc="start"');
        expect(card).toBeGreaterThan(-1);
        // „Wer ist hier in der Nähe?" beantwortet man, bevor man einen Bezirk
        // wählt – die Karte darf deshalb nicht im (anfangs verborgenen) Planer
        // hängen.
        expect(card).toBeLessThan(scope);
        expect(card).toBeLessThan(planner);
        expect(card).toBeLessThan(start);
    });

    it('ist bewusst keine Prozessstufe', () => {
        // Kein `.tour-acc`: sonst landete sie in der Schrittleiste, im
        // Fokus-Modus und unter der Regel „genau ein Schritt offen" – und die
        // Prüfstrecke zählte vier Schritte statt drei.
        const card = html.slice(html.indexOf('id="nearby-card"'), html.indexOf('</div><!-- /#nearby-card -->'));
        expect(card).not.toContain('tour-acc');
        expect(card).not.toContain('data-acc=');
        const tourPanel = read('src/ui/tourPanel.js');
        expect(tourPanel).not.toContain('nearby-card');
    });

    it('startet eingeklappt und trägt die Aussage in der Zusammenfassungszeile', () => {
        expect(html).toContain('aria-expanded="false"');
        expect(html).toContain('id="acc-sum-nearby"');
        expect(nearby).toContain('ab ${fmtDist(naechster)}');
        expect(nearby).toContain('niemand in Sicht');
        // Zugeklappt ist die Karte eine Tür MIT Schild.
        expect(nearby).toContain('if (!expanded) return;');
    });

    it('zeigt erst fünf Kunden und auf Wunsch alle', () => {
        expect(nearby).toContain('const PREVIEW_ROWS = 5;');
        expect(nearby).toContain('const MAX_ROWS = 12;');
        expect(nearby).toContain('showAll ? ranked : ranked.slice(0, PREVIEW_ROWS)');
        expect(html).toContain('class="linklike near-more"');
        expect(components).toContain('.near-more');
    });

    it('behält Bezugspunkt, Briefing und Tour-Übernahme', () => {
        expect(html).toContain('data-near-origin="map"');
        expect(html).toContain('data-near-origin="gps"');
        expect(html).toContain('id="btn-near-briefing"');
        expect(nearby).toContain('data-near-add');
        // GPS erst auf ausdrücklichen Tipp – Aufklappen fragt nicht nach dem Standort.
        const setOrigin = nearby.slice(nearby.indexOf('function setOrigin'), nearby.indexOf('function setOrigin') + 400);
        expect(setOrigin).toContain("if (mode === 'gps') requestGps();");
        const setExpanded = nearby.slice(nearby.indexOf('function setExpanded'), nearby.indexOf('function setExpanded') + 400);
        expect(setExpanded).not.toContain('requestGps');
    });

    it('rechnet nur, wenn etwas davon zu sehen ist', () => {
        const visible = nearby.slice(nearby.indexOf('function isVisible()'), nearby.indexOf('function isVisible()') + 500);
        expect(visible).toContain("document.getElementById('tab-tour')");
        expect(visible).toContain('state.ui.sidebarOpen');
        // Das Blatt ist am Handy der Sichtbarkeitsschalter.
        expect(nearby).toContain("on('sheet:changed', scheduleRender)");
    });

    it('weicht im Fokus-Modus wie der übrige Vorspann', () => {
        expect(components).toContain('body.tour-focus #nearby-card');
    });
});

describe('„Was ist in meiner Nähe?" bleibt als Aktion, ohne eigenen Knopf', () => {
    const html = read('index.html');

    it('hat keinen Knopf mehr im Blatt', () => {
        expect(html).not.toContain('id="btn-nearby"');
        expect(read('src/styles/components.css')).not.toContain('.btn-nearby');
    });

    it('wird vom Fuchs und vom PWA-Kurzbefehl über ein Ereignis ausgelöst', () => {
        const sidebar = read('src/ui/sidebar.js');
        const pwa = read('src/ui/pwaLaunch.js');
        const tourPanel = read('src/ui/tourPanel.js');
        expect(sidebar).toContain("emit('tour:find-nearby')");
        expect(pwa).toContain("emit('tour:find-nearby')");
        expect(tourPanel).toContain("on('tour:find-nearby', findNearby)");
        // Kein Klick auf einen Knopf, den es nicht mehr gibt.
        expect(sidebar).not.toContain("getElementById('btn-nearby')");
        expect(pwa).not.toContain("getElementById('btn-nearby')");
    });

    it('lässt „📍 Mein Standort" als beschrifteten Weg in Schritt 1 stehen', () => {
        expect(html).toContain('id="btn-my-location"');
    });
});
