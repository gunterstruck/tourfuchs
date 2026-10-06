/**
 * Sicherer Umzug – UI (Etappe 2 „Tresor").
 * Desktop: Kundendaten verschlüsselt als Datei exportieren und den Schlüssel
 *          als QR-Code am Bildschirm zeigen (getrennte Kanäle).
 * Handy:   Datei wählen, Schlüssel per Kamera scannen (oder eintippen),
 *          entschlüsseln und lokal speichern. Der Datentresor bleibt optional.
 * Es findet keinerlei Netzwerkübertragung der Daten statt.
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
    state, replaceCustomers, setServiceContracts, setServiceVisits, setPlaces, emit, on, datasetSnapshot
} from '../core/state.js';
import { mergeOwnPlaces } from '../features/places.js';
import { saveDataset } from '../services/storage.js';
import { isEnabled } from '../services/vault.js';
import { geocodeByPlz } from '../services/geocode.js';
import { fitToCustomers } from '../features/map.js';
import {
    createSafeTransfer, readSafeFile, parseKeyQr,
    keyMatchesContainer, decryptSafeTransfer, SAFE_FILE_EXT
} from '../features/safeTransfer.js';
import { showToast } from './toast.js';
import { confirmDatasetReplacement } from './datasetReplacement.js';
import { t } from '../core/i18n.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let exportDialog = null;
let receiveDialog = null;
let videoStream = null;
let scanLoopId = 0;
let lastExport = null;     // { container, keyQr, count } zum erneuten Download
let pendingContainer = null; // im Empfang gewählte, noch nicht entschlüsselte Datei

export function initSafeTransfer() {
    exportDialog = document.getElementById('safe-export-dialog');
    receiveDialog = document.getElementById('safe-receive-dialog');
    if (!exportDialog || !receiveDialog) return;
    // Gesperrt: Export-Schlüssel und gewählte Datei nicht im Speicher halten.
    on('vault:locked', () => { lastExport = null; pendingContainer = null; stopCamera(); });

    exportDialog.querySelector('.dialog-close').addEventListener('click', () => exportDialog.close());
    receiveDialog.querySelector('.dialog-close').addEventListener('click', () => receiveDialog.close());
    receiveDialog.addEventListener('close', stopCamera);

    document.getElementById('btn-safe-export')?.addEventListener('click', openExportDialog);
    document.getElementById('btn-safe-receive')?.addEventListener('click', openReceiveDialog);
    document.getElementById('btn-safe-receive-ob')?.addEventListener('click', openReceiveDialog);

    document.getElementById('safe-export-download')?.addEventListener('click', () => {
        if (lastExport) downloadContainer(lastExport.container);
    });
    document.getElementById('safe-file-input')?.addEventListener('change', onFileChosen);
    document.getElementById('safe-scan-photo')?.addEventListener('change', onScanPhoto);
    document.getElementById('safe-key-submit')?.addEventListener('click', onKeyEntered);
}

// ---- Export (Desktop) ----
async function openExportDialog() {
    const snap = datasetSnapshot();
    if (!snap.customers?.length
        && !snap.serviceContracts?.length
        && !snap.serviceVisits?.length
        && !Object.keys(snap.territories || {}).length) {
        showToast('Keine Daten zum Exportieren vorhanden.', 'info');
        return;
    }
    let bundle;
    try {
        bundle = await createSafeTransfer(snap);
    } catch (e) {
        console.warn(e);
        showToast('Export konnte nicht erstellt werden.', 'error');
        return;
    }
    lastExport = bundle;
    downloadContainer(bundle.container);   // durch Button-Klick ausgelöst -> Download erlaubt

    const canvas = document.getElementById('safe-export-canvas');
    try {
        // Kurzer Text, daher hohe Fehlerkorrektur (H) für robustes Scannen.
        await QRCode.toCanvas(canvas, bundle.keyQr, { errorCorrectionLevel: 'H', width: 300, margin: 2 });
    } catch {
        showToast('Schlüssel-QR konnte nicht erzeugt werden.', 'error');
        return;
    }
    document.getElementById('safe-export-info').textContent = t('safeExport.info', { count: transferCountText(bundle) });
    const keyText = document.getElementById('safe-export-keytext');
    if (keyText) keyText.value = bundle.keyQr;
    exportDialog.showModal();
}

function downloadContainer(container) {
    const blob = new Blob([JSON.stringify(container)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TourFuchs-Umzug-${new Date().toISOString().slice(0, 10)}${SAFE_FILE_EXT}`;
    a.click();
    // Nicht sofort freigeben: Manche Browser lesen den Blob erst nach dem
    // Klick – sofort freigegeben, landet dort eine leere oder keine Datei.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function transferCountText(meta) {
    const customers = Number(meta?.count) || 0;
    const contracts = Number(meta?.contractCount) || 0;
    const visits = Number(meta?.visitCount) || 0;
    const territories = Number(meta?.territoryCount) || 0;
    return [
        customers ? `${customers} Kunde${customers === 1 ? '' : 'n'}` : '',
        contracts ? `${contracts} Servicevertrag${contracts === 1 ? '' : 'e'}` : '',
        visits ? `${visits} Serviceeinsatz${visits === 1 ? '' : 'e'}` : '',
        territories ? `${territories} Gebietszuordnung${territories === 1 ? '' : 'en'}` : ''
    ].filter(Boolean).join(' · ') || '0 Einträgen';
}

// ---- Empfang (Handy) ----
function openReceiveDialog() {
    pendingContainer = null;
    showStep('file');
    document.getElementById('safe-file-meta').hidden = true;
    const keyInput = document.getElementById('safe-key-input');
    if (keyInput) keyInput.value = '';
    receiveDialog.showModal();
}

function showStep(step) {
    document.getElementById('safe-step-file').hidden = step !== 'file';
    document.getElementById('safe-step-key').hidden = step !== 'key';
    if (step === 'key') startCamera();
    else stopCamera();
}

/**
 * Für die Live-Demo: den Schlüssel-Schritt zeigen (Scanner-Bereich, Foto-Fallback
 * und manuelles Eingabefeld) OHNE die Kamera zu starten – so gibt es keinen
 * Berechtigungs-Dialog. Die eingesetzten Beispielwerte werden beim nächsten
 * echten Öffnen wieder zurückgesetzt.
 */
