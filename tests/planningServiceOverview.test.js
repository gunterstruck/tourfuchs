import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Konzept „Überblick → aufzoomen" in Planung & Service', () => {
    const html = read('index.html');
    const cockpit = read('src/ui/cockpit.js');
    const contract = read('src/ui/contractRadar.js');
    const showcase = read('src/ui/showcase.js');

    it('Cockpit: die Simulation ist ein standardmäßig eingeklapptes <details>', () => {
        // Analyse (KPIs) zuerst; die Simulation wird bei Bedarf aufgezogen.
        expect(html).toContain('<details class="simulation-panel" id="simulation-panel">');
        expect(html).toContain('<summary class="simulation-panel-summary">');
        // Frisches Öffnen klappt ein, laufende Simulation (offene Zuweisungen) auf.
        expect(cockpit).toContain('function setSimulationPanelOpen');
        expect(cockpit).toContain('setSimulationPanelOpen(false)');
        expect(cockpit).toContain('setSimulationPanelOpen(true)');
    });

    it('Live-Demo klappt die Simulation zum Vorführen auf', () => {
        const from = showcase.indexOf('async openCockpit');
        const block = showcase.slice(from, from + 400);
        expect(block).toContain("getElementById('simulation-panel')");
        expect(block).toContain('sim.open = true');
    });

    it('Service/Verträge: die Datenquelle ist ein <details>, das bei Daten einklappt', () => {
        expect(html).toContain('<details id="contract-data-sources"');
        expect(html).toContain('id="contract-source-health"');
        // Ohne Daten offen (Import nötig), mit Daten eingeklappt (Arbeit zuerst).
        expect(contract).toContain("const details = el('contract-data-sources')");
        expect(contract).toContain('details.open = true');
        expect(contract).toContain('details.open = false');
    });

    it('Service/Einsätze: Datenquelle klappt schon selbst ein (Bestand)', () => {
        const planner = read('src/ui/serviceVisitPlanner.js');
        expect(planner).toContain("el('service-visit-data-sources')");
        expect(planner).toContain('details.open = stale');
    });
});
