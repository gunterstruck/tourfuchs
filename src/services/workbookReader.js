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
        try {
            worker = new Worker(new URL('./workbookWorker.js', import.meta.url), { type: 'module' });
            worker.onmessage = ({ data }) => {
                if (settled) return;
                if (data.type === 'phase') onPhase?.(data.phase);
                else if (data.type === 'metadata') result = { ...data.metadata, rows: [] };
                else if (data.type === 'rows') result.rows.push(...data.rows);
                else if (data.type === 'result') finish(null, result);
                else if (data.type === 'error') finish(new Error(data.message));
            };
            worker.onerror = (event) => {
                event.preventDefault();
                finish(new Error('Import worker could not start.'));
            };
            worker.onmessageerror = () => finish(new Error('Import worker response could not be read.'));
            signal?.addEventListener('abort', cancel, { once: true });
            if (signal?.aborted) { cancel(); return; }
            worker.postMessage({ file, options });
        } catch {
            finish(new Error('Import worker could not start.'));
        }
    });
}
