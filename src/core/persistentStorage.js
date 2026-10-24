/**
 * Browser bitten, den Speicher dauerhaft zu halten (PO 24.10.2026).
 *
 * Kundendaten liegen nur im Browser (IndexedDB). Ohne diese Bitte darf der
 * Browser sie bei Speicherknappheit still verwerfen – Safari außerdem nach
 * sieben Tagen ohne Besuch, sofern TourFuchs nicht als App installiert ist.
 * Die Vercel-Zahlen (23.10.2026) zeigten mehr Erstdownloads der App als
 * Besuchstage; ein Teil davon kann geleerter Speicher sein.
 *
 * Gefragt wird erst, wenn eigene Kunden da sind (nicht bei Beispieldaten),
 * einmal je Sitzung. Chrome und Edge entscheiden still (installierte App,
 * häufige Nutzung); Firefox fragt den Nutzer einmal. Keine Verbindung nach
 * außen, keine Daten – nur ein Wunsch an den Browser.
 */
import { state, on } from './state.js';
import { isDemoDataset } from './demoSafety.js';

let asked = false;

/** @returns {Promise<'granted'|'denied'|'unsupported'>} */
export async function requestPersistentStorage(storage = globalThis.navigator?.storage) {
    if (typeof storage?.persist !== 'function') return 'unsupported';
    try {
        if (typeof storage.persisted === 'function' && await storage.persisted()) return 'granted';
        return await storage.persist() ? 'granted' : 'denied';
    } catch {
        return 'unsupported';
    }
}

function askOnceForOwnData() {
    if (asked || !state.customers.length || isDemoDataset(state.customers)) return;
    asked = true;
    requestPersistentStorage();
}

export function initPersistentStorage() {
    on('customers:changed', askOnceForOwnData);
    askOnceForOwnData();
}
