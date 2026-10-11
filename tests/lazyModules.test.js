import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Bei Bedarf geladene Bibliotheken (Release 17.1b). PO, 11.10.2026: „Beim
 * Laden oder Export kann es dauern. Der Nutzer denkt schon, alles ist
 * eingefroren." Vorladen im Leerlauf + sichtbares „bitte warten".
 */
const excelLoad = vi.fn();
const jsqrLoad = vi.fn();
const qrcodeLoad = vi.fn();
vi.mock('../src/services/excel.js', () => { excelLoad(); return { marker: 'excel' }; });
vi.mock('jsqr', () => { jsqrLoad(); return { default: () => null }; });
vi.mock('qrcode', () => { qrcodeLoad(); return { default: { toCanvas: async () => {} } }; });

beforeEach(() => {
    vi.resetModules();
    excelLoad.mockClear();
    jsqrLoad.mockClear();
    qrcodeLoad.mockClear();
    document.body.innerHTML = '<div id="app-busy" class="app-busy" hidden><span class="app-busy-text"></span></div>';
});
afterEach(() => { document.body.innerHTML = ''; });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Vorladen im Leerlauf', () => {
    it('lädt Excel, QR-Leser und QR-Erzeuger nacheinander – je in eigenem Leerlauf', async () => {
        const { prefetchWhenIdle } = await import('../src/ui/lazyModules.js');
        const pending = [];
        const idle = (fn) => pending.push(fn);
        prefetchWhenIdle({ idle });
        expect(excelLoad).not.toHaveBeenCalled();   // nichts im Startmoment selbst

        pending.shift()(); await flush();
        expect(excelLoad).toHaveBeenCalledTimes(1);
        expect(jsqrLoad).not.toHaveBeenCalled();

        pending.shift()(); await flush();
        expect(jsqrLoad).toHaveBeenCalledTimes(1);
        expect(qrcodeLoad).not.toHaveBeenCalled();

        pending.shift()(); await flush();
        expect(qrcodeLoad).toHaveBeenCalledTimes(1);
        // Danach ist die Warteschlange leer: ein letzter Leerlauf-Aufruf, der nichts mehr lädt.
        pending.shift()(); await flush();
        expect(pending).toHaveLength(0);
    });

    it('startet nur einmal, auch wenn der Start (z. B. nach dem Entsperren) erneut läuft', async () => {
        const { prefetchWhenIdle } = await import('../src/ui/lazyModules.js');
        const pending = [];
        prefetchWhenIdle({ idle: (fn) => pending.push(fn) });
        prefetchWhenIdle({ idle: (fn) => pending.push(fn) });
        expect(pending).toHaveLength(1);
    });
});

describe('Excel bei Bedarf', () => {
    it('zeigt „Excel wird vorbereitet" während des Ladens und räumt danach auf', async () => {
        const { excelModule } = await import('../src/ui/lazyModules.js');
        const box = document.getElementById('app-busy');
        const loading = excelModule();
        expect(box.hidden).toBe(false);
        expect(box.textContent).toContain('Excel');
        expect(await loading).toMatchObject({ marker: 'excel' });
        expect(box.hidden).toBe(true);
    });

    it('teilt ein laufendes Laden – Vorladen und Klick laden nicht doppelt', async () => {
        const { loadExcelModule, loadQrReaderModule, loadQrWriterModule } = await import('../src/ui/lazyModules.js');
        expect(loadExcelModule()).toBe(loadExcelModule());
        expect(loadQrReaderModule()).toBe(loadQrReaderModule());
        expect(loadQrWriterModule()).toBe(loadQrWriterModule());
    });
});
