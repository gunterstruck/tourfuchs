/**
 * Orte als Start- und Zielpunkt einer Tour (Roadmap-Item 11.1).
 *
 * Der Kern ist reine Logik und wird hier gegen synthetische **und** gegen die
 * echten gebündelten PLZ-Daten geprüft: Ein Ortsverzeichnis, das nur mit
 * erfundenen Zeilen funktioniert, hätte den Befund über die 94 Ersatz-
 * koordinaten nie gezeigt.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    buildPlaceIndex, searchGeoPlaces, searchOwnPlaces, parseCoordinateQuery,
    placeQueryVariants, tourPointFromResult, createOwnPlace, findOwnPlaceForPoint,
    mergeOwnPlaces, PLACE_CLUSTER_KM
} from '../src/features/places.js';
import { state, setPlaces, addPlace, removePlace, setCustomers, datasetSnapshot } from '../src/core/state.js';
import { CONFIG } from '../src/core/config.js';
import { encodeTourPayload, decodeTourPayload } from '../src/features/tourShare.js';
import { googleMapsLink } from '../src/features/tour.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

const SYNTHETIC = {
    centroids: {
        '45127': [51.4560, 7.0100],
        '45136': [51.4360, 7.0360],
        '23730': [54.1080, 10.8130],   // Neustadt in Holstein
        '67433': [49.3410, 8.1440],    // Neustadt an der Weinstraße, gleicher Name
        '11011': [51.1657, 10.4515]    // Ersatzkoordinate der Quelle
    },
    places: {
        '45127': 'Essen',
        '45136': 'Essen',
        '23730': 'Neustadt',
        '67433': 'Neustadt',
        '11011': 'Berlin'
    }
};

describe('Ortsverzeichnis aus den gebündelten PLZ-Daten', () => {
    const index = buildPlaceIndex(SYNTHETIC);

    it('fasst gleichnamige Postleitzahlen zu einem Ort zusammen', () => {
        const hits = searchGeoPlaces('Essen', index);
        expect(hits).toHaveLength(1);
        expect(hits[0].label).toBe('Essen');
        expect(hits[0].detail).toContain('2 PLZ');
        // Ortsmitte liegt zwischen beiden Zentroiden.
        expect(hits[0].lat).toBeCloseTo(51.446, 2);
    });

    it('trennt gleichnamige Orte, die weit auseinanderliegen', () => {
        const hits = searchGeoPlaces('Neustadt', index);
        expect(hits).toHaveLength(2);
        // Ohne Trennung läge der Mittelpunkt bei ~51,7° – zwischen Ostsee und
        // Pfalz, also an keinem der beiden Orte.
        const breiten = hits.map((h) => Math.round(h.lat));
        expect(breiten).toContain(54);
        expect(breiten).toContain(49);
        expect(PLACE_CLUSTER_KM).toBeGreaterThan(0);
    });

    it('lässt die Ersatzkoordinate der Quelle draußen', () => {
        // 11011 trägt die geografische Mitte Deutschlands statt einer Lage.
        expect(searchGeoPlaces('Berlin', index)).toHaveLength(0);
        expect(index.byPlz.has('11011')).toBe(false);
    });

    it('behandelt reine Ziffern als Postleitzahl', () => {
        const hits = searchGeoPlaces('4513', index);
        expect(hits).toHaveLength(1);
        expect(hits[0].label).toBe('45136 Essen');
        expect(hits[0].plz).toBe('45136');
    });

    it('sucht erst ab zwei Zeichen', () => {
        expect(searchGeoPlaces('E', index)).toEqual([]);
        expect(searchGeoPlaces('', index)).toEqual([]);
    });
});

describe('Ortsverzeichnis gegen die echten Bunddaten', () => {
    const centroids = JSON.parse(read('public/geodata/plz-centroids.json'));
    const places = JSON.parse(read('public/geodata/plz-places.json')).places;
    const index = buildPlaceIndex({ centroids, places });

    it('findet die Stadt vor dem gleichnamigen Nachbarort', () => {
        expect(searchGeoPlaces('Essen', index)[0].label).toBe('Essen');
        expect(searchGeoPlaces('Berlin', index)[0].detail).toContain('PLZ');
    });

    it('findet Orte auch ohne getippten Umlaut', () => {
        expect(searchGeoPlaces('koln', index)[0].label).toBe('Köln');
        expect(searchGeoPlaces('Köln', index)[0].label).toBe('Köln');
        expect(searchGeoPlaces('muenchen', index)[0].label).toBe('München');
    });

    it('löst eine konkrete Postleitzahl auf', () => {
        const hit = searchGeoPlaces('45136', index)[0];
        expect(hit.ort).toBe('Essen');
        expect(hit.lat).toBeGreaterThan(51);
        expect(hit.lng).toBeGreaterThan(6);
    });

    it('schlägt keinen Punkt auf der Ersatzkoordinate vor', () => {
        // Sonst startete eine „Berlin"-Tour auf einem Acker bei Niederdorla.
        for (const entry of index.names) {
            expect(Math.abs(entry.lat - 51.1657) > 0.001 || Math.abs(entry.lng - 10.4515) > 0.001).toBe(true);
        }
    });
});

describe('Eingefügte Koordinaten', () => {
    it('erkennt Punkt- und Komma-Schreibweise', () => {
        expect(parseCoordinateQuery('51.4459, 7.0185')).toEqual({ lat: 51.4459, lng: 7.0185 });
        expect(parseCoordinateQuery('51,4459 7,0185')).toEqual({ lat: 51.4459, lng: 7.0185 });
    });

    it('hält Postleitzahlen für Postleitzahlen', () => {
        expect(parseCoordinateQuery('45127')).toBeNull();
        expect(parseCoordinateQuery('45127 12')).toBeNull();
        expect(parseCoordinateQuery('Essen')).toBeNull();
        expect(parseCoordinateQuery('95.1, 7.0')).toBeNull();  // außerhalb gültiger Breiten
    });

    it('normalisiert Schreibweisen für den Vergleich', () => {
        expect(placeQueryVariants('Köln')).toEqual(['koeln', 'koln']);
        expect(placeQueryVariants('St. Wendel')).toEqual(['st wendel']);
    });
});

describe('Eigene Orte', () => {
    it('braucht Namen und Koordinaten', () => {
        expect(createOwnPlace({ label: '  ', lat: 51, lng: 7 })).toBeNull();
        expect(createOwnPlace({ label: 'Büro', lat: null, lng: 7 })).toBeNull();
        expect(createOwnPlace({ label: 'Büro', lat: 51, lng: 7 })?.label).toBe('Büro');
    });

    it('findet einen gemerkten Ort über Name und Ort', () => {
        const own = [createOwnPlace({ label: 'SIXT Essen Hbf', lat: 51.45, lng: 7.01, plz: '45127', ort: 'Essen' })];
        expect(searchOwnPlaces('sixt', own)[0].label).toBe('SIXT Essen Hbf');
        expect(searchOwnPlaces('essen', own)).toHaveLength(1);
        expect(searchOwnPlaces('45127', own)).toHaveLength(1);
        expect(searchOwnPlaces('Hamburg', own)).toHaveLength(0);
    });

    it('erkennt einen bereits gemerkten Punkt wieder', () => {
        const place = createOwnPlace({ label: 'Büro Essen', lat: 51.45, lng: 7.01 });
        expect(findOwnPlaceForPoint([place], { label: 'Büro Essen', lat: 51.45, lng: 7.01 })).toBe(place);
        expect(findOwnPlaceForPoint([place], { placeId: place.id, label: 'egal', lat: 0, lng: 0 })).toBe(place);
        expect(findOwnPlaceForPoint([place], { label: 'Büro Essen', lat: 52.5, lng: 13.4 })).toBeNull();
    });

    it('ergänzt beim Zusammenführen, statt zu überschreiben', () => {
        const hier = [createOwnPlace({ label: 'Mein Büro', lat: 51.45, lng: 7.01 })];
        const fremd = [
            createOwnPlace({ label: 'Mein Büro', lat: 51.45, lng: 7.01 }),   // derselbe Punkt
            createOwnPlace({ label: 'SIXT Hamburg', lat: 53.63, lng: 9.99 })
        ];
        const merged = mergeOwnPlaces(hier, fremd);
        expect(merged).toHaveLength(2);
        expect(merged[0]).toBe(hier[0]);   // der eigene Eintrag bleibt genau der, der er war
        expect(merged[1].label).toBe('SIXT Hamburg');
    });

    it('führt nicht über das Fach hinaus zusammen', () => {
        const viele = Array.from({ length: CONFIG.tour.maxOwnPlaces + 5 }, (_, i) => (
            createOwnPlace({ label: `Ort ${i}`, lat: 50 + i * 0.5, lng: 7 })
        ));
        expect(mergeOwnPlaces([], viele)).toHaveLength(CONFIG.tour.maxOwnPlaces);
    });
});

describe('Ein Ort ist ein Wegpunkt, kein Kunde', () => {
    beforeEach(() => {
        setCustomers([{ id: 'k1', name: 'Autohaus', vb: 'West', plz: '45136', ort: 'Essen', lat: 51.43, lng: 7.03 }]);
        setPlaces([]);
    });

    it('merkt Orte neben der Kundenliste, ohne sie zu berühren', () => {
        expect(addPlace(createOwnPlace({ label: 'SIXT Essen Hbf', lat: 51.45, lng: 7.01 }))).toBe(true);
        expect(state.places).toHaveLength(1);
        // Der Kundenbestand bleibt unverändert – sonst verschöben sich Zähler,
        // Umsatzsummen, Fälligkeiten und Gebietszuordnung.
        expect(state.customers).toHaveLength(1);
        expect(state.customers.some((c) => c.name.includes('SIXT'))).toBe(false);
    });

    it('reist im Datensatz mit und liegt damit im Tresor', () => {
        addPlace(createOwnPlace({ label: 'Büro', lat: 51.45, lng: 7.01 }));
        expect(datasetSnapshot().places).toEqual(state.places);
    });

    it('nimmt nicht mehr als das Fach hergibt und meldet das', () => {
        for (let i = 0; i < CONFIG.tour.maxOwnPlaces; i++) {
            expect(addPlace(createOwnPlace({ label: `Ort ${i}`, lat: 50 + i * 0.1, lng: 7 }))).toBe(true);
        }
        expect(addPlace(createOwnPlace({ label: 'Einer zu viel', lat: 52, lng: 9 }))).toBe(false);
    });

    it('löscht einen Ort wieder', () => {
        const place = createOwnPlace({ label: 'Weg damit', lat: 51, lng: 7 });
        addPlace(place);
        expect(removePlace(place.id)).toBe(true);
        expect(removePlace(place.id)).toBe(false);
        expect(state.places).toHaveLength(0);
    });

    it('wird beim Übernehmen zu einem Tourpunkt ohne Kunden-Id', () => {
        const point = tourPointFromResult({
            kind: 'eigener-ort', id: 'ort-1', label: 'SIXT Essen Hbf',
            lat: 51.45, lng: 7.01, plz: '45127', ort: 'Essen'
        });
        expect(point).toMatchObject({ label: 'SIXT Essen Hbf', placeId: 'ort-1', plz: '45127' });
        expect(point.customerId).toBeUndefined();
    });
});

describe('Ein Ort als Startpunkt übersteht die QR-Übergabe', () => {
    it('nimmt den Ortsnamen mit aufs Handy', () => {
        const encoded = encodeTourPayload({
            start: { lat: 51.4459, lng: 7.0185, label: 'SIXT Essen Hbf', placeId: 'ort-1' },
            stops: [{ name: 'Autohaus', lat: 51.43, lng: 7.03 }],
            tourName: 'Dienstreise'
        });
        const decoded = decodeTourPayload(encoded);
        expect(decoded.start.label).toBe('SIXT Essen Hbf');
        expect(decoded.start.lat).toBeCloseTo(51.4459, 4);
        // Der Startpunkt trägt kein „hier" – navigiert wird ab der Station.
        expect(decoded.start.here).toBeUndefined();
    });
});

describe('Straße und Hausnummer am eigenen Ort', () => {
    it('reisen im QR-Code mit und führen die Navigation zur Tür', () => {
        const encoded = encodeTourPayload({
            start: {
                lat: 51.4459, lng: 7.0185, label: 'SIXT Essen Hbf',
                strasse: 'Hachestraße 1', plz: '45127', ort: 'Essen'
            },
            stops: [{ name: 'Autohaus', lat: 51.43, lng: 7.03 }]
        });
        const decoded = decodeTourPayload(encoded);
        expect(decoded.start.adresse).toBe('Hachestraße 1, 45127 Essen');
        // Und der Navigationslink benutzt sie, statt auf die Ortsmitte zu zeigen.
        const link = decodeURIComponent(googleMapsLink(decoded.start, decoded.stops)).replace(/\+/g, ' ');
        expect(link).toContain('origin=Hachestraße 1, 45127 Essen');
    });

    it('bleiben ohne Straße bei den Koordinaten', () => {
        const encoded = encodeTourPayload({
            start: { lat: 51.4459, lng: 7.0185, label: '45127 Essen', plz: '45127', ort: 'Essen' },
            stops: [{ name: 'Autohaus', lat: 51.43, lng: 7.03 }]
        });
        const decoded = decodeTourPayload(encoded);
        expect(decoded.start.adresse).toBeUndefined();
        expect(googleMapsLink(decoded.start, decoded.stops)).toContain('origin=51.4459%2C7.0185');
    });

    it('fragt die Straße nur, wo sie etwas ändert, und schlägt sie nicht nach', () => {
        const tourPanel = read('src/ui/tourPanel.js');
        expect(tourPanel).toContain('Straße und Hausnummer in ${point.ort} (optional, nur für die Navigation)');
        // Kein Nachschlagen: Die Eingabe wird mitgeschrieben, nicht verortet.
        expect(tourPanel).not.toMatch(/geocodeExact|nominatim/i);
    });
});

describe('Ein Feld beantwortet „wo starte ich?"', () => {
    const tourPanel = read('src/ui/tourPanel.js');
    const html = read('index.html');

    it('sucht Kunden und Orte im selben Feld – Start wie Ziel', () => {
        // Prüffrage 2.4 des Gestaltprinzips: kein zweites Feld für dieselbe Frage.
        expect(tourPanel).toContain("wireTourPointSearch('start-search', 'start-results'");
        expect(tourPanel).toContain("wireTourPointSearch('dest-search', 'dest-results'");
        expect(tourPanel).not.toContain('wireCustomerSearch');
        expect(html).not.toContain('placeholder="…oder Kunde als Start wählen"');
        expect(html).toContain('Kunde, Ort oder PLZ als Start');
        expect(html).toContain('Kunde, Ort oder PLZ als Ziel');
    });

    it('bietet „★ merken" nur an, wo es etwas zu merken gibt', () => {
        expect(tourPanel).toContain('★ merken');
        // Kunde und GPS-Standort bekommen den Knopf nicht: der eine ist über die
        // Kundensuche auffindbar, der andere morgen ein anderer Punkt.
        expect(tourPanel).toMatch(/if \(!point \|\| point\.customerId \|\| point\.here\) return '';/);
    });

    it('lädt das Verzeichnis lokal und ruft keinen Dienst auf', () => {
        const places = read('src/features/places.js');
        expect(places).not.toMatch(/fetch\(|nominatim|http/i);
        expect(tourPanel).toContain('loadPlaceIndex');
    });
});

describe('Eigene Orte gehören zu den lokalen Daten', () => {
    it('werden beim Löschen aller Daten mitgelöscht', () => {
        const sidebar = read('src/ui/sidebar.js');
        expect(sidebar).toContain('setPlaces([])');
        expect(sidebar).toContain('sowie eigene Orte aus dem Browser löschen?');
    });

    it('werden beim sicheren Umzug ergänzt statt überschrieben', () => {
        const safeTransfer = read('src/ui/safeTransfer.js');
        expect(safeTransfer).toContain('mergeOwnPlaces(state.places, dataset?.places)');
    });

    it('werden beim Start wiederhergestellt', () => {
        expect(read('src/main.js')).toContain('setPlaces(dataset?.places || [])');
    });
});
