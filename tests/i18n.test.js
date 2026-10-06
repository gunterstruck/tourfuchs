import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { createTranslator, translate, translateDocument } from '../src/core/i18n.js';
import { MESSAGES } from '../src/i18n/messages.js';

const catalogs = {
    de: { greeting: 'Hallo {name}', placeholder: 'Kunde suchen', close: 'Schließen' },
    en: { greeting: 'Hello {name}', placeholder: 'Search customers' }
};

const placeholders = (message) => [...String(message).matchAll(/\{([A-Za-z0-9_]+)\}/g)]
    .map((match) => match[1])
    .sort();

const INTENTIONAL_GERMAN_EQUALS = Object.freeze({
    fr: new Set(['customer.action.briefing', 'tour.stops.briefing', 'info.omitted.version26']),
    es: new Set(['customer.demoBadge', 'customer.action.briefing', 'tour.stops.briefing'])
});

describe('Übersetzungskatalog', () => {
    it.each(['en', 'fr', 'es'])('hält den Produktionskatalog für %s vollständig', (locale) => {
        expect(Object.keys(MESSAGES[locale]).sort()).toEqual(Object.keys(MESSAGES.de).sort());
    });

    it.each(['en', 'fr', 'es'])('bewahrt alle benannten Platzhalter in %s', (locale) => {
        for (const key of Object.keys(MESSAGES.de)) {
            expect(placeholders(MESSAGES[locale][key]), `${locale}:${key}`)
                .toEqual(placeholders(MESSAGES.de[key]));
        }
    });

    it.each(['fr', 'es'])('enthält in %s keine unbestätigten deutschen 1:1-Texte', (locale) => {
        const unchanged = Object.keys(MESSAGES.de)
            .filter((key) => MESSAGES[locale][key] === MESSAGES.de[key]);
        expect(unchanged).toEqual([...INTENTIONAL_GERMAN_EQUALS[locale]]);
    });

    it('übersetzt und setzt benannte Werte ein', () => {
        expect(translate('en-US', 'greeting', { name: 'Sam' }, catalogs)).toBe('Hello Sam');
    });

    it('fällt pro Schlüssel auf Deutsch zurück', () => {
        expect(translate('en', 'close', {}, catalogs)).toBe('Schließen');
    });

    it('liefert bei einem unbekannten Schlüssel den Schlüssel statt leeren Text', () => {
        expect(translate('fr', 'missing.key', {}, catalogs)).toBe('missing.key');
    });

    it('übersetzt ausdrücklich markierte Texte und Attribute', () => {
        const dom = new JSDOM(`<main>
            <h1 data-i18n="greeting">Alt</h1>
            <input data-i18n-placeholder="placeholder" placeholder="Alt">
            <button data-i18n-aria-label="close" data-i18n-title="close">×</button>
            <p id="untouched">Bleibt unverändert</p>
        </main>`);
        translateDocument(dom.window.document, 'en', catalogs);
        expect(dom.window.document.querySelector('h1').textContent).toBe('Hello {name}');
        expect(dom.window.document.querySelector('input').placeholder).toBe('Search customers');
        expect(dom.window.document.querySelector('button').getAttribute('aria-label')).toBe('Schließen');
        expect(dom.window.document.querySelector('button').title).toBe('Schließen');
        expect(dom.window.document.getElementById('untouched').textContent).toBe('Bleibt unverändert');
    });

    it('verwaltet eine Sprache und kann denselben DOM-Bereich neu anwenden', () => {
        const dom = new JSDOM('<p data-i18n="close">Alt</p>');
        const translator = createTranslator('de', catalogs);
        translator.apply(dom.window.document);
        expect(dom.window.document.querySelector('p').textContent).toBe('Schließen');
        expect(translator.setLocale('en-GB')).toBe('en');
        translator.apply(dom.window.document);
        expect(translator.t('greeting', { name: 'Alex' })).toBe('Hello Alex');
    });

    it('schreibt niemals ungeprüft HTML aus einem Katalog', () => {
        const unsafe = { de: { value: '<img src=x onerror=alert(1)>' } };
        const dom = new JSDOM('<p data-i18n="value"></p>');
        translateDocument(dom.window.document, 'de', unsafe);
        const paragraph = dom.window.document.querySelector('p');
        expect(paragraph.textContent).toBe('<img src=x onerror=alert(1)>');
        expect(paragraph.querySelector('img')).toBeNull();
    });
});
