/**
 * Importvorlagen (Release 15.1): Spalten einmal zuordnen, danach nur noch
 * „Aktualisieren".
 *
 * Nach einer bestätigten Zuordnung merkt sich TourFuchs die Spaltenüberschriften
 * der Datei und die gewählte Zuordnung. Kommt dieselbe Liste wieder (gleiche
 * Überschriften, gleich in welcher Reihenfolge), gilt die Zuordnung ohne
 * Dialog. Hat sich die Liste nur etwas verändert (Spalten neu oder entfallen),
 * öffnet sich die Zuordnung einmal – vorbelegt, mit Hinweis, was anders ist.
 *
 * Gespeichert werden nur Überschriften und Zuordnung, lokal im Browser
 * (localStorage) – keine Kundendaten. Mehrere Vorlagen nebeneinander
 * (Kundenstamm, Zuständigkeiten, Promotoren, Umsätze …). Reine Logik, ohne DOM.
 */

export const IMPORT_TEMPLATES_KEY = 'tf_import_templates';
export const MAX_IMPORT_TEMPLATES = 8;
/** Ab diesem Anteil gemeinsamer Spalten gilt eine Liste als „dieselbe, verändert". */
export const SIMILAR_SHARE = 0.6;

const text = (value) => String(value ?? '').trim();
const norm = (value) => text(value).toLowerCase().replace(/\s+/g, ' ');

/** Schlüssel einer Überschriftenmenge – Reihenfolge und Groß/Klein egal. */
export function headerSignature(headers = []) {
    return [...new Set(headers.map(norm).filter(Boolean))].sort().join('\u001f');
}

function store() {
    try { return globalThis.localStorage || null; } catch { return null; }
}

function normalizeTemplate(template) {
    const headers = (Array.isArray(template?.headers) ? template.headers : []).map(text).filter(Boolean);
    if (!headers.length || !template?.mapping || typeof template.mapping !== 'object') return null;
    const mapping = {};
    for (const [field, header] of Object.entries(template.mapping)) {
        mapping[field] = header ? text(header) : null;
    }
    return {
        id: text(template.id) || `v-${Math.random().toString(36).slice(2, 10)}`,
        name: text(template.name).slice(0, 80) || 'Importvorlage',
        headers,
        signature: headerSignature(headers),
        mapping,
        sheetName: text(template.sheetName),
        headerRow: Number(template.headerRow) || 0,
        usedAt: text(template.usedAt),
        uses: Number(template.uses) || 0
    };
}

export function loadImportTemplates() {
    try {
        const list = JSON.parse(store()?.getItem(IMPORT_TEMPLATES_KEY) || '[]');
        return (Array.isArray(list) ? list : []).map(normalizeTemplate).filter(Boolean).slice(0, MAX_IMPORT_TEMPLATES);
    } catch {
        return [];
    }
}

export function saveImportTemplates(list) {
    const clean = (Array.isArray(list) ? list : []).map(normalizeTemplate).filter(Boolean).slice(0, MAX_IMPORT_TEMPLATES);
    try { store()?.setItem(IMPORT_TEMPLATES_KEY, JSON.stringify(clean)); } catch { /* optional */ }
    return clean;
}

/**
 * Passende Vorlage zu den Überschriften einer Datei.
 * @returns {null | { template, exact: boolean, added: string[], missing: string[] }}
 *   `exact`: gleiche Spalten – Zuordnung ohne Dialog. Sonst: ähnliche Liste,
 *   `added`/`missing` nennen, was neu ist bzw. fehlt.
 */
export function findImportTemplate(list = [], headers = []) {
    const signature = headerSignature(headers);
    if (!signature) return null;
    const exact = list.find((template) => template.signature === signature);
    if (exact) return { template: exact, exact: true, added: [], missing: [] };

    const current = new Map(headers.map((header) => [norm(header), text(header)]));
    let best = null;
    for (const template of list) {
        const before = new Map(template.headers.map((header) => [norm(header), header]));
        const shared = [...current.keys()].filter((key) => before.has(key)).length;
        const share = shared / Math.max(current.size, before.size, 1);
        if (share >= SIMILAR_SHARE && (!best || share > best.share)) {
            best = {
                share,
                template,
                added: [...current.keys()].filter((key) => !before.has(key)).map((key) => current.get(key)),
                missing: [...before.keys()].filter((key) => !current.has(key)).map((key) => before.get(key))
            };
        }
    }
    return best ? { template: best.template, exact: false, added: best.added, missing: best.missing } : null;
}

