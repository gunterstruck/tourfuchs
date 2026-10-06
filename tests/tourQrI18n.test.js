import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translate, translateDocument } from '../src/core/i18n.js';
import { MESSAGES } from '../src/i18n/messages.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('QR-Tourübergabe in vier Sprachen', () => {
    it('hat für jeden QR-Schlüssel alle vier Übersetzungen', () => {
        const keys = Object.keys(MESSAGES.de).filter((key) => key.startsWith('qr.'));
        expect(keys.length).toBeGreaterThan(35);
        for (const locale of ['en', 'fr', 'es']) {
            for (const key of keys) expect(MESSAGES[locale][key], `${locale}:${key}`).toBeTruthy();
        }
    });

    it.each([
        ['en', '📷 Scan tour by QR', '➕ Import as tour', 'Choose a photo of the QR code'],
        ['fr', '📷 Scanner une tournée par QR', '➕ Importer comme tournée', 'Choisir une photo du code QR'],
        ['es', '📷 Escanear ruta por QR', '➕ Importar como ruta', 'Elegir una foto del código QR']
    ])('übersetzt den statischen QR-Dialog auf %s', (locale, title, adopt, choosePhoto) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);
        expect(dom.window.document.querySelector('#qr-scan-dialog h2').textContent).toBe(title);
        expect(dom.window.document.getElementById('qr-received-adopt').textContent).toBe(adopt);
        expect(dom.window.document.querySelector('[data-i18n="qr.scan.choosePhoto"]').textContent).toBe(choosePhoto);
        expect(dom.window.document.getElementById('qr-scan-file')).toBeTruthy();
    });

    it('übersetzt dynamische Zusammenfassungen und Pluralformen', () => {
        expect(translate('en', 'qr.received.summaryMany', {
            count: 4, date: 'Tuesday, 6 October 2026', time: '08:00', minutes: 45
        })).toBe('4 stops · Tuesday, 6 October 2026, start 08:00 · 45 min per visit');
        expect(translate('fr', 'qr.share.skippedOne', { count: 1 })).toBe('1 autre ne tient pas dans le code');
        expect(translate('es', 'qr.adopt.createdMany', { stops: 5, created: 2 }))
            .toBe('Ruta de 5 paradas importada; se han creado 2 clientes nuevos.');
    });

    it('rendert QR-Laufzeittexte aus dem Katalog und formatiert das Datum nach Sprache', () => {
        const qr = read('src/ui/tourQr.js');
        const main = read('src/main.js');
        expect(qr).toContain("t('qr.scan.unavailable')");
        expect(qr).toContain("t('qr.received.legs'");
        expect(qr).toContain('toLocaleDateString(currentLocale()');
        expect(qr).toContain("on('locale:changed'");
        expect(main).toContain("t('qr.scan.invalidLink')");
    });
});
