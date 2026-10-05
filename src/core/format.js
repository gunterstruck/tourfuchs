/**
 * Einheitliche Zahlen-Darstellung.
 * Verbindliche Regel für Umsätze (Roadmap R1.5): ab 10.000 € wird kompakt in
 * T€ gerundet angezeigt, darunter in vollen Euro. Der exakte Betrag gehört in
 * einen Tooltip (formatRevenueFull).
 */

const NUMBER_LOCALES = Object.freeze({ de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' });

function numberLocale(locale = 'de') {
    return NUMBER_LOCALES[String(locale).toLowerCase().split(/[-_]/)[0]] || NUMBER_LOCALES.de;
}

export function formatRevenueShort(value, locale = 'de') {
    const v = Math.round(value || 0);
    const language = String(locale).toLowerCase().split(/[-_]/)[0];
    const thousands = language === 'de' ? 'T€' : 'k€';
    if (Math.abs(v) >= 10000) return `${Math.round(v / 1000).toLocaleString(numberLocale(locale))} ${thousands}`;
    return `${v.toLocaleString(numberLocale(locale))} €`;
}

export function formatRevenueFull(value, locale = 'de') {
    return `${Math.round(value || 0).toLocaleString(numberLocale(locale))} €`;
}
