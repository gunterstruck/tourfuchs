import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translate } from '../src/core/i18n.js';
import { MESSAGES } from '../src/i18n/messages.js';
import { FIELDS } from '../src/services/excel.js';

const wizard = readFileSync(resolve(process.cwd(), 'src/ui/importWizard.js'), 'utf8');

describe('Dynamischer Import in vier Sprachen', () => {
    it('hat für jedes zuordenbare Importfeld eine Bezeichnung', () => {
        for (const locale of ['de', 'en', 'fr', 'es']) {
            for (const field of FIELDS) {
                expect(MESSAGES[locale][`mapping.field.${field.key}`], `${locale}:${field.key}`).toBeTruthy();
            }
        }
    });

    it.each([
        ['en', 'Detected: 2 rows, 4 columns – first column “Customer”.'],
        ['fr', 'Détecté : 2 lignes, 4 colonnes – première colonne « Customer ».'],
        ['es', 'Detectado: 2 filas, 4 columnas; primera columna «Customer».']
    ])('formatiert die erkannte Tabelle auf %s', (locale, expected) => {
        expect(translate(locale, 'import.pasteDetected', {
            rows: 2,
            columns: 4,
            first: 'Customer'
        })).toBe(expected);
    });

    it('nutzt Katalogtexte auch für Fehler, Ergebnis und Dateiinformation', () => {
        for (const key of [
            'import.readFailed',
            'import.fileInfo',
            'import.validationName',
            'import.success',
            'import.incompleteTitle'
        ]) {
            expect(wizard).toContain(`t('${key}'`);
        }
    });

    it('maskiert übersetzte Feldtexte, bevor sie in Tabellen-HTML gelangen', () => {
        expect(wizard).toContain('escapeHtml(t(`mapping.field.${field.key}`))');
        expect(wizard).toContain("escapeHtml(t('import.required'))");
        expect(wizard).toContain("escapeHtml(t('import.incompleteBody'))");
    });
});
