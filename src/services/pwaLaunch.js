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
 * Wann darf die Installation angeboten werden? Nicht beim ersten Blick auf
 * Beispieldaten – erst wenn erkennbar mit eigenen Daten gearbeitet wird und
 * das Angebot einen Nutzen hat („jetzt aufs Handy holen"). Einmal abgelehnt
 * heißt abgelehnt.
 */
export function shouldOfferInstall({
    promptAvailable = false,
    installed = false,
    dismissed = false,
    hasOwnData = false,
    tourStopCount = 0,
    insideMobilePreview = false
} = {}) {
    if (!promptAvailable || installed || dismissed || insideMobilePreview) return false;
    return hasOwnData && tourStopCount > 0;
}
