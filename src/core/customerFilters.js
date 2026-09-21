/**
 * Zahlenfilter, die unabhängig von Karte und DOM dieselbe Bedeutung behalten.
 * Leere Grenzen sind offen. Sobald der Umsatzfilter aktiv ist, gelten fehlende
 * oder nicht numerische Umsätze bewusst nicht als 0 Euro, sondern als unbekannt
 * und werden ausgeschlossen.
 */

const optionalNumber = (value) => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

export function normalizeRevenueFilter(filter = {}) {
    const enabled = filter?.enabled === true;
    let min = optionalNumber(filter?.min);
    let max = optionalNumber(filter?.max);
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    return { enabled, min, max };
}

export function customerMatchesRevenueFilter(customer, filter = {}) {
    const normalized = normalizeRevenueFilter(filter);
    if (!normalized.enabled) return true;
    const revenue = optionalNumber(customer?.umsatz);
    if (revenue === null) return false;
    if (normalized.min !== null && revenue < normalized.min) return false;
    if (normalized.max !== null && revenue > normalized.max) return false;
    return true;
}

export function normalizeMinimumRegionCustomers(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(999, Math.round(number)));
}

export function regionMeetsMinimum(entry, minimum) {
    return Number(entry?.total || 0) >= normalizeMinimumRegionCustomers(minimum);
}
