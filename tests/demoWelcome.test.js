import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Zentraler Willkommens-Hinweis bei Beispieldaten', () => {
    const html = read('index.html');
    const welcome = read('src/ui/demoWelcome.js');
    const main = read('src/main.js');
    const wizard = read('src/ui/importWizard.js');
    const showcase = read('src/ui/showcase.js');

    it('legt eine nicht-blockierende Willkommens-Karte über die Karte', () => {
        expect(html).toContain('id="demo-welcome"');
        expect(html).toContain('id="btn-demo-welcome-own"');
        expect(html).toContain('id="btn-demo-welcome-demos"');
        expect(html).toContain('id="btn-demo-welcome-ack"');
        // Sitzt im App-Bereich hinter der Karte (nach den Toasts), nicht in der Sidebar.
        expect(html.indexOf('id="demo-welcome"')).toBeGreaterThan(html.indexOf('id="toasts"'));
    });

    it('zeigt den Hinweis nur bei aktiven Beispieldaten und noch nicht quittiert', () => {
        expect(welcome).toContain('isDemoDataset(state.customers)');
        expect(welcome).toContain("'tf_demo_welcome_ack'");
        // Jeder Weg quittiert (merken + ausblenden).
        expect(welcome).toContain('markAcknowledged()');
        // Nach bewusstem Löschen darf der Hinweis wiederkommen.
        expect(welcome).toContain("on('dataset:cleared'");
        expect(welcome).toContain('forgetAcknowledged()');
    });

    it('wird in main.js initialisiert', () => {
        expect(main).toContain('initDemoWelcome');
    });

    it('tritt auf Berührung zurück – kein Tipp läuft ins Leere', () => {
        // Gemessener Anlass: Die Karte steht mittig über Deutschland, also über
        // den Kundenstapeln. Am Schreibtisch waren 8 von 11 Stapeln nicht
        // antippbar, am Handy alle. Wer zuerst auf einen Stapel tippt, erlebte
        // „nichts passiert".
        const from = welcome.indexOf("root.querySelector('.demo-welcome-card')");
        expect(from).toBeGreaterThan(-1);
        const handler = welcome.slice(from, from + 320);
        // Die eigenen Knöpfe behalten ihre Bedeutung.
        expect(handler).toContain("ev.target.closest('button, a[href], input, select, textarea, label')");
        expect(handler).toContain('dismiss()');
        // Kein synthetischer Zweitklick an den Stapel darunter: Ein Griff, den
        // es nur in einem Zustand gibt, wäre der nächste unsichtbare Griff.
        expect(welcome).not.toContain('elementFromPoint');
    });

    it('lässt den Rahmen um die Karte weiterhin Klicks durchreichen', () => {
        // Nur die Karte selbst fängt Tipps ab; daneben bleibt die Landkarte
        // unmittelbar bedienbar (zoomen, schieben, Stapel antippen).
        const css = read('src/styles/components.css');
        const block = css.slice(css.indexOf('.demo-welcome {'), css.indexOf('.demo-welcome[hidden]'));
        expect(block).toContain('pointer-events: none;');
    });

    it('führt „Eigene Daten laden" in den geführten Upload-Dialog', () => {
        const from = wizard.indexOf("getElementById('btn-demo-welcome-own')");
        expect(from).toBeGreaterThan(-1);
        expect(wizard.slice(from, from + 160)).toContain('ownDataDialog?.showModal()');
    });

    it('führt „Live-Demos ansehen" in das Showcase-Schaufenster', () => {
        expect(showcase).toContain("'btn-demo-welcome-demos'");
    });
});

describe('Begrüßung ohne eigene Daten: Vorführung zuerst, Selbststart', () => {
    const html = read('index.html');
    const welcome = read('src/ui/demoWelcome.js');
    const showcase = read('src/ui/showcase.js');
    const onboarding = read('src/services/showcaseOnboarding.js');

    it('stellt „In Aktion sehen" vor „Eigene Daten laden"', () => {
        expect(html).toContain('Willkommen bei TourFuchs');
        expect(html.indexOf('id="btn-demo-welcome-demos"')).toBeLessThan(html.indexOf('id="btn-demo-welcome-own"'));
        expect(html).toMatch(/id="btn-demo-welcome-demos" class="primary demo-welcome-show"/);
        expect(html).toContain('mit Musik ♫');
    });

    it('begrüßt bei jedem Start ohne eigene Daten: Quittung nur für den Besuch', () => {
        expect(welcome).toContain('globalThis.sessionStorage');
        expect(welcome).not.toContain('globalThis.localStorage');
    });

    it('startet die Vorführung nach zehn Sekunden ohne Bedienung', () => {
        expect(onboarding).toContain('export const DEMO_WELCOME_AUTOSTART_SECONDS = 10;');
        expect(welcome).toContain("emit('demo-welcome:autostart')");
        expect(showcase).toContain("on('demo-welcome:autostart', () => startShowcaseLoop());");
    });

    it('bricht den Selbststart bei jeder Bedienung ab und zählt nur sichtbare Zeit', () => {
        expect(welcome).toContain("['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {\n        document.addEventListener(type, cancelAutostart, { capture: true, passive: true });");
        expect(welcome).toContain('if (!document.hidden) left -= now - last;');
        // Ein offenes Fenster ist eine Bedienung – nicht dazwischenfahren.
        expect(welcome).toContain("if (document.querySelector('dialog[open]')) return;");
    });

    it('startet mit „In Aktion sehen" direkt die erste Demo statt der Auswahl', () => {
        expect(showcase).toContain("getElementById('btn-demo-welcome-demos')?.addEventListener('click', () => startShowcaseLoop());");
    });
});

describe('Entdeck-Hinweise bei Beispieldaten wieder scharf', () => {
    const map = read('src/features/map.js');
    const sidebar = read('src/ui/sidebar.js');
    const responsive = read('src/styles/responsive.css');

    it('behandelt die Entdeck-Reise bei Beispieldaten nie als „erledigt"', () => {
        // So spielen Stapel-Wackeln & Marker-Hinweis in jedem Demo-Termin (auch
        // nach Refresh und auf dem Desktop) wieder, statt dauerhaft still zu sein.
        expect(map).toContain('if (isDemoDataset(state.customers)) return false;');
    });

    it('zeigt den „nächster Schritt"-Fuchs auch auf dem Desktop', () => {
        // Der Sonderfall „nur bei eingeklapptem Blatt" gilt überall dort, wo das
        // Panel unten liegt – also am Handy und auf dem hochkanten Tablet.
        expect(sidebar).toContain('isSheetUi() ? !state.ui.sidebarOpen : true');
        // Desktop-Styling ab 769px, damit der Knopf auch auf dem Tablet gestaltet ist.
        expect(responsive).toContain('(min-width: 769px) and (orientation: landscape)');
        const desktopBlock = responsive.slice(responsive.indexOf('@media (min-width: 1201px)'));
        expect(desktopBlock).toContain('.mobile-next-step');
    });
});
