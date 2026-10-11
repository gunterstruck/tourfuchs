import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vault from '../src/services/vault.js';

/**
 * Tresore aller bisherigen Stände lassen sich weiter öffnen (Release 17.0).
 *
 * Jede Datei in tests/fixtures/tresor ist ein echter Datentresor, am 11.10.2026
 * mit dem Tresor-Code eines historischen Stands eingerichtet (PIN, Wieder-
 * herstellungscode, verschlüsselter Datenbestand):
 *
 *   2026-07-11-erster-tresor        5b7641e  erster Tresor, 4-stellige PIN
 *   2026-07-11-recovery-neue-pin    6d6d522  Wiederherstellung → neue PIN
 *   2026-07-17-recovery-bias-fix    8713ba0  geänderte Code-Erzeugung
 *   2026-09-30-starke-pin           fd85978  mind. 6 Zeichen
 *   2026-10-04-schreibreihenfolge   37e0047  Passphrase, heutiger Stand
 *
 * Wer Tresor, Schlüsselableitung oder Verschlüsselung ändert, muss diese
 * Tresore weiter mit PIN und mit Wiederherstellungscode öffnen können – sonst
 * kommen Nutzer mit eingerichtetem Tresor nicht mehr an ihre Kunden.
 * Bewusst auch alte 4-stellige PINs: Die Mindestlänge gilt nur beim Einrichten.
 */
const DIR = resolve(process.cwd(), 'tests/fixtures/tresor');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const load = (file) => JSON.parse(readFileSync(resolve(DIR, file), 'utf8'));

function install(fixture) {
    vault.lock();
    localStorage.clear();
    localStorage.setItem('tf_vault', JSON.stringify(fixture.meta));
}

afterEach(() => {
    vault.lock();
    localStorage.clear();
});

describe('Tresore aller Stände', () => {
    it('liegen vollständig vor (5 Stände)', () => {
        expect(FILES).toHaveLength(5);
    });

    for (const file of FILES) {
        describe(file, () => {
            it('öffnet mit der PIN und entschlüsselt den gespeicherten Bestand', async () => {
                const fixture = load(file);
                install(fixture);
                expect(vault.isEnabled()).toBe(true);
                expect(vault.isLocked()).toBe(true);
                await expect(vault.unlock(fixture.pin)).resolves.toBe(true);
                expect(vault.isEncryptedPayload(fixture.payload)).toBe(true);
                expect(await vault.decryptFromStore(fixture.payload)).toEqual(fixture.inhalt);
            });

            it('öffnet mit dem Wiederherstellungscode – auch klein und ohne Bindestriche getippt', async () => {
                const fixture = load(file);
                for (const code of [fixture.recoveryCode, fixture.recoveryCode.toLowerCase().replace(/-/g, ' ')]) {
                    install(fixture);
                    await expect(vault.unlockWithRecovery(code)).resolves.toBe(true);
                    expect(await vault.decryptFromStore(fixture.payload)).toEqual(fixture.inhalt);
                }
            });

            it('lehnt eine falsche PIN ab, ohne den Tresor zu löschen', async () => {
                const fixture = load(file);
                install(fixture);
                await expect(vault.unlock(`${fixture.pin}x`)).rejects.toMatchObject({ code: 'wrong-pin' });
                expect(vault.isEnabled()).toBe(true);
                await expect(vault.unlock(fixture.pin)).resolves.toBe(true);
            });
        });
    }
});
