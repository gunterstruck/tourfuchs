import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { closeSensitiveDialogs } from '../src/ui/lockVault.js';

// jsdom kennt dialog.close() nicht
if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('Sperren schließt offene Dialoge und leert sie', () => {
    it('schließt Briefing/Export und löscht Inhalte, Schlüssel und Prompts', () => {
        document.body.innerHTML = `
            <dialog id="customer-briefing-dialog" open><div id="customer-briefing-body">Muster GmbH · Umsatz 120.000 €</div></dialog>
            <dialog id="safe-export-dialog" open><p id="safe-export-info">12 Kunden</p><textarea id="safe-export-keytext">TFK1:geheim</textarea></dialog>
            <dialog id="safe-receive-dialog"><textarea id="safe-key-input">TFK1:geheim</textarea></dialog>`;
        closeSensitiveDialogs();
        expect(document.querySelectorAll('dialog[open]')).toHaveLength(0);
        expect(document.body.textContent).not.toContain('Muster GmbH');
        expect(document.getElementById('safe-export-keytext').value).toBe('');
        expect(document.getElementById('safe-key-input').value).toBe('');
        expect(document.getElementById('safe-export-info').textContent).toBe('');
    });

    it('ist beim Sperren und beim automatischen Löschen angebunden', () => {
        const ui = read('src/ui/lockVault.js');
        const locked = ui.slice(ui.indexOf('function onLocked()'), ui.indexOf('function onWiped()'));
        expect(locked).toContain('closeSensitiveDialogs();');
        const wiped = ui.slice(ui.indexOf('function onWiped()'), ui.indexOf('const SENSITIVE_CONTENT'));
        expect(wiped).toContain('closeSensitiveDialogs();');
        expect(read('src/ui/safeTransfer.js')).toContain("on('vault:locked', () => { lastExport = null; pendingContainer = null; stopCamera(); });");
    });
});

describe('Automatische Löschung nimmt eigene Orte und Tourpunkte mit', () => {
    it('setzt Orte und Tour zurück', () => {
        const ui = read('src/ui/lockVault.js');
        const wiped = ui.slice(ui.indexOf('function onWiped()'), ui.indexOf('const SENSITIVE_CONTENT'));
        expect(wiped).toContain('setPlaces([]);');
        expect(wiped).toContain('Object.assign(state.tour, { start: null, destination: null, stops: [], servicePlan: null, serviceVisitByCustomer: {} });');
    });
});

describe('Service-Zeitplan folgt Datum und Startzeit', () => {
    it('verwirft Vorschlag und bestätigten Plan bei Änderung', () => {
        const panel = read('src/ui/tourPanel.js');
        expect(panel).toContain("for (const id of ['plan-date', 'plan-time']) {");
        expect(panel).toContain("addEventListener('change', discardServicePlanForNewTiming);");
        const fn = panel.slice(panel.indexOf('function discardServicePlanForNewTiming()'));
        expect(fn).toContain('clearServiceTourPlan();');
        expect(fn).toContain('serviceDayPreview = null;');
    });
});

describe('Sicherer Import meldet nur echten Erfolg', () => {
    it('prüft das Speicherergebnis mit und ohne vorhandenen Tresor', () => {
        const ui = read('src/ui/safeTransfer.js');
        expect(ui.match(/if \(!\(await persistReceived\(\)\)\) return;/g)).toHaveLength(2);
        expect(ui).toContain('if (await saveDataset(datasetSnapshot())) return true;');
    });
});
