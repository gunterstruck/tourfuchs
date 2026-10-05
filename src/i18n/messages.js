/**
 * Zentrale Textkataloge. Neue Sprachen werden erst als „vollständig" markiert,
 * wenn der definierte Kernumfang übersetzt und geprüft ist. Bis dahin kann die
 * Infrastruktur wachsen, ohne eine gemischte Oberfläche automatisch zu zeigen.
 */
export const MESSAGES = Object.freeze({
    de: Object.freeze({
        'language.title': '🌐 Sprache',
        'language.hint': 'Automatisch folgt der bevorzugten Gerätesprache.',
        'language.auto': 'Automatisch',
        'language.de': 'Deutsch',
        'language.en': 'Englisch',
        'language.fr': 'Französisch',
        'language.es': 'Spanisch'
    }),
    en: Object.freeze({
        'language.title': '🌐 Language',
        'language.hint': 'Automatic follows your device language preference.',
        'language.auto': 'Automatic',
        'language.de': 'German',
        'language.en': 'English',
        'language.fr': 'French',
        'language.es': 'Spanish'
    }),
    fr: Object.freeze({
        'language.title': '🌐 Langue',
        'language.hint': 'Le mode automatique suit la langue préférée de votre appareil.',
        'language.auto': 'Automatique',
        'language.de': 'Allemand',
        'language.en': 'Anglais',
        'language.fr': 'Français',
        'language.es': 'Espagnol'
    }),
    es: Object.freeze({
        'language.title': '🌐 Idioma',
        'language.hint': 'El modo automático sigue el idioma preferido del dispositivo.',
        'language.auto': 'Automático',
        'language.de': 'Alemán',
        'language.en': 'Inglés',
        'language.fr': 'Francés',
        'language.es': 'Español'
    })
});

