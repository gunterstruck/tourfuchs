import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    dayReview,
    dayReviewHeadline,
    dayReviewText,
    wasOverdueBeforeVisit
} from '../src/features/dayReview.js';

// Fester Bezugstag, damit die Tests nicht am Kalender hängen.
const NOW = new Date('2026-07-25T18:30:00');
const TODAY = '2026-07-25';

const kunde = (over = {}) => ({
    id: 'k1', name: 'Muster GmbH', plz: '45136', ort: 'Essen', bezirk: 'West',
    umsatz: 50000, rhythmusWochen: null, besuche: [], lat: 51.45, lng: 7.0, ...over
});

describe('Feierabend-Rückblick', () => {
    it('zählt die Besuche von heute, geplant wie spontan', () => {
        const review = dayReview({
            customers: [
                kunde({ id: 'a', besuche: [TODAY] }),
                kunde({ id: 'b', besuche: ['2026-07-01'] }),
                kunde({ id: 'c', besuche: [TODAY] })
            ],
            tour: { stops: ['a', 'b'], start: null },
            now: NOW
        });

        expect(review.visitedCount).toBe(2);
        expect(review.visited.map((entry) => entry.id)).toEqual(['a', 'c']);
        expect(review.spontaneous.map((entry) => entry.id)).toEqual(['c']);
        expect(review.openStops.map((entry) => entry.id)).toEqual(['b']);
        expect(review.plannedCount).toBe(2);
    });

    it('nimmt den heutigen Eintrag zurück, um „war überfällig" zu erkennen', () => {
        // 6 Wochen Rhythmus, letzter Besuch vor über einem Jahr -> war überfällig
        const overdue = kunde({ rhythmusWochen: 6, besuche: ['2025-01-10', TODAY] });
        // frisch besucht, dann heute nochmal -> war nicht überfällig
        const fresh = kunde({ rhythmusWochen: 6, besuche: ['2026-07-20', TODAY] });
        // ohne Rhythmus gibt es keine Fälligkeit
        const noRhythm = kunde({ rhythmusWochen: null, besuche: [TODAY] });

        expect(wasOverdueBeforeVisit(overdue, TODAY, NOW)).toBe(true);
        expect(wasOverdueBeforeVisit(fresh, TODAY, NOW)).toBe(false);
        expect(wasOverdueBeforeVisit(noRhythm, TODAY, NOW)).toBe(false);

        const review = dayReview({ customers: [overdue, fresh, noRhythm], now: NOW });
        expect(review.overdueCleared).toBe(1);
    });

    it('merkt sich den vorherigen Besuch für den Abstand', () => {
        const review = dayReview({
            customers: [kunde({ besuche: ['2026-05-01', TODAY] })],
            now: NOW
        });
        expect(review.visited[0].previousVisit).toBe('2026-05-01');
    });

    it('schätzt die Strecke nur aus einer geplanten Tour mit Start', () => {
        const customers = [kunde({ id: 'a' }), kunde({ id: 'b', lat: 51.22, lng: 6.78 })];
        const withStart = dayReview({
            customers,
            tour: { stops: ['a', 'b'], start: { lat: 51.51, lng: 7.46 } },
            now: NOW
        });
        const withoutStart = dayReview({ customers, tour: { stops: ['a', 'b'], start: null }, now: NOW });

        expect(withStart.roadKmEstimate).toBeGreaterThan(0);
        expect(withoutStart.roadKmEstimate).toBe(0);
    });

    it('bleibt ohne Tour und ohne Besuche stumm', () => {
        const review = dayReview({ customers: [kunde()], now: NOW });
        expect(review.hasAnything).toBe(false);
        expect(dayReviewHeadline(review)).toMatch(/noch kein Besuch/);
    });

    it('fasst den Tag in einer Zeile zusammen', () => {
        const review = dayReview({
            customers: [
                kunde({ id: 'a', rhythmusWochen: 6, besuche: ['2025-01-10', TODAY] }),
                kunde({ id: 'b', besuche: [TODAY] })
            ],
            now: NOW
        });
        expect(dayReviewHeadline(review)).toBe('2 Besuche · 1 Überfälliger abgearbeitet');
    });

    it('schreibt einen weitergebbaren Nachweis', () => {
        const review = dayReview({
            customers: [
                kunde({ id: 'a', name: 'Alpha AG', besuche: [TODAY] }),
                kunde({ id: 'b', name: 'Beta GmbH', besuche: ['2026-06-01'] })
            ],
            tour: { stops: ['b'], start: null },
            now: NOW
        });
        const text = dayReviewText(review);

        expect(text).toContain('TourFuchs – Tagesabschluss');
        expect(text).toContain('Besucht:');
        expect(text).toContain('Alpha AG');
        expect(text).toContain('spontan');
        expect(text).toContain('Offen geblieben:');
        expect(text).toContain('Beta GmbH');
    });

    it('rechnet den lokalen Tag, nicht den UTC-Tag', () => {
        // 22:30 Ortszeit: toISOString() läge östlich von UTC bereits auf morgen
        const spaet = new Date('2026-07-25T22:30:00');
        const review = dayReview({ customers: [kunde({ besuche: ['2026-07-25'] })], now: spaet });
        expect(review.day).toBe('2026-07-25');
        expect(review.visitedCount).toBe(1);
    });

    it('ist in Tour-Panel und Karte an das Abhaken gekoppelt', () => {
        const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
        const tourPanel = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
        const map = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');

        expect(html).toContain('id="day-review-dialog"');
        expect(html).toContain('id="btn-day-review"');
        // Nach dem Abhaken muss der Rückblick davon erfahren
        expect(tourPanel).toContain("emit('visits:changed')");
        expect(map).toContain("emit('visits:changed')");
    });
});
