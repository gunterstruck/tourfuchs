/**
 * Import-Assistent
 * Schritt 1: Datei wählen (oder Drag & Drop)
 * Schritt 2: Spalten-Zuordnung prüfen/anpassen (mit Vorschau)
 * Schritt 3: Import + Verortung über PLZ
 */

import { geocodeByPlz } from '../services/geocode.js';
import {
    state, setCustomers, replaceCustomers, setServiceContracts, clearServiceContracts,
    setServiceVisits, clearServiceVisits, emit, on, datasetSnapshot, setTerritory
} from '../core/state.js';
import { loadLevel, regionName, regionKey } from '../services/geodata.js';
import { saveDataset } from '../services/storage.js';
import {
    canAutoLoadWelcomeDemo,
    hasClearedDataset,
    hasHandledWelcomeDemo,
    markDatasetCleared,
    markShowcaseImportCompleted,
    markWelcomeDemoHandled,
    resetWelcomeDemoAfterDataClear,
    welcomeDemoDelayMs
} from '../services/showcaseOnboarding.js';
import { isEnabled as vaultEnabled, removeVaultMeta } from '../services/vault.js';
import { isDemoDataset } from '../core/demoSafety.js';
import { showToast } from './toast.js';
import { isPhoneUi, phoneFaceQuery } from '../core/viewport.js';
import { fitToCustomers } from '../features/map.js';
import {
    createDemoServiceContracts,
    createDemoServiceContractSourceMeta
} from '../features/demoServiceContracts.js';
import {
    createDemoServiceVisits,
    createDemoServiceVisitSourceMeta
} from '../features/demoServiceVisits.js';
import { confirmDatasetReplacement, hasExistingDataset, onlyDemoDataPresent } from './datasetReplacement.js';
import { looksLikeTable, parseClipboardTable } from '../services/clipboardTable.js';
import { confirmImportWithDiff } from './importDiff.js';
import { carryOverVisits } from '../features/datasetDiff.js';
import { isVisitReportHeaders } from '../features/visitReport.js';
import { applyVisitReport } from './visitReport.js';
import { isDemoWelcomeOpen } from './demoWelcome.js';
import { showImportInsight } from './importInsight.js';
import { buildCustomerListPrompt } from '../features/customerListPrompt.js';
import { copyText } from '../features/handoff.js';
import { resolveAssistant } from '../services/assistant.js';
import { assistantChooserHtml, launchAssistant, wireAssistantChooser } from './briefingAssistant.js';
import { currentLocale, t } from '../core/i18n.js';
import { readWorkbookInBackground } from '../services/workbookReader.js';
import {
    LARGE_MOBILE_FILE_BYTES, clearImportInFlight, formatFileSize, noteImportInFlight, takeInterruptedImport
} from '../features/importInFlight.js';

let dialog = null;
let resultDialog = null;
let ownDataDialog = null;
let pasteDialog = null;
let awaitingFilePick = false;
let pasteHintShown = false;
let parsed = null; // { headers, rows, fileName }
let lastErrors = [];
let lastFileBase = 'TourFuchs';
let welcomeDemoTimer = null;
let welcomeDemoUserIntent = false;
let demoLoadPromise = null;
let activeWorkbookRead = null;
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');
// Dieselbe Schwelle wie in der Sidebar: darunter gilt die Handy-Bedienung.
const mobileQuery = phoneFaceQuery();

// SheetJS (xlsx) ist groß – erst laden, wenn wirklich importiert/exportiert wird
const excel = () => import('../services/excel.js');

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const IMPORT_ERROR_KEYS = Object.freeze({
    'Import worker could not start.': 'import.wait.workerFailed',
    'Import worker response could not be read.': 'import.wait.workerFailed',
    'Die Zwischenablage ist leer.': 'import.error.emptyClipboard',
    'Es wurde nur eine Zeile gefunden. Bitte die Überschriftenzeile mit markieren.': 'import.error.oneRow',
    'Es wurde nur eine Spalte erkannt. Bitte mehrere Spalten aus der Tabelle markieren.': 'import.error.oneColumn',
    'Unter der Überschriftenzeile stehen keine Datenzeilen.': 'import.error.noDataRows',
    'Die CSV-Datei enthält keine Tabelle.': 'import.error.noCsvTable',
    'Die Datei enthält kein Tabellenblatt.': 'import.error.noSheet',
    'Die CSV-Datei enthält keine Datenzeilen.': 'import.error.noCsvRows',
    'Das Tabellenblatt enthält keine Datenzeilen.': 'import.error.noSheetRows'
});

// Fehler, die der Browser beim Lesen der Datei meldet – nach ihrem Namen statt
// nach dem (englischen, technischen) Text. Im Firmenbereich (Intune, OneDrive,
// Teams, Outlook) ist `NotReadableError` der typische Fall.
const IMPORT_ERROR_NAMES = Object.freeze({
    NotReadableError: 'import.error.notReadable',
    NotFoundError: 'import.error.notReadable',
    SecurityError: 'import.error.notReadable'
});

function importErrorDetail(error) {
    const detail = String(error?.message || error || '');
    const byName = IMPORT_ERROR_NAMES[error?.name];
    if (byName) return t(byName);
    // Speicher erschöpft (RangeError „Array buffer allocation failed", „Invalid array length" …)
    if (error?.name === 'RangeError' || /out of memory|allocation failed|invalid array length/i.test(detail)) {
        return t('import.error.memory');
    }
    const key = IMPORT_ERROR_KEYS[detail];
    return key ? t(key) : detail;
}

