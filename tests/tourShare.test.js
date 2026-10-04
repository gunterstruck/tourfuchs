import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { encodeTourPayload, decodeTourPayload, matchStopsToCustomers, encodeTourUrl, extractTourFromUrl, TOUR_QR_PREFIX, TOUR_HASH_KEY, MAX_QR_STOPS } from '../src/features/tourShare.js';

const START = { lat: 51.4501234, lng: 7.0123456, label: 'Mein Standort' };
const STOPS = [
    { name: 'Autohaus Schmidt', lat: 51.5, lng: 7.1, strasse: 'Hauptstr. 1', plz: '45136', ort: 'Essen', telefon: '0201 123', nummer: 'K100' },
    { name: 'Bäckerei Ruhr', lat: 51.6, lng: 7.2, strasse: '', plz: '45127', ort: 'Essen', telefon: '', nummer: '' }
];

describe('QR-Payload encode/decode', () => {
    it('Roundtrip erhält alle planungsrelevanten Daten', () => {
        const text = encodeTourPayload({
            start: START, stops: STOPS, tourName: 'Dienstag Nord',
            date: '2026-07-15', startTime: '08:30', visitMinutes: 45, roundTrip: true
        });
        expect(text.startsWith(TOUR_QR_PREFIX)).toBe(true);

        const decoded = decodeTourPayload(text);
        expect(decoded.tourName).toBe('Dienstag Nord');
        expect(decoded.date).toBe('2026-07-15');
        expect(decoded.startTime).toBe('08:30');
        expect(decoded.visitMinutes).toBe(45);
        expect(decoded.roundTrip).toBe(true);
        expect(decoded.start.lat).toBeCloseTo(51.45012, 4);
        expect(decoded.stops).toHaveLength(2);
        expect(decoded.stops[0].name).toBe('Autohaus Schmidt');
        expect(decoded.stops[0].adresse).toContain('Hauptstr. 1');
        expect(decoded.stops[0].nummer).toBe('K100');
    });

    it('bleibt für eine volle Tagestour QR-tauglich (< 2,3 KB)', () => {
        const many = Array.from({ length: MAX_QR_STOPS }, (_, i) => ({
            name: `Kunde mit längerem Namen GmbH & Co. KG ${i}`, lat: 51 + i * 0.01, lng: 7 + i * 0.01,
            strasse: 'Musterstraße 123', plz: '45136', ort: 'Essen', telefon: '0201 1234567', nummer: `K10${i}`
        }));
        const text = encodeTourPayload({ start: START, stops: many, tourName: 'Volle Tour', date: '2026-07-15', startTime: '08:00', visitMinutes: 45 });
        expect(new TextEncoder().encode(text).length).toBeLessThan(2300);
    });

    it('lehnt fremde und kaputte Inhalte ab', () => {
        expect(decodeTourPayload('https://example.com')).toBeNull();
        expect(decodeTourPayload(`${TOUR_QR_PREFIX}kein-json`)).toBeNull();
        expect(decodeTourPayload(`${TOUR_QR_PREFIX}{"v":2}`)).toBeNull();
        expect(decodeTourPayload(null)).toBeNull();
    });

    it('bewahrt die Demo-Herkunft beim QR-Transfer', () => {
        const demoStart = { ...START, demo: true, dataOrigin: 'tourfuchs-demo' };
        const demoStop = { ...STOPS[0], id: 'demo-1', demo: true, dataOrigin: 'tourfuchs-demo' };
        const decoded = decodeTourPayload(encodeTourPayload({ start: demoStart, stops: [demoStop] }));

        expect(decoded.start.demo).toBe(true);
        expect(decoded.stops[0].demo).toBe(true);
        expect(decoded.stops[0].dataOrigin).toBe('tourfuchs-demo');
    });

    it('Deep-Link-URL: Roundtrip über das Hash-Fragment (mit Umlauten)', () => {
        const encoded = encodeTourPayload({
            start: START, stops: STOPS, tourName: 'Tour Köln Süd/Ost',
            date: '2026-07-15', startTime: '08:30', visitMinutes: 45
        });
        const url = encodeTourUrl(encoded, 'https://tourfuchs.example/app/');
        expect(url).toContain(`#${TOUR_HASH_KEY}=`);
        expect(url.startsWith('https://tourfuchs.example/app/#')).toBe(true);

        // native Kamera liefert die volle URL an decodeTourPayload
        const decoded = decodeTourPayload(url);
        expect(decoded.tourName).toBe('Tour Köln Süd/Ost');
        expect(decoded.stops).toHaveLength(2);
        expect(decoded.stops[0].name).toBe('Autohaus Schmidt');

        // extractTourFromUrl liefert den TF1-Rohtext zurück
        expect(extractTourFromUrl(url)).toBe(encoded);
        expect(extractTourFromUrl('https://x.y/#other=1')).toBeNull();
    });

    it('Deep-Link-URL bleibt für eine volle Tour scanbar (< 2900 Byte)', () => {
        const many = Array.from({ length: MAX_QR_STOPS }, (_, i) => ({
            name: `Kunde mit längerem Namen GmbH & Co. KG ${i}`, lat: 51 + i * 0.01, lng: 7 + i * 0.01,
            strasse: 'Musterstraße 123', plz: '45136', ort: 'Essen', telefon: '0201 1234567', nummer: `K10${i}`
        }));
        const encoded = encodeTourPayload({ start: START, stops: many, tourName: 'Volle Tour', date: '2026-07-15', startTime: '08:00', visitMinutes: 45 });
        const url = encodeTourUrl(encoded, 'https://tourfuchs.example/');
        // QR im Byte-Modus, ECC L, fasst bis ~2953 Zeichen
        expect(new TextEncoder().encode(url).length).toBeLessThan(2900);
    });

    it('null ohne Start oder ohne verortete Stopps', () => {
        expect(encodeTourPayload({ start: null, stops: STOPS })).toBeNull();
        expect(encodeTourPayload({ start: START, stops: [{ name: 'x', lat: null, lng: null }] })).toBeNull();
    });
});

