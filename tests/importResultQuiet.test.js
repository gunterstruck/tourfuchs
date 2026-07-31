/**
 * Das Ergebnis-Modal hält nur noch dort an, wo etwas anhält.
 *
 * Vorher öffnete es sich, sobald die Prüfung irgendetwas zu sagen hatte – auch
 * bei reinen Hinweisen. Der häufigste davon ist „N Kunden ohne Vertriebsbezirk",
 * und der trifft ausgerechnet die einfachste, ausdrücklich unterstützte Liste
 * (Name + PLZ). Der schnellste Einstieg bekam also verlässlich einen Dialog vor
 * den Befund gesetzt, für etwas, das kein Problem ist.
 *
 * Jetzt: Modal nur bei nicht importierten Zeilen. Hinweise kommen als Toast,
 * die Liste bleibt im Daten-Tab herunterladbar.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRows } from '../src/services/excel.js';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Import-Ergebnis: Modal nur bei nicht importierten Zeilen', () => {
    it('erzeugt für die einfachste Liste (Name + PLZ) genau einen Hinweis und keinen Fehler', () => {
        // Das ist der Fall, der vorher verlässlich ein Modal aufzog.
        const { customers, errors } = parseRows(
            [{ Kunde: 'A GmbH', PLZ: '45127' }, { Kunde: 'B GmbH', PLZ: '50667' }],
            { name: 'Kunde', plz: 'PLZ' }
        );
        expect(customers).toHaveLength(2);
        expect(errors.filter((e) => e.Typ === 'Fehler')).toHaveLength(0);
        expect(errors.filter((e) => e.Typ === 'Hinweis').length).toBeGreaterThan(0);
    });

    it('macht die Fehlerzahl zur Bedingung – nicht die Länge der Prüfliste', () => {
        const wizard = source('src/ui/importWizard.js');
        expect(wizard).toContain('if (fehler === 0) {');
        expect(wizard).not.toContain('if (errors.length === 0) {');
    });

    it('nennt die Hinweise im Toast, statt sie zu verschlucken', () => {
        const wizard = source('src/ui/importWizard.js');
        expect(wizard).toContain('const notes = hinweise');
        expect(wizard).toContain('Liste unter „Daten“');
    });

    it('behauptet keinen Import, wenn keine Zeile übernommen wurde', () => {
        const wizard = source('src/ui/importWizard.js');
        expect(wizard).toContain('if (parts.length === 0) {');
        expect(wizard).toContain("showToast('Keine gültigen Zeilen im Import gefunden.', 'error', 6000)");
    });

    it('hält die Liste dauerhaft erreichbar, statt sie an das Modal zu binden', () => {
        const html = source('index.html');
        const wizard = source('src/ui/importWizard.js');
        const sidebar = source('src/ui/sidebar.js');

        expect(html).toContain('id="btn-import-notes"');
        expect(wizard).toContain('function syncImportNotesButton()');
        expect(wizard).toContain("document.getElementById('btn-import-notes')?.addEventListener('click', downloadErrorList)");
        // „Daten löschen" nimmt auch die Liste des letzten Imports mit.
        expect(wizard).toContain("on('dataset:cleared', () => { lastErrors = []; syncImportNotesButton(); })");
        // Auch in der mobilen Gruppierung darf der Knopf nicht verloren gehen.
        expect(sidebar).toContain("const importNotes = el('btn-import-notes');");
        expect(sidebar).toContain('if (importNotes) g.tools.col.append(importNotes);');
    });

    it('sagt im Modal, was der Nutzer wissen muss: was fehlt und was zu tun ist', () => {
        const html = source('index.html');
        const wizard = source('src/ui/importWizard.js');
        expect(html).toContain('<h2>Nicht alle Zeilen konnten importiert werden</h2>');
        expect(wizard).toContain('wurde${fehler === 1 ? \'\' : \'n\'} nicht übernommen');
    });
});