export function initImportWizard() {
    dialog = document.getElementById('import-dialog');
    ownDataDialog = document.getElementById('own-data-dialog');
    const waiting = document.getElementById('import-wait-dialog');
    const cancelRead = () => activeWorkbookRead?.abort();
    document.getElementById('import-wait-cancel')?.addEventListener('click', cancelRead);
    waiting?.addEventListener('cancel', (event) => { event.preventDefault(); cancelRead(); });

    document.getElementById('btn-own-data')?.addEventListener('click', () => {
        // Nur reinschauen darf das Willkommen nicht dauerhaft beenden: kein
        // persistentes „erledigt" – die Pause gilt für diese Sitzung, nach
        // einem echten Neustart läuft das Intro wieder. Wer wirklich eigene
        // Daten lädt, blockiert die Automatik ohnehin über den Datenbestand.
        cancelWelcomeDemo();
        ownDataDialog?.showModal();
    });
    // Demo-Streifen (überall sichtbar bei Beispieldaten): führt in denselben
    // geführten Upload wie im Willkommen.
    document.getElementById('btn-demo-own-data')?.addEventListener('click', () => {
        cancelWelcomeDemo();
        ownDataDialog?.showModal();
    });
    // Zentraler Willkommens-Hinweis: „Eigene Daten laden" führt in denselben
    // geführten Upload (Quittieren übernimmt das Willkommens-Modul).
    document.getElementById('btn-demo-welcome-own')?.addEventListener('click', () => {
        cancelWelcomeDemo();
        ownDataDialog?.showModal();
    });
    document.getElementById('btn-showcase-ob')?.addEventListener('click', () => cancelWelcomeDemo());
    // „Später" im Demo-Panel heißt nicht „nie": Schließt sich die Demo-Auswahl
    // ohne gestartete Vorführung und ohne Daten, wird die Willkommens-Automatik
    // wieder scharf – die Karte belebt sich kurz darauf doch noch von selbst.
    document.getElementById('showcase-dialog')?.addEventListener('close', () => {
        if (state.customers.length > 0) return;
        if (document.querySelector('.sc-shield')) return; // Vorführung startet gerade
        if (hasHandledWelcomeDemo()) return;
        welcomeDemoUserIntent = false;
        scheduleWelcomeDemo();
    });
    document.getElementById('btn-demo-restore')?.addEventListener('click', restoreDemoAfterClear);
    ownDataDialog?.querySelector('.dialog-close')?.addEventListener('click', () => ownDataDialog.close());

    const fileInput = document.getElementById('file-input');
    const openFilePicker = () => withDataConsent(() => {
        if (ownDataDialog?.open) ownDataDialog.close();
        awaitingFilePick = true;
        fileInput.click();
    });
    document.getElementById('btn-upload').addEventListener('click', openFilePicker);
    // Wer den Datei-Dialog ohne Auswahl schließt, hat gerade gemerkt, dass er
    // keinen fertigen Export hat. Genau dann – und nur dann – ist der Hinweis
    // auf das Einfügen willkommen statt aufdringlich.
    fileInput.addEventListener('cancel', offerPasteAfterCancel);
    window.addEventListener('focus', () => {
        if (!awaitingFilePick) return;
        // „cancel" kennen nicht alle Browser: Kommt nach der Rückkehr ins Fenster
        // kein „change", war es ein Abbruch.
        setTimeout(() => { if (awaitingFilePick) offerPasteAfterCancel(); }, 500);
    });
    // Bei Beispieldaten führt „Eigene Daten laden" in den geführten Dialog
    // (Excel oder verschlüsselte Datei) statt direkt in den Datei-Picker.
    document.getElementById('btn-upload-more')?.addEventListener('click', () => {
        if (isDemoDataset(state.customers)) { cancelWelcomeDemo(); ownDataDialog?.showModal(); return; }
        openFilePicker();
    });
    document.getElementById('btn-safe-receive-ob')?.addEventListener('click', () => {
        if (ownDataDialog?.open) ownDataDialog.close();
    });
    fileInput.addEventListener('change', (e) => {
        awaitingFilePick = false;
        if (e.target.files[0]) handleFile(e.target.files[0]);
        fileInput.value = '';
    });

    initPasteImport();
    initCustomerListAssistant(openFilePicker);
    initConsent();
    applyDataWayOrder();
    mobileQuery.addEventListener('change', applyDataWayOrder);

    const downloadTemplate = async () => (await excel()).downloadTemplate();
    document.getElementById('btn-template').addEventListener('click', downloadTemplate);
    document.getElementById('btn-template-2')?.addEventListener('click', downloadTemplate);

    resultDialog = document.getElementById('import-result-dialog');
    resultDialog.querySelector('.dialog-close').addEventListener('click', () => resultDialog.close());
    document.getElementById('import-result-ok').addEventListener('click', () => resultDialog.close());
    const downloadErrorList = async () => {
        if (lastErrors.length) (await excel()).exportErrors(lastErrors, lastFileBase);
    };
    document.getElementById('import-error-download').addEventListener('click', downloadErrorList);
    document.getElementById('btn-import-notes')?.addEventListener('click', downloadErrorList);
    on('dataset:cleared', () => { lastErrors = []; syncImportNotesButton(); });
    syncImportNotesButton();

    // Drag & Drop auf die gesamte App
    const appEl = document.body;
    let dragDepth = 0;
    appEl.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragDepth++;
        document.getElementById('dropzone').classList.add('active');
    });
    appEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (--dragDepth <= 0) {
            dragDepth = 0;
            document.getElementById('dropzone').classList.remove('active');
        }
    });
    appEl.addEventListener('dragover', (e) => e.preventDefault());
    appEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDepth = 0;
        document.getElementById('dropzone').classList.remove('active');
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        withDataConsent(() => handleFile(file));
    });

    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    document.getElementById('mapping-confirm').addEventListener('click', confirmImport);

    on('app:ready', () => {
        // Hat der Browser die Seite mitten im Import verworfen? Dann sagen, was
        // passiert ist, statt still neu zu starten.
        const interrupted = takeInterruptedImport();
        if (interrupted) {
            showToast(t('import.interrupted', { file: interrupted.name, size: formatFileSize(interrupted.size, currentLocale()) }), 'error', 20000);
        }
        syncDemoRestoreOffer();
        // Migration für bereits leere Installationen: Frühere Versionen
        // merkten das Löschen, ließen das Willkommen aber dauerhaft erledigt.
        if (state.customers.length === 0 && hasClearedDataset()) {
            resetWelcomeDemoAfterDataClear();
        }
        scheduleWelcomeDemo();
    });
    on('customers:changed', syncDemoRestoreOffer);
    on('dataset:cleared', () => {
        // Zurücksetzen ist ein Neustart: Das Intro beginnt erneut von der leeren
        // Deutschlandkarte, die Beispielkunden erscheinen gleich wieder (inkl.
        // Entdeck-Hinweis auf der Karte). Wer stattdessen sofort eigene Daten
        // lädt, stoppt das automatisch (Nutzerabsicht/Dialog blockieren die Demo).
        welcomeDemoUserIntent = false;
        if (welcomeDemoTimer) clearTimeout(welcomeDemoTimer);
        welcomeDemoTimer = null;
        markDatasetCleared();
        resetWelcomeDemoAfterDataClear();
        syncDemoRestoreOffer();
        previewStatus({
            title: t('onboarding.resetTitle'),
            detail: t('onboarding.resetDetail')
        });
        scheduleWelcomeDemo();
    });
}

/**
 * Kein Export zur Hand: Die Firmen-KI baut die Liste. TourFuchs kopiert nur
 * den Prompt und öffnet den gewählten Assistenten (gleiche Wahl wie beim
 * Briefing); das Ergebnis kommt über die bekannten Wege herein – Einfügen
 * oder Datei – inklusive Berechtigungs-Zusicherung und Spalten-Prüfung.
 */
