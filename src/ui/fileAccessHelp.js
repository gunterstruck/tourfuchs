/**
 * Datei gesperrt – eine große Prüffrage statt eines langen Meldungstexts.
 *
 * Im Firmenbereich (Intune-Arbeitsprofil, OneDrive, Teams, Outlook) liefert der
 * Browser oft eine Datei, die er dann nicht lesen darf (NotReadableError). Die
 * Abhilfe ist schnell: Datei herunterladen und aus „Downloads" wählen. Lange
 * Toasts liest niemand – deshalb ein eigenes Fenster mit genau dieser Frage und
 * einem Knopf, der die Auswahl gleich wieder öffnet.
 */
import { currentLocale, t } from '../core/i18n.js';
import { formatFileSize } from '../features/importInFlight.js';

const ACCESS_ERROR_NAMES = new Set(['NotReadableError', 'NotFoundError', 'SecurityError']);

/** Fehler, bei denen der Browser die gewählte Datei nicht lesen darf. */
export function isFileAccessError(error) {
    return ACCESS_ERROR_NAMES.has(error?.name);
}

/** Datei · Größe · [Fehlername] – für Rückfragen, klein unter der Prüffrage. */
export function fileAccessDetail(file, error) {
    const parts = [file?.name || '?', formatFileSize(Number(file?.size) || 0, currentLocale())];
    if (error?.name) parts.push(`[${error.name}]`);
    return parts.join(' · ');
}

let retryAction = null;

/**
 * Zeigt das Fenster. `retry` öffnet die passende Dateiauswahl erneut; ohne
 * `retry` bleibt nur „Schließen". Gibt false zurück, wenn das Fenster fehlt.
 */
export function showFileAccessHelp(file, error, { retry } = {}) {
    const dialog = document.getElementById('file-access-dialog');
    if (!dialog) return false;
    const detail = document.getElementById('file-access-detail');
    if (detail) detail.textContent = fileAccessDetail(file, error);
    retryAction = typeof retry === 'function' ? retry : null;
    const retryButton = document.getElementById('file-access-retry');
    if (retryButton) retryButton.hidden = !retryAction;
    if (!dialog.dataset.wired) {
        dialog.dataset.wired = '1';
        document.getElementById('file-access-close')?.addEventListener('click', () => dialog.close());
        retryButton?.addEventListener('click', () => {
            const action = retryAction;
            dialog.close();
            action?.();
        });
    }
    if (dialog.open) dialog.close();
    dialog.showModal();
    return true;
}
