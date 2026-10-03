import { afterEach, describe, expect, it } from 'vitest';
import { openPrintView, withBackBar, isStandaloneApp } from '../src/ui/printView.js';

const PAGE = '<!DOCTYPE html><html><head><style>body{}</style></head><body><h1>Plan</h1></body></html>';

describe('Druckansicht: immer ein Rückweg', () => {
    afterEach(() => { document.querySelectorAll('.print-view-overlay').forEach((el) => el.remove()); });

    it('setzt „Zurück zu TourFuchs" und „Drucken" direkt nach <body> ein – nicht mitgedruckt', () => {
        const html = withBackBar(PAGE);
        expect(html).toMatch(/<body>\s*<div class="tf-printbar">/);
        expect(html).toContain('← Zurück zu TourFuchs');
        expect(html).toContain('@media print { .tf-printbar { display: none !important; } }');
        expect(withBackBar(html)).toBe(html); // nicht doppelt
    });

    it('im Browser: neues Fenster mit Leiste', () => {
        const written = [];
        const fake = { document: { write: (h) => written.push(h), close() {} } };
        const win = { matchMedia: () => ({ matches: false }), navigator: {}, document };
        expect(openPrintView(PAGE, { win, open: () => fake })).toBe(true);
        expect(written[0]).toContain('tf-printbar');
        expect(document.querySelector('.print-view-overlay')).toBeNull();
    });

    it('in der installierten App: kein Fenster, sondern eine Ebene in der App', () => {
        let opened = false;
        const win = { matchMedia: () => ({ matches: true }), navigator: {}, document };
        expect(isStandaloneApp(win)).toBe(true);
        expect(openPrintView(PAGE, { win, open: () => { opened = true; return null; } })).toBe(true);
        expect(opened).toBe(false);
        const frame = document.querySelector('.print-view-overlay iframe');
        expect(frame.getAttribute('srcdoc')).toContain('← Zurück zu TourFuchs');
    });

    it('„Zurück" in der Ebene schließt sie', async () => {
        const win = { matchMedia: () => ({ matches: true }), navigator: {}, document };
        openPrintView(PAGE, { win });
        window.dispatchEvent(new MessageEvent('message', { data: { tf: 'print-close' } }));
        expect(document.querySelector('.print-view-overlay')).toBeNull();
    });
});
