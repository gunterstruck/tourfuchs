import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { projectedRows, readSalesSideSheets } from '../src/services/excel.js';
import { SALES_SHEETS, SALES_SIDE_COLUMNS, SALES_SIDE_SHEETS } from '../src/features/salesWorkbook.js';

// PO, 10.10.2026: Aus der 46-MB-Konzernliste „FY27_Alle_Bereiche_Gesamt" las
// TourFuchs früher nur das Kundenblatt. Seit der Vertriebs-Arbeitsmappe las es
// alle Blätter mit allen Spalten – „Die Datei ist zu groß für den Speicher
// dieses Geräts". Jetzt: Detailblätter nur mit den ausgewerteten Spalten, und
// reicht der Speicher trotzdem nicht, wie früher nur das Kundenblatt.

const denseSheet = (aoa) => XLSX.utils.aoa_to_sheet(aoa, { dense: true });

describe('Detailblätter speichersparend lesen', () => {
    it('übernimmt nur die gewünschten Spalten und zählt trotzdem jede gefüllte Zeile', () => {
        const sheet = denseSheet([
            ['IFA Nr', 'Unwichtig', '  vorname ', 'Nachname', 'Vorname'],
            ['000123', 'x', 'Clara', 'Klein', 'Doppelt'],
            ['', 'nur hier etwas', '', '', ''],
            ['', '', '', '', ''],
            ['000777', '', '', 'Ohne Vorname', '']
        ]);
        const rows = projectedRows(sheet, ['IFA Nr', 'Vorname', 'Nachname']);
        expect(rows).toEqual([
            // Überschrift unabhängig von Groß/Klein und Leerzeichen; die erste von zwei gleichen gilt.
            { 'IFA Nr': '000123', Vorname: 'Clara', Nachname: 'Klein' },
            // Zeile mit Werten nur in anderen Spalten zählt für die Kontrollzahlen mit.
            {},
            { 'IFA Nr': '000777', Nachname: 'Ohne Vorname' }
        ]);
    });

    it('liest jede Spalte, die die Auswertung abfragt', () => {
        const source = readFileSync('src/features/salesWorkbook.js', 'utf8');
        const asked = new Set();
        for (const call of source.matchAll(/cell\(row((?:\s*,\s*'[^']*')+)\s*\)/g)) {
            for (const literal of call[1].matchAll(/'([^']*)'/g)) asked.add(literal[1]);
        }
        // IFA-Spalten der Verknüpfung (attach(..., ['IFA Nr', 'IFA'], ...)).
        for (const call of source.matchAll(/attach\([^,]+,\s*\[([^\]]*)\]/g)) {
            for (const literal of call[1].matchAll(/'([^']*)'/g)) asked.add(literal[1]);
        }
        expect(asked.size).toBeGreaterThan(30);
        const read = new Set(SALES_SIDE_COLUMNS);
        expect([...asked].filter((header) => !read.has(header))).toEqual([]);
    });
});

describe('Reicht der Speicher nicht, gilt wie früher das Kundenblatt', () => {
    it('meldet übersprungene Detailblätter statt abzubrechen', () => {
        const result = readSalesSideSheets(() => true, (name) => {
            if (name === SALES_SHEETS.contacts) throw new RangeError('Array buffer allocation failed');
            return denseSheet([['IFA'], ['1']]);
        });
        expect(result.sideSkipped).toBe(true);
        expect(Object.keys(result.sideSheets).sort()).toEqual([...SALES_SIDE_SHEETS].sort());
        expect(Object.values(result.sideSheets).every((rows) => rows.length === 0)).toBe(true);
    });

    it('lässt andere Fehler durch', () => {
        expect(() => readSalesSideSheets(() => true, () => { throw new Error('kaputt'); })).toThrow('kaputt');
    });

    it('behält bisherige Kontakte, Opportunities und Produkte und prüft nur das Gelesene', () => {
        const wizard = readFileSync('src/ui/importWizard.js', 'utf8');
        expect(wizard).toContain('contactsFromFile: Boolean(sales) && !parsed.sideSkipped');
        expect(wizard).toContain("fileProps: sales && !parsed.sideSkipped ? ['opps', 'produkte'] : []");
        expect(wizard).toContain('if (parsed.sideSkipped) note(');
        expect(readFileSync('src/features/salesWorkbook.js', 'utf8')).toContain('if (!(sheet in read)) continue;');
    });
});

describe('Wurde die Seite beim Lesen verworfen, liest der nächste Versuch schlank', () => {
    it('merkt sich die Datei nach Name und Größe', async () => {
        const { rememberHeavyFile, isHeavyFile } = await import('../src/features/importInFlight.js');
        const store = new Map();
        const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
        expect(isHeavyFile({ name: 'FY27_Alle_Bereiche_Gesamt 1.xlsx', size: 46_600_000 }, { storage })).toBe(false);
        rememberHeavyFile({ name: 'FY27_Alle_Bereiche_Gesamt 1.xlsx', size: 46_600_000 }, { storage });
        expect(isHeavyFile({ name: 'FY27_Alle_Bereiche_Gesamt 1.xlsx', size: 46_600_000 }, { storage })).toBe(true);
        // Neue Fassung (andere Größe): wieder vollständig versuchen.
        expect(isHeavyFile({ name: 'FY27_Alle_Bereiche_Gesamt 1.xlsx', size: 47_000_000 }, { storage })).toBe(false);
    });

    it('liest nach Speichermangel noch einmal nur das Kundenblatt', () => {
        const wizard = readFileSync('src/ui/importWizard.js', 'utf8');
        expect(wizard).toContain('rememberHeavyFile(interrupted);');
        expect(wizard).toContain('workbook = await readFileWithFeedback(file, lean ? { salesDetails: false } : {});');
        expect(wizard).toContain('workbook = await readFileWithFeedback(file, { salesDetails: false });');
        expect(readFileSync('src/services/excel.js', 'utf8')).toContain('const { sideSheets, sideSkipped } = salesDetails');
    });
});
