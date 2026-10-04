import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diffCustomerDatasets, diffHeadline } from '../src/features/datasetDiff.js';
import { servicePlanBasis, servicePlanBasisMatches } from '../src/features/savedTourKeys.js';

const kunde = { nummer: '4711', name: 'Muster GmbH', plz: '44787', ort: 'Bochum', bezirk: 'Nord', vb: 'Anna', besuche: ['2026-09-01', '2026-09-15'] };

describe('Reimport: keine falsche Entwarnung', () => {
    it('meldet den Wechsel des Vertriebsbeauftragten und verlorene Besuche', () => {
        const diff = diffCustomerDatasets([kunde], [{ ...kunde, vb: 'Bernd', besuche: [] }]);
        expect(diff.hasChanges).toBe(true);
        expect(diff.changed[0].fields.map((f) => f.key)).toEqual(['vb']);
        expect(diff.visitsLost[0].dates).toEqual(['2026-09-01', '2026-09-15']);
        expect(diff.lostVisitCount).toBe(2);
        expect(diffHeadline(diff)).toBe('1 geändert · 2 Besuche gehen verloren');
        expect(diff.keptCount).toBe(0);
    });

    it('vergleicht auch Channel und Kundentyp', () => {
        const diff = diffCustomerDatasets([{ ...kunde, channel: 'Handel', kundentyp: 'A' }], [{ ...kunde, channel: 'Handwerk', kundentyp: 'B' }]);
        expect(diff.changed[0].fields.map((f) => f.key)).toEqual(['channel', 'kundentyp']);
    });

    it('entfallende Kunden zählen ihre Besuche mit', () => {
        const diff = diffCustomerDatasets([kunde], []);
        expect(diff.lostVisitCount).toBe(2);
    });

    it('gleiche Besuche (oder mehr) sind kein Verlust', () => {
        const diff = diffCustomerDatasets([kunde], [{ ...kunde, besuche: [...kunde.besuche, '2026-10-01'] }]);
        expect(diff.lostVisitCount).toBe(0);
        expect(diff.visitsLost).toEqual([]);
    });

    it('der Bericht zeigt den Verlust ausdrücklich', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/importDiff.js'), 'utf8');
        expect(ui).toContain("listSection('Besuche gehen verloren', diff.visitsLost || []");
        expect(ui).toContain('nicht in der neuen Liste</b>');
    });
});

describe('Gespeicherter Service-Zeitplan gilt nur für die Adressen, für die er gerechnet wurde', () => {
    const start = { lat: 51.48, lng: 7.21, label: 'Zuhause' };
    const bochum = { id: 'k1', lat: 51.4818, lng: 7.2162, strasse: 'Kortumstr. 1', plz: '44787', ort: 'Bochum' };
    const getter = (list) => (id) => list.find((c) => c.id === id);

    it('unverändert: gültig', () => {
        const basis = servicePlanBasis(start, ['k1'], getter([bochum]));
        expect(servicePlanBasisMatches(basis, start, ['k1'], getter([bochum]))).toBe(true);
    });

    it('Kunde zieht nach Berlin (gleiche ID): ungültig', () => {
        const basis = servicePlanBasis(start, ['k1'], getter([bochum]));
        const berlin = { ...bochum, lat: 52.52, lng: 13.405, strasse: 'Unter den Linden 1', plz: '10117', ort: 'Berlin' };
        expect(servicePlanBasisMatches(basis, start, ['k1'], getter([berlin]))).toBe(false);
    });

    it('anderer Start: ungültig; Alttour ohne Grundlage: neu planen', () => {
        const basis = servicePlanBasis(start, ['k1'], getter([bochum]));
        expect(servicePlanBasisMatches(basis, { ...start, lat: 50 }, ['k1'], getter([bochum]))).toBe(false);
        expect(servicePlanBasisMatches(undefined, start, ['k1'], getter([bochum]))).toBe(false);
    });

    it('Tourpanel hält die Grundlage fest und prüft sie beim Laden', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
        expect(ui).toContain('servicePlanBasis: state.tour.servicePlan ? servicePlanBasis(state.tour.start, state.tour.stops, getCustomer) : null');
        expect(ui).toContain('servicePlanBasisMatches(tour.servicePlanBasis, resolved.start, validIds, getCustomer);');
        expect(ui).toContain('state.tour.servicePlan = planStillValid ? structuredClone(tour.servicePlan) : null;');
    });
});
