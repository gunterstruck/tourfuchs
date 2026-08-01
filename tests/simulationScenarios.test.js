import { describe, expect, it } from 'vitest';
import {
    MAX_SCENARIOS,
    compareScenarios,
    removeScenario,
    scenarioFit,
    scenarioFromSnapshot,
    scenarioSummary,
    snapshotFromScenario,
    upsertScenario
} from '../src/features/simulationScenarios.js';

function snapshot({ overrides = [['k1', 'Nord'], ['k2', 'Nord']], terr = [['kreise:05315', { value: 'Nord', name: 'Köln', customerIds: ['k1'] }]], ops = [] } = {}) {
    return { overrides: new Map(overrides), pendingTerr: new Map(terr), opsLog: ops };
}

describe('Szenario speichern', () => {
    it('macht aus dem Schnappschuss einen benannten Eintrag', () => {
        const s = scenarioFromSnapshot('Variante Nord', snapshot(), {
            assignAttr: 'bezirk', level: 'kreise', fileName: 'kunden.xlsx'
        });
        expect(s).toMatchObject({ name: 'Variante Nord', assignAttr: 'bezirk', level: 'kreise', fileName: 'kunden.xlsx' });
        expect(s.overrides).toEqual([['k1', 'Nord'], ['k2', 'Nord']]);
        expect(s.id).toMatch(/^variante-nord-/);
    });

    it('verlangt einen Namen und mindestens eine Zuweisung', () => {
        expect(() => scenarioFromSnapshot('  ', snapshot())).toThrow(/Namen/);
        expect(() => scenarioFromSnapshot('Leer', snapshot({ overrides: [], terr: [] }))).toThrow(/nichts zu speichern/);
    });

    it('speichert eine Gebietszuordnung auch ohne betroffene Kunden', () => {
        const s = scenarioFromSnapshot('Nur Fläche', snapshot({ overrides: [] }));
        expect(s.pendingTerr).toHaveLength(1);
    });

    it('koppelt sich vom laufenden Zustand ab', () => {
        const live = snapshot();
        const s = scenarioFromSnapshot('Fix', live);
        live.overrides.set('k3', 'Süd');
        live.pendingTerr.get('kreise:05315').customerIds.push('k9');
        expect(s.overrides).toHaveLength(2);
        expect(s.pendingTerr[0][1].customerIds).toEqual(['k1']);
    });
});

describe('Szenario laden', () => {
    it('stellt die Form wieder her, die das Cockpit braucht', () => {
        const s = scenarioFromSnapshot('Zurück', snapshot());
        const back = snapshotFromScenario(s);
        expect(back.overrides).toBeInstanceOf(Map);
        expect(back.overrides.get('k1')).toBe('Nord');
        expect(back.pendingTerr.get('kreise:05315').name).toBe('Köln');
    });

    it('überlebt kaputte oder leere Einträge', () => {
        expect(snapshotFromScenario(null).overrides.size).toBe(0);
        expect(snapshotFromScenario({ overrides: 'quatsch' }).overrides.size).toBe(0);
    });
});

describe('Liste verwalten', () => {
    it('ersetzt bei gleichem Namen, statt zu verdoppeln', () => {
        const a = scenarioFromSnapshot('Nord', snapshot());
        const b = scenarioFromSnapshot('nord', snapshot({ overrides: [['k9', 'Süd']] }));
        const { scenarios, replaced } = upsertScenario([a], b);
        expect(replaced).toBe(true);
        expect(scenarios).toHaveLength(1);
        expect(scenarios[0].overrides).toEqual([['k9', 'Süd']]);
    });

    it('stellt Neues nach vorn', () => {
        const a = scenarioFromSnapshot('A', snapshot());
        const b = scenarioFromSnapshot('B', snapshot());
        expect(upsertScenario([a], b).scenarios.map((s) => s.name)).toEqual(['B', 'A']);
    });

    it('wirft das älteste weg, nie das gerade gespeicherte', () => {
        let list = [];
        for (let i = 0; i < MAX_SCENARIOS; i++) {
            const s = scenarioFromSnapshot(`S${i}`, snapshot());
            s.savedAt = `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`;
            list = upsertScenario(list, s).scenarios;
        }
        const neu = scenarioFromSnapshot('Neu', snapshot());
        const { scenarios, dropped } = upsertScenario(list, neu);
        expect(scenarios).toHaveLength(MAX_SCENARIOS);
        expect(dropped.name).toBe('S0');
        expect(scenarios.map((s) => s.name)).toContain('Neu');
    });

    it('entfernt gezielt', () => {
        const a = scenarioFromSnapshot('A', snapshot());
        expect(removeScenario([a], a.id)).toEqual([]);
        expect(removeScenario([a], 'anderes')).toHaveLength(1);
    });
});

describe('Passt das Szenario noch zum Bestand?', () => {
    it('zählt Kunden, die es nicht mehr gibt', () => {
        const s = scenarioFromSnapshot('Alt', snapshot({ overrides: [['k1', 'Nord'], ['weg', 'Nord']] }));
        const fit = scenarioFit(s, new Set(['k1', 'k2']));
        expect(fit).toEqual({ total: 2, missing: 1, applicable: 1, complete: false });
    });

    it('meldet vollständige Passung', () => {
        const s = scenarioFromSnapshot('Passt', snapshot());
        expect(scenarioFit(s, new Set(['k1', 'k2'])).complete).toBe(true);
    });

    it('nimmt auch eine Map als Bestand', () => {
        const s = scenarioFromSnapshot('Map', snapshot());
        expect(scenarioFit(s, new Map([['k1', {}], ['k2', {}]])).complete).toBe(true);
    });
});

describe('Zwei Varianten vergleichen', () => {
    it('trennt Einigkeit von Widerspruch', () => {
        const nord = scenarioFromSnapshot('Nord', snapshot({ overrides: [['k1', 'Nord'], ['k2', 'Nord'], ['k3', 'Nord']] }));
        const sued = scenarioFromSnapshot('Süd', snapshot({ overrides: [['k2', 'Nord'], ['k3', 'Süd'], ['k4', 'Süd']] }));
        const diff = compareScenarios(nord, sued);
        expect(diff.same).toBe(1);                  // k2 gleich
        expect(diff.conflicting).toEqual(['k3']);   // k3 widersprüchlich
        expect(diff.onlyA).toBe(1);                 // k1
        expect(diff.onlyB).toBe(1);                 // k4
    });

    it('kommt mit leeren Szenarien zurecht', () => {
        expect(compareScenarios(null, null)).toEqual({ onlyA: 0, onlyB: 0, same: 0, conflicting: [] });
    });
});

describe('Zusammenfassung', () => {
    it('nennt Kunden, Gebiete und die Zuweisungsebene', () => {
        const s = scenarioFromSnapshot('X', snapshot());
        expect(scenarioSummary(s, () => 'Vertriebsbezirk')).toBe('2 Kunden · 1 Gebiet · Vertriebsbezirk');
    });

    it('bleibt im Singular korrekt', () => {
        const s = scenarioFromSnapshot('X', snapshot({ overrides: [['k1', 'Nord']] }));
        expect(scenarioSummary(s, () => '')).toBe('1 Kunde · 1 Gebiet');
    });
});
