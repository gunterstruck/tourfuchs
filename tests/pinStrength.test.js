// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vault from '../src/services/vault.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const OPTS = { iterations: 1000, autoLockMs: 0 };

beforeEach(async () => { await vault.wipe(); });

describe('PIN-Regeln', () => {
    it('verlangt für neue PINs mindestens 6 Zeichen', () => {
        expect(vault.PIN_MIN_LENGTH).toBe(6);
        expect(vault.pinStrength('1234')).toMatchObject({ level: 'zu-kurz', ok: false });
        expect(vault.pinStrength('12345')).toMatchObject({ ok: false });
        expect(vault.pinStrength('123456')).toMatchObject({ level: 'schwach', ok: true });
    });

    it('bewertet ehrlich: Ziffern schwach, lange Ziffern mittel, Passphrase stark', () => {
        expect(vault.pinStrength('12345678').level).toBe('mittel');
        expect(vault.pinStrength('123456789012').level).toBe('stark');
        expect(vault.pinStrength('fuchs7').level).toBe('mittel');
        expect(vault.pinStrength('Fuchs-fährt-los').level).toBe('stark');
        expect(vault.pinStrength('Köln-7-Nord').level).toBe('stark');
    });

    it('merkt sich, ob die PIN nur aus Ziffern besteht (Tastatur am Sperrbildschirm)', async () => {
        await vault.setup('Fuchs-fährt-los', OPTS);
        expect(vault.pinIsNumeric()).toBe(false);
        await vault.changePin('Fuchs-fährt-los', '12345678');
        expect(vault.pinIsNumeric()).toBe(true);
        const { recoveryCode } = await (async () => { await vault.wipe(); return vault.setup('123456', OPTS); })();
        await vault.resetPinWithRecovery(recoveryCode, 'Neue-Passphrase-2026');
        expect(vault.pinIsNumeric()).toBe(false);
    });

    it('bestehende Tresore ohne Angabe gelten als Ziffern-PIN', async () => {
        await vault.setup('1234', OPTS);            // Altbestand: 4-stellig bleibt gültig
        vault.lock();
        await vault.unlock('1234');
        expect(vault.isUnlocked()).toBe(true);
    });
});

describe('PIN-Regeln in der Oberfläche', () => {
    const ui = read('src/ui/lockVault.js');

    it('alle drei Wege (Einrichten, Ändern, nach Wiederherstellung) prüfen die Länge', () => {
        expect(ui.match(/if \(pinTooShort\((pin|nw)\)\)/g)).toHaveLength(3);
        expect(ui).not.toContain('mind. 4 Zeichen');
        expect(ui).not.toMatch(/length < 4/);
        for (const id of ['setup-pin', 'cp-new', 'rp-new']) expect(ui).toContain(`wirePinStrength('${id}')`);
    });

    it('zeigt am Sperrbildschirm Ziffernblock oder volle Tastatur passend zur PIN', () => {
        expect(ui).toContain("pin.inputMode = numeric ? 'numeric' : 'text';");
    });

    it('die Live-Demo tippt eine Passphrase, keine 4-stellige PIN', () => {
        const showcase = read('src/ui/showcase.js');
        expect(showcase).toContain("fillNoFocus('#setup-pin', 'Fuchs-fährt-los')");
        expect(showcase).not.toContain("'2468'");
    });
});
