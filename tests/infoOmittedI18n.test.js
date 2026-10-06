import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translateDocument } from '../src/core/i18n.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const ITEMS = [
    'addressSearch', 'longPress', 'autoTour', 'workLogin', 'ai', 'pin', 'timer',
    'navigation', 'adaptive', 'modeRename', 'light', 'mobileTabs', 'nearby',
    'hiddenToggle', 'tablet'
];

describe('„Was wir weggelassen haben“ in vier Sprachen', () => {
    it.each([
        ['fr', '🪦 Ce que nous avons écarté', 'Rechercher des adresses sur Internet', 'Cette liste continuera de s’allonger.'],
        ['es', '🪦 Lo que hemos descartado', 'Buscar direcciones en Internet', 'Esta lista seguirá creciendo.']
    ])('rendert alle 15 Entscheidungen auf %s', (locale, title, firstItem, outroStart) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);
        const section = dom.window.document.querySelector('.info-omitted');

        expect(section.querySelector('summary').textContent.trim()).toBe(title);
        expect(section.querySelectorAll('dt')).toHaveLength(15);
        expect(section.querySelectorAll('dd')).toHaveLength(15);
        expect(section.querySelector('[data-i18n="info.omitted.addressSearchTitle"]').textContent).toBe(firstItem);
        expect(section.querySelector('[data-i18n="info.omitted.outro"]').textContent).toContain(outroStart);
        expect(section.textContent).not.toContain('Was wir weggelassen haben');
        expect(section.textContent).not.toContain('Nicht gebaut');
    });

    it('markiert Titel und Begründung jeder Entscheidung', () => {
        const html = read('index.html');
        for (const item of ITEMS) {
            expect(html, `${item}Title`).toContain(`data-i18n="info.omitted.${item}Title"`);
            expect(html, `${item}Body`).toContain(`data-i18n="info.omitted.${item}Body"`);
        }
        for (const key of ['title', 'intro', 'principle', 'version26', 'outro']) {
            expect(html, key).toContain(`data-i18n="info.omitted.${key}"`);
        }
    });
});