export function showKeyStepForDemo() {
    if (!receiveDialog) receiveDialog = document.getElementById('safe-receive-dialog');
    if (!receiveDialog) return;
    if (!receiveDialog.open) receiveDialog.showModal();
    const meta = document.getElementById('safe-file-meta');
    if (meta) { meta.innerHTML = '🔒 Verschlüsselte Datei · <b>48 Kunden</b> · erstellt am 04.07.2026, 10:00'; meta.hidden = false; }
    document.getElementById('safe-step-file').hidden = true;
    document.getElementById('safe-step-key').hidden = false;
    const status = document.getElementById('safe-scan-status');
    if (status) status.textContent = 'Kamera auf den Schlüssel-QR am Desktop richten … (Vorschau)';
    const details = document.querySelector('#safe-step-key details');
    if (details) details.open = true;
    const input = document.getElementById('safe-key-input');
    if (input) input.value = 'TFK1:a1b2c3d4e5f6:s3hr-l4ngerSchluessel…';
    // Kamera bewusst NICHT starten (kein getUserMedia in der Demo).
}

/**
 * Was mit der Datei los ist – in Worten, die beim Weiterkommen helfen.
 * Name und Größe stehen dabei: So sieht man sofort, ob es überhaupt die
 * richtige Datei ist und ob sie vollständig angekommen ist.
 */
