/**
 * Kopfzeile und Tabellenblatt beim Excel-Import.
 *
 * Anlass: Eine echte Vertriebsliste (Debitor / IFA Nr / Kundenname / plz / ort)
 * kam mit zwei Vorspannzeilen über der Überschrift. SheetJS nahm stur die erste
 * Zeile des benutzten Bereichs als Kopf – die Zuordnung bot daraufhin
 * Datenwerte („Endkunde", ein Mitarbeitername) als Spaltennamen an, die
 * Pflichtspalte PLZ blieb „nicht vorhanden", und die erste echte Datenzeile
 * verschwand als vermeintliche Überschrift.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { readWorkbook } from '../src/services/excel.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

function excelFile(sheets, name = 'liste.xlsx') {
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.grid), sheet.name);
    }
    wb.Workbook = { Sheets: sheets.map((sheet) => ({ Hidden: sheet.hidden ? 1 : 0 })) };
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return { name, arrayBuffer: async () => buffer };
}

const KOPF = ['Debitor', 'IFA Nr', 'Kundenname', 'plz', 'ort', 'VBEZ', 'AE'];
const DATEN = [
    ['8661', '0249537442', 'OXEA SERVICES GMBH', '46147', 'OBERHAUSEN', 'H10H', 'Struck Guenter'],
    ['1611588', '0016115883', 'SCHWALBE STEUERUNGSTECHNIK GMBH', '45307', 'ESSEN', 'H10H', 'Struck Guenter'],
    ['A1721374', '0246758835', 'BILFINGER ENGINEERING GMBH', '46047', 'OBERHAUSEN', 'H10H', 'Struck Guenter']
];

describe('Excel-Import findet die echte Überschriftenzeile', () => {
    it('überspringt Vorspannzeilen über der Tabelle', async () => {
        const file = excelFile([{
            name: 'VBEZ Übersicht',
            grid: [
                ['Auswertung Vertriebsbezirk H10H', '', '', '', '', '', 'Stand: 20.07.2026'],
                ['Endkunde', '', '', '', '', '', 'Struck Guenter'],
                KOPF,
                ...DATEN
            ]
        }]);

        const { headers, rows, headerRow } = await readWorkbook(file);
        expect(headerRow).toBe(3);
        expect(headers).toEqual(KOPF);
        expect(rows).toHaveLength(3);
        expect(rows[0].Kundenname).toBe('OXEA SERVICES GMBH');
        expect(rows[0].plz).toBe('46147');
    });

    it('nimmt eine Datenzeile nicht als Kopf – auch wenn sie ganz oben steht', async () => {
        // Der Kern des gemeldeten Fehlers: Werte, die sich in der Spalte darunter
        // wiederholen („Struck Guenter"), sind Daten, keine Spaltennamen.
        const file = excelFile([{
            name: 'Kunden',
            grid: [DATEN[0], KOPF, ...DATEN.slice(1)]
        }]);

        const { headers, headerRow } = await readWorkbook(file);
        expect(headerRow).toBe(2);
        expect(headers).toEqual(KOPF);
    });

    it('lässt saubere Listen mit Kopf in Zeile 1 unverändert', async () => {
        const file = excelFile([{ name: 'Kunden', grid: [KOPF, ...DATEN] }]);
        const { headers, rows, headerRow } = await readWorkbook(file);
        expect(headerRow).toBe(1);
        expect(headers).toEqual(KOPF);
        expect(rows).toHaveLength(3);
    });

    it('erlaubt, die Überschriftenzeile von Hand zu setzen', async () => {
        const file = excelFile([{
            name: 'Kunden',
            grid: [['Titelzeile'], KOPF, ...DATEN]
        }]);
        const auto = await readWorkbook(file);
        expect(auto.autoHeaderRow).toBe(2);
        // Vorschau für die Auswahl von Hand: jede gefüllte Zeile mit ihrem Anfang.
        expect(auto.headerOptions[0]).toEqual({ row: 1, preview: 'Titelzeile' });

        const manuell = await readWorkbook(file, { headerRow: 1 });
        expect(manuell.headerRow).toBe(1);
        expect(manuell.headers[0]).toBe('Titelzeile');
    });

    it('gibt leeren und doppelten Spalten stabile Namen', async () => {
        const file = excelFile([{
            name: 'Kunden',
            grid: [
                ['Kundenname', '', 'PLZ', 'PLZ'],
                ['Muster GmbH', 'Notiz', '45127', '45128']
            ]
        }]);
        const { headers, rows } = await readWorkbook(file);
        expect(headers).toEqual(['Kundenname', 'Spalte 2', 'PLZ', 'PLZ (2)']);
        expect(rows[0]['PLZ (2)']).toBe('45128');
    });
});

describe('Excel-Import traut der Bereichsangabe der Datei nicht blind', () => {
    /**
     * Der gemeldete Fall: Die Datei nennt im `<dimension>`-Eintrag `A2:…` statt
     * `A1:…`. SheetJS übernimmt das ungeprüft als `!ref` – die Kopfzeile liegt
     * geparst im Blatt, wird aber von `sheet_to_json` nie ausgeliefert. Die
     * Tabelle beginnt eine Zeile zu tief, und eine Datenzeile muss den Kopf
     * spielen.
     */
    /**
     * Baut eine Datei mit falscher Bereichsangabe. Über die ZIP-Ebene, weil
     * SheetJS beim Schreiben immer korrekt rechnet – die kaputte Angabe kommt
     * nun einmal aus fremden Exportwerkzeugen, nicht aus SheetJS.
     */
    function fileWithDimension(ref) {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([KOPF, ...DATEN]), 'VBEZ Übersicht');
        const zip = XLSX.CFB.read(Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), { type: 'buffer' });
        const entry = XLSX.CFB.find(zip, '/xl/worksheets/sheet1.xml');
        const xml = new TextDecoder().decode(Uint8Array.from(entry.content))
            .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${ref}"/>`);
        entry.content = Array.from(new TextEncoder().encode(xml));
        entry.size = entry.content.length;
        const raw = XLSX.CFB.write(zip, { fileType: 'zip', type: 'array', compression: true });
        return { name: 'export.xlsx', arrayBuffer: async () => raw };
    }

    it('zeigt den Fehler, den die Datei auslöst: !ref verschluckt die Kopfzeile', async () => {
        const file = fileWithDimension('A2:G4');
        const sheet = XLSX.read(await file.arrayBuffer(), { type: 'array' }).Sheets['VBEZ Übersicht'];
        expect(sheet['!ref']).toBe('A2:G4');
        expect(sheet.A1.v).toBe('Debitor'); // Die Kopfzeile IST da …
        // … nur liefert sie der Standardweg nicht aus: erste Zeile = erste Datenzeile.
        expect(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })[0][0]).toBe(DATEN[0][0]);
    });

    it('liest die Kopfzeile trotzdem – über den echten Zellbereich', async () => {
        const { headers, rows, headerRow, sheetName } = await readWorkbook(fileWithDimension('A2:G4'));
        expect(sheetName).toBe('VBEZ Übersicht');
        expect(headerRow).toBe(1);
        expect(headers).toEqual(KOPF);
        expect(rows).toHaveLength(3);
        expect(rows[0].Kundenname).toBe('OXEA SERVICES GMBH');
        expect(rows[0].plz).toBe('46147');
    });

    it('kommt auch mit einer zu weit rechts beginnenden Angabe zurecht', async () => {
        const { headers, rows } = await readWorkbook(fileWithDimension('C1:G4'));
        expect(headers).toEqual(KOPF);
        expect(rows[0].Debitor).toBe(DATEN[0][0]);
    });

    it('lässt eine korrekte Angabe unangetastet', async () => {
        const { headers, rows, headerRow } = await readWorkbook(fileWithDimension('A1:G4'));
        expect(headerRow).toBe(1);
        expect(headers).toEqual(KOPF);
        expect(rows).toHaveLength(3);
    });

    it('meldet eine Kopfzeile ohne bekannte Feldnamen als unsicher', async () => {
        const sicher = await readWorkbook(excelFile([{ name: 'Kunden', grid: [KOPF, ...DATEN] }]));
        expect(sicher.headerConfident).toBe(true);

        const unsicher = await readWorkbook(excelFile([{
            name: 'Kunden',
            grid: [['Feld A', 'Feld B', 'Feld C'], ['1', '2', '3'], ['4', '5', '6']]
        }]));
        expect(unsicher.headerConfident).toBe(false);
    });
});

