/**
 * Sicherer Umzug – UI (Etappe 2 „Tresor").
 * Desktop: Kundendaten verschlüsselt als Datei exportieren und den Schlüssel
 *          als QR-Code am Bildschirm zeigen (getrennte Kanäle).
 * Handy:   Datei wählen, Schlüsseldatei laden (oder QR scannen/Text einfügen),
 *          entschlüsseln und lokal speichern. Der Datentresor bleibt optional.
 * Es findet keinerlei Netzwerkübertragung der Daten statt.
 */

import {
    state, replaceCustomers, setServiceContracts, setServiceVisits, setPlaces, emit, on, datasetSnapshot
} from '../core/state.js';
import { mergeOwnPlaces } from '../features/places.js';
import { saveDataset } from '../services/storage.js';
import { isEnabled } from '../services/vault.js';
import { geocodeByPlz } from '../services/geocode.js';
import { fitToCustomers } from '../features/map.js';
import {
    createSafeTransfer, readSafeFile, readSafeKeyFile, parseKeyQr,
    keyMatchesContainer, decryptSafeTransfer, SAFE_FILE_EXT
} from '../features/safeTransfer.js';
import { showToast } from './toast.js';
import { hideBusy, showBusy } from './busyIndicator.js';
import { loadQrReaderModule, loadQrWriterModule } from './lazyModules.js';
import { confirmDatasetReplacement } from './datasetReplacement.js';
import { carryOverVisits } from '../features/datasetDiff.js';
import { visitReportEntries } from '../features/visitReport.js';
import { isDemoDataset } from '../core/demoSafety.js';
import { t } from '../core/i18n.js';
import { isFileAccessError, showFileAccessHelp } from './fileAccessHelp.js';

// QR-Bibliotheken erst bei Bedarf laden – nicht im Startpaket (Release 17.1b).
// Der Leser wird vor Kamera- bzw. Bildscan geladen; die Erkennung selbst
// läuft danach wie bisher synchron.
let jsQR = null;
/** true, wenn der Leser bereitsteht (Laden kann offline vor dem ersten Zwischenspeichern scheitern). */
async function loadQrReader() {
    try { jsQR ??= (await loadQrReaderModule()).default; } catch { /* Meldung beim Aufrufer */ }
    return Boolean(jsQR);
}
const QR_READER_MISSING = 'QR-Leser konnte nicht geladen werden – Schlüsseldatei laden oder Schlüsseltext einfügen.';
const loadQrWriter = async () => (await loadQrWriterModule()).default;

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

let exportDialog = null;
let receiveDialog = null;
let videoStream = null;
let scanLoopId = 0;
let lastExport = null;     // { container, keyQr, count } zum erneuten Download
let pendingContainer = null; // im Empfang gewählte, noch nicht entschlüsselte Datei
let receiveDemo = null; // isolierte Vorführung, niemals im eigenen Datenbestand speichern
let receiveSequence = 0; // verworfene Datei-Lesevorgänge dürfen keinen späteren Dialog befüllen
let keyFileSequence = 0;
let decrypting = false;

