/**
 * Datenquellen (Release 15): Wo liegen die aktuellen Daten?
 *
 * Der Nutzer hinterlegt unter „Daten" je Quelle einen Namen und den Link zur
 * Ablage (z. B. die SharePoint-Datei „Vertriebs-Arbeitsmappe"). TourFuchs ruft
 * den Link nie selbst ab – er öffnet ihn auf Klick im Browser, wie ein
 * Lesezeichen. Das Einlesen der neuen Fassung bleibt lokal: Am PC (Edge,
 * Chrome) merkt sich TourFuchs nach der ersten Auswahl die Datei im
 * synchronisierten Ordner, danach genügt „Aktualisieren".
 *
 * Gespeichert werden nur Name, Link und Zeitpunkt der letzten Aktualisierung
 * (localStorage) – keine Kundendaten. Reine Logik, ohne DOM.
 */

export const DATA_SOURCES_KEY = 'tf_data_sources';
export const MAX_DATA_SOURCES = 8;

const text = (value) => String(value ?? '').trim();

/** Nur http(s)-Links – nie „javascript:" o. Ä. */
export function validSourceLink(value) {
    const raw = text(value);
    if (!raw) return '';
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch {
        return '';
    }
}

function normalize(source) {
    const name = text(source?.name).slice(0, 80);
    const url = validSourceLink(source?.url);
    if (!name && !url) return null;
    return {
        id: text(source?.id) || `q-${Math.random().toString(36).slice(2, 10)}`,
        name: name || hostOf(url),
        url,
        lastRun: text(source?.lastRun),
        fileName: text(source?.fileName)
    };
}

function hostOf(url) {
    try { return new URL(url).hostname; } catch { return 'Datenquelle'; }
}

function store() {
    try { return globalThis.localStorage || null; } catch { return null; }
}

export function loadDataSources() {
    try {
        const list = JSON.parse(store()?.getItem(DATA_SOURCES_KEY) || '[]');
        return (Array.isArray(list) ? list : []).map(normalize).filter(Boolean).slice(0, MAX_DATA_SOURCES);
    } catch {
        return [];
    }
}

export function saveDataSources(list) {
    const clean = (Array.isArray(list) ? list : []).map(normalize).filter(Boolean).slice(0, MAX_DATA_SOURCES);
    try { store()?.setItem(DATA_SOURCES_KEY, JSON.stringify(clean)); } catch { /* optional */ }
    return clean;
}

/**
 * Quelle anlegen. Ein Link ist optional (Datei nur lokal), ein Name auch –
 * aber eines von beiden muss es geben.
 * @returns {{ ok: true, source: object } | { ok: false, reason: 'empty'|'link'|'full' }}
 */
export function addDataSource(list, { name, url }) {
    if (list.length >= MAX_DATA_SOURCES) return { ok: false, reason: 'full' };
    if (text(url) && !validSourceLink(url)) return { ok: false, reason: 'link' };
    const source = normalize({ name, url });
    if (!source) return { ok: false, reason: 'empty' };
    return { ok: true, source, list: [...list, source] };
}

export function updateDataSource(list, id, changes) {
    return list.map((source) => (source.id === id ? normalize({ ...source, ...changes }) || source : source));
}

export function removeDataSource(list, id) {
    return list.filter((source) => source.id !== id);
}

/** Nach „Daten löschen": Links bleiben (Einstellung), Datei und Zeitpunkt nicht. */
export function forgetDataSourceFiles(list) {
    return list.map((source) => ({ ...source, lastRun: '', fileName: '' }));
}
