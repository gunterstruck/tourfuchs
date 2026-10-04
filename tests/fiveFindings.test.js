import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { autoDetectMapping, customerExportRows, parseRows } from '../src/services/excel.js';
import { downloadIcs } from '../src/features/tourExport.js';
import { decodeTourPayload, encodeTourPayload } from '../src/features/tourShare.js';
import { googleMapsLink } from '../src/features/tour.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Offene Service-Vorschau nach Einsatzimport', () => {
    it('wird verworfen und vor der Übernahme gegen die aktuellen Einsätze geprüft', () => {
        const ui = read('src/ui/tourPanel.js');
        const onChange = ui.slice(ui.indexOf("on('service-visits:changed'"), ui.indexOf("on('service-visits:changed'") + 400);
        expect(onChange).toContain('discardServiceDayPreview(true);');
        const accept = ui.slice(ui.indexOf('function acceptServiceDayPreview()'));
        expect(accept.indexOf('if (!serviceDayPreviewCurrent(result)) {')).toBeLessThan(accept.indexOf('state.tour.stops = [...new Set(stopIds)];'));
        expect(ui).toContain('return now && isSchedulableServiceVisit(now) && now.customerNumber === visit.customerNumber;');
    });
});

describe('Telefonnummern zusätzlicher Kontakte', () => {
    const roundTrip = (contacts) => {
        const rows = customerExportRows([{ id: 'a', nummer: '100', name: 'Muster GmbH', plz: '45127', ansprechpartner: 'Anna', contacts }]);
        return parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
    };

    it('Klammer-, Schrägstrich- und Plus-Schreibweisen bleiben Telefon', () => {
        const contacts = [
            { id: 'c1', name: 'Anna', primary: true },
            { id: 'c2', name: 'Bernd', telefon: '(0234) 123456', primary: false },
            { id: 'c3', name: 'Clara', telefon: '0234/98765', primary: false },
            { id: 'c4', name: 'Dora', telefon: '+49 (0)234 12-34', primary: false }
        ];
        const { customers } = roundTrip(contacts);
        expect(customers[0].contacts.slice(1).map((c) => [c.name, c.telefon])).toEqual([
            ['Bernd', '(0234) 123456'], ['Clara', '0234/98765'], ['Dora', '+49 (0)234 12-34']
        ]);
    });

    it('Unerkanntes wird gemeldet statt still verworfen', () => {
        const rows = [{ Kundenname: 'X', PLZ: '45127', 'Weitere Ansprechpartner': 'Bernd · Lager Nord · Hintereingang' }];
        const { customers, errors } = parseRows(rows, autoDetectMapping(Object.keys(rows[0])));
        expect(customers[0].contacts[0].name).toBe('Bernd');
        expect(errors.some((e) => e.Typ === 'Hinweis' && e.Grund.includes('Hintereingang'))).toBe(true);
    });
});

describe('Planungsknopf mit Wocheneinsätzen', () => {
    it('Freigabe und Klick nutzen dieselbe Auswahl', () => {
        const ui = read('src/ui/serviceVisitPlanner.js');
        const dayStart = ui.slice(ui.indexOf('function renderDayStart()'), ui.indexOf('function renderDayStart()') + 1400);
        expect(dayStart).toContain('const { urgent, planning } = planningSelection();');
        expect(dayStart).toContain('for (const visit of planning) {');
        expect(ui).toContain('const { planning: planningVisits } = planningSelection();');
    });
});

describe('Export mit separatem Endpunkt behält den bestätigten Plan', () => {
    const customer = { id: 'k1', name: 'Muster GmbH', plz: '45127', ort: 'Essen', lat: 51.45, lng: 7.01 };
    const office = { lat: 51.45, lng: 7.01, label: 'Büro' };
    const servicePlan = {
        workDate: '2026-10-05', shiftStart: '08:00',
        metrics: { finishAt: '2026-10-05T11:20:00' },
        itinerary: [{ customerId: 'k1', start: '2026-10-05T10:00:00', end: '2026-10-05T11:00:00', visitIds: ['V1'] }]
    };
    const icsFor = async (options) => {
        let blob;
        vi.stubGlobal('URL', { ...URL, createObjectURL: (b) => { blob = b; return 'blob:x'; }, revokeObjectURL: () => {} });
        downloadIcs({ lat: 51.45, lng: 7.0, label: 'Start' }, [customer, office], options);
        vi.unstubAllGlobals();
        return blob.text();
    };

    it('Kalender: Termin 10–11 Uhr mit Einsatzdetails, kein Termin im Büro', async () => {
        const text = await icsFor({ servicePlan, serviceVisits: [{ id: 'V1', workOrderId: 'WO-7' }], destination: { point: office, isCustomer: false } });
        expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
        expect(text).toContain(`DTSTART:${new Date('2026-10-05T10:00:00').toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
        expect(text).toContain('WO-7');
        expect(text).not.toContain('Büro');
    });

    it('ohne Plan: das Büro ist kein Besuch', async () => {
        const text = await icsFor({ startTime: '2026-10-05T08:00', destination: { point: office, isCustomer: false } });
        expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    });
});

describe('QR: Zielpin und Beschriftung bleiben erhalten', () => {
    it('Einfahrt mit Pin und Adresse: Name, Pin-Kennzeichen, Koordinaten-Navigation', () => {
        const ziel = { lat: 51.45123, lng: 7.01234, label: 'Einfahrt', adresse: 'Industriestr. 5, 45127 Essen', coordinateSource: 'map-pin' };
        const decoded = decodeTourPayload(encodeTourPayload({ start: { lat: 51.4, lng: 7.0, label: 'Start' }, stops: [ziel] }));
        const stop = decoded.stops[0];
        expect(stop).toMatchObject({ name: 'Einfahrt', coordinateSource: 'map-pin', adresse: 'Industriestr. 5, 45127 Essen' });
        expect(new URL(googleMapsLink(decoded.start, decoded.stops)).searchParams.get('destination')).toBe('51.45123,7.01234');
        expect(read('src/ui/tourQr.js')).toContain('...(stop.coordinateSource ? { coordinateSource: stop.coordinateSource } : {}),');
    });
});
