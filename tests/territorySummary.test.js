import { describe, expect, it } from 'vitest';
import { buildTerritorySummary } from '../src/features/territorySummary.js';

describe('große Gebietskachel', () => {
    const customers = [
        { plz: '10115', ort: 'Berlin', umsatz: 100, gruppe: 'Nord', channel: 'Direkt' },
        { plz: '10115', ort: 'Berlin', umsatz: 300, gruppe: 'Nord', channel: 'Direkt' },
        { plz: '14467', ort: 'Potsdam', umsatz: null, gruppe: 'Nord', channel: 'Partner' }
    ];

    it('zeigt Umsatz, Durchschnitt und fehlende Umsatzangaben getrennt', () => {
        const summary = buildTerritorySummary(customers, {
            count: 3,
            revenue: 400,
            hasRevenue: true,
            regionCount: 2
        });

        expect(summary.revenue).toBe(400);
        expect(summary.revenueKnownCount).toBe(2);
        expect(summary.averageRevenue).toBe(200);
        expect(summary.regionCount).toBe(2);
    });

    it('verdichtet Standorte und Hierarchie für die Detailansicht', () => {
        const summary = buildTerritorySummary(customers);

        expect(summary.placeCount).toBe(2);
        expect(summary.topPlaces).toEqual([
            { name: '10115 Berlin', customerCount: 2 },
            { name: '14467 Potsdam', customerCount: 1 }
        ]);
        expect(summary.groups).toEqual(['Nord']);
        expect(summary.channels).toEqual(['Direkt', 'Partner']);
    });
});
