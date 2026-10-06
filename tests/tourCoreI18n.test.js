import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { translate, translateDocument } from '../src/core/i18n.js';
import { MESSAGES } from '../src/i18n/messages.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Tourplaner-Kern in vier Sprachen', () => {
    it('hat für jeden Tour-Schlüssel alle vier Übersetzungen', () => {
        const keys = Object.keys(MESSAGES.de).filter((key) => key.startsWith('tour.'));
        expect(keys.length).toBeGreaterThan(100);
        for (const locale of ['en', 'fr', 'es']) {
            for (const key of keys) expect(MESSAGES[locale][key], `${locale}:${key}`).toBeTruthy();
        }
    });

    it.each([
        ['en', 'Visit planner', '…or customer, place or postal code as start', '⚡ Optimise order'],
        ['fr', 'Planificateur de visites', '…ou client, lieu ou code postal comme départ', '⚡ Optimiser l’ordre'],
        ['es', 'Planificador de visitas', '…o cliente, lugar o código postal como inicio', '⚡ Optimizar orden']
    ])('übersetzt den statischen Tourkern auf %s', (locale, title, startPlaceholder, optimise) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);
        expect(dom.window.document.querySelector('.tour-panel-title').textContent).toBe(title);
        expect(dom.window.document.getElementById('start-search').placeholder).toBe(startPlaceholder);
        expect(dom.window.document.getElementById('btn-optimize').textContent).toBe(optimise);
    });

    it('übersetzt Pluralformen und dynamische Tourhinweise', () => {
        expect(translate('en', 'tour.summary.stopsKmMany', { count: 3, km: 47 })).toBe('3 stops · ~47 km');
        expect(translate('fr', 'tour.suggestions.countMany', { count: 8, radius: 25 }))
            .toBe('8 clients dans un rayon de 25 km');
        expect(translate('es', 'tour.stops.destinationLabel', { label: 'Aeropuerto' }))
            .toBe('Destino: Aeropuerto');
        expect(translate('en', 'tour.toast.googleMapsLimit', { count: 8 }))
            .toBe('Google Maps supports up to 8 stops – the first 8 will be transferred.');
        expect(translate('fr', 'tour.toast.calendarCreated'))
            .toBe('Fichier calendrier (.ics) créé avec un rendez-vous par visite.');
    });

    it('rendert Start, Ziel, Stopps, Vorschläge und Touraktionen aus dem Katalog', () => {
        const panel = read('src/ui/tourPanel.js');
        for (const key of [
            'tour.start.none',
            'tour.destination.none',
            'tour.stops.empty',
            'tour.stops.briefingTitle',
            'tour.summary.estimated',
            'tour.suggestions.noneRadius',
            'tour.action.showRoute',
            'tour.toast.optimized',
            'tour.toast.printPopup',
            'tour.toast.calendarCreated',
            'tour.toast.textCopied',
            'tour.toast.googleMapsLimit',
            'tour.saved.none'
        ]) expect(panel, key).toContain(key);
    });

    it('maskiert dynamische Texte in Tour-HTML und rendert bei Sprachwechsel neu', () => {
        const panel = read('src/ui/tourPanel.js');
        const main = read('src/main.js');
        const map = read('src/features/map.js');
        expect(panel).toContain("escapeHtml(t('tour.stops.destinationLabel', { label }))");
        expect(panel).toContain("const briefingTitle = t('tour.stops.briefingTitle'");
        expect(panel).toContain('escapeHtml(briefingTitle)');
        expect(panel).toContain("on('locale:changed', () => { renderPanel(); renderSavedTours(); })");
        expect(main).toContain("emit('locale:changed', locale)");
        expect(map).toContain("on('locale:changed', refreshAll)");
        expect(map).toContain('marker.bindTooltip(escapeHtml(tooltipText))');
    });
});