export function initSafeTransfer() {
    exportDialog = document.getElementById('safe-export-dialog');
    receiveDialog = document.getElementById('safe-receive-dialog');
    if (!exportDialog || !receiveDialog) return;
    // Gesperrt: Export-Schlüssel und gewählte Datei nicht im Speicher halten.
    on('vault:locked', () => { receiveSequence++; lastExport = null; pendingContainer = null; stopCamera(); });

    exportDialog.querySelector('.dialog-close').addEventListener('click', () => exportDialog.close());
    receiveDialog.querySelector('.dialog-close').addEventListener('click', () => receiveDialog.close());
    receiveDialog.addEventListener('close', () => { receiveSequence++; stopCamera(); receiveDemo = null; pendingContainer = null; clearKey(); });

    document.getElementById('btn-safe-export')?.addEventListener('click', openExportDialog);
    document.getElementById('btn-safe-receive')?.addEventListener('click', openReceiveDialog);
    document.getElementById('btn-safe-receive-ob')?.addEventListener('click', openReceiveDialog);
    // Erster Schritt am Desktop und Willkommenskarte: die Datei von Kollegen
    // ist im Team der häufigste Weg zu den eigenen Daten (PO, 11.10.2026).
    document.getElementById('btn-get-safe')?.addEventListener('click', openReceiveDialog);
    document.getElementById('btn-demo-welcome-safe')?.addEventListener('click', openReceiveDialog);

    document.getElementById('safe-export-download')?.addEventListener('click', () => {
        if (lastExport) downloadContainer(lastExport.container);
    });
    document.getElementById('safe-export-key-download')?.addEventListener('click', () => {
        if (lastExport) downloadBlob(new Blob([`${lastExport.keyQr}\n`], { type: 'text/plain;charset=utf-8' }),
            `TourFuchs-Schluessel-${lastExport.container.id}.txt`);
    });
    const safeFileInput = document.getElementById('safe-file-input');
    safeFileInput?.addEventListener('change', onFileChosen);
    // Auswahl ohne Datei geschlossen (Chrome/Edge melden das als „cancel"):
    // Ausgegraute Dateien im Firmenbereich sehen genau so aus – deshalb erklären.
    safeFileInput?.addEventListener('cancel', () => setFileStatus(
        'Keine Datei gewählt. Falls die Umzugsdatei in der Auswahl fehlte oder ausgegraut war: Im Firmenbereich zeigt die Auswahl oft nur Dateien des Arbeitsprofils – die Datei dort speichern (z. B. über Outlook oder OneDrive der Firma) und erneut wählen.'
    ));
    document.getElementById('safe-scan-photo')?.addEventListener('change', onScanPhoto);
    document.getElementById('safe-key-file-input')?.addEventListener('change', onKeyFileChosen);
    document.getElementById('safe-key-input')?.addEventListener('input', () => { keyFileSequence++; setKeyStatus(''); });
    document.getElementById('safe-camera-start')?.addEventListener('click', startCamera);
    document.getElementById('safe-qr-options')?.addEventListener('toggle', (event) => {
        if (!event.target.open) stopCamera();
    });
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
    // Großer Bestand: Verschlüsseln dauert – sonst wirkt TourFuchs eingefroren
    // (PO, 11.10.2026).
    showBusy('safe-export', 'Umzugsdatei wird verschlüsselt …');
    try {
        bundle = await createSafeTransfer(snap);
    } catch (e) {
        console.warn(e);
        showToast('Export konnte nicht erstellt werden.', 'error');
        return;
    } finally {
        hideBusy('safe-export');
    }
    lastExport = bundle;
    downloadContainer(bundle.container);   // durch Button-Klick ausgelöst -> Download erlaubt

    const canvas = document.getElementById('safe-export-canvas');
    canvas.hidden = false;
    try {
        // Kurzer Text, daher hohe Fehlerkorrektur (H) für robustes Scannen.
        const QRCode = await loadQrWriter();
        await QRCode.toCanvas(canvas, bundle.keyQr, { errorCorrectionLevel: 'H', width: 300, margin: 2 });
    } catch {
        canvas.hidden = true;
        showToast('Schlüssel-QR konnte nicht erzeugt werden. Die Schlüsseldatei kann heruntergeladen werden.', 'info');
    }
    document.getElementById('safe-export-info').textContent = t('safeExport.info', { count: transferCountText(bundle) });
    const keyText = document.getElementById('safe-export-keytext');
    if (keyText) keyText.value = bundle.keyQr;
    exportDialog.showModal();
}

function downloadContainer(container) {
    const blob = new Blob([JSON.stringify(container)], { type: 'application/json' });
    downloadBlob(blob, `TourFuchs-Umzug-${new Date().toISOString().slice(0, 10)}${SAFE_FILE_EXT}`);
}

function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
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
    receiveSequence++;
    receiveDemo = null;
    pendingContainer = null;
    showStep('file');
    document.getElementById('safe-file-meta').hidden = true;
    setFileStatus('');
    clearKey();
    receiveDialog.querySelectorAll('details').forEach((el) => { el.open = false; });
    receiveDialog.showModal();
}

