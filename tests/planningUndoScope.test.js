import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Simulation: Rückgängig stellt auch das Zielfeld wieder her', () => {
    const cockpit = read('src/ui/cockpit.js');
    const snapshot = cockpit.slice(cockpit.indexOf('function snapshotSimulation()'), cockpit.indexOf('function restoreSimulation('));
    const restore = cockpit.slice(cockpit.indexOf('function restoreSimulation('), cockpit.indexOf('function undoSimulationStep()'));

    it('der Schnappschuss enthält assignAttr', () => {
        expect(snapshot).toContain('assignAttr,');
    });

    it('das Wiederherstellen setzt assignAttr zurück und zeigt es an', () => {
        expect(restore).toContain('assignAttr = snapshot.assignAttr;');
        expect(restore).toContain('renderAssignAttrSelect();');
        // vor den Werten – sonst rendert die Ansicht kurz das falsche Feld
        expect(restore.indexOf('assignAttr = snapshot.assignAttr;')).toBeLessThan(restore.indexOf('overrides = snapshot.overrides;'));
    });

    it('das Laden eines Szenarios legt den Schnappschuss vor dem Feldwechsel an', () => {
        const load = cockpit.slice(cockpit.indexOf('undoStack.push(snapshotSimulation());', cockpit.indexOf('snapshotFromScenario(scenario)') - 400));
        expect(load.indexOf('undoStack.push(snapshotSimulation());')).toBeLessThan(load.indexOf('assignAttr = scenario.assignAttr || assignAttr;'));
    });

    it('ein neuer oder gelöschter Bestand verwirft die Simulation', () => {
        expect(cockpit).toContain("on('dataset:replacing', resetSimulationState);");
        expect(cockpit).toContain("on('dataset:cleared', resetSimulationState);");
    });
});

describe('Gebietseditor: Verlauf gehört zum Bestand', () => {
    const editor = read('src/ui/regionEditor.js');

    it('leert Rückgängig/Wieder vor bei Reimport, Löschen, Sperre und Beispieldaten', () => {
        expect(editor).toContain("for (const event of ['dataset:replacing', 'dataset:cleared', 'vault:locked', 'demo:loaded']) {");
        expect(editor).toContain('on(event, clearHistory);');
    });

    it('bindet Einträge an die Bestandsversion und wendet fremde nie an', () => {
        expect(editor).toContain('version: datasetVersion });');
        expect(editor).toContain('if (entry.version !== datasetVersion) return false;');
        expect(editor).toContain("if (!applyEntry(entry, 'old')) { clearHistory(); return; }");
        expect(editor).toContain("if (!applyEntry(entry, 'neu')) { clearHistory(); return; }");
    });
});