function initCustomerListAssistant(openFilePicker) {
    const kiDialog = document.getElementById('ki-list-dialog');
    if (!kiDialog) return;
    const prompt = buildCustomerListPrompt();
    const launch = document.getElementById('ki-list-launch');
    const chooser = document.getElementById('ki-list-assistant');
    let assistant = resolveAssistant();
    const syncLaunch = () => { launch.textContent = `📋 Prompt kopieren & ${assistant.label} öffnen`; };

    document.getElementById('ki-list-prompt').textContent = prompt;
    document.getElementById('btn-ki-list')?.addEventListener('click', () => {
        assistant = resolveAssistant();
        chooser.innerHTML = assistantChooserHtml(assistant, 'kilist', 'Gilt auch für die Briefings.');
        wireAssistantChooser(chooser, 'kilist', (next) => { assistant = next; syncLaunch(); });
        syncLaunch();
        if (ownDataDialog?.open) ownDataDialog.close();
        kiDialog.showModal();
    });
    kiDialog.querySelector('.dialog-close')?.addEventListener('click', () => kiDialog.close());
    launch.addEventListener('click', async () => {
        // Wie beim Briefing: Kopieren anstoßen, solange das Fenster den Fokus
        // hat, dann – noch in der Nutzergeste – den Assistenten öffnen.
        const copyPromise = copyText(prompt);
        launchAssistant(assistant);
        const copied = await copyPromise;
        showToast(copied
            ? `Prompt kopiert – in ${assistant.label} einfügen und absenden. Danach hier „Ergebnis einfügen".`
            : 'Kopieren hat nicht geklappt – den Prompt unter „Prompt ansehen" markieren und kopieren.',
        copied ? 'success' : 'error', 7000);
    });
    document.getElementById('ki-list-paste')?.addEventListener('click', () => {
        kiDialog.close();
        openPasteDialog();
    });
    document.getElementById('ki-list-file')?.addEventListener('click', () => {
        kiDialog.close();
        openFilePicker();
    });
}

function syncDemoRestoreOffer() {
    const visible = state.customers.length === 0 && hasClearedDataset();
    const button = document.getElementById('btn-demo-restore');
    const sub = document.getElementById('demo-restore-sub');
    if (button) button.hidden = !visible;
    if (sub) sub.hidden = !visible;
}

async function restoreDemoAfterClear() {
    const button = document.getElementById('btn-demo-restore');
    cancelWelcomeDemo({ handled: true });
    if (button) button.disabled = true;
    try {
        await loadDemo({ source: 'restore', confirmReplacement: false, announce: true });
    } finally {
        if (button) button.disabled = false;
        syncDemoRestoreOffer();
    }
}

// ---- Berechtigungs-Zusicherung ----
//
// Die Zusicherung „Ich bin berechtigt" bleibt – sie schafft Bewusstsein und ist
// dem Betreiber wichtig. Wie sie eingeholt wurde, war aber das Problem:
//
//  1. Sie galt nur für die laufende Sitzung. Wer täglich eine Liste lädt,
//     hakte sie jedes Mal neu an – eine Bestätigung, die zur Formalie
//     verkommt, bestätigt nichts mehr.
//  2. Sie meldete sich erst, *nachdem* der Nutzer „Datei auswählen" gedrückt
//     hatte: Toast, Wackelanimation, Klick ins Leere. Ein Fehlschlag ist ein
//     schlechtes Lehrmittel – und ausgerechnet der erste eigene Import
//     begann damit.
//
// Jetzt: **einmal bewusst geben, dann gilt sie** (persistiert mit Datum,
// jederzeit widerrufbar), und sie kommt **im Fluss der gewollten Aktion** –
// wer bestätigt, landet ohne zweiten Anlauf dort, wo er hinwollte. Der
// Zeitpunkt bleibt derselbe wie vorher: vor dem Einlesen der Datei.

const CONSENT_KEY = 'tf_data_consent';
let pendingConsentAction = null;

/** ISO-Datum der Zusicherung oder null. */
function consentGivenAt() {
    try { return globalThis.localStorage?.getItem(CONSENT_KEY) || null; } catch { return null; }
}
function hasComplianceOptIn() {
    return Boolean(consentGivenAt());
}
function setConsent(given) {
    try {
        if (given) globalThis.localStorage?.setItem(CONSENT_KEY, new Date().toISOString());
        else globalThis.localStorage?.removeItem(CONSENT_KEY);
    } catch { /* Speicherung ist optional – dann gilt sie für diese Sitzung */ }
    syncConsentUi();
}

/** Checkboxen und Beschriftung an den gespeicherten Stand angleichen. */
function syncConsentUi() {
    const at = consentGivenAt();
    const date = at ? new Date(at) : null;
    const stamp = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;
    document.querySelectorAll('[data-compliance-optin]').forEach((input) => {
        input.checked = Boolean(at);
        const text = input.parentElement?.querySelector('span');
        if (!text) return;
        text.textContent = at
            ? t('consent.confirmed', { date: stamp ? ` · ${stamp}` : '' })
            : t('consent.claim');
    });
}

/**
 * Import-Aktion ausführen – bei fehlender Zusicherung erst nach einer
 * einmaligen Bestätigung, die den angestoßenen Weg selbst fortsetzt.
 * @param {Function} action  läuft synchron weiter, damit ein Datei-Dialog
 *                           innerhalb der Nutzergeste geöffnet werden kann.
 */
function withDataConsent(action) {
    if (hasComplianceOptIn()) { action(); return; }
    pendingConsentAction = action;
    const dlg = document.getElementById('consent-dialog');
    if (!dlg?.showModal) { action(); return; }   // ohne Dialog nicht blockieren
    if (ownDataDialog?.open) ownDataDialog.close();
    dlg.showModal();
}

function initConsent() {
    syncConsentUi();
    document.querySelectorAll('[data-compliance-optin]').forEach((input) => {
        input.addEventListener('change', () => {
            setConsent(input.checked);
            showToast(input.checked
                ? t('import.consentGranted')
                : t('import.consentRevoked'), 'info', 5000);
        });
    });
    const dlg = document.getElementById('consent-dialog');
    document.getElementById('consent-cancel')?.addEventListener('click', () => {
        pendingConsentAction = null;
        dlg?.close();
    });
    document.getElementById('consent-confirm')?.addEventListener('click', () => {
        setConsent(true);
        dlg?.close();
        const action = pendingConsentAction;
        pendingConsentAction = null;
        action?.();
    });
    dlg?.addEventListener('close', () => { pendingConsentAction = null; });
}

/** Von außen geöffnete Datei (Shortcut „Import", Teilen-Ziel, Datei-Handler). */
export function openOwnDataDialog() {
    cancelWelcomeDemo();
    ownDataDialog?.showModal();
}

/**
 * Kundenliste, die das Betriebssystem übergibt (geteilt oder „Öffnen mit").
 * Die Berechtigungs-Zusicherung bleibt Pflicht – sie kommt jetzt aber als
 * Bestätigungsschritt, der die Datei danach selbst übernimmt, statt sie im
 * „Eigene Daten laden"-Dialog auf ein Häkchen warten zu lassen.
 */
export function importExternalFile(file) {
    if (!file) return;
    cancelWelcomeDemo();
    withDataConsent(() => handleFile(file));
}

/**
 * Nur für die Live-Demo „Deine Excel-Liste importieren": eine im Speicher
 * erzeugte Beispieldatei in den echten Zuordnungsschritt geben – ohne
 * Dateiauswahl (die würde den System-Dialog öffnen) und ohne Import: Die
 * Vorführung schließt den Dialog vor „Importieren".
 */
export function openMappingForShowcase(file) {
    return handleFile(file);
}

