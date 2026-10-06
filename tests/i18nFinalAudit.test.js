import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { initLanguage } from '../src/ui/language.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key)
    };
}

function documentFor(device, stored) {
    const dom = new JSDOM(html, { url: 'https://tourfuchs.test/' });
    const language = initLanguage({
        doc: dom.window.document,
        win: dom.window,
        nav: { languages: [device] },
        storage: memoryStorage(stored ? { tf_locale: stored } : {})
    });
    return { dom, language };
}

describe('Abschluss-Audit der automatischen Sprache', () => {
    it.each([
        ['en-GB', 'en', 'Export as Excel'],
        ['fr-CH', 'fr', 'Exporter vers Excel'],
        ['es-MX', 'es', 'Exportar a Excel']
    ])('wendet %s auf die echte Dokumentstruktur an', (device, locale, exportLabel) => {
        const { dom, language } = documentFor(device);
        expect(language.locale).toBe(locale);
        expect(dom.window.document.documentElement.lang).toBe(locale);
        expect(dom.window.document.getElementById('btn-export').textContent).toContain(exportLabel);
        expect(dom.window.document.querySelector('.info-omitted summary').textContent).not.toContain('Was wir weggelassen haben');
        expect(dom.window.document.querySelector('#visit-report-dialog h2').textContent).not.toContain('Besuche weitergeben');
    });

    it('fällt mit unbekannter Gerätesprache im echten Dokument vollständig auf Deutsch zurück', () => {
        const { dom, language } = documentFor('it-IT');
        expect(language.locale).toBe('de');
        expect(dom.window.document.documentElement.lang).toBe('de');
        expect(dom.window.document.getElementById('btn-export').textContent).toBe('💾 Als Excel exportieren');
        expect(dom.window.document.querySelector('.info-omitted summary').textContent.trim()).toBe('🪦 Was wir weggelassen haben');
    });

    it('lässt eine gespeicherte Wahl die Gerätesprache überstimmen', () => {
        const { dom, language } = documentFor('fr-FR', 'es');
        expect(language.locale).toBe('es');
        expect(dom.window.document.getElementById('btn-export').textContent).toBe('💾 Exportar a Excel');
    });
});
