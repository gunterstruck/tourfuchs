import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clockMinutes, joinedWindow } from '../src/features/serviceJobGroups.js';
import { proposeServiceDay } from '../src/features/serviceDayPlanner.js';
import { downloadIcs } from '../src/features/tourExport.js';

const group = (over = {}) => ({ durationMin: 30, timeWindowStart: '', timeWindowEnd: '', ...over });

describe('Einsätze beim selben Kunden nur bündeln, wenn es zusammen geht', () => {
    it('09–10 und 14–15 Uhr: nicht bündeln', () => {
        expect(joinedWindow(group({ timeWindowStart: '09:00', timeWindowEnd: '10:00' }), '14:00', '15:00', 30)).toBeNull();
    });

    it('überlappend und groß genug: bündeln mit der Schnittmenge', () => {
        expect(joinedWindow(group({ timeWindowStart: '08:00', timeWindowEnd: '12:00' }), '09:00', '17:00', 30)).toEqual({ start: '09:00', end: '12:00' });
    });

    it('Schnittmenge zu klein für beide Einsätze: nicht bündeln', () => {
        expect(joinedWindow(group({ timeWindowStart: '09:00', timeWindowEnd: '10:00' }), '09:30', '11:00', 30)).toBeNull();
    });

    it('ohne Zeitfenster: immer bündeln', () => {
        expect(joinedWindow(group(), '', '', 30)).toEqual({ start: '', end: '' });
        expect(clockMinutes('9:05')).toBe(545);
    });

    it('getrennt plant der Planer beide – der kritische Einsatz bleibt drin', () => {
        const customer = { id: 'k1', lat: 51.45, lng: 7.01 };
        const result = proposeServiceDay({
            jobs: [
                { id: 'A', customer, durationMin: 30, timeWindowStart: '09:00', timeWindowEnd: '10:00', priority: 'KRITISCH', status: 'OFFEN' },
                { id: 'B', customer, durationMin: 30, timeWindowStart: '14:00', timeWindowEnd: '15:00', priority: 'NIEDRIG', status: 'OFFEN' }
            ],
            start: { lat: 51.45, lng: 7.0 }, end: { lat: 51.45, lng: 7.0 },
            workDate: '2026-10-05', shiftStart: '08:00', shiftEnd: '17:00',
            technicianSkills: [], defaultDurationMin: 30
        });
        expect(result.itinerary.map((e) => e.jobId).sort()).toEqual(['A', 'B']);
    });

    it('die Tagesplanung nutzt die Regel und führt die Einsätze je Kunde zusammen', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
        expect(ui).toContain('joined = joinedWindow(candidate, startWindow.value, endWindow.value, durationMin);');
        expect(ui).toContain('visitsByCustomer[customerId] = [...new Set([...(visitsByCustomer[customerId] || []), ...ids])];');
    });
});

describe('Kalenderexport: zwei Einsätze beim selben Kunden sind zwei Termine', () => {
    it('folgt dem Plan statt der Stoppliste', async () => {
        let ics = '';
        vi.stubGlobal('URL', { ...URL, createObjectURL: (blob) => { ics = blob; return 'blob:x'; }, revokeObjectURL: () => {} });
        const customer = { id: 'k1', name: 'Muster GmbH', plz: '45127', ort: 'Essen', lat: 51.45, lng: 7.01 };
        downloadIcs({ lat: 51.45, lng: 7.0, label: 'Start' }, [customer], {
            servicePlan: {
                workDate: '2026-10-05', shiftStart: '08:00',
                itinerary: [
                    { customerId: 'k1', start: '2026-10-05T09:00:00', end: '2026-10-05T09:30:00', visitIds: ['A'] },
                    { customerId: 'k1', start: '2026-10-05T14:00:00', end: '2026-10-05T14:30:00', visitIds: ['B'] }
                ]
            }
        });
        const text = await ics.text();
        expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
        vi.unstubAllGlobals();
    });
});