function showStep(step) {
    document.getElementById('safe-step-file').hidden = step === 'demo-result';
    const keyStep = document.getElementById('safe-step-key');
    keyStep.hidden = step === 'demo-result';
    keyStep.disabled = step !== 'key';
    document.getElementById('safe-key-hint').textContent = step === 'key'
        ? 'Lade die getrennt erhaltene Schlüsseldatei (.txt). QR-Scan oder Einfügen gehen ebenfalls.'
        : 'Zuerst die Datendatei in Schritt 1 auswählen.';
    document.getElementById('safe-step-demo-result').hidden = step !== 'demo-result';
    stopCamera();
}

/** Echte Datei- und Schlüsselprüfung in einer isolierten Demo ohne Kamera oder Speicherung. */
export function beginReceiveDemo() {
    receiveDemo = {};
    showStep('file');
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

/**
 * Rückmeldung direkt im Dialog – nicht nur als Einblendung. Im Firmenbereich
 * (Intune-Arbeitsprofil) „passierte nichts": Die Fehlermeldung lag hinter dem
 * offenen Dialog. Hier steht sie jetzt sichtbar, mit Dateiname und Größe.
 */
function setFileStatus(text, kind = 'info') {
    const el = document.getElementById('safe-file-status');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    el.dataset.kind = kind;
}

/** Der Browser durfte die gewählte Datei nicht lesen – typisch im Firmenbereich. */
export function safeFileReadErrorText(error, file) {
    const size = Number(file?.size) || 0;
    const which = `„${file?.name || 'Datei'}" (${size < 1024 ? `${size} Byte` : `${Math.round(size / 1024).toLocaleString('de-DE')} KB`})`;
    const reason = error?.name ? ` [${error.name}]` : '';
    return `Liegt die Datei wirklich auf diesem Handy – im Ordner „Downloads"? ${which} konnte nicht gelesen werden${reason}. Im Firmenbereich (OneDrive, Teams, Outlook, Arbeitsprofil) sperrt oft eine Richtlinie den Zugriff, oder die Datei liegt nur in der Cloud. Abhilfe: Datei zuerst vollständig aufs Gerät herunterladen und dann aus „Downloads" wählen.`;
}

async function onFileChosen(e) {
    const demo = receiveDemo;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
        setFileStatus('Es ist keine Datei angekommen. War die Datei in der Auswahl ausgegraut oder nicht zu sehen? Im Firmenbereich zeigt die Auswahl oft nur Dateien des Arbeitsprofils – die Umzugsdatei dort speichern (z. B. über Outlook oder OneDrive der Firma) und erneut wählen.', 'error');
        return;
    }
    const sequence = ++receiveSequence;
    pendingContainer = null;
    clearKey();
    document.getElementById('safe-file-meta').hidden = true;
    showStep('file');
    setFileStatus(`Datei wird gelesen: „${file.name}" …`);
    let bytes;
    try { bytes = await file.arrayBuffer(); } catch (error) {
        if (sequence !== receiveSequence || !receiveDialog.open) return;
        const text = safeFileReadErrorText(error, file);
        setFileStatus(text, 'error');
        // Gesperrte Datei: große Prüffrage über dem Dialog, Knopf öffnet die Auswahl neu.
        if (!(isFileAccessError(error) && showFileAccessHelp(file, error, { retry: () => document.getElementById('safe-file-input')?.click() }))) {
            showToast(text, 'error', 12000);
        }
        return;
    }
    if (sequence !== receiveSequence || !receiveDialog.open) return;
    const { container, problem } = readSafeFile(bytes);
    if (!container) {
        const text = safeFileProblemText(problem, file);
        setFileStatus(text, 'error');
        showToast(text, 'error', 12000);
        return;
    }
    setFileStatus('');
    pendingContainer = container;
    const meta = document.getElementById('safe-file-meta');
    const created = container.createdAt
        ? new Date(container.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'unbekannt';
    meta.innerHTML = `✓ ${escapeHtml(file.name)} · <b>${transferCountText(container)}</b> · erstellt am ${escapeHtml(created)}`;
    meta.hidden = false;
    showStep('key');
    if (demo) document.getElementById('safe-scan-status').textContent = 'Demo: Schlüssel einfügen – die Kamera bleibt aus.';
}

async function startCamera() {
    if (!pendingContainer || receiveDemo || !receiveDialog.open) return;
    stopCamera();
    const sequence = receiveSequence;
    const cameraSequence = scanLoopId;
    const statusEl = document.getElementById('safe-scan-status');
    const video = document.getElementById('safe-scan-video');
    if (!video) return;
    if (!(await loadQrReader())) { statusEl.textContent = QR_READER_MISSING; return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (sequence !== receiveSequence || cameraSequence !== scanLoopId || !receiveDialog.open) {
            stream.getTracks().forEach((track) => track.stop());
            return;
        }
        videoStream = stream;
        video.srcObject = videoStream;
        video.hidden = false;
        await video.play();
        statusEl.textContent = 'Kamera auf den Schlüssel-QR am Desktop richten …';
        scanLoop(video);
    } catch {
        stopCamera();
        statusEl.textContent = 'Kamera nicht verfügbar – Schlüsseldatei laden, Text einfügen oder QR-Foto wählen.';
    }
}

function stopCamera() {
    scanLoopId++;
    if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
    }
    const video = document.getElementById('safe-scan-video');
    if (video) { video.srcObject = null; video.hidden = true; }
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
    if (!(await loadQrReader())) { showToast(QR_READER_MISSING, 'error', 6000); return; }
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
    if (!val?.trim()) { setKeyStatus('Bitte die Schlüsseldatei laden oder den Schlüsseltext einfügen.', 'error'); return; }
    handleKeyText(val.trim());
}

