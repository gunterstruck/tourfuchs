/**
 * Lasso: eine Fläche auf der Karte mit der Hand umfahren.
 *
 * Der Umkreis im Tourplaner beantwortet dieselbe Frage – aber als Formular:
 * Bezirk, Startpunkt, Regler, dann erscheint ein Knopf. Das Lasso ist **eine
 * Bewegung** um das, was man ohnehin gerade ansieht. Für den ersten Eindruck
 * ist das der Unterschied zwischen „verstanden" und „das will ich".
 *
 * Es kann außerdem etwas, das ein Umkreis prinzipiell nicht kann: eine
 * **unrunde Fläche**. Gewerbegebiet, eine Flussseite, ein Autobahnkorridor.
 * Vertriebsgebiete sind keine Kreise; ein Radius nimmt immer zu viel oder zu
 * wenig mit.
 *
 * Gerechnet wird durchgehend in **Bildschirm-Pixeln des Kartenfensters**, nicht
 * in Längen- und Breitengraden. Der Nutzer zeichnet, was er sieht – und in
 * Pixeln gibt es weder Datumsgrenze noch Mercator-Verzerrung.
 *
 * Reine Geometrie, ohne DOM und ohne Leaflet.
 */

/** Unter dieser Fläche (px²) war es ein Tippen und kein Zug. */
export const MIN_LASSO_AREA = 900;
/** Weniger Punkte ergeben keine Fläche, die jemand gemeint haben kann. */
export const MIN_LASSO_POINTS = 3;
/** Zeichentoleranz: alles darunter ist Handzittern, kein Formwille. */
export const SIMPLIFY_TOLERANCE = 4;

/**
 * Punkt-in-Polygon nach dem Strahlensatz (ray casting).
 *
 * Bewusst selbst geschrieben statt als Abhängigkeit: Es sind zwölf Zeilen, und
 * ein Plugin dafür wäre Ballast in einer App, die offline startbar bleiben soll.
 */
export function pointInPolygon(point, polygon) {
    if (!point || !Array.isArray(polygon) || polygon.length < MIN_LASSO_POINTS) return false;
    const { x, y } = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        // Kreuzt die waagerechte Halbgerade nach rechts diese Kante?
        const crosses = (yi > y) !== (yj > y)
            && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (crosses) inside = !inside;
    }
    return inside;
}

/** Flächeninhalt nach der Gaußschen Trapezformel, immer positiv. */
export function polygonArea(polygon = []) {
    if (polygon.length < MIN_LASSO_POINTS) return 0;
    let sum = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        sum += (polygon[j].x + polygon[i].x) * (polygon[j].y - polygon[i].y);
    }
    return Math.abs(sum / 2);
}

/**
 * Zeichenspur ausdünnen: Ein Finger liefert hunderte Punkte pro Sekunde, für
 * die Form zählen davon vielleicht dreißig.
 */
export function simplifyPath(points = [], tolerance = SIMPLIFY_TOLERANCE) {
    const out = [];
    for (const point of points) {
        const last = out[out.length - 1];
        if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= tolerance) out.push(point);
    }
    // Der letzte Punkt gehört immer dazu – sonst fehlt der Form der Schluss.
    const last = points[points.length - 1];
    if (last && out[out.length - 1] !== last) out.push(last);
    return out;
}

/**
 * Taugt die gezeichnete Spur als Auswahl?
 *
 * Vor der Kamera muss das beim ersten Mal sitzen. Ein versehentliches Tippen
 * darf deshalb nichts auslösen – aber alles, was erkennbar ein Zug war, soll
 * gelten, auch wenn die Form krumm ist.
 */
export function isUsableLasso(polygon = []) {
    return polygon.length >= MIN_LASSO_POINTS && polygonArea(polygon) >= MIN_LASSO_AREA;
}

/** Mittelpunkt der Fläche – Bezugspunkt für „welcher Kunde ist am nächsten?". */
export function polygonCentroid(polygon = []) {
    if (polygon.length === 0) return null;
    const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
}

/**
 * Wer liegt in der Fläche?
 *
 * @param {object[]} customers  Kandidaten (nur verortete werden geprüft)
 * @param {object[]} polygon    geschlossene Fläche in Fensterpixeln
 * @param {Function} project    Kunde -> { x, y } im selben Pixelraum
 * @returns {object[]} Treffer, vom Flächenmittelpunkt aus nach außen sortiert
 */
export function customersInLasso(customers = [], polygon = [], project) {
    if (typeof project !== 'function' || !isUsableLasso(polygon)) return [];
    const centroid = polygonCentroid(polygon);
    const hits = [];
    for (const customer of customers) {
        if (!customer || customer.lat === null || customer.lng === null) continue;
        const point = project(customer);
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        if (!pointInPolygon(point, polygon)) continue;
        hits.push({ customer, distance: Math.hypot(point.x - centroid.x, point.y - centroid.y) });
    }
    // Von der Mitte nach außen: Das Gebiets-Briefing nimmt die ersten zwölf,
    // und „am nächsten an dem, was ich markiert habe" ist die richtige Reihung.
    return hits.sort((a, b) => a.distance - b.distance).map((hit) => hit.customer);
}

/** Beschriftung des Auswahlstreifens – nennt die Zahl, nicht die Technik. */
export function lassoSelectionLabel(count) {
    if (count === 0) return 'Keine Kunden in dieser Fläche';
    return `${count} ${count === 1 ? 'Kunde' : 'Kunden'} ausgewählt`;
}

/**
 * Wer wandert bei „zur Tour" wirklich in die Tour?
 *
 * Zwei Regeln, beide erklärbar:
 *  - **Ohne Häkchen gilt die ganze Auswahl.** Das ist der schnelle Weg und war
 *    schon immer so; ein leerer Häkchensatz darf nicht plötzlich „niemand"
 *    heißen.
 *  - **Wer schon in der Tour steht, kommt nicht ein zweites Mal hinein.** Sonst
 *    steht derselbe Kunde doppelt in der Liste und die Route fährt ihn zweimal
 *    an.
 *
 * Bewusst hier und nicht in der Oberfläche: Es ist eine Regel, keine Anzeige.
 */
export function tourAdditions(selection = [], picked = null, stops = []) {
    const marks = picked instanceof Set ? picked : new Set(picked || []);
    const inTour = new Set(stops);
    const base = marks.size > 0 ? selection.filter((c) => marks.has(c?.id)) : selection;
    return base.filter((c) => c && !inTour.has(c.id));
}

/** Aufschrift des Tour-Knopfes: „Alle zur Tour" oder „3 zur Tour". */
export function tourAdditionLabel(count, hasPicks) {
    return hasPicks ? `🚩 ${count} zur Tour` : '🚩 Alle zur Tour';
}
