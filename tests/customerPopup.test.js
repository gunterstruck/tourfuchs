import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state } from '../src/core/state.js';
import { customerPopupHtml } from '../src/features/map.js';
import { copyCustomerNumber, copyCustomerNumberOnly, customerNumberClipboardText } from '../src/features/handoff.js';

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

    it('Desktop im Handy-Format: höchstens 360 px, kompakt, Tour-Knöpfe bleiben beim Scrollen unten', () => {
        const map = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/map.css'), 'utf8');
        expect(map).toContain('const CUSTOMER_POPUP_WIDTH = 360;');
        expect(css).toMatch(/\.popup-customer \.popup-actions \{\s*position: sticky;\s*bottom: 0;/);
        expect(css).toContain('.customer-detail-popup .leaflet-popup-content { max-height: max(380px, calc(100dvh - 230px)); }');
        // Dieselben kompakten Regeln wie am Handy; keine großen Desktop-Pillen mehr.
        expect(map).toContain("'customer-detail-popup customer-popup-compact'");
        expect(css).toContain('.customer-popup-compact .popup-actions button { flex-direction: column; flex-wrap: nowrap; padding: 4px 4px; }');
        expect(css).not.toContain('customer-popup-desktop');
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
        ['00004711', 'Musterkunde GmbH', 'Musterkunde GmbH [4711]'],
        ['0000', 'Null GmbH', 'Null GmbH [0]'],
        [' 000AB12 ', '  A & B\nGmbH  ', 'A & B GmbH [AB12]'],
        ['4711', '', '[4711]'],
        ['', 'Musterkunde', '']
    ])('kopiert Nummer und Namen als eine Zeile (%j, %j)', (number, name, expected) => {
        expect(customerNumberClipboardText(number, name)).toBe(expected);
    });

    it('labels each clipboard action according to its content and orders number first', () => {
        state.ui.depth = 'profi';

        const html = customerPopupHtml(customer(45000, { nummer: '00004711' }));

        expect(html).toContain('data-action="copy-customer-number"');
        expect(html).toContain('title="Kundennummer und Name als Musterkunde GmbH [4711] in die Zwischenablage kopieren"');
        expect(html).toContain('aria-label="Kundennummer und Name als Musterkunde GmbH [4711] in die Zwischenablage kopieren"');
        expect(html).toContain('<span aria-hidden="true">⧉</span>');
        expect(html).toContain('Nr. 00004711');
        expect(html).toMatch(/data-action="copy-customer-number-only"[^]*?Nr\. 00004711[^]*?data-action="copy-customer-number"[^]*?Name \+ Nr\./);
    });

    it('legt exakt den erklärten Wert in die Zwischenablage', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        await expect(copyCustomerNumber('00004711', 'Musterkunde GmbH')).resolves.toEqual({
            value: 'Musterkunde GmbH [4711]',
            copied: true
        });
        expect(writeText).toHaveBeenCalledWith('Musterkunde GmbH [4711]');
    });

    it('offers a separate number-only button in the same row, absent without a number', () => {
        state.ui.depth = 'profi';
        const html = customerPopupHtml(customer(45000, { nummer: '00004711' }));
        const row = html.match(/<p class="popup-idline">(.*?)<\/p>/)?.[1];
        expect(row).toContain('data-action="copy-customer-number"');
        expect(row).toContain('data-action="copy-customer-number-only"');
        expect(row).toContain('Name + Nr.');
        expect(customerPopupHtml(customer(45000, { nummer: '' }))).not.toContain('data-action="copy-customer-number-only"');
    });

    it('copies only the original number with leading zeros, without name or brackets', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        await expect(copyCustomerNumberOnly('00004711')).resolves.toEqual({ value: '00004711', copied: true });
        expect(writeText).toHaveBeenCalledWith('00004711');
        await expect(copyCustomerNumberOnly('')).resolves.toEqual({ value: '', copied: false });
        expect(writeText).toHaveBeenCalledTimes(1);
    });
});

describe('DUVE neben SieSales', () => {
    it('appears without setup only when a CRM link and customer number are present', () => {
        vi.stubGlobal('localStorage', { getItem: () => null });
        const html = customerPopupHtml(customer(100, { extra: { 'SieSales Link': 'https://crm.example/customer' } }));
        expect(html).toContain('popup-company');
        expect(html).toContain('searchTerm=4711');
        expect(customerPopupHtml(customer(100))).not.toContain('popup-company');
        expect(customerPopupHtml(customer(100, { nummer: '', extra: { 'SieSales Link': 'https://crm.example/customer' } }))).not.toContain('popup-company');
    });

    it('steht mit SieSales als eigene Gruppe, die am Handy in einer neuen Zeile beginnt', () => {
        vi.stubGlobal('localStorage', { getItem: () => null });
        const html = customerPopupHtml(customer(100, { extra: { 'SieSales Link': 'https://crm.example/customer' } }));
        expect(html).toMatch(/<span class="popup-links"><a class="popup-nr popup-crm"[^]*popup-company[^]*<\/a><\/span><\/p>/);
        expect(customerPopupHtml(customer(100))).not.toContain('popup-links');
        const css = readFileSync(resolve(process.cwd(), 'src/styles/map.css'), 'utf8');
        const phone = css.slice(css.indexOf('.popup-customer .popup-links { display'));
        expect(phone).toMatch(/@media \(max-width: 768px\),[^{]*\{\s*\.popup-customer \.popup-links \{ flex-basis: 100%; \}/);
    });
});

describe('Zuständig und VB mit Telefonnummer', () => {
    it('zeigt den VB-Namen lesbar und die Nummer antippbar', () => {
        state.ui.depth = 'profi';
        const html = customerPopupHtml(customer(14000, { vb: 'Mustermann Robin +49 (170) 4445566' }));
        expect(html).toContain('VB: Mustermann Robin');
        expect(html).toContain('href="tel:+491704445566"');
        expect(html).not.toContain('VB: Mustermann Robin +49');
    });

    it('legt die Telefonnummer unter den Namen, damit der Name nicht buchstabenweise umbricht', () => {
        const css = readFileSync('src/styles/map.css', 'utf8');
        expect(css).toContain('.popup-team-list .popup-team-tel { grid-column: 2;');
        expect(css).not.toMatch(/\.popup-team-name \{[^}]*anywhere/);
    });
});
