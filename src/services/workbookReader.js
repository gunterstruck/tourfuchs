/**
 * Read a file's bytes right away, on the main thread.
 *
 * In managed company environments (Intune work profile, OneDrive, Teams,
 * Outlook) the browser may hand out a file reference whose read permission is
 * revoked moments later – Chrome/Edge then fail with `NotReadableError`. Reading
 * immediately keeps that window small and surfaces the error with its real name
 * instead of a generic worker failure. The bytes are transferred to the worker,
 * not copied.
 */
export async function readFileBytes(file) {
    try {
        return await file.arrayBuffer();
    } catch (error) {
        const wrapped = new Error(String(error?.message || error));
        wrapped.name = error?.name || 'NotReadableError';
        throw wrapped;
    }
}

/** A fresh, cancellable local worker per read; never fall back to blocking the UI. */
export function readWorkbookInBackground(file, options = {}, { signal, onPhase } = {}) {
    return new Promise((resolve, reject) => {
        const aborted = () => new DOMException('Import cancelled', 'AbortError');
        if (signal?.aborted) { reject(aborted()); return; }
        let worker;
        let settled = false;
        let result;
        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            signal?.removeEventListener('abort', cancel);
            worker?.terminate();
            if (error) reject(error);
            else resolve(result);
        };
        const cancel = () => finish(aborted());
        signal?.addEventListener('abort', cancel, { once: true });
        readFileBytes(file).then((buffer) => {
            if (settled) return;
            try {
                worker = new Worker(new URL('./workbookWorker.js', import.meta.url), { type: 'module' });
                worker.onmessage = ({ data }) => {
                    if (settled) return;
                    if (data.type === 'phase') onPhase?.(data.phase);
                    else if (data.type === 'metadata') result = { ...data.metadata, rows: [] };
                    else if (data.type === 'rows') result.rows.push(...data.rows);
                    else if (data.type === 'result') finish(null, result);
                    else if (data.type === 'error') {
                        const error = new Error(data.message);
                        if (data.name) error.name = data.name;
                        finish(error);
                    }
                };
                worker.onerror = (event) => {
                    event.preventDefault();
                    finish(new Error('Import worker could not start.'));
                };
                worker.onmessageerror = () => finish(new Error('Import worker response could not be read.'));
                worker.postMessage({ buffer, name: file.name, type: file.type, options }, [buffer]);
            } catch {
                finish(new Error('Import worker could not start.'));
            }
        }, (error) => finish(error));
    });
}
