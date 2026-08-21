import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDemoCustomers } from '../src/services/excel.js';
import { visitStatus } from '../src/features/visits.js';
import { enrichPlacesByPlz } from '../src/services/geocode.js';
import {
    globalSearchHits, normalizeSearchText, searchCustomers, GROUP_LIMIT, SINGLE_GROUP_LIMIT
} from '../src/ui/search.js';
import { buildPlaceIndex } from '../src/features/places.js';

const placeData = JSON.parse(readFileSync(resolve(process.cwd(), 'public/geodata/plz-places.json'), 'utf8'));
const centroids = JSON.parse(readFileSync(resolve(process.cwd(), 'public/geodata/plz-centroids.json'), 'utf8'));

describe('Kunden- und Ortssuche', () => {
    it('enthält Essen im lokalen PLZ-Ortsverzeichnis', () => {
        expect(placeData.places['45127']).toBe('Essen');
        expect(Object.keys(placeData.places).length).toBeGreaterThan(8_000);
    });

    it('ergänzt die Beispieldaten um den Ort der verwendeten PLZ', () => {
        const customers = createDemoCustomers(centroids, placeData.places);

        expect(customers).toHaveLength(2_250);
        expect(customers.every((customer) => customer.ort)).toBe(true);
        expect(customers.filter((customer) => customer.ort === 'Essen')).toHaveLength(4);
        expect(customers.every((customer) => customer.name.startsWith('TourFuchs Demo ·'))).toBe(true);
        expect(customers.every((customer) => customer.strasse === '')).toBe(true);
        expect(customers.every((customer) => customer.email.endsWith('@example.com'))).toBe(true);
        expect(customers.every((customer) => customer.demo === true)).toBe(true);
        const exceptions = customers.filter((customer) => ['faellig', 'ueberfaellig'].includes(visitStatus(customer)));
        expect(exceptions).toHaveLength(112);
        expect(exceptions.length / customers.length).toBeLessThanOrEqual(0.05);
    });

    it('ergänzt ältere Demodaten, ohne vorhandene Ortsnamen zu überschreiben', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => ({ ok: true, json: async () => placeData });
        const customers = [
            { id: '1', plz: '45127', ort: '' },
            { id: '2', plz: '45127', ort: 'Eigener Ort' }
        ];

        try {
            expect(await enrichPlacesByPlz(customers)).toBe(1);
            expect(customers.map((customer) => customer.ort)).toEqual(['Essen', 'Eigener Ort']);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('findet Kunden über Stadt, Name, PLZ und Kundennummer', () => {
        const customers = [
            { id: '1', name: 'Ruhrtechnik GmbH', ort: 'Essen', plz: '45127', nummer: 'K-100' },
            { id: '2', name: 'Kölner Handel', ort: 'Köln', plz: '50667', nummer: 'K-200' }
        ];

        expect(searchCustomers(customers, 'Essen').map((customer) => customer.id)).toEqual(['1']);
        expect(searchCustomers(customers, 'Koln').map((customer) => customer.id)).toEqual(['2']);
        expect(searchCustomers(customers, '45127').map((customer) => customer.id)).toEqual(['1']);
        expect(searchCustomers(customers, 'K-200').map((customer) => customer.id)).toEqual(['2']);
    });

    it('bleibt bei unvollständigen Kundendaten stabil', () => {
        expect(() => searchCustomers([{ id: '1', name: 'Ohne Ort' }], 'Essen')).not.toThrow();
        expect(normalizeSearchText(null)).toBe('');
    });
});

/**
 * Das Feld in der Kopfleiste verspricht „Kunde, Ort, PLZ" – gefunden wurden
 * aber nur Kunden. „Ort" und „PLZ" meinten die Spalten eines Kunden: Wer
 * „Essen" tippte, bekam die Kunden in Essen, nie Essen selbst. Und ein
 * gespeicherter Ort war über dieses Feld gar nicht erreichbar.
 */
describe('Kopfsuche findet auch Orte, nicht nur Kunden', () => {
    const index = buildPlaceIndex({ centroids, places: placeData.places });
    const customers = [
        { id: '1', name: 'Ruhrtechnik GmbH', ort: 'Essen', plz: '45127', nummer: 'K-100' },
        { id: '2', name: 'Kölner Handel', ort: 'Köln', plz: '50667', nummer: 'K-200' }
    ];
    const places = [
        { id: 'p1', label: 'SIXT Essen Hbf', lat: 51.451, lng: 7.014, plz: '45127', ort: 'Essen', strasse: '' }
    ];

    it('findet den Ort selbst, nicht nur die Kunden darin', () => {
        const hits = globalSearchHits({ customers, places: [], index, query: 'Essen' });
        expect(hits.customers.map((c) => c.id)).toEqual(['1']);
        // Der eigentliche Befund: Diese Gruppe war vorher immer leer.
        expect(hits.orte.length).toBeGreaterThan(0);
        expect(hits.orte[0].ort).toBe('Essen');
        expect(Number.isFinite(hits.orte[0].lat)).toBe(true);
    });

    it('findet einen gespeicherten Ort und stellt ihn nach oben', () => {
        const hits = globalSearchHits({ customers, places, index, query: 'SIXT' });
        expect(hits.own.map((r) => r.id)).toEqual(['p1']);
        expect(hits.own[0].kind).toBe('eigener-ort');
    });

    it('nimmt eingefügte Koordinaten an und lässt das Verzeichnis dann weg', () => {
        const hits = globalSearchHits({ customers, places, index, query: '51.4560, 7.0100' });
        expect(hits.orte).toHaveLength(1);
        expect(hits.orte[0].kind).toBe('koordinaten');
    });

    it('gibt der Postleitzahl ihren eigenen Treffer neben den Kunden', () => {
        // Am echten Bestand gefunden: An einer PLZ hängen mehrere Kunden, und
        // der Ort selbst rutschte unter die Faltkante – die Antwort, wegen der
        // man die Postleitzahl getippt hat, war nicht zu sehen.
        const viele = Array.from({ length: 12 }, (_, i) => ({
            id: `k${i}`, name: `Kunde ${i}`, ort: 'Essen', plz: '45127', nummer: ''
        }));
        const hits = globalSearchHits({ customers: viele, places: [], index, query: '45127' });
        expect(hits.orte.length).toBeGreaterThan(0);
        expect(hits.customers).toHaveLength(GROUP_LIMIT);
        // Verschwiegen wird nichts: Die Gesamtzahl bleibt ablesbar.
        expect(hits.totalCustomers).toBe(12);
    });

    it('lässt einer Gruppe allein den vollen Platz', () => {
        const viele = Array.from({ length: 12 }, (_, i) => ({
            id: `k${i}`, name: `Ruhrtechnik ${i}`, ort: 'Bochum', plz: '44787', nummer: ''
        }));
        const hits = globalSearchHits({ customers: viele, places: [], index, query: 'Ruhrtechnik' });
        expect(hits.orte).toHaveLength(0);
        expect(hits.customers).toHaveLength(SINGLE_GROUP_LIMIT);
    });

    it('bleibt ohne Ortsverzeichnis und ohne eigene Orte brauchbar', () => {
        // Das Verzeichnis wird beim ersten Tippen geladen; bis dahin muss die
        // Kundensuche antworten statt zu werfen.
        const hits = globalSearchHits({ customers, query: 'Essen' });
        expect(hits.customers.map((c) => c.id)).toEqual(['1']);
        expect(hits.own).toEqual([]);
        expect(hits.orte).toEqual([]);
    });

    it('benutzt dieselbe Ortssuche wie der Tourplaner', () => {
        // Zwei Ortssuchen mit eigenen Regeln fielen beim ersten Vergleich auf:
        // „warum findet das eine Feld meinen Ort und das andere nicht?"
        const search = readFileSync(resolve(process.cwd(), 'src/ui/search.js'), 'utf8');
        expect(search).toContain("from '../features/places.js'");
        expect(search).toContain('searchOwnPlaces');
        expect(search).toContain('searchGeoPlaces');
        expect(search).toContain('parseCoordinateQuery');
    });

    it('bringt zum Ort, statt einen anzulegen', () => {
        // Das Anlegen gehört an Start und Ziel im Tourplaner – ein zweiter
        // Einstieg dafür wäre ein zweiter Ort für dieselbe Entscheidung.
        const search = readFileSync(resolve(process.cwd(), 'src/ui/search.js'), 'utf8');
        expect(search).toContain('flyToPlace(treffer)');
        expect(search).not.toContain('createOwnPlace');
        expect(search).not.toContain('place-picker:open');
    });

    it('wirft eine überholte Antwort weg, statt sie unterzuschieben', () => {
        // Das Verzeichnis lädt beim ersten Tippen. Wer in dieser Zeit
        // weitertippt, darf keine veraltete Liste bekommen.
        const search = readFileSync(resolve(process.cwd(), 'src/ui/search.js'), 'utf8');
        expect(search).toContain('const run = ++sequence;');
        expect(search).toContain('if (run !== sequence) return;');
    });
});
