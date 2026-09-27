/**
 * Adressgenaue Verortung – auf allen Geräten, nicht nur am Schreibtisch.
 *
 * Bisher gab es dafür nur den Knopf „Adressen exakt verorten" im Reiter
 * „Daten". Den Reiter gibt es am Handy nicht: Wer dort importierte, blieb für
 * immer auf der PLZ-Mitte – für eine Tour zu ungenau.
 *
 * Jetzt fragt TourFuchs nach einem Import mit Straßenadressen **einmal**, ob
 * adressgenau verortet werden soll, und merkt sich die Antwort. Bei „Ja" läuft
 * die Verortung danach von selbst im Hintergrund: nach jedem Import, beim
 * Start und sobald das Gerät wieder online ist. Einmal gefundene Adressen
 * liegen im Cache und werden nie erneut angefragt.
 *
 * Die eine Ausnahme vom „alles bleibt lokal": Straße, PLZ und Ort gehen an
 * OpenStreetMap (Nominatim). Deshalb nur nach ausdrücklichem Ja – und die
 * Rückfrage sagt genau, was übertragen wird und was nicht.
 */
import { state, on, emit, datasetSnapshot } from '../core/state.js';
import { isEnabled as vaultEnabled, isUnlocked as vaultUnlocked, onVault } from '../services/vault.js';
import { groupExactGeocodeCandidates, geocodeExact } from '../services/geocode.js';
import { saveDataset } from '../services/storage.js';
import { showToast } from './toast.js';

export const EXACT_GEOCODE_PREF_KEY = 'tf_exact_geocode';   // 'yes' | 'no'
// Der freie Dienst erlaubt etwa eine Anfrage pro Sekunde.
const SECONDS_PER_ADDRESS = 1.1;

let handle = null;
let pausedThisVisit = false;
let progress = { done: 0, total: 0 };
// Wie der letzte Lauf endete – für die Statuszeile in der Info.
let lastOutcome = null;   // null | 'done' | 'paused' | 'offline' | 'service' | 'locked'
// Die Handy-Vorschau am Schreibtisch ist eine zweite Kopie der App im selben
// Browser. Sie teilt die gespeicherte Einstellung – verorten darf trotzdem nur
// die echte App, sonst liefen zwei Läufe und fragten Adressen doppelt an.
const insideMobilePreview = new URLSearchParams(globalThis.location?.search || '').has('mobilePreview');

function store() {
    try { return globalThis.localStorage || null; } catch { return null; }
}

/** 'yes', 'no' oder null (noch nie gefragt). */
export function exactGeocodePreference() {
    const value = store()?.getItem(EXACT_GEOCODE_PREF_KEY);
    return value === 'yes' || value === 'no' ? value : null;
}

export function setExactGeocodePreference(value) {
    try { store()?.setItem(EXACT_GEOCODE_PREF_KEY, value); } catch { /* Speicherung ist optional */ }
    syncInfoToggle();
}

export function isExactGeocodingRunning() {
    return !!handle;
}

/** Eindeutige Adressen, die noch nicht adressgenau verortet sind. */
export function pendingExactAddresses(customers = state.customers) {
    return groupExactGeocodeCandidates(customers).length;
}

/** Grobe Dauer in Minuten für die Rückfrage – ehrlich aufgerundet. */
export function estimateMinutes(addresses) {
    return Math.max(1, Math.ceil((addresses * SECONDS_PER_ADDRESS) / 60));
}

function renderStatus(done, total) {
    progress = { done, total };
    const box = document.getElementById('geocode-status');
    if (box) {
        box.hidden = !handle;
        const count = box.querySelector('b');
        if (count) count.textContent = `${done}/${total}`;
    }
    renderInfoState();
    emit('geocode:progress', { running: !!handle, done, total });
}

/** Zahlen für die Statuszeile: nur eigene Kunden mit Straße. */
export function exactGeocodeSummary(customers = state.customers) {
    const own = (customers || []).filter((c) => c && c.demo !== true && c.dataOrigin !== 'tourfuchs-demo' && c.strasse);
    return {
        withStreet: own.length,
        exact: own.filter((c) => c.geo === 'exakt').length,
        pending: pendingExactAddresses(customers)
    };
}

/**
 * Statuszeile unter dem Schalter in der Info. Sie beantwortet die Frage, die
 * der Schalter allein offenlässt: Tut sich gerade etwas – und wie weit ist es?
 */
