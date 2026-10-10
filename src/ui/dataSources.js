/**
 * Datenquellen unter „Daten" (Release 15): Link zur Ablage + „Aktualisieren".
 *
 * - „↗ Ablage öffnen" öffnet den hinterlegten Link in einem neuen Tab –
 *   TourFuchs selbst ruft ihn nie ab (kein Abruf, kein Login, kein CORS).
 * - „🔄 Aktualisieren" liest die neue Fassung über den gewohnten Import ein.
 *   Am PC (Edge, Chrome) merkt sich TourFuchs nach der ersten Auswahl die
 *   Datei im synchronisierten Ordner (OneDrive/SharePoint) als Dateiverweis in
 *   IndexedDB; danach genügt ein Klick. Ohne diese Browser-Funktion öffnet
 *   „Aktualisieren" die Dateiauswahl.
 * - Nach „Daten löschen" bleiben die Links (Einstellung), Dateiverweise und
 *   Zeitpunkte werden vergessen.
 */

import { on } from '../core/state.js';
import { currentLocale, t } from '../core/i18n.js';
import { loadFromCache, saveToCache, removeFromCache } from '../services/storage.js';
import { importExternalFile } from './importWizard.js';
import { showToast } from './toast.js';
import {
    MAX_DATA_SOURCES, addDataSource, forgetDataSourceFiles, loadDataSources,
    removeDataSource, saveDataSources, updateDataSource
} from '../features/dataSources.js';

const HANDLES_KEY = 'datenquellen-dateien';
const ACCEPT = '.xlsx,.xlsm,.xls,.csv,.ods';
const PICKER_TYPES = [{
    description: 'Excel / CSV',
    accept: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'],
        'application/vnd.ms-excel': ['.xls'],
        'text/csv': ['.csv'],
        'application/vnd.oasis.opendocument.spreadsheet': ['.ods']
    }
}];
// Wie lange ein angestoßenes „Aktualisieren" auf den Abschluss des Imports wartet
// (Einwilligung und Zuordnung brauchen Klicks).
const PENDING_MS = 30 * 60 * 1000;

let sources = [];
let pending = null;   // { id, fileName, at }

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

async function loadHandles() {
    try {
        const handles = await loadFromCache(HANDLES_KEY);
        return handles && typeof handles === 'object' ? handles : {};
    } catch {
        return {};
    }
}

async function storeHandle(id, handle) {
    const handles = await loadHandles();
    if (handle) handles[id] = handle;
    else delete handles[id];
    try {
        if (Object.keys(handles).length) await saveToCache(HANDLES_KEY, handles);
        else await removeFromCache(HANDLES_KEY);
        return true;
    } catch {
        return false;   // Ohne IndexedDB: dann eben jedes Mal auswählen.
    }
}

function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(currentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function setSources(next) {
    sources = saveDataSources(next);
    render();
}

function render() {
    const list = document.getElementById('data-sources-list');
    if (!list) return;
    list.innerHTML = sources.map((source) => {
        const meta = [
            source.lastRun ? t('sources.last', { date: formatDate(source.lastRun) }) : t('sources.never'),
            source.fileName ? t('sources.linked', { file: source.fileName }) : ''
        ].filter(Boolean).map(escapeHtml).join(' · ');
        const link = source.url
            ? `<a class="data-source-open" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('sources.open'))}</a>`
            : '';
        const unlink = source.fileName
            ? `<button type="button" class="data-source-minor" data-source-action="unlink">${escapeHtml(t('sources.unlink'))}</button>`
            : '';
        return `<li class="data-source" data-source-id="${escapeHtml(source.id)}">
            <div class="data-source-head"><strong>${escapeHtml(source.name)}</strong> <span class="muted small">${meta}</span></div>
            <div class="data-source-actions">
                <button type="button" class="data-source-refresh" data-source-action="refresh">${escapeHtml(t('sources.refresh'))}</button>
                ${link}
                ${unlink}
                <button type="button" class="data-source-minor" data-source-action="remove">${escapeHtml(t('sources.remove'))}</button>
            </div>
        </li>`;
    }).join('');
    const summary = document.getElementById('data-sources-summary');
    if (summary) {
        const last = sources.map((source) => source.lastRun).filter(Boolean).sort().pop();
        summary.textContent = !sources.length ? ''
            : last ? t('sources.count', { count: sources.length, date: formatDate(last) })
                : t('sources.countNever', { count: sources.length });
    }
    const form = document.getElementById('data-source-form');
    if (form) form.hidden = sources.length >= MAX_DATA_SOURCES;
}

function startImport(source, file, { remembered = false } = {}) {
    pending = { id: source.id, fileName: file.name, remembered, at: Date.now() };
    importExternalFile(file);
}

/** Ohne File System Access API: einmalige Dateiauswahl, nichts wird gemerkt. */
function pickOnce(source) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.addEventListener('change', () => {
        const [file] = input.files || [];
        if (file) startImport(source, file);
    }, { once: true });
    input.click();
}

