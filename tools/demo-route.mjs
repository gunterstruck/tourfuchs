/**
 * Straßenroute der Tour-Demo – einmal vorberechnet, nie zur Laufzeit.
 *
 * Die Live-Demo „Deine Tour, Schritt für Schritt" endet mit der echten
 * Straßenroute. Ohne Zustimmung darf TourFuchs keine Koordinaten an OSRM
 * schicken – also wird die Route der Demo-Tour hier **einmal** berechnet und
 * als `public/geodata/demo-routes.json` mit der App ausgeliefert.
 *
 * Die Tour selbst rechnet `src/features/demoTour.js` – dieselben Funktionen,
 * die auch die Vorführung nutzt. Zwei Routen werden abgelegt:
 *  1. Start → Ziel (daran sucht „Entlang der Tour" die Kunden)
 *  2. die fertige, optimierte Tour
 *
 * Aufruf (nach Änderungen an Beispielkunden, Straßen oder demoTour.js):
 *   node tools/demo-route.mjs
 *
 * Routendaten © OpenStreetMap-Mitwirkende (ODbL), berechnet mit OSRM.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createDemoCustomers } from '../src/services/excel.js';
import { applyDemoStreets } from '../src/core/demoSafety.js';
import { buildPlaceIndex } from '../src/features/places.js';
import { routingKey } from '../src/services/routing.js';
import { demoCorridorPoints, demoDestination, demoHomePoint, demoTourPoints, demoVia } from '../src/features/demoTour.js';

const OSRM = process.env.OSRM_URL || 'https://router.project-osrm.org/route/v1/driving';
const OUT = 'public/geodata/demo-routes.json';
const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));

const centroids = read('public/geodata/plz-centroids.json');
const placesRaw = read('public/geodata/plz-places.json');
const places = placesRaw.places || placesRaw;
const customers = createDemoCustomers(centroids, places);
applyDemoStreets(customers, read('public/geodata/demo-streets.json').streets);
const index = buildPlaceIndex({ centroids, places });

const pointOf = (p) => ({ lat: Number(p.lat ?? p[0]), lng: Number(p.lng ?? p[1]) });

// Douglas-Peucker in Grad – ~5 m Toleranz reichen für die Kartenansicht.
function simplify(points, tolerance = 0.00005) {
    if (points.length < 3) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
        const [a, b] = stack.pop();
        const [ay, ax] = points[a];
        const [by, bx] = points[b];
        let best = -1, bestD = 0;
        for (let i = a + 1; i < b; i++) {
            const [py, px] = points[i];
            const dx = bx - ax, dy = by - ay;
            const len2 = dx * dx + dy * dy || 1e-12;
            const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
            const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            if (d > bestD) { bestD = d; best = i; }
        }
        if (bestD > tolerance) { keep[best] = 1; stack.push([a, best], [best, b]); }
    }
    return points.filter((_, i) => keep[i]);
}

async function route(points) {
    const coords = points.map(pointOf).map((p) => `${p.lng},${p.lat}`).join(';');
    const params = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'false', alternatives: 'false' });
    const response = await fetch(`${OSRM}/${coords}?${params}`, { headers: { 'user-agent': 'TourFuchs-demo-route/1.0' } });
    if (!response.ok) throw new Error(`OSRM ${response.status}`);
    const data = await response.json();
    const best = data?.routes?.[0];
    if (data?.code !== 'Ok' || !best) throw new Error(`OSRM ${data?.code}`);
    const latLngs = simplify(best.geometry.coordinates.map(([lng, lat]) => [lat, lng]))
        .map(([lat, lng]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
    return {
        key: routingKey(points),
        provider: 'OSRM',
        distanceKm: Math.round(best.distance / 100) / 10,
        durationMin: Math.round(best.duration / 60),
        latLngs
    };
}

const home = demoHomePoint(index);
const dest = demoDestination(customers, home);
if (!home || !dest) throw new Error('Keine Demo-Tour gefunden.');

const corridor = await route(demoCorridorPoints(home, dest));
await new Promise((resolve) => setTimeout(resolve, 1500));
const via = demoVia(customers, home, dest, { corridorPath: corridor.latLngs.map(([lat, lng]) => ({ lat, lng })) });
if (via.length < 2) throw new Error('Zu wenige Kunden entlang der Strecke.');
const tour = await route(demoTourPoints(home, via, dest));

writeFileSync(OUT, `${JSON.stringify({
    source: 'Routendaten © OpenStreetMap-Mitwirkende (ODbL), berechnet mit OSRM – vorberechnet mit tools/demo-route.mjs',
    home: home.label,
    destination: dest.id,
    via: via.map((c) => c.id),
    routes: [corridor, tour]
})}\n`);
console.log(`${home.label} → ${via.map((c) => c.ort).join(' → ')} → ${dest.ort}: ${tour.distanceKm} km, ca. ${tour.durationMin} min, ${tour.latLngs.length} Punkte → ${OUT}`);
