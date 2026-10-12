import { describe, expect, it } from 'vitest';
import { createSafeTransfer, decryptSafeTransfer, parseKeyQr, readSafeKeyFile } from '../src/features/safeTransfer.js';

const encode = (text) => new TextEncoder().encode(text);

describe('Schlüssel als Textdatei laden', () => {
    it('entschlüsselt eine echte Umzugsdatei mit dem exportierten TXT-Schlüssel', async () => {
        const data = { customers: [{ nummer: '4711', name: 'Test GmbH' }] };
        const { container, keyQr } = await createSafeTransfer(data);
        const text = readSafeKeyFile(encode(`${keyQr}\r\n`));
        expect(text).toBe(keyQr);
        expect(await decryptSafeTransfer(container, parseKeyQr(text).keyB64)).toEqual(data);
    });

    it('verträgt UTF-8-BOM, Erklärungszeilen und UTF-16 aus Windows-Texteditoren', async () => {
        const { keyQr } = await createSafeTransfer({});
        const text = `\ufeffTourFuchs-Schlüssel\r\n${keyQr}\r\nGetrennt aufbewahren.`;
        expect(readSafeKeyFile(encode(text))).toBe(keyQr);
        for (const bigEndian of [false, true]) {
            const bytes = new Uint8Array(text.length * 2);
            const view = new DataView(bytes.buffer);
            [...text].forEach((c, i) => view.setUint16(i * 2, c.charCodeAt(0), !bigEndian));
            expect(readSafeKeyFile(bytes)).toBe(keyQr);
        }
    });

    it('lehnt fremde, leere, zu große und mehrdeutige Dateien ab', async () => {
        const a = await createSafeTransfer({});
        const b = await createSafeTransfer({});
        for (const text of ['', 'kein Schlüssel', 'TFK1:id:unvollständig', JSON.stringify(a.container), `${a.keyQr}\n${b.keyQr}`, 'x'.repeat(16384) + a.keyQr]) {
            expect(readSafeKeyFile(encode(text))).toBeNull();
        }
    });
});
