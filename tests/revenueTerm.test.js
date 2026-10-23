import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { revenueKindOf, revenueKindOfHeader, revenueTerm } from '../src/features/revenueTerm.js';
import { autoDetectMapping, customerExportRows, parseRows } from '../src/services/excel.js';
import { setCustomers, state } from '../src/core/state.js';
import { customerPopupHtml } from '../src/features/map.js';
import { revenueBriefingLine } from '../src/features/revenueYears.js';
import { buildCustomerBriefingPrompt } from '../src/features/customerBriefing.js';
import { mergeWithPrevious } from '../src/features/importMerge.js';

/**
 * PO 23.10.2026: Die Zahlen der Vertriebslisten sind Auftragseingang (AE),
 * nicht Umsatz. Die Bezeichnung folgt der eingelesenen Spalte.
 */
const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const base = { name: 'Kunde', plz: 'PLZ' };

afterEach(() => setCustomers([]));

describe('Welche Spalte ist Auftragseingang?', () => {
    it('erkennt AE, Auftragseingang und Orders – nicht Umsatz', () => {
        for (const h of ['AE GJ25', 'AE', 'Auftragseingang 2025', 'Auftragseingänge', 'Orders FY26', 'Order intake', 'AE (T€)']) {
            expect(revenueKindOfHeader(h), h).toBe('ae');
        }
        for (const h of ['Umsatz', 'Umsatz 2025', 'Jahresumsatz', 'Revenue', 'Räderwerk', 'Kaesekuchen', '', null]) {
            expect(revenueKindOfHeader(h), String(h)).toBe('umsatz');
        }
    });

    it('ordnet bei reinen Jahresspalten den jüngsten Jahrgang als Betrag zu', () => {
        expect(autoDetectMapping(['Kundenname', 'PLZ', 'AE GJ24', 'AE GJ26', 'AE GJ25']).umsatz).toBe('AE GJ26');
        expect(autoDetectMapping(['Kundenname', 'PLZ', 'Orders FY25', 'Orders FY26']).umsatz).toBe('Orders FY26');
        expect(autoDetectMapping(['Kundenname', 'PLZ', 'Umsatz', 'AE GJ26']).umsatz).toBe('Umsatz');
        expect(autoDetectMapping(['Kundenname', 'PLZ', 'AE GJ 24-26']).umsatz).toBeNull();
    });

    it('nimmt „Auftragseingang" beim Import nur als ganzen Spaltennamen', () => {
        expect(autoDetectMapping(['Kundenname', 'PLZ', 'Auftragseingang']).umsatz).toBe('Auftragseingang');
        expect(autoDetectMapping(['Kundenname', 'PLZ', 'Auftragseingang Datum']).umsatz).toBeNull();
    });
});

