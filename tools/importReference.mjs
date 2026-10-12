/** Nur Importzeitpunkte normalisieren. Fachliche Datumswerte bleiben auch
 * dann unverändert, wenn sie zufällig mit dem Tag des Prüflaufs übereinstimmen. */
export function normalizeImportSnapshot(value, today, field = '') {
    if (Array.isArray(value)) return value.map((v) => normalizeImportSnapshot(v, today, field));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, normalizeImportSnapshot(v, today, key)]));
    }
    if (field === 'importedAt' && typeof value === 'string' && value.startsWith(today) && /^\d{4}-\d{2}-\d{2}T/.test(value)) return '<Importzeit>';
    return value;
}
