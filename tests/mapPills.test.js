import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { briefingOrder } from '../src/features/areaBriefing.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Pillen über der Karte', () => {
    it('bringt im Lasso-Briefing Überfällige zuerst, dann bald Fällige, dann die am längsten nicht Besuchten', () => {
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

    it('zeigt den Demo-Zugang dauerhaft in der Desktop-Kopfzeile – kein Gebiets-Briefing mehr', () => {
        const pills = read('src/ui/mapPills.js');
        const html = read('index.html');
        expect(pills).not.toContain('openAreaBriefing');
        expect(pills).not.toContain('demos.hidden =');
        const header = html.slice(html.indexOf('<header class="topbar">'), html.indexOf('</header>'));
        expect(header).toContain('id="btn-demos-pill" class="demo-launcher only-desktop"');
        expect(header).toContain('data-i18n="shell.demos"');
        // PO 24.10.2026: Briefings nur für einen Kunden oder höchstens 8 (Lasso, Tour, In der Nähe).
        expect(html).not.toContain('id="btn-territory-briefing"');
        // „Gebiet exportieren" ist entfallen, seit 24.10.2026 jeder Excel-Export
        // (Kundendaten verlassen TourFuchs nur verschlüsselt).
        expect(html).not.toContain('id="btn-territory-export"');
        expect(html).not.toContain('id="export-choice-dialog"');
    });

    it('vergibt jede id in index.html nur einmal', () => {
        const ids = [...read('index.html').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
        expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    });
});
