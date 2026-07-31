/**
 * Startabsichten der installierten App – reine Logik, DOM-frei und testbar.
 *
 * Die PWA kann auf drei Wegen mit einem Auftrag starten: über einen Shortcut
 * (Long-Press aufs Icon, `?start=…`), über eine geteilte Datei (`?share=1`,
 * abgelegt vom Service Worker) oder über eine im Betriebssystem geöffnete
 * Kundenliste (File Handling API). Hier wird nur entschieden, was gemeint ist;
 * ausgeführt wird es in der UI.
 */

export const SHARE_CACHE = 'tf-share-inbox';
export const SHARE_ENTRY = '/__shared-import';

const START_TARGETS = new Set(['tour', 'nearby', 'import']);

/**
 * @returns {{start: string|null, share: boolean}}
 */
export function readLaunchIntent(search = '') {
    const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    const start = params.get('start');
    return {
        start: START_TARGETS.has(start) ? start : null,
        share: params.get('share') === '1'
    };
}

/**
 * Nach dem Ausführen sollen die Startparameter aus der Adresse verschwinden,
 * damit ein Reload nicht denselben Auftrag wiederholt. Andere Parameter
 * (z. B. mobilePreview) bleiben erhalten.
 */
export function urlWithoutLaunchParams(href) {
    const url = new URL(href);
    url.searchParams.delete('start');
    url.searchParams.delete('share');
    return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Die vom Service Worker abgelegte Freigabe abholen und den Cache-Eintrag
 * löschen – eine geteilte Datei ist genau einmal gemeint.
 * @returns {Promise<File|null>}
 */
export async function takeSharedFile(cacheStorage = globalThis.caches) {
    if (!cacheStorage?.open) return null;
    try {
        const cache = await cacheStorage.open(SHARE_CACHE);
        const response = await cache.match(SHARE_ENTRY);
        if (!response) return null;
        await cache.delete(SHARE_ENTRY);
        // Über den ArrayBuffer statt über den Blob: Die Antwort kann aus einer
        // anderen Blob-Implementierung stammen als der File-Konstruktor der Seite.
        const buffer = await response.arrayBuffer();
        const type = response.headers.get('content-type') || 'application/octet-stream';
        let name = 'geteilte-liste.xlsx';
        try {
            name = decodeURIComponent(response.headers.get('x-tf-filename') || '') || name;
        } catch { /* kaputt kodierter Name: Standardname genügt */ }
        return new File([buffer], name, { type });
    } catch {
        return null;
    }
}

/**
 * Kann hier von Hand installiert werden, obwohl der Browser kein
 * `beforeinstallprompt` liefert?
 *
 * iOS kennt dieses Ereignis nicht – dort führt der Weg ausschließlich über
 * „Teilen → Zum Home-Bildschirm". Ohne diesen Zweig bekäme ein iPhone das
 * Angebot **nie** zu sehen: Die Bedingung `promptAvailable` ist dort dauerhaft
 * falsch. Genau das trifft den häufigsten Fall im Außendienst – die Tour landet
 * per QR-Scan im Handy-Browser, und niemand sagt, wie sie dort bleibt.
 *
 * @param {{userAgent?: string, maxTouchPoints?: number, standalone?: boolean}} env
 */
export function supportsManualInstall({ userAgent = '', maxTouchPoints = 0, standalone = false } = {}) {
    if (standalone) return false;
    const ua = String(userAgent);
    // iPadOS meldet sich seit 13 als „Macintosh"; die Touchpunkte verraten es.
    const iPadDesktopUa = /Macintosh/.test(ua) && Number(maxTouchPoints) > 1;
    return /iPad|iPhone|iPod/.test(ua) || iPadDesktopUa;
}

/**
 * Wann und wie darf die Installation angeboten werden? Nicht beim ersten Blick
 * auf Beispieldaten – erst wenn erkennbar mit eigenen Daten gearbeitet wird und
 * das Angebot einen Nutzen hat („jetzt aufs Handy holen"). Einmal abgelehnt
 * heißt abgelehnt.
 *
 * @returns {'prompt'|'manual'|'none'} `prompt` = der Browser installiert selbst,
 *   `manual` = nur eine Anleitung ist möglich (iOS), `none` = kein Angebot.
 */
export function installOfferMode({
    promptAvailable = false,
    manualInstallAvailable = false,
    installed = false,
    dismissed = false,
    hasOwnData = false,
    tourStopCount = 0,
    insideMobilePreview = false
} = {}) {
    if (installed || dismissed || insideMobilePreview) return 'none';
    if (!hasOwnData || tourStopCount === 0) return 'none';
    if (promptAvailable) return 'prompt';
    return manualInstallAvailable ? 'manual' : 'none';
}

/** Gibt es überhaupt ein Angebot? */
export function shouldOfferInstall(input = {}) {
    return installOfferMode(input) !== 'none';
}
