import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

    it('zeigt den VB-Namen in eigener Zeile unter dem Vertriebsbezirk, sofern vorhanden', () => {
        state.ui.depth = 'profi';

        const html = customerPopupHtml(customer(45000, { vb: 'Eva Beispiel' }));

        expect(html).toContain('<span class="popup-meta-line">Direkt › West › Ruhr</span><span class="popup-meta-line">VB: Eva Beispiel</span>');
    });

    it('stellt Kundennummer und CRM-Link in eine eigene Zeile unter den Namen', () => {
        state.ui.depth = 'profi';

        const html = customerPopupHtml(customer(45000, { nummer: '1429247', extra: { 'SieSales Link': 'https://crm.example/1429247' } }));
        const heading = html.slice(html.indexOf('<h3>'), html.indexOf('</h3>'));

        expect(heading).not.toContain('popup-nr');
        expect(html).toMatch(/<\/h3>\s*<p class="popup-idline"><button type="button" class="popup-nr"[^]*class="popup-nr popup-crm" href="https:\/\/crm\.example\/1429247"/);
    });

    it('Desktop: breite Kachel, Tour-Knöpfe bleiben beim Scrollen unten stehen', () => {
        const map = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/map.css'), 'utf8');
        expect(map).toContain('const CUSTOMER_POPUP_WIDTH = 480;');
        expect(css).toMatch(/\.popup-customer \.popup-actions \{\s*position: sticky;\s*bottom: 0;/);
        expect(css).toContain('.customer-detail-popup .leaflet-popup-content { max-height: max(380px, calc(100dvh - 230px)); }');
        // Aufklappen: Kachel bleibt im Bild, das Feld rückt in Sicht.
        expect(map).toContain('keepPopupTopInView(el);');
        expect(map).toContain('if (open) revealPopupPanel(el, group);');
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

    it.each([
        ['00004711', 'Musterkunde GmbH', '[4711] Musterkunde GmbH'],
        ['0000', 'Null GmbH', '[0] Null GmbH'],
        [' 000AB12 ', '  A & B\nGmbH  ', '[AB12] A & B GmbH'],
        ['4711', '', '[4711]'],
        ['', 'Musterkunde', '']
    ])('kopiert Nummer und Namen als eine Zeile (%j, %j)', (number, name, expected) => {
        expect(customerNumberClipboardText(number, name)).toBe(expected);
    });

    it('macht die Nummer anklickbar und erklärt den konkreten Kopierwert', () => {
        state.ui.depth = 'profi';

        const html = customerPopupHtml(customer(45000, { nummer: '00004711' }));

        expect(html).toContain('data-action="copy-customer-number"');
        expect(html).toContain('title="Kundennummer und Name als [4711] Musterkunde GmbH in die Zwischenablage kopieren"');
        expect(html).toContain('aria-label="Kundennummer und Name als [4711] Musterkunde GmbH in die Zwischenablage kopieren"');
        expect(html).toContain('<span aria-hidden="true">⧉</span>');
        expect(html).toContain('Nr. 00004711');
    });

    it('legt exakt den erklärten Wert in die Zwischenablage', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        await expect(copyCustomerNumber('00004711', 'Musterkunde GmbH')).resolves.toEqual({
            value: '[4711] Musterkunde GmbH',
            copied: true
        });
        expect(writeText).toHaveBeenCalledWith('[4711] Musterkunde GmbH');
    });
});

describe('Zuständig und VB mit Telefonnummer', () => {
    it('zeigt den VB-Namen lesbar und die Nummer antippbar', () => {
        state.ui.depth = 'profi';
        const html = customerPopupHtml(customer(14000, { vb: 'Kahlbau Robert +49 (173) 6310304' }));
        expect(html).toContain('VB: Kahlbau Robert');
        expect(html).toContain('href="tel:+491736310304"');
        expect(html).not.toContain('VB: Kahlbau Robert +49');
    });

    it('legt die Telefonnummer unter den Namen, damit der Name nicht buchstabenweise umbricht', () => {
        const css = readFileSync('src/styles/map.css', 'utf8');
        expect(css).toContain('.popup-team-list .popup-team-tel { grid-column: 2;');
        expect(css).not.toMatch(/\.popup-team-name \{[^}]*anywhere/);
    });
});
