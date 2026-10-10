/**
 * Notiz über einen laufenden Datei-Import, die ein Neuladen überlebt.
 *
 * Am Handy verwirft der Browser eine Seite, wenn ihr der Speicher ausgeht
 * (Edge: „Um Speicherplatz zu sparen, hat Microsoft Edge einige Inhalte
 * entfernt"). Der Import endet dann ohne jede Meldung, und die App startet
 * neu, als wäre nichts gewesen. Die Notiz wird vor dem Lesen gesetzt und nach
 * jedem Ende (Erfolg, Fehler, Abbruch) entfernt. Findet der nächste Start sie
 * noch vor, wurde der Import abgebrochen – und TourFuchs sagt das.
 *
 * Gespeichert werden nur Dateiname, Größe und Zeitpunkt, lokal im Browser.
 */

export const IMPORT_IN_FLIGHT_KEY = 'tf_import_inflight';
/** Ältere Notizen sind kein Hinweis mehr auf „gerade eben abgebrochen". */
export const IMPORT_IN_FLIGHT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Ab dieser Größe warnt der Wartedialog am Handy vorab. */
export const LARGE_MOBILE_FILE_BYTES = 10 * 1024 * 1024;

export function formatFileSize(bytes, locale = 'de-DE') {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024).toLocaleString(locale)} KB`;
    return `${(size / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}

export function noteImportInFlight(file, { storage = globalThis.localStorage, now = Date.now() } = {}) {
    try {
        storage?.setItem(IMPORT_IN_FLIGHT_KEY, JSON.stringify({ name: String(file?.name || ''), size: Number(file?.size) || 0, at: now }));
    } catch { /* ohne Speicher: keine Notiz */ }
}

export function clearImportInFlight({ storage = globalThis.localStorage } = {}) {
    try { storage?.removeItem(IMPORT_IN_FLIGHT_KEY); } catch { /* egal */ }
}

/**
 * Beim Start: Gab es einen Import, der nie zu Ende kam? Liefert ihn einmalig
 * (die Notiz wird dabei entfernt) oder null.
 */
export function takeInterruptedImport({ storage = globalThis.localStorage, now = Date.now() } = {}) {
    let note = null;
    try {
        const raw = storage?.getItem(IMPORT_IN_FLIGHT_KEY);
        if (raw) note = JSON.parse(raw);
    } catch { note = null; }
    clearImportInFlight({ storage });
    if (!note || !Number.isFinite(note.at) || now - note.at > IMPORT_IN_FLIGHT_MAX_AGE_MS || now < note.at) return null;
    return { name: String(note.name || ''), size: Number(note.size) || 0 };
}

/**
 * Datei, bei deren Lesen die Seite verworfen wurde: Beim nächsten Versuch mit
 * derselben Datei (Name und Größe) liest TourFuchs gleich nur das Kundenblatt
 * – sonst endete jeder Versuch wieder im Neuladen.
 */
export const HEAVY_FILE_KEY = 'tf_import_heavy';

export function rememberHeavyFile(note, { storage = globalThis.localStorage } = {}) {
    try {
        storage?.setItem(HEAVY_FILE_KEY, JSON.stringify({ name: String(note?.name || ''), size: Number(note?.size) || 0 }));
    } catch { /* ohne Speicher: kein Merken */ }
}

export function isHeavyFile(file, { storage = globalThis.localStorage } = {}) {
    try {
        const note = JSON.parse(storage?.getItem(HEAVY_FILE_KEY) || 'null');
        return !!note && note.name === String(file?.name || '') && note.size === (Number(file?.size) || 0);
    } catch {
        return false;
    }
}

/** 0:07, 1:45 … – Minuten und Sekunden für die laufende Uhr im Wartedialog. */
export function formatElapsed(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