async function pickAndRemember(source) {
    try {
        const [handle] = await window.showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
        if (!handle) return;
        const file = await handle.getFile();
        const remembered = await storeHandle(source.id, handle);
        if (remembered) setSources(updateDataSource(sources, source.id, { fileName: file.name }));
        startImport(source, file, { remembered });
    } catch (error) {
        if (error?.name === 'AbortError') return;
        pickOnce(source);
    }
}

async function refresh(source) {
    const handle = (await loadHandles())[source.id];
    if (handle?.getFile) {
        try {
            const granted = (await handle.queryPermission?.({ mode: 'read' })) === 'granted'
                || (await handle.requestPermission?.({ mode: 'read' })) === 'granted';
            if (!granted) {
                showToast(t('sources.denied'), 'error', 6000);
                return;
            }
            startImport(source, await handle.getFile(), { remembered: true });
            return;
        } catch (error) {
            // Datei verschoben/umbenannt: Verweis vergessen und neu auswählen lassen.
            await storeHandle(source.id, null);
            setSources(updateDataSource(sources, source.id, { fileName: '' }));
            showToast(t(error?.name === 'NotAllowedError' ? 'sources.denied' : 'sources.gone'), 'error', 6000);
            return;
        }
    }
    if (typeof window.showOpenFilePicker === 'function') await pickAndRemember(source);
    else pickOnce(source);
}

function onImported({ fileName } = {}) {
    if (!pending) return;
    const { id, fileName: expected, remembered, at } = pending;
    pending = null;
    if (Date.now() - at > PENDING_MS || fileName !== expected) return;
    // „verknüpft: …" nur, wenn der Browser sich die Datei wirklich gemerkt hat.
    setSources(updateDataSource(sources, id, { lastRun: new Date().toISOString(), fileName: remembered ? fileName : '' }));
}

async function forgetFiles() {
    pending = null;
    try { await removeFromCache(HANDLES_KEY); } catch { /* optional */ }
    setSources(forgetDataSourceFiles(sources));
}

export function initDataSources() {
    const list = document.getElementById('data-sources-list');
    const form = document.getElementById('data-source-form');
    if (!list || !form) return;
    sources = loadDataSources();
    render();

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const nameInput = document.getElementById('data-source-name');
        const urlInput = document.getElementById('data-source-url');
        const result = addDataSource(sources, { name: nameInput?.value, url: urlInput?.value });
        if (!result.ok) {
            const message = { link: 'sources.badLink', empty: 'sources.empty', full: 'sources.full' }[result.reason];
            showToast(t(message, { count: MAX_DATA_SOURCES }), 'error');
            return;
        }
        setSources(result.list);
        form.reset();
    });

    list.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-source-action]');
        if (!button) return;
        const id = button.closest('[data-source-id]')?.dataset.sourceId;
        const source = sources.find((entry) => entry.id === id);
        if (!source) return;
        const action = button.dataset.sourceAction;
        if (action === 'refresh') {
            await refresh(source);
        } else if (action === 'unlink') {
            await storeHandle(id, null);
            setSources(updateDataSource(sources, id, { fileName: '' }));
        } else if (action === 'remove') {
            if (!confirm(t('sources.confirmRemove', { name: source.name }))) return;
            await storeHandle(id, null);
            setSources(removeDataSource(sources, id));
        }
    });

    on('import:completed', onImported);
    on('dataset:cleared', forgetFiles);
    on('locale:changed', render);
}
