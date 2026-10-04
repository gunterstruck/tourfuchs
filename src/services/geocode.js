/**
 * Geocoding-Service – ohne Schlüssel oder Benutzerkonto.
 *
 * Stufe 1 (sofort, offline): PLZ-Zentroide aus gebündeltem Lookup
 *   (~8.300 deutsche Postleitzahlen). Genauigkeit: Ortsmitte.
 * Stufe 2 (optional, online): exakte Adress-Geocodierung über
 *   Nominatim/OpenStreetMap – gedrosselt auf 1 Anfrage/Sekunde,
 *   Ergebnisse werden dauerhaft im Browser gecacht.
 */

import { CONFIG } from '../core/config.js';
import { isDemoCustomer } from '../core/demoSafety.js';
import { loadGeocodeCache, saveGeocodeCache } from './storage.js';

let plzCentroids = null;
let plzPlaces = null;

export async function loadPlzCentroids() {
    if (plzCentroids) return plzCentroids;
    const response = await fetch(CONFIG.plzCentroidsUrl);
    if (!response.ok) throw new Error('PLZ-Koordinaten konnten nicht geladen werden.');
    plzCentroids = await response.json();
    return plzCentroids;
}

let demoStreets = null;
/** Vorberechnete Straßen je PLZ; fehlt die Datei, bleiben die Beispielkunden auf der PLZ-Mitte. */
export async function loadDemoStreets() {
    if (demoStreets) return demoStreets;
    try {
        const response = await fetch(CONFIG.demoStreetsUrl);
        if (!response.ok) return {};
        const data = await response.json();
        demoStreets = data.streets || {};
    } catch {
        return {};
    }
    return demoStreets;
}

export async function loadPlzPlaces() {
    if (plzPlaces) return plzPlaces;
    const response = await fetch(CONFIG.plzPlacesUrl);
    if (!response.ok) throw new Error('PLZ-Ortsnamen konnten nicht geladen werden.');
    const data = await response.json();
    plzPlaces = data.places || data;
    return plzPlaces;
}

export async function enrichPlacesByPlz(customers) {
    const places = await loadPlzPlaces();
    let updated = 0;
    for (const customer of customers) {
        if (String(customer.ort ?? '').trim()) continue;
        const place = places[String(customer.plz ?? '').trim()];
        if (!place) continue;
        customer.ort = place;
        updated++;
    }
    return updated;
}

/**
 * Deterministischer "Jitter", damit mehrere Kunden mit derselben PLZ
 * nicht exakt übereinander liegen (~ +/- 500 m um den PLZ-Mittelpunkt).
 */
function jitterFor(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    const a = ((hash & 0xffff) / 0xffff - 0.5) * 0.009;
    const b = (((hash >> 16) & 0xffff) / 0xffff - 0.5) * 0.013;
    return [a, b];
}

/**
 * Kunden über PLZ verorten (mutiert die Objekte).
 * Bereits exakt georeferenzierte Kunden bleiben unangetastet.
 * @returns {{ located: number, missing: string[] }} fehlende PLZ
 */
