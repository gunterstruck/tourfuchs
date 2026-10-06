import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../src/core/i18n.js';
import { printDayPlan } from '../src/features/tourExport.js';

const start = { label: 'Office', lat: 51.44, lng: 7.0 };
const customer = {
    id: 'c1', name: 'Muster GmbH', strasse: 'Markt 1', plz: '45127', ort: 'Essen',
    ansprechpartner: 'Ana López', telefon: '+49 201 123', lat: 51.45, lng: 7.01,
    rhythmusWochen: 4, besuche: ['2026-09-05']
};
const destination = { label: 'Charging Station', adresse: 'Parkstraße 4', lat: 51.46, lng: 7.02 };

afterEach(() => {
    applyLocale('de', null);
    vi.restoreAllMocks();
});

function pageFor(locale, options = {}) {
    applyLocale(locale, null);
    let page = '';
    vi.spyOn(window, 'open').mockReturnValue({
        document: { write: (html) => { page = html; }, close() {} }
    });
    const selectedCustomer = options.customer || customer;
    const stops = options.destination ? [selectedCustomer, destination] : [selectedCustomer];
    printDayPlan(start, stops, {
        startTime: '2026-10-06T08:00:00',
        destination: options.destination ? { point: destination, isCustomer: false } : null,
        servicePlan: options.servicePlan || null,
        serviceVisits: options.serviceVisits || []
    });
    return page;
}

describe('Gedruckter Tagesplan in vier Sprachen', () => {
    it.each([
        ['en', 'Arrival', 'Customer', '1 visit', 'Estimated times (45 min per visit, 60 km/h travel).', 'Created with TourFuchs Sales.', 'Rhythm: 4 weeks · last visit'],
        ['fr', 'Arrivée', 'Client', '1 visite', 'Horaires estimés (45 min par visite, trajet à 60 km/h).', 'Créé avec TourFuchs Vente.', 'Rythme : 4 semaines · dernière visite'],
        ['es', 'Llegada', 'Cliente', '1 visita', 'Horarios estimados (45 min por visita, desplazamiento a 60 km/h).', 'Creado con TourFuchs Ventas.', 'Ritmo: 4 semanas · última visita']
    ])('übersetzt Inhalt und Metadaten auf %s', (locale, ...parts) => {
        const html = pageFor(locale);
        expect(html).toContain(`<html lang="${locale}">`);
        for (const part of parts) expect(html).toContain(part);
        expect(html).toContain('Muster GmbH');
    });

    it.each([
        ['en', 'Destination: Charging Station'],
        ['fr', 'Destination : Charging Station'],
        ['es', 'Destino: Charging Station']
    ])('übersetzt den getrennten Endpunkt auf %s', (locale, label) => {
        expect(pageFor(locale, { destination: true })).toContain(label);
    });

    it('übersetzt Demo-Warnung und Standardnamen, ohne Kundendaten zu verändern', () => {
        const html = pageFor('en', {
            customer: { ...customer, demo: true, dataOrigin: 'tourfuchs-demo' }
        });

        expect(html).toContain('🦊 Day tour');
        expect(html).toContain('DEMO - NOT FOR PRODUCTION');
        expect(html).toContain('Ana López');
    });

    it('übersetzt auch Hinweise des bestätigten Serviceplans', () => {
        const html = pageFor('en', {
            servicePlan: {
                workDate: '2026-10-06', shiftStart: '08:00',
                itinerary: [{
                    customerId: 'c1', start: '2026-10-06T09:00:00', end: '2026-10-06T09:45:00',
                    driveMin: 20, km: 12, visitIds: ['V1']
                }],
                metrics: { totalKm: 12, finishAt: '2026-10-06T10:15:00' }
            },
            serviceVisits: [{ id: 'V1', workOrderId: 'WO-7', reason: 'Maintenance', priority: 'P1' }]
        });

        expect(html).toContain('Priority P1');
        expect(html).toContain('Confirmed service day proposal · Return 10:15');
    });
});
