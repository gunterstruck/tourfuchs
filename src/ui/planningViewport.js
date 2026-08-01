/**
 * Verfügbarkeit der Schreibtisch-Flächen (Gebietsplanung, Cockpit, Simulation,
 * Gebiets-Editor).
 *
 * Bis Version 3.1 hing das an einer eigenen Pixelbreite (≥ 769) und damit an
 * einer anderen Grenze als die Geometrie. Auf einem Tablet hochkant war das
 * Cockpit deshalb offen, während das Panel schon als Blatt unten lag – der
 * Zwitter, den `core/viewport.js` beschreibt.
 *
 * Jetzt gilt eine Grenze für beides: Schreibtisch-Flächen gibt es im
 * Schreibtisch-Gesicht. Auf dem Tablet heißt das quer – eine Drehung entfernt.
 */

import { currentFace, isDesktopUi, phoneFaceQuery, TABLET_MAX_WIDTH, faceFor } from '../core/viewport.js';

export { TABLET_MAX_WIDTH };

/**
 * @deprecated Nur noch für Tests und Altaufrufe. Die Breite allein entscheidet
 * nicht mehr – ohne Höhe/Orientierung nimmt `faceFor()` Querformat an.
 */
export function isDesktopPlanningWidth(width) {
    return Number.isFinite(Number(width)) && faceFor({ width }) === 'desktop';
}

/** Sind Gebietsplanung, Cockpit und Simulation gerade erreichbar? */
export function desktopPlanningAvailable() {
    return typeof window === 'undefined' || isDesktopUi();
}

/**
 * Die Abfrage, die anschlägt, sobald die Touransicht gilt. Flächen, die dort
 * nicht hingehören, hängen sich hier ein und schließen sich selbst.
 */
export function mobilePlanningMediaQuery() {
    return phoneFaceQuery();
}

export { currentFace };