function renderInfoState() {
    const box = document.getElementById('exact-geocode-state');
    if (!box) return;
    const text = box.querySelector('.geocode-state-text');
    const now = box.querySelector('#exact-geocode-now');
    const preference = exactGeocodePreference();
    const { withStreet, exact, pending } = exactGeocodeSummary();
    let line = '';
    let offerNow = false;
    if (handle) {
        line = `⏳ Läuft gerade: ${progress.done} von ${progress.total} Adressen geprüft – etwa eine pro Sekunde.`;
    } else if (withStreet === 0) {
        line = state.customers.length ? 'Keine eigenen Kunden mit Straße – sie liegen auf der Mitte ihrer PLZ.' : '';
    } else if (preference !== 'yes') {
        line = `Aus – ${exact} von ${withStreet} Kunden mit Straße sind adressgenau, die übrigen liegen auf der PLZ-Mitte.`;
    } else if (lastOutcome === 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false && pending > 0)) {
        line = `📶 Wartet auf Internet – ${exact} von ${withStreet} adressgenau. Geht von selbst weiter.`;
    } else if (lastOutcome === 'service' && pending > 0) {
        line = `OpenStreetMap antwortet gerade nicht – ${exact} von ${withStreet} adressgenau. Neuer Versuch beim nächsten Start.`;
        offerNow = true;
    } else if (lastOutcome === 'paused' && pending > 0) {
        line = `Angehalten – ${exact} von ${withStreet} adressgenau. Geht beim nächsten Start weiter.`;
        offerNow = true;
    } else if (pending > 0 && lastOutcome === 'done') {
        line = `✓ ${exact} von ${withStreet} Kunden adressgenau. ${withStreet - exact} Adressen hat OpenStreetMap nicht gefunden – sie bleiben auf der PLZ-Mitte.`;
    } else if (pending > 0) {
        line = `${exact} von ${withStreet} Kunden adressgenau – ${pending} Adressen stehen noch aus.`;
        offerNow = true;
    } else {
        line = `✓ Alle ${withStreet} Kunden mit Straße sind adressgenau verortet.`;
    }
    box.hidden = !line;
    if (text) text.textContent = line;
    if (now) now.hidden = !offerNow;
}

/** Zwischenstand höchstens so oft zeigen und sichern. */
const CHECKPOINT_MS = 60000;

/**
 * Verortung starten. Läuft höchstens einmal gleichzeitig – der Knopf am
 * Schreibtisch und der Hintergrundlauf teilen sich diesen einen Lauf.
 */
export async function runExactGeocoding({ manual = false } = {}) {
    if (handle || insideMobilePreview) return null;
    if (!manual && (pausedThisVisit || exactGeocodePreference() !== 'yes')) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        lastOutcome = 'offline';
        renderInfoState();
        if (manual) showToast('Ohne Internet geht es nicht – TourFuchs verortet, sobald du wieder online bist.', 'info', 6000);
        return null;
    }
    // Gesperrter Tresor: keine Kundendaten im Speicher, nichts zu verorten.
    if (vaultEnabled() && !vaultUnlocked()) return null;
    if (pendingExactAddresses() === 0) { renderInfoState(); return null; }

    const customers = state.customers;
    let result = { updated: 0, failed: 0, cancelled: true, serviceDown: false };
    let lastCheckpoint = Date.now();
    try {
        handle = geocodeExact(customers, (done, total) => {
            renderStatus(done, total);
            // Unterwegs sichtbar machen, was schon sitzt – und sichern: Wird
            // der Lauf unterbrochen (Tresor sperrt, App geschlossen), ist der
            // Fortschritt nicht verloren. Nicht zu oft: Jede Zwischenstation
            // zeichnet die Karte neu und verschlüsselt beim Tresor den ganzen
            // Bestand – bei vielen Kunden spürt man das am Handy.
            if (Date.now() - lastCheckpoint >= CHECKPOINT_MS) {
                lastCheckpoint = Date.now();
                emit('customers:changed');
                if (customers === state.customers) saveDataset(datasetSnapshot());
            }
        });
        renderStatus(0, handle.total);
        result = await handle.run;
    } catch (error) {
        console.warn('Adressgenaue Verortung abgebrochen:', error);
    } finally {
        // Immer aufräumen – sonst bliebe die Pille mit eingefrorener Zahl
        // stehen und jeder weitere Start liefe ins Leere.
        handle = null;
        renderStatus(0, 0);
    }

    lastOutcome = result.serviceDown ? 'service'
        : result.cancelled ? (lockedDuringRun ? 'locked' : 'paused')
        : 'done';
    lockedDuringRun = false;
    renderInfoState();
    // Nur speichern, wenn die Kunden noch dieselben sind (nicht nach einer
    // Sperre oder einem neuen Import).
    if (customers !== state.customers) return result;
    await saveDataset(datasetSnapshot());
    emit('customers:changed');
    if (result.serviceDown) {
        showToast('OpenStreetMap antwortet gerade nicht. TourFuchs versucht es beim nächsten Start erneut – Gefundenes bleibt erhalten.', 'info', 7000);
    } else if (manual || result.updated > 0) {
        showToast(
            result.cancelled
                ? `Angehalten – ${result.updated} Kunden adressgenau verortet. Beim nächsten Start geht es weiter.`
                : `📍 ${result.updated} Kunden adressgenau verortet${result.failed ? `, ${result.failed} Adressen nicht gefunden (bleiben auf der PLZ)` : ''}.`,
            'success',
            6000
        );
    }
    return result;
}

