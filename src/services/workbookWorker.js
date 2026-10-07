import { readWorkbook } from './excel.js';

self.onmessage = async ({ data: { file, options } }) => {
    try {
        const result = await readWorkbook(file, {
            ...options,
            onPhase: (phase) => self.postMessage({ type: 'phase', phase })
        });
        // Sending a huge result in one message would freeze the UI again while
        // the browser clones it. Small batches also leave room for cancellation.
        const { rows, ...metadata } = result;
        self.postMessage({ type: 'metadata', metadata });
        for (let start = 0; start < rows.length; start += 1000) {
            self.postMessage({ type: 'rows', rows: rows.slice(start, start + 1000) });
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        self.postMessage({ type: 'result' });
    } catch (error) {
        self.postMessage({ type: 'error', message: String(error?.message || error) });
    }
};