function setKeyStatus(text, kind = 'info') {
    const el = document.getElementById('safe-key-file-status');
    if (!el) return;
    el.textContent = text;
    el.hidden = !text;
    el.dataset.kind = kind;
}

function clearKey() {
    keyFileSequence++;
    const input = document.getElementById('safe-key-input');
    if (input) input.value = '';
    setKeyStatus('');
}

async function onKeyFileChosen(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !pendingContainer) return;
    const container = pendingContainer;
    const sequence = receiveSequence;
    clearKey();
    const keySequence = keyFileSequence;
    if (file.size > 16 * 1024) {
        setKeyStatus('Diese Datei ist zu groß für einen Schlüssel. Bitte die kleine Schlüsseldatei (.txt) wählen, nicht die Datendatei (.tfsafe).', 'error');
        return;
    }
    setKeyStatus('Schlüsseldatei wird gelesen …');
    try {
        const bytes = await file.arrayBuffer();
        if (sequence !== receiveSequence || keySequence !== keyFileSequence || container !== pendingContainer || !receiveDialog.open) return;
        const keyText = readSafeKeyFile(bytes);
        if (!keyText) { setKeyStatus('Kein eindeutiger TourFuchs-Schlüssel gefunden. Bitte eine Textdatei mit genau einem TFK1:…-Schlüssel wählen.', 'error'); return; }
        if (!keyMatchesContainer(container, parseKeyQr(keyText))) {
            setKeyStatus('Dieser Schlüssel gehört nicht zu dieser Datendatei. Bitte die passende Schlüsseldatei wählen.', 'error');
            return;
        }
        document.getElementById('safe-key-input').value = keyText;
        setKeyStatus(`✓ ${file.name} – passender Schlüssel geladen. Jetzt „Entschlüsseln und importieren“.`, 'success');
    } catch (error) {
        if (sequence !== receiveSequence || keySequence !== keyFileSequence || !receiveDialog.open) return;
        setKeyStatus('Die Schlüsseldatei konnte nicht gelesen werden. Bitte erneut aus dem lokalen Download-Ordner wählen.', 'error');
        if (isFileAccessError(error)) showFileAccessHelp(file, error, { retry: () => document.getElementById('safe-key-file-input')?.click() });
    }
}

