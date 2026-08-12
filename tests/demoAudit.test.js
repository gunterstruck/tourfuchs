/**
 * Absicherung der Befunde aus dem Demo-Prüflauf vom 26.07.2026
 * (alle Live-Demos in vier Formaten in der echten App durchgefahren).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORIES, storyDuration, visibleStorySteps } from '../src/features/stories.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Schwellenwerte passen zueinander', () => {
    it('bietet keine Demo an, deren Bedienelement in dieser Breite fehlt', () => {
        // Befund: handy-qr wurde ab 769px angeboten, #btn-mobile-preview war
        // aber erst ab 901px sichtbar. Auf dem Tablet hochkant (834px) brach
        // die Demo bei Schritt 9/18 ab.
        const css = read('src/styles/components.css');
        const stories = read('src/features/stories.js');

        const usesPreview = STORIES.find((s) => s.id === 'handy-qr')
            .steps.some((step) => step.sel === '#btn-mobile-preview');
        expect(usesPreview).toBe(true);

        // Die Demo ist desktopOnly, also ab 769px sichtbar – der Knopf muss
        // dieselbe Grenze haben.
        expect(stories).toContain('desktopOnly: true,   // Übergabe Desktop -> Handy');
        expect(css).toContain('@media (max-width: 768px) { .mobile-preview-entry { display: none; } }');
    });

    it('deckt die Kachel-Cacheregel alle angebotenen Kartenquellen ab', () => {
        // Befund: Standardebene ist OpenStreetMap, gecacht wurde nur CARTO –
        // für den Normalfall wurde also gar nichts offline vorgehalten.
        const config = read('src/core/config.js');
        const vite = read('vite.config.js');
        const state = read('src/core/state.js');

        const hosts = [...config.matchAll(/url: 'https:\/\/(?:\{s\}\.)?([a-z0-9.-]+)/g)].map((m) => m[1]);
        const tileHosts = hosts.filter((h) => /tile|basemaps|arcgisonline/.test(h));
        expect(tileHosts.length).toBeGreaterThanOrEqual(3);

        const rule = vite.slice(vite.indexOf('urlPattern: /^https:\\/\\/('), vite.indexOf('cacheName: \'map-tiles\''));
        for (const host of tileHosts) {
            const bare = host.replace(/\./g, '\\.');
            expect(rule, `Kachelquelle ${host} fehlt in der Cacheregel`).toContain(bare);
        }
        // Die Standardebene ist die, auf die es besonders ankommt
        expect(state).toContain("basemap: 'standard'");
        expect(rule).toContain('tile\\.openstreetmap\\.org');
    });
});

describe('Offenlegung der Kartenquellen', () => {
    it('nennt jede anwählbare Kartenebene in Datenschutz und README', () => {
        // Befund: Die Kartenauswahl bietet auch „Satellit" von Esri an; die
        // Datenschutzerklärung nannte nur OpenStreetMap und CARTO. Die
        // Definition of Done verlangt die Offenlegung jeder externen Verbindung.
        const config = read('src/core/config.js');
        const privacy = read('public/datenschutz.html');
        const readme = read('README.md');
        const sidebar = read('src/ui/sidebar.js');

        // Alle konfigurierten Ebenen landen in der Auswahl
        expect(sidebar).toContain('Object.entries(CONFIG.tileLayers');

        const hosts = [...config.matchAll(/url: 'https:\/\/(?:\{s\}\.)?([a-z0-9.-]+)/g)]
            .map((m) => m[1])
            .filter((h) => /tile|basemaps|arcgisonline/.test(h));

        for (const host of hosts) {
            const anbieter = host.includes('cartocdn') ? 'CARTO'
                : host.includes('openstreetmap') ? 'OpenStreetMap'
                    : 'Esri';
            expect(privacy, `${host} (${anbieter}) fehlt in der Datenschutzerklärung`).toContain(anbieter);
            expect(readme, `${host} (${anbieter}) fehlt im README`).toContain(anbieter);
        }
        // Der Host der am wenigsten offensichtlichen Quelle steht ausdrücklich da
        expect(privacy).toContain('server.arcgisonline.com');
    });
});

describe('Versprochene Laufzeiten', () => {
    it('nennt dem Handy die Handy-Laufzeit, wo es weniger Schritte sieht', () => {
        // Befund: excel-karte dauert am Desktop 48 s, am Handy 31 s – das Panel
        // versprach beiden dieselbe Zahl.
        const mapStory = STORIES.find((s) => s.id === 'excel-karte');
        expect(mapStory.durationMobile).toBeLessThan(mapStory.duration);
        expect(storyDuration(mapStory, { isDesktop: true })).toBe(mapStory.duration);
        expect(storyDuration(mapStory, { isDesktop: false })).toBe(mapStory.durationMobile);

        // Wo das Handy weniger Schritte sieht, MUSS es eine eigene Zahl geben
        for (const story of STORIES) {
            if (story.desktopOnly || story.mobileOnly) continue;
            const desktopSteps = visibleStorySteps(story, { isDesktop: true }).length;
            const mobileSteps = visibleStorySteps(story, { isDesktop: false }).length;
            if (mobileSteps < desktopSteps) {
                expect(story.durationMobile, `${story.id} zeigt am Handy weniger Schritte, verspricht aber dieselbe Zeit`)
                    .toBeGreaterThan(0);
            }
        }
    });

    it('nutzt das Demo-Panel die geräteabhängige Angabe', () => {
        const showcase = read('src/ui/showcase.js');
        expect(showcase).toContain('storyDuration(s, { isDesktop:');
        expect(showcase).not.toContain('ca. ${s.duration || 25}');
    });

    it('hält die gemessenen Werte fest, damit sie nachvollziehbar bleiben', () => {
        const stories = read('src/features/stories.js');
        // Datum und Ergebnis des Laufs stehen im Kopf der Datei: Wer die Zahlen
        // anzweifelt, soll sehen, wann und womit sie entstanden sind.
        expect(stories).toContain('Zuletzt gemessen am 11.08.2026');
        expect(stories).toContain('28 Durchläufe, 28 ok, 0 Abbrüche, 0 Klickmängel');
        // Gestiegene Zahlen brauchen einen Grund im selben Text – sonst liest
        // sich eine längere Vorführung wie ein Versehen.
        expect(stories).toContain('das Aussuchen jetzt wirklich zeigt');
        // Nachmessungen einzelner Stories stehen daneben, mit demselben Anspruch.
        expect(stories).toContain('Nachgemessen am 12.08.2026, nur „lasso"');
        // Keine Story ohne Laufzeitangabe
        for (const story of STORIES) expect(story.duration).toBeGreaterThan(0);
    });

    it('verspricht mit eigenen Daten die Laufzeit, die dann wirklich gilt', () => {
        // Die Lasso-Demo zeigt mit eigenen Kunden zusätzlich den echten Prompt
        // (`realOnly`) – gemessen 61 s gegen 51 s mit der Kulisse. Ohne eigene
        // Zahl verspräche das Panel ausgerechnet dem Nutzer mit Daten zehn
        // Sekunden zu wenig.
        const lasso = STORIES.find((story) => story.id === 'lasso');
        expect(lasso.durationOwnData).toBeGreaterThan(lasso.duration);
        expect(storyDuration(lasso, { hasOwnData: true })).toBe(lasso.durationOwnData);
        expect(storyDuration(lasso, { hasOwnData: false })).toBe(lasso.duration);

        // Wo Schritte an der Datenlage hängen, MUSS es die zweite Zahl geben.
        for (const story of STORIES) {
            const hatRealOnly = story.steps.some((step) => step.realOnly);
            if (hatRealOnly) {
                expect(story.durationOwnData, `${story.id} zeigt mit eigenen Daten mehr Schritte, verspricht aber dieselbe Zeit`)
                    .toBeGreaterThan(0);
            }
        }

        // Und das Panel muss die Angabe auch abfragen.
        const showcase = read('src/ui/showcase.js');
        expect(showcase).toContain('hasOwnData: hasOwnCustomers()');
    });
});

describe('Der Geister-Cursor klickt Sichtbares', () => {
    it('wählt bei mehreren Kartenkacheln die mittigste, ganz sichtbare', () => {
        // Befund: Die Demo klickte die erste Kachel im DOM – die klebte am
        // unteren Bildrand und war angeschnitten.
        const showcase = read('src/ui/showcase.js');
        expect(showcase).toContain('function pickMostCentral');
        const picker = showcase.slice(showcase.indexOf('function pickMostCentral'), showcase.indexOf('// ---- Cursor-Bewegung'));
        expect(picker).toContain('r.bottom > window.innerHeight');
        expect(picker).toContain('r.top < 0');
        const opener = showcase.slice(showcase.indexOf('async openCustomerCard()'), showcase.indexOf('async openCustomerCard()') + 900);
        expect(opener).toContain("pickMostCentral('.customer-marker-card')");
    });
});
