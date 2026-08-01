import { beforeEach, describe, expect, it } from 'vitest';
import {
    clearDayLog,
    dayLogStats,
    kmProStopp,
    readDayLog,
    recordDayReview,
    ueberfaelligAnteil
} from '../src/features/dayLog.js';

beforeEach(() => localStorage.clear());

/** Ein `dayReview()`-Ergebnis, so weit das Tageslog es liest. */
function review({ day = '2026-08-01', visitedCount = 0, plannedCount = 0, spontan = 0, overdueCleared = 0, km = 0 } = {}) {
    return {
        day,
        visitedCount,
        plannedCount,
        overdueCleared,
        roadKmEstimate: km,
        spontaneous: Array.from({ length: spontan }, (_, index) => ({ id: `s${index}` }))
    };
}

describe('Tageslog – Aufzeichnung', () => {
    it('hält die Form eines Tages in sechs Zahlen fest', () => {
        const entry = recordDayReview(review({ visitedCount: 4, plannedCount: 6, spontan: 1, overdueCleared: 2, km: 83.4 }));
        expect(entry).toEqual({ tag: '2026-08-01', besuche: 4, geplant: 6, spontan: 1, ueberfaellig: 2, km: 83 });
        expect(readDayLog()).toEqual([entry]);
    });

    it('speichert keine Kunden-IDs – nur Zahlen', () => {
        recordDayReview(review({ visitedCount: 2, plannedCount: 2, spontan: 1 }));
        const raw = localStorage.getItem('tf_tageslog');
        expect(raw).not.toMatch(/s0|id/i);
        expect(Object.keys(readDayLog()[0]).sort())
            .toEqual(['besuche', 'geplant', 'km', 'spontan', 'tag', 'ueberfaellig']);
    });

    it('ersetzt den Eintrag des Tages, statt ihn zu verdoppeln', () => {
        recordDayReview(review({ visitedCount: 1 }));
        recordDayReview(review({ visitedCount: 3 }));
        expect(readDayLog()).toHaveLength(1);
        expect(readDayLog()[0].besuche).toBe(3);
    });

    it('schreibt nicht, wenn sich an der Form des Tages nichts geändert hat', () => {
        expect(recordDayReview(review({ visitedCount: 2 }))).not.toBeNull();
        expect(recordDayReview(review({ visitedCount: 2 }))).toBeNull();
    });

    it('ignoriert leere Tage und kaputte Datumsangaben', () => {
        expect(recordDayReview(review())).toBeNull();
        expect(recordDayReview(review({ day: 'heute', visitedCount: 3 }))).toBeNull();
        expect(recordDayReview(null)).toBeNull();
        expect(readDayLog()).toEqual([]);
    });

    it('hält einen geplanten, aber nicht gefahrenen Tag fest', () => {
        // Genau der Datenpunkt, an dem sich „Plan hält" von „Plan zerfällt"
        // unterscheidet – er darf nicht als leerer Tag durchfallen.
        const entry = recordDayReview(review({ plannedCount: 5 }));
        expect(entry).toMatchObject({ besuche: 0, geplant: 5 });
    });

    it('sortiert nach Datum und übersteht kaputten Speicherinhalt', () => {
        recordDayReview(review({ day: '2026-08-03', visitedCount: 1 }));
        recordDayReview(review({ day: '2026-08-02', visitedCount: 1 }));
        expect(readDayLog().map((entry) => entry.tag)).toEqual(['2026-08-02', '2026-08-03']);

        localStorage.setItem('tf_tageslog', '{kein json');
        expect(readDayLog()).toEqual([]);
    });

    it('wird beim Zurücksetzen der Daten geleert', () => {
        recordDayReview(review({ visitedCount: 2 }));
        clearDayLog();
        expect(readDayLog()).toEqual([]);
    });
});

describe('Tageslog – die beiden Kennzahlen des Tors', () => {
    it('rechnet den Überfälligen-Anteil der besuchten Kunden', () => {
        expect(ueberfaelligAnteil({ besuche: 4, ueberfaellig: 3 })).toBe(0.75);
        expect(ueberfaelligAnteil({ besuche: 0, ueberfaellig: 0 })).toBeNull();
    });

    it('rechnet Kilometer je Besuch', () => {
        expect(kmProStopp({ besuche: 4, km: 80 })).toBe(20);
        expect(kmProStopp({ besuche: 0, km: 80 })).toBeNull();
        expect(kmProStopp({ besuche: 4, km: 0 })).toBeNull();
    });
});

describe('Tageslog – Auswertung am Tor', () => {
    it('zählt Tage mit Besuch für die Abbruchbedingung „zu wenig Signal"', () => {
        recordDayReview(review({ day: '2026-08-01', visitedCount: 3 }));
        recordDayReview(review({ day: '2026-08-02', plannedCount: 4 }));
        recordDayReview(review({ day: '2026-08-03', visitedCount: 2 }));

        const stats = dayLogStats();
        expect(stats.tage).toBe(3);
        expect(stats.tageMitBesuch).toBe(2);
        expect(stats.ersterTag).toBe('2026-08-01');
        expect(stats.letzterTag).toBe('2026-08-03');
    });

    it('meldet Streuung 0, wenn alle Tage gleich aussehen – B3 stirbt an dieser Zahl', () => {
        for (const day of ['2026-08-01', '2026-08-02', '2026-08-03']) {
            recordDayReview(review({ day, visitedCount: 4, plannedCount: 4, overdueCleared: 2, km: 80 }));
        }
        const stats = dayLogStats();
        expect(stats.streuungUeberfaelligAnteil).toBe(0);
        expect(stats.streuungKmProStopp).toBe(0);
    });

    it('meldet Streuung > 0, wenn die Tage zwischen Archetypen springen', () => {
        // kurzer Weg: viele Stopps, wenig km je Stopp, kaum Überfällige
        recordDayReview(review({ day: '2026-08-01', visitedCount: 8, plannedCount: 8, overdueCleared: 1, km: 60 }));
        // Chancen-Tag: wenige Stopps, weite Wege, fast alles überfällig
        recordDayReview(review({ day: '2026-08-02', visitedCount: 3, plannedCount: 3, overdueCleared: 3, km: 210 }));

        const stats = dayLogStats();
        expect(stats.streuungUeberfaelligAnteil).toBeGreaterThan(0);
        expect(stats.streuungKmProStopp).toBeGreaterThan(0);
    });

    it('liefert für weniger als zwei auswertbare Tage keine Streuung', () => {
        recordDayReview(review({ visitedCount: 4, overdueCleared: 1, km: 40 }));
        const stats = dayLogStats();
        expect(stats.streuungUeberfaelligAnteil).toBeNull();
        expect(stats.streuungKmProStopp).toBeNull();
    });

    it('führt Planstabilität und Spontananteil als Zusatzsignal', () => {
        recordDayReview(review({ day: '2026-08-01', visitedCount: 5, plannedCount: 6, spontan: 1 }));
        const stats = dayLogStats();
        // 5 Besuche, davon 1 spontan -> 4 von 6 geplanten Stopps gefahren
        expect(stats.planStabilitaet).toBeCloseTo(4 / 6, 5);
        expect(stats.spontanAnteil).toBeCloseTo(1 / 5, 5);
    });

    it('bleibt bei leerem Log auskunftsfähig', () => {
        expect(dayLogStats()).toMatchObject({ tage: 0, tageMitBesuch: 0, planStabilitaet: null, spontanAnteil: null });
    });
});