describe('matchStopsToCustomers', () => {
    const customers = [
        { id: 'c1', nummer: 'K100', name: 'Autohaus Schmidt', plz: '45136', lat: 51.5, lng: 7.1 },
        { id: 'c2', nummer: '', name: 'Bäckerei Ruhr', plz: '45127', lat: 51.6, lng: 7.2 }
    ];

    it('matcht über Kundennummer und über Name+PLZ', () => {
        const stops = [
            { name: 'ANDERER NAME', nummer: 'K100', plz: '' },
            { name: 'bäckerei ruhr', nummer: '', plz: '45127' },
            { name: 'Unbekannt', nummer: '', plz: '99999' }
        ];
        const { matched, unmatched } = matchStopsToCustomers(stops, customers);
        expect(matched.map((m) => m.customer.id)).toEqual(['c1', 'c2']);
        expect(unmatched).toHaveLength(1);
    });

    it('verwechselt Demo-Stopps nicht mit gleich nummerierten echten Kunden', () => {
        const demoStop = { name: 'TourFuchs Demo · Autohaus 0001', nummer: 'K100', plz: '45136', demo: true };
        const demoCustomer = { ...customers[0], id: 'demo-1', demo: true };
        const { matched } = matchStopsToCustomers([demoStop], [customers[0], demoCustomer]);
        expect(matched).toHaveLength(1);
        expect(matched[0].customer.id).toBe('demo-1');
    });

    describe('doppelte Kundennummer', () => {
        const twins = [
            { id: 'essen', nummer: 'K200', name: 'Elektro Kaiser', plz: '45127', lat: 51.4556, lng: 7.0116 },
            { id: 'koeln', nummer: 'K200', name: 'Elektro Kaiser', plz: '50667', lat: 50.9375, lng: 6.9603 }
        ];

        it('nimmt nicht einfach den letzten, sondern löst über Name + PLZ auf', () => {
            const stop = { name: 'Elektro Kaiser', nummer: 'K200', plz: '45127', lat: 51.4556, lng: 7.0116 };
            const { matched } = matchStopsToCustomers([stop], twins);
            expect(matched[0].customer.id).toBe('essen');
        });

        it('löst bei gleichem Namen und gleicher PLZ über die Lage auf', () => {
            const sameName = twins.map((c) => ({ ...c, plz: '45127' }));
            const stop = { name: 'Elektro Kaiser', nummer: 'K200', plz: '45127', lat: 50.9376, lng: 6.9604 };
            const { matched } = matchStopsToCustomers([stop], sameName);
            expect(matched[0].customer.id).toBe('koeln');
        });

        it('rät nicht, wenn nichts eindeutig ist – Stopp kommt mit eigenen Daten', () => {
            const stop = { name: 'Anderer Name', nummer: 'K200', plz: '', lat: 52.52, lng: 13.40 };
            const { matched, unmatched, ambiguous } = matchStopsToCustomers([stop], twins);
            expect(matched).toHaveLength(0);
            expect(unmatched).toEqual([stop]);
            expect(ambiguous).toBe(1);
        });
    });
});

