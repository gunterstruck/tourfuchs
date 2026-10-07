import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readWorkbookInBackground } from '../src/services/workbookReader.js';

let workers;
class TestWorker {
    constructor() { workers.push(this); }
    terminate = vi.fn();
    postMessage = vi.fn();
    send(data) { this.onmessage({ data }); }
}
beforeEach(() => { workers = []; vi.stubGlobal('Worker', TestWorker); });
afterEach(() => vi.unstubAllGlobals());

describe('Background workbook reader', () => {
    it('assembles metadata and ordered row batches, forwards phases and releases the worker', async () => {
        const file = new File(['test'], 'customers.xlsx');
        const onPhase = vi.fn();
        const pending = readWorkbookInBackground(file, { sheet: 'Second', headerRow: 3 }, { onPhase });
        const worker = workers[0];
        expect(worker.postMessage).toHaveBeenCalledWith({ file, options: { sheet: 'Second', headerRow: 3 } });
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
        const pending = readWorkbookInBackground({}, {}, { signal: controller.signal, onPhase });
        controller.abort();
        workers[0].send({ type: 'phase', phase: 'columns' });
        workers[0].send({ type: 'result' });
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        expect(workers[0].terminate).toHaveBeenCalledOnce();
        expect(onPhase).not.toHaveBeenCalled();
    });

    it('does not start a worker when already cancelled', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(readWorkbookInBackground({}, {}, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        expect(workers).toHaveLength(0);
    });

    it('keeps the parser error and releases the worker', async () => {
        const pending = readWorkbookInBackground({});
        workers[0].send({ type: 'error', message: 'Das Tabellenblatt enthält keine Datenzeilen.' });
        await expect(pending).rejects.toThrow('Das Tabellenblatt enthält keine Datenzeilen.');
        expect(workers[0].terminate).toHaveBeenCalledOnce();
    });

    it('reports startup failure instead of parsing synchronously', async () => {
        vi.stubGlobal('Worker', class { constructor() { throw new Error('Blocked'); } });
        await expect(readWorkbookInBackground({})).rejects.toThrow('Import worker could not start.');
    });

    it.each(['onerror', 'onmessageerror'])('releases the worker after %s', async (handler) => {
        const pending = readWorkbookInBackground({});
        workers[0][handler]({ preventDefault: vi.fn() });
        await expect(pending).rejects.toThrow(/Import worker/);
        expect(workers[0].terminate).toHaveBeenCalledOnce();
    });
});