export function safeFileProblemText(problem, file) {
    const size = Number(file?.size) || 0;
    const sizeText = size < 1024 ? `${size} Byte` : `${Math.round(size / 1024).toLocaleString('de-DE')} KB`;
    const which = `„${file?.name || 'Datei'}" (${sizeText})`;
    const again = 'Am besten die Datei am Desktop neu erzeugen und auf einem anderen Weg aufs Handy bringen (z. B. USB oder Cloud statt Mail).';
    switch (problem) {
        case 'empty':
            return `${which} ist leer – sie ist nicht vollständig angekommen. Liegt sie in einer Cloud, dort erst ganz herunterladen und dann wählen.`;
        case 'truncated':
            return `${which} ist unvollständig angekommen – das Ende fehlt. ${again}`;
        case 'zip':
            return `${which} ist gepackt (ZIP). Bitte erst entpacken und die .tfsafe-Datei darin wählen.`;
        case 'html':
            return `${which} enthält eine Webseite statt der Umzugsdaten – meist die Hinweisseite eines Mail- oder Cloud-Filters. ${again}`;
        case 'pdf':
        case 'binary':
            return `${which} wurde unterwegs verändert oder zusätzlich verschlüsselt – z. B. von einem Firmen-Schutz für Anhänge. ${again}`;
        default:
            return `${which} ist keine TourFuchs-Umzugsdatei (.tfsafe). Bitte die Datei wählen, die TourFuchs am Desktop unter „Sicherer Umzug" heruntergeladen hat.`;
    }
}

async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let bytes;
    try { bytes = await file.arrayBuffer(); } catch { showToast('Datei konnte nicht gelesen werden.', 'error'); return; }
    const { container, problem } = readSafeFile(bytes);
    if (!container) {
        showToast(safeFileProblemText(problem, file), 'error', 12000);
        return;
    }
    pendingContainer = container;
    const meta = document.getElementById('safe-file-meta');
    const created = container.createdAt
        ? new Date(container.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'unbekannt';
    meta.innerHTML = `🔒 Verschlüsselte Datei · <b>${transferCountText(container)}</b> · erstellt am ${escapeHtml(created)}`;
    meta.hidden = false;
    showStep('key');
}

async function startCamera() {
    const statusEl = document.getElementById('safe-scan-status');
    const video = document.getElementById('safe-scan-video');
    if (!video) return;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = videoStream;
        await video.play();
        statusEl.textContent = 'Kamera auf den Schlüssel-QR am Desktop richten …';
        scanLoop(video);
    } catch {
        statusEl.textContent = 'Kamera nicht verfügbar – Schlüssel unten per Foto oder Eingabe übergeben.';
    }
}

function stopCamera() {
    scanLoopId++;
    if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
    }
    const video = document.getElementById('safe-scan-video');
    if (video) video.srcObject = null;
}

function scanLoop(video) {
    const loopId = ++scanLoopId;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
        if (loopId !== scanLoopId || !receiveDialog.open) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height);
            if (code?.data) { handleKeyText(code.data); return; }
        }
        setTimeout(tick, 220);
    };
    tick();
}

async function onScanPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) { showToast('Bild konnte nicht gelesen werden.', 'error'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height);
    if (!code?.data) { showToast('Kein Schlüssel-QR im Bild gefunden.', 'error'); return; }
    handleKeyText(code.data);
}

function onKeyEntered() {
    const val = document.getElementById('safe-key-input')?.value;
    if (!val?.trim()) return;
    handleKeyText(val.trim());
}

