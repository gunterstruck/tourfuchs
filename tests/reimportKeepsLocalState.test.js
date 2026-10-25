import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { carryOverVisits } from '../src/features/datasetDiff.js';
import { adoptNumbers, mergeWithPrevious } from '../src/features/importMerge.js';
import { loadSentVisits, visitKey, visitReportEntries } from '../src/features/visitReport.js';

/**
 * Prüfbefunde vom 25.10.2026: Ein Reimport bzw. ein sicherer Umzug darf
 * lokal Erfasstes weder verlieren noch falsch einordnen.
 */
const read = (file) => readFileSync(file, 'utf8');
const today = new Date().toISOString().slice(0, 10);

describe('Befund 2: Reimport markiert nur Besuche aus der Datei als weitergegeben', () => {
    beforeEach(() => { localStorage.clear(); document.body.innerHTML = '<dialog id="visit-report-dialog"></dialog>'; });

    it('ein am Handy erfasster Besuch bleibt in „Seit dem letzten Bericht"', async () => {
        const { state, emit } = await import('../src/core/state.js');
        const { initVisitReport } = await import('../src/ui/visitReport.js');
        const fromFile = { id: 'a', nummer: '4711', name: 'Muster GmbH', plz: '44787', besuche: [today] };
        const local = { id: 'b', nummer: '4712', name: 'Beispiel KG', plz: '44789', besuche: [today] };
        // Die Datei kennt nur den ersten Besuch; den zweiten hat der Reimport übernommen.
        const visitEntries = visitReportEntries([{ ...fromFile }, { ...local, besuche: [] }], { range: 'unsent' });
        state.customers = [fromFile, local];
        initVisitReport();
        emit('data:imported', { count: 2, visitEntries });

        const sent = loadSentVisits();
        expect(sent.has(visitKey(fromFile, today))).toBe(true);
        expect(sent.has(visitKey(local, today))).toBe(false);
        expect(visitReportEntries(state.customers, { range: 'unsent', sent }).map((e) => e.customer.name)).toEqual(['Beispiel KG']);
    });

    it('der Import ermittelt die Besuche der Datei vor der Übernahme der lokalen', () => {
        const ui = read('src/ui/importWizard.js');
        const fromFile = ui.indexOf("const visitsFromFile = visitReportEntries(customers, { range: 'unsent' });");
        expect(fromFile).toBeGreaterThan(-1);
        expect(fromFile).toBeLessThan(ui.indexOf('carryOverVisits(previous, customers)'));
        expect(ui).toContain("emit('data:imported', { count: customers.length, visitEntries: visitsFromFile });");
    });
});

describe('Befund 3: sicherer Umzug behält Besuche bei nachgetragener Kundennummer', () => {
    const local = [{ nummer: '', name: 'Muster Mineral GmbH', plz: '99999', besuche: ['2026-10-20'] }];
    const received = () => [{ nummer: '7654321', name: 'Muster Mineral GmbH', plz: '99999', besuche: [] }];

    it('ohne Zuordnung gingen die Besuche verloren', () => {
        const incoming = received();
        expect(carryOverVisits(local, incoming)).toBe(0);
    });

    it('mit derselben eindeutigen Zuordnung wie beim Excel-Import bleiben sie', () => {
        const incoming = received();
        expect(carryOverVisits(adoptNumbers(local, incoming), incoming)).toBe(1);
        expect(incoming[0].besuche).toEqual(['2026-10-20']);
    });

    it('der Empfang nutzt sie', () => {
        expect(read('src/ui/safeTransfer.js')).toContain('carryOverVisits(adoptNumbers(state.customers, customers), customers)');
    });
});

describe('Befund 4: Ergänzungsimport behält „Auftragseingang"', () => {
    const previous = () => [{ nummer: '4711', name: 'Muster GmbH', plz: '44787', umsatz: 120000, umsatzArt: 'ae' }];

    it('ohne Betragsspalte bleiben Betrag und Kennzeichnung zusammen', () => {
        const incoming = [{ nummer: '4711', name: 'Muster GmbH', plz: '44787', umsatz: null }];
        mergeWithPrevious(previous(), incoming, { mapping: { name: 'Kunde', plz: 'PLZ' }, headers: ['Kunde', 'PLZ', 'Telefon'] });
        expect(incoming[0].umsatz).toBe(120000);
        expect(incoming[0].umsatzArt).toBe('ae');
    });

    it('bisheriger Umsatz bleibt Umsatz', () => {
        const before = [{ nummer: '4711', name: 'Muster GmbH', plz: '44787', umsatz: 5000 }];
        const incoming = [{ nummer: '4711', name: 'Muster GmbH', plz: '44787', umsatz: null }];
        mergeWithPrevious(before, incoming, { mapping: { name: 'Kunde', plz: 'PLZ' }, headers: ['Kunde', 'PLZ'] });
        expect(incoming[0].umsatz).toBe(5000);
        expect(incoming[0].umsatzArt).toBeUndefined();
    });

    it('bringt die Datei eigene Jahresspalten mit, entscheiden diese', () => {
        const incoming = [{ nummer: '4711', name: 'Muster GmbH', plz: '44787', umsatz: null, umsatzJahre: { 2025: 90000 } }];
        mergeWithPrevious(previous(), incoming, { mapping: { name: 'Kunde', plz: 'PLZ' }, headers: ['Kunde', 'PLZ', 'Umsatz GJ25'] });
        expect(incoming[0].umsatzArt).toBeUndefined();
    });
});
