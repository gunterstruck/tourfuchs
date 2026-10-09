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
