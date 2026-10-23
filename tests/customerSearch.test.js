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

describe('Kundensuche: Umlaute, unsichtbare Zeichen, Rangfolge (Feedback „loew")', () => {
    const loew = { id: 'g', name: 'GEBR. LOEW GMBH & CO. KG', ort: 'Arnsberg', plz: '59757', nummer: '7000001' };

    it('findet „LOEW" auch mit „Löw" und umgekehrt', () => {
        const loew2 = { id: 'g2', name: 'Löw Metallbau', ort: 'Köln', plz: '50667', nummer: '' };
        for (const query of ['loew', 'Loew', 'Löw', 'löw']) {
            expect(searchCustomers([loew], query).map((c) => c.id)).toEqual(['g']);
        }
        for (const query of ['Löw', 'loew', 'low']) {
            expect(searchCustomers([loew2], query).map((c) => c.id)).toEqual(['g2']);
        }
    });

    it('übersieht unsichtbare Zeichen aus CRM-Exporten (weiches Trennzeichen, Nullbreite)', () => {
        const versteckt = [
            { id: 'shy', name: 'GEBR. LO­EW GMBH', ort: '', plz: '' },
            { id: 'zw', name: 'GEBR. LO​EW GMBH', ort: '', plz: '' },
            { id: 'nb', name: 'GEBR. LOEW GMBH', ort: '', plz: '' }
        ];
        expect(searchCustomers(versteckt, 'loew').map((c) => c.id)).toEqual(['shy', 'zw', 'nb']);
        expect(searchCustomers(versteckt, 'gebr. loew').map((c) => c.id)).toEqual(['shy', 'zw', 'nb']);
    });

    it('stellt Treffer am Wortanfang vor Treffer mitten im Wort – auch wenn der Platz knapp ist', () => {
        const mitten = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, name: `Moloewix ${i}`, ort: '', plz: '' }));
        expect(searchCustomers([...mitten, loew], 'loew', GROUP_LIMIT)[0].id).toBe('g');
        // Kundennummer exakt: ganz oben.
        expect(searchCustomers([...mitten, loew], '7000001')[0].id).toBe('g');
    });

    it('stellt das ganze Wort vor den Wortanfang („loew" → GEBR. LOEW vor LÖWENHOF, LOEWEN)', () => {
        // Nachgestellt aus dem Screenshot: 24 Treffer, 4 Plätze neben den Ortsvorschlägen.
        const andere = [
            { id: 'h', name: 'LÖWENHOF MUSTERSTADT GMBH', ort: 'Freising', plz: '85356' },
            { id: 'c1', name: 'EFG MEYER & LOEWEN BRAND KG', ort: 'Osnabrueck', plz: '49078' },
            { id: 'c2', name: 'MEYER & LOEWEN OSNABRUECK KG', ort: 'Osnabrueck', plz: '49078' },
            { id: 'c3', name: 'MEYER & LOEWEN BREMEN KG FACHGROSSHANDEL', ort: 'Stuhr', plz: '28816' },
            ...Array.from({ length: 19 }, (_, i) => ({ id: `w${i}`, name: `LOEWEN WERK ${i}`, ort: '', plz: '' }))
        ];
        const hits = searchCustomers([...andere, loew], 'loew', GROUP_LIMIT);
        expect(hits[0].id).toBe('g');
        expect(searchCustomers([...andere, loew], 'gebr loew')[0].id).toBe('g');
    });

    it('bleibt bei Eingaben ohne Buchstaben und bei Satzzeichen tolerant', () => {
        expect(searchCustomers([loew], 'gebr l').map((c) => c.id)).toEqual(['g']);
        expect(searchCustomers([loew], 'GmbH & Co').map((c) => c.id)).toEqual(['g']);
        expect(searchCustomers([loew], '&&')).toEqual([]);
    });
});
