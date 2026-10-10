import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decryptSafeTransfer, keyMatchesContainer, parseKeyQr, readSafeFile } from '../src/features/safeTransfer.js';

/**
 * Abwärtskompatibilität des sicheren Umzugs.
 *
 * Die Datei unten wurde am 09.10.2026 mit dem damaligen Stand erzeugt
 * (Format `__tfsafe` Version 1, synthetische Testdaten) und liegt
 * unverändert im Repo. Wer Format, Verschlüsselung oder Leselogik ändert,
 * muss sie weiterhin öffnen können – sonst wären Umzugsdateien, die Nutzer
 * noch auf dem Handy oder im Postfach haben, plötzlich wertlos.
 */
const FILE = 'tests/fixtures/TourFuchs-Umzug-2026-10-09.tfsafe';
const KEY_QR = 'TFK1:3663c2a95183:vP8iAmR1yzSDkjCqS3fybiPfQPFFd8STNpySs5l4chc=';

describe('Alte Umzugsdateien bleiben lesbar', () => {
    it('öffnet die Datei vom 09.10.2026 mit ihrem Schlüssel', async () => {
        const bytes = readFileSync(FILE);
        const { container, problem } = readSafeFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        expect(problem).toBeFalsy();
        const key = parseKeyQr(KEY_QR);
        expect(keyMatchesContainer(container, key)).toBe(true);
        const data = await decryptSafeTransfer(container, key.keyB64);
        expect(data.customers).toHaveLength(1);
        expect(data.customers[0]).toMatchObject({
            nummer: '1', name: 'Alt GmbH', strasse: 'Domkloster 4', plz: '50667',
            geo: 'exakt', besuche: ['2026-09-01'], extra: { VK: 'Vera 0171 1' }
        });
    });

    it('lehnt einen fremden Schlüssel ab', () => {
        const bytes = readFileSync(FILE);
        const { container } = readSafeFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        const fremd = parseKeyQr(KEY_QR.replace(/:[^:]+:/, ':000000000000:'));
        expect(keyMatchesContainer(container, fremd)).toBe(false);
    });
});

describe('Umzug mit dem Stand nach Release 15/16', () => {
    it('die alte Datei läuft durch die heutige Übernahme und Kachel (ohne neue Felder)', async () => {
        const { setCustomers, state } = await import('../src/core/state.js');
        const { customerPopupHtml } = await import('../src/features/map.js');
        const bytes = readFileSync(FILE);
        const { container } = readSafeFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        const data = await decryptSafeTransfer(container, parseKeyQr(KEY_QR).keyB64);
        setCustomers(data.customers);
        expect(state.customers).toHaveLength(1);
        // Rollenspalte „VK" wird zur Filterebene „Zuständig · VK" – auch aus der alten Datei.
        expect(state.dims['team:vk']?.active).toBe(true);
        const html = customerPopupHtml({ ...state.customers[0], id: state.customers[0].id || 'k1' });
        expect(html).toContain('Alt GmbH');
        expect(html).not.toContain('data-popup-section="opps"');
        setCustomers([]);
    });

    it('nimmt Umsatzjahre, Promotoren, Sperrvermerke, Opportunities und Produkte vollständig mit', async () => {
        const { createSafeTransfer } = await import('../src/features/safeTransfer.js');
        const customer = {
            id: 'k-nr:0042', nummer: '0042', name: 'Nord GmbH', plz: '50667', geo: 'exakt', lat: 50.9, lng: 6.9, besuche: [],
            umsatzJahre: { 2024: 1000, 2025: 1100, 2026: 990 },
            geoExactMiss: undefined,
            contacts: [
                { id: 'p1', name: 'Paul Prom', art: 'promotor', thema: 'Akku', primary: false },
                { id: 'ss-1', name: 'Dirk Dunkel', quelle: 'arbeitsmappe', nichtAnrufen: true, sperreEmail: true, doi: false, primary: false }
            ],
            opps: [{ id: 'OP-1', name: 'Retrofit', phase: '3', status: 'offen', amount: 120000, close: '2027-03-31' }],
            produkte: [{ pck: '0815', beschreibung: 'Antriebe', jahre: { 2024: 100 }, summe: 150 }],
            extra: { IFA: '000123', 'SieSales Link': 'https://crm.example.test/a/1' }
        };
        const { container, keyQr } = await createSafeTransfer({ customers: [customer] });
        const back = await decryptSafeTransfer(container, parseKeyQr(keyQr).keyB64);
        expect(back.customers[0]).toEqual(JSON.parse(JSON.stringify(customer)));
    });
});
