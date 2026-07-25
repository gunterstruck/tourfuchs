import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { customerKey, diffCustomerDatasets, diffHeadline } from '../src/features/datasetDiff.js';

const kunde = (over = {}) => ({
    name: 'Muster GmbH', nummer: '', plz: '45136', ort: 'Essen', bezirk: 'West', umsatz: 100000, ...over
});

describe('Änderungsbericht beim Reimport', () => {
    it('ordnet über die Kundennummer zu, sonst über Name + PLZ', () => {
        expect(customerKey(kunde({ nummer: '4711' }))).toBe('nr:4711');
        expect(customerKey(kunde({ name: 'Muster GmbH', plz: '45136' }))).toBe('np:muster gmbh|45136');
        // Umbenennung bei gleicher Nummer bleibt derselbe Kunde
        expect(customerKey(kunde({ nummer: '4711', name: 'Muster Holding' }))).toBe('nr:4711');
    });

    it('trennt neu, entfallen, gewechselt und unverändert', () => {
        const previous = [
            kunde({ nummer: '1', bezirk: 'West' }),
            kunde({ nummer: '2', bezirk: 'Nord' }),
            kunde({ nummer: '3', bezirk: 'Süd' })
        ];
        const incoming = [
            kunde({ nummer: '1', bezirk: 'West' }),          // unverändert
            kunde({ nummer: '2', bezirk: 'Süd' }),           // Bezirkswechsel
            kunde({ nummer: '4', bezirk: 'Ost' })            // neu; Nr. 3 entfällt
        ];
        const diff = diffCustomerDatasets(previous, incoming);

        expect(diff.added.map((c) => c.nummer)).toEqual(['4']);
        expect(diff.removed.map((c) => c.nummer)).toEqual(['3']);
        expect(diff.moved).toHaveLength(1);
        expect(diff.moved[0]).toMatchObject({ nummer: '2', from: 'Nord', to: 'Süd' });
        expect(diff.keptCount).toBe(2);
        expect(diff.hasChanges).toBe(true);
    });

    it('meldet einen unveränderten Bestand als unverändert', () => {
        const bestand = [kunde({ nummer: '1' }), kunde({ nummer: '2' })];
        const diff = diffCustomerDatasets(bestand, bestand.map((c) => ({ ...c })));
        expect(diff.hasChanges).toBe(false);
        expect(diff.keptCount).toBe(2);
        expect(diffHeadline(diff)).toMatch(/Keine Unterschiede/);
    });

    it('rechnet Kunden und Umsatz je Bezirk mit Vorzeichen', () => {
        const previous = [
            kunde({ nummer: '1', bezirk: 'West', umsatz: 100000 }),
            kunde({ nummer: '2', bezirk: 'West', umsatz: 50000 })
        ];
        const incoming = [
            kunde({ nummer: '1', bezirk: 'West', umsatz: 100000 }),
            kunde({ nummer: '2', bezirk: 'Nord', umsatz: 50000 }),
            kunde({ nummer: '3', bezirk: 'Nord', umsatz: 20000 })
        ];
        const diff = diffCustomerDatasets(previous, incoming);
        const west = diff.districts.find((d) => d.bezirk === 'West');
        const nord = diff.districts.find((d) => d.bezirk === 'Nord');

        expect(west).toMatchObject({ beforeCount: 2, afterCount: 1, deltaCount: -1, deltaUmsatz: -50000 });
        expect(nord).toMatchObject({ beforeCount: 0, afterCount: 2, deltaCount: 2, deltaUmsatz: 70000 });
        expect(diff.totals).toMatchObject({
            beforeCount: 2, afterCount: 3, beforeUmsatz: 150000, afterUmsatz: 170000
        });
        // größte Bewegung zuerst
        expect(diff.districts[0].bezirk).toBe('Nord');
    });

    it('führt Kunden ohne Bezirk unter „Ohne Zuordnung"', () => {
        const diff = diffCustomerDatasets([kunde({ nummer: '1', bezirk: '' })], [kunde({ nummer: '1', bezirk: 'West' })]);
        expect(diff.moved[0]).toMatchObject({ from: 'Ohne Zuordnung', to: 'West' });
    });

    it('behandelt fehlende Umsätze als 0 statt als NaN', () => {
        const diff = diffCustomerDatasets(
            [kunde({ nummer: '1', umsatz: null })],
            [kunde({ nummer: '1', umsatz: undefined }), kunde({ nummer: '2', umsatz: 'k. A.' })]
        );
        expect(diff.totals.afterUmsatz).toBe(0);
        expect(diff.districts.every((d) => Number.isFinite(d.deltaUmsatz))).toBe(true);
    });

    it('zählt eine Dublette in der neuen Liste als zusätzlichen Eintrag, nicht als Treffer', () => {
        const diff = diffCustomerDatasets(
            [kunde({ nummer: '1' })],
            [kunde({ nummer: '1' }), kunde({ nummer: '1' })]
        );
        expect(diff.keptCount).toBe(1);
        expect(diff.added).toHaveLength(1);
    });

    it('fasst die Lage in einer Zeile zusammen', () => {
        const diff = diffCustomerDatasets(
            [kunde({ nummer: '1', bezirk: 'West' }), kunde({ nummer: '2' })],
            [kunde({ nummer: '1', bezirk: 'Nord' }), kunde({ nummer: '3' })]
        );
        expect(diffHeadline(diff)).toBe('1 neu · 1 entfällt · 1 Bezirkswechsel');
    });

    it('ist vor der Ersetzung in den Import eingehängt', () => {
        const wizard = readFileSync(resolve(process.cwd(), 'src/ui/importWizard.js'), 'utf8');
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        expect(wizard).toContain('confirmImportWithDiff');
        // Ohne Bestätigung wird nicht ersetzt
        expect(wizard).toContain('if (!confirmed) {');
        expect(wizard.indexOf('confirmImportWithDiff')).toBeLessThan(wizard.indexOf('replaceCustomers(customers'));
        expect(html).toContain('id="import-diff-dialog"');
        expect(html).toContain('data-diff-confirm');
    });
});