/**
 * Zuordnung der Vorlage auf die Überschriften der Datei übertragen: was die
 * Vorlage zuordnet und die Datei noch hat, gilt; was die Vorlage bewusst leer
 * ließ, bleibt leer; alles andere kommt aus der automatischen Erkennung.
 */
export function mappingFromTemplate(template, headers = [], detected = {}) {
    const byNorm = new Map(headers.map((header) => [norm(header), header]));
    const mapping = {};
    const fromTemplate = new Set();
    const used = new Set();
    for (const [field, header] of Object.entries(template?.mapping || {})) {
        if (header === null) { mapping[field] = null; fromTemplate.add(field); continue; }
        const actual = byNorm.get(norm(header));
        if (actual) { mapping[field] = actual; used.add(actual); fromTemplate.add(field); }
    }
    // Eine Spalte gehört genau einem Feld: Was die Vorlage vergeben hat, nimmt
    // die automatische Erkennung keinem anderen Feld mehr.
    for (const [field, header] of Object.entries(detected)) {
        if (fromTemplate.has(field)) continue;
        mapping[field] = header && !used.has(header) ? header : null;
    }
    return mapping;
}

/**
 * Bestätigte Zuordnung merken. Gleiche Spalten oder die ausdrücklich
 * fortgeschriebene Vorlage (`replaceId`) werden ersetzt; die am längsten nicht
 * benutzte fällt bei voller Liste heraus.
 */
export function rememberImportTemplate(list = [], { headers, mapping, detected = {}, name, sheetName = '', headerRow = 0, replaceId = '', now = new Date().toISOString() }) {
    const signature = headerSignature(headers);
    const previous = list.find((template) => template.id === replaceId || template.signature === signature);
    // „Bewusst leer" nur, wo die Erkennung etwas fand und der Nutzer es abwählte –
    // ein Feld ohne passende Spalte bleibt offen für eine später neue Spalte.
    const kept = {};
    for (const [field, header] of Object.entries(mapping || {})) {
        if (header) kept[field] = header;
        else if (detected[field]) kept[field] = null;
    }
    const template = normalizeTemplate({
        id: previous?.id,
        name: name || previous?.name,
        headers,
        mapping: kept,
        sheetName,
        headerRow,
        usedAt: now,
        uses: (previous?.uses || 0) + 1
    });
    if (!template) return list;
    const rest = list.filter((entry) => entry.id !== template.id && entry.signature !== signature);
    const sorted = rest.sort((a, b) => String(b.usedAt).localeCompare(String(a.usedAt)));
    return [template, ...sorted].slice(0, MAX_IMPORT_TEMPLATES);
}

/** Vorlage benutzt (ohne Dialog): Zeitpunkt und Zähler fortschreiben. */
export function touchImportTemplate(list = [], id, now = new Date().toISOString()) {
    return list.map((template) => (template.id === id ? { ...template, usedAt: now, uses: template.uses + 1 } : template));
}

export function removeImportTemplate(list = [], id) {
    return list.filter((template) => template.id !== id);
}

/** Name einer Vorlage aus dem Dateinamen: ohne Endung, Datum und Kopie-Zähler. */
export function templateNameFromFile(fileName = '') {
    const base = text(fileName).replace(/\.[^.]+$/, '');
    const cleaned = base
        .replace(/[\s_-]*\(\d+\)$/, '')
        .replace(/[\s_-]*\d{4}[-_.]?\d{2}([-_.]?\d{2})?$/, '')
        .replace(/[\s_-]*\d{1,2}[._]\d{1,2}[._]\d{2,4}$/, '')
        .replace(/[\s_-]+$/, '');
    return cleaned || base || 'Importvorlage';
}
