/**
 * Die Tour der Live-Demo „Deine Tour, Schritt für Schritt" – rein rechnerisch.
 *
 * Die Vorführung erzählt eine Tagestour so, wie sie jemand wirklich plant:
 * Auf der Karte einen Kunden finden und als **Ziel** setzen, den **Start zu
 * Hause** wählen, dann nachsehen, wer **auf dem Weg** liegt, zwei davon
 * mitnehmen, optimieren – und am Ende die **echte Straßenroute** sehen.
 *
 * Damit die Straßenroute ohne Anfrage an OSRM erscheinen kann, muss die Tour
 * vorher feststehen: Dieselben Funktionen rechnen sie hier in der App und in
 * `tools/demo-route.mjs`, das die Route einmal vorberechnet
 * (`public/geodata/demo-routes.json`). Ein Test prüft, dass beides
 * zusammenpasst.
 */
import { distanceKm } from '../services/geocode.js';
import { searchGeoPlaces, tourPointFromResult } from './places.js';
import { optimizeOrder, suggestAlongRoute } from './tour.js';

/** „Zu Hause" – ein Ort im Ruhrgebiet, von dem aus sich eine Strecke lohnt. */
export const DEMO_HOME_QUERY = 'Dortmund';
/** Das Ziel liegt im Westen des Ruhrgebiets – eine Fahrt quer durchs Revier. */
const DEST_TARGET = { lat: 51.435, lng: 6.765 };   // Duisburg
const DEST_MIN_KM = 35;
const DEST_MAX_KM = 70;
/** Mitnehmen: je ein Kunde bei etwa einem und zwei Dritteln der Strecke. */
const VIA_FRACTIONS = [1 / 3, 2 / 3];
const VIA_MIN_GAP_KM = 6;
const VIA_MAX_OFFSET_KM = 3;

const located = (customers) => (customers || []).filter((c) => Number.isFinite(Number(c?.lat)) && Number.isFinite(Number(c?.lng)));

/** Der Startpunkt „zu Hause" aus dem Ortsverzeichnis – genau wie ein Treffer im Startfeld. */
export function demoHomePoint(placeIndex) {
    const [hit] = searchGeoPlaces(DEMO_HOME_QUERY, placeIndex, 1);
    return hit ? tourPointFromResult(hit) : null;
}

/** Ein Zielkunde in angemessener Entfernung – bevorzugt im Westen des Reviers. */
export function demoDestination(customers, home) {
    if (!home) return null;
    const pool = located(customers).filter((c) => {
        const km = distanceKm(home, c);
        return km >= DEST_MIN_KM && km <= DEST_MAX_KM;
    });
    return pool.sort((a, b) => distanceKm(DEST_TARGET, a) - distanceKm(DEST_TARGET, b)
        || String(a.id).localeCompare(String(b.id)))[0] || null;
}

/** Wie weit ein Punkt entlang der Strecke Start → Ziel liegt (0 … 1). */
function fractionAlong(home, dest, point) {
    const dx = dest.lng - home.lng;
    const dy = dest.lat - home.lat;
    const len2 = dx * dx + dy * dy;
    return len2 > 0 ? ((point.lng - home.lng) * dx + (point.lat - home.lat) * dy) / len2 : 0;
}

/**
 * Zwei Kunden, die wirklich auf dem Weg liegen – aus genau der Liste, die die
 * App im Modus „Entlang der Tour" zeigt, gut über die Strecke verteilt.
 * @param {Array|null} corridorPath  Straßenverlauf Start → Ziel (falls bekannt)
 */
export function demoVia(customers, home, dest, { corridorKm = 50, corridorPath = null } = {}) {
    if (!home || !dest) return [];
    const exclude = new Set([dest.id]);
    const entries = suggestAlongRoute(home, [dest], located(customers), corridorKm, exclude, false, false, corridorPath);
    // „Auf dem Weg" heißt: kaum Umweg. Die Liste reicht weiter, gewählt wird nah an der Strecke.
    const close = entries.filter((entry) => entry.km <= VIA_MAX_OFFSET_KM);
    const list = (close.length >= 2 ? close : entries).map((entry) => entry.customer);
    const chosen = [];
    for (const target of VIA_FRACTIONS) {
        const pick = list
            .filter((c) => !chosen.includes(c))
            .filter((c) => distanceKm(home, c) >= VIA_MIN_GAP_KM && distanceKm(dest, c) >= VIA_MIN_GAP_KM)
            .filter((c) => chosen.every((other) => distanceKm(other, c) >= VIA_MIN_GAP_KM))
            .sort((a, b) => Math.abs(fractionAlong(home, dest, a) - target) - Math.abs(fractionAlong(home, dest, b) - target)
                || String(a.id).localeCompare(String(b.id)))[0];
        if (pick) chosen.push(pick);
    }
    return chosen;
}

/** Die Punkte der fertigen, optimierten Tour – so, wie die Karte sie zeichnet. */
export function demoTourPoints(home, via, dest) {
    const ordered = optimizeOrder(home, via, dest);
    return [home, ...ordered, dest].map((p) => [p.lat, p.lng]);
}

/** Die Punkte, entlang derer die App die Vorschläge sucht (Start → Ziel). */
export function demoCorridorPoints(home, dest) {
    return [home, dest].map((p) => ({ lat: p.lat, lng: p.lng }));
}
