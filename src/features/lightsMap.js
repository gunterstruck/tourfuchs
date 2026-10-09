/**
 * Lichterkarte: jeder Kunde ein kleiner Lichtpunkt auf dunkler Karte.
 *
 * Die Ansicht ist ein Kartenstil (Panel → „Kartenstil" → „✨ Lichterkarte").
 * Sie ersetzt die Kunden-Kacheln und Stapel durch Punkte und zeigt so auf
 * einen Blick, wo Kunden sitzen, wo sie sich ballen und wo weiße Flecken sind.
 *
 *   Farbe   = immer warmes Gelb – wie Städte auf einem Nachtbild aus dem All.
 *             Bewusst ohne Besuchsstatus: Mit gealterten Besuchsdaten wäre
 *             sonst die ganze Karte rot, und das Bild verlöre seine Ruhe.
 *             Den Status zeigen Kunden-Popup, Tourplaner und „In der Nähe“.
 *   Größe   = Umsatz (große Kunden leuchten größer)
 *   Antippen öffnet den Kunden wie gewohnt.
 *
 * Hier liegen nur die reinen Regeln; gezeichnet wird in map.js.
 */

export const LIGHT_COLOR = '#fde047';

/** Ist dieser Kartenstil die Lichterkarte? */
export function isLightsBasemap(definition) {
    return Boolean(definition?.lights);
}

/**
 * Seit 09.10.2026 20 % kleiner: Bei vielen Tausend Kunden verschwammen die
 * Punkte zu Flächen. Antippen bleibt gut – der Renderer hat eigene Toleranz.
 */
export const LIGHT_SCALE = 0.8;

/** Grundgröße je Zoomstufe: weit draußen winzig, nah dran gut antippbar. */
export function baseLightRadius(zoom) {
    if (zoom < 7) return 1.4 * LIGHT_SCALE;
    if (zoom < 9) return 1.9 * LIGHT_SCALE;
    if (zoom < 12) return 2.6 * LIGHT_SCALE;
    return 3.4 * LIGHT_SCALE;
}

/**
 * Bezugsumsatz für die Größe: das 95. Perzentil statt des Maximums – ein
 * einzelner Ausreißer soll nicht alle anderen Punkte klein machen.
 */
export function revenueReference(revenues) {
    const values = revenues.map(Number).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    if (!values.length) return 0;
    return values[Math.min(values.length - 1, Math.floor(values.length * 0.95))];
}

/** Radius in Pixeln: Grundgröße × 0,8 … 1,7 je nach Umsatz. */
export function lightRadius(zoom, revenue, reference) {
    const value = Number(revenue);
    const share = reference > 0 && Number.isFinite(value) && value > 0 ? Math.sqrt(Math.min(value / reference, 1)) : 0;
    return Math.round(baseLightRadius(zoom) * (0.8 + 0.9 * share) * 100) / 100;
}

/** Leaflet-Stil eines Lichtpunkts. */
export function lightDotStyle({ zoom, revenue, reference }) {
    return {
        radius: lightRadius(zoom, revenue, reference),
        stroke: false,
        fill: true,
        fillColor: LIGHT_COLOR,
        fillOpacity: 0.95
    };
}
