import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { briefingOrder, fileSlug, territoryLabel } from '../src/features/territoryPills.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Pillen über der Karte', () => {
    it('bringt im Gebiets-Briefing Überfällige zuerst, dann bald Fällige, dann die am längsten nicht Besuchten', () => {
        const now = new Date('2026-09-26T12:00:00');
        const customers = [
            { name: 'ohne Rhythmus, lange her', besuche: ['2025-01-01'] },
            { name: 'überfällig', rhythmusWochen: 4, besuche: ['2026-06-01'] },
            { name: 'ohne Rhythmus, kürzlich', besuche: ['2026-09-20'] },
            { name: 'nie besucht, mit Rhythmus', rhythmusWochen: 4 }
        ];
        const order = briefingOrder(customers, now).map((c) => c.name);
        expect(order.slice(0, 2)).toEqual(expect.arrayContaining(['überfällig', 'nie besucht, mit Rhythmus']));
        expect(order.slice(2)).toEqual(['ohne Rhythmus, lange her', 'ohne Rhythmus, kürzlich']);
    });

    it('benennt das Gebiet ehrlich', () => {
        expect(territoryLabel([{ bezirk: 'Bezirk West' }, { bezirk: 'Bezirk West' }])).toBe('Bezirk West');
        expect(territoryLabel([{ bezirk: 'Rheinland' }])).toBe('Bezirk Rheinland');
        expect(territoryLabel([{ bezirk: 'A' }, { bezirk: 'B' }])).toBe('2 Bezirke im aktuellen Kartenausschnitt');
        expect(territoryLabel([{ bezirk: '' }])).toBe('Kunden ohne Bezirk');
    });

    it('macht aus dem Gebiet einen brauchbaren Dateinamen', () => {
        expect(fileSlug('Bezirk Düsseldorf-Süd')).toBe('bezirk-duesseldorf-sued');
        expect(fileSlug('')).toBe('gebiet');
    });

    it('zeigt Gebiets-Briefing im Gebiet und den Demo-Zugang dauerhaft in der Desktop-Kopfzeile', () => {
        const pills = read('src/ui/mapPills.js');
        const html = read('index.html');
        expect(pills).toContain("state.ui.mode === 'gebietsplanung' && hasData");
        expect(pills).not.toContain('demos.hidden =');
        const header = html.slice(html.indexOf('<header class="topbar">'), html.indexOf('</header>'));
        expect(header).toContain('id="btn-demos-pill" class="demo-launcher only-desktop"');
        expect(header).toContain('data-i18n="shell.demos"');
        expect(html).toContain('id="btn-territory-briefing"');
        // „Gebiet exportieren" ist entfallen – der eine Excel-Export fragt
        // bei aktivem Filter „alle oder nur die gefilterten?".
        expect(html).not.toContain('id="btn-territory-export"');
        expect(html).toContain('id="export-choice-dialog"');
    });

    it('vergibt jede id in index.html nur einmal', () => {
        const ids = [...read('index.html').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
        expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });

    it('exportiert gefilterte Kunden mit Gebiet im Dateinamen – über den einen Excel-Export', () => {
        expect(read('src/services/excel.js')).toContain("const prefix = fileLabel ? `${base}-${fileLabel}` : base;");
        const sidebar = read('src/ui/sidebar.js');
        expect(sidebar).toContain("runExport(visibleCustomers(), { filtered: true });");
        expect(sidebar).toContain('if (!dialog || visible.length === 0 || visible.length >= all.length) { runExport(all); return; }');
    });
});