export async function geocodeByPlz(customers) {
    const centroids = await loadPlzCentroids();
    let located = 0;
    const missing = new Set();

    for (const c of customers) {
        // Auch ältere Demo-Datensätze mit vermeintlich exakter Position werden
        // auf die lokal gebündelte PLZ-Position zurückgeführt.
        if (c.geo === 'exakt' && !isDemoCustomer(c)) continue;
        // Beispielkunden an einer vorberechneten Straße (ohne Hausnummer) bleiben dort.
        if (c.geo === 'strasse' && isDemoCustomer(c) && Number.isFinite(c.lat) && Number.isFinite(c.lng)) { located++; continue; }
        const hit = c.plz ? centroids[c.plz] : null;
        if (hit) {
            const [dLat, dLng] = jitterFor(c.id + c.name);
            c.lat = hit[0] + dLat;
            c.lng = hit[1] + dLng;
            c.geo = 'plz';
            located++;
        } else {
            c.lat = null;
            c.lng = null;
            c.geo = 'none';
            if (c.plz) missing.add(c.plz);
        }
    }
    return { located, missing: [...missing] };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function addressKey(c) {
    return `${c.strasse}|${c.plz}|${c.ort}`.toLowerCase();
}

function nominatimAddressParams(c) {
    return Object.fromEntries(Object.entries({
        street: String(c.strasse || '').trim(),
        postalcode: String(c.plz || '').trim(),
        city: String(c.ort || '').trim()
    }).filter(([, value]) => value));
}

/**
 * Exakte Adress-Geocodierung über Nominatim (OpenStreetMap).
 * Datenschutz-Audit: An Nominatim gehen ausschließlich neutrale Adressdaten
 * (Straße, PLZ, Ort) plus technische Suchparameter. Namen, Kundennummern,
 * Umsätze, Vertriebsgebiete oder sonstige Kundendaten werden nie übertragen.
 * Läuft sequenziell mit Drosselung; onProgress(done, total) für die UI.
 * Über das zurückgegebene Handle abbrechbar: handle.cancel()
 */
export function exactGeocodeCandidates(customers) {
    return (customers || []).filter((c) => !isDemoCustomer(c) && c.geo !== 'exakt' && c.strasse && (c.plz || c.ort));
}

/**
 * Kandidaten nach identischer Adresse gruppieren. Nominatim erlaubt nur ~1
 * Anfrage/Sekunde (öffentliche OSM-Policy) – Parallelisieren würde die IP
 * sperren. Die sichere Beschleunigung: jede eindeutige Adresse nur EINMAL
 * anfragen und das Ergebnis auf alle Kunden mit derselben Adresse anwenden.
 */
export function groupExactGeocodeCandidates(customers) {
    const groups = new Map(); // addressKey -> { sample, customers: [] }
    for (const c of exactGeocodeCandidates(customers)) {
        const key = addressKey(c);
        let group = groups.get(key);
        if (!group) { group = { key, sample: c, customers: [] }; groups.set(key, group); }
        group.customers.push(c);
    }
    return [...groups.values()];
}

// Jeder Lauf gehört zu einem Bestand. Wird der Bestand gelöscht, ersetzt oder
// gesperrt, zählt die Generation hoch: Alte Läufe brechen ab und dürfen danach
// weder Nominatim fragen noch den Adress-Cache schreiben – sonst stellte ein
// noch laufender Vorgang gerade gelöschte Adressen wieder her.
let generation = 0;
const activeRuns = new Set();

/** Alle laufenden Verortungen abbrechen; ihre Ergebnisse verfallen. */
export function abandonGeocodeRuns() {
    generation += 1;
    for (const run of activeRuns) run.cancel();
    activeRuns.clear();
}

export function geocodeExact(customers, onProgress) {
    const groups = groupExactGeocodeCandidates(customers);
    const myGeneration = generation;
    const current = () => myGeneration === generation;
    let cancelled = false;
    let controller = null;          // laufende Anfrage – „Anhalten" bricht sie sofort ab
    let wake = null;                // wartende Pause – „Anhalten" beendet sie sofort
    const handle = {
        cancel: () => {
            cancelled = true;
            controller?.abort();
            wake?.();
        },
        total: groups.length
    };
    activeRuns.add(handle);
    // Unterbrechbare Pause: Ein Tipp auf „Anhalten" soll nicht bis zu einer
    // halben Minute auf das Ende einer Wartezeit warten müssen.
    const pause = (ms) => new Promise((resolve) => {
        const timer = setTimeout(() => { wake = null; resolve(); }, ms);
        wake = () => { clearTimeout(timer); wake = null; resolve(); };
    });

    handle.run = (async () => {
        if (groups.length === 0) { activeRuns.delete(handle); return { updated: 0, failed: 0, cancelled: false, serviceDown: false }; }
        const cache = await loadGeocodeCache();
        let updated = 0;
        let failed = 0;
        let requestsMade = 0;
        let errorsInRow = 0;
        let serviceDown = false;

        for (let i = 0; i < groups.length; i++) {
            if (cancelled || !current()) break;
            const group = groups[i];

            let result = cache[group.key];
            if (result === undefined) {
                if (requestsMade > 0) await pause(CONFIG.nominatim.delayMs);
                if (cancelled) break;
                requestsMade++;
                try {
                    const addressParams = nominatimAddressParams(group.sample);
                    const params = new URLSearchParams({
                        format: 'jsonv2',
                        countrycodes: 'de',
                        limit: '1',
                        ...addressParams
                    });
                    controller = new AbortController();
                    const timer = setTimeout(() => controller?.abort(), CONFIG.nominatim.timeout);
                    const response = await fetch(`${CONFIG.nominatim.url}?${params}`, {
                        signal: controller.signal,
                        headers: { 'Accept-Language': 'de' }
                    });
                    clearTimeout(timer);
                    if (!response.ok) {
                        // 429 (zu viele Anfragen), 403 oder 5xx heißt „Dienst gerade
                        // nicht bereit" – nicht „Adresse unbekannt". Früher wurde das
                        // als „nicht gefunden" gespeichert und nie wieder versucht.
                        const error = new Error(`Nominatim ${response.status}`);
                        error.status = response.status;
                        throw error;
                    }
                    const json = await response.json();
                    result = json[0] ? { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) } : null;
                    cache[group.key] = result;
                    errorsInRow = 0;
                    if (!current()) break;
                    if (i % 10 === 0) await saveGeocodeCache(cache);
                } catch (error) {
                    result = undefined; // Netz- oder Dienstfehler: nicht als "nicht gefunden" cachen
                    if (cancelled) break;
                    errorsInRow += 1;
                    // Dreimal hintereinander keine Antwort: aufhören statt weiter zu
                    // klopfen. Beim nächsten Start oder nach einem Funkloch geht es
                    // weiter; der Cache hält alles bisher Gefundene.
                    if (errorsInRow >= 3) { serviceDown = true; break; }
                    // Bei „zu viele Anfragen" deutlich länger warten.
                    if (error?.status === 429) await pause(30000);
                } finally {
                    controller = null;
                }
            }

            // Ein Ergebnis gilt für alle Kunden mit exakt dieser Adresse.
            if (result) {
                for (const c of group.customers) {
                    c.lat = result.lat;
                    c.lng = result.lng;
                    c.geo = 'exakt';
                }
                updated += group.customers.length;
            } else if (result === null) {
                failed += group.customers.length;
            }
            onProgress?.(i + 1, groups.length);
        }

        activeRuns.delete(handle);
        if (!current()) return { updated: 0, failed: 0, cancelled: true, serviceDown: false };
        await saveGeocodeCache(cache);
        return { updated, failed, cancelled, serviceDown };
    })();

    return handle;
}

/** Haversine-Distanz in Kilometern */
export function distanceKm(a, b) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