async function handleFile(file) {
    if (activeWorkbookRead) return;
    const isExcel = /\.(xlsx|xlsm|xls|csv|ods)$/i.test(file.name);
    if (!isExcel) {
        showToast(t('import.selectFile'), 'error');
        return;
    }
    try {
        const workbook = await readFileWithFeedback(file);
        // Besuchsbericht vom Handy: nur Besuche nachtragen, keine neue Kundenliste.
        if (isVisitReportHeaders(workbook.headers)) {
            ownDataDialog?.close();
            applyVisitReport(workbook.rows);
            return;
        }
        // Die Datei bleibt greifbar: Blatt und Überschriftenzeile lassen sich im
        // Zuordnungsschritt umstellen, ohne die Datei erneut auszuwählen.
        parsed = { ...workbook, fileName: file.name, file };
        await showMappingStep();
    } catch (error) {
        if (error.name === 'AbortError') return;
        showToast(t('import.readFailed', { detail: importErrorDetail(error) }), 'error');
    }
}

/** Replace the entry dialog while reading; cancel/error returns to the previous step. */
async function readFileWithFeedback(file, options = {}) {
    const waiting = document.getElementById('import-wait-dialog');
    const previous = dialog?.open ? dialog : ownDataDialog;
    const controller = new AbortController();
    activeWorkbookRead = controller;
    ownDataDialog?.close();
    dialog?.close();
    // Name und Größe: sofort sichtbar, ob es die richtige und vollständige Datei ist.
    document.getElementById('import-wait-file').textContent = t('import.wait.size', { file: file.name, size: formatFileSize(file.size, currentLocale()) });
    const hint = document.getElementById('import-wait-hint');
    if (hint) {
        hint.textContent = t('import.wait.largeMobile');
        hint.hidden = !(mobileQuery.matches && Number(file.size) >= LARGE_MOBILE_FILE_BYTES);
    }
    const phase = document.getElementById('import-wait-phase');
    phase.textContent = t('import.wait.reading');
    waiting.showModal();
    // Verwirft der Browser die Seite mitten im Lesen (Speichermangel), endet
    // dieser Code nie. Die Notiz überlebt das Neuladen und erklärt es beim Start.
    noteImportInFlight(file);
    let success = false;
    try {
        // Let the replacement paint before starting the worker, even on a warm cache.
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        const workbook = await readWorkbookInBackground(file, options, {
            signal: controller.signal,
            onPhase: (name) => { phase.textContent = t(`import.wait.${name}`); }
        });
        success = true;
        return workbook;
    } finally {
        clearImportInFlight();
        waiting.close();
        activeWorkbookRead = null;
        if (!success && previous && !previous.open) previous.showModal();
    }
}

/**
 * Blatt oder Überschriftenzeile neu wählen und die Zuordnung frisch aufbauen.
 * Schlägt das Lesen fehl (z. B. keine Datenzeilen unter der gewählten Zeile),
 * bleibt der bisherige Stand bestehen – nur die Auswahlfelder springen zurück.
 */
async function reloadWorkbookSource({ sheet = null, headerRow = null } = {}) {
    if (!parsed?.file || activeWorkbookRead) return;
    try {
        const workbook = await readFileWithFeedback(parsed.file, { sheet, headerRow });
        parsed = { ...workbook, fileName: parsed.fileName, file: parsed.file };
        await showMappingStep();
    } catch (error) {
        if (error.name !== 'AbortError') showToast(t('import.selectionFailed', { detail: importErrorDetail(error) }), 'error', 6000);
        renderMappingSource();
    }
}

/** Auswahlfelder für Tabellenblatt und Überschriftenzeile. */
function renderMappingSource() {
    const box = document.getElementById('mapping-source');
    if (!box) return;
    const { file, sheetNames = [], sheetName, headerRow, headerOptions = [] } = parsed ?? {};
    // Eine eingefügte Tabelle bringt ihre Überschrift schon mit – dort gibt es
    // weder ein zweites Blatt noch eine Zeile zum Verschieben.
    box.hidden = !file;
    if (!file) return;

    const sheetField = document.getElementById('mapping-sheet-field');
    const sheetSelect = document.getElementById('mapping-sheet');
    if (sheetField && sheetSelect) {
        sheetField.hidden = sheetNames.length < 2;
        sheetSelect.innerHTML = sheetNames.map((name) => (
            `<option value="${escapeHtml(name)}"${name === sheetName ? ' selected' : ''}>${escapeHtml(name)}</option>`
        )).join('');
        // Neues Blatt heißt neue Tabelle: Überschriftenzeile dort neu erkennen.
        sheetSelect.onchange = () => reloadWorkbookSource({ sheet: sheetSelect.value });
    }

    // Kein bekannter Feldname in der Kopfzeile: Der Import läuft trotzdem, aber
    // genau hier ging zuletzt eine falsch gelesene Datei unbemerkt durch.
    const warning = document.getElementById('mapping-source-warning');
    if (warning) {
        warning.hidden = parsed.headerConfident !== false;
        warning.textContent = t('import.headerWarning');
    }

    const rowSelect = document.getElementById('mapping-header-row');
    if (rowSelect) {
        rowSelect.innerHTML = headerOptions.map((option) => (
            `<option value="${option.row}"${option.row === headerRow ? ' selected' : ''}>${escapeHtml(t('import.rowOption', { row: option.row, preview: option.preview }))}</option>`
        )).join('');
        rowSelect.onchange = () => reloadWorkbookSource({ sheet: sheetName, headerRow: Number(rowSelect.value) });
    }
}

/**
 * Datei auswählen ist auf allen Geräten der klar hervorgehobene Hauptweg.
 * Das Einfügen einer kopierten Excel-Tabelle bleibt die sekundäre Alternative.
 */
function applyDataWayOrder() {
    const paste = document.getElementById('btn-paste');
    const upload = document.getElementById('btn-upload');
    const hint = document.getElementById('own-data-way-hint');
    if (!paste || !upload) return;

    upload.classList.add('primary');
    paste.classList.remove('primary');
    upload.style.order = '0';
    paste.style.order = '1';
    if (hint) {
        hint.textContent = t('ownData.wayHint');
    }
}

/** Geräteschritte für den Einfügen-Dialog: „Strg+V" gibt es am Handy nicht. */
function renderPasteSteps() {
    const list = document.getElementById('paste-steps');
    if (!list) return;
    const prefix = mobileQuery.matches ? 'import.pasteMobile' : 'import.pasteDesktop';
    list.replaceChildren(...[1, 2, 3].map((number) => {
        const item = document.createElement('li');
        item.textContent = t(`${prefix}${number}`);
        return item;
    }));
}

/**
 * Der Hinweis nach dem abgebrochenen Datei-Dialog. Einmal je Sitzung: Wer den
 * Weg kennt und trotzdem abbricht, hat andere Gründe.
 */
