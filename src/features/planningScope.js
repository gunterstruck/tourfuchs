import { customerMatchesRevenueFilter } from '../core/customerFilters.js';
import { UNASSIGNED } from '../core/state.js';

export function planningDimensionValue(customer, def) {
    const raw = def?.custom ? customer?.extra?.[def.field] : customer?.[def?.field];
    return String(raw ?? '').trim() || UNASSIGNED;
}

/** Leere Auswahl bedeutet bewusst „alle Werte dieser Kategorie“. */
export function planningSelectionsFromDimensions(defs, dims, legacyDistrict = '__all__') {
    const selections = new Map();
    for (const def of defs) {
        const values = dims?.[def.id]?.values;
        if (!(values instanceof Map)) {
            selections.set(def.id, new Set());
            continue;
        }
        const visible = [...values].filter(([, entry]) => entry.visible).map(([name]) => name);
        selections.set(def.id, visible.length === values.size ? new Set() : new Set(visible));
    }
    if (legacyDistrict && legacyDistrict !== '__all__' && selections.has('bezirk')) {
        selections.set('bezirk', new Set([legacyDistrict]));
    }
    return selections;
}

export function customerMatchesPlanningSelections(customer, defs, selections, revenueFilter = {}) {
    if (!customerMatchesRevenueFilter(customer, revenueFilter)) return false;
    return defs.every((def) => {
        const selected = selections.get(def.id);
        if (!selected?.size) return true;
        return selected.has(planningDimensionValue(customer, def));
    });
}

export function planningScopeCustomers(customers, defs, selections, revenueFilter = {}) {
    return customers.filter((customer) => customerMatchesPlanningSelections(
        customer, defs, selections, revenueFilter
    ));
}

/** Anzahl je Wert, während alle AND-Filter außer der aktuellen Kategorie gelten. */
export function planningValueCounts(customers, defs, selections, dimensionId, revenueFilter = {}) {
    const otherDefs = defs.filter((def) => def.id !== dimensionId);
    const counts = new Map();
    const def = defs.find((entry) => entry.id === dimensionId);
    if (!def) return counts;
    for (const customer of customers) {
        if (!customerMatchesPlanningSelections(customer, otherDefs, selections, revenueFilter)) continue;
        const value = planningDimensionValue(customer, def);
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
}

export function applyPlanningSelections(defs, dims, selections) {
    for (const def of defs) {
        const values = dims?.[def.id]?.values;
        if (!(values instanceof Map)) continue;
        const selected = selections.get(def.id);
        const all = !selected?.size;
        for (const [name, entry] of values) entry.visible = all || selected.has(name);
    }
}

export function planningValueSearchText(value, def, customers) {
    const parts = [value];
    if (def?.id === 'bezirk') {
        const reps = new Set(customers
            .filter((customer) => planningDimensionValue(customer, def) === value)
            .map((customer) => String(customer.vb ?? '').trim())
            .filter(Boolean));
        parts.push(...reps);
    }
    return parts.join(' ').toLocaleLowerCase();
}
