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
        ['en', 'Visit planner', '…or customer, place or postal code as start', '⚡ Optimise', '✨ Explainable day proposal', 'Calculate day proposal'],
        ['fr', 'Planificateur de visites', '…ou client, lieu ou code postal comme départ', '⚡ Optimiser', '✨ Proposition de journée explicable', 'Calculer la proposition du jour'],
        ['es', 'Planificador de visitas', '…o cliente, lugar o código postal como inicio', '⚡ Optimizar', '✨ Propuesta diaria explicable', 'Calcular propuesta diaria']
    ])('übersetzt den statischen Tourkern auf %s', (locale, title, startPlaceholder, optimise, serviceTitle, calculate) => {
        const dom = new JSDOM(read('index.html'));
        translateDocument(dom.window.document, locale);
        expect(dom.window.document.querySelector('.tour-panel-title').textContent).toBe(title);
        expect(dom.window.document.getElementById('start-search').placeholder).toBe(startPlaceholder);
        expect(dom.window.document.getElementById('btn-optimize').textContent).toBe(optimise);
        expect(dom.window.document.querySelector('.service-day-planner-head b').textContent).toBe(serviceTitle);
        expect(dom.window.document.getElementById('btn-service-day-preview').textContent).toBe(calculate);
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
        expect(translate('en', 'tour.service.preview.returnUtilization', { time: '16:30', percent: 82 }))
            .toBe('Return 16:30 · 82% utilisation');
        expect(translate('fr', 'tour.service.reason.missingSkills'))
            .toBe('Compétence requise manquante');
        expect(translate('es', 'tour.service.preview.omittedMany', { count: 3 }))
            .toBe('3 trabajos sin planificar · Mostrar motivos');
        expect(translate('en', 'tour.service.confirmed.hint', { time: '16:45' }))
            .toBe('Return 16:45. Manual changes discard the fixed times.');
        expect(translate('fr', 'tour.service.toast.acceptedMany', { count: 4 }))
            .toBe('4 arrêts de service ajoutés. Les horaires et raisons restent enregistrés dans le planning.');
        expect(translate('es', 'tour.service.confirm.replaceStops'))
            .toBe('¿Sustituir las paradas actuales por esta propuesta diaria de servicio?');
        expect(translate('en', 'tour.service.stop.outsideFilter'))
            .toBe('Outside service filter');
        expect(translate('fr', 'tour.service.stop.listen'))
            .toBe('🔊 Écouter');
        expect(translate('es', 'tour.service.stop.scopeWarningMany', { count: 2 }))
            .toBe('2 puntos de cliente seleccionados están fuera del filtro de servicio y se mantienen deliberadamente en la ruta.');
    });

    it('rendert Start, Ziel, Stopps, Vorschläge und Touraktionen aus dem Katalog', () => {
        const panel = read('src/ui/tourPanel.js');
        const visits = read('src/ui/serviceVisitPlanner.js');
        for (const key of [
            'tour.start.none',
            'tour.destination.none',
            'tour.stops.empty',
            'tour.stops.briefingTitle',
            'tour.summary.estimated',
            'tour.suggestions.noneRadius',
            'tour.toast.optimized',
            'tour.toast.printPopup',
            'tour.toast.calendarCreated',
            'tour.toast.textCopied',
            'tour.toast.googleMapsLimit',
            'tour.saved.none'
        ]) expect(panel, key).toContain(key);
        expect(read('index.html')).toContain('data-i18n="tour.action.showRoute"');
        for (const key of [
            'tour.service.preview.noneTitle',
            'tour.service.preview.stopDetail',
            'tour.service.preview.returnUtilization',
            'tour.service.preview.omittedMany',
            'tour.service.preview.accept',
            'tour.service.reason.missingSkills',
            'tour.service.planReason.slaFirst',
            'tour.service.toast.discardedManual',
            'tour.service.toast.jobOutdated',
            'tour.service.confirm.replaceStops',
            'tour.service.confirmed.title',
            'tour.service.confirmed.hint',
            'tour.service.stop.scopeWarningOne',
            'tour.service.stop.outsideFilter',
            'tour.service.stop.zanoboTitle',
            'tour.service.stop.listen'
        ]) expect(panel, key).toContain(key);
        expect(panel).toContain('tradeoffLine(entries.length, omittedRows.map((item) => item.reason), currentLocale())');
        expect(panel).toContain('renderSavedTours(); renderServiceDayPreview();');
        expect(visits).toContain("t('tour.service.allOpen')");
        expect(visits).toContain("on('locale:changed', renderAssigneeOptions)");
    });

    it('maskiert dynamische Texte in Tour-HTML und rendert bei Sprachwechsel neu', () => {
        const panel = read('src/ui/tourPanel.js');
        const main = read('src/main.js');
        const map = read('src/features/map.js');
        expect(panel).toContain("escapeHtml(t('tour.stops.destinationLabel', { label }))");
        expect(panel).toContain("const briefingTitle = t('tour.stops.briefingTitle'");
        expect(panel).toContain('escapeHtml(briefingTitle)');
        expect(panel).toContain("on('locale:changed', () => { renderPanel(); renderSavedTours(); renderServiceDayPreview(); })");
        expect(main).toContain("emit('locale:changed', locale)");
        expect(map).toContain("on('locale:changed', refreshAll)");
        expect(map).toContain('marker.bindTooltip(escapeHtml(tooltipText))');
    });
});
