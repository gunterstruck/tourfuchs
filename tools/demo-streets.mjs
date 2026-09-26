/**
 * Straßen für die Beispielkunden – einmal vorberechnet, nie zur Laufzeit.
 *
 * Die Beispielkunden liegen sonst alle auf der Mitte ihrer Postleitzahl. Das
 * sieht auf der Karte künstlich aus: gleichmäßige Punkte statt Kunden an
 * Straßen. Dieses Werkzeug fragt OpenStreetMap (Overpass) **einmal** nach
 * benannten Straßen nahe jeder PLZ-Mitte, die ein Beispielkunde belegt, und
 * schreibt das Ergebnis nach `public/geodata/demo-streets.json`.
 *
 * - Nur der Straßenname, **keine Hausnummer** – die Beispielkunden bleiben
 *   erkennbar erfunden.
 * - Die App lädt die Datei wie die PLZ-Daten vom eigenen Server; zur Laufzeit
 *   geht keine Anfrage an OpenStreetMap.
 * - Daten © OpenStreetMap-Mitwirkende, ODbL.
 *
 * Aufruf (nur nach Änderungen an den Beispielkunden nötig):
 *   node tools/demo-streets.mjs
 *
 * Die Anfragen gehen gebündelt und nacheinander raus, mit Pause dazwischen –
 * so wie es die Nutzungsregeln des öffentlichen Overpass-Servers verlangen.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createDemoCustomers } from '../src/services/excel.js';

const ENDPOINT = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const BATCH = 80;
const PAUSE_MS = 8000;
const HIGHWAYS = '^(residential|living_street|tertiary|unclassified|secondary|pedestrian)$';
const OUT = 'public/geodata/demo-streets.json';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const centroids = read('public/geodata/plz-centroids.json');
const placesRaw = read('public/geodata/plz-places.json');
const places = placesRaw.places || placesRaw;

// Wie viele Straßen braucht jede PLZ? So viele, wie dort Beispielkunden liegen.
const need = new Map();
for (const customer of createDemoCustomers(centroids, places)) {
    need.set(customer.plz, (need.get(customer.plz) || 0) + 1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Straßen mit Hausnummer im Namen („Straße 12") scheiden aus – der Punkt ist ja,
// dass kein Beispielkunde eine Hausnummer trägt.
const usable = (name) => name && !/\d+\s*[a-z]?$/i.test(name.trim());

async function query(plzList, radius) {
    const parts = plzList.map((plz) => {
        const [lat, lng] = centroids[plz];
        return `way(around:${radius},${lat},${lng})[highway~"${HIGHWAYS}"][name];out tags center 12;make marker plz="${plz}";out;`;
    });
    const body = `[out:json][timeout:180];${parts.join('')}`;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'TourFuchs-demo-streets/1.0' },
            body: `data=${encodeURIComponent(body)}`
        }).catch((error) => ({ ok: false, status: String(error) }));
        if (response.ok) {
            const text = await response.text();
            if (text.startsWith('{')) return JSON.parse(text).elements;
        }
        console.log(`  Versuch ${attempt} fehlgeschlagen (${response.status}) – warte …`);
        await sleep(PAUSE_MS * attempt * 2);
    }
    throw new Error('Overpass antwortet nicht.');
}

function collect(elements) {
    // Die Ausgabe ist eine Folge: Straßen einer PLZ, dann ihr Marker.
    const found = new Map();
    let pending = [];
    for (const el of elements) {
        if (el.type === 'marker') {
            found.set(el.tags.plz, pending);
            pending = [];
        } else if (el.center && usable(el.tags?.name)) {
            pending.push({ name: el.tags.name.trim(), lat: el.center.lat, lng: el.center.lon });
        }
    }
    return found;
}

function choose(plz, candidates) {
    const [lat, lng] = centroids[plz];
    const byName = new Map();
    for (const c of candidates) {
        const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
        if (!byName.has(c.name) || d < byName.get(c.name).d) byName.set(c.name, { ...c, d });
    }
    return [...byName.values()]
        .sort((a, b) => a.d - b.d || a.name.localeCompare(b.name, 'de'))
        .slice(0, need.get(plz))
        .map((c) => [c.name, Math.round(c.lat * 1e5) / 1e5, Math.round(c.lng * 1e5) / 1e5]);
}

const result = {};
let todo = [...need.keys()].sort();
for (const radius of [300, 1200, 3000]) {
    if (todo.length === 0) break;
    console.log(`Umkreis ${radius} m: ${todo.length} PLZ`);
    const missing = [];
    for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const found = collect(await query(batch, radius));
        for (const plz of batch) {
            const streets = choose(plz, found.get(plz) || []);
            if (streets.length >= need.get(plz)) result[plz] = streets;
            else {
                if (streets.length) result[plz] = streets;
                missing.push(plz);
            }
        }
        console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
        await sleep(PAUSE_MS);
    }
    todo = missing;
}

const sorted = Object.fromEntries(Object.keys(result).sort().map((plz) => [plz, result[plz]]));
writeFileSync(OUT, `${JSON.stringify({
    source: 'OpenStreetMap-Mitwirkende, ODbL – vorberechnet mit tools/demo-streets.mjs',
    streets: sorted
})}\n`);
const total = Object.values(sorted).reduce((sum, list) => sum + list.length, 0);
console.log(`${Object.keys(sorted).length} PLZ, ${total} Straßen → ${OUT}; ohne ausreichend Straßen: ${todo.length}`);
