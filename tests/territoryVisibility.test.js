import { describe, expect, it } from 'vitest';
import {
    activeDimensionFilters,
    regionMatchesActiveFilters
} from '../src/features/territoryVisibility.js';

const definitions = [
    { id: 'bezirk', label: 'Vertriebsbezirk' },
    { id: 'gruppe', label: 'Vertriebsgruppe' }
];

function dimension(label, entries) {
    return {
        active: true,
        label,
        values: new Map(entries.map(([value, visible]) => [value, { visible }]))
    };
}

describe('Sichtbarkeit der Gebietskarte unter Hierarchie-Filtern', () => {
    it('behandelt eine vollständig sichtbare Dimension nicht als aktiven Filter', () => {
        const dims = {
            bezirk: dimension('Vertriebsbezirk', [['Nord', true], ['Süd', true]])
        };

        expect(activeDimensionFilters(dims, definitions)).toEqual([]);
    });

    it('liefert bei einer Auswahl nur die sichtbaren Werte', () => {
        const dims = {
            bezirk: dimension('Vertriebsbezirk', [['Nord', false], ['Süd', true]])
        };

        const filters = activeDimensionFilters(dims, definitions);
        expect(filters).toHaveLength(1);
        expect(filters[0]).toMatchObject({ id: 'bezirk', label: 'Vertriebsbezirk', total: 2 });
        expect([...filters[0].visible]).toEqual(['Süd']);
    });

    it('zeigt ein Gebiet mit Kunden aus dem sichtbaren Ausschnitt', () => {
        const filters = [{ id: 'bezirk', visible: new Set(['Süd']) }];

        expect(regionMatchesActiveFilters({ customers: [{ id: 'kunde-1' }], filters })).toBe(true);
    });

    it('zeigt eine kundenlose Fläche mit passender expliziter Zuordnung', () => {
        const filters = [{ id: 'bezirk', visible: new Set(['Süd']) }];

        expect(regionMatchesActiveFilters({ territory: { bezirk: 'Süd' }, filters })).toBe(true);
    });

    it('blendet eine abweichend zugewiesene Fläche trotz Kunden aus', () => {
        const filters = [{ id: 'bezirk', visible: new Set(['Süd']) }];

        expect(regionMatchesActiveFilters({
            customers: [{ id: 'kunde-1' }],
            territory: { bezirk: 'Nord' },
            filters
        })).toBe(false);
    });

    it('blendet Flächen ohne passenden Kunden oder Zuordnung aus', () => {
        const filters = [{ id: 'bezirk', visible: new Set(['Süd']) }];

        expect(regionMatchesActiveFilters({ filters })).toBe(false);
    });

    it('verlangt bei kundenlosen Flächen eine passende Zuordnung je aktivem Filter', () => {
        const filters = [
            { id: 'bezirk', visible: new Set(['Süd']) },
            { id: 'gruppe', visible: new Set(['Direkt']) }
        ];

        expect(regionMatchesActiveFilters({ territory: { bezirk: 'Süd' }, filters })).toBe(false);
        expect(regionMatchesActiveFilters({
            territory: { bezirk: 'Süd', gruppe: 'Direkt' },
            filters
        })).toBe(true);
    });
});
