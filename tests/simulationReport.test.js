/**
 * Entscheidungsvorlage (Roadmap 3.1).
 *
 * Geprüft wird der Rechenweg und das, was die Vorlage zusagt: beide Stände
 * nebeneinander, keine Kundennamen im Druckbild, und die Trennung zwischen
 * aggregierter Vorlage und namentlicher Umbuchungsliste.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/core/config.js';
import { fairness } from '../src/features/territory.js';
import {
    buildSimulationReport,
    reassignmentRows,
    reportHtml,
    printSimulationReport
} from '../src/features/simulationReport.js';

const stats = (entries) => new Map(entries.map(([key, count, umsatz]) => [key, { count, umsatz }]));

const BASE = stats([['Nord', 10, 100000], ['Süd', 4, 40000], ['Ost', 2, 8000]]);
const SIM = stats([['Nord', 6, 60000], ['Süd', 6, 60000], ['Ost', 4, 28000]]);

const MOVES = [
    { id: 'k1', name: 'Meier GmbH', nummer: '1001', plz: '52070', ort: 'Aachen', from: 'Nord', to: 'Süd', umsatz: 25000 },
    { id: 'k2', name: 'Schulz AG', nummer: '1002', plz: '50667', ort: 'Köln', from: 'Nord', to: 'Ost', umsatz: 15000 }
];

const META = {
    attrLabel: 'Vertriebsbezirk',
    levelLabel: 'Landkreise',
    fileName: 'kunden-august.xlsx',
    createdAt: new Date('2026-08-12T09:30:00Z'),
    maxRatio: CONFIG.territory.balancedMaxRatio,
    unassigned: '(ohne)'
};

function model(overrides = {}) {
    return buildSimulationReport({
        baseStats: BASE,
        simStats: SIM,
        keys: ['Nord', 'Süd', 'Ost'],
        moves: MOVES,
        territories: [
            { name: 'Städteregion Aachen', level: 'kreise', levelLabel: 'Landkreise', value: 'Süd', customerCount: 1 }
        ],
        opsLog: [{ desc: '2 Gebiete (Nord)', count: 2, revenue: 40000, toRep: 'Süd' }],
        meta: META,
        ...overrides
    });
}

describe('Fairness als gemeinsamer Rechenweg', () => {
    const maxRatio = CONFIG.territory.balancedMaxRatio;

    it('misst den Faktor zwischen größter und kleinster Einheit', () => {
        const result = fairness(BASE, ['Nord', 'Süd', 'Ost'], { maxRatio });
        expect(result.ratio).toBe(5);
        expect(result.balanced).toBe(false);
        expect(result.count.max.key).toBe('Nord');
        expect(result.count.min.key).toBe('Ost');
        expect(result.units).toBe(3);
    });

    it('schweigt bei weniger als zwei Einheiten mit Kunden', () => {
        // Ein Faktor über einer einzigen Einheit ist keine Aussage, sondern 1.
        expect(fairness(stats([['Nord', 10, 100]]), ['Nord'], { maxRatio })).toBeNull();
        expect(fairness(stats([['Nord', 0, 0], ['Süd', 3, 10]]), ['Nord', 'Süd'], { maxRatio })).toBeNull();
    });

    it('lässt die ausgeschlossene Einheit außen vor', () => {
        const withUnassigned = stats([['Nord', 10, 100], ['Süd', 4, 40], ['(ohne)', 99, 0]]);
        const result = fairness(withUnassigned, ['Nord', 'Süd', '(ohne)'], { maxRatio, exclude: '(ohne)' });
        expect(result.units).toBe(2);
        expect(result.count.max.key).toBe('Nord');
    });

    it('nimmt Umsatz erst, wenn ihn zwei Einheiten führen', () => {
        const single = stats([['Nord', 10, 100000], ['Süd', 4, 0]]);
        expect(fairness(single, ['Nord', 'Süd'], { maxRatio }).revenue).toBeNull();
        expect(fairness(BASE, ['Nord', 'Süd', 'Ost'], { maxRatio }).revenue.max.key).toBe('Nord');
    });

    it('nutzt dieselbe Schwelle wie die Konfiguration', () => {
        const even = stats([['Nord', 3, 10], ['Süd', 2, 10]]);
        expect(fairness(even, ['Nord', 'Süd'], { maxRatio }).balanced).toBe(true);
    });
});

describe('Modell der Entscheidungsvorlage', () => {
    it('stellt beide Stände je Einheit nebeneinander', () => {
        const nord = model().rows.find((row) => row.key === 'Nord');
        expect(nord.countBefore).toBe(10);
        expect(nord.countAfter).toBe(6);
        expect(nord.countDelta).toBe(-4);
        expect(nord.revenueDelta).toBe(-40000);
        expect(nord.changed).toBe(true);
    });

    it('rechnet die Fairness für vorher und nachher getrennt', () => {
        const { before, after } = model().fairness;
        expect(before.ratio).toBe(5);
        expect(before.balanced).toBe(false);
        expect(after.ratio).toBe(1.5);
        expect(after.balanced).toBe(true);
    });

    it('zählt betroffene Einheiten, nicht Tabellenzeilen', () => {
        const unchanged = model({ simStats: BASE });
        expect(unchanged.rows).toHaveLength(3);
        expect(unchanged.totals.unitsTouched).toBe(0);
    });

    it('summiert den bewegten Umsatz aus den Umbuchungen', () => {
        expect(model().totals.customersMoved).toBe(2);
        expect(model().totals.revenueMoved).toBe(40000);
        expect(model().totals.territories).toBe(1);
    });

    it('kommt ohne jede Angabe aus, ohne zu werfen', () => {
        const empty = buildSimulationReport();
        expect(empty.rows).toEqual([]);
        expect(empty.totals.revenueMoved).toBe(0);
        expect(empty.fairness.before).toBeNull();
    });
});

describe('Umbuchungsliste für Excel', () => {
    it('nennt bisherigen und neuen Wert unter dem Namen des Attributs', () => {
        const rows = reassignmentRows(model());
        expect(rows[0]['Kunde']).toBe('Meier GmbH');
        expect(rows[0]['Vertriebsbezirk – bisher']).toBe('Nord');
        expect(rows[0]['Vertriebsbezirk – neu']).toBe('Süd');
        expect(rows[0]['Umsatz (€)']).toBe(25000);
    });

    it('ist leer, wenn nur Gebiete ohne Kunden zugewiesen wurden', () => {
        expect(reassignmentRows(model({ moves: [] }))).toEqual([]);
    });
});

describe('Druckansicht', () => {
    const html = () => reportHtml(model());

    it('sagt im Klartext, dass nichts übernommen ist', () => {
        // Der teuerste denkbare Irrtum an diesem Dokument: dass jemand die
        // Vorlage für den vollzogenen Zustand hält.
        expect(html()).toContain('nicht übernommen');
    });

    it('nennt keinen einzigen Kundennamen', () => {
        // Die Datenschutz-Entscheidung des Features: Die Vorlage wird
        // herumgereicht, die namentliche Liste nicht.
        const printed = html();
        for (const move of MOVES) {
            expect(printed).not.toContain(move.name);
            expect(printed).not.toContain(move.nummer);
        }
    });

    it('weist die Fairness-Schwelle als Setzung aus', () => {
        const german = String(CONFIG.territory.balancedMaxRatio).replace('.', ',');
        expect(html()).toContain(`Faktor ${german}`);
        expect(html()).toContain('keine Messung');
    });

    it('zeigt beide Stände und die Differenz', () => {
        const printed = html();
        expect(printed).toContain('Kunden vorher');
        expect(printed).toContain('−4');
        expect(printed).toContain('vorher');
        expect(printed).toContain('nachher');
    });

    it('trägt die Demo-Warnung, sobald Demo-Daten im Bestand sind', () => {
        expect(html()).not.toContain('DEMO - NICHT PRODUKTIV');
        const demo = reportHtml(model({ meta: { ...META, demo: true } }));
        expect(demo).toContain('DEMO - NICHT PRODUKTIV');
    });

    it('hält den Kartenbild-Hinweis aus dem Druckbild heraus', () => {
        // Der Hinweis gehört an den Bildschirm, nicht auf ein Blatt, das in
        // einer Sitzung liegt: `noprint` blendet ihn beim Drucken aus.
        const printed = html();
        const index = printed.indexOf('Kartenbild Alt/Neu');
        expect(index).toBeGreaterThan(-1);
        expect(printed.lastIndexOf('noprint', index)).toBeGreaterThan(-1);
    });

    it('maskiert Anführungszeichen und spitze Klammern in Werten', () => {
        const attacked = reportHtml(model({
            keys: ['<script>alert(1)</script>'],
            baseStats: stats([['<script>alert(1)</script>', 1, 10]]),
            simStats: stats([['<script>alert(1)</script>', 1, 10]])
        }));
        expect(attacked).not.toContain('<script>alert(1)</script>');
        expect(attacked).toContain('&lt;script&gt;');
    });
});

describe('Fenster öffnen', () => {
    it('meldet false, wenn der Browser das Fenster blockiert', () => {
        expect(printSimulationReport(model(), () => null)).toBe(false);
    });

    it('schreibt das Dokument und schließt den Strom', () => {
        const written = [];
        let closed = false;
        const fake = { document: { write: (html) => written.push(html), close: () => { closed = true; } } };
        expect(printSimulationReport(model(), () => fake)).toBe(true);
        expect(written[0]).toContain('Entscheidungsvorlage');
        expect(closed).toBe(true);
    });
});