let lockedDuringRun = false;

export function cancelExactGeocoding() {
    handle?.cancel();
}

// ---- Rückfrage nach dem Import ----
function openOffer() {
    const dialog = document.getElementById('geocode-offer-dialog');
    if (!dialog || dialog.open) return;
    const addresses = pendingExactAddresses();
    if (addresses === 0) return;
    const customers = state.customers.filter((c) => c.strasse && c.geo !== 'exakt').length;
    const lead = document.getElementById('geocode-offer-lead');
    if (lead) {
        lead.textContent = `${customers} ${customers === 1 ? 'Kunde hat' : 'Kunden haben'} eine Straße. `
            + 'TourFuchs kann sie über OpenStreetMap auf die genaue Position setzen – statt auf die Mitte der Postleitzahl. '
            + 'Das macht Touren und Entfernungen spürbar genauer.';
    }
    const duration = document.getElementById('geocode-offer-duration');
    if (duration) duration.textContent = `etwa ${estimateMinutes(addresses)} Minute${estimateMinutes(addresses) === 1 ? '' : 'n'}`;
    dialog.showModal();
}

function onDataImported(payload) {
    if (insideMobilePreview) return;
    // Serviceverträge und -einsätze bringen keine Kundenadressen mit.
    if (payload?.type) return;
    const preference = exactGeocodePreference();
    if (preference === 'yes') { runExactGeocoding(); return; }
    if (preference === null) openOffer();
}

function syncInfoToggle() {
    const toggle = document.getElementById('exact-geocode-toggle');
    if (toggle) toggle.checked = exactGeocodePreference() === 'yes';
    renderInfoState();
}

export function initExactGeocoding() {
    const dialog = document.getElementById('geocode-offer-dialog');
    document.getElementById('geocode-offer-yes')?.addEventListener('click', () => {
        setExactGeocodePreference('yes');
        dialog?.close();
        runExactGeocoding();
    });
    document.getElementById('geocode-offer-no')?.addEventListener('click', () => {
        setExactGeocodePreference('no');
        dialog?.close();
    });
    // „Anhalten" gilt für diesen Besuch; beim nächsten Start geht es weiter.
    document.getElementById('geocode-status-stop')?.addEventListener('click', () => {
        pausedThisVisit = true;
        cancelExactGeocoding();
    });
    const toggle = document.getElementById('exact-geocode-toggle');
    toggle?.addEventListener('change', () => {
        setExactGeocodePreference(toggle.checked ? 'yes' : 'no');
        if (toggle.checked) { pausedThisVisit = false; runExactGeocoding(); } else cancelExactGeocoding();
    });
    syncInfoToggle();

    document.getElementById('exact-geocode-now')?.addEventListener('click', () => {
        pausedThisVisit = false;
        runExactGeocoding({ manual: true });
    });

    on('data:imported', onDataImported);
    // Beim Start und nach einem Funkloch weitermachen, was offen ist. Nach dem
    // Entsperren des Tresors läuft der Start erneut (app:ready).
    on('app:ready', () => setTimeout(() => runExactGeocoding(), 3000));
    window.addEventListener('online', () => runExactGeocoding());
    window.addEventListener('offline', renderInfoState);
    // Tresor sperrt: sofort aufhören. Sonst liefe der Lauf mit den aus dem
    // Speicher entfernten Kunden weiter, schickte Adressen an OpenStreetMap,
    // obwohl die App gesperrt ist, und blockierte den Neustart nach dem Entsperren.
    onVault('locked', () => { if (handle) { lockedDuringRun = true; cancelExactGeocoding(); } });
    on('customers:changed', renderInfoState);
}
