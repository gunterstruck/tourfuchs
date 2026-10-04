import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isLeftoverDemoDataset } from '../src/ui/lockVault.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const demo = (i) => ({ id: `demo-${i}`, name: `TourFuchs Demo · Kunde ${i}`, demo: true });

describe('Tresor-Live-Demo legt keinen echten Tresor mehr an', () => {
    it('Absenden ist nur Vorführung – kein Formular-Submit, kein Abbau nötig', () => {
        const showcase = read('src/ui/showcase.js');
        const submit = showcase.slice(showcase.indexOf('async submitVaultSetup()'), showcase.indexOf('async finishVaultDemo()'));
        expect(submit).toContain('showRecoveryCodeForDemo();');
        expect(submit).not.toContain('#vault-setup-form button[type="submit"]');
        expect(showcase).not.toContain('demoVaultCreated');
        expect(showcase).not.toContain('removeVaultMeta');
    });
});

describe('Selbstheilung: übrig gebliebener Demo-Tresor', () => {
    it('erkennt nur Beispieldaten (oder leeren Bestand) als Demo-Rest', () => {
        expect(isLeftoverDemoDataset(null)).toBe(true);
        expect(isLeftoverDemoDataset({ customers: [demo(1), demo(2)] })).toBe(true);
        expect(isLeftoverDemoDataset({ customers: [demo(1), { id: 'k1', name: 'Echte Firma GmbH' }] })).toBe(false);
        expect(isLeftoverDemoDataset({ customers: [demo(1)], serviceContracts: [{ sourceSystem: 'SAP' }] })).toBe(false);
        expect(isLeftoverDemoDataset({ customers: [demo(1)], serviceContracts: [{ sourceSystem: 'DEMO' }] })).toBe(true);
    });

    it('eigene Orte oder Gebiete zählen als echte Nutzung – Tresor bleibt', () => {
        const home = { id: 'p1', label: 'Zuhause', adresse: 'Rosenweg 7, 45127 Essen', lat: 51.45, lng: 7.01 };
        expect(isLeftoverDemoDataset({ customers: [demo(1)], places: [home] })).toBe(false);
        expect(isLeftoverDemoDataset({ customers: [], places: [home] })).toBe(false);
        expect(isLeftoverDemoDataset({ customers: [demo(1)], territories: [{ id: 't1', name: 'Nord' }] })).toBe(false);
        expect(isLeftoverDemoDataset({ customers: [demo(1)], places: [], territories: [] })).toBe(true);
    });

    it('lässt den Tresor stehen, solange Touren, Adress-Cache oder Szenarien darin liegen', () => {
        const ui = read('src/ui/lockVault.js');
        expect(ui).toContain('if (!isLeftoverDemoDataset(dataset) || !(await protectedStoresEmpty())) {');
        expect(ui).toContain("return tours.length === 0 && scenarios.length === 0 && Object.keys(geocodeCache || {}).length === 0;");
    });

    it('prüft Demo-PINs ohne Fehlversuch und fasst echte Daten nicht an', () => {
        const ui = read('src/ui/lockVault.js');
        expect(ui).toContain("const LEFTOVER_DEMO_PINS = ['2468', 'Fuchs-fährt-los'];");
        expect(ui).toContain('await vault.verifyPin(pin); } catch { continue; }');
            });

    it('meldet einen verschwundenen Tresor klar statt „Entsperren nicht möglich"', () => {
        expect(read('src/ui/lockVault.js')).toContain("if (err?.message === 'no-vault') {");
    });
});
