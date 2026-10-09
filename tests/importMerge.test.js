import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { autoDetectMapping, parseRows } from '../src/services/excel.js';
import { columnsNotInFile, mergeWithPrevious, missingCustomers } from '../src/features/importMerge.js';
import { confirmImportWithDiff } from '../src/ui/importDiff.js';
import { state } from '../src/core/state.js';

// Zwei Komplettlisten aus dem Vertrieb mit unterschiedlichen Spalten.
const STAMM_HEADERS = ['Kd-Nr.', 'Kundenname', 'Straße', 'PLZ', 'Ort', 'VBEZ', 'VB'];
const ROLLEN_HEADERS = ['Kd-Nr.', 'IFA-Nr.', 'USt-IdNr', 'Reg. VReg', 'VBEZ', 'Kundenname', 'PLZ', 'Ort', 'VB', 'OM', 'TSP TC',
    'VK', 'RTC', 'PA Kundenanfrage', 'TAM', 'Account Cluster', 'Account Name', 'Account Manager', 'EB-Berater', 'Named Account'];

function read(headers, rows) {
    const mapping = autoDetectMapping(headers);
    const objects = rows.map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
    return { mapping, headers, customers: parseRows(objects, mapping).customers };
}

function stammliste() {
    const { customers } = read(STAMM_HEADERS, [
        ['1001', 'Nord GmbH', 'Domkloster 4', '50667', 'Köln', 'VBEZ 11', 'Anna Berg'],
        ['1002', 'Süd AG', 'Marienplatz 1', '80331', 'München', 'VBEZ 42', 'Ben Hof'],
        ['1003', 'West KG', 'Markt 1', '52062', 'Aachen', 'VBEZ 11', 'Anna Berg']
    ]);
    // So liegt der Bestand nach adressgenauer Verortung und erfassten Besuchen vor.
    customers[0].lat = 50.9413; customers[0].lng = 6.9583; customers[0].geo = 'exakt';
    customers[0].besuche = ['2026-09-30'];
    customers[0].contacts = [{ id: 'c1', name: 'Frau Klein', telefon: '0221 1', primary: true }];
    customers[0].ansprechpartner = 'Frau Klein';
    customers[0].coordinateSource = 'map-pin';
    return customers;
}

describe('„Kd-Nr." ist die Kundennummer', () => {
    it('erkennt Kd-Nr. automatisch – auch mit Punkt', () => {
        expect(autoDetectMapping(ROLLEN_HEADERS)).toMatchObject({
            nummer: 'Kd-Nr.', name: 'Kundenname', plz: 'PLZ', ort: 'Ort', bezirk: 'VBEZ', vb: 'VB'
        });
        expect(autoDetectMapping(['Kunden-Nr', 'Name', 'PLZ']).nummer).toBe('Kunden-Nr');
        expect(autoDetectMapping(['E-Mail', 'Name', 'PLZ']).email).toBe('E-Mail');
    });
});

