import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDemoCustomers } from '../src/services/excel.js';
import { applyDemoStreets } from '../src/core/demoSafety.js';
import { buildPlaceIndex } from '../src/features/places.js';
import { routingKey } from '../src/services/routing.js';
import { demoCorridorPoints, demoDestination, demoHomePoint, demoTourPoints, demoVia } from '../src/features/demoTour.js';

const read = (file) => JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));

describe('Tour-Demo: Tour und vorberechnete Straßenroute passen zusammen', () => {
    const centroids = read('public/geodata/plz-centroids.json');
    const placesRaw = read('public/geodata/plz-places.json');
    const places = placesRaw.places || placesRaw;
    const customers = createDemoCustomers(centroids, places);
    applyDemoStreets(customers, read('public/geodata/demo-streets.json').streets);
    const file = read('public/geodata/demo-routes.json');

    const home = demoHomePoint(buildPlaceIndex({ centroids, places }));
    const dest = demoDestination(customers, home);
    const corridor = file.routes.find((route) => route.key === routingKey(demoCorridorPoints(home, dest)));
    const via = demoVia(customers, home, dest, { corridorPath: corridor?.latLngs.map(([lat, lng]) => ({ lat, lng })) });

    it('startet zu Hause in Dortmund und fährt zu einem Kunden quer durchs Revier', () => {
        expect(home.label).toBe('Dortmund');
        expect(dest.ort).toBe(file.destination && customers.find((c) => c.id === file.destination)?.ort);
        expect(via).toHaveLength(2);
        expect(via.map((c) => c.id)).toEqual(file.via);
    });

    it('findet für Start → Ziel und die fertige Tour je eine vorberechnete Route', () => {
        // Schlägt dieser Test fehl, haben sich Beispielkunden, Straßen oder
        // demoTour.js geändert: `node tools/demo-route.mjs` neu laufen lassen.
        expect(corridor).toBeTruthy();
        const tour = file.routes.find((route) => route.key === routingKey(demoTourPoints(home, via, dest)));
        expect(tour).toBeTruthy();
        expect(tour.latLngs.length).toBeGreaterThan(50);
        expect(tour.distanceKm).toBeGreaterThan(40);
    });
});
