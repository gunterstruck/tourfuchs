import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serviceVisitWindow } from '../src/features/serviceVisits.js';

const visit = (dueDate) => ({ status: 'OFFEN', priority: 'MITTEL', dueDate });

describe('Serviceplanung filtert nach dem Planungstag, nicht nach heute', () => {
    const sunday = new Date('2026-10-04T12:00:00');
    const monday = new Date('2026-10-05T12:00:00');

    it('Montagseinsatz: sonntags „jetzt" nicht fällig, für den Planungstag Montag schon', () => {
        expect(serviceVisitWindow(visit('2026-10-05'), 'now', sunday)).toBe(false);
        expect(serviceVisitWindow(visit('2026-10-05'), 'now', monday)).toBe(true);
    });

    it('Tagesplanung übergibt den gewählten Planungstag an den Einsatzfilter', () => {
        const panel = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
        const build = panel.slice(panel.indexOf('function buildServiceJobGroups(workDate)'));
        expect(build).toContain('new Date(`${workDate}T12:00:00`)');
        expect(build).toContain('if (!serviceVisitWindow(visit, scope, planningDay)) continue;');
    });
});

describe('Servicefilter berücksichtigen die SLA-Frist', () => {
    const now = new Date('2026-10-04T16:00:00');
    const slaVisit = { status: 'OFFEN', priority: 'HOCH', dueDate: '2026-10-15', slaDueAt: '2026-10-04T12:00' };

    it('überschrittene SLA: unter „Jetzt" und „Diese Woche"', () => {
        expect(serviceVisitWindow(slaVisit, 'now', now)).toBe(true);
        expect(serviceVisitWindow(slaVisit, 'week', now)).toBe(true);
    });

    it('SLA als reines Datum zählt ebenso; ohne SLA bleibt es bei der Fälligkeit', () => {
        expect(serviceVisitWindow({ ...slaVisit, slaDueAt: '2026-10-03' }, 'now', now)).toBe(true);
        expect(serviceVisitWindow({ ...slaVisit, slaDueAt: '' }, 'now', now)).toBe(false);
        expect(serviceVisitWindow({ ...slaVisit, slaDueAt: '' }, 'week', now)).toBe(false);
    });

    it('SLA erst nächste Woche: nicht „Jetzt", nicht „Diese Woche"', () => {
        expect(serviceVisitWindow({ ...slaVisit, slaDueAt: '2026-10-09T08:00' }, 'now', now)).toBe(false);
        expect(serviceVisitWindow({ ...slaVisit, slaDueAt: '2026-10-09T08:00' }, 'week', now)).toBe(false);
    });
});