describe('Import merkt sich die Bezeichnung am Kunden', () => {
    it('AE-Spalte → umsatzArt „ae", Umsatz-Spalte → kein Feld', () => {
        const ae = parseRows([{ Kunde: 'A GmbH', PLZ: '45136', 'AE GJ25': '12.500' }], { ...base, umsatz: 'AE GJ25' });
        expect(ae.customers[0]).toMatchObject({ umsatz: 12500, umsatzArt: 'ae' });
        expect(ae.errors.find((e) => e.Typ === 'Hinweis').Grund).toMatch(/^AE-Spalte „AE GJ25"/);
        const umsatz = parseRows([{ Kunde: 'A GmbH', PLZ: '45136', Umsatz: '12.500' }], { ...base, umsatz: 'Umsatz' });
        expect(umsatz.customers[0].umsatzArt).toBeUndefined();
        expect(umsatz.errors.find((e) => e.Typ === 'Hinweis').Grund).toMatch(/^Umsatzspalte „Umsatz"/);
    });

    it('auch ohne zugeordnete Betragsspalte: die Jahresspalten entscheiden', () => {
        const { customers } = parseRows([{ Kunde: 'A GmbH', PLZ: '45136', 'AE GJ25': '200', 'AE GJ24': '100' }], { ...base });
        expect(customers[0]).toMatchObject({ umsatzArt: 'ae', umsatzJahre: { 2025: 200, 2024: 100 } });
        const plain = parseRows([{ Kunde: 'A GmbH', PLZ: '45136', 'Umsatz 2025': '200' }], { ...base });
        expect(plain.customers[0].umsatzArt).toBeUndefined();
    });

    it('der Bestand heißt danach Auftragseingang', () => {
        const { customers } = parseRows([{ Kunde: 'A GmbH', PLZ: '45136', 'AE GJ25': '100' }], { ...base, umsatz: 'AE GJ25' });
        setCustomers(customers);
        expect(state.revenueKind).toBe('ae');
        expect(revenueTerm(state.revenueKind)).toMatchObject({ name: 'Auftragseingang', short: 'AE' });
        setCustomers([{ id: 'k1', name: 'B', umsatz: 5 }]);
        expect(state.revenueKind).toBe('umsatz');
        expect(revenueKindOf(null)).toBe('umsatz');
    });

    it('gespeicherte Bestände von vor dem 23.10.2026 heißen ohne Reimport Auftragseingang', () => {
        // So liegt ein früher eingelesener Kunde im Speicher: ohne umsatzArt,
        // die Original-Jahresspalten in `extra`.
        setCustomers([{ id: 'k1', name: 'A', umsatz: 200, umsatzJahre: { 2026: 200 }, extra: { 'AE GJ26': '200', 'AE GJ25': '100' } }]);
        expect(state.customers[0].umsatzArt).toBe('ae');
        expect(state.revenueKind).toBe('ae');
        setCustomers([{ id: 'k2', name: 'B', umsatz: 200, extra: { 'Umsatz 2025': '200', Bemerkung: 'AE prüfen' } }]);
        expect(state.customers[0].umsatzArt).toBeUndefined();
        expect(state.revenueKind).toBe('umsatz');
    });

    it('Reimport mit Umsatz-Spalte nimmt die alte AE-Bezeichnung nicht mit', () => {
        const previous = [{ id: 'k-nr:1', nummer: '1', name: 'A', plz: '1', umsatz: 100, umsatzArt: 'ae' }];
        const incoming = [{ id: 'k-nr:1', nummer: '1', name: 'A', plz: '1', umsatz: 200 }];
        mergeWithPrevious(previous, incoming, { mapping: { umsatz: 'Umsatz' }, headers: ['Umsatz'] });
        expect(incoming[0].umsatzArt).toBeUndefined();
    });

    it('Export heißt „Auftragseingang" und kommt beim Wiedereinlesen als AE zurück', () => {
        const [row] = customerExportRows([{ id: 'k1', name: 'A', plz: '1', umsatz: 100, umsatzArt: 'ae', besuche: [] }]);
        expect(row.Auftragseingang).toBe(100);
        expect(row).not.toHaveProperty('Umsatz');
        expect(revenueKindOfHeader(autoDetectMapping(Object.keys(row)).umsatz)).toBe('ae');
        const [plain] = customerExportRows([{ id: 'k2', name: 'B', plz: '1', umsatz: 5, besuche: [] }]);
        expect(plain.Umsatz).toBe(5);
    });
});

describe('Kachel und Briefing sagen „Auftragseingang"', () => {
    const kunde = (overrides = {}) => ({
        id: 'k1', nummer: '1', name: 'Muster GmbH', plz: '45127', ort: 'Essen', lat: 51.45, lng: 7.01,
        umsatz: 125000, umsatzJahre: { 2025: 125000, 2024: 100000 }, besuche: [], ...overrides
    });

    it('Kundenkachel: Betrag und Jahresübersicht', () => {
        const html = customerPopupHtml(kunde({ umsatzArt: 'ae' }));
        expect(html).toContain('<span>Auftragseingang</span>');
        expect(html).toContain('Auftragseingang nach Geschäftsjahr');
        expect(html).not.toContain('<span>Umsatz</span>');
        expect(customerPopupHtml(kunde())).toContain('<span>Umsatz</span>');
    });

    it('KI-Briefing: Zeile und Hinweis, dass es kein Umsatz ist', () => {
        const today = new Date(2026, 9, 23);
        expect(revenueBriefingLine(kunde({ umsatzArt: 'ae' }), String, today)).toMatch(/^- Auftragseingang nach Geschäftsjahr: GJ25: 125000/);
        expect(revenueBriefingLine(kunde(), String, today)).toMatch(/^- Umsatz nach Geschäftsjahr:/);
        const prompt = buildCustomerBriefingPrompt(kunde({ umsatzArt: 'ae' }), { today });
        expect(prompt).toContain('Auftragseingang nach Geschäftsjahr');
        expect(prompt).toContain('nicht Umsatz');
        expect(prompt).not.toContain('Umsatz nach Geschäftsjahr');
    });

    it('feste Beschriftungen im Seitengerüst sind markiert', () => {
        const html = read('index.html');
        expect(html.match(/data-revenue-(term|template)=/g)?.length).toBeGreaterThanOrEqual(5);
        expect(read('src/main.js')).toContain('initRevenueLabels()');
    });
});