function offerPasteAfterCancel() {
    if (!awaitingFilePick) return;
    awaitingFilePick = false;
    if (pasteHintShown || mobileQuery.matches) return;
    if (document.querySelector('dialog[open]')) return;
    pasteHintShown = true;

    ownDataDialog?.showModal();
    const paste = document.getElementById('btn-paste');
    if (paste) {
        paste.classList.remove('attention');
        void paste.offsetWidth; // Animation bei erneutem Anlass neu starten
        paste.classList.add('attention');
    }
    showToast(t('import.pasteOffer'), 'info', 7000);
}

/**
 * Einfügen statt Datei: Wer seine Liste in Excel offen hat, kommt so ohne
 * Zwischenspeichern in den Import. Drei Wege führen hinein – der Knopf im
 * Willkommen, der Knopf im „Eigene Daten laden"-Dialog und ein globales
 * Strg+V in der App.
 */
function initPasteImport() {
    pasteDialog = document.getElementById('paste-dialog');
    if (!pasteDialog) return;
    const input = document.getElementById('paste-input');
    const confirm = document.getElementById('paste-confirm');
    const status = document.getElementById('paste-status');

    const review = () => {
        const text = input.value;
        if (!text.trim()) {
            status.textContent = '';
            status.classList.remove('paste-status-error', 'paste-status-ok');
            confirm.disabled = true;
            return;
        }
        try {
            const { headers, rows } = parseClipboardTable(text);
            status.textContent = t('import.pasteDetected', {
                rows: rows.length,
                columns: headers.length,
                first: headers[0]
            });
            status.classList.add('paste-status-ok');
            status.classList.remove('paste-status-error');
            confirm.disabled = false;
        } catch (error) {
            status.textContent = importErrorDetail(error);
            status.classList.add('paste-status-error');
            status.classList.remove('paste-status-ok');
            confirm.disabled = true;
        }
    };

    input.addEventListener('input', review);
    pasteDialog.querySelector('.dialog-close')?.addEventListener('click', () => pasteDialog.close());
    document.getElementById('paste-cancel')?.addEventListener('click', () => pasteDialog.close());
    confirm.addEventListener('click', () => {
        const text = input.value;
        pasteDialog.close();
        usePastedTable(text);
    });
    pasteDialog.addEventListener('close', () => { input.value = ''; review(); });

    document.getElementById('btn-paste')?.addEventListener('click', () => openPasteDialog());
    // Zweiter, gleichwertiger Einstieg direkt aus dem Willkommens-Hinweis.
    document.getElementById('btn-demo-welcome-paste')?.addEventListener('click', () => {
        cancelWelcomeDemo();
        openPasteDialog();
    });

    // Globales Strg+V: nur außerhalb von Eingabefeldern und nur, wenn wirklich
    // eine Tabelle in der Zwischenablage liegt – ein kopierter Satz löst nichts aus.
    document.addEventListener('paste', (event) => {
        const target = event.target;
        if (target?.closest?.('input, textarea, select, [contenteditable]')) return;
        if (pasteDialog.open) return;
        if ([...document.querySelectorAll('dialog[open]')].some((el) => el !== ownDataDialog)) return;
        const text = event.clipboardData?.getData('text/plain') || '';
        if (!looksLikeTable(text)) return;
        event.preventDefault();
        withDataConsent(() => {
            ownDataDialog?.close();
            usePastedTable(text);
        });
    });
}

function openPasteDialog() {
    withDataConsent(() => {
        if (ownDataDialog?.open) ownDataDialog.close();
        renderPasteSteps();
        pasteDialog?.showModal();
        document.getElementById('paste-input')?.focus();
    });
}

async function usePastedTable(text) {
    cancelWelcomeDemo();
    try {
        const { headers, rows } = parseClipboardTable(text);
        parsed = { headers, rows, fileName: t('import.pastedFile') };
        await showMappingStep();
    } catch (error) {
        showToast(t('import.pastedReadFailed', { detail: importErrorDetail(error) }), 'error', 6000);
    }
}

async function showMappingStep() {
    const { FIELDS, autoDetectMapping } = await excel();
    const { headers, rows, fileName, file, sheetName } = parsed;
    const mapping = autoDetectMapping(headers);

    const sheetInfo = file && sheetName ? t('import.sheetInfo', { sheet: sheetName }) : '';
    document.getElementById('mapping-file-info').textContent = t('import.fileInfo', {
        file: fileName,
        sheet: sheetInfo,
        rows: rows.length,
        columns: headers.length
    });
    renderMappingSource();

    // „Überblick → aufzoomen": Die wichtigsten Felder (Pflicht + die üblichen
    // Vertriebsfelder) stehen sofort sichtbar oben. Die vielen optionalen Felder
    // liegen eingeklappt darunter – erkannt werden sie trotzdem, das Summary sagt
    // wie viele. So wirkt der Dialog nicht erschlagend, ohne etwas zu verstecken.
    const IMPORTANT = new Set(['name', 'plz', 'strasse', 'ort', 'bezirk', 'gruppe', 'kundentyp', 'umsatz']);
    const rowHtml = (field) => {
        const options = [`<option value="">${escapeHtml(t('import.none'))}</option>`]
            .concat(headers.map((h) => {
                const selected = mapping[field.key] === h ? ' selected' : '';
                return `<option value="${escapeHtml(h)}"${selected}>${escapeHtml(h)}</option>`;
            })).join('');
        const badge = field.required ? ` <span class="req">${escapeHtml(t('import.required'))}</span>` : '';
        return `<tr>
            <td>${escapeHtml(t(`mapping.field.${field.key}`))}${badge}</td>
            <td><select data-field="${field.key}">${options}</select></td>
            <td class="preview" data-preview="${field.key}"></td>
        </tr>`;
    };
    const important = FIELDS.filter((f) => IMPORTANT.has(f.key));
    const optional = FIELDS.filter((f) => !IMPORTANT.has(f.key));
    document.getElementById('mapping-rows').innerHTML = important.map(rowHtml).join('');
    const optTbody = document.getElementById('mapping-rows-optional');
    if (optTbody) optTbody.innerHTML = optional.map(rowHtml).join('');
    const detected = optional.filter((f) => mapping[f.key]).length;
    const moreCount = document.getElementById('mapping-more-count');
    if (moreCount) moreCount.textContent = t('import.optional', {
        count: optional.length,
        detected: detected ? t('import.detected', { count: detected }) : ''
    });
    const moreDetails = document.getElementById('mapping-more');
    if (moreDetails) moreDetails.open = false;

    const fieldSelects = () => dialog.querySelectorAll('select[data-field]');
    const updatePreview = () => {
        fieldSelects().forEach((sel) => {
            const cell = dialog.querySelector(`[data-preview="${sel.dataset.field}"]`);
            if (!cell) return;
            const header = sel.value;
            if (!header) { cell.textContent = ''; return; }
            const samples = rows.slice(0, 3).map((r) => r[header]).filter((v) => v !== '');
            cell.textContent = samples.slice(0, 2).join(' · ');
        });
    };
    fieldSelects().forEach((sel) => sel.addEventListener('change', updatePreview));
    updatePreview();

    // Beim Wechsel von Blatt/Überschriftenzeile ist der Dialog bereits offen –
    // showModal() ein zweites Mal wäre ein Fehler.
    if (!dialog.open) dialog.showModal();
}

