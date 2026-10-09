import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyLocale, translate } from '../src/core/i18n.js';
import { MESSAGES } from '../src/i18n/messages.js';
import { state } from '../src/core/state.js';
import { customerPopupHtml } from '../src/features/map.js';
import { agoText, formatDate } from '../src/features/visits.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const originalDepth = state.ui.depth;

afterEach(() => {
    applyLocale('de', null);
    state.ui.depth = originalDepth;
    state.tour.stops = [];
    state.tour.destination = null;
});

describe('Kundensuche und Kundenkarte in vier Sprachen', () => {
    it('hat für jeden Kunden-Schlüssel alle vier Übersetzungen', () => {
        const keys = Object.keys(MESSAGES.de).filter((key) => key.startsWith('customer.'));
        expect(keys.length).toBeGreaterThan(40);
        for (const locale of ['en', 'fr', 'es']) {
            for (const key of keys) expect(MESSAGES[locale][key], `${locale}:${key}`).toBeTruthy();
        }
    });

    it.each([
        ['en', 'Saved locations', 'Customers (4 of 9)', 'No results'],
        ['fr', 'Lieux enregistrés', 'Clients (4 sur 9)', 'Aucun résultat'],
        ['es', 'Ubicaciones guardadas', 'Clientes (4 de 9)', 'Sin resultados']
    ])('übersetzt die dynamischen Suchgruppen auf %s', (locale, saved, customers, none) => {
        expect(translate(locale, 'customer.search.savedPlaces')).toBe(saved);
        expect(translate(locale, 'customer.search.customersCount', { shown: 4, total: 9 })).toBe(customers);
        expect(translate(locale, 'customer.search.none')).toBe(none);
    });

    it.each([
        ['de', 'VB: Eva Beispiel'],
        ['en', 'Sales rep: Eva Beispiel'],
        ['fr', 'Commercial : Eva Beispiel'],
        ['es', 'Comercial: Eva Beispiel']
    ])('übersetzt die VB-Zuordnung auf %s', (locale, expected) => {
        expect(translate(locale, 'customer.representative', { name: 'Eva Beispiel' })).toBe(expected);
    });

    it('rendert den Kundensteckbrief samt Aktionen und Formaten auf Englisch', () => {
        applyLocale('en', null);
        state.ui.depth = 'profi';
        const html = customerPopupHtml({
            id: 'c-1', nummer: '4711', name: 'Example Ltd', strasse: 'Test Road 1',
            plz: 'SW1A', ort: 'London', umsatz: 123456, telefon: '+44 20 1234',
            email: 'hello@example.org', ansprechpartner: 'Alex', rhythmusWochen: 4,
            besuche: ['2026-10-01'], geo: 'strasse'
        });

        expect(html).toContain('<span>Revenue</span>');
        expect(html).toContain('123 k€');
        expect(html).toContain('title="123,456 €"');
        expect(html).toContain('Last visit:');
        expect(html).toContain('every 4 weeks');
        expect(html).toContain('📞 Call');
        expect(html).toContain('title="Copy customer number and name to the clipboard as [4711] Example Ltd"');
        expect(html).toContain('Set as start');
        expect(html).toContain('Add to tour');
        expect(html).toContain('Prepare a customer briefing prompt');
        expect(html).not.toContain('Umsatz');
        expect(html).not.toContain('Heute besucht');
    });

    it('formatiert Datum und relativen Besuch passend zur Sprache', () => {
        expect(formatDate('2026-10-05', 'de')).toBe('5.10.2026');
        expect(formatDate('2026-10-05', 'en')).toBe('05/10/2026');
        const now = new Date('2026-10-05T12:00:00');
        expect(agoText('2026-10-04', now, 'fr')).toBe('hier');
        expect(agoText('2026-10-04', now, 'es')).toBe('ayer');
    });

    it('maskiert Katalogtexte und Nutzerdaten vor dynamischem HTML', () => {
        const map = read('src/features/map.js');
        const search = read('src/ui/search.js');
        expect(map).toContain("escapeHtml(t('customer.action.briefingTitle'))");
        expect(map).toContain("escapeHtml(t('customer.contact.call'))");
        expect(search).toContain("escapeHtml(t('customer.search.none'))");
        expect(search).toContain('escapeHtml(c.name)');
    });
});
