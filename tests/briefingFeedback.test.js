import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { state, on } from '../src/core/state.js';
import { copyText } from '../src/features/handoff.js';
import { initCustomerBriefing, openCustomerBriefing, setCustomerBriefingPreview } from '../src/ui/customerBriefing.js';
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
afterEach(() => { setCustomerBriefingPreview(false); unsubscribe();vi.restoreAllMocks(); });

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

describe.each([
    ['Kundenbriefing', () => { setCustomerBriefingPreview(true); openCustomerBriefing({ ...customer, demo: true }); }, '[data-briefing-open]', '#customer-briefing-body'],
    ['Mehrkunden-Briefing', () => openAreaBriefing([{ ...customer, demo: true }], 'Demo-Gebiet', { preview: true }), '[data-area-open]', '#area-briefing-body'],
])('%s: Live-Demo', (_name, open, button, host) => {
    it('wechselt den KI-Partner ohne Speicherung und kopiert den sichtbaren Prompt ohne externes Fenster', async () => {
        state.ui.depth = 'profi';
        const stored = localStorage.getItem('tourfuchs:briefing-assistant:v1');
        open();
        const choice = document.querySelector(`${host} input[value="chatgpt"]`);
        choice.checked = true;
        choice.dispatchEvent(new Event('change', { bubbles: true }));
        expect(document.querySelector(button).textContent).toContain('ChatGPT');
        expect(localStorage.getItem('tourfuchs:briefing-assistant:v1')).toBe(stored);
        const prompt = document.querySelector(`${host} .briefing-prompt-visible pre`).textContent;
        document.querySelector(button).click();
        await vi.waitFor(() => expect(copyText).toHaveBeenCalledWith(prompt));
        await vi.waitFor(() => expect(toasts.at(-1)?.text).toContain('Prompt kopiert'));
        expect(window.open).not.toHaveBeenCalled();
    });
    it('meldet eine blockierte Zwischenablage auch in der Vorführung', async () => {
        vi.mocked(copyText).mockResolvedValue(false);
        open();
        document.querySelector(button).click();
        await vi.waitFor(() => expect(toasts.at(-1)?.type).toBe('error'));
        expect(window.open).not.toHaveBeenCalled();
    });
});
