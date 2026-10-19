import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { helpDemoLink } from '../src/ui/helpDemo.js';
import { markFirstStepDone } from '../src/features/firstSteps.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('„Wie geht das?" – Live-Demo dort, wo der Schritt ansteht', () => {
    beforeEach(() => localStorage.clear());

    it('verweist bei leerer Tour und beim Tresor auf die passende Demo', () => {
        expect(helpDemoLink('tour')).toContain('data-help-demo="tour"');
        expect(helpDemoLink('sicher')).toContain('data-help-demo="tresor"');
        expect(helpDemoLink('tour')).toContain('Live-Demo ansehen');
        expect(helpDemoLink('unbekannt')).toBe('');
    });

    it('verschwindet, sobald der Schritt einmal getan ist (oder die Demo durchlief)', () => {
        markFirstStepDone('tour');
        expect(helpDemoLink('tour')).toBe('');
        expect(helpDemoLink('sicher')).not.toBe('');
    });

    it('steht in der leeren Tour und im Tresor-Fenster, ruht während einer Vorführung', () => {
        expect(read('src/ui/tourPanel.js')).toContain("${helpDemoLink('tour')}");
        expect(read('src/ui/lockVault.js')).toContain("${forced ? '' : helpDemoLink('sicher')}");
        expect(read('src/styles/responsive.css')).toContain('body.sc-running .help-demo { display: none !important; }');
        expect(read('src/ui/firstSteps.js')).toContain("closest?.('[data-help-demo]')");
    });
});