describe('SLA-Fristen beim Bündeln als Zeitpunkt vergleichen', async () => {
    const { earlierSla, slaInstant } = await import('../src/features/serviceJobGroups.js');

    it('09-Uhr-Frist schlägt das reine Datum desselben Tags (Tagesende)', () => {
        expect(earlierSla('2026-10-05', '2026-10-05T09:00')).toBe('2026-10-05T09:00');
        expect(earlierSla('2026-10-05T09:00', '2026-10-05')).toBe('2026-10-05T09:00');
        expect(slaInstant('2026-10-05')).toBe('2026-10-05T24:00');
        expect(slaInstant('2026-10-05 9:30')).toBe('2026-10-05T09:30');
    });

    it('reines Datum am Vortag ist früher als 09 Uhr am Folgetag; leere zählen nicht', () => {
        expect(earlierSla('2026-10-06T09:00', '2026-10-05')).toBe('2026-10-05');
        expect(earlierSla('', '2026-10-05T09:00')).toBe('2026-10-05T09:00');
        expect(earlierSla('2026-10-05T09:00', '')).toBe('2026-10-05T09:00');
    });

    it('gebündelt plant der Planer die frühe Frist: Start 10 Uhr ist verspätet', () => {
        const result = proposeServiceDay({
            jobs: [{ id: 'AB', customer: { id: 'k1', lat: 51.45, lng: 7.01 }, durationMin: 60, slaDueAt: earlierSla('2026-10-05', '2026-10-05T09:00'), priority: 'MITTEL', status: 'OFFEN' }],
            start: { lat: 51.45, lng: 7.01 }, end: { lat: 51.45, lng: 7.01 },
            workDate: '2026-10-05', shiftStart: '10:00', shiftEnd: '17:00', technicianSkills: [], defaultDurationMin: 60
        });
        const codes = result.itinerary[0].reasons.map((r) => r.code);
        expect(codes).not.toContain('sla-within-target');
        expect(codes).toContain('sla-overdue-before-shift');
    });

    it('die Tagesplanung nutzt den Zeitpunktvergleich', () => {
        const ui = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
        expect(ui).toContain('if (visit.slaDueAt) group.slaDueAt = earlierSla(group.slaDueAt, visit.slaDueAt);');
    });
});

describe('Mehrtägige Zeitfenster', async () => {
    const { windowForPlanningDay } = await import('../src/features/serviceJobGroups.js');

    it('05.10. 09:00 bis 07.10. 17:00: am 06.10. ganztägig planbar', () => {
        expect(windowForPlanningDay('2026-10-05T09:00', '2026-10-07T17:00', '2026-10-06')).toEqual({ start: '', end: '', matchesDate: true });
    });

    it('am ersten und letzten Tag gelten die jeweiligen Grenzen', () => {
        expect(windowForPlanningDay('2026-10-05T09:00', '2026-10-07T17:00', '2026-10-05')).toEqual({ start: '09:00', end: '', matchesDate: true });
        expect(windowForPlanningDay('2026-10-05T09:00', '2026-10-07T17:00', '2026-10-07')).toEqual({ start: '', end: '17:00', matchesDate: true });
    });

    it('vorher oder nachher: nicht an diesem Tag', () => {
        expect(windowForPlanningDay('2026-10-05T09:00', '2026-10-07T17:00', '2026-10-04').matchesDate).toBe(false);
        expect(windowForPlanningDay('2026-10-05T09:00', '2026-10-07T17:00', '2026-10-08').matchesDate).toBe(false);
    });

    it('reine Uhrzeiten und leere Grenzen wie bisher', () => {
        expect(windowForPlanningDay('09:00', '10:00', '2026-10-06')).toEqual({ start: '09:00', end: '10:00', matchesDate: true });
        expect(windowForPlanningDay('', '', '2026-10-06')).toEqual({ start: '', end: '', matchesDate: true });
    });
});
