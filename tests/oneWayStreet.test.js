import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as excel from '../src/services/excel.js';

/**
 * „Excel nur hinein" (PO 24.10.2026): Kundendaten verlassen TourFuchs nur
 * verschlüsselt per „Sicherer Umzug". Kein Excel-Export der Kundenliste, keine
 * Übergabeliste, keine Umbuchungsliste der Gebietsplanung.
 *
 * Erlaubt bleiben nur kleine Dateien zur eigenen Arbeit: Besuchsbericht
 * (besuchte Kunden), Hinweise zum letzten Import (Zeilen der gerade
 * importierten Datei) und die leere Vorlage.
 */
const read = (file) => readFileSync(file, 'utf8');
const sources = () => execFileSync('git', ['ls-files', 'src', 'index.html'], { encoding: 'utf8' })
    .split('\n').filter((file) => /\.(js|html)$/.test(file));

describe('Excel geht nur hinein', () => {
    it('es gibt keine Exportfunktion für Kunden, Übergaben oder Umbuchungen', () => {
        for (const name of ['exportCustomers', 'customerExportRows', 'exportHandovers', 'exportReassignments']) {
            expect(excel, name).not.toHaveProperty(name);
        }
    });

    it('keine Knöpfe und kein Auswahldialog für einen Excel-Export', () => {
        const html = read('index.html');
        for (const id of ['btn-export', 'btn-export-handover', 'export-choice-dialog', 'sim-report-xlsx']) {
            expect(html, id).not.toContain(`id="${id}"`);
        }
        expect(html).toContain('Einen Excel-Export gibt es bewusst nicht.');
    });

    it('Excel-Dateien schreibt nur excel.js – und nur Besuchsbericht, Importhinweise und Vorlage', () => {
        const writers = sources().filter((file) => /XLSX\.(writeFile|write)\(/.test(read(file)));
        // Die Live-Demo baut im Speicher eine Beispieldatei für den Import-Rundgang.
        expect(writers).toEqual(['src/services/excel.js', 'src/ui/showcase.js']);
        expect(read('src/ui/showcase.js')).toContain('XLSX.utils.json_to_sheet(IMPORT_DEMO_ROWS)');
        const code = read('src/services/excel.js');
        // Je exportierte Funktion bis zur nächsten: Wer schreibt eine Excel-Datei?
        const writing = code.split(/\n(?=export (?:async )?function )/)
            .filter((part) => /XLSX\.(writeFile|write)\(/.test(part))
            .map((part) => part.match(/^export (?:async )?function (\w+)/)?.[1]);
        expect(writing.sort()).toEqual(['downloadTemplate', 'exportErrors', 'visitReportFile']);
    });
});
