/**
 * „🔄 Abgleichen" – Oberfläche (Weg B, PO 20.10.2026).
 *
 * Ein Fenster, auf Handy und Desktop gleich: oben senden (Abgleich-Datei mit
 * den Besuchen seit dem letzten Abgleich teilen), unten empfangen (Datei vom
 * anderen Gerät öffnen – es kommt nur hinzu). „Seit dem letzten Abgleich"
 * teilt sich das Gedächtnis mit dem Besuchsbericht: Was einmal weitergegeben
 * wurde, auf welchem Weg auch immer, zählt nicht noch einmal.
 *
 * Handy: Knopf im Tour-Blatt unter „📷 Tour per QR übernehmen".
 * Desktop: Daten → „Weitergeben".
 */
import { state, on, emit, markDirty } from '../core/state.js';
import { rememberSentVisits } from '../features/visitReport.js';
import { buildSyncPayload, mergeSyncPayload, parseSyncPayload, syncFileName, syncSummary } from '../features/visitSync.js';
import { openVisitReport, refreshUnsentVisits, shareOrDownload, unsentVisitEntries } from './visitReport.js';
import { showToast } from './toast.js';

let dialog = null;
let unsent = 0;

const newLabel = (count) => (count === 1 ? '1 neuer Besuch' : `${count} neue Besuche`);

function syncButtons() {
    const suffix = unsent > 0 ? ` · ${unsent} neu` : '';
    for (const id of ['btn-sync', 'btn-sync-data']) {
        const button = document.getElementById(id);
        if (!button) continue;
        button.textContent = `🔄 ${button.dataset.label}${suffix}`;
        button.hidden = state.customers.length === 0;
    }
}

function render() {
    const send = dialog.querySelector('#sync-send');
    dialog.querySelector('#sync-send-info').textContent = unsent > 0
        ? `${newLabel(unsent)} seit dem letzten Abgleich.`
        : 'Seit dem letzten Abgleich ist hier nichts Neues eingetragen.';
    send.disabled = unsent === 0;
    send.textContent = unsent > 0 ? `📤 Abgleich-Datei teilen (${unsent})` : '📤 Nichts zu senden';
}

export function openVisitSync() {
    if (!dialog) return;
    if (state.customers.length === 0) {
        showToast('Keine Kundendaten vorhanden.', 'info');
        return;
    }
    unsent = unsentVisitEntries().length;
    render();
    dialog.showModal();
}

async function send() {
    const entries = unsentVisitEntries();
    if (entries.length === 0) return;
    const fileName = syncFileName();
    const file = new File([JSON.stringify(buildSyncPayload(entries))], fileName, { type: 'text/plain' });
    const delivered = await shareOrDownload(file, fileName, 'TourFuchs – Abgleich');
    if (delivered === null) return;
    rememberSentVisits(entries);
    dialog.close();
    refreshUnsentVisits();
    showToast(`${newLabel(entries.length)} als Abgleich-Datei ${delivered ? 'geteilt' : 'gespeichert'}. Auf dem anderen Gerät: „🔄 Abgleichen" → „Abgleich-Datei öffnen".`, 'success', 7000);
}

/**
 * Text einer Datei als Abgleich übernehmen.
 * @returns {boolean} true, wenn es eine Abgleich-Datei war (übernommen oder gemeldet)
 */
export function applySyncText(text) {
    const payload = parseSyncPayload(text);
    if (!payload) return false;
    if (state.customers.length === 0) {
        showToast('Das ist eine Abgleich-Datei. Bitte zuerst die Kundenliste laden – dann trägt TourFuchs die Besuche nach.', 'info', 7000);
        return true;
    }
    const result = mergeSyncPayload(state.customers, payload);
    // Was aus der Datei kam, kennt das andere Gerät schon – nicht zurückschicken.
    if (result.entries.length > 0) rememberSentVisits(result.entries);
    if (result.added > 0) {
        markDirty();
        emit('visits:changed');
        emit('customers:changed');
    } else {
        refreshUnsentVisits();
    }
    dialog?.close();
    showToast(`🔄 Abgleich: ${syncSummary(result)}`, result.added > 0 ? 'success' : 'info', 8000);
    return true;
}

/** Datei aus Auswahl, Teilen-Ziel oder Drag & Drop prüfen und übernehmen. */
export async function applySyncFile(file) {
    if (!file || file.size > 5_000_000) return false;
    let text;
    try { text = await file.text(); } catch { return false; }
    return applySyncText(text);
}

/** Sieht der Name nach einer Abgleich-Datei aus? (Inhalt entscheidet trotzdem.) */
export function looksLikeSyncFile(file) {
    return /^TourFuchs-Abgleich-.*\.txt$/i.test(file?.name || '');
}

export function initVisitSync() {
    dialog = document.getElementById('sync-dialog');
    if (!dialog) return;
    dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('#sync-send').addEventListener('click', send);
    const input = dialog.querySelector('#sync-file-input');
    dialog.querySelector('#sync-open').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
        const [file] = input.files || [];
        input.value = '';
        if (!file) return;
        if (!(await applySyncFile(file))) {
            showToast('Das ist keine Abgleich-Datei. Erwartet wird „TourFuchs-Abgleich-….txt" vom anderen Gerät.', 'error', 7000);
        }
    });
    dialog.querySelector('#sync-excel').addEventListener('click', () => {
        dialog.close();
        openVisitReport();
    });
    for (const id of ['btn-sync', 'btn-sync-data']) {
        document.getElementById(id)?.addEventListener('click', openVisitSync);
    }
    on('visits:unsent', (count) => {
        unsent = count;
        syncButtons();
        if (dialog.open) render();
    });
    on('customers:changed', syncButtons);
    syncButtons();
}
