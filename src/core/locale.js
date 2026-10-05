/**
 * Sprachwahl für TourFuchs.
 *
 * Noch übersetzte Oberflächen dürfen diesen Baustein schrittweise verwenden:
 * Die Geräteauswahl ist deterministisch, eine bewusste Wahl gewinnt und alles
 * Unbekannte fällt auf Deutsch zurück. Es findet keinerlei Netzaufruf statt.
 */
export const DEFAULT_LOCALE = 'de';
export const SUPPORTED_LOCALES = Object.freeze(['de', 'en', 'fr', 'es']);
export const LOCALE_CHOICES = Object.freeze(['auto', ...SUPPORTED_LOCALES]);
export const LOCALE_KEY = 'tf_locale';

/** Aus `fr-CH`, `ES_es` oder `en` wird die von TourFuchs verstandene Sprache. */
export function baseLocale(value) {
    const tag = String(value ?? '').trim().replaceAll('_', '-').toLowerCase();
    const base = tag.split('-')[0];
    return SUPPORTED_LOCALES.includes(base) ? base : null;
}

export function normalizeLocaleChoice(value) {
    const choice = String(value ?? '').trim().toLowerCase();
    return LOCALE_CHOICES.includes(choice) ? choice : 'auto';
}

/**
 * Eine manuelle Wahl gewinnt. Bei „auto" wird die Reihenfolge der vom Gerät
 * angebotenen Sprachen respektiert; erst danach greift Deutsch als Rückfall.
 */
export function resolveLocale(choice = 'auto', deviceLanguages = []) {
    const normalized = normalizeLocaleChoice(choice);
    if (normalized !== 'auto') return normalized;
    const languages = Array.isArray(deviceLanguages) ? deviceLanguages : [deviceLanguages];
    for (const language of languages) {
        const locale = baseLocale(language);
        if (locale) return locale;
    }
    return DEFAULT_LOCALE;
}

export function readLocaleChoice(storage = globalThis.localStorage) {
    try { return normalizeLocaleChoice(storage?.getItem(LOCALE_KEY)); } catch { return 'auto'; }
}

export function saveLocaleChoice(choice, storage = globalThis.localStorage) {
    const normalized = normalizeLocaleChoice(choice);
    try {
        if (normalized === 'auto') storage?.removeItem(LOCALE_KEY);
        else storage?.setItem(LOCALE_KEY, normalized);
    } catch { /* Die Wahl gilt dann nur für diese Sitzung. */ }
    return normalized;
}

export function deviceLanguages(nav = globalThis.navigator) {
    if (Array.isArray(nav?.languages) && nav.languages.length) return [...nav.languages];
    return nav?.language ? [nav.language] : [];
}

