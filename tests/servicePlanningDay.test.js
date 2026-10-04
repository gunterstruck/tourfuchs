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
