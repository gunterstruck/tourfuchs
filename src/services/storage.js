/**
 * Storage Service
 * IndexedDB für Kundendaten (Persistenz über Reloads) und Caches.
 * Alle Daten bleiben lokal im Browser – nichts verlässt das Gerät.
 *
 * Kundendaten liegen nie im Klartext (PO 24.10.2026, „Geräteschlüssel"):
 * Mit PIN-Tresor verschlüsselt der Tresor, sonst ein Schlüssel, den der
 * Browser einmalig erzeugt und nicht herausgibt. Wer die Datenbankdateien
 * kopiert, sieht nur Zeichensalat. Das entsperrte Gerät schützt das nicht –
 * dafür sind Gerätesperre und Firmenverwaltung da (oder zusätzlich die PIN).
 */

import { CONFIG } from '../core/config.js';
import { isEnabled, isUnlocked, encryptForStore, decryptFromStore, isEncryptedPayload } from './vault.js';
import { decryptJson, encryptJson } from './crypto.js';

const { dbName, dbVersion, storeName } = CONFIG.storage;

const KEYS = {
    dataset: 'kundendaten',
    geocodeCache: 'geocode-cache',
    settings: 'einstellungen',
    tours: 'gespeicherte-touren',
    scenarios: 'simulations-szenarien',
    deviceKey: 'geraeteschluessel'
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

/** Nur anlegen, wenn der Schlüssel noch fehlt. @returns {Promise<boolean>} angelegt? */
function addToCache(key, value) {
    return openDatabase().then((db) => new Promise((resolve, reject) => {
        let added = true;
        const tx = db.transaction([storeName], 'readwrite');
        const request = tx.objectStore(storeName).add(value, key);
        // Schon vorhanden: kein Fehler der Transaktion, nur „nicht angelegt".
        request.onerror = (event) => { added = false; event.preventDefault?.(); event.stopPropagation?.(); };
        tx.oncomplete = () => { db.close(); resolve(added); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    }));
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

// ---- Geräteschlüssel ----
//
// AES-256-GCM, nicht extrahierbar: Der Browser legt den Schlüssel als Objekt in
// derselben Datenbank ab und gibt seine Bytes nie heraus – auch nicht an
// TourFuchs. Daten und Schlüssel verschwinden deshalb immer gemeinsam.

/**
 * Immer den gespeicherten Schlüssel nehmen, nie einen nur im Arbeitsspeicher:
 * Löscht jemand die Browserdaten bei offener App oder starten zwei Fenster
 * gleichzeitig zum ersten Mal, passten Daten und Schlüssel sonst nicht mehr
 * zusammen. Neu angelegt wird nur, wenn noch keiner da ist (atomar per `add`).
 */
async function deviceKey() {
    const stored = await loadFromCache(KEYS.deviceKey);
    if (stored) return stored;
    const key = await globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    if (await addToCache(KEYS.deviceKey, key)) return key;
    return loadFromCache(KEYS.deviceKey);   // ein anderes Fenster war schneller
}

export function isDeviceSealed(value) {
    return Boolean(value && typeof value === 'object' && value.__dev);
}

/** Speicherform: mit Tresor dessen Schlüssel, sonst der Geräteschlüssel. */
async function seal(value) {
    if (isEnabled() && isUnlocked()) return encryptForStore(value);
    try {
        return { __dev: 1, ...(await encryptJson(await deviceKey(), value)) };
    } catch (error) {
        // Lieber unverschlüsselt speichern als die Arbeit des Tages verlieren.
        console.warn('Geräteschlüssel nicht verfügbar – Daten ohne Verschlüsselung gespeichert:', error);
        return value;
    }
}

const LOCKED = Symbol('gesperrt');

/** Lesbare Form; LOCKED bei gesperrtem Tresor. Wirft, wenn der Geräteschlüssel nicht passt. */
async function unseal(raw) {
    if (isEncryptedPayload(raw)) return isUnlocked() ? decryptFromStore(raw) : LOCKED;
    if (isDeviceSealed(raw)) return decryptJson(await deviceKey(), raw);
    return raw;
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

// Ließ sich ein gespeicherter Bestand in dieser Sitzung nicht öffnen, wird er
// nicht überschrieben: Vielleicht klappt es beim nächsten Start wieder.
let unreadableDataset = false;

async function writeDataset(dataset) {
    try {
        // Aktiver, gesperrter Tresor: niemals im Klartext schreiben – lieber gar nicht.
        if (isEnabled() && !isUnlocked()) return false;
        if (unreadableDataset) return false;
        await saveToCache(KEYS.dataset, await seal(dataset));
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
        // Mit Tresor nur bei entsperrtem Tresor lesbar.
        const value = await unseal(raw);
        return value === LOCKED ? null : value;
    } catch (error) {
        unreadableDataset = true;
        console.warn('Kundendaten konnten nicht geladen werden:', error);
        return null;
    }
}

export function clearDataset() {
    return inOrder(async () => {
        await removeFromCache(KEYS.dataset);
        unreadableDataset = false;
    });
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
    await saveToCache(KEYS[key], await seal(value));
    return true;
}

async function loadProtected(key, fallback) {
    const raw = (await loadFromCache(KEYS[key])) ?? null;
    if (raw == null) return fallback;
    const value = await unseal(raw);
    return value === LOCKED ? fallback : value;
}

/**
 * Nebenspeicher im aktuellen Tresor-Zustand neu schreiben: nach dem
 * Einrichten bzw. Entsperren mit dem Tresor, nach dem Deaktivieren (DEK noch
 * im Speicher, Metadaten schon weg) mit dem Geräteschlüssel.
 */
export function reprotectStores() {
    return inOrder(rewriteProtectedStores);
}

/** Wie ein Wert gerade liegt: 'vault' · 'device' · 'plain'. */
function sealKind(raw) {
    if (isEncryptedPayload(raw)) return 'vault';
    return isDeviceSealed(raw) ? 'device' : 'plain';
}

/** Wie er liegen soll; null = gesperrter Tresor, nichts anfassen. */
function targetKind() {
    if (!isEnabled()) return 'device';
    return isUnlocked() ? 'vault' : null;
}

async function rewriteStored(storeKey) {
    const raw = (await loadFromCache(storeKey)) ?? null;
    const target = targetKind();
    if (raw == null || !target || sealKind(raw) === target) return;
    const value = await unseal(raw);
    if (value === LOCKED) return;
    await saveToCache(storeKey, await seal(value));
}

async function rewriteProtectedStores() {
    for (const key of PROTECTED_KEYS) {
        try {
            await rewriteStored(KEYS[key]);
        } catch (error) {
            console.warn(`Speicher „${key}" konnte nicht umgeschlüsselt werden:`, error);
        }
    }
}

/**
 * Altbestand aus der Zeit vor dem Geräteschlüssel (Klartext) einmalig
 * verschlüsseln – Kundendaten und Nebenspeicher. Beim Start aufrufen.
 */
export function sealStoredData() {
    return inOrder(async () => {
        if (unreadableDataset) return;
        try {
            await rewriteStored(KEYS.dataset);
        } catch (error) {
            console.warn('Kundendaten konnten nicht verschlüsselt werden:', error);
        }
        await rewriteProtectedStores();
    });
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
        return await saveProtected('tours', tours);
    } catch (error) {
        console.warn('Touren konnten nicht gespeichert werden:', error);
        return false;
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
