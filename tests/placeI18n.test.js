import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translate, translateDocument } from '../src/core/i18n.js';
import { MESSAGES } from '../src/i18n/messages.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Karten-Pin und eigene Orte in vier Sprachen', () => {
    it('hat für jeden Orts-Schlüssel alle vier Übersetzungen', () => {
        const keys = Object.keys(MESSAGES.de).filter((key) => key.startsWith('place.'));
        expect(keys.length).toBeGreaterThan(40);
        for (const locale of ['en', 'fr', 'es']) {
            for (const key of keys) expect(MESSAGES[locale][key], `${locale}:${key}`).toBeTruthy();
        }
    });

    it.each([
        ['en', '📌 Name location', 'Remember this location for future tours'],
        ['fr', '📌 Nommer le lieu', 'Mémoriser ce lieu pour de futures tournées'],
        ['es', '📌 Nombrar ubicación', 'Guardar esta ubicación para rutas futuras']
    ])('übersetzt den Pin-Dialog auf %s', (locale, title, remember) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);
        expect(dom.window.document.getElementById('place-pin-title').textContent).toBe(title);
        expect(dom.window.document.getElementById('place-pin-remember-row').textContent).toContain(remember);
    });

    it('setzt Ortsnamen sicher in lokalisierte Meldungen ein', () => {
        expect(translate('en', 'place.savedStartSuccess', { label: 'A&B <Gate>' }))
            .toBe('“A&B <Gate>” saved and set as start.');
        const picker = read('src/ui/placePicker.js');
        const map = read('src/features/map.js');
        expect(picker).toContain("escapeHtml(t('place.pickerTitle'))");
        expect(map).toContain("escapeHtml(t('place.kindSaved'))");
    });

    it('lokalisiert Kartenaktionen, Suchdetails und den exakten Kartenweg', () => {
        expect(read('src/features/map.js')).toContain("t('place.deleteConfirm', { label: place.label })");
        expect(read('src/features/places.js')).toContain("t('place.postalCenter')");
        expect(read('src/ui/tourPanel.js')).toContain("t('place.setExactNamed', { label })");
    });
});