async function confirmImport() {
    const mapping = {};
    // Wichtige + optionale (eingeklappte) Felder zusammen einlesen.
    document.querySelectorAll('#import-dialog select[data-field]').forEach((sel) => {
        mapping[sel.dataset.field] = sel.value || null;
    });

    const contactOnly = !mapping.name && !mapping.gebiet && mapping.nummer && (mapping.ansprechpartner || mapping.telefon || mapping.email);
    if (!mapping.name && !mapping.gebiet && !contactOnly) {
        showToast(t('import.validationName'), 'error');
        return;
    }
    if (mapping.name && !mapping.plz && !(mapping.lat && mapping.lng)) {
        showToast(t('import.validationLocation'), 'error');
        return;
    }

    const { parseRows, attachContacts } = await excel();
    const { customers, areaRows, contactRows, errors, skipped } = parseRows(parsed.rows, mapping);

    lastFileBase = (parsed.fileName || 'TourFuchs').replace(/\.[^.]+$/, '');

    if (customers.length === 0 && areaRows.length === 0 && contactRows.length === 0) {
        dialog.close();
        lastErrors = errors;
        if (errors.length) {
            showImportResult({ customerCount: 0, contactCount: 0, areaCount: 0, skipped, errors });
        } else {
            showToast(t('import.noRows'), 'error');
        }
        return;
    }

    // „Die bisherige Kundenliste wurde ersetzt" stimmt nur, wenn es eine gab.
    const replacedExisting = customers.length > 0 && hasExistingDataset() && !onlyDemoDataPresent();
    // Der Befund gilt dem Moment, in dem zum ersten Mal die eigenen Daten auf
    // der Karte liegen. Bei echtem Reimport hat der Änderungsbericht die Frage
    // bereits besser beantwortet.
    const firstOwnData = customers.length > 0
        && (state.customers.length === 0 || isDemoDataset(state.customers));
    // Beispieldaten sind kein Bestand, den man schützen müsste. Wer sie durch
    // die eigene Liste ersetzt, tut genau das, wofür sie da waren – ein
    // Änderungsbericht mit „2250 entfallen" wäre dort eine Schreckmeldung
    // ohne Gegenstand, direkt vor dem ersten eigenen Erfolgserlebnis.
    const replacingDemoOnly = onlyDemoDataPresent();
    // Eigene, lokal erfasste Besuche bleiben beim Reimport erhalten – vor dem
    // Änderungsbericht, damit er nur noch echten Verlust (entfallene Kunden) zeigt.
    // Beispielbesuche wandern nie in echte Daten.
    const carriedVisits = customers.length > 0 && !replacingDemoOnly && !isDemoDataset(state.customers)
        ? carryOverVisits(state.customers, customers)
        : 0;
    if (customers.length > 0 && !replacingDemoOnly) {
        // Mit bestehendem Kundenbestand beantwortet der Änderungsbericht die
        // Frage „Was ändert sich?" und übernimmt zugleich die Bestätigung.
        // Ohne Vorbestand gibt es nichts zu vergleichen: kurze Standardabfrage.
        const confirmed = state.customers.length > 0
            ? await confirmImportWithDiff({
                previous: state.customers,
                incoming: customers,
                sourceLabel: t('import.selectedList')
            })
            : confirmDatasetReplacement({
                incomingCount: customers.length,
                sourceLabel: t('import.selectedList')
            });
        if (!confirmed) {
            showToast(t('import.canceled'), 'info', 5000);
            return;
        }
    }

    dialog.close();
    let areaCount = 0;

    if (customers.length > 0) {
        await geocodeByPlz(customers);
        // PLZ nicht gefunden -> als Hinweis in die Fehlerliste (Kunde wird trotzdem importiert)
        for (const c of customers) {
            if (c.plz && c.geo === 'none') {
                errors.push({ Zeile: c._sheetRow, Typ: 'Hinweis', Grund: `PLZ ${c.plz} nicht gefunden – Kunde nicht auf der Karte`, ...(c._raw || {}) });
            }
            delete c._sheetRow; delete c._raw;
        }
        if (contactRows.length) attachContacts(customers, contactRows, errors);
        removeDemoContracts();
        removeDemoServiceVisits();
        replaceCustomers(customers, { fileName: parsed.fileName });
        if (carriedVisits > 0) {
            showToast(t('import.visitsCarried', { count: carriedVisits }), 'info', 5000);
        }
        areaCount = await resolveAreas(areaRows, errors);
        if (areaCount > 0) emit('customers:changed');
        fitToCustomers();
    } else {
        // Reine Kontakt- und Gebietsdateien ergänzen bewusst den aktuellen
        // Kundenbestand; sie sind ohne diesen Bestand nicht eigenständig nutzbar.
        areaCount = await resolveAreas(areaRows, errors);
        if (contactRows.length > 0) {
            const { matched } = attachContacts(state.customers, contactRows, errors);
            setCustomers(state.customers, { fileName: state.fileName, importedAt: state.importedAt });
            showToast(t('import.contactsMatched', { count: matched }), matched ? 'success' : 'info', 6000);
        } else if (areaCount > 0) {
            emit('customers:changed');
        }
    }
    const persisted = await persistDataset();
    markShowcaseImportCompleted();

    lastErrors = errors;
    // Ohne dauerhafte Speicherung wäre „importiert" eine halbe Wahrheit – die
    // Erfolgsmeldung entfällt dann, der Grund steht bereits als Fehler da.
    if (persisted) {
        showImportResult({ customerCount: customers.length, contactCount: contactRows.length, areaCount, skipped, errors, replacedExisting });
    } else if (errors.some((e) => e.Typ === 'Fehler')) {
        showImportResult({ customerCount: customers.length, contactCount: contactRows.length, areaCount, skipped, errors, replacedExisting });
    }

    // Eigene Kundendaten importiert -> erst den Befund zeigen, dann zum
    // Verschlüsseln führen. Beides nacheinander, nie übereinander.
    if (customers.length > 0) {
        const offerVault = async () => {
            if (firstOwnData) await showImportInsight();
            emit('data:imported', { count: customers.length });
        };
        if (resultDialog?.open) resultDialog.addEventListener('close', offerVault, { once: true });
        else offerVault();
    }
}

/**
 * Flächenzeilen zu Gebietszuordnungen auflösen. „Gebiet" ist entweder ein
 * Landkreis-Name (→ Ebene Landkreise) oder eine PLZ / PLZ-Präfix (Ziffern →
 * Ebene nach Länge: 1/2/3/5). Widersprüche und unbekannte Gebiete landen in
 * der Fehlerliste. @returns Anzahl erfolgreich zugeordneter Gebiete
 */
