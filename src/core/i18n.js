import { DEFAULT_LOCALE, baseLocale } from './locale.js';
import { MESSAGES } from '../i18n/messages.js';

const TEXT_ATTRIBUTE = 'data-i18n';
const TRANSLATED_ATTRIBUTES = Object.freeze({
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-aria-label': 'aria-label',
    'data-i18n-title': 'title'
});

function catalogLocale(locale, catalogs) {
    const normalized = baseLocale(locale);
    return normalized && catalogs[normalized] ? normalized : DEFAULT_LOCALE;
}

function interpolate(text, values = {}) {
    return String(text).replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => (
        Object.hasOwn(values, key) ? String(values[key]) : match
    ));
}

/** Eine fehlende Übersetzung fällt immer auf den deutschen Ausgangstext zurück. */
export function translate(locale, key, values = {}, catalogs = MESSAGES) {
    const selected = catalogLocale(locale, catalogs);
    const message = catalogs[selected]?.[key] ?? catalogs[DEFAULT_LOCALE]?.[key];
    return message == null ? key : interpolate(message, values);
}

/** Übersetzt nur ausdrücklich markierte Textknoten und sichere Textattribute. */
export function translateDocument(root, locale, catalogs = MESSAGES) {
    if (!root?.querySelectorAll) return;
    const textNodes = root.querySelectorAll(`[${TEXT_ATTRIBUTE}]`);
    for (const element of textNodes) {
        element.textContent = translate(locale, element.getAttribute(TEXT_ATTRIBUTE), {}, catalogs);
    }
    for (const [marker, attribute] of Object.entries(TRANSLATED_ATTRIBUTES)) {
        for (const element of root.querySelectorAll(`[${marker}]`)) {
            element.setAttribute(attribute, translate(locale, element.getAttribute(marker), {}, catalogs));
        }
    }
}

export function createTranslator(initialLocale = DEFAULT_LOCALE, catalogs = MESSAGES) {
    let locale = catalogLocale(initialLocale, catalogs);
    return {
        get locale() { return locale; },
        setLocale(next) { locale = catalogLocale(next, catalogs); return locale; },
        t(key, values) { return translate(locale, key, values, catalogs); },
        apply(root) { translateDocument(root, locale, catalogs); }
    };
}

