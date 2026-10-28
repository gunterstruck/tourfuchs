import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CHOICE_KEY, COMMUNITY_URL, CUTOVER, cutoverDecision, runSiemensCutover, wipeLocalData
} from '../src/ui/siemensCutover.js';

/**
 * Harter Schnitt für Siemens (PO, 28.10.2026): ab 30.10. fragt die externe
 * Version „Arbeitest du bei Siemens?" – Ja: nur der Weg zur internen Version,
 * die App startet nicht; Nein: alles wie bisher.
 */
const before = new Date(2026, 9, 29, 23, 59);
const after = new Date(2026, 9, 30, 0, 0);

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, String(v)),
        removeItem: (k) => data.delete(k),
        clear: () => data.clear(),
        get size() { return data.size; }
    };
}

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('Wann gefragt wird', () => {
    it('Stichtag ist der 30.10.2026', () => {
        expect(CUTOVER.getFullYear()).toBe(2026);
        expect(CUTOVER.getMonth()).toBe(9);
        expect(CUTOVER.getDate()).toBe(30);
    });

    it('vor dem Stichtag startet die App wie immer', () => {
        expect(cutoverDecision({ now: before })).toBe('start');
        expect(cutoverDecision({ now: before, choice: 'siemens' })).toBe('start');
    });

    it('ab dem Stichtag: fragen, dann der Antwort folgen', () => {
        expect(cutoverDecision({ now: after })).toBe('ask');
        expect(cutoverDecision({ now: after, choice: 'siemens' })).toBe('blocked');
        expect(cutoverDecision({ now: after, choice: 'extern' })).toBe('start');
    });

    it('automatisierte Prüfläufe sehen die Frage nicht', () => {
        expect(cutoverDecision({ now: after, automated: true })).toBe('start');
    });

    it('?siemens-hinweis zeigt die Frage schon vorher, auch in Prüfläufen', () => {
        expect(cutoverDecision({ now: before, forced: true })).toBe('ask');
        expect(cutoverDecision({ now: before, automated: true, forced: true })).toBe('ask');
        expect(cutoverDecision({ now: before, forced: true, choice: 'siemens' })).toBe('blocked');
    });
});

describe('Ablauf beim Start', () => {
    it('„Ja, ich bin bei Siemens": App startet nicht, Hinweis mit Viva-Link, Antwort gemerkt', async () => {
        const storage = memoryStorage();
        const result = runSiemensCutover({ storage, now: after });
        document.getElementById('siemens-cutover-yes').click();
        expect(await result).toBe(true);
        expect(storage.getItem(CHOICE_KEY)).toBe('siemens');
        const link = document.getElementById('siemens-cutover-community');
        expect(link.getAttribute('href')).toBe(COMMUNITY_URL);
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(document.getElementById('siemens-cutover-title').textContent).toBe('TourFuchs für Siemens ist umgezogen');
    });

    it('„Nein, ich bin extern": Frage verschwindet, App startet', async () => {
        const storage = memoryStorage();
        const result = runSiemensCutover({ storage, now: after });
        document.getElementById('siemens-cutover-no').click();
        expect(await result).toBe(false);
        expect(storage.getItem(CHOICE_KEY)).toBe('extern');
        expect(document.querySelector('.siemens-cutover')).toBeNull();
    });

    it('beim nächsten Start bleibt es beim Hinweis, ohne erneute Frage', async () => {
        const storage = memoryStorage({ [CHOICE_KEY]: 'siemens' });
        expect(await runSiemensCutover({ storage, now: after })).toBe(true);
        expect(document.getElementById('siemens-cutover-yes')).toBeNull();
        expect(document.getElementById('siemens-cutover-community')).not.toBeNull();
    });

    it('vor dem Stichtag erscheint nichts', async () => {
        const storage = memoryStorage();
        expect(await runSiemensCutover({ storage, now: before })).toBe(false);
        expect(document.querySelector('.siemens-cutover')).toBeNull();
    });
});

describe('Daten auf diesem Gerät löschen', () => {
    it('löscht alle Datenbanken und den Browser-Speicher, behält nur die Antwort', async () => {
        const deleted = [];
        const idb = {
            databases: async () => [{ name: 'geofuchs-db' }, { name: 'andere-db' }],
            deleteDatabase(name) {
                deleted.push(name);
                const request = {};
                queueMicrotask(() => request.onsuccess?.());
                return request;
            }
        };
        const storage = memoryStorage({ [CHOICE_KEY]: 'siemens', tf_vault: '{}', tf_theme: 'dark' });
        const session = memoryStorage({ tf_demo_welcome_ack: '1' });
        await wipeLocalData({ idb, storage, session });
        expect(deleted.sort()).toEqual(['andere-db', 'geofuchs-db']);
        expect(storage.getItem('tf_vault')).toBeNull();
        expect(storage.getItem(CHOICE_KEY)).toBe('siemens');
        expect(session.size).toBe(0);
    });

    it('ohne databases() (ältere Browser) wenigstens die TourFuchs-Datenbank', async () => {
        const deleted = [];
        const idb = { deleteDatabase(name) { deleted.push(name); const r = {}; queueMicrotask(() => r.onsuccess?.()); return r; } };
        await wipeLocalData({ idb, storage: memoryStorage(), session: memoryStorage() });
        expect(deleted).toEqual(['geofuchs-db']);
    });
});
