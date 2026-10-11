/**
 * Bibliotheken, die erst bei Bedarf laden (Release 17.1b: Excel, QR-Leser,
 * QR-Erzeuger) – mit sichtbarem „bitte warten" und Vorladen im Leerlauf.
 *
 * PO, 11.10.2026: „Beim Laden oder Export kann es dauern. Der Nutzer denkt
 * schon, alles ist eingefroren." Deshalb:
 *  - Nach dem Start lädt TourFuchs die Bibliotheken nacheinander im Leerlauf
 *    vor. Der Service Worker hält sie ohnehin bereit – im Normalfall kostet
 *    das keine zusätzlichen Daten (beim allerersten Besuch kann doppelt
 *    geladen werden), nur Rechenzeit, wenn gerade nichts zu tun ist.
 *  - Wer schneller klickt, sieht „Excel wird vorbereitet …" (erscheint erst
 *    nach kurzer Verzögerung – was schnell geht, blinkt nicht auf).
 */
import { hideBusy, showBusy } from './busyIndicator.js';
import { t } from '../core/i18n.js';

const loaded = new Map();
function once(key, loader) {
    if (!loaded.has(key)) {
        // Scheitert das Laden (offline vor dem ersten Zwischenspeichern), beim
        // nächsten Versuch erneut probieren statt den Fehler zu behalten.
        loaded.set(key, loader().catch((error) => { loaded.delete(key); throw error; }));
    }
    return loaded.get(key);
}

export const loadExcelModule = () => once('excel', () => import('../services/excel.js'));
export const loadQrReaderModule = () => once('qr-reader', () => import('jsqr'));
export const loadQrWriterModule = () => once('qr-writer', () => import('qrcode'));

/** Excel-Funktionen holen; dauert es, steht „Excel wird vorbereitet …" da. */
export async function excelModule() {
    showBusy('excel', t('busy.excel'));
    try {
        return await loadExcelModule();
    } finally {
        hideBusy('excel');
    }
}

let prefetchStarted = false;
/** Einmal nach dem Start: Bibliotheken nacheinander im Leerlauf vorladen. */
export function prefetchWhenIdle({ idle = globalThis.requestIdleCallback, search = globalThis.location?.search || '' } = {}) {
    // Die Handy-Vorschau am Desktop läuft im selben Fenster – dort lädt die
    // echte App bereits vor; ein zweites Mal kostete nur Rechenzeit.
    if (prefetchStarted || new URLSearchParams(search).has('mobilePreview')) return;
    prefetchStarted = true;
    const queue = [loadExcelModule, loadQrReaderModule, loadQrWriterModule];
    const later = (fn) => (typeof idle === 'function' ? idle(fn, { timeout: 10_000 }) : setTimeout(fn, 2_000));
    const next = () => {
        const load = queue.shift();
        if (!load) return;
        load().catch(() => {}).finally(() => later(next));
    };
    later(next);
}
