import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { initLanguage } from '../src/ui/language.js';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key)
    };
}

function fixture() {
    return new JSDOM(`<!doctype html><html lang="de"><body>
        <input data-i18n-placeholder="shell.search" placeholder="Alt">
        <span data-i18n="tab.data">Alt</span>
        <b id="language-setting-title" data-i18n="language.title">Alt</b>
        <select id="language-select">
            <option value="auto" data-i18n="language.auto">Alt</option>
            <option value="de" data-i18n="language.de">Alt</option>
            <option value="en" data-i18n="language.en">Alt</option>
            <option value="fr" data-i18n="language.fr">Alt</option>
            <option value="es" data-i18n="language.es">Alt</option>
        </select>
    </body></html>`, { url: 'https://tourfuchs.test/' });
}

describe('Sprachwahl in der Oberfläche', () => {
    it.each([
        ['en-US', 'en', '📄 Data'],
        ['fr-FR', 'fr', '📄 Données'],
        ['es-ES', 'es', '📄 Datos'],
        ['it-IT', 'de', '📄 Daten']
    ])('stellt bei Gerätesprache %s den App-Rahmen auf %s', (device, locale, label) => {
        const dom = fixture();
        const language = initLanguage({
            doc: dom.window.document,
            win: dom.window,
            nav: { languages: [device] },
            storage: memoryStorage()
        });
        expect(language.locale).toBe(locale);
        expect(dom.window.document.documentElement.lang).toBe(locale);
        expect(dom.window.document.querySelector('[data-i18n="tab.data"]').textContent).toBe(label);
    });

    it('speichert eine bewusste Auswahl und wendet sie sofort an', () => {
        const dom = fixture();
        const storage = memoryStorage();
        const language = initLanguage({
            doc: dom.window.document,
            win: dom.window,
            nav: { languages: ['en-US'] },
            storage
        });
        const select = dom.window.document.getElementById('language-select');
        select.value = 'es';
        select.dispatchEvent(new dom.window.Event('change'));
        expect(language.choice).toBe('es');
        expect(language.locale).toBe('es');
        expect(storage.getItem('tf_locale')).toBe('es');
        expect(select.value).toBe('es');
        expect(dom.window.document.getElementById('language-setting-title').textContent).toBe('🌐 Idioma');
    });

    it('reagiert im Automatikmodus auf einen Sprachwechsel des Geräts', () => {
        const dom = fixture();
        const nav = { languages: ['en-US'] };
        const language = initLanguage({ doc: dom.window.document, win: dom.window, nav, storage: memoryStorage() });
        nav.languages = ['fr-FR'];
        dom.window.dispatchEvent(new dom.window.Event('languagechange'));
        expect(language.locale).toBe('fr');
        expect(dom.window.document.documentElement.lang).toBe('fr');
    });
});
