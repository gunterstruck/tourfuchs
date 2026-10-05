import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translateDocument } from '../src/core/i18n.js';
import { MESSAGES } from '../src/i18n/messages.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function translated(locale) {
    const dom = new JSDOM(html);
    translateDocument(dom.window.document, locale);
    return dom.window.document;
}

describe('Mehrsprachiger Einstieg und Import', () => {
    it('hat für jeden im HTML verwendeten Schlüssel alle vier Übersetzungen', () => {
        const dom = new JSDOM(html);
        const markers = [
            'data-i18n',
            'data-i18n-placeholder',
            'data-i18n-aria-label',
            'data-i18n-title'
        ];
        const keys = new Set(markers.flatMap((marker) => (
            [...dom.window.document.querySelectorAll(`[${marker}]`)]
                .map((node) => node.getAttribute(marker))
        )));

        for (const locale of ['de', 'en', 'fr', 'es']) {
            for (const key of keys) expect(MESSAGES[locale][key], `${locale}:${key}`).toBeTruthy();
        }
    });

    it.each([
        ['en', 'Welcome to TourFuchs!', 'Load your own data', 'Match columns'],
        ['fr', 'Bienvenue dans TourFuchs !', 'Charger vos données', 'Associer les colonnes'],
        ['es', '¡Bienvenido a TourFuchs!', 'Cargar tus datos', 'Asociar columnas']
    ])('übersetzt Einstieg, Dateiwahl und Zuordnung auf %s', (locale, welcome, ownData, mapping) => {
        const doc = translated(locale);
        expect(doc.querySelector('#onboarding h2').textContent).toBe(welcome);
        expect(doc.getElementById('btn-own-data').textContent).toContain(ownData);
        expect(doc.querySelector('#own-data-dialog h2').textContent).toContain(ownData);
        expect(doc.querySelector('#import-dialog h2').textContent).toBe(mapping);
        expect(doc.getElementById('paste-dialog').getAttribute('aria-label')).not.toBe('Kundenliste einfügen');
    });

    it('setzt Katalogtexte weiterhin nur als Text ein', () => {
        const doc = translated('en');
        const lead = doc.getElementById('demo-welcome-lead');
        expect(lead.textContent).toContain('your own data');
        expect(lead.children).toHaveLength(0);
    });
});
