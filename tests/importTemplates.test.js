import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    IMPORT_TEMPLATES_KEY, MAX_IMPORT_TEMPLATES, findImportTemplate, headerSignature, loadImportTemplates,
    mappingFromTemplate, rememberImportTemplate, removeImportTemplate, saveImportTemplates, templateNameFromFile,
    touchImportTemplate
} from '../src/features/importTemplates.js';
import { IMPORT_MESSAGES } from '../src/i18n/importMessages.js';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const H = ['Kundennr', 'Firma', 'PLZ', 'Ort', 'Vertriebsbezirk', 'Umsatz'];
const MAPPING = { nummer: 'Kundennr', name: 'Firma', plz: 'PLZ', ort: 'Ort', bezirk: 'Vertriebsbezirk', umsatz: 'Umsatz', gruppe: null, strasse: null };

describe('Importvorlagen – Wiedererkennen', () => {
    beforeEach(() => localStorage.clear());

    it('erkennt dieselbe Liste unabhängig von Reihenfolge, Groß/Klein und Leerzeichen', () => {
        expect(headerSignature(['PLZ', ' firma ', 'Ort'])).toBe(headerSignature(['ort', 'Firma', 'plz']));
        const list = rememberImportTemplate([], { headers: H, mapping: MAPPING, name: 'Kundenstamm' });
        const match = findImportTemplate(list, ['umsatz', 'ORT', 'PLZ', 'Firma', 'Vertriebsbezirk', 'Kundennr']);
        expect(match).toMatchObject({ exact: true, added: [], missing: [] });
    });

    it('meldet bei veränderter Liste, was neu ist und was fehlt – fremde Listen bleiben fremd', () => {
        const list = rememberImportTemplate([], { headers: H, mapping: MAPPING, name: 'Kundenstamm' });
        const changed = findImportTemplate(list, [...H.filter((h) => h !== 'Umsatz'), 'Vertriebsgruppe']);
        expect(changed).toMatchObject({ exact: false, added: ['Vertriebsgruppe'], missing: ['Umsatz'] });
        expect(findImportTemplate(list, ['Promotor', 'Thema', 'Telefon', 'E-Mail', 'Kundennr'])).toBeNull();
    });

    it('überträgt die Zuordnung, lässt bewusst Abgewähltes leer und nimmt neue Spalten aus der Erkennung', () => {
        const detected = { nummer: 'Kundennr', name: 'Firma', plz: 'PLZ', ort: 'Ort', bezirk: 'Vertriebsbezirk', umsatz: 'Umsatz', strasse: 'Ort' };
        // Der Nutzer hat „Straße" abgewählt (die Erkennung hatte fälschlich „Ort" genommen).
        const list = rememberImportTemplate([], { headers: H, mapping: { ...MAPPING, strasse: null }, detected, name: 'K' });
        expect(list[0].mapping.strasse).toBeNull();
        expect('gruppe' in list[0].mapping).toBe(false);   // keine Spalte vorhanden → nicht „bewusst leer"
        const later = [...H, 'Vertriebsgruppe'];
        const mapping = mappingFromTemplate(list[0], later, { ...detected, gruppe: 'Vertriebsgruppe' });
        expect(mapping).toMatchObject({ name: 'Firma', strasse: null, gruppe: 'Vertriebsgruppe' });
    });

    it('vergibt eine Spalte nur einmal', () => {
        const list = rememberImportTemplate([], { headers: H, mapping: MAPPING, name: 'K' });
        const mapping = mappingFromTemplate(list[0], H, { name: 'Firma', ansprechpartner: 'Firma' });
        expect(mapping.name).toBe('Firma');
        expect(mapping.ansprechpartner).toBeNull();
    });
});

