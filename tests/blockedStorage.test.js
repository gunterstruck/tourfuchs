import { afterEach, describe, expect, it, vi } from 'vitest';
import { localStore, sessionStore } from '../src/core/safeStorage.js';
import { readThemeChoice, saveThemeChoice } from '../src/ui/theme.js';
import { readLocaleChoice } from '../src/core/locale.js';
import { isHeavyFile, takeInterruptedImport } from '../src/features/importInFlight.js';
import { exactGeocodePreference } from '../src/ui/exactGeocoding.js';
import { zanoboBaseUrl, ZANOBO_DEFAULT_BASE } from '../src/services/zanobo.js';
import { downloadIcs } from '../src/features/tourExport.js';

/**
 * Gesperrte Website-Daten (Release 17.1a). Safari und Chrome mit blockierten
 * Cookies werfen schon beim Zugriff auf `localStorage` – bisher brach daran
 * der ganze Start ab (Seitenleiste, Begrüßung). Die zweite, unabhängige
 * Prüfung läuft im Browser: smoke-check „Start mit gesperrtem Browser-Speicher".
 */
const originals = {};
function blockStorage() {
    for (const name of ['localStorage', 'sessionStorage']) {
        originals[name] = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, {
            configurable: true,
            get() { throw new DOMException('The operation is insecure.', 'SecurityError'); }
        });
    }
}

afterEach(() => {
    for (const [name, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
        delete originals[name];
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('Gesperrter Browser-Speicher', () => {
    it('liefert null statt zu werfen', () => {
        blockStorage();
        expect(localStore()).toBeNull();
        expect(sessionStore()).toBeNull();
    });

    it('liefert den Speicher, wenn er erreichbar ist', () => {
        expect(localStore()).toBe(globalThis.localStorage);
        expect(sessionStore()).toBe(globalThis.sessionStorage);
    });

    it('Einstellungen fallen auf die Vorgabe zurück, statt den Start abzubrechen', () => {
        blockStorage();
        expect(readThemeChoice()).toBe('auto');
        expect(saveThemeChoice('dark')).toBe('dark');
        expect(readLocaleChoice()).toBe('auto');
        expect(takeInterruptedImport()).toBeNull();
        expect(isHeavyFile({ name: 'a.xlsx', size: 1 })).toBe(false);
        expect(exactGeocodePreference()).toBeNull();
        expect(zanoboBaseUrl()).toBe(ZANOBO_DEFAULT_BASE);
    });

    it('auch wenn erst Lesen und Schreiben werfen (Speicher da, aber gesperrt)', () => {
        const deny = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
        const storage = { getItem: deny, setItem: deny, removeItem: deny };
        vi.stubGlobal('localStorage', storage);
        expect(readThemeChoice()).toBe('auto');
        expect(exactGeocodePreference()).toBeNull();
        expect(zanoboBaseUrl()).toBe(ZANOBO_DEFAULT_BASE);
    });
});

describe('Kalender-Export', () => {
    it('gibt die Datei erst nach dem Herunterladen frei, nicht im selben Moment', () => {
        vi.useFakeTimers();
        const revoked = [];
        vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:kalender', revokeObjectURL: (url) => revoked.push(url) });
        downloadIcs({ lat: 51.45, lng: 7.0, label: 'Start' }, [{ id: 'k1', name: 'Muster GmbH', lat: 51.45, lng: 7.01 }], {
            startTime: '2026-10-12T08:00'
        });
        expect(revoked).toEqual([]);
        vi.advanceTimersByTime(59_000);
        expect(revoked).toEqual([]);
        vi.advanceTimersByTime(1_000);
        expect(revoked).toEqual(['blob:kalender']);
    });
});
