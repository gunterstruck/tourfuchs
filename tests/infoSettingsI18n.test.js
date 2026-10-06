import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translate, translateDocument } from '../src/core/i18n.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Info-Einstellungen in vier Sprachen', () => {
    it.each([
        ['fr', '🎨 Apparence', '☀️ Clair', '📍 Localiser précisément les adresses', 'Signaler sur GitHub'],
        ['es', '🎨 Apariencia', '☀️ Claro', '📍 Localizar direcciones con precisión', 'Informar en GitHub']
    ])('rendert den oberen Info-Bereich auf %s', (locale, theme, light, geocode, github) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);
        expect(dom.window.document.getElementById('theme-setting-title').textContent).toBe(theme);
        expect(dom.window.document.querySelector('[data-theme-choice="light"]').textContent).toBe(light);
        expect(dom.window.document.querySelector('[data-i18n="info.geocode.title"]').textContent).toBe(geocode);
        expect(dom.window.document.querySelector('[data-i18n="info.feedbackGithub"]').textContent).toBe(github);
    });

    it('übersetzt dynamische Verortungszustände ohne deutsche Satzreste', () => {
        expect(translate('fr', 'info.geocode.noStreet'))
            .toBe('Aucun client personnel avec une rue – positions au centre du code postal.');
        expect(translate('fr', 'info.geocode.pending', { exact: 8, withStreet: 12, pending: 4 }))
            .toBe('Adresses exactes : 8/12 – 4 restent à traiter.');
        expect(translate('es', 'info.geocode.offline', { exact: 8, withStreet: 12 }))
            .toBe('📶 Esperando conexión – direcciones exactas: 8/12. Continuará automáticamente.');
        expect(translate('es', 'info.geocode.all', { withStreet: 12 }))
            .toBe('✓ Todas las direcciones con calle (12) están localizadas con precisión.');
    });

    it('markiert alle sichtbaren Texte und rendert den dynamischen Status bei Sprachwechsel neu', () => {
        const html = read('index.html');
        const geocoding = read('src/ui/exactGeocoding.js');
        for (const key of [
            'info.showcase', 'info.guide', 'info.firstSteps',
            'theme.title', 'theme.hint', 'theme.auto', 'theme.light', 'theme.dark',
            'info.geocode.title', 'info.geocode.hint', 'info.geocode.now',
            'info.summary', 'info.privateTitle', 'info.privateBody',
            'info.feedbackTitle', 'info.feedbackQuestion', 'info.feedbackGithub', 'info.feedbackEmail'
        ]) expect(html, key).toContain(`data-i18n="${key}"`);
        expect(geocoding).toContain("on('locale:changed', renderInfoState)");
    });
});
