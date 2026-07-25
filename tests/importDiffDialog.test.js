import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../src/core/state.js';
import { confirmImportWithDiff } from '../src/ui/importDiff.js';

const kunde = (over = {}) => ({
    name: 'Muster GmbH', nummer: '', plz: '45136', ort: 'Essen', bezirk: 'West', umsatz: 100000, ...over
});

function mountDialog() {
    document.body.innerHTML = `
        <dialog id="import-diff-dialog">
            <header><button class="dialog-close"></button></header>
            <div id="import-diff-body"></div>
            <footer>
                <button data-diff-cancel></button>
                <button data-diff-confirm></button>
            </footer>
        </dialog>`;
    const dialog = document.getElementById('import-diff-dialog');
    // jsdom kennt showModal je nach Version nicht – der Dialog selbst ist hier
    // nicht der Prüfgegenstand.
    if (typeof dialog.showModal !== 'function') dialog.showModal = function () { this.open = true; };
    if (typeof dialog.close !== 'function') {
        dialog.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
    }
    return dialog;
}

const previous = [kunde({ nummer: '1', bezirk: 'West' }), kunde({ nummer: '2', bezirk: 'Nord' })];
const incoming = [kunde({ nummer: '1', bezirk: 'Nord' }), kunde({ nummer: '3', bezirk: 'Ost', umsatz: 20000 })];

beforeEach(() => {
    state.customers = previous;
    state.territories = {};
    state.serviceContracts = [];
    state.serviceVisits = [];
});

describe('Änderungsbericht-Dialog', () => {
    it('zeigt die Zahlen, die zählen, und die Bezirkswirkung', async () => {
        mountDialog();
        const decision = confirmImportWithDiff({ previous, incoming, sourceLabel: 'Die ausgewählte Kundenliste' });
        const body = document.getElementById('import-diff-body');

        expect(body.querySelector('.diff-headline').textContent).toBe('1 neu · 1 entfällt · 1 Bezirkswechsel');
        expect(body.textContent).toContain('Wirkung je Vertriebsbezirk');
        expect(body.textContent).toContain('Ost');
        // Ersetzungswarnung bleibt sichtbar, aber ohne die doppelte Rückfrage
        expect(body.querySelector('.diff-warning').textContent).toContain('bisherige Tour');
        expect(body.textContent).not.toContain('Fortfahren?');

        document.querySelector('[data-diff-cancel]').click();
        expect(await decision).toBe(false);
    });

    it('ersetzt nur nach ausdrücklicher Bestätigung', async () => {
        mountDialog();
        const decision = confirmImportWithDiff({ previous, incoming });
        document.querySelector('[data-diff-confirm]').click();
        expect(await decision).toBe(true);
    });

    it('wertet Schließen und Abbrechen als Nein', async () => {
        const dialog = mountDialog();
        const viaClose = confirmImportWithDiff({ previous, incoming });
        dialog.close();
        expect(await viaClose).toBe(false);

        mountDialog();
        const viaX = confirmImportWithDiff({ previous, incoming });
        document.querySelector('.dialog-close').click();
        expect(await viaX).toBe(false);
    });

    it('maskiert Kundennamen aus der Datei', async () => {
        mountDialog();
        const decision = confirmImportWithDiff({
            previous,
            incoming: [kunde({ nummer: '9', name: '<img src=x onerror=alert(1)>' })]
        });
        const body = document.getElementById('import-diff-body');
        expect(body.querySelector('img')).toBeNull();
        expect(body.textContent).toContain('<img src=x onerror=alert(1)>');
        document.querySelector('[data-diff-cancel]').click();
        await decision;
    });
});
