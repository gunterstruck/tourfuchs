import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    IMPORT_IN_FLIGHT_KEY, IMPORT_IN_FLIGHT_MAX_AGE_MS, formatFileSize, noteImportInFlight, clearImportInFlight, takeInterruptedImport
} from '../src/features/importInFlight.js';
import { safeFileReadErrorText } from '../src/ui/safeTransfer.js';
import { MESSAGES } from '../src/i18n/messages.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const memoryStorage = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
};

describe('Abgebrochener Import überlebt das Neuladen als Hinweis', () => {
    const file = { name: 'FY27_Alle_Bereiche_Gesamt 1-1.xlsx', size: 24_500_000 };

    it('verwirft der Browser die Seite mitten im Lesen, meldet der nächste Start den Import', () => {
        const storage = memoryStorage();
        noteImportInFlight(file, { storage, now: 1000 });
        // … Seite wird verworfen, clearImportInFlight läuft nie …
        expect(takeInterruptedImport({ storage, now: 5000 })).toEqual({ name: file.name, size: file.size });
        expect(storage.data.has(IMPORT_IN_FLIGHT_KEY)).toBe(false); // nur einmal melden
        expect(takeInterruptedImport({ storage, now: 6000 })).toBeNull();
    });

    it('ein regulär beendeter Import hinterlässt nichts', () => {
        const storage = memoryStorage();
        noteImportInFlight(file, { storage, now: 1000 });
        clearImportInFlight({ storage });
        expect(takeInterruptedImport({ storage, now: 2000 })).toBeNull();
    });

    it('alte oder kaputte Notizen sind kein Hinweis mehr', () => {
        const storage = memoryStorage();
        noteImportInFlight(file, { storage, now: 0 });
        expect(takeInterruptedImport({ storage, now: IMPORT_IN_FLIGHT_MAX_AGE_MS + 1 })).toBeNull();
        storage.setItem(IMPORT_IN_FLIGHT_KEY, '{kaputt');
        expect(takeInterruptedImport({ storage, now: 1 })).toBeNull();
    });

    it('ohne Speicher (privates Fenster) passiert nichts Schlimmes', () => {
        const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
        expect(() => noteImportInFlight(file, { storage: broken })).not.toThrow();
        expect(takeInterruptedImport({ storage: broken })).toBeNull();
    });

    it('nennt Größen lesbar', () => {
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(2048)).toBe('2 KB');
        expect(formatFileSize(24_500_000)).toBe('23,4 MB');
        expect(formatFileSize(24_500_000, 'en-US')).toBe('23.4 MB');
    });

    it('ist im Import angebunden: Notiz vor dem Lesen, Entfernen danach, Meldung beim Start', () => {
        const wizard = read('src/ui/importWizard.js');
        const feedback = wizard.slice(wizard.indexOf('async function readFileWithFeedback'));
        expect(feedback.indexOf('noteImportInFlight(file);')).toBeLessThan(feedback.indexOf('readWorkbookInBackground(file'));
        expect(feedback).toContain('clearImportInFlight();');
        expect(wizard).toContain('const interrupted = takeInterruptedImport();');
    });
});

describe('Verständliche Meldungen statt technischer Browsertexte', () => {
    it('ordnet Zugriffs- und Speicherfehler nach ihrem Namen zu', () => {
        const wizard = read('src/ui/importWizard.js');
        expect(wizard).toContain("NotReadableError: 'import.error.notReadable'");
        expect(wizard).toContain("t('import.error.memory')");
    });

    it.each(['de', 'en', 'fr', 'es'])('hat die neuen Texte in %s', (locale) => {
        for (const key of ['import.error.notReadable', 'import.error.memory', 'import.wait.largeMobile', 'import.interrupted']) {
            expect(MESSAGES[locale][key], `${locale}:${key}`).toBeTruthy();
        }
    });

    it('Empfang: Zugriffsfehler nennt Datei, Größe, Fehlertyp und die Abhilfe', () => {
        const text = safeFileReadErrorText({ name: 'NotReadableError' }, { name: 'TourFuchs-Umzug-2026-10-09.tfsafe', size: 48_000 });
        expect(text).toContain('„TourFuchs-Umzug-2026-10-09.tfsafe" (47 KB)');
        expect(text).toContain('[NotReadableError]');
        expect(text).toContain('Downloads');
    });
});

describe('Empfangsdialog: Rückmeldung im Dialog, Auswahl ohne Typfilter', () => {
    it('zeigt Status und Fehler im Dialog selbst', () => {
        const html = read('index.html');
        expect(html).toContain('<p id="safe-file-status" class="safe-file-status small" role="alert" hidden></p>');
        const ui = read('src/ui/safeTransfer.js');
        expect(ui).toContain("setFileStatus(text, 'error');");
        expect(ui).toContain("safeFileInput?.addEventListener('cancel'");
    });

    it('filtert die Dateiauswahl nicht nach Dateityp (Android kennt .tfsafe nicht)', () => {
        expect(read('index.html')).toContain('<input type="file" id="safe-file-input">');
    });

    it('Meldungen liegen über offenen Dialogen (Popover)', () => {
        expect(read('index.html')).toContain('<div id="toasts" class="toasts" aria-live="polite" popover="manual"></div>');
        expect(read('src/ui/toast.js')).toContain('container.showPopover();');
    });
});

describe('Excel: nur das benötigte Blatt, speichersparend', () => {
    it('liest zuerst nur Blattnamen und lädt dann ein Blatt in der dense-Form', () => {
        const excel = read('src/services/excel.js');
        expect(excel).toContain("XLSX.read(buffer, { type: 'array', codepage: 65001, sheetRows: 1 })");
        expect(excel).toContain('dense: true, cellStyles: false, cellHTML: false, cellFormula: false');
        expect(excel).toContain("if (Array.isArray(sheet['!data']))");
    });
});
