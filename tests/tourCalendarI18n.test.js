import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../src/core/i18n.js';
import { downloadIcs } from '../src/features/tourExport.js';

const customer = {
    id: 'c1', nummer: 'K-42', name: 'Muster GmbH', strasse: 'Markt 1', plz: '45127', ort: 'Essen',
    ansprechpartner: 'Ana López', telefon: '+49 201 123', email: 'ana@example.com', lat: 51.45, lng: 7.01
};
const servicePlan = {
    workDate: '2026-10-06', shiftStart: '08:00',
    itinerary: [{ customerId: 'c1', start: '2026-10-06T09:00:00', end: '2026-10-06T09:45:00', visitIds: ['V1'] }]
};
const serviceVisits = [{
    id: 'V1', workOrderId: 'WO-7', reason: 'Wartung', priority: 'HOCH',
    assignedTo: 'Team West', sourceUrl: 'https://example.test/job/7'
}];

afterEach(() => {
    applyLocale('de', null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

async function calendarFor(locale, over = {}) {
    applyLocale(locale, null);
    let blob;
    vi.stubGlobal('URL', { ...URL, createObjectURL: (value) => { blob = value; return 'blob:test'; }, revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadIcs({ lat: 51.44, lng: 7.0, label: 'Office' }, [over.customer || customer], {
        tourName: 'Tuesday North', servicePlan, serviceVisits, ...over.options
    });
    return blob.text();
}

describe('Kalenderexport in vier Sprachen', () => {
    it.each([
        ['en', 'PRODID:-//TourFuchs//EN', 'Primary contact: Ana López', 'Phone: +49 201 123', 'Customer no.: K-42', 'Work order: WO-7', 'Reason: Wartung', 'Assigned to: Team West'],
        ['fr', 'PRODID:-//TourFuchs//FR', 'Contact principal : Ana López', 'Téléphone : +49 201 123', 'N° client : K-42', 'Ordre de travail : WO-7', 'Motif : Wartung', 'Responsable : Team West'],
        ['es', 'PRODID:-//TourFuchs//ES', 'Contacto principal: Ana López', 'Teléfono: +49 201 123', 'N.º de cliente: K-42', 'Orden de trabajo: WO-7', 'Motivo: Wartung', 'Responsable: Team West']
    ])('übersetzt die Terminbeschreibung auf %s', async (locale, ...parts) => {
        const text = await calendarFor(locale);
        for (const part of parts) expect(text).toContain(part);
        expect(text).toContain('SUMMARY:1. Muster GmbH (Tuesday North)');
    });

    it('übersetzt die Demo-Sicherheitskennzeichnung, ohne den Termin zu verlieren', async () => {
        const text = await calendarFor('en', {
            customer: { ...customer, demo: true, dataOrigin: 'tourfuchs-demo' }
        });
        expect(text).toContain('DEMO - NOT FOR PRODUCTION');
        expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    });
});
