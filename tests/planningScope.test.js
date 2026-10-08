import { describe, expect, it } from 'vitest';
import {
    applyPlanningSelections,
    enabledPlanningDimensionDefs,
    planningScopeCustomers,
    planningSelectionsFromDimensions,
    planningValueCounts,
    planningValueSearchText
} from '../src/features/planningScope.js';

const defs = [
    { id: 'bezirk', field: 'bezirk' },
    { id: 'gruppe', field: 'gruppe' },
    { id: 'kundentyp', field: 'kundentyp' }
];
const customers = [
    { id: '1', bezirk: 'Nord', gruppe: 'A', kundentyp: 'Apotheke', vb: 'Tina Test', umsatz: 100 },
    { id: '2', bezirk: 'Nord', gruppe: 'B', kundentyp: 'Praxis', vb: 'Tina Test', umsatz: 200 },
    { id: '3', bezirk: 'Süd', gruppe: 'A', kundentyp: 'Praxis', vb: 'Sven Süd', umsatz: 300 }
];

function dimensions() {
    return {
        bezirk: { values: new Map([['Nord', { visible: true }], ['Süd', { visible: true }]]) },
        gruppe: { values: new Map([['A', { visible: true }], ['B', { visible: true }]]) },
        kundentyp: { values: new Map([['Apotheke', { visible: true }], ['Praxis', { visible: true }]]) }
    };
}

describe('mobiler Planungsbereich', () => {
    it('zeigt nur die im Desktop eingeblendeten und im Datensatz aktiven Kategorien', () => {
        const withExtra = [
            ...defs,
            { id: 'channel', field: 'channel' },
            { id: 'extra:quelldatei', field: 'Quelldatei', custom: true }
        ];
        const dims = {
            ...dimensions(),
            channel: { active: true, values: new Map() },
            'extra:quelldatei': { active: true, values: new Map() }
        };
        for (const id of ['bezirk', 'gruppe', 'kundentyp']) dims[id].active = true;
        expect(enabledPlanningDimensionDefs(
            withExtra,
            dims,
            ['bezirk', 'gruppe', 'kundentyp', 'channel']
        ).map((def) => def.id)).toEqual(['bezirk', 'gruppe', 'kundentyp', 'channel']);
    });

    it('verknüpft Werte einer Kategorie mit ODER und Kategorien mit UND', () => {
        const selected = new Map([
            ['bezirk', new Set(['Nord', 'Süd'])],
            ['gruppe', new Set(['A'])],
            ['kundentyp', new Set()]
        ]);
        expect(planningScopeCustomers(customers, defs, selected).map((c) => c.id)).toEqual(['1', '3']);
    });

    it('behandelt eine leere Auswahl als alle Werte', () => {
        const selected = new Map(defs.map((def) => [def.id, new Set()]));
        expect(planningScopeCustomers(customers, defs, selected)).toHaveLength(3);
    });

    it('übernimmt einen alten einzelnen Bezirk in den mobilen Entwurf', () => {
        const selected = planningSelectionsFromDimensions(defs, dimensions(), 'Süd');
        expect([...selected.get('bezirk')]).toEqual(['Süd']);
    });

    it('zählt Werte im Kontext der anderen Kategorien', () => {
        const selected = new Map([
            ['bezirk', new Set(['Nord'])],
            ['gruppe', new Set()],
            ['kundentyp', new Set(['Praxis'])]
        ]);
        expect(Object.fromEntries(planningValueCounts(customers, defs, selected, 'gruppe'))).toEqual({ B: 1 });
    });

    it('schreibt die Auswahl in die gemeinsame Filterbasis zurück', () => {
        const dims = dimensions();
        const selected = new Map([
            ['bezirk', new Set(['Nord'])],
            ['gruppe', new Set()],
            ['kundentyp', new Set()]
        ]);
        applyPlanningSelections(defs, dims, selected);
        expect(dims.bezirk.values.get('Nord').visible).toBe(true);
        expect(dims.bezirk.values.get('Süd').visible).toBe(false);
        expect([...dims.gruppe.values.values()].every((entry) => entry.visible)).toBe(true);
    });

    it('macht einen Bezirk über den Namen des Vertriebsbeauftragten auffindbar', () => {
        const text = planningValueSearchText('Nord', defs[0], customers);
        expect(text).toContain('tina test');
    });
});
