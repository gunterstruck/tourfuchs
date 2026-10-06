import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translate, translateDocument } from '../src/core/i18n.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Exportdialoge in vier Sprachen', () => {
    it.each([
        ['fr', '⬇ Exporter vers Excel', '📤 Partager les visites', '🧳 Exporter chiffré'],
        ['es', '⬇ Exportar a Excel', '📤 Compartir visitas', '🧳 Exportar cifrado']
    ])('übersetzt Excel, Besuchsbericht und sicheren Export auf %s', (locale, excel, report, safe) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);
        expect(dom.window.document.getElementById('export-choice-title').textContent).toBe(excel);
        expect(dom.window.document.querySelector('#visit-report-dialog h2').textContent).toBe(report);
        expect(dom.window.document.querySelector('#safe-export-dialog h2').textContent).toBe(safe);
    });

    it('übersetzt dynamische Mengen und behält Platzhalter bei', () => {
        expect(translate('fr', 'export.choice.lead', { visible: 3, all: 8 })).toContain('3 clients sur 8');
        expect(translate('es', 'report.shareCount.many', { count: 4 })).toBe('📤 Compartir 4 visitas');
        expect(translate('en', 'safeExport.info', { count: '4 customers' })).toContain('4 customers');
    });
});
