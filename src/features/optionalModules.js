/**
 * Persistente Opt-ins für seltene Profi-Module.
 *
 * Die Module schalten ausschließlich Zugänge und Sichtbarkeit. Kundendaten,
 * Touren und Gebietszuordnungen bleiben davon unberührt.
 */
export const OPTIONAL_MODULES = Object.freeze({
    territoryPlanning: Object.freeze({
        storageKey: 'gf_territory_planning_enabled',
        bodyClass: 'territory-planning-on'
    }),
    service: Object.freeze({
        storageKey: 'gf_service_enabled',
        bodyClass: 'service-on'
    })
});

function moduleDefinition(moduleId) {
    const definition = OPTIONAL_MODULES[moduleId];
    if (!definition) throw new Error(`Unbekanntes optionales Modul: ${moduleId}`);
    return definition;
}

/** Fehlender oder unlesbarer Speicher bedeutet immer: Modul aus. */
export function optionalModuleEnabled(moduleId, storage = globalThis.localStorage) {
    const { storageKey } = moduleDefinition(moduleId);
    try {
        return storage?.getItem(storageKey) === '1';
    } catch (_error) {
        return false;
    }
}

/** Schreibt dieselbe kompakte 1/0-Konvention wie das bisherige Service-Opt-in. */
export function persistOptionalModule(moduleId, enabled, storage = globalThis.localStorage) {
    const { storageKey } = moduleDefinition(moduleId);
    try {
        storage?.setItem(storageKey, enabled ? '1' : '0');
    } catch (_error) {
        // Die Oberfläche bleibt auch bei gesperrtem localStorage bedienbar.
    }
}

/** Laufender UI-Zustand; bleibt auch ohne verfügbaren localStorage eindeutig. */
export function optionalModuleActive(moduleId, root = globalThis.document?.body) {
    return !!root?.classList?.contains(moduleDefinition(moduleId).bodyClass);
}
