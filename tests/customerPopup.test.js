import { afterEach, describe, expect, it, vi } from 'vitest';
import { state } from '../src/core/state.js';
import { customerPopupHtml } from '../src/features/map.js';
import { copyCustomerNumber, customerNumberClipboardText } from '../src/features/handoff.js';

const originalDepth = state.ui.depth;

const customer = (umsatz, overrides = {}) => ({
    id: 'kunde-1',
    nummer: '4711',
    name: 'Musterkunde GmbH',
    strasse: 'Testweg 1',
    plz: '45127',
    ort: 'Essen',
    channel: 'Direkt',
    gruppe: 'West',
    bezirk: 'Ruhr',
    umsatz,
    besuche: [],
    ...overrides
});

afterEach(() => {
    state.ui.depth = originalDepth;
    vi.unstubAllGlobals();
});

describe('Umsatz im Kunden-Popup', () => {
    it('zeigt einen vorhandenen Umsatz klar beschriftet und formatiert', () => {
        state.ui.depth = 'profi';

        const html = customerPopupHtml(customer(123456));

        expect(html).toContain('class="popup-revenue"');
        expect(html).toContain('<span>Umsatz</span>');
        expect(html).toContain('123 T€');
        expect(html).toContain('title="123.456 €"');
    });

    it('zeigt einen explizit vorhandenen Null-Umsatz', () => {
        const html = customerPopupHtml(customer(0));

        expect(html).toContain('<span>Umsatz</span>');
        expect(html).toContain('0 €');
    });

    it.each([null, undefined, '', '   ', 'nicht verfügbar'])(
        'blendet die Umsatzzeile ohne gültigen Wert aus (%s)',
        (umsatz) => {
            expect(customerPopupHtml(customer(umsatz))).not.toContain('popup-revenue');
        }
    );

    it('zeigt den Umsatz auch in der Basis-Ansicht', () => {
        state.ui.depth = 'basis';

        const html = customerPopupHtml(customer(45000));

        expect(html).toContain('<span>Umsatz</span>');
        expect(html).toContain('45 T€');
        expect(html).not.toContain('Direkt › West › Ruhr');
    });

    it('zeigt den VB-Namen direkt hinter dem Vertriebsbezirk, sofern vorhanden', () => {
        state.ui.depth = 'profi';

        const html = customerPopupHtml(customer(45000, { vb: 'Eva Beispiel' }));

        expect(html).toContain('Direkt › West › Ruhr · VB: Eva Beispiel');
    });

    it('lässt den VB-Zusatz bei einem leeren Wert weg', () => {
        state.ui.depth = 'profi';

        const html = customerPopupHtml(customer(45000, { vb: '   ' }));

        expect(html).toContain('Direkt › West › Ruhr');
        expect(html).not.toContain('VB:');
    });
});

describe('Kundennummer aus der Kundenkarte kopieren', () => {
    it.each([
        ['00004711', '[4711]'],
        ['4711', '[4711]'],
        ['0000', '[0]'],
        ['  000AB12  ', '[AB12]'],
        ['', '']
    ])('formatiert %j als %j', (number, expected) => {
        expect(customerNumberClipboardText(number)).toBe(expected);
    });

    it('macht die Nummer anklickbar und erklärt den konkreten Kopierwert', () => {
        state.ui.depth = 'profi';

        const html = customerPopupHtml(customer(45000, { nummer: '00004711' }));

        expect(html).toContain('data-action="copy-customer-number"');
        expect(html).toContain('title="Kundennummer als [4711] in die Zwischenablage kopieren"');
        expect(html).toContain('aria-label="Kundennummer als [4711] in die Zwischenablage kopieren"');
        expect(html).toContain('<span aria-hidden="true">⧉</span>');
        expect(html).toContain('Nr. 00004711');
    });

    it('legt exakt den erklärten Wert in die Zwischenablage', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        await expect(copyCustomerNumber('00004711')).resolves.toEqual({
            value: '[4711]',
            copied: true
        });
        expect(writeText).toHaveBeenCalledWith('[4711]');
    });
});
