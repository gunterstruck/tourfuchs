/**
 * Die eine Definition von „mobil".
 *
 * TourFuchs kennt **genau zwei Gesichter**:
 *
 *   - **phone**   – Touransicht. Blatt unten, Außendienst, Karte und Tour.
 *   - **desktop** – Schreibtisch. Seitenleiste, alle Reiter, Gebietsplanung.
 *
 * Ein Tablet ist kein drittes Gesicht. Es ist beides, je nachdem, wie man es
 * hält: **hochkant Touransicht, quer Schreibtisch.**
 *
 * ## Warum dieses Modul existiert
 *
 * Bis Version 3.1 gab es keine Definition von „mobil", sondern vier
 * unabhängig gewachsene Schwellen: 560, 768/769, 900/901 und eine eigene
 * Blatt-Abfrage. Auf einem Galaxy Tab S6 Lite hochkant (~800 px) griffen
 * einige davon und andere nicht, und heraus kam ein Zwitter: Blatt-Geometrie
 * und Handy-Checkliste, aber Desktop-Kartenpopups, Desktop-Tourpanel und
 * offenes Cockpit.
 *
 * Schlimmer noch: **Hochkant war nicht gleich hochkant.** Ein 744-px-Tablet
 * fiel unter 768 und bekam ein sauberes Handy, ein 800-px-Tablet den Zwitter,
 * ein 1024-px-Tablet noch mehr davon. Dieselbe Haltung, drei Produkte – kein
 * Entwurf, sondern ein Nebeneinander von Schwellen, die niemand zusammen
 * gelesen hat.
 *
 * ## Warum die Orientierung entscheidet und nicht die Pixelbreite
 *
 * Die Breite in Pixeln ist dem Nutzer unbekannt und je Gerät verschieden –
 * genau daraus sind die drei Hochkant-Produkte entstanden. Die **Haltung**
 * dagegen bestimmt er selbst und sieht sie. „Quer ist Schreibtisch, hochkant
 * ist unterwegs" versteht man einmal und schlägt es nie wieder nach.
 *
 * Der Preis ist ehrlich zu benennen: Ein großes Tablet hochkant hätte Platz
 * fürs Cockpit und bekommt es trotzdem nicht. Das ist kein Verlust, sondern
 * eine Verlegung – die Funktion ist **eine Drehung entfernt**, und eine
 * Drehung ist billiger als ein drittes Layout im Kopf.
 */

/** Ab hier ist auch hochkant Schreibtisch (Desktopmonitor im Hochformat). */
export const TABLET_MAX_WIDTH = 1200;

/** Bis hier ist es immer Touransicht, egal wie gehalten. */
export const PHONE_MAX_WIDTH = 768;

/** Handy quer: breit, aber zu flach für den Schreibtisch. */
const SHORT_LANDSCAPE_MAX_WIDTH = 900;
const SHORT_LANDSCAPE_MAX_HEIGHT = 520;

/**
 * Die Regel als Medienabfrage – wortgleich zu `faceFor()`.
 * CSS und JavaScript müssen dieselbe Grenze ziehen, sonst entsteht genau der
 * Zwitter wieder, den dieses Modul beseitigt.
 */
export const PHONE_FACE_MEDIA = [
    `(max-width: ${PHONE_MAX_WIDTH}px)`,
    `(max-width: ${TABLET_MAX_WIDTH}px) and (orientation: portrait)`,
    `(max-width: ${SHORT_LANDSCAPE_MAX_WIDTH}px) and (max-height: ${SHORT_LANDSCAPE_MAX_HEIGHT}px)`
].join(', ');

const FALLBACK_QUERY = Object.freeze({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
});

/**
 * Das Gesicht zu einer Fenstergeometrie. Reine Funktion – der Rechenweg
 * gehört getestet, das Fenster liegt in der UI.
 *
 * @param {{width:number, height:number, portrait?:boolean}} viewport
 * @returns {'phone'|'desktop'}
 */
