import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translate, translateDocument } from '../src/core/i18n.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Exportdialoge in vier Sprachen', () => {
    it.each([
        ['fr', '📤 Partager les visites', '🧳 Exporter chiffré'],
        ['es', '📤 Compartir visitas', '🧳 Exportar cifrado']
    ])('übersetzt Besuchsbericht und sicheren Export auf %s', (locale, report, safe) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);
        expect(dom.window.document.querySelector('#visit-report-dialog h2').textContent).toBe(report);
        expect(dom.window.document.querySelector('#safe-export-dialog h2').textContent).toBe(safe);
    });

    it('übersetzt dynamische Mengen und behält Platzhalter bei', () => {
        expect(translate('es', 'report.shareCount.many', { count: 4 })).toBe('📤 Compartir 4 visitas');
        expect(translate('en', 'safeExport.info', { count: '4 customers' })).toContain('4 customers');
    });
});
