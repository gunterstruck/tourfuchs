/**
 * Beispieldaten sind kein Bestand, den man schützen müsste.
 *
 * Der Schutz vor versehentlichem Überschreiben ist richtig – aber er lief auch
 * gegen die Beispielkunden. Beim ersten eigenen Import stand deshalb:
 *
 *   „🔄 Was ändert sich?  3 neu · 2250 entfallen
 *    Kunden gesamt: 2.250 → 3 (-2.247)
 *    Umsatz gesamt: 315.318 T€ → 0 € (−315.318 T€)"
 *
 * Eine Verlustmeldung über eine Kulisse, die nie echt war – genau in dem
 * Moment, in dem der Nutzer zum ersten Mal seine eigenen Kunden sehen will.
 *
 * Hier wird beides festgehalten: dass der Bericht gegen Beispieldaten
 * verschwindet **und** dass er bei allem anderen bleibt.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state, setCustomers, setServiceContracts, setServiceVisits } from '../src/core/state.js';
import { DEMO_DATA_ORIGIN } from '../src/core/demoSafety.js';
import { hasExistingDataset, onlyDemoDataPresent } from '../src/ui/datasetReplacement.js';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

const demoKunde = (i) => ({
    id: `demo-${i}`, name: `TourFuchs Demo · Autohaus ${i}`, plz: '45127',
    dataOrigin: DEMO_DATA_ORIGIN, demo: true
});
const echterKunde = (i) => ({ id: `k${i}`, name: `Alpha ${i} GmbH`, nummer: `47${i}`, plz: '45127' });

beforeEach(() => {
    state.territories = {};
    setServiceContracts([], {});
    setServiceVisits([], {});
    setCustomers([], { fileName: null });
});

describe('Reine Beispiel-Kulisse erkennen', () => {
    it('erkennt einen Bestand aus lauter Beispielkunden', () => {
        setCustomers([demoKunde(1), demoKunde(2)], { fileName: 'Demo-Daten' });
        expect(onlyDemoDataPresent()).toBe(true);
        // Er ist trotzdem „vorhanden" – nur eben nicht schützenswert.
        expect(hasExistingDataset()).toBe(true);
    });

    it('zählt einen einzigen echten Kunden schon als schützenswert', () => {
        setCustomers([demoKunde(1), echterKunde(1)], { fileName: 'gemischt' });
        expect(onlyDemoDataPresent()).toBe(false);
    });

    it('schützt selbst angelegte Gebietszuordnungen, auch über Beispielkunden', () => {
        setCustomers([demoKunde(1)], { fileName: 'Demo-Daten' });
        state.territories = { 'plz2:45': { bezirk: 'Mein Bezirk' } };
        expect(onlyDemoDataPresent()).toBe(false);
    });

    it('schützt eigene Vertrags- und Einsatzquellen, auch über Beispielkunden', () => {
        setCustomers([demoKunde(1)], { fileName: 'Demo-Daten' });
        setServiceContracts([{ id: 'v1', sourceSystem: 'SAP', contractId: 'V1', customerNumber: '1' }], { SAP: {} });
        expect(onlyDemoDataPresent()).toBe(false);

        setServiceContracts([{ id: 'v1', sourceSystem: 'DEMO', contractId: 'V1', customerNumber: '1' }], { DEMO: {} });
        expect(onlyDemoDataPresent()).toBe(true);

        setServiceVisits([{ id: 'e1', sourceSystem: 'SieSales', workOrderId: 'E1', customerNumber: '1' }], { SieSales: {} });
        expect(onlyDemoDataPresent()).toBe(false);
    });

    it('ist bei leerem Bestand nicht „nur Demo"', () => {
        expect(onlyDemoDataPresent()).toBe(false);
        expect(hasExistingDataset()).toBe(false);
    });
});

describe('Wirkung auf den Import-Weg', () => {
    it('überspringt den Änderungsbericht nur gegen die Kulisse', () => {
        const wizard = source('src/ui/importWizard.js');
        expect(wizard).toContain('const replacingDemoOnly = onlyDemoDataPresent();');
        expect(wizard).toContain('if (customers.length > 0 && !replacingDemoOnly) {');
        // Der Bericht selbst bleibt unangetastet – nur wann er kommt, ändert sich.
        expect(wizard).toContain('await confirmImportWithDiff({');
    });

    it('behauptet nicht mehr, eine bisherige Kundenliste sei ersetzt worden', () => {
        const wizard = source('src/ui/importWizard.js');
        expect(wizard).toContain('hasExistingDataset() && !onlyDemoDataPresent()');
    });

    it('lässt auch die kurze Rückfrage weg – aber nicht bei aktivem Tresor', () => {
        const ui = source('src/ui/datasetReplacement.js');
        expect(ui).toContain('if (onlyDemoDataPresent() && !options.disablesVault) return true;');
    });
});