async function handleKeyText(text) {
    if (decrypting) return;
    const sequence = receiveSequence;
    const demo = receiveDemo;
    const parsed = parseKeyQr(text);
    if (!parsed) {
        setKeyStatus('Das ist kein TourFuchs-Schlüssel (TFK1:…).', 'error');
        showToast('Das ist kein TourFuchs-Schlüssel (TFK1:…).', 'error');
        return;
    }
    if (!pendingContainer) {
        showToast('Bitte zuerst die Umzugsdatei wählen.', 'error');
        return;
    }
    if (!keyMatchesContainer(pendingContainer, parsed)) {
        setKeyStatus('Dieser Schlüssel gehört nicht zu dieser Datei.', 'error');
        showToast('Dieser Schlüssel gehört nicht zu dieser Datei.', 'error', 6000);
        return;
    }
    stopCamera();
    decrypting = true;
    let dataset;
    showBusy('safe-receive', 'Datei wird entschlüsselt …');
    try {
        dataset = await decryptSafeTransfer(pendingContainer, parsed.keyB64);
    } catch {
        setKeyStatus('Entschlüsselung fehlgeschlagen – Schlüssel falsch oder Datei beschädigt.', 'error');
        showToast('Entschlüsselung fehlgeschlagen – Schlüssel falsch oder Datei beschädigt.', 'error', 6000);
        return;
    } finally {
        decrypting = false;
        hideBusy('safe-receive');
    }
    if (sequence !== receiveSequence || !receiveDialog.open) return;
    if (demo) {
        if (receiveDemo !== demo || !receiveDialog.open) return;
        const customers = Array.isArray(dataset?.customers) ? dataset.customers : [];
        document.getElementById('safe-demo-result').textContent = `${customers.length} Kunden entschlüsselt: ${customers.map((c) => `[${c.nummer}] ${c.name}`).join(' · ')}`;
        showStep('demo-result');
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
        replacesVisits: true,
        keepsCustomerVisits: true
    })) {
        showToast('Import abgebrochen. Die bisherigen Daten bleiben vollständig erhalten.', 'info', 5000);
        return;
    }
    showBusy('safe-receive', 'Daten werden übernommen …');
    try {
        await geocodeByPlz(customers); // Sicherheitsnetz für evtl. fehlende Koordinaten
        // Besuche aus der Datei kennt das andere Gerät schon; sie gelten danach
        // als abgeglichen. Besuche dieses Geräts gehen nicht verloren: Sie werden
        // mit denen aus der Datei vereinigt (wie beim Reimport) und bleiben offen.
        const fromFile = visitReportEntries(customers, { range: 'unsent' });
        if (!isDemoDataset(state.customers)) carryOverVisits(state.customers, customers);
        replaceCustomers(customers, {
            fileName: dataset?.fileName,
            importedAt: dataset?.importedAt,
            territories: dataset?.territories || {}
        });
        emit('visits:received', { entries: fromFile });
        setServiceContracts(serviceContracts, dataset?.serviceContractSources || {});
        setServiceVisits(serviceVisits, dataset?.serviceVisitSources || {});
        // Eigene Orte werden ergänzt, nicht ersetzt: Die Station des Zielgeräts still
        // zu überschreiben wäre Verdrängung ohne Rückweg. Der Bericht über die
        // Ersetzung spricht von Kunden – also fassen wir hier nur an, was er meint.
        setPlaces(mergeOwnPlaces(state.places, dataset?.places));
        fitToCustomers();
        receiveDialog.close();
    } finally {
        hideBusy('safe-receive');
    }

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
    })}) und lokal gespeichert, verschlüsselt mit dem Geräteschlüssel. Zusätzlichen PIN-Schutz bietet der Datentresor unter „Daten".`, 'info', 9000);
}

/**
 * Empfangene Daten speichern – und nur bei echtem Erfolg „gesichert" melden.
 * saveDataset() liefert false (z. B. Tresor zwischenzeitlich gesperrt,
 * Speicher voll); dann ehrlich sagen und einen neuen Versuch anbieten.
 */
async function persistReceived() {
    for (;;) {
        showBusy('safe-receive', 'Daten werden gespeichert …');
        let saved;
        try { saved = await saveDataset(datasetSnapshot()); } finally { hideBusy('safe-receive'); }
        if (saved) return true;
        if (!confirm('Die empfangenen Daten konnten nicht gespeichert werden.\n\nErneut versuchen?')) {
            showToast('Nicht gespeichert: Die empfangenen Daten sind nur bis zum Neuladen da. Bitte den Import danach wiederholen.', 'error', 9000);
            return false;
        }
    }
}
