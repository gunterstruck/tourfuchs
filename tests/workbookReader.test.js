import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readWorkbookInBackground, readFileBytes } from '../src/services/workbookReader.js';

let workers;
class TestWorker {
    constructor() { workers.push(this); }
    terminate = vi.fn();
    postMessage = vi.fn();
    send(data) { this.onmessage({ data }); }
}
beforeEach(() => { workers = []; vi.stubGlobal('Worker', TestWorker); });
afterEach(() => vi.unstubAllGlobals());

// Der Worker startet erst, wenn die Bytes gelesen sind (readFileBytes).
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const file = (name = 'customers.xlsx') => new File(['test'], name);

describe('Background workbook reader', () => {
    it('assembles metadata and ordered row batches, forwards phases and releases the worker', async () => {
        const source = file();
        const onPhase = vi.fn();
        const pending = readWorkbookInBackground(source, { sheet: 'Second', headerRow: 3 }, { onPhase });
        await settle();
        const worker = workers[0];
        const [message, transfer] = worker.postMessage.mock.calls[0];
        expect(message).toMatchObject({ name: 'customers.xlsx', options: { sheet: 'Second', headerRow: 3 } });
        expect(message.buffer).toBeInstanceOf(ArrayBuffer);
        expect(transfer).toEqual([message.buffer]); // übertragen, nicht kopiert
        worker.send({ type: 'phase', phase: 'columns' });
        worker.send({ type: 'metadata', metadata: { headers: ['PLZ'], sheetName: 'Second', headerRow: 3 } });
        worker.send({ type: 'rows', rows: [{ PLZ: '00123' }] });
        worker.send({ type: 'rows', rows: [{ PLZ: '50667' }] });
        worker.send({ type: 'result' });
        await expect(pending).resolves.toEqual({ headers: ['PLZ'], sheetName: 'Second', headerRow: 3, rows: [{ PLZ: '00123' }, { PLZ: '50667' }] });
        expect(onPhase).toHaveBeenCalledWith('columns');
        expect(worker.terminate).toHaveBeenCalledOnce();
    });

    it('terminates on cancellation and ignores late worker messages', async () => {
        const controller = new AbortController();
        const onPhase = vi.fn();
        const pending = readWorkbookInBackground(file(), {}, { signal: controller.signal, onPhase });
        await settle();
        controller.abort();
        workers[0].send({ type: 'phase', phase: 'columns' });
        workers[0].send({ type: 'result' });
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        expect(workers[0].terminate).toHaveBeenCalledOnce();
        expect(onPhase).not.toHaveBeenCalled();
    });

    it('does not start a worker when cancelled while the file is still being read', async () => {
        const controller = new AbortController();
        const pending = readWorkbookInBackground(file(), {}, { signal: controller.signal });
        controller.abort();
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        await settle();
        expect(workers).toHaveLength(0);
    });

    it('does not start a worker when already cancelled', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(readWorkbookInBackground(file(), {}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        expect(workers).toHaveLength(0);
    });

    it('keeps the parser error (with its name) and releases the worker', async () => {
        const pending = readWorkbookInBackground(file());
        await settle();
        workers[0].send({ type: 'error', message: 'Das Tabellenblatt enthält keine Datenzeilen.' });
        await expect(pending).rejects.toThrow('Das Tabellenblatt enthält keine Datenzeilen.');
        expect(workers[0].terminate).toHaveBeenCalledOnce();

        const memory = readWorkbookInBackground(file());
        await settle();
        workers[1].send({ type: 'error', message: 'Array buffer allocation failed', name: 'RangeError' });
        await expect(memory).rejects.toMatchObject({ name: 'RangeError' });
    });

    it('reports startup failure instead of parsing synchronously', async () => {
        vi.stubGlobal('Worker', class { constructor() { throw new Error('Blocked'); } });
        await expect(readWorkbookInBackground(file())).rejects.toThrow('Import worker could not start.');
    });

    it.each(['onerror', 'onmessageerror'])('releases the worker after %s', async (handler) => {
        const pending = readWorkbookInBackground(file());
        await settle();
        workers[0][handler]({ preventDefault: vi.fn() });
        await expect(pending).rejects.toThrow(/Import worker/);
        expect(workers[0].terminate).toHaveBeenCalledOnce();
    });
});

describe('Datei sofort lesen – Zugriffsfehler im Firmenbereich', () => {
    // Nachgestellt: Edge im Intune-Arbeitsprofil liefert eine Datei, deren
    // Leserecht gleich wieder entzogen wird.
    const unreadable = {
        name: 'FY27_Alle_Bereiche_Gesamt.xlsx',
        size: 25_000_000,
        arrayBuffer: () => Promise.reject(Object.assign(new Error('The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.'), { name: 'NotReadableError' }))
    };

    it('meldet den Fehler mit seinem Namen und startet keinen Worker', async () => {
        await expect(readWorkbookInBackground(unreadable)).rejects.toMatchObject({ name: 'NotReadableError' });
        expect(workers).toHaveLength(0);
    });

    it('readFileBytes behält den Namen auch für fremde Fehlerobjekte', async () => {
        await expect(readFileBytes(unreadable)).rejects.toMatchObject({ name: 'NotReadableError' });
        await expect(readFileBytes({ arrayBuffer: () => Promise.reject('kaputt') })).rejects.toMatchObject({ name: 'NotReadableError' });
    });
});
