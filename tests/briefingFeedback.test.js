import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { state, on } from '../src/core/state.js';
import { copyText } from '../src/features/handoff.js';
import { initCustomerBriefing, openCustomerBriefing } from '../src/ui/customerBriefing.js';
import { initAreaBriefing, openAreaBriefing } from '../src/ui/areaBriefing.js';
import { readFileSync } from 'node:fs';

vi.mock('../src/features/handoff.js', () => ({ copyText: vi.fn() }));
const customer = { id: 'real-1', name: 'Testkunde', plz: '44135', nummer: '1', bezirk: 'West' };
let toasts, unsubscribe;
beforeEach(() => {
    document.body.innerHTML = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html').body.innerHTML;
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    localStorage.clear();
    state.ui.depth = 'basis';
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.mocked(copyText).mockReset().mockResolvedValue(true);
    toasts = [];
    unsubscribe = on('toast', t => toasts.push(t));
    initCustomerBriefing();initAreaBriefing();
});
afterEach(() => { unsubscribe();vi.restoreAllMocks(); });

describe.each([
    ['Kundenbriefing', () => openCustomerBriefing(customer), '[data-briefing-open]', '#customer-briefing-body'],
    ['Gebietsbriefing', () => openAreaBriefing([customer], 'West'), '[data-area-open]', '#area-briefing-body'],
])('%s: Clipboard-Rückmeldung', (_name, open, button, host) => {
    it('bestätigt erst nach erfolgreichem Kopieren ausdrücklich die Zwischenablage', async () => {
        let resolve;
        vi.mocked(copyText).mockReturnValue(new Promise(r => { resolve = r; }));
        open();document.querySelector(button).click();
        expect(document.querySelector('[data-briefing-copy-status]')).toBeNull();
        resolve(true);
        await vi.waitFor(() => expect(document.querySelector(`${host} [role="status"]`)?.textContent).toContain('erfolgreich in die Zwischenablage kopiert'));
        expect(toasts.at(-1)).toMatchObject({ type: 'success', ms: 10000 });
        expect(toasts.at(-1).text).toContain('einfügen');
        expect(copyText).toHaveBeenCalledOnce();
    });
    it('meldet blockierte Zwischenablage ehrlich und erklärt das manuelle Kopieren', async () => {
        vi.mocked(copyText).mockResolvedValue(false);
        open();document.querySelector(button).click();
        await vi.waitFor(() => expect(document.querySelector(`${host} [role="alert"]`)?.textContent).toContain('manuell kopieren'));
        expect(toasts.at(-1).type).toBe('error');
    });
});
