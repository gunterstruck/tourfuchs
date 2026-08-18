/**
 * Orte für die Tourplanung – Startpunkt und Ziel jenseits der Kundenliste.
 *
 * Der Startpunkt kannte zwei Formen: GPS-Standort oder Kunde. Wer seine Tour an
 * einer Mietwagenstation, am Büro oder am Hotel beginnt, hatte dafür keinen
 * Platz und musste den nächstgelegenen Kunden als Start missbrauchen – das
 * verschiebt Umkreisvorschläge und Streckenschätzung um genau die Entfernung,
 * die einen erst zum Startpunkt bringt.
 *
 * Zwei Quellen, beide **ohne Netz**:
 *  - **Eigene Orte**: vom Nutzer benannte Punkte ("SIXT Essen Hbf"), lokal
 *    gespeichert und mit den Kundendaten zusammen verschlüsselt.
 *  - **Ortsverzeichnis**: die ohnehin gebündelten ~8.300 PLZ-Zentroide mit
 *    Ortsnamen. Sie verorten bisher nur Kunden; hier tragen sie den Startpunkt.
 *
 * Ausdrücklich **nicht** hier: eine Adresssuche bei einem Drittdienst. Sie wäre
 * eine neue externe Verbindung (DoD Nr. 3) und steht an einem Tor in der
 * Roadmap. Alles in dieser Datei arbeitet mit lokal vorhandenen Daten.
 *
 * Und die Regel, die das Datenmodell zusammenhält: **Ein Ort ist ein Wegpunkt,
 * kein Kunde.** Er landet nie in `state.customers` – sonst verfälschte er
 * Kundenzähler, Umsatzsummen, Fälligkeiten und Gebietszuordnung.
 */

import { CONFIG } from '../core/config.js';
import { distanceKm, loadPlzCentroids, loadPlzPlaces } from '../services/geocode.js';

/** Ab zwei Zeichen wird gesucht – wie bei der bestehenden Kundensuche. */
export const MIN_PLACE_QUERY = 2;

/**
 * Zwei Orte gleichen Namens gelten als derselbe Ort, solange sie höchstens so
 * weit auseinanderliegen. Gesetzte Konvention, keine Messung: Sie trennt
 * "Neustadt" an der Ostsee von "Neustadt" in der Pfalz, hält aber die knapp 200
 * Postleitzahlen von Berlin zu einem Eintrag zusammen.
 */
export const PLACE_CLUSTER_KM = 25;

/** Ein wiedergefundener eigener Ort: gleicher Punkt bis auf Rundung. */
const SAME_POINT_KM = 0.05;

/**
 * Ersatzkoordinate im gebündelten PLZ-Datensatz: die geografische Mitte
 * Deutschlands, eingetragen für 94 Postleitzahlen, die die Quelle nicht
 * verorten konnte (darunter „11011 Berlin", das Postfach des Bundestags).
 *
 * Für die Kundenverortung bleibt der Datensatz, wie er ist – dort steht ein
 * Punkt neben dem Namen des Kunden und ist als grobe Lage erkennbar. Als
 * **Ortsvorschlag** wäre derselbe Punkt eine falsche Auskunft: „Berlin" läge
 * dann auf einem Acker bei Niederdorla, und die Umkreissuche rechnete von dort.
 * Solche Einträge kommen deshalb nicht ins Verzeichnis.
 */
const UNRESOLVED_CENTROID = { lat: 51.1657, lng: 10.4515 };
const UNRESOLVED_TOLERANCE = 1e-4;

/**
 * Achtung: `Number(null)` wäre 0 – ohne diese Prüfung würde aus einem fehlenden
 * Wert der Nullmeridian im Golf von Guinea. Dieselbe Falle steht schon in
 * `tourShare.js` kommentiert; sie gilt hier genauso.
 */
export const isCoordinate = (value) => Number.isFinite(
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value
);

const hasPoint = (p) => Boolean(p) && isCoordinate(p.lat) && isCoordinate(p.lng);

function isUnresolvedCentroid(lat, lng) {
    return Math.abs(lat - UNRESOLVED_CENTROID.lat) < UNRESOLVED_TOLERANCE
        && Math.abs(lng - UNRESOLVED_CENTROID.lng) < UNRESOLVED_TOLERANCE;
}