async function resolveAreas(areaRows, errors) {
    if (!areaRows.length) return 0;
    const cache = {};
    const getGeo = async (lvl) => (cache[lvl] ||= await loadLevel(lvl));
    const assigned = new Map(); // 'level:key' -> { bezirk, vb, sheetRow, name }
    const plzLevel = { 1: 'plz1', 2: 'plz2', 3: 'plz3', 5: 'plz5' };
    const errRow = (sheetRow, grund, raw) => errors.push({ Zeile: sheetRow, Typ: 'Fehler', Grund: grund, ...raw });
    let count = 0;

    for (const ar of areaRows) {
        const g = String(ar.gebiet).trim();
        let level, key, name;
        try {
            if (/^\d+$/.test(g)) {
                const lvl = plzLevel[g.length];
                if (!lvl) { errRow(ar.sheetRow, `PLZ „${g}" hat ${g.length} Stellen – unterstützt sind 1, 2, 3 oder 5`, ar.raw); continue; }
                const geo = await getGeo(lvl);
                const feat = geo.features.find((f) => String(f.properties.plz) === g);
                if (!feat) { errRow(ar.sheetRow, `PLZ-Gebiet „${g}" nicht gefunden`, ar.raw); continue; }
                level = lvl; key = regionKey(lvl, feat); name = regionName(lvl, feat);
            } else {
                const geo = await getGeo('kreise');
                const gl = g.toLowerCase();
                const feat = geo.features.find((f) => (f.properties.gen || '').toLowerCase() === gl)
                    || geo.features.find((f) => regionName('kreise', f).toLowerCase().includes(gl));
                if (!feat) { errRow(ar.sheetRow, `Landkreis „${g}" nicht gefunden`, ar.raw); continue; }
                level = 'kreise'; key = regionKey('kreise', feat); name = regionName('kreise', feat);
            }
        } catch (e) {
            errRow(ar.sheetRow, `Gebietsdaten konnten nicht geladen werden: ${e.message}`, ar.raw); continue;
        }

        const rk = `${level}:${key}`;
        const prev = assigned.get(rk);
        if (prev && ((ar.bezirk && prev.bezirk && ar.bezirk !== prev.bezirk) || (ar.vb && prev.vb && ar.vb !== prev.vb))) {
            errRow(ar.sheetRow, `Gebiet „${name}" widersprüchlich zugeordnet (bereits Zeile ${prev.sheetRow}: ${prev.bezirk || prev.vb})`, ar.raw);
            continue;
        }
        assigned.set(rk, { bezirk: ar.bezirk, vb: ar.vb, sheetRow: ar.sheetRow, name });
        if (ar.bezirk) setTerritory(level, key, 'bezirk', ar.bezirk, name);
        if (ar.vb) setTerritory(level, key, 'vb', ar.vb, name);
        count++;
    }
    return count;
}

/** Zugang zur Hinweis-/Fehlerliste im Daten-Tab an den letzten Import anpassen. */
/**
 * Speichern – und beim Fehlschlag Klartext reden.
 *
 * `saveDataset()` liefert `false`, wenn der Tresor gesperrt ist, IndexedDB
 * blockiert oder der Speicher voll ist. Der Rückgabewert wurde hier an drei
 * Stellen verworfen: Der Import meldete Erfolg, zeigte Ergebnis und Befund –
 * und nach dem nächsten Neuladen fehlten die Daten oder der alte Stand war
 * zurück. Ein Import, der nur im Arbeitsspeicher gelandet ist, darf sich nicht
 * wie ein abgeschlossener anfühlen.
 *
 * Die Service-Importe prüften das längst; hier fehlte es.
 *
 * @returns {Promise<boolean>} true, wenn dauerhaft gespeichert wurde
 */
async function persistDataset() {
    const saved = await saveDataset(datasetSnapshot());
    if (saved) return true;
    showToast(vaultEnabled()
        ? t('import.saveVaultFailed')
        : t('import.saveFailed'),
    'error', 12000);
    return false;
}

function syncImportNotesButton() {
    const btn = document.getElementById('btn-import-notes');
    if (!btn) return;
    btn.hidden = lastErrors.length === 0;
    const nurHinweise = lastErrors.every((e) => e.Typ === 'Hinweis');
    btn.textContent = nurHinweise
        ? t('import.notesDownload')
        : t('import.errorsDownload');
}

/**
 * Ergebnis des Imports melden.
 *
 * Ein Modal ist die teuerste Art, etwas zu sagen – es hält an. Deshalb hebt es
 * sich hier für den einzigen Fall auf, der wirklich anhält: **Zeilen, die nicht
 * importiert wurden.** Die haben eine Folge (die Liste ist unvollständig) und
 * eine Aufgabe (korrigieren, neu laden).
 *
 * Reine **Hinweise** haben beides nicht: Jede Zeile ist drin. Der häufigste ist
 * „N Kunden ohne Vertriebsbezirk" – und genau der trifft die einfachste,
 * ausdrücklich unterstützte Liste (Name + PLZ), also den schnellsten Einstieg.
 * Dafür einen Dialog aufzuziehen, bestraft den einfachen Weg für etwas, das
 * kein Problem ist. Hinweise kommen deshalb als Toast; die Liste bleibt im
 * Daten-Tab herunterladbar, und der Befund („Das sagt Ihre Liste") sagt
 * dasselbe ohnehin besser.
 */
function showImportResult({ customerCount, contactCount = 0, areaCount, skipped, errors, replacedExisting = false }) {
    const fehler = errors.filter((e) => e.Typ === 'Fehler').length;
    const hinweise = errors.filter((e) => e.Typ === 'Hinweis').length;
    syncImportNotesButton();

    if (fehler === 0) {
        const parts = [];
        if (customerCount) parts.push(t('import.customers', { count: customerCount }));
        if (contactCount) parts.push(t('import.contacts', { count: contactCount }));
        if (areaCount) parts.push(t('import.areas', { count: areaCount }));
        // Ohne Fehler und ohne übernommene Zeile wäre „importiert" gelogen.
        if (parts.length === 0) {
            showToast(t('import.noRows'), 'error', 6000);
            return;
        }
        const replacement = replacedExisting ? t('import.replaced') : '';
        // Hinweise gehen nicht verloren: Anzahl nennen und sagen, wo die Liste liegt.
        const notes = hinweise ? t('import.notes', { count: hinweise }) : '';
        showToast(`${t('import.success', { items: parts.join(', ') })}${replacement}${notes}`, 'success', notes ? 8000 : 6000);
        return;
    }
    const stat = (count, key) => `<div class="stat"><b>${count}</b><span>${escapeHtml(t(key))}</span></div>`;
    document.getElementById('import-result-body').innerHTML = `
        <div class="stat-grid">
            ${stat(customerCount, 'import.statCustomers')}
            ${stat(contactCount, 'import.statContacts')}
            ${stat(areaCount, 'import.statAreas')}
            ${stat(fehler, 'import.statErrors')}
            ${stat(hinweise, 'import.statNotes')}
        </div>
        <p class="muted small"><b>${escapeHtml(t('import.incompleteTitle', { count: fehler }))}</b> – ${escapeHtml(t('import.incompleteBody'))}</p>
    `;
    resultDialog.showModal();
}