export function faceFor({ width, height, portrait } = {}) {
    const w = Number(width);
    const h = Number(height);
    if (!Number.isFinite(w)) return 'desktop';
    // Ohne ausdrückliche Angabe entscheidet das Seitenverhältnis.
    const isPortrait = typeof portrait === 'boolean'
        ? portrait
        : (Number.isFinite(h) ? h >= w : false);

    if (w <= PHONE_MAX_WIDTH) return 'phone';
    if (isPortrait && w <= TABLET_MAX_WIDTH) return 'phone';
    if (w <= SHORT_LANDSCAPE_MAX_WIDTH && Number.isFinite(h) && h <= SHORT_LANDSCAPE_MAX_HEIGHT) {
        return 'phone';
    }
    return 'desktop';
}

/** Die Medienabfrage für das Touransicht-Gesicht (oder eine tote Attrappe im Test). */
export function phoneFaceQuery() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return FALLBACK_QUERY;
    }
    return window.matchMedia(PHONE_FACE_MEDIA);
}

let cachedQuery = null;
function query() {
    if (!cachedQuery) cachedQuery = phoneFaceQuery();
    return cachedQuery;
}

/** @returns {'phone'|'desktop'} */
export function currentFace() {
    if (typeof window === 'undefined') return 'desktop';
    // Die Medienabfrage ist die Wahrheit – sie folgt derselben Zeichenkette
    // wie das CSS. `faceFor()` ist der testbare Zwilling, nicht die Quelle.
    return query().matches ? 'phone' : 'desktop';
}

/** Touransicht: Handy immer, Tablet hochkant. */
export function isPhoneUi() {
    return currentFace() === 'phone';
}

/** Schreibtisch: Desktop immer, Tablet quer. */
export function isDesktopUi() {
    return currentFace() === 'desktop';
}

/**
 * Eine geerbte Orientierungssperre lösen.
 *
 * Bis zum 26.07.2026 stand `orientation: 'portrait'` im PWA-Manifest. Eine
 * **installierte** PWA behält das Manifest ihres Installationszeitpunkts –
 * Geräte, auf denen TourFuchs vor diesem Datum eingerichtet wurde, hängen
 * deshalb bis heute im Hochformat fest, obwohl die Sperre im Quelltext längst
 * entfernt ist. Auf einem Tablet ist das der Unterschied zwischen „Schreibtisch
 * per Drehung" und „geht gar nicht": Nachgewiesen auf einem Galaxy Tab S6 Lite,
 * auf dem das System sauber drehte und nur TourFuchs nicht.
 *
 * `unlock()` nimmt genau diese Sperre zur Laufzeit zurück. Es ist bewusst
 * folgenlos, wo es nichts zu lösen gibt, und wird von Browsern ohne die
 * Schnittstelle stillschweigend übergangen. Eine Neuinstallation räumt die
 * Sperre endgültig weg; das hier hilft allen, die nicht neu installieren.
 */
export function releaseInheritedOrientationLock() {
    try {
        globalThis.screen?.orientation?.unlock?.();
    } catch {
        /* Ohne Sperre wirft manches Umfeld – das ist genau der gute Fall. */
    }
}

/**
 * Auf einen **Wechsel des Gesichts** hören – nicht auf jede Größenänderung.
 *
 * Ein Fenster, das breiter gezogen wird, ohne die Grenze zu überschreiten,
 * darf nichts zurücksetzen. Nur der Übergang zählt, und der Rückruf bekommt
 * das neue Gesicht, damit niemand es erneut abfragen muss.
 *
 * @param {(face:'phone'|'desktop')=>void} handler
 * @returns {() => void} Abmelder
 */
export function onFaceChange(handler) {
    const media = query();
    const listener = (event) => handler(event.matches ? 'phone' : 'desktop');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
}
