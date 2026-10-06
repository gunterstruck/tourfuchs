import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translateDocument } from '../src/core/i18n.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Datenschutz und Rechtliches in vier Sprachen', () => {
    it.each([
        [
            'fr',
            '🔒 Confidentialité – questions fréquentes',
            'Où mes données clients sont-elles enregistrées ?',
            'Mentions légales',
            'Sources de données',
            'Politique de confidentialité'
        ],
        [
            'es',
            '🔒 Privacidad – preguntas frecuentes',
            '¿Dónde se guardan mis datos de clientes?',
            'Aviso legal',
            'Fuentes de datos',
            'Política de privacidad'
        ]
    ])('rendert Datenschutz und Rechtliches auf %s', (locale, title, firstQuestion, imprint, sources, privacyLink) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);

        expect(dom.window.document.getElementById('privacy-faq-title').textContent).toBe(title);
        expect(dom.window.document.querySelector('[data-i18n="info.privacy.storageQuestion"]').textContent).toBe(firstQuestion);
        expect(dom.window.document.querySelector('[data-i18n="info.legal.imprintTitle"]').textContent).toBe(imprint);
        expect(dom.window.document.querySelector('[data-i18n="info.legal.sourcesTitle"]').textContent).toBe(sources);
        expect(dom.window.document.querySelector('[data-i18n="info.legal.privacyLink"]').textContent).toBe(privacyLink);
    });

    it('markiert jeden Text des Datenschutz- und Rechtliches-Pakets', () => {
        const html = read('index.html');
        for (const key of [
            'info.privacy.title', 'info.privacy.intro',
            'info.privacy.storageQuestion', 'info.privacy.storageAnswer',
            'info.privacy.externalQuestion', 'info.privacy.externalAnswer1', 'info.privacy.externalAnswer2',
            'info.privacy.deviceQuestion', 'info.privacy.deviceAnswer',
            'info.privacy.clipboardQuestion', 'info.privacy.clipboardAnswer1',
            'info.privacy.clipboardAnswer2', 'info.privacy.clipboardLink',
            'info.privacy.encryptionQuestion', 'info.privacy.encryptionAnswer1', 'info.privacy.encryptionAnswer2',
            'info.privacy.deletionQuestion', 'info.privacy.deletionAnswer',
            'info.legal.imprintTitle', 'info.legal.responsible', 'info.legal.emailLabel',
            'info.legal.musicTitle', 'info.legal.musicText', 'info.legal.musicLink',
            'info.legal.sourcesTitle', 'info.legal.boundaries', 'info.legal.postal', 'info.legal.map',
            'info.legal.privacyLink', 'info.legal.licenseLink'
        ]) expect(html, key).toContain(`data-i18n="${key}"`);
    });

    it('behält externe Ziele und rechtliche Identifikatoren unverändert', () => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, 'es');

        expect(dom.window.document.querySelector('[data-i18n="info.privacy.clipboardLink"]').href)
            .toBe('https://support.microsoft.com/de-de/windows/apps/using-the-clipboard');
        expect(dom.window.document.querySelector('[data-i18n="info.legal.musicLink"]').getAttribute('href'))
            .toBe('/license.html#schulungsmusik');
        expect(dom.window.document.body.textContent).toContain('§ 5 TMG');
        expect(dom.window.document.body.textContent).toContain('CC BY 4.0');
        expect(dom.window.document.body.textContent).toContain('AES-256-GCM');
    });
});
