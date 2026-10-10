import { customerMatchesRevenueFilter } from '../core/customerFilters.js';
import { UNASSIGNED, dimensionValues } from '../core/state.js';

/** Werte eines Kunden in einer Ebene; leer = „Ohne Zuordnung". Mehrere bei Promotoren. */
export function planningDimensionValues(customer, def) {
    const values = dimensionValues(customer, def);
    return values.length ? values : [UNASSIGNED];
}

export function enabledPlanningDimensionDefs(defs, dims, enabledIds) {
    const enabled = new Set(enabledIds || []);
    return defs.filter((def) => enabled.has(def.id) && dims?.[def.id]?.active);
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
        return planningDimensionValues(customer, def).some((value) => selected.has(value));
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
        for (const value of planningDimensionValues(customer, def)) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
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
            .filter((customer) => planningDimensionValues(customer, def).includes(value))
            .map((customer) => String(customer.vb ?? '').trim())
            .filter(Boolean));
        parts.push(...reps);
    }
    return parts.join(' ').toLocaleLowerCase();
}
