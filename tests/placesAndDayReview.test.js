import { describe, expect, it } from 'vitest';
import { searchOwnPlaces, tourPointFromResult } from '../src/features/places.js';
import { googleMapsLink, routeDistance } from '../src/features/tour.js';
import { dayReview, wasOverdueBeforeVisit } from '../src/features/dayReview.js';

describe('Eigener Ort mit präzisem Pin über die Suche', () => {
    it('Suchtreffer und Tourpunkt behalten coordinateSource – Navigation zur Einfahrt', () => {
        const place = { id: 'p1', label: 'Einfahrt Werk', strasse: 'Industriestr. 5', plz: '45127', ort: 'Essen', lat: 51.45123, lng: 7.01234, coordinateSource: 'map-pin' };
        const [hit] = searchOwnPlaces('Einfahrt', [place]);
        expect(hit.coordinateSource).toBe('map-pin');
        const point = tourPointFromResult(hit);
        expect(point.coordinateSource).toBe('map-pin');
        const link = googleMapsLink({ lat: 51.4, lng: 7.0, label: 'Start' }, [point]);
        expect(new URL(link).searchParams.get('destination')).toBe('51.45123,7.01234');
    });

    it('ohne Pin bleibt es bei der Adresse', () => {
        const [hit] = searchOwnPlaces('Lager', [{ id: 'p2', label: 'Lager', strasse: 'Weg 1', plz: '45127', ort: 'Essen', lat: 51.4, lng: 7.0 }]);
        expect(hit).not.toHaveProperty('coordinateSource');
    });
});

describe('Tagesrückblick', () => {
    const now = new Date('2026-10-05T15:00:00');
    const kunde = { id: 'k1', name: 'A', rhythmusWochen: 1, besuche: ['2026-09-28', '2026-10-05'], lat: 51.5, lng: 7.1 };

    it('heute überfällig geworden und heute besucht zählt als abgearbeitet', () => {
        expect(wasOverdueBeforeVisit(kunde, '2026-10-05', now)).toBe(true);
        expect(dayReview({ customers: [kunde], tour: null, now }).overdueCleared).toBe(1);
    });

    it('die Strecke enthält die Fahrt zum separaten Ziel', () => {
        const start = { lat: 51.45, lng: 7.0 };
        const ziel = { lat: 52.0, lng: 7.6, label: 'Büro' };
        const review = dayReview({ customers: [kunde], tour: { start, stops: ['k1'], destination: ziel, roundTrip: false }, now });
        const expected = routeDistance(start, [{ lat: 51.5, lng: 7.1 }, { lat: 52.0, lng: 7.6 }], false).roadKmEstimate;
        expect(review.roadKmEstimate).toBe(expected);
        expect(review.roadKmEstimate).toBeGreaterThan(routeDistance(start, [{ lat: 51.5, lng: 7.1 }], false).roadKmEstimate);
    });

    it('Ziel als Kunde: dessen Position zählt', () => {
        const zielKunde = { id: 'k2', name: 'B', lat: 52.0, lng: 7.6 };
        const start = { lat: 51.45, lng: 7.0 };
        const review = dayReview({ customers: [kunde, zielKunde], tour: { start, stops: ['k1'], destination: { customerId: 'k2' } }, now });
        expect(review.roadKmEstimate).toBe(routeDistance(start, [{ lat: 51.5, lng: 7.1 }, { lat: 52.0, lng: 7.6 }], false).roadKmEstimate);
    });
});
