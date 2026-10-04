/**
 * Storage Service
 * IndexedDB für Kundendaten (Persistenz über Reloads) und Caches.
 * Alle Daten bleiben lokal im Browser – nichts verlässt das Gerät.
 */

import { CONFIG } from '../core/config.js';
import { isEnabled, isUnlocked, encryptForStore, decryptFromStore, isEncryptedPayload } from './vault.js';

const { dbName, dbVersion, storeName } = CONFIG.storage;

const KEYS = {
    dataset: 'kundendaten',
    geocodeCache: 'geocode-cache',
    settings: 'einstellungen',
    tours: 'gespeicherte-touren',
    scenarios: 'simulations-szenarien'
};

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
    });
}

export async function saveToCache(key, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function loadFromCache(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readonly');
        const request = tx.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

export async function removeFromCache(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

// ---- Schreibreihenfolge ----
//
// Alle Schreibvorgänge für Datensatz und Nebenspeicher laufen nacheinander.
// Sonst konnte ein verschlüsselter Speichervorgang, der kurz vor dem
// Deaktivieren des Tresors begann (Speichertimer), **nach** dem Klartext
// landen: Die Daten lagen dann verschlüsselt mit einem verworfenen Schlüssel –
// nach dem Neuladen waren sie weg. Jeder Vorgang entscheidet erst, wenn er an
// der Reihe ist, ob verschlüsselt wird.
let writeTail = Promise.resolve();
function inOrder(task) {
    const run = writeTail.then(task, task);
    writeTail = run.catch(() => {});
    return run;
}

// ---- Kundendaten ----

export function saveDataset(dataset) {
    return inOrder(() => writeDataset(dataset));
}

async function writeDataset(dataset) {
    try {
        // Aktiver, gesperrter Tresor: niemals im Klartext schreiben – lieber gar nicht.
        if (isEnabled() && !isUnlocked()) return false;
        const payload = (isEnabled() && isUnlocked()) ? await encryptForStore(dataset) : dataset;
        await saveToCache(KEYS.dataset, payload);
        return true;
    } catch (error) {
        console.warn('Kundendaten konnten nicht gespeichert werden:', error);
        return false;
    }
}

export async function loadDataset() {
    try {
        const raw = (await loadFromCache(KEYS.dataset)) ?? null;
        if (!raw) return null;
        if (isEncryptedPayload(raw)) {
            // Verschlüsselt gespeichert – nur bei entsperrtem Tresor lesbar.
            return isUnlocked() ? await decryptFromStore(raw) : null;
        }
        return raw;
    } catch (error) {
        console.warn('Kundendaten konnten nicht geladen werden:', error);
        return null;
    }
}

export function clearDataset() {
    return inOrder(() => removeFromCache(KEYS.dataset));
}

/** Gibt es überhaupt einen gespeicherten Datensatz? (unabhängig von Ver-/Entschlüsselung) */
export async function hasStoredDataset() {
    try {
        const raw = await loadFromCache(KEYS.dataset);
        return raw != null;
    } catch {
        return false;
    }
}

// ---- Geschützte Nebenspeicher ----
//
// Der Tresor verschlüsselt nicht nur den Kundenbestand: Auch der Adress-Cache
// der Verortung (vollständige Kundenadressen mit Koordinaten), gespeicherte
// Touren (Start/Ziel mit Adresse – oft die Heimatadresse) und
// Simulations-Szenarien (Kunden-IDs) liegen bei aktivem Tresor nur
// verschlüsselt. Gleiche Regeln wie beim Datensatz: gesperrt wird nichts
// geschrieben, und ein Altbestand im Klartext bleibt lesbar, bis er beim
// nächsten Speichern (oder `reprotectStores()`) verschlüsselt wird.

export const PROTECTED_KEYS = Object.freeze(['geocodeCache', 'tours', 'scenarios']);

function saveProtected(key, value) {
    return inOrder(() => writeProtected(key, value));
}

async function writeProtected(key, value) {
    if (isEnabled() && !isUnlocked()) return false;
    const payload = (isEnabled() && isUnlocked()) ? await encryptForStore(value) : value;
    await saveToCache(KEYS[key], payload);
    return true;
}

async function loadProtected(key, fallback) {
    const raw = (await loadFromCache(KEYS[key])) ?? null;
    if (raw == null) return fallback;
    if (isEncryptedPayload(raw)) return isUnlocked() ? await decryptFromStore(raw) : fallback;
    return raw;
}

/**
 * Nebenspeicher im aktuellen Tresor-Zustand neu schreiben: nach dem
 * Einrichten bzw. Entsperren verschlüsselt, nach dem Deaktivieren (DEK noch im
 * Speicher, Metadaten schon weg) im Klartext.
 */
export function reprotectStores() {
    return inOrder(rewriteProtectedStores);
}

async function rewriteProtectedStores() {
    for (const key of PROTECTED_KEYS) {
        try {
            const raw = (await loadFromCache(KEYS[key])) ?? null;
            if (raw == null) continue;
            const encrypted = isEncryptedPayload(raw);
            const shouldEncrypt = isEnabled() && isUnlocked();
            if (encrypted === shouldEncrypt) continue;
            if (encrypted && !isUnlocked()) continue;
            const value = encrypted ? await decryptFromStore(raw) : raw;
            await saveToCache(KEYS[key], shouldEncrypt ? await encryptForStore(value) : value);
        } catch (error) {
            console.warn(`Speicher „${key}" konnte nicht umgeschlüsselt werden:`, error);
        }
    }
}

/** Nach einem Tresor-Wipe: verschlüsselte Nebenspeicher sind ohne Schlüssel wertlos. */
export function clearProtectedStores() {
    return inOrder(removeProtectedStores);
}

async function removeProtectedStores() {
    for (const key of PROTECTED_KEYS) {
        try { await removeFromCache(KEYS[key]); } catch { /* IndexedDB evtl. nicht verfügbar */ }
    }
}

// ---- Geocode-Cache (Nominatim-Ergebnisse) ----

export async function loadGeocodeCache() {
    try {
        return await loadProtected('geocodeCache', {});
    } catch {
        return {};
    }
}

export async function saveGeocodeCache(cache) {
    try {
        await saveProtected('geocodeCache', cache);
    } catch (error) {
        console.warn('Geocode-Cache konnte nicht gespeichert werden:', error);
    }
}

// ---- Einstellungen (Gebietsebene, Filter, Tour) ----

export async function saveSettings(settings) {
    try {
        await saveToCache(KEYS.settings, settings);
    } catch (error) {
        console.warn('Einstellungen konnten nicht gespeichert werden:', error);
    }
}

export async function loadSettings() {
    try {
        return (await loadFromCache(KEYS.settings)) ?? null;
    } catch {
        return null;
    }
}

// ---- Gespeicherte Touren ----

export async function loadTours() {
    try {
        return await loadProtected('tours', []);
    } catch {
        return [];
    }
}

export async function saveTours(tours) {
    try {
        await saveProtected('tours', tours);
    } catch (error) {
        console.warn('Touren konnten nicht gespeichert werden:', error);
    }
}

// ---- Simulations-Szenarien ----
//
// Ein Szenario ist ein benannter Schnappschuss einer laufenden Was-wäre-wenn-
// Simulation: Zuordnungen (Kunden-ID -> Zielwert), keine Adressen. Weil die
// Kunden-IDs aber Kundennummern sein können, liegt es wie Touren und
// Adress-Cache bei aktivem Tresor verschlüsselt.

export async function loadScenarios() {
    try {
        return await loadProtected('scenarios', []);
    } catch {
        return [];
    }
}

export async function saveScenarios(scenarios) {
    try {
        return await saveProtected('scenarios', scenarios);
    } catch (error) {
        console.warn('Szenarien konnten nicht gespeichert werden:', error);
        return false;
    }
}