describe('Übernommener Start behält Adresse und Herkunft', () => {
    it('decodiert Adresse und „von Hand gesetzt"', () => {
        const qr = encodeTourPayload({
            start: { lat: 51.45, lng: 7.01, label: 'Zuhause', strasse: 'Rosenweg 7', plz: '45127', ort: 'Essen', coordinateSource: 'map-pin' },
            stops: [{ name: 'A', lat: 51.5, lng: 7.1 }]
        });
        const decoded = decodeTourPayload(qr);
        expect(decoded.start).toMatchObject({ adresse: 'Rosenweg 7, 45127 Essen', coordinateSource: 'map-pin' });
        // Weitergeben eines übernommenen Starts behält die Adresse
        const again = decodeTourPayload(encodeTourPayload({ start: decoded.start, stops: decoded.stops }));
        expect(again.start.adresse).toBe('Rosenweg 7, 45127 Essen');
    });

    it('übernimmt beides in den Tourplan', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/tourQr.js'), 'utf8');
        const adopt = ui.slice(ui.indexOf('function adoptReceivedTour()'));
        expect(adopt).toContain('...(adresse ? { adresse } : {}),');
        expect(adopt).toContain('...(coordinateSource ? { coordinateSource } : {}),');
    });
});

describe('Gepackter Tour-Link (#tz=…) – dünnerer QR-Code', async () => {
    const share = await import('../src/features/tourShare.js');
    const stops = Array.from({ length: 12 }, (_, i) => ({
        name: `Autohaus Beispiel ${i}`, lat: 51.4 + i / 100, lng: 7.0 + i / 100,
        strasse: `Hauptstraße ${i + 1}`, plz: `4513${i % 10}`, ort: 'Essen', telefon: `0201 55500${i}`, nummer: `K-${1000 + i}`
    }));
    const encoded = share.encodeTourPayload({ start: { lat: 51.45, lng: 7.01, label: 'Büro' }, stops, tourName: 'Dienstag Süd' });

    it('packt und entpackt verlustfrei – inklusive Umlauten', async () => {
        const url = await share.encodeTourUrlPacked(encoded, 'https://tourfuchs.vercel.app/');
        expect(url).toContain('/#tz=');
        expect(share.hasSharedTour(url)).toBe(true);
        const tour = await share.decodeTourText(url);
        expect(tour.stops).toHaveLength(12);
        expect(tour.start.label).toBe('Büro');
        expect(tour.tourName).toBe('Dienstag Süd');
        expect(tour.stops[3].name).toBe('Autohaus Beispiel 3');
    });

    it('ist deutlich kürzer als der ungepackte Link', async () => {
        const packed = await share.encodeTourUrlPacked(encoded, 'https://tourfuchs.vercel.app/');
        const plain = share.encodeTourUrl(encoded, 'https://tourfuchs.vercel.app/');
        expect(packed.length).toBeLessThan(plain.length * 0.6);
    });

    it('liest weiterhin alte ungepackte Links (#t=…) und lehnt Kaputtes ab', async () => {
        const plain = share.encodeTourUrl(encoded, 'https://tourfuchs.vercel.app/');
        expect(share.hasSharedTour(plain)).toBe(true);
        expect((await share.decodeTourText(plain)).stops).toHaveLength(12);
        expect(await share.decodeTourText('https://tourfuchs.vercel.app/#tz=AAAA')).toBeNull();
        expect(share.hasSharedTour('https://tourfuchs.vercel.app/#top')).toBe(false);
    });
});
