import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { carryOverVisits, diffCustomerDatasets } from '../src/features/datasetDiff.js';

describe('Reimport behält lokal erfasste Besuche', () => {
    const alt = [
        { nummer: '4711', name: 'Muster GmbH', plz: '44787', besuche: ['2026-09-01', '2026-09-15'] },
        { nummer: '', name: 'Ohne Nummer KG', plz: '45127', besuche: ['2026-08-20'] },
        { nummer: '9999', name: 'Entfällt AG', plz: '10117', besuche: ['2026-07-01'] }
    ];

    it('vereinigt Besuche bei gleicher Kundennummer bzw. Name + PLZ', () => {
        const neu = [
            { nummer: '4711', name: 'Muster GmbH (neu)', plz: '44787', besuche: ['2026-09-15', '2026-10-01'] },
            { nummer: '', name: 'ohne nummer kg', plz: '45127', besuche: [] },
            { nummer: '5000', name: 'Neukunde', plz: '50667', besuche: [] }
        ];
        expect(carryOverVisits(alt, neu)).toBe(2);
        expect(neu[0].besuche).toEqual(['2026-09-01', '2026-09-15', '2026-10-01']);
        expect(neu[1].besuche).toEqual(['2026-08-20']);
        expect(neu[2].besuche).toEqual([]);
        // Der bisherige Bestand bleibt unangetastet (Abbrechen muss folgenlos sein).
        expect(alt[0].besuche).toEqual(['2026-09-01', '2026-09-15']);
    });

    it('danach meldet der Änderungsbericht nur noch echten Verlust (entfallene Kunden)', () => {
        const neu = [{ nummer: '4711', name: 'Muster GmbH', plz: '44787', besuche: [] }];
        carryOverVisits(alt, neu);
        const diff = diffCustomerDatasets(alt, neu);
        expect(diff.visitsLost).toEqual([]);
        expect(diff.lostVisitCount).toBe(2); // Ohne Nummer KG + Entfällt AG sind nicht mehr dabei
    });

    it('der Import nutzt es – vor dem Änderungsbericht, nie mit Beispieldaten', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/importWizard.js'), 'utf8');
        const call = ui.indexOf('carryOverVisits(state.customers, customers)');
        expect(call).toBeGreaterThan(-1);
        expect(call).toBeLessThan(ui.indexOf('await confirmImportWithDiff({'));
        expect(ui).toContain('!replacingDemoOnly && !isDemoDataset(state.customers)');
    });
});
