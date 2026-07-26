import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    datasetInsight,
    insightHeadline,
    insightStatements,
    isInsightWorthShowing
} from '../src/features/importInsight.js';

const NOW = new Date('2026-07-25T09:00:00');

const kunde = (over = {}) => ({
    id: 'k', name: 'Muster GmbH', plz: '45136', ort: 'Essen', bezirk: 'West',
    umsatz: 10000, rhythmusWochen: null, besuche: [], lat: 51.45, lng: 7.0, ...over
});

const many = (count, over = {}) => Array.from({ length: count }, (_, i) => kunde({ id: `k${i}`, ...over }));

const textOf = (insight) => insightStatements(insight).map((s) => s.text).join(' | ');

describe('Befund nach dem Import', () => {
    it('nennt zuerst die Zahl, die immer stimmt', () => {
        expect(insightHeadline(datasetInsight(many(412)))).toBe('412 Kunden auf der Karte.');
        expect(insightHeadline(datasetInsight([kunde()]))).toBe('1 Kunde auf der Karte.');
        expect(insightHeadline(datasetInsight([]))).toMatch(/Keine Kunden/);
    });

    it('meldet eine deutliche Ungleichverteilung zwischen Bezirken', () => {
        const insight = datasetInsight([
            ...many(31, { bezirk: 'Rheinland' }),
            ...many(10, { bezirk: 'Nord' })
        ], NOW);

        expect(insight.imbalance.top.name).toBe('Rheinland');
        expect(insight.imbalance.bottom.name).toBe('Nord');
        expect(insight.imbalance.factor).toBeCloseTo(3.1, 1);
        expect(textOf(insight)).toContain('3,1× so viele Kunden');
    });

    it('schweigt bei gleichmäßiger Verteilung – das ist keine Nachricht', () => {
        const insight = datasetInsight([
            ...many(10, { bezirk: 'West' }),
            ...many(9, { bezirk: 'Nord' })
        ], NOW);

        expect(insight.imbalance).toBeNull();
        expect(textOf(insight)).not.toContain('so viele');
        // die Bezirksanzahl wird trotzdem genannt
        expect(textOf(insight)).toContain('2 Vertriebsbezirke');
    });

    it('kommt mit einem leeren Bezirk klar, statt durch null zu teilen', () => {
        const insight = datasetInsight([
            ...many(5, { bezirk: 'West' }),
            ...many(0, { bezirk: 'Nord' })
        ], NOW);
        // nur ein Bezirk mit Kunden -> keine Aussage über Ungleichverteilung
        expect(insight.imbalance).toBeNull();
    });

    it('zählt Überfällige nur bei hinterlegtem Rhythmus', () => {
        const insight = datasetInsight([
            kunde({ id: 'a', rhythmusWochen: 6, besuche: ['2025-01-10'] }),
            kunde({ id: 'b', rhythmusWochen: 6, besuche: ['2026-07-20'] }),
            kunde({ id: 'c', rhythmusWochen: null, besuche: [] })
        ], NOW);

        expect(insight.overdue).toBe(1);
        expect(insight.withRhythm).toBe(2);
        expect(textOf(insight)).toContain('1 Kunde ist überfällig');
    });

    it('weist auf den fehlenden Rhythmus hin, statt einfach zu schweigen', () => {
        const insight = datasetInsight(many(20), NOW);
        expect(insight.overdue).toBe(0);
        expect(textOf(insight)).toContain('Besuchsrhythmus ist nicht hinterlegt');
    });

    it('meldet nicht verortete Kunden als Erstes', () => {
        const insight = datasetInsight([
            ...many(9),
            kunde({ id: 'x', lat: null, lng: null })
        ], NOW);

        expect(insight.unlocated).toBe(1);
        expect(insight.located).toBe(9);
        expect(insightStatements(insight)[0].key).toBe('unlocated');
    });

    it('nennt Kunden ohne Bezirk nur, wenn es überhaupt Bezirke gibt', () => {
        const gemischt = datasetInsight([...many(5, { bezirk: 'West' }), ...many(2, { bezirk: '' })], NOW);
        const ohne = datasetInsight(many(5, { bezirk: '' }), NOW);

        expect(textOf(gemischt)).toContain('Ohne Zuordnung');
        expect(textOf(ohne)).not.toContain('Ohne Zuordnung');
    });

    it('summiert den Umsatz und ignoriert Unlesbares', () => {
        const insight = datasetInsight([
            kunde({ umsatz: 100000 }), kunde({ umsatz: null }), kunde({ umsatz: 'k. A.' })
        ], NOW);
        expect(insight.revenueTotal).toBe(100000);
    });

    it('lohnt sich nicht bei drei Kunden ohne Struktur', () => {
        expect(isInsightWorthShowing(datasetInsight(many(3, { bezirk: '' })))).toBe(false);
        expect(isInsightWorthShowing(datasetInsight(many(10, { bezirk: '' })))).toBe(true);
        expect(isInsightWorthShowing(datasetInsight([
            ...many(2, { bezirk: 'West' }), ...many(1, { bezirk: 'Nord' })
        ]))).toBe(true);
        expect(isInsightWorthShowing(datasetInsight([]))).toBe(false);
    });
});

describe('Einbindung des Befunds', () => {
    const wizard = readFileSync(resolve(process.cwd(), 'src/ui/importWizard.js'), 'utf8');
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

    it('erscheint nur beim ersten Blick auf eigene Daten', () => {
        expect(wizard).toContain('const firstOwnData');
        expect(wizard).toContain('isDemoDataset(state.customers)');
        expect(wizard).toContain('if (firstOwnData) await showImportInsight();');
    });

    it('kommt vor dem Tresor-Vorschlag, nicht darüber', () => {
        const block = wizard.slice(wizard.indexOf('const offerVault'), wizard.indexOf("emit('data:imported'") + 40);
        expect(block.indexOf('showImportInsight')).toBeLessThan(block.indexOf("emit('data:imported'"));
    });

    it('führt aus der Zahl direkt zu den Kunden dahinter', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/importInsight.js'), 'utf8');
        expect(html).toContain('data-insight-overdue');
        expect(html).toContain('id="insight-tour"');
        expect(ui).toContain('showOpportunityView()');
    });
});
