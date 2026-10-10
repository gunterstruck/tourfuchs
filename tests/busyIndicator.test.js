import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { hideBusy, isBusy, showBusy } from '../src/ui/busyIndicator.js';
import { MESSAGES } from '../src/i18n/messages.js';

const read = (file) => readFileSync(file, 'utf8');

describe('„Bitte warten" bei vielen Kunden', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app-busy" class="app-busy" role="status"><span class="app-busy-text"></span></div>';
        hideBusy('start');
        hideBusy('map');
    });

    it('bleibt sichtbar, bis der letzte Vorgang fertig ist, mit dem jüngsten Text', () => {
        const box = document.getElementById('app-busy');
        showBusy('start', 'Daten werden geladen');
        showBusy('map', 'Karte wird aktualisiert');
        expect(box.hidden).toBe(false);
        expect(box.textContent).toBe('Karte wird aktualisiert');
        hideBusy('map');
        expect(box.textContent).toBe('Daten werden geladen');
        hideBusy('start');
        expect(box.hidden).toBe(true);
        expect(isBusy()).toBe(false);
    });

    it('steht schon im HTML (vor jedem Skript) und ist in allen Sprachen da', () => {
        const html = read('index.html');
        expect(html).toContain('id="app-busy" class="app-busy" role="status"');
        for (const locale of ['de', 'en', 'fr', 'es']) {
            for (const key of ['busy.starting', 'busy.startingCount', 'busy.map', 'busy.mapProgress']) {
                expect(MESSAGES[locale][key], `${locale} ${key}`).toBeTruthy();
            }
        }
    });

    it('Start und Karte melden sich – und ein neuerer Kartenaufbau beendet einen laufenden', () => {
        const main = read('src/main.js');
        expect(main).toContain("showBusy('start', t('busy.startingCount'");
        expect(main).toContain("hideBusy('start')");
        const map = read('src/features/map.js');
        expect(map).toContain('if (generation !== markerDrawGeneration || !clusterGroup) return;');
        expect(map).toContain("showBusy('map', t('busy.map'))");
    });
});
