import {
    deviceLanguages,
    readLocaleChoice,
    resolveLocale,
    saveLocaleChoice
} from '../core/locale.js';
import { applyLocale } from '../core/i18n.js';

/**
 * Gerätesprache und bewusste Wahl verbinden. Alles bleibt in localStorage;
 * weder Sprache noch Auswahl werden übertragen.
 */
export function initLanguage({
    doc = document,
    win = window,
    nav = navigator,
    storage = globalThis.localStorage
} = {}) {
    let choice = readLocaleChoice(storage);
    let locale = resolveLocale(choice, deviceLanguages(nav));
    const select = doc.getElementById('language-select');
    const listeners = new Set();

    const render = () => {
        locale = resolveLocale(choice, deviceLanguages(nav));
        doc.documentElement.lang = locale;
        applyLocale(locale, doc);
        if (select) select.value = choice;
        listeners.forEach((listener) => listener(locale, choice));
    };

    select?.addEventListener('change', () => {
        choice = saveLocaleChoice(select.value, storage);
        render();
    });
    win?.addEventListener?.('languagechange', () => { if (choice === 'auto') render(); });
    render();

    return {
        get choice() { return choice; },
        get locale() { return locale; },
        setChoice(next) { choice = saveLocaleChoice(next, storage); render(); },
        onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    };
}