describe('Excel-Import wählt das richtige Tabellenblatt', () => {
    it('überspringt ausgeblendete Blätter', async () => {
        const file = excelFile([
            { name: 'Steuerung', hidden: true, grid: [['Parameter', 'Wert'], ['Version', '3']] },
            { name: 'VBEZ Übersicht', grid: [KOPF, ...DATEN] }
        ]);
        const { sheetName, headers } = await readWorkbook(file);
        expect(sheetName).toBe('VBEZ Übersicht');
        expect(headers).toEqual(KOPF);
    });

    it('meldet die sichtbaren Blätter zur Auswahl und liest das gewählte', async () => {
        const file = excelFile([
            { name: 'VBEZ Übersicht', grid: [KOPF, ...DATEN] },
            { name: 'AE je PCK', grid: [['AE', 'PCK'], ['Struck Guenter', 'PCK 1']] },
            { name: 'SieSales Kontakte', grid: [['Debitor', 'Ansprechpartner', 'E-Mail'], ['8661', 'A. Meier', 'a@m.de']] }
        ]);
        const auto = await readWorkbook(file);
        expect(auto.sheetName).toBe('VBEZ Übersicht');
        expect(auto.sheetNames).toEqual(['VBEZ Übersicht', 'AE je PCK', 'SieSales Kontakte']);

        const kontakte = await readWorkbook(file, { sheet: 'SieSales Kontakte' });
        expect(kontakte.sheetName).toBe('SieSales Kontakte');
        expect(kontakte.headers).toEqual(['Debitor', 'Ansprechpartner', 'E-Mail']);
        expect(kontakte.rows[0]['E-Mail']).toBe('a@m.de');
    });

    it('liest ein ausdrücklich gewähltes Blatt auch mit gesetzter Überschriftenzeile', async () => {
        const file = excelFile([
            { name: 'VBEZ Übersicht', grid: [KOPF, ...DATEN] },
            { name: 'SieSales Kontakte', grid: [['Kontaktliste Stand 07/2026'], ['Debitor', 'Ansprechpartner'], ['8661', 'A. Meier']] }
        ]);
        const gewaehlt = await readWorkbook(file, { sheet: 'SieSales Kontakte', headerRow: 1 });
        expect(gewaehlt.sheetName).toBe('SieSales Kontakte');
        expect(gewaehlt.headerRow).toBe(1);
        expect(gewaehlt.headers[0]).toBe('Kontaktliste Stand 07/2026');
    });

    it('geht zum nächsten Blatt, wenn das erste sichtbare leer ist', async () => {
        const file = excelFile([
            { name: 'Deckblatt', grid: [['TourFuchs Auswertung']] },
            { name: 'Kunden', grid: [KOPF, ...DATEN] }
        ]);
        const { sheetName, rows } = await readWorkbook(file);
        expect(sheetName).toBe('Kunden');
        expect(rows).toHaveLength(3);
    });
});

describe('Zuordnungsdialog macht Blatt und Überschriftenzeile korrigierbar', () => {
    const html = read('index.html');
    const wizard = read('src/ui/importWizard.js');

    it('bietet beide Auswahlfelder im Import-Dialog an', () => {
        expect(html).toContain('id="mapping-source"');
        expect(html).toContain('id="mapping-sheet"');
        expect(html).toContain('id="mapping-header-row"');
    });

    it('lädt die Datei bei geänderter Auswahl neu, statt sie erneut zu verlangen', () => {
        expect(wizard).toContain('reloadWorkbookSource');
        expect(wizard).toContain('readWorkbook(parsed.file, { sheet, headerRow })');
        // Der Dialog ist beim Wechsel schon offen – showModal() dürfte nicht erneut laufen.
        expect(wizard).toContain('if (!dialog.open) dialog.showModal()');
    });

    it('nennt das gelesene Blatt in der Dateizeile', () => {
        expect(wizard).toContain('Blatt „${sheetName}"');
    });

    it('blendet die Auswahl bei eingefügten Tabellen aus', () => {
        // Ohne Datei gibt es weder ein zweites Blatt noch eine verschiebbare Zeile.
        expect(wizard).toContain('box.hidden = !file;');
    });
});