// Die Begrüßung verspricht nur, was auch passiert: Solange die Automatik
// scharf ist, kündigt sie die Beispielkunden an – ist sie pausiert, lädt die
// Zeile stattdessen aktiv zum Selbst-Starten ein.
const autoNoteArmed = () => t('onboarding.autoNote');
const autoNotePaused = () => t('onboarding.autoNotePaused');

function setAutoNote(text) {
    const note = document.getElementById('ob-auto-note');
    if (note) note.textContent = text;
}

function previewStatus({ title, detail, stateName = '' }) {
    const status = document.getElementById('demo-preview-status');
    if (!status) return;
    status.classList.toggle('is-loading', stateName === 'loading');
    status.classList.toggle('is-paused', stateName === 'paused');
    const copy = status.querySelector('span:last-child');
    if (copy) copy.innerHTML = `<b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small>`;
}

function cancelWelcomeDemo({ handled = false } = {}) {
    emit('welcome-demo:arriving', false);
    welcomeDemoUserIntent = true;
    if (welcomeDemoTimer) clearTimeout(welcomeDemoTimer);
    welcomeDemoTimer = null;
    if (handled) markWelcomeDemoHandled();
    setAutoNote(autoNotePaused());
    previewStatus({
        title: t('onboarding.pausedTitle'),
        detail: t('onboarding.pausedDetail'),
        stateName: 'paused'
    });
}

function welcomeDemoBlockers() {
    return {
        handled: hasHandledWelcomeDemo(),
        hasCustomers: state.customers.length > 0,
        locked: vaultEnabled(),
        userIntent: welcomeDemoUserIntent,
        blockingDialogOpen: Boolean(document.querySelector('dialog[open]')),
        documentHidden: document.hidden,
        insideMobilePreview
    };
}

function scheduleWelcomeDemo() {
    if (!canAutoLoadWelcomeDemo(welcomeDemoBlockers())) return;
    // Die Begrüßung steht ab jetzt sofort in der Mitte – nicht erst nach den
    // Beispieldaten. Sonst erschien zuerst das Willkommen im Panel und Sekunden
    // später dasselbe noch einmal als Karte: zwei Begrüßungen, ein Sprung.
    emit('welcome-demo:arriving', true);
    setAutoNote(autoNoteArmed());
    previewStatus({
        title: t('onboarding.readyTitle'),
        detail: t('onboarding.readyDetail')
    });
    welcomeDemoTimer = setTimeout(async () => {
        welcomeDemoTimer = null;
        if (!canAutoLoadWelcomeDemo(welcomeDemoBlockers())) return;
        previewStatus({
            title: t('onboarding.loadingTitle'),
            detail: t('onboarding.loadingDetail'),
            stateName: 'loading'
        });
        document.body.classList.add('demo-data-arriving');
        try {
            const loaded = await loadDemo({ source: 'welcome', confirmReplacement: false, announce: false });
            if (loaded) {
                emit('demo:auto-loaded');
                // Die Begrüßung in der Mitte sagt das schon; ein Toast nur, wenn
                // sie inzwischen weggeklickt wurde.
                if (!isDemoWelcomeOpen()) {
                    showToast(t('onboarding.demoReady'), 'success', 5200);
                }
            }
        } catch (error) {
            console.warn('Automatische Beispieldaten konnten nicht geladen werden:', error);
            previewStatus({
                title: t('onboarding.fallbackTitle'),
                detail: t('onboarding.fallbackDetail'),
                stateName: 'paused'
            });
        } finally {
            setTimeout(() => document.body.classList.remove('demo-data-arriving'), 1800);
        }
    }, welcomeDemoDelayMs({ mobile: isPhoneUi() }));
}

/** Lädt sichere Beispieldaten für Einstieg oder Live-Demo. */
export function loadDemo({ source = 'manual', confirmReplacement = true, announce = true } = {}) {
    if (demoLoadPromise) return demoLoadPromise;
    if (source === 'welcome' && state.customers.length > 0) return Promise.resolve(false);
    demoLoadPromise = performDemoLoad({ confirmReplacement, announce })
        .finally(() => { demoLoadPromise = null; });
    return demoLoadPromise;
}

async function performDemoLoad({ confirmReplacement, announce }) {
    // Beispieldaten sind nicht schützenswert: ein evtl. aktiver Tresor wird
    // deaktiviert, damit die Demo unverschlüsselt und ohne PIN-Sperre läuft.
    const { demoCustomers } = await excel();
    const customers = await demoCustomers();
    const disablesVault = vaultEnabled();
    if (confirmReplacement && !confirmDatasetReplacement({
        incomingCount: customers.length,
        sourceLabel: 'Die Beispieldaten',
        disablesVault,
        replacesContracts: true
    })) return false;
    if (disablesVault) removeVaultMeta();
    clearServiceContracts({ dirty: false });
    clearServiceVisits({ dirty: false });
    // Beispieldaten sind kein Import – „2250 Kunden importiert" wäre hier nur
    // ein weiterer Satz über dem, was Begrüßung bzw. Demo schon sagen.
    await applyCustomers(customers, 'Demo-Daten', { announce: false });
    const demoNow = new Date();
    const serviceContracts = createDemoServiceContracts(customers, demoNow);
    setServiceContracts(serviceContracts, {
        DEMO: createDemoServiceContractSourceMeta(serviceContracts, demoNow)
    });
    const serviceVisits = createDemoServiceVisits(customers, serviceContracts, demoNow);
    setServiceVisits(serviceVisits, {
        DEMO: createDemoServiceVisitSourceMeta(serviceVisits, demoNow)
    });
    await persistDataset();
    markWelcomeDemoHandled();
    emit('demo:loaded');
    if (announce) {
        showToast(t('onboarding.demoLoaded'), 'success', 6000);
    }
    return true;
}

function removeDemoContracts() {
    if (!state.serviceContractSources?.DEMO) return;
    const sources = { ...(state.serviceContractSources || {}) };
    delete sources.DEMO;
    setServiceContracts(
        state.serviceContracts.filter((contract) => contract.sourceSystem !== 'DEMO'),
        sources
    );
}

function removeDemoServiceVisits() {
    if (!state.serviceVisitSources?.DEMO) return;
    const sources = { ...(state.serviceVisitSources || {}) };
    delete sources.DEMO;
    setServiceVisits(
        state.serviceVisits.filter((visit) => visit.sourceSystem !== 'DEMO'),
        sources
    );
}

async function applyCustomers(customers, fileName, { announce = true } = {}) {
    const { located, missing } = await geocodeByPlz(customers);
    replaceCustomers(customers, { fileName });
    const persisted = await persistDataset();
    fitToCustomers();
    if (persisted && announce) {
        emit('toast', {
            type: 'success',
            text: `${customers.length} Kunden importiert, ${located + customers.filter((c) => c.geo === 'exakt').length} auf der Karte verortet.`
        });
    }
    if (missing.length > 0) {
        showToast(t('import.unknownPostal', {
            codes: `${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`
        }), 'error', 7000);
    }
}
