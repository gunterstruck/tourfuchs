/**
 * Doku-Tor: Was im Code sichtbar ist, muss in der Wissensbasis stehen.
 *
 * Anlass: Kapitel 5.5 beschrieb bis Version 2.7 die „Erste Schritte"-Checkliste
 * falsch – Punkt 1 hieß dort „Kunden auf der Karte sehen" und hakte sich
 * angeblich durchs Laden ab, Punkt 4 war ein Schritt, den es nicht mehr gibt.
 * Das Repo hat zwei aufwendige Playwright-Strecken (`demo-check`,
 * `touch-check`), aber keine davon liest Text. Der Fehler konnte deshalb
 * beliebig lange überleben – ausgerechnet in dem Dokument, das die
 * KI-Auskunft an echte Nutzer steuert.
 *
 * Dieser Test schließt genau diese Lücke: Ändert jemand eine sichtbare
 * Beschriftung oder eine normative Konstante, wird er rot, bis die Wissensbasis
 * nachgezogen ist. Er prüft bewusst **wenige, hochwertige** Stellen – ein Tor,
 * das bei jeder Formulierung anschlägt, wird abgeschaltet.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config.js';
import { FIRST_STEPS } from '../src/features/firstSteps.js';

// Über das Projektverzeichnis, nicht über import.meta.url: Die Tests laufen in
// der jsdom-Umgebung, in der import.meta.url keine file:-URL ist.
const readProjectFile = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

const knowledgeBase = readProjectFile('docs/guide-ki-wissensbasis.md');

/** Die Wissensbasis benutzt teils typografische Anführungszeichen und Bindestriche. */
function normalize(text) {
    return text.replace(/[„“”"']/g, '"').replace(/[–—]/g, '-');
}

const doc = normalize(knowledgeBase);

describe('Wissensbasis bildet den Code ab', () => {
    it.each(FIRST_STEPS.map((step) => [step.id, step.label]))(
        'nennt die Beschriftung von Schritt "%s" wörtlich',
        (_id, label) => {
            expect(doc).toContain(normalize(label));
        }
    );

    it('nennt auch die abweichende Handy-Beschriftung', () => {
        for (const step of FIRST_STEPS) {
            if (step.mobile?.label) expect(doc).toContain(normalize(step.mobile.label));
        }
    });

    it('nennt die veraltete Beschriftung nur noch als solche', () => {
        // „Kunden auf der Karte sehen" darf vorkommen – aber ausschließlich in
        // der Erklärung, warum sie ersetzt wurde, nicht als geltende Auskunft.
        const stale = 'Kunden auf der Karte sehen';
        const occurrences = doc.split(stale).length - 1;
        if (occurrences > 0) {
            expect(doc).toContain('hieß "Kunden');
        }
    });

    it('nennt die Fairness-Schwelle mit dem Wert aus der Konfiguration', () => {
        const german = String(CONFIG.territory.balancedMaxRatio).replace('.', ',');
        expect(doc).toContain(`Faktor von ${german}`);
        // Und sie muss ausdrücklich als Setzung ausgewiesen sein, nicht als Messung.
        expect(doc).toContain('keine Messung');
    });

    it('hält die Schwelle an genau einer Stelle im Code', () => {
        const sources = [
            'src/ui/cockpit.js',
            'src/features/importInsight.js'
        ].map(readProjectFile);

        for (const source of sources) {
            expect(source).toContain('CONFIG.territory.balancedMaxRatio');
            // Keine zweite, hartcodierte Kopie derselben Norm.
            expect(source).not.toMatch(/[^.\d]1\.5\b/);
        }
    });

    it('nennt die Beschriftungen der Orts-Suche wörtlich', () => {
        // Anlass: Der Guide erklärt den Startpunkt. Stünde dort weiter „...oder
        // Kunde als Start wählen", schickte er Nutzer zu einem Feld, das es so
        // nicht mehr gibt – genau der Fehler aus Kapitel 5.5.
        const html = normalize(readProjectFile('index.html'));
        for (const label of ['...oder Kunde, Ort oder PLZ als Start', 'Kunde, Ort oder PLZ als Ziel', '"★ merken"', '"Straße und Hausnummer"']) {
            expect(doc).toContain(normalize(label));
        }
        expect(html).toContain('Kunde, Ort oder PLZ als Start');
        // Und die Zusage, die im Code steht: Die Ortssuche geht nicht ins Netz.
        expect(doc).toContain('keine Adressen im Internet');
    });

    it('nennt den Deckel für eigene Orte mit dem Wert aus der Konfiguration', () => {
        expect(doc).toContain(`Es passen **${CONFIG.tour.maxOwnPlaces}** eigene Orte`);
    });

    it('dokumentiert beide Abbruchbedingungen des B3-Tors', () => {
        expect(doc).toContain('15.09.2026');
        expect(doc).toContain('ueberfaelligAnteil');
        expect(doc).toContain('kmProStopp');
        expect(doc).toContain('Kein Nutzungssignal');
    });
});

describe('„Was wir weggelassen haben" ist ehrlich', () => {
    const html = readProjectFile('index.html');
    const block = html.slice(html.indexOf('info-omitted'), html.indexOf('<h3>Impressum</h3>'));

    it('existiert überhaupt', () => {
        expect(html).toContain('Was wir weggelassen haben');
        expect(block.length).toBeGreaterThan(500);
    });

    it('nennt den gestrichenen Tourvorschlag', () => {
        // Die Bedingung, unter der diese Seite überhaupt gebaut wurde: Eine
        // Liste, die nur die Tode zeigt, auf die man stolz ist, ist Marketing.
        // Roadmap-Item 2.1 ist der Tote, der wehtut - jemand wollte das Feature,
        // es war fertig entworfen, und Nutzerfeedback hat es erledigt.
        expect(block).toContain('Automatischer Tourvorschlag');
        expect(block).toContain('10.07.2026');
    });

    it('nennt auch die Rücknahme von gestern', () => {
        // Zweiter unbequemer Eintrag: eine eigene Entscheidung, die einen Tag
        // später am echten Gerät gescheitert ist.
        expect(block).toContain('Tablet-Ansicht');
        expect(block).toContain('01.08.2026');
    });

    it('begründet jeden Eintrag statt ihn nur aufzuzählen', () => {
        const eintraege = block.match(/<dt>/g) || [];
        const gruende = block.match(/<dd>/g) || [];
        expect(eintraege.length).toBeGreaterThanOrEqual(5);
        expect(gruende).toHaveLength(eintraege.length);
    });
});
