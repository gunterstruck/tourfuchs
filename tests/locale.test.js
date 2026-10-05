import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LOCALE,
    LOCALE_KEY,
    baseLocale,
    deviceLanguages,
    normalizeLocaleChoice,
    readLocaleChoice,
    resolveLocale,
    saveLocaleChoice
} from '../src/core/locale.js';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key)
    };
}

describe('Sprachauswahl', () => {
    it.each([
        ['en-US', 'en'], ['fr-CH', 'fr'], ['es_ES', 'es'], ['de-AT', 'de']
    ])('ordnet %s der unterstützten Basissprache %s zu', (input, expected) => {
        expect(baseLocale(input)).toBe(expected);
    });

    it('fällt für nicht unterstützte Gerätesprachen auf Deutsch zurück', () => {
        expect(resolveLocale('auto', ['it-IT', 'nl-NL'])).toBe(DEFAULT_LOCALE);
    });

    it('respektiert die Reihenfolge der Gerätesprachen', () => {
        expect(resolveLocale('auto', ['it-IT', 'fr-FR', 'en-GB'])).toBe('fr');
    });

    it('lässt eine manuelle Wahl immer gewinnen', () => {
        expect(resolveLocale('es', ['fr-FR'])).toBe('es');
    });

    it('normalisiert ungültige gespeicherte Werte zu automatisch', () => {
        expect(normalizeLocaleChoice('IT')).toBe('auto');
        expect(readLocaleChoice(memoryStorage({ [LOCALE_KEY]: 'xx' }))).toBe('auto');
    });

    it('speichert eine feste Wahl und entfernt sie für automatisch', () => {
        const storage = memoryStorage();
        expect(saveLocaleChoice('FR', storage)).toBe('fr');
        expect(readLocaleChoice(storage)).toBe('fr');
        expect(saveLocaleChoice('auto', storage)).toBe('auto');
        expect(readLocaleChoice(storage)).toBe('auto');
    });

    it('liest navigator.languages und fällt auf navigator.language zurück', () => {
        expect(deviceLanguages({ languages: ['es-MX', 'en-US'], language: 'de-DE' })).toEqual(['es-MX', 'en-US']);
        expect(deviceLanguages({ language: 'fr-FR' })).toEqual(['fr-FR']);
        expect(deviceLanguages({})).toEqual([]);
    });

    it('bleibt auch ohne verfügbaren Browserspeicher funktionsfähig', () => {
        const broken = { getItem() { throw new Error('gesperrt'); }, setItem() { throw new Error('gesperrt'); } };
        expect(readLocaleChoice(broken)).toBe('auto');
        expect(saveLocaleChoice('en', broken)).toBe('en');
    });
});
