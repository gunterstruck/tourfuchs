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
import { groupExactGeocodeCandidates, geocodeExact } from '../services/geocode.js';
import { saveDataset } from '../services/storage.js';
import { showToast } from './toast.js';

export const EXACT_GEOCODE_PREF_KEY = 'tf_exact_geocode';   // 'yes' | 'no'
// Der freie Dienst erlaubt etwa eine Anfrage pro Sekunde.
const SECONDS_PER_ADDRESS = 1.1;

let handle = null;
let pausedThisVisit = false;
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
    const box = document.getElementById('geocode-status');
    if (!box) return;
    box.hidden = !handle;
    const count = box.querySelector('b');
    if (count) count.textContent = `${done}/${total}`;
    emit('geocode:progress', { running: !!handle, done, total });
}

/**
 * Verortung starten. Läuft höchstens einmal gleichzeitig – der Knopf am
 * Schreibtisch und der Hintergrundlauf teilen sich diesen einen Lauf.
 */
export async function runExactGeocoding({ manual = false } = {}) {
    if (handle || insideMobilePreview) return null;
    if (!manual && (pausedThisVisit || exactGeocodePreference() !== 'yes')) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (manual) showToast('Ohne Internet geht es nicht – TourFuchs verortet, sobald du wieder online bist.', 'info', 6000);
        return null;
    }
    if (pendingExactAddresses() === 0) return null;

    handle = geocodeExact(state.customers, (done, total) => {
        renderStatus(done, total);
        // Unterwegs sichtbar machen, was schon sitzt – nicht erst am Ende.
        if (done % 20 === 0) emit('customers:changed');
    });
    renderStatus(0, handle.total);
    const result = await handle.run;
    handle = null;
    renderStatus(0, 0);

    await saveDataset(datasetSnapshot());
    emit('customers:changed');
    if (manual || result.updated > 0) {
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

    on('data:imported', onDataImported);
    // Beim Start und nach einem Funkloch weitermachen, was offen ist.
    on('app:ready', () => setTimeout(() => runExactGeocoding(), 3000));
    window.addEventListener('online', () => runExactGeocoding());
}