/**
 * Vergleichsform für Namen: Kleinschreibung, aufgelöste Umlaute, nur Buchstaben
 * und Ziffern. Damit findet "koln" auch "Köln" und "St. Wendel" auch "st wendel".
 */
export function normalizePlaceQuery(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * Zwei Schreibweisen desselben Namens: aufgelöst ("koeln") und abgestreift
 * ("koln"). Am Handy tippt niemand Umlaute konsequent, und beide Gewohnheiten
 * sind verbreitet – ein Verzeichnis, das nur eine kennt, wirkt kaputt.
 */
export function placeQueryVariants(text) {
    const expanded = normalizePlaceQuery(text);
    const stripped = normalizePlaceQuery(
        String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    return expanded === stripped ? [expanded] : [expanded, stripped];
}

/**
 * Eingefügte Koordinaten erkennen ("51.45, 7.01" oder "51,45 7,01").
 * Kostet nichts und beantwortet den Fall, den sonst nichts beantwortet: Ein
 * Kollege schickt einen Treffpunkt per Messenger.
 * Bewusst streng: mindestens zwei Nachkommastellen, sonst wäre "45127 12" eine
 * Koordinate statt einer Postleitzahl.
 */
export function parseCoordinateQuery(text) {
    const raw = String(text ?? '').trim();
    // Zuerst das eindeutige Format mit Punkt als Dezimaltrenner, dann das
    // deutsche mit Komma – dort muss der Trenner ein Leerzeichen sein, sonst
    // ist "51,45,7,01" nicht auflösbar.
    const parts = /^-?\d{1,3}\.\d{2,}\s*[,;\s]\s*-?\d{1,3}\.\d{2,}$/.test(raw)
        ? raw.split(/[,;\s]+/)
        : (/^-?\d{1,3},\d{2,}\s+-?\d{1,3},\d{2,}$/.test(raw) ? raw.replace(/,/g, '.').split(/\s+/) : null);
    if (!parts || parts.length !== 2) return null;
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
}

function meanPoint(entries) {
    const lat = entries.reduce((sum, e) => sum + e.lat, 0) / entries.length;
    const lng = entries.reduce((sum, e) => sum + e.lng, 0) / entries.length;
    return { lat, lng };
}

/**
 * Ortsverzeichnis aus den gebündelten PLZ-Daten bauen.
 *
 * Gleichnamige Postleitzahlen werden zu einem Eintrag zusammengefasst, aber nur
 * solange sie beieinanderliegen (siehe PLACE_CLUSTER_KM). Ohne diese Prüfung
 * läge der Mittelpunkt von "Neustadt" zwischen Ostsee und Pfalz – also nirgends.
 *
 * @param {{ centroids: Record<string,[number,number]>, places: Record<string,string> }} data
 * @returns {{ names: Array, byPlz: Map<string, {plz,name,lat,lng}> }}
 */
export function buildPlaceIndex({ centroids = {}, places = {} } = {}) {
    const byPlz = new Map();
    const groups = new Map(); // normalisierter Name -> Rohtreffer

    for (const [plz, name] of Object.entries(places)) {
        const hit = centroids[plz];
        if (!hit || !name) continue;
        if (isUnresolvedCentroid(hit[0], hit[1])) continue;
        const entry = { plz, name, lat: hit[0], lng: hit[1] };
        byPlz.set(plz, entry);
        const key = normalizePlaceQuery(name);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    }

    const names = [];
    for (const [key, entries] of groups) {
        entries.sort((a, b) => a.plz.localeCompare(b.plz));
        // Einfaches Ketten-Clustering: Jeder Eintrag kommt in den ersten Cluster,
        // dessen bisheriger Mittelpunkt nah genug liegt.
        const clusters = [];
        for (const entry of entries) {
            const cluster = clusters.find((c) => distanceKm(meanPoint(c), entry) <= PLACE_CLUSTER_KM);
            if (cluster) cluster.push(entry);
            else clusters.push([entry]);
        }
        for (const cluster of clusters) {
            const { lat, lng } = meanPoint(cluster);
            const plzList = cluster.map((e) => e.plz);
            names.push({
                key,
                keys: placeQueryVariants(cluster[0].name),
                name: cluster[0].name,
                lat,
                lng,
                plz: plzList[0],
                plzFrom: plzList[0],
                plzTo: plzList[plzList.length - 1],
                plzCount: plzList.length
            });
        }
    }
    // Größere Orte zuerst: Wer "Essen" tippt, meint sehr wahrscheinlich die Stadt.
    names.sort((a, b) => b.plzCount - a.plzCount || a.name.localeCompare(b.name, 'de'));
    return { names, byPlz };
}

let indexPromise = null;

/**
 * Ortsverzeichnis einmal je Sitzung bauen. Die beiden JSON-Dateien liegen
 * ohnehin im Bündel (die Kundenverortung braucht sie); hier kommt nur ein Index
 * darüber. Kein Netzaufruf über das hinaus, was die App schon lädt.
 */
export function loadPlaceIndex() {
    if (!indexPromise) {
        indexPromise = Promise.all([loadPlzCentroids(), loadPlzPlaces()])
            .then(([centroids, places]) => buildPlaceIndex({ centroids, places }))
            .catch((error) => {
                // Ohne Verzeichnis bleiben Kunden- und Koordinatensuche nutzbar.
                console.warn('Ortsverzeichnis konnte nicht aufgebaut werden:', error);
                indexPromise = null;
                return null;
            });
    }
    return indexPromise;
}

function placeDetail(entry) {
    if (entry.plzCount === 1) return `${entry.plz} · Ortsmitte`;
    return `${entry.plzFrom}–${entry.plzTo} · ${entry.plzCount} PLZ · Ortsmitte`;
}

/**
 * Ortsverzeichnis durchsuchen. Reine Ziffern gelten als Postleitzahl(-anfang),
 * alles andere als Ortsname.
 * @returns {Array<{kind,id,label,detail,lat,lng,plz,ort}>}
 */
export function searchGeoPlaces(query, index, limit = 5) {
    const raw = String(query ?? '').trim();
    if (raw.length < MIN_PLACE_QUERY || !index) return [];

    if (/^\d+$/.test(raw)) {
        const hits = [];
        for (const [plz, entry] of index.byPlz) {
            if (!plz.startsWith(raw)) continue;
            hits.push(entry);
            if (hits.length > 200) break;   // Deckel gegen "4" mit tausend Treffern
        }
        hits.sort((a, b) => a.plz.localeCompare(b.plz));
        return hits.slice(0, limit).map((entry) => ({
            kind: 'plz',
            id: `plz:${entry.plz}`,
            label: `${entry.plz} ${entry.name}`,
            detail: 'Postleitzahl · Ortsmitte',
            lat: entry.lat,
            lng: entry.lng,
            plz: entry.plz,
            ort: entry.name
        }));
    }

    const variants = placeQueryVariants(raw).filter(Boolean);
    if (!variants.length) return [];
    const scored = [];
    for (const entry of index.names) {
        let rank = Infinity;
        for (const key of entry.keys) {
            for (const q of variants) {
                if (key === q) rank = Math.min(rank, 0);
                else if (key.startsWith(q)) rank = Math.min(rank, 1);
                else if (key.includes(q)) rank = Math.min(rank, 2);
            }
        }
        if (rank === Infinity) continue;
        scored.push({ rank, entry });
        if (scored.length > 400) break;
    }
    scored.sort((a, b) => a.rank - b.rank || b.entry.plzCount - a.entry.plzCount);
    return scored.slice(0, limit).map(({ entry }) => ({
        kind: 'ort',
        id: `ort:${entry.key}:${entry.plz}`,
        label: entry.name,
        detail: placeDetail(entry),
        lat: entry.lat,
        lng: entry.lng,
        plz: entry.plz,
        ort: entry.name
    }));
}

/** Eigene Orte durchsuchen – Name, Ort und PLZ, wie bei der Kundensuche. */
export function searchOwnPlaces(query, ownPlaces = [], limit = 5) {
    const raw = String(query ?? '').trim();
    if (raw.length < MIN_PLACE_QUERY) return [];
    const variants = placeQueryVariants(raw).filter(Boolean);
    return (ownPlaces || [])
        .filter((place) => {
            if (!place) return false;
            const haystacks = placeQueryVariants(`${place.label} ${place.ort ?? ''} ${place.strasse ?? ''}`);
            return haystacks.some((hay) => variants.some((q) => hay.includes(q)))
                || String(place.plz ?? '').startsWith(raw);
        })
        .slice(0, limit)
        .map((place) => ({
            kind: 'eigener-ort',
            id: place.id,
            label: place.label,
            detail: [place.strasse, [place.plz, place.ort].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Eigener Ort',
            lat: place.lat,
            lng: place.lng,
            plz: place.plz ?? '',
            ort: place.ort ?? '',
            strasse: place.strasse ?? ''
        }));
}

/** Aus einem Suchtreffer wird ein Tourpunkt (Start oder Ziel). */
export function tourPointFromResult(result) {
    if (!hasPoint(result)) return null;
    const point = {
        lat: Number(result.lat),
        lng: Number(result.lng),
        label: result.label,
        plz: result.plz ?? '',
        ort: result.ort ?? ''
    };
    if (result.strasse) point.strasse = result.strasse;
    if (result.coordinateSource) point.coordinateSource = result.coordinateSource;
    if (result.kind === 'eigener-ort') point.placeId = result.id;
    return point;
}

/** Ein gespeicherter Ort wird zum Tourpunkt, ohne dabei zum Kunden zu werden. */
export function tourPointFromOwnPlace(place) {
    if (!hasPoint(place)) return null;
    return {
        lat: Number(place.lat),
        lng: Number(place.lng),
        label: place.label,
        placeId: place.id,
        strasse: place.strasse ?? '',
        plz: place.plz ?? '',
        ort: place.ort ?? '',
        coordinateSource: place.coordinateSource ?? ''
    };
}

let placeCounter = 0;

/** Neuen eigenen Ort anlegen. Der Name ist Pflicht – ohne ihn gäbe es nichts wiederzufinden. */
export function createOwnPlace({
    label, lat, lng, strasse = '', plz = '', ort = '', coordinateSource = ''
} = {}) {
    const name = String(label ?? '').trim();
    if (!name) return null;
    if (!isCoordinate(lat) || !isCoordinate(lng)) return null;
    placeCounter += 1;
    return {
        id: `ort-${Date.now().toString(36)}-${placeCounter.toString(36)}`,
        label: name,
        lat: Number(lat),
        lng: Number(lng),
        strasse: String(strasse ?? ''),
        plz: String(plz ?? ''),
        ort: String(ort ?? ''),
        coordinateSource: String(coordinateSource ?? ''),
        createdAt: new Date().toISOString()
    };
}

/** Ist dieser Tourpunkt schon als eigener Ort gemerkt? */
export function findOwnPlaceForPoint(ownPlaces = [], point) {
    if (!point) return null;
    if (point.placeId) {
        const byId = (ownPlaces || []).find((place) => place?.id === point.placeId);
        if (byId) return byId;
    }
    return (ownPlaces || []).find((place) => hasPoint(place)
        && distanceKm(place, point) <= SAME_POINT_KM
        && normalizePlaceQuery(place.label) === normalizePlaceQuery(point.label)) || null;
}

/**
 * Eigene Orte zusammenführen (Persistenz, sicherer Umzug). Vorhandene Orte
 * bleiben stehen: Ein empfangener Datensatz darf die Orte des Zielgeräts nicht
 * still überschreiben – das wäre genau die stille Verdrängung, die das
 * Gestaltprinzip verbietet.
 */
export function mergeOwnPlaces(existing = [], incoming = []) {
    const merged = [...(existing || [])].filter(Boolean);
    for (const place of (incoming || []).filter(Boolean)) {
        if (!hasPoint(place)) continue;
        const known = merged.some((p) => p.id === place.id
            || (normalizePlaceQuery(p.label) === normalizePlaceQuery(place.label)
                && distanceKm(p, place) <= SAME_POINT_KM));
        if (known) continue;
        if (merged.length >= CONFIG.tour.maxOwnPlaces) break;
        merged.push(place);
    }
    return merged;
}
