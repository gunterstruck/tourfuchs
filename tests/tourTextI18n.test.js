import { afterEach, describe, expect, it } from 'vitest';
import { applyLocale } from '../src/core/i18n.js';
import { tourText } from '../src/features/handoff.js';

const start = { label: 'Hotel Centro', lat: 40.41, lng: -3.70 };
const stop = {
    id: 'c1', name: 'Cliente Uno', strasse: 'Calle Mayor 1', plz: '28013', ort: 'Madrid',
    telefon: '+34 91 123 45 67', lat: 40.42, lng: -3.71
};

afterEach(() => applyLocale('de', null));

describe('Textübergabe einer Tour', () => {
    it('erzeugt die deutsche Fassung als Rückfall', () => {
        applyLocale('de', null);
        expect(tourText(start, [stop], null, { tourName: 'Madrid', roadKm: 12, roundTrip: true }))
            .toBe([
                'Tour: Madrid',
                'Start: Hotel Centro',
                '1. Cliente Uno · Calle Mayor 1, 28013 Madrid · Tel: +34 91 123 45 67',
                'Zurück zum Start: Hotel Centro',
                'Strecke ca. 12 km (Rundreise) – Luftlinie geschätzt.'
            ].join('\n'));
    });

    it.each([
        ['en', 'Tour: Madrid', 'Start: Hotel Centro', 'Phone: +34 91 123 45 67', 'Return to start: Hotel Centro', 'Estimated distance approx. 12 km (round trip)'],
        ['fr', 'Tournée : Madrid', 'Départ : Hotel Centro', 'Tél. : +34 91 123 45 67', 'Retour au départ : Hotel Centro', 'Distance estimée : env. 12 km (boucle)'],
        ['es', 'Ruta: Madrid', 'Inicio: Hotel Centro', 'Tel.: +34 91 123 45 67', 'Vuelta al inicio: Hotel Centro', 'Distancia estimada: aprox. 12 km (ruta circular)']
    ])('erzeugt Überschrift, Wegpunkte und Strecke auf %s', (locale, title, startText, phone, returnText, distance) => {
        applyLocale(locale, null);
        const text = tourText(start, [stop], null, { tourName: 'Madrid', roadKm: 12, roundTrip: true });
        expect(text).toContain(title);
        expect(text).toContain(startText);
        expect(text).toContain(phone);
        expect(text).toContain(returnText);
        expect(text).toContain(distance);
    });

    it('übersetzt auch Ziel und Demokennzeichnung', () => {
        applyLocale('en', null);
        const demoStop = { ...stop, demo: true, dataOrigin: 'tourfuchs-demo' };
        const text = tourText(start, [demoStop], stop, { tourName: 'Demo' });
        expect(text).toContain('DEMO - NOT FOR PRODUCTION');
        expect(text).toContain('Destination: Cliente Uno');
    });
});
