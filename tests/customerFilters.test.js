import { afterEach, describe, expect, it } from 'vitest';
import {
    customerMatchesRevenueFilter,
    normalizeMinimumRegionCustomers,
    normalizeRevenueFilter,
    regionMeetsMinimum
} from '../src/core/customerFilters.js';
import { isVisible, state } from '../src/core/state.js';

const originalDims = state.dims;
const originalRevenueFilter = state.filters.revenue;

afterEach(() => {
    state.dims = originalDims;
    state.filters.revenue = originalRevenueFilter;
});

describe('Umsatzintervall', () => {
    it('lässt bei ausgeschaltetem Filter alle Werte einschließlich fehlender Angaben durch', () => {
        expect(customerMatchesRevenueFilter({ umsatz: null }, { enabled: false, min: 100000 })).toBe(true);
        expect(customerMatchesRevenueFilter({ umsatz: 5 }, { enabled: false, min: 100000 })).toBe(true);
    });

    it('filtert inklusive der eingegebenen Von- und Bis-Grenze', () => {
        const filter = { enabled: true, min: 100, max: 200 };

        expect(customerMatchesRevenueFilter({ umsatz: 99 }, filter)).toBe(false);
        expect(customerMatchesRevenueFilter({ umsatz: 100 }, filter)).toBe(true);
        expect(customerMatchesRevenueFilter({ umsatz: 200 }, filter)).toBe(true);
        expect(customerMatchesRevenueFilter({ umsatz: 201 }, filter)).toBe(false);
    });

    it('unterscheidet einen echten Null-Umsatz von einem fehlenden Wert', () => {
        const filter = { enabled: true, min: 0, max: 10 };

        expect(customerMatchesRevenueFilter({ umsatz: 0 }, filter)).toBe(true);
        expect(customerMatchesRevenueFilter({ umsatz: '5' }, filter)).toBe(true);
        expect(customerMatchesRevenueFilter({ umsatz: null }, filter)).toBe(false);
        expect(customerMatchesRevenueFilter({ umsatz: '' }, filter)).toBe(false);
        expect(customerMatchesRevenueFilter({ umsatz: 'unbekannt' }, filter)).toBe(false);
    });

    it('ordnet vertauschte Grenzen automatisch sinnvoll an', () => {
        expect(normalizeRevenueFilter({ enabled: true, min: 100000, max: 0 }))
            .toEqual({ enabled: true, min: 0, max: 100000 });
    });

    it('ist in die zentrale Kundensichtbarkeit integriert', () => {
        state.dims = {};
        state.filters.revenue = { enabled: true, min: 100000, max: null };

        expect(isVisible({ umsatz: 99999 })).toBe(false);
        expect(isVisible({ umsatz: 100000 })).toBe(true);
        expect(isVisible({ umsatz: null })).toBe(false);
    });
});

describe('Mindestbesetzung einer Gebietsfläche', () => {
    it('normalisiert die Eingabe auf eine sichere ganze Kundenzahl', () => {
        expect(normalizeMinimumRegionCustomers('2.6')).toBe(3);
        expect(normalizeMinimumRegionCustomers(-2)).toBe(0);
        expect(normalizeMinimumRegionCustomers(2000)).toBe(999);
        expect(normalizeMinimumRegionCustomers('keine Zahl')).toBe(0);
    });

    it('färbt erst ab der einschließlich geltenden Mindestzahl', () => {
        expect(regionMeetsMinimum({ total: 2 }, 3)).toBe(false);
        expect(regionMeetsMinimum({ total: 3 }, 3)).toBe(true);
        expect(regionMeetsMinimum(null, 0)).toBe(true);
    });
});
