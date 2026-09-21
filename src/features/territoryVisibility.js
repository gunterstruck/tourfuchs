/**
 * Sichtbarkeit der Gebietskarte unter aktiven Hierarchie-Filtern.
 *
 * Die Filtereintraege in `state.dims` sind die eine Quelle fuer Kunden und
 * Gebiete. Sobald mindestens ein Wert einer Dimension abgewaehlt ist, gilt die
 * Dimension als aktiver Filter. Gebiete mit bereits gefilterten Kunden bleiben
 * sichtbar; kundenlose, explizit zugewiesene Flaechen nur dann, wenn ihre
 * Zuweisung ebenfalls zur Auswahl passt.
 */

const normalized = (value, unassigned) => String(value ?? '').trim() || unassigned;

export function activeDimensionFilters(dims = {}, definitions = []) {
    const filters = [];
    for (const definition of definitions) {
        const dimension = dims?.[definition.id];
        if (!dimension?.active || !(dimension.values instanceof Map)) continue;
        const entries = [...dimension.values.entries()];
        if (entries.length === 0 || entries.every(([, meta]) => meta?.visible !== false)) continue;
        filters.push({
            id: definition.id,
            label: dimension.label || definition.label || definition.id,
            visible: new Set(entries.filter(([, meta]) => meta?.visible !== false).map(([value]) => value)),
            total: entries.length
        });
    }
    return filters;
}

export function regionMatchesActiveFilters({
    customers = [],
    territory = null,
    filters = [],
    unassigned = 'Ohne Zuordnung'
} = {}) {
    if (!Array.isArray(filters) || filters.length === 0) return true;

    let everyFilterHasAnExplicitMatch = true;
    for (const filter of filters) {
        const assigned = territory?.[filter.id];
        if (assigned === undefined || assigned === null || String(assigned).trim() === '') {
            everyFilterHasAnExplicitMatch = false;
            continue;
        }
        if (!filter.visible.has(normalized(assigned, unassigned))) return false;
    }

    return (Array.isArray(customers) && customers.length > 0) || everyFilterHasAnExplicitMatch;
}
