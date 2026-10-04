import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assignInSimulation, compareScenarios } from '../src/features/simulationScenarios.js';

const kunde = { id: 'k1', bezirk: 'Nord', umsatz: 1000 };
const bezirk = (c) => c.bezirk;

describe('Zuweisung über verschiedene Gebietsebenen', () => {
    it('Landkreis → Süd, dann PLZ → Nord: der Kunde ist wieder Nord', () => {
        const overrides = new Map();
        assignInSimulation(overrides, [kunde], 'Süd', bezirk);
        expect(overrides.get('k1')).toBe('Süd');
        const step = assignInSimulation(overrides, [kunde], 'Nord', bezirk);
        expect(overrides.has('k1')).toBe(false); // zurück auf Ursprung – „Übernehmen" schreibt nichts
        expect(step).toMatchObject({ movedIds: ['k1'], moved: 1, movedRevenue: 1000 });
    });

    it('Süd → West überschreibt die frühere Umbuchung', () => {
        const overrides = new Map([['k1', 'Süd']]);
        assignInSimulation(overrides, [kunde], 'West', bezirk);
        expect(overrides.get('k1')).toBe('West');
    });

    it('ohne Änderung kein Schritt', () => {
        const overrides = new Map();
        expect(assignInSimulation(overrides, [kunde], 'Nord', bezirk).moved).toBe(0);
        expect(overrides.size).toBe(0);
    });

    it('das Cockpit nutzt diese Regel', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/cockpit.js'), 'utf8');
        expect(ui).toContain('assignInSimulation(overrides,');
    });
});

describe('Szenarienvergleich berücksichtigt das Zielfeld', () => {
    it('Bezirk Nord und Gruppe Nord sind nicht „gleich" – und nicht widersprüchlich', () => {
        const a = { assignAttr: 'bezirk', overrides: [['k1', 'Nord'], ['k2', 'Süd']] };
        const b = { assignAttr: 'gruppe', overrides: [['k1', 'Nord'], ['k2', 'Ost']] };
        expect(compareScenarios(a, b)).toEqual({ onlyA: 2, onlyB: 2, same: 0, conflicting: [], differentAttr: true });
    });

    it('gleiches Zielfeld vergleicht wie bisher; alte Szenarien ohne Angabe gelten als Bezirk', () => {
        const a = { assignAttr: 'bezirk', overrides: [['k1', 'Nord'], ['k2', 'Süd']] };
        const old = { overrides: [['k1', 'Nord'], ['k2', 'Ost']] };
        expect(compareScenarios(a, old)).toMatchObject({ same: 1, conflicting: ['k2'], differentAttr: false });
    });

    it('die aktuelle Simulation gibt ihr Zielfeld mit', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/cockpit.js'), 'utf8');
        expect(ui).toContain("return { name: 'aktuelle Simulation', assignAttr, overrides: [...overrides], pendingTerr: [...pendingTerr] };");
        expect(ui).toContain('if (diff.differentAttr) {');
    });
});
