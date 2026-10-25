import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { adoptStopPosition, matchStopsToCustomers, hasValidCoords } from '../src/features/tourShare.js';
import { googleMapsLegs, googleMapsCapacity } from '../src/features/tour.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const stop = (i) => ({ name: `Stopp ${i}`, lat: 51 + i / 100, lng: 7 + i / 100 });
const START = { lat: 51.45, lng: 7.01, label: 'Zuhause' };

describe('QR-Stopp behält seine gültige Position', () => {
    it('null, leer und ungültig sind keine Koordinaten', () => {
        expect(hasValidCoords({ lat: null, lng: null })).toBe(false);
        expect(hasValidCoords({ lat: '', lng: ' ' })).toBe(false);
        expect(hasValidCoords({ lat: 'abc', lng: 7 })).toBe(false);
        expect(hasValidCoords({})).toBe(false);
        expect(hasValidCoords({ lat: 0, lng: 0 })).toBe(true);
        expect(hasValidCoords({ lat: '51.4', lng: '7.0' })).toBe(true);
    });

    it('ordnet den Kunden ohne Position zu – die Übernahme gibt ihm die QR-Position', () => {
        const local = { id: 'k1', nummer: 'K1', name: 'Ohne Position', lat: null, lng: null };
        const { matched } = matchStopsToCustomers([{ ...stop(1), nummer: 'K1' }], [local]);
        expect(matched[0].customer.id).toBe('k1');
        expect(adoptStopPosition(local, { ...stop(1), nummer: 'K1' })).toBe(true);
        expect([local.lat, local.lng]).toEqual([51.01, 7.01]);
        expect(read('src/ui/tourQr.js')).toContain('if (adoptStopPosition(customer, stop)) positioned += 1;');
    });
});

describe('QR-Übernahme: genauere übertragene Anschrift schlägt lokale PLZ-Mitte (Prüfbefund 25.10.2026)', () => {
    const plzCenter = () => ({ id: 'k1', nummer: 'K1', name: 'Muster GmbH', strasse: '', plz: '45136', ort: 'Essen', lat: 51.43, lng: 7.03, geo: 'plz' });
    const received = { name: 'Muster GmbH', nummer: 'K1', lat: 51.4412, lng: 7.0456, adresse: 'Testweg 12, 45136 Essen', plz: '45136' };

    it('übernimmt Position und Straße, damit die Navigation zur Anschrift führt', () => {
        const local = plzCenter();
        expect(adoptStopPosition(local, received)).toBe(true);
        expect([local.lat, local.lng, local.geo, local.strasse]).toEqual([51.4412, 7.0456, 'exakt', 'Testweg 12']);
    });

    it('überschreibt keine genaue lokale Position', () => {
        const local = { ...plzCenter(), strasse: 'Hauptstraße 1', lat: 51.45, lng: 7.01, geo: 'exakt' };
        expect(adoptStopPosition(local, received)).toBe(false);
        expect([local.lat, local.strasse]).toEqual([51.45, 'Hauptstraße 1']);
    });

    it('ist auch der Stopp nur PLZ-genau, bleibt alles wie es ist', () => {
        const local = plzCenter();
        expect(adoptStopPosition(local, { ...received, adresse: '45136 Essen' })).toBe(false);
        expect(local.lat).toBe(51.43);
    });

    it('ein gesetzter Pin gilt auch ohne Straße', () => {
        const local = plzCenter();
        expect(adoptStopPosition(local, { ...received, adresse: '45136 Essen', coordinateSource: 'map-pin' })).toBe(true);
        expect(local.coordinateSource).toBe('map-pin');
    });
});

describe('Navigation aus dem QR-Empfang lässt keinen Stopp weg', () => {
    const urlStops = (link) => {
        const params = new URL(link).searchParams;
        return [...(params.get('waypoints') ? params.get('waypoints').split('|') : []), params.get('destination')];
    };

    it('Rundreise mit 12 Stopps: zwei vollständige Teilstrecken, die letzte zurück zum Start', () => {
        const stops = Array.from({ length: 12 }, (_, i) => stop(i + 1));
        const legs = googleMapsLegs(START, stops, true);
        expect(legs.length).toBe(2);
        const visited = legs.flatMap((leg) => urlStops(leg.link));
        for (const s of stops) expect(visited).toContain(`${s.lat},${s.lng}`);
        expect(visited[visited.length - 1]).toBe(`${START.lat},${START.lng}`);
        // Teil 2 beginnt dort, wo Teil 1 endet
        expect(new URL(legs[1].link).searchParams.get('origin')).toBe(urlStops(legs[0].link).at(-1));
        expect(legs.map((l) => [l.from, l.to])).toEqual([[1, 10], [11, 12]]);
    });

    it('passt die Tour in einen Link, bleibt es einer', () => {
        expect(googleMapsLegs(START, Array.from({ length: 9 }, (_, i) => stop(i)), true)).toHaveLength(1);
        expect(googleMapsLegs(START, Array.from({ length: 10 }, (_, i) => stop(i)), false)).toHaveLength(1);
        expect(googleMapsCapacity(true)).toBe(9);
        expect(googleMapsCapacity(false)).toBe(10);
    });

    it('der Empfangsdialog bietet Teilstrecken an statt still zu kürzen', () => {
        const ui = read('src/ui/tourQr.js');
        expect(ui).toContain('const legs = googleMapsLegs(received.start, received.stops, received.roundTrip);');
        expect(ui).toContain('renderLegButtons(legs);');
        expect(ui).not.toContain('googleMapsLink(received.start');
    });
});