describe('Importvorlagen – Speicher', () => {
    beforeEach(() => localStorage.clear());

    it('speichert nur Überschriften und Zuordnung, robust gegen Kaputtes', () => {
        saveImportTemplates(rememberImportTemplate([], { headers: H, mapping: MAPPING, name: 'Kundenstamm', sheetName: 'Kunden', headerRow: 2 }));
        const stored = JSON.parse(localStorage.getItem(IMPORT_TEMPLATES_KEY));
        expect(Object.keys(stored[0]).sort()).toEqual(['headerRow', 'headers', 'id', 'mapping', 'name', 'sheetName', 'signature', 'usedAt', 'uses']);
        expect(loadImportTemplates()[0]).toMatchObject({ name: 'Kundenstamm', sheetName: 'Kunden', headerRow: 2 });
        localStorage.setItem(IMPORT_TEMPLATES_KEY, '{kaputt');
        expect(loadImportTemplates()).toEqual([]);
    });

    it('ersetzt dieselbe Liste, schreibt die geprüfte Vorlage fort und begrenzt die Anzahl', () => {
        let list = rememberImportTemplate([], { headers: H, mapping: MAPPING, name: 'Kundenstamm', now: '2026-10-01' });
        const id = list[0].id;
        list = rememberImportTemplate(list, { headers: [...H, 'Vertriebsgruppe'], mapping: MAPPING, replaceId: id, now: '2026-10-02' });
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ id, name: 'Kundenstamm', uses: 2 });
        list = touchImportTemplate(list, id, '2026-10-03');
        expect(list[0]).toMatchObject({ usedAt: '2026-10-03', uses: 3 });
        for (let i = 0; i < MAX_IMPORT_TEMPLATES + 2; i++) {
            list = rememberImportTemplate(list, { headers: [`Spalte ${i}`, 'PLZ'], mapping: { plz: 'PLZ' }, name: `L${i}`, now: `2026-11-${String(i + 1).padStart(2, '0')}` });
        }
        expect(list).toHaveLength(MAX_IMPORT_TEMPLATES);
        expect(removeImportTemplate(list, list[0].id)).toHaveLength(MAX_IMPORT_TEMPLATES - 1);
    });

    it('nennt Vorlagen nach der Datei – ohne Datum und Kopie-Zähler', () => {
        expect(templateNameFromFile('Kundenstamm_2026-10.xlsx')).toBe('Kundenstamm');
        expect(templateNameFromFile('Promotoren 10.10.2026.xlsx')).toBe('Promotoren');
        expect(templateNameFromFile('Zuständigkeiten (2).csv')).toBe('Zuständigkeiten');
    });
});

describe('Importvorlagen – im Import', () => {
    const wizard = read('src/ui/importWizard.js');

    it('importiert die wiedererkannte Liste ohne Zuordnungsdialog, sonst vorbelegt mit Hinweis', () => {
        expect(wizard).toContain('await continueWithTemplate();');
        expect(wizard).toContain('await runImport(mapping, { template: match.template });');
        expect(wizard).toContain("templateContext = match ? { template: match.template, auto: false, added: match.added, missing: match.missing } : null;");
        expect(wizard).toContain('mappingFromTemplate(templateContext.template, headers, autoMapping)');
    });

    it('fragt den Änderungsbericht nur, wenn Kunden fehlen, und zeigt sonst das Ergebnisfenster', () => {
        expect(wizard).toContain('&& Boolean(abgleich) && abgleich.missing.length === 0;');
        expect(wizard).toContain("template ? 'import.template.resultTitle'");
        expect(wizard).toContain('id="import-template-review"');
    });

    it('zeigt in der Live-Demo immer die Zuordnung – eine Vorlage importiert dort nie still', () => {
        expect(wizard).toContain('return handleFile(file, { useTemplates: false });');
    });

    it('merkt sich die Zuordnung erst nach bestätigtem und gespeichertem Import', () => {
        expect(wizard).toContain('await runImport(mapping, { remember: true });');
        expect(wizard).toContain('if (persisted && remember && parsed.headers?.length) {');
    });

    it('steht unter Daten, ist übersetzt und dokumentiert', () => {
        expect(read('index.html')).toContain('id="import-templates"');
        expect(read('src/main.js')).toContain('initImportTemplates();');
        const keys = Object.keys(IMPORT_MESSAGES.de).filter((key) => key.startsWith('templates.') || key.startsWith('import.template.'));
        expect(keys.length).toBeGreaterThan(12);
        for (const locale of ['en', 'fr', 'es']) for (const key of keys) expect(IMPORT_MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
        const normalize = (value) => value.replace(/[„“”"']/g, '"');
        const guide = normalize(read('docs/guide-ki-wissensbasis.md'));
        for (const key of ['templates.title', 'templates.forget', 'import.template.review', 'import.template.resultTitle']) {
            expect(guide).toContain(normalize(IMPORT_MESSAGES.de[key]));
        }
    });
});
