/**
 * Besuchsbericht – Oberfläche.
 *
 * Handy: „📤 Besuche weitergeben" in „Meine Tour" (und im Feierabend-Dialog).
 * Zeitraum wählen, dann öffnet das Handy sein Teilen-Menü (Mail, Teams,
 * OneDrive …) mit einer kleinen Excel-Datei. Wo Teilen nicht geht (meist am
 * Desktop), wird die Datei heruntergeladen.
 *
 * Desktop: Ein so erzeugter Bericht wird beim Einlesen erkannt und trägt nur
 * die Besuche nach (siehe importWizard.js → applyVisitReport).
 */
import { state, on, emit, markDirty } from '../core/state.js';
import { hasDemoCustomers } from '../core/demoSafety.js';
import {
    VISIT_REPORT_RANGES, loadSentVisits, rememberSentVisits, sentVisitsInitialized, clearSentVisits, visitReportEntries, visitReportRows,
    mergeVisitReport, mergeSummary
} from '../features/visitReport.js';
import { todayIso } from '../features/visits.js';
import { showToast } from './toast.js';

const excel = () => import('../services/excel.js');

let dialog = null;
let range = 'unsent';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function entriesFor(id) {
    return visitReportEntries(state.customers, { range: id, sent: loadSentVisits() });
}

function render() {
    const list = dialog.querySelector('#visit-report-ranges');
    list.innerHTML = VISIT_REPORT_RANGES.map(({ id, label }) => {
        const count = entriesFor(id).length;
        return `<label class="visit-report-range">
            <input type="radio" name="visit-report-range" value="${id}"${id === range ? ' checked' : ''}>
            <span>${escapeHtml(label)}</span>
            <b>${count} ${count === 1 ? 'Besuch' : 'Besuche'}</b>
        </label>`;
    }).join('');
    list.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => {
        range = input.value;
        syncConfirm();
    }));
    syncConfirm();
}

function syncConfirm() {
    const count = entriesFor(range).length;
    const button = dialog.querySelector('#visit-report-share');
    button.disabled = count === 0;
    button.textContent = count === 0
        ? 'Keine Besuche im Zeitraum'
        : `📤 ${count} ${count === 1 ? 'Besuch' : 'Besuche'} weitergeben`;
}

export function openVisitReport() {
    if (!dialog) return;
    if (state.customers.length === 0) {
        showToast('Keine Kundendaten vorhanden.', 'info');
        return;
    }
    // „Seit dem letzten Bericht" ist der Normalfall; ist er leer, gleich „Heute"
    // bzw. „Diese Woche" vorschlagen, statt mit einem grauen Knopf zu starten.
    range = VISIT_REPORT_RANGES.map((r) => r.id).find((id) => entriesFor(id).length > 0) || 'unsent';
    render();
    dialog.showModal();
}

async function share() {
    const entries = entriesFor(range);
    if (entries.length === 0) return;
    const demo = hasDemoCustomers(state.customers);
    const { visitReportFile } = await excel();
    const { file, fileName } = visitReportFile(visitReportRows(entries, { demo }), { demo });
    let delivered = false;
    try {
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: 'TourFuchs – Besuchsbericht' });
            delivered = true;
        }
    } catch (error) {
        // Abbruch im Teilen-Menü: nichts als weitergegeben merken.
        if (error?.name === 'AbortError') return;
    }
    if (!delivered) {
        const url = URL.createObjectURL(file);
        const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    rememberSentVisits(entries);
    dialog.close();
    syncButton();
    showToast(`${entries.length} ${entries.length === 1 ? 'Besuch' : 'Besuche'} als Excel ${delivered ? 'geteilt' : 'gespeichert'}. Fürs CRM, eine KI oder den Desktop („Eigene Daten laden").`, 'success', 6500);
}

/** Knopf in „Meine Tour": sichtbar, sobald es nicht weitergegebene Besuche gibt. */
function syncButton() {
    const button = document.getElementById('btn-visit-report');
    if (!button) return;
    // Die Daten können nach „app:ready" kommen (Beispieldaten am Handy):
    // Ausgangsbasis anlegen, sobald zum ersten Mal Kunden da sind.
    ensureBaseline();
    const open = state.customers.length ? entriesFor('unsent').length : 0;
    button.hidden = open === 0;
    button.textContent = `📤 Besuche weitergeben (${open})`;
}

/**
 * Bericht am Desktop übernehmen: nur `besuche` wird ergänzt.
 * @returns {boolean} true, wenn die Zeilen als Besuchsbericht behandelt wurden
 */
export function applyVisitReport(rows) {
    if (state.customers.length === 0) {
        showToast('Das ist ein Besuchsbericht. Bitte zuerst die Kundenliste laden – dann trägt TourFuchs die Besuche nach.', 'info', 7000);
        return true;
    }
    const result = mergeVisitReport(state.customers, rows);
    if (result.added > 0) {
        // Übernommene Besuche gelten hier als bekannt – sie sollen nicht gleich
        // wieder in einem Bericht dieses Geräts landen.
        rememberSentVisits(result.touched.flatMap((customer) => (customer.besuche || []).map((date) => ({ customer, date }))));
        markDirty();
        emit('visits:changed');
        emit('customers:changed');
    }
    showToast(`📥 Besuchsbericht: ${mergeSummary(result)}`, result.added > 0 ? 'success' : 'info', 8000);
    return true;
}

/** Besuche aus einem Import stammen aus der Quelle – sie gelten als weitergegeben. */
function markImportedVisitsSent() {
    rememberSentVisits(visitReportEntries(state.customers, { range: 'unsent' }));
    syncButton();
}

/**
 * Erster Start mit dieser Funktion: Was schon vorher im Datensatz stand (aus
 * dem Import oder aus Beispieldaten), ist nicht „unterwegs erfasst". Nur
 * heutige Besuche eigener Daten zählen als noch nicht weitergegeben.
 */
function ensureBaseline() {
    if (sentVisitsInitialized() || state.customers.length === 0) return;
    const today = todayIso();
    const demo = hasDemoCustomers(state.customers);
    rememberSentVisits(visitReportEntries(state.customers, { range: 'unsent' })
        .filter((entry) => demo || entry.date < today));
}

export function initVisitReport() {
    dialog = document.getElementById('visit-report-dialog');
    if (!dialog) return;
    dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('#visit-report-cancel')?.addEventListener('click', () => dialog.close());
    dialog.querySelector('#visit-report-share')?.addEventListener('click', share);
    document.getElementById('btn-visit-report')?.addEventListener('click', openVisitReport);
    document.getElementById('btn-visit-report-data')?.addEventListener('click', openVisitReport);
    document.getElementById('day-review-share')?.addEventListener('click', () => {
        document.getElementById('day-review-dialog')?.close();
        openVisitReport();
    });

    on('data:imported', (payload) => { if (!payload?.type) markImportedVisitsSent(); });
    on('demo:loaded', markImportedVisitsSent);
    on('dataset:cleared', () => { clearSentVisits(); syncButton(); });
    on('app:ready', syncButton);
    on('visits:changed', syncButton);
    on('customers:changed', syncButton);
}
