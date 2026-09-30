import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    visitReportEntries, visitReportRows, isVisitReportHeaders, mergeVisitReport, mergeSummary,
    parseVisitDate, weekStartIso, rememberSentVisits, loadSentVisits, visitKey
} from '../src/features/visitReport.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

function memoryStorage() {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

const TODAY = '2026-09-30'; // Mittwoch
const customers = () => ([
    { id: 'a', nummer: '1001', name: 'Bäckerei Berg', plz: '45127', ort: 'Essen', besuche: ['2026-09-30'], extra: { 'SAP-ID': 'S-1' } },
    { id: 'b', nummer: '1002', name: 'Autohaus Adler', plz: '44135', ort: 'Dortmund', besuche: ['2026-09-29', '2026-09-30'] },
    { id: 'c', nummer: '1003', name: 'Café Club', plz: '40210', ort: 'Düsseldorf', besuche: ['2026-09-26'] },
    { id: 'd', nummer: '1004', name: 'Druckerei Dorn', plz: '50667', ort: 'Köln', besuche: ['2026-05-01'] }
]);

describe('Besuchsbericht – Auswahl', () => {
    it('kennt Heute, Diese Woche (ab Montag) und Seit dem letzten Bericht', () => {
        expect(weekStartIso(TODAY)).toBe('2026-09-28');
        const list = customers();
        expect(visitReportEntries(list, { range: 'today', today: TODAY }).map((e) => e.customer.nummer)).toEqual(['1002', '1001']);
        expect(visitReportEntries(list, { range: 'week', today: TODAY })).toHaveLength(3);
        // „Seit dem letzten Bericht" reicht 60 Tage zurück, nicht in die ganze Historie.
        expect(visitReportEntries(list, { range: 'unsent', today: TODAY })).toHaveLength(4);
    });

    it('lässt weitergegebene Besuche bei „Seit dem letzten Bericht" weg', () => {
        const storage = memoryStorage();
        const list = customers();
        const first = visitReportEntries(list, { range: 'today', today: TODAY });
        rememberSentVisits(first, { today: TODAY, storage });
        const sent = loadSentVisits(storage);
        expect(sent.has(visitKey(list[0], '2026-09-30'))).toBe(true);
        const rest = visitReportEntries(list, { range: 'unsent', today: TODAY, sent });
        expect(rest.map((e) => e.date)).toEqual(['2026-09-26', '2026-09-29']);
    });
});

describe('Besuchsbericht – Datei', () => {
    it('schreibt eine Zeile je Besuch mit Datum, Kundennummer und Originalspalten', () => {
        const rows = visitReportRows(visitReportEntries(customers(), { range: 'today', today: TODAY }));
        expect(rows[1]).toMatchObject({ Besuchsdatum: '2026-09-30', Kundennummer: '1001', Kundenname: 'Bäckerei Berg', Ort: 'Essen', 'SAP-ID': 'S-1' });
        expect(Object.keys(rows[0])[0]).toBe('Besuchsdatum');
        expect(isVisitReportHeaders(Object.keys(rows[0]))).toBe(true);
    });

    it('markiert Demo-Berichte', () => {
        const rows = visitReportRows(visitReportEntries(customers(), { range: 'today', today: TODAY }), { demo: true });
        expect(rows[0].Datenstatus).toMatch(/DEMO/);
    });

    it('verwechselt eine normale Kundenliste nicht mit einem Bericht', () => {
        expect(isVisitReportHeaders(['Kundennummer', 'Kundenname', 'PLZ', 'Letzter Besuch'])).toBe(false);
        expect(isVisitReportHeaders([' besuchsdatum ', 'KUNDENNUMMER'])).toBe(true);
    });
});

describe('Besuchsbericht – am Desktop übernehmen', () => {
    it('trägt nur Besuche nach – über die Kundennummer, ohne Doppelte', () => {
        const list = customers();
        const before = JSON.stringify(list.map(({ besuche, ...rest }) => rest));
        const result = mergeVisitReport(list, [
            { Besuchsdatum: '2026-09-30', Kundennummer: '1003' },
            { Besuchsdatum: '29.09.2026', Kundennummer: ' 1004 ' },
            { Besuchsdatum: '2026-09-30', Kundennummer: '1001' },
            { Besuchsdatum: '2026-09-30', Kundennummer: '9999' },
            { Besuchsdatum: 'morgen', Kundennummer: '1002' },
            { Besuchsdatum: '2026-10-05', Kundennummer: '1002' }
        ], { today: TODAY });
        expect(result).toMatchObject({ added: 2, known: 1, unknown: ['9999'], invalid: 2 });
        expect(list[2].besuche).toEqual(['2026-09-26', '2026-09-30']);
        expect(list[3].besuche).toEqual(['2026-05-01', '2026-09-29']);
        // Sonst ändert sich nichts an den Kunden.
        expect(JSON.stringify(list.map(({ besuche, ...rest }) => rest))).toBe(before);
        expect(mergeSummary(result)).toBe('2 Besuche übernommen · 1 war schon eingetragen · 1 Kunde nicht gefunden (9999) · 2 Zeilen ohne gültiges Datum oder Kundennummer.');
    });

    it('liest ISO, deutsches Datum und Excel-Seriennummern', () => {
        expect(parseVisitDate('2026-09-30')).toBe('2026-09-30');
        expect(parseVisitDate('1.9.26')).toBe('2026-09-01');
        expect(parseVisitDate('46295')).toBe('2026-09-30');
        expect(parseVisitDate('31.02.2026')).toBeNull();
    });

    it('erkennt den Bericht im Import, bevor der Zuordnungsschritt startet', () => {
        const wizard = read('src/ui/importWizard.js');
        expect(wizard).toContain('if (isVisitReportHeaders(workbook.headers)) {');
        expect(wizard.indexOf('isVisitReportHeaders(workbook.headers)')).toBeLessThan(wizard.indexOf('await showMappingStep();'));
    });
});

describe('Besuchsbericht – Oberfläche', () => {
    const html = read('index.html');
    const ui = read('src/ui/visitReport.js');

    it('ist am Handy in „Meine Tour" und im Feierabend erreichbar, am Desktop im Daten-Bereich', () => {
        expect(html).toContain('id="btn-visit-report"');
        expect(html).toContain('id="day-review-share"');
        expect(html).toContain('id="btn-visit-report-data"');
        expect(html).toContain('id="visit-report-dialog"');
    });

    it('teilt über das Teilen-Menü, sonst Download – und merkt nur Weitergegebenes', () => {
        expect(ui).toContain('navigator.canShare?.({ files: [file] })');
        expect(ui).toContain("if (error?.name === 'AbortError') return;");
        expect(ui.indexOf('rememberSentVisits(entries)')).toBeGreaterThan(ui.indexOf('navigator.share'));
    });

    it('nennt den Datenschutz-Hinweis im Dialog', () => {
        expect(html).toContain('Die Datei enthält Kundennamen. Teile sie nur über die Wege deiner Organisation');
    });
});
