import { readWorkbook } from './excel.js';

self.onmessage = async ({ data: { buffer, name, type, options } }) => {
    try {
        // The main thread already read the bytes (see readFileBytes); give
        // readWorkbook the small file-like surface it uses.
        const file = { name, type, arrayBuffer: async () => buffer };
        const result = await readWorkbook(file, {
            ...options,
            onPhase: (phase) => self.postMessage({ type: 'phase', phase })
        });
        // Sending a huge result in one message would freeze the UI again while
        // the browser clones it. Small batches also leave room for cancellation.
        const { rows, sideSheets, ...metadata } = result;
        self.postMessage({ type: 'metadata', metadata });
        for (let start = 0; start < rows.length; start += 1000) {
            self.postMessage({ type: 'rows', rows: rows.slice(start, start + 1000) });
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        // Weitere Blätter der Vertriebs-Arbeitsmappe ebenso in Portionen.
        for (const [sheet, sheetRows] of Object.entries(sideSheets || {})) {
            self.postMessage({ type: 'side', sheet, rows: [] });
            for (let start = 0; start < sheetRows.length; start += 1000) {
                self.postMessage({ type: 'side', sheet, rows: sheetRows.slice(start, start + 1000) });
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
        self.postMessage({ type: 'result' });
    } catch (error) {
        self.postMessage({ type: 'error', message: String(error?.message || error), name: error?.name || '' });
    }
};