async function handleKeyText(text) {
    const parsed = parseKeyQr(text);
    if (!parsed) {
        showToast('Das ist kein TourFuchs-Schlüssel (TFK1:…).', 'error');
        return;
    }
    if (!pendingContainer) {
        showToast('Bitte zuerst die Umzugsdatei wählen.', 'error');
        return;
    }
    if (!keyMatchesContainer(pendingContainer, parsed)) {
        showToast('Dieser Schlüssel gehört nicht zu dieser Datei.', 'error', 6000);
        return;
    }
    stopCamera();
    let dataset;
    try {
        dataset = await decryptSafeTransfer(pendingContainer, parsed.keyB64);
    } catch {
        showToast('Entschlüsselung fehlgeschlagen – Schlüssel falsch oder Datei beschädigt.', 'error', 6000);
        return;
    }
    await applyImported(dataset);
}

async function applyImported(dataset) {
    const customers = Array.isArray(dataset?.customers) ? dataset.customers : [];
    const serviceContracts = Array.isArray(dataset?.serviceContracts) ? dataset.serviceContracts : [];
    const serviceVisits = Array.isArray(dataset?.serviceVisits) ? dataset.serviceVisits : [];
    if (!confirmDatasetReplacement({
        incomingCount: customers.length,
        sourceLabel: 'Die empfangene TourFuchs-Datei',
        replacesContracts: true,
        replacesVisits: true
    })) {
        showToast('Import abgebrochen. Die bisherigen Daten bleiben vollständig erhalten.', 'info', 5000);
        return;
    }
    await geocodeByPlz(customers); // Sicherheitsnetz für evtl. fehlende Koordinaten
    replaceCustomers(customers, {
        fileName: dataset?.fileName,
        importedAt: dataset?.importedAt,
        territories: dataset?.territories || {}
    });
    setServiceContracts(serviceContracts, dataset?.serviceContractSources || {});
    setServiceVisits(serviceVisits, dataset?.serviceVisitSources || {});
    // Eigene Orte werden ergänzt, nicht ersetzt: Die Station des Zielgeräts still
    // zu überschreiben wäre Verdrängung ohne Rückweg. Der Bericht über die
    // Ersetzung spricht von Kunden – also fassen wir hier nur an, was er meint.
    setPlaces(mergeOwnPlaces(state.places, dataset?.places));
    fitToCustomers();
    receiveDialog.close();

    if (isEnabled()) {
        // Auf diesem Gerät ist bereits ein Tresor aktiv -> direkt verschlüsselt sichern.
        if (!(await persistReceived())) return;
        showToast(`Daten empfangen (${transferCountText({
            count: customers.length,
            contractCount: serviceContracts.length,
            visitCount: serviceVisits.length
        })}) und im Tresor gesichert.`, 'success', 6000);
        return;
    }
    // Die Transportverschlüsselung endet nach dem Entschlüsseln. Ein lokaler
    // Datentresor ist eine getrennte Entscheidung und darf den Import nicht
    // mit einer PIN-Pflicht blockieren. Das offene Schloss bleibt als sichtbares
    // Angebot; wer möchte, aktiviert den Tresor später unter „Daten".
    if (!(await persistReceived())) return;
    showToast(`Daten empfangen (${transferCountText({
        count: customers.length,
        contractCount: serviceContracts.length,
        visitCount: serviceVisits.length
    })}) und lokal gespeichert. Ohne Datentresor liegen sie auf diesem Gerät unverschlüsselt – du kannst ihn jederzeit unter „Daten" aktivieren.`, 'info', 9000);
}

/**
 * Empfangene Daten speichern – und nur bei echtem Erfolg „gesichert" melden.
 * saveDataset() liefert false (z. B. Tresor zwischenzeitlich gesperrt,
 * Speicher voll); dann ehrlich sagen und einen neuen Versuch anbieten.
 */
async function persistReceived() {
    for (;;) {
        if (await saveDataset(datasetSnapshot())) return true;
        if (!confirm('Die empfangenen Daten konnten nicht gespeichert werden.\n\nErneut versuchen?')) {
            showToast('Nicht gespeichert: Die empfangenen Daten sind nur bis zum Neuladen da. Bitte den Import danach wiederholen.', 'error', 9000);
            return false;
        }
    }
}
