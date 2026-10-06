import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Briefing direkt am Tourstopp', () => {
    const panel = read('src/ui/tourPanel.js');

    it('jeder Stopp trägt Briefing – Text unter dem Namen (Desktop) und runder Knopf (Handy)', () => {
        expect(panel).toContain('class="stop-briefing stop-briefing-inline" data-briefing="${i}"');
        expect(panel).toContain('class="stop-briefing stop-briefing-icon" data-briefing="${i}"');
        expect(panel).toContain("t('tour.stops.briefing')");
    });

    it('öffnet denselben Dialog wie das Kunden-Popup', () => {
        expect(panel).toContain("import { openCustomerBriefing } from './customerBriefing.js';");
        expect(panel).toContain("el.querySelectorAll('[data-briefing]').forEach((btn) => btn.addEventListener('click', () => {");
        expect(panel).toContain('if (c) openCustomerBriefing(c);');
    });

    it('je Format genau eine Variante sichtbar', () => {
        expect(read('src/styles/components.css')).toContain('.stop-actions .stop-briefing-icon { display: none; }');
        const mobile = read('src/styles/responsive.css');
        expect(mobile).toContain('#tour-stops .stop-briefing-inline { display: none; }');
        expect(mobile).toContain('#tour-stops .stop-actions .stop-briefing-icon {');
    });
});
