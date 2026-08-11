import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Mobiles Tour-Akkordeon (Startpunkt · Vorschläge · Meine Tour)', () => {
    const html = read('index.html');
    const css = read('src/styles/responsive.css');
    const panel = read('src/ui/tourPanel.js');

    it('umschließt die drei Gruppen mit ein-/ausklappbaren Karten', () => {
        expect(html).toContain('data-acc="start"');
        expect(html).toContain('data-acc="suggest"');
        expect(html).toContain('data-acc="mytour"');
        // Kopf, Zusammenfassungszeile und Pfeil je Gruppe.
        expect(html).toContain('id="acc-sum-start"');
        expect(html).toContain('id="acc-sum-suggest"');
        expect(html).toContain('id="acc-sum-mytour"');
        // Drei Schritte – plus die Klappkarte „In der Nähe", die über dem
        // Prozess steht und bewusst KEINE `.tour-acc` ist (sie gehört weder in
        // die Schrittleiste noch unter „genau ein Schritt offen").
        expect((html.match(/class="tour-acc"/g) || []).length).toBe(3);
        expect((html.match(/class="acc-head"/g) || []).length).toBe(4);
        expect((html.match(/class="acc-body"/g) || []).length).toBe(4);
        expect(html).toContain('id="nearby-card" class="nearby-card"');
    });

    it('lässt die drei Schritt-Anker (Start, Vorschläge, Stopps) unangetastet', () => {
        // Die Render-Logik referenziert diese IDs weiterhin – Wrapping darf sie
        // nicht verlieren.
        expect(html).toContain('id="tour-start"');
        expect(html).toContain('id="suggest-head"');
        expect(html).toContain('id="mytour-head"');
        expect(html).toContain('id="tour-suggestions"');
        expect(html).toContain('id="tour-stops"');
    });

    it('rendert die drei Schritte auf ALLEN Breiten als ein-/ausklappbare Karten', () => {
        // Bewusste Vereinheitlichung: der „Überblick → aufzoomen"-Prozess gilt auch
        // auf dem Desktop. Die Karten stehen daher außerhalb der Mobile-Media-Query.
        expect(css).not.toContain('.tour-acc { display: contents; }');
        expect(css).toMatch(/\.tour-acc \{\s*\n\s*display: block;/);
        // Zusammenfassungszeile ist jetzt generell sichtbar (Überblick je Schritt).
        expect(css).toContain('.tour-acc.open .acc-summary { display: none; }');
    });

    it('öffnet genau eine Gruppe und folgt sonst dem Arbeitsfluss', () => {
        // Akkordeon-Regel: öffnen schließt die anderen.
        expect(panel).toContain('function openTourAcc');
        expect(panel).toContain("el.classList.toggle('open', open)");
        // Aktueller Schritt aus dem Zustand (Start → Vorschläge → Meine Tour).
        expect(panel).toContain('function currentTourStep');
        // Manueller Tipp pinnt; leere Tour löst den Pin wieder.
        expect(panel).toContain('tourAccPinned = true');
        expect(panel).toContain('tourAccPinned = false');
        // Nur auf dem Handy aktiv.
        expect(panel).toContain('isPhoneUi()');
    });

    it('füllt sprechende Zusammenfassungen (Start, Umkreis, Stopps)', () => {
        expect(panel).toContain('acc-sum-start');
        expect(panel).toContain('acc-sum-suggest');
        expect(panel).toContain('acc-sum-mytour');
        expect(panel).toContain('Umkreis ${state.tour.radiusKm} km');
    });

    it('zieht das Tour-Blatt ganz auf und hält alle drei Köpfe sichtbar', () => {
        const sidebar = read('src/ui/sidebar.js');
        const css = read('src/styles/responsive.css');
        // Volle Planungsfläche bis knapp unter die schwebende Navi.
        expect(sidebar).toContain('function tourSheetHeight');
        expect(sidebar).toContain('setSheetHeight(tourSheetHeight()');
        // Offene Gruppe scrollt intern (gedeckelt), damit die Köpfe stehenbleiben.
        expect(css).toContain('.tour-acc.open .acc-body {\n        max-height: 34vh;');
        expect(css).toContain('.tour-acc.open .scroll-list { max-height: none; overflow: visible; }');
        // Der Scan-Einstieg wird beim Planen (Start steht) ausgeblendet.
        expect(panel).toContain("classList.toggle('tour-has-start', !!state.tour.start)");
        expect(css).toContain('body.tour-has-start #tab-tour.active #btn-tour-scan');
        // Die offene „In der Nähe"-Karte ist genauso gedeckelt wie ein Schritt –
        // sie darf den Prozess darunter nicht aus dem Bild schieben.
        expect(css).toContain('.nearby-card.open .acc-body {\n        max-height: 34vh;');
    });

    it('bleibt beim Aussuchen in „Vorschläge" – springt nicht beim ersten Stopp zu „Meine Tour"', () => {
        // currentTourStep darf ab gesetztem Start nur „suggest" liefern; zu
        // „mytour" wechselt der Nutzer bewusst selbst (sonst konnte man keine
        // weiteren Kunden mehr aussuchen).
        const from = panel.indexOf('function currentTourStep');
        const step = panel.slice(from, panel.indexOf('\nfunction ', from + 10));
        expect(step).not.toContain("return 'mytour'");
        expect(step).toContain("return 'suggest'");
    });
});
