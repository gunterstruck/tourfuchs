import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    SYNC_MAGIC, buildSyncPayload, customerToken, mergeSyncPayload, parseSyncPayload, syncFileName, syncSummary
} from '../src/features/visitSync.js';
import { carryOverVisits } from '../src/features/datasetDiff.js';
import { datasetReplacementMessage } from '../src/ui/datasetReplacement.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const TODAY = '2026-10-20';

const list = () => [
    { id: 'k-nr:4711', nummer: '4711', name: 'Gebr. Graef GmbH & Co. KG', plz: '59757', besuche: ['2026-09-01'] },
    { id: 'k-nr:815', nummer: '815', name: 'Bäckerei Krümel GmbH', plz: '45127', besuche: [] },
    { id: 'k-np:ohne nummer gmbh|50667', nummer: '', name: 'Ohne Nummer GmbH', plz: '50667', besuche: [] }
];

describe('Abgleich-Datei (Weg B): eine Datei, beide Richtungen, nur ergänzen', () => {
    it('enthält weder Kundennamen noch Kundennummern – nur Prüfsummen und Daten', () => {
        const [graef, , ohne] = list();
        const payload = buildSyncPayload([{ customer: graef, date: '2026-10-19' }, { customer: ohne, date: TODAY }]);
        const text = JSON.stringify(payload);
        for (const secret of ['Graef', '4711', '59757', 'Ohne Nummer', '50667']) expect(text).not.toContain(secret);
        expect(payload[SYNC_MAGIC]).toBe(1);
        expect(payload.visits).toEqual([{ k: customerToken(graef), d: '2026-10-19' }, { k: customerToken(ohne), d: TODAY }]);
        expect(syncFileName(TODAY)).toBe('TourFuchs-Abgleich-2026-10-20.txt');
    });

    it('Handy → Desktop: ergänzt Besuche auf dem anderen Gerät über dieselbe Kundenliste', () => {
        const phone = list();
        const desktop = list();
        const text = JSON.stringify(buildSyncPayload([
            { customer: phone[0], date: '2026-10-19' },
            { customer: phone[2], date: TODAY },
            { customer: phone[0], date: '2026-09-01' }
        ]));
        const result = mergeSyncPayload(desktop, parseSyncPayload(text), { today: TODAY });
        expect(result).toMatchObject({ added: 2, known: 1, unknown: 0, invalid: 0 });
        expect(desktop[0].besuche).toEqual(['2026-09-01', '2026-10-19']);
        expect(desktop[2].besuche).toEqual([TODAY]);
        expect(desktop[1].besuche).toEqual([]);
        // Genau die Besuche aus der Datei gelten danach als abgeglichen.
        expect(result.entries.map((e) => e.date).sort()).toEqual(['2026-09-01', '2026-10-19', TODAY]);
        // Zweites Öffnen derselben Datei ändert nichts mehr.
        expect(mergeSyncPayload(desktop, parseSyncPayload(text), { today: TODAY })).toMatchObject({ added: 0, known: 3 });
    });

    it('meldet fremde Kunden und ungültige Daten, legt nichts an', () => {
        const desktop = list();
        const payload = buildSyncPayload([{ customer: { nummer: '999', name: 'Fremd' }, date: '2026-10-01' }]);
        payload.visits.push({ k: customerToken(desktop[1]), d: '2099-01-01' }, { k: customerToken(desktop[1]), d: 'gestern' });
        const result = mergeSyncPayload(desktop, payload, { today: TODAY });
        expect(result).toMatchObject({ added: 0, unknown: 1, invalid: 2 });
        expect(desktop.length).toBe(3);
        expect(syncSummary(result)).toBe('0 Besuche übernommen · 1 zu einem Kunden, die hier nicht in der Liste stehen · 2 ohne gültiges Datum.');
    });

    it('erkennt die Datei am Inhalt, nicht am Namen', () => {
        expect(parseSyncPayload('Kundennummer;Besuchsdatum')).toBeNull();
        expect(parseSyncPayload('{"__tfsync":1,"visits":"x"}')).toBeNull();
        expect(parseSyncPayload('{"__tfsync":1,"visits":[]}')).toMatchObject({ visits: [] });
    });

    it('ist auf Handy und Desktop erreichbar und führt Empfang und Senden in einem Fenster', () => {
        const html = read('index.html');
        expect(html).toMatch(/id="btn-sync" class="only-mobile btn-scan-entry"/);
        expect(html).toContain('id="btn-sync-data"');
        const dialog = html.slice(html.indexOf('id="sync-dialog"'), html.indexOf('</dialog>', html.indexOf('id="sync-dialog"')));
        for (const id of ['sync-send', 'sync-open', 'sync-file-input', 'sync-excel']) expect(dialog).toContain(`id="${id}"`);
        // Abgleich-Dateien aus Drag & Drop, „Öffnen mit" und Teilen-Ziel landen im Abgleich.
        const wizard = read('src/ui/importWizard.js');
        expect(wizard.match(/looksLikeSyncFile\(file\)/g)?.length).toBe(2);
    });
});

describe('Weg A: Empfang einer .tfsafe-Datei verliert keine Besuche', () => {
    it('vereinigt die Besuche dieses Geräts mit denen aus der Datei', () => {
        const phone = list();
        phone[1].besuche = [TODAY];               // heute am Handy erfasst, noch nicht weitergegeben
        const fromDesktop = list();
        fromDesktop[0].besuche = ['2026-09-01', '2026-10-15'];
        expect(carryOverVisits(phone, fromDesktop)).toBe(1);
        expect(fromDesktop[1].besuche).toEqual([TODAY]);
        expect(fromDesktop[0].besuche).toEqual(['2026-09-01', '2026-10-15']);
    });

    it('sagt im Bestätigungsfenster, dass die Besuche bleiben', () => {
        const message = datasetReplacementMessage({ incomingCount: 3, sourceLabel: 'Die empfangene TourFuchs-Datei', keepsCustomerVisits: true });
        expect(message).toContain('Deine Besuche bleiben erhalten');
        expect(message).not.toContain('Besuchs- und Gebietsdaten werden entfernt');
        expect(datasetReplacementMessage({ incomingCount: 3 })).toContain('Besuchs- und Gebietsdaten werden entfernt');
        const receive = read('src/ui/safeTransfer.js');
        expect(receive).toContain('keepsCustomerVisits: true');
        expect(receive.indexOf('carryOverVisits(state.customers, customers)')).toBeLessThan(receive.indexOf('replaceCustomers(customers, {'));
    });
});