describe('Abgleich: Stammliste, dann Zuständigkeitsliste, dann wieder Stammliste', () => {
    it('die Zuständigkeitsliste ergänzt Rollen und lässt Straße, Verortung, Kontakte und Besuche stehen', () => {
        const bestand = stammliste();
        const rollen = read(ROLLEN_HEADERS, [
            ['1001', 'IFA1', 'DE1', 'West', 'VBEZ 12', 'Nord GmbH', '50667', 'Köln', 'Anna Berg', 'Olaf Meier 0221 555', '', 'Vera Kunz 0171 222', '', 'PI-Partner Kunde', 'TAM West 0800 1', 'Cluster A', 'Nord Gruppe', 'Max Acc', 'EB Team 0221 9', ''],
            ['1002', 'IFA2', 'DE2', 'Süd', 'VBEZ 42', 'Süd AG', '80331', 'München', 'Ben Hof', '', '', '', '', '', '', 'Cluster B', 'Süd AG', '', '', 'PI-Partner Kunde'],
            ['1004', 'IFA4', 'DE4', 'Nord', 'VBEZ 50', 'Neu GmbH', '20095', 'Hamburg', 'Cem Ay', '', '', '', '', '', '', '', '', '', '', '']
        ]);

        // Vor dem Bericht: was die Datei nicht kennt – und wer fehlt.
        expect(columnsNotInFile(bestand, rollen)).toEqual(['Straße', 'Ansprechpartner']);
        expect(missingCustomers(bestand, rollen.customers).map((c) => c.nummer)).toEqual(['1003']);

        mergeWithPrevious(bestand, rollen.customers, rollen);
        const nord = rollen.customers.find((c) => c.nummer === '1001');
        // Aus der Datei: Bezirkswechsel und Rollen.
        expect(nord.bezirk).toBe('VBEZ 12');
        expect(nord.extra).toMatchObject({ VK: 'Vera Kunz 0171 222', OM: 'Olaf Meier 0221 555', 'PA Kundenanfrage': 'PI-Partner Kunde' });
        // Erhalten: Straße, genaue Position, Kontakte, Pin-Herkunft.
        expect(nord.strasse).toBe('Domkloster 4');
        expect([nord.lat, nord.lng, nord.geo]).toEqual([50.9413, 6.9583, 'exakt']);
        expect(nord.contacts).toHaveLength(1);
        expect(nord.ansprechpartner).toBe('Frau Klein');
        expect(nord.coordinateSource).toBe('map-pin');
        // Neuer Kunde ohne Vorgeschichte bleibt, wie er kommt.
        expect(rollen.customers.find((c) => c.nummer === '1004').strasse).toBe('');
    });

    it('die nächste Stammliste aktualisiert ihre Spalten und lässt die Rollen stehen – leere Zellen gelten', () => {
        const bestand = stammliste();
        const rollen = read(ROLLEN_HEADERS, [
            ['1001', '', '', '', 'VBEZ 11', 'Nord GmbH', '50667', 'Köln', 'Anna Berg', '', '', 'Vera Kunz 0171 222', '', '', '', '', '', '', '', '']
        ]);
        mergeWithPrevious(bestand, rollen.customers, rollen);
        const mitRollen = [...rollen.customers, ...missingCustomers(bestand, rollen.customers)];

        const neueStamm = read(STAMM_HEADERS, [
            ['1001', 'Nord GmbH', 'Domkloster 4', '50667', 'Köln', 'VBEZ 11', ''],
            ['1002', 'Süd AG', 'Neuhauser Str. 2', '80331', 'München', 'VBEZ 42', 'Ben Hof']
        ]);
        expect(columnsNotInFile(mitRollen, neueStamm)).toContain('VK');
        mergeWithPrevious(mitRollen, neueStamm.customers, neueStamm);
        const [nord, sued] = neueStamm.customers;
        expect(nord.extra.VK).toBe('Vera Kunz 0171 222');          // Rolle bleibt
        expect(nord.vb).toBe('');                                    // VB ausgetragen: die Datei ist die Wahrheit
        expect(nord.geo).toBe('exakt');                              // gleiche Anschrift → Position bleibt
        expect(sued.strasse).toBe('Neuhauser Str. 2');
        expect(sued.lat).toBeNull();                                 // neue Anschrift → neu verorten
    });

    it('eine Zusatzspalte, die die Datei führt, darf leer werden', () => {
        const bestand = read(['Kd-Nr.', 'Kundenname', 'PLZ', 'VK'], [['1', 'A', '50667', 'Vera']]).customers;
        const neu = read(['Kd-Nr.', 'Kundenname', 'PLZ', 'VK'], [['1', 'A', '50667', '']]);
        mergeWithPrevious(bestand, neu.customers, neu);
        expect(neu.customers[0].extra.VK).toBeUndefined();
    });
});

describe('Änderungsbericht: fehlende Kunden behalten oder entfernen', () => {
    function mountDialog() {
        document.body.innerHTML = `
            <dialog id="import-diff-dialog">
                <header><button class="dialog-close"></button></header>
                <div id="import-diff-body"></div>
                <footer><button data-diff-cancel></button><button data-diff-confirm></button></footer>
            </dialog>`;
        const dialog = document.getElementById('import-diff-dialog');
        if (typeof dialog.showModal !== 'function') dialog.showModal = function () { this.open = true; };
        if (typeof dialog.close !== 'function') dialog.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
    }
    const kunde = (nummer) => ({ nummer, name: `K${nummer}`, plz: '50667', bezirk: 'West' });
    beforeEach(() => { state.customers = []; state.territories = {}; state.serviceContracts = []; state.serviceVisits = []; });

    it('schlägt „Behalten" vor, wenn die Datei ergänzt – und rechnet den Bericht danach', async () => {
        mountDialog();
        const previous = [kunde('1'), kunde('2')];
        const incoming = [kunde('1')];
        const decision = confirmImportWithDiff({
            previous, incoming,
            abgleich: { missing: [previous[1]], defaultKeep: true, carriedColumns: ['Straße'] }
        });
        const body = document.getElementById('import-diff-body');
        expect(body.textContent).toContain('1 Kunde fehlt in dieser Datei');
        expect(body.textContent).toContain('Bleibt erhalten');
        expect(body.querySelector('input[value="keep"]').checked).toBe(true);
        expect(body.querySelector('.diff-headline').textContent).not.toContain('entfällt');

        const remove = body.querySelector('input[value="remove"]');
        remove.checked = true;
        remove.dispatchEvent(new Event('change'));
        expect(body.querySelector('.diff-headline').textContent).toContain('1 entfällt');

        document.querySelector('[data-diff-confirm]').click();
        expect(await decision).toEqual({ keepMissing: false });
    });

    it('ist im Import angebunden: Abgleich vor dem Bericht, behaltene Kunden danach dazu', () => {
        const wizard = readFileSync('src/ui/importWizard.js', 'utf8');
        expect(wizard.indexOf('mergeWithPrevious(state.customers, customers, source)')).toBeLessThan(wizard.indexOf('await confirmImportWithDiff({'));
        expect(wizard).toContain('if (confirmed?.keepMissing) keptMissing = abgleich.missing;');
        expect(wizard).toContain('customers.push(...keptMissing);');
    });
});
