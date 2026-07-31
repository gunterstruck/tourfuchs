/**
 * Eigene Nachschlagequellen im Briefing-Prompt.
 *
 * Der Assistent durchsucht sonst alles, worauf der Nutzer Zugriff hat – und
 * findet oft Älteres. Wer weiß, wo das Aktuelle liegt, kann es hinterlegen;
 * der Prompt stellt es voran. Geprüft wird beides: dass der Baustein wirkt,
 * und dass er nichts kaputt macht, wenn nichts hinterlegt ist.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    BRIEFING_SOURCES_LIMIT,
    briefingSourcesPromptBlock,
    loadBriefingSources,
    normalizeBriefingSources,
    saveBriefingSources
} from '../src/services/briefingSources.js';
import { buildCustomerBriefingPrompt } from '../src/features/customerBriefing.js';
import { buildAreaBriefingPrompt } from '../src/features/areaBriefing.js';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

/** Storage-Attrappe wie in den übrigen Tests dieses Musters. */
function memoryStore() {
    const map = new Map();
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k)
    };
}

const KUNDE = { id: 'k1', name: 'Alpha GmbH', nummer: '4711', plz: '45127', ort: 'Essen' };
const QUELLE = {
    label: 'Bezirksliste Rheinland – Konditionen und Kontakte, Zuordnung über die Kundennummer',
    location: 'https://firma.sharepoint.com/sites/vertrieb/Bezirke'
};

describe('Nachschlagequellen: speichern und normalisieren', () => {
    let store;
    beforeEach(() => { store = memoryStore(); });

    it('behält gefüllte Einträge und wirft leere weg', () => {
        const saved = saveBriefingSources([QUELLE, { label: '', location: '' }, { label: 'Nur Name' }], store);
        expect(saved).toHaveLength(2);
        expect(loadBriefingSources(store)).toEqual(saved);
    });

    it('deckelt die Zahl, damit der Prompt kein neuer Heuhaufen wird', () => {
        const viele = Array.from({ length: 8 }, (_, i) => ({ label: `Q${i}`, location: `p${i}` }));
        expect(normalizeBriefingSources(viele)).toHaveLength(BRIEFING_SOURCES_LIMIT);
    });

    it('räumt den Speicher, wenn der letzte Eintrag geleert wird', () => {
        saveBriefingSources([QUELLE], store);
        expect(saveBriefingSources([{ label: '', location: '' }], store)).toEqual([]);
        expect(loadBriefingSources(store)).toEqual([]);
    });

    it('übersteht kaputten Speicherinhalt', () => {
        store.setItem('tourfuchs:briefing-sources:v1', '{kein json');
        expect(loadBriefingSources(store)).toEqual([]);
    });
});

describe('Nachschlagequellen: Wirkung im Prompt', () => {
    it('bleibt ohne Eintrag vollständig unsichtbar', () => {
        expect(briefingSourcesPromptBlock([])).toBe('');
        const ohne = buildCustomerBriefingPrompt(KUNDE, {}, null, []);
        expect(ohne).not.toContain('Vorrangige Quellen');
    });

    it('stellt die eigene Ablage im Kundenbriefing voran', () => {
        const prompt = buildCustomerBriefingPrompt(KUNDE, {}, null, [QUELLE]);
        expect(prompt).toContain('Vorrangige Quellen – sieh zuerst hier nach:');
        expect(prompt).toContain(QUELLE.location);
        // Vorrang, nicht Filter: Die allgemeine Suche bleibt erhalten.
        expect(prompt).toContain('Durchsuche ausschließlich Microsoft-365-Inhalte');
        expect(prompt.indexOf('Vorrangige Quellen')).toBeLessThan(prompt.indexOf('Durchsuche ausschließlich'));
        // Die Verknüpfung ist der eigentliche Hebel.
        expect(prompt).toContain('ordne die Einträge über die Kundennummer zu');
    });

    it('wirkt genauso im Gebiets-Briefing', () => {
        const prompt = buildAreaBriefingPrompt([KUNDE], { areaLabel: 'Umkreis von 25 km' }, null, [QUELLE]);
        expect(prompt).toContain('Vorrangige Quellen – sieh zuerst hier nach:');
        expect(prompt).toContain(QUELLE.location);
    });

    it('nimmt auch eine Ortsangabe ohne Link', () => {
        const block = briefingSourcesPromptBlock([{ label: 'Bezirksordner', location: '' }]);
        expect(block).toContain('- Bezirksordner');
    });

    it('erzeugt für Demo-Kunden weiterhin gar keinen Prompt', () => {
        expect(() => buildCustomerBriefingPrompt(
            { ...KUNDE, demo: true }, {}, null, [QUELLE]
        )).toThrow();
    });
});

describe('Nachschlagequellen: Einbau in die Oberfläche', () => {
    it('nutzt ein Fragment für beide Briefing-Dialoge', () => {
        const kunde = source('src/ui/customerBriefing.js');
        const gebiet = source('src/ui/areaBriefing.js');
        for (const ui of [kunde, gebiet]) {
            expect(ui).toContain("import { briefingSourcesHtml, wireBriefingSources } from './briefingSources.js'");
            expect(ui).toContain('${briefingSourcesHtml()}');
            expect(ui).toContain('wireBriefingSources(body,');
            expect(ui).toContain('loadBriefingSources()');
        }
    });

    it('zeigt die Wirkung sofort im angezeigten Prompt', () => {
        // Sonst müsste der Nutzer im Assistenten nachsehen, ob es gewirkt hat.
        expect(source('src/ui/customerBriefing.js'))
            .toContain('wireBriefingSources(body, () => { rebuildPrompt(); fillVisiblePrompt(); })');
    });

    it('bleibt in beiden Ansichtstiefen erreichbar, anders als die Zielwahl', () => {
        const kunde = source('src/ui/customerBriefing.js');
        // Die Zielwahl hängt an `withChooser` (Profi), die Quellen nicht.
        expect(kunde).toContain("${withChooser ? assistantChooserHtml() : ''}\n            ${briefingSourcesHtml()}");
    });

    it('sagt im Dialog zu, dass nichts abgerufen und nichts gesendet wird', () => {
        const ui = source('src/ui/briefingSources.js');
        expect(ui).toContain('TourFuchs öffnet nichts davon und sendet nichts');
    });

    it('hängt die nächste Zeile erst an, wenn alle sichtbaren gefüllt sind', () => {
        // Gefundener Fehler: Verglichen wurde gegen die rohen Zeilen statt gegen
        // die gespeicherten Einträge – beide Zahlen sind immer gleich, also
        // wuchs die Liste bei jedem Feldwechsel um eine leere Zeile.
        const ui = source('src/ui/briefingSources.js');
        expect(ui).toContain('const alleGefuellt = rows.length > 0 && saved.length === rows.length;');
        expect(ui).not.toContain('readRows(block).length === rows.length');
        expect(ui).toContain('rows.length < BRIEFING_SOURCES_LIMIT');
    });
});
