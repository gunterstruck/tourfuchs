import { afterEach, describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';
import { customerPopupHtml } from '../src/features/map.js';

const originalDepth = state.ui.depth;

const customer = (umsatz) => ({
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
    besuche: []
});

afterEach(() => {
    state.ui.depth = originalDepth;
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
});
