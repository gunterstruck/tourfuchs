import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sicherer Umzug senden: Wird der Tresor mitten im Export gesperrt (während
 * verschlüsselt oder der QR-Erzeuger geladen wird), darf danach weder eine
 * Datei heruntergeladen noch der Schlüssel angezeigt werden
 * (Prüfbefund 25.10.2026: der Exportdialog ging über dem Sperrbildschirm auf).
 */
let locked = false;
let qrWriter;
let transfer;

vi.mock('../src/services/vault.js', async (importOriginal) => ({
    ...(await importOriginal()),
    isLocked: () => locked
}));
vi.mock('../src/ui/lazyModules.js', async (importOriginal) => ({
    ...(await importOriginal()),
    loadQrWriterModule: () => qrWriter.promise
}));
vi.mock('../src/features/safeTransfer.js', async (importOriginal) => ({
    ...(await importOriginal()),
    createSafeTransfer: () => transfer.promise
}));

const { state, emit } = await import('../src/core/state.js');
const { initSafeTransfer } = await import('../src/ui/safeTransfer.js');

function deferred() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
}

const BUNDLE = { container: { id: 'abc' }, keyQr: 'TFK1:geheim', count: 1 };
const QR = { default: { toCanvas: async () => {} } };
const flush = () => new Promise((r) => setTimeout(r, 0));
let downloads = 0;

if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
}
if (!HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
URL.createObjectURL = () => 'blob:test';
URL.revokeObjectURL = () => {};
HTMLAnchorElement.prototype.click = function click() { if (this.download) downloads++; };

let initialized = false;
beforeEach(() => {
    locked = false;
    downloads = 0;
    qrWriter = deferred();
    transfer = deferred();
    if (!initialized) {
        document.body.innerHTML = `
            <button id="btn-safe-export"></button>
            <dialog id="safe-export-dialog"><button class="dialog-close"></button>
                <canvas id="safe-export-canvas"></canvas><p id="safe-export-info"></p>
                <textarea id="safe-export-keytext"></textarea></dialog>
            <dialog id="safe-receive-dialog"><button class="dialog-close"></button></dialog>`;
        initSafeTransfer();
        initialized = true;
    }
    document.getElementById('safe-export-dialog').removeAttribute('open');
    document.getElementById('safe-export-keytext').value = '';
    state.customers = [{ id: 'k1', name: 'Muster GmbH', plz: '44787' }];
});

async function startExport() {
    document.getElementById('btn-safe-export').click();
    await flush();
}

describe('Export und Tresorsperre', () => {
    it('ohne Sperre: Datei, Schlüssel und Dialog wie gewohnt', async () => {
        await startExport();
        transfer.resolve(BUNDLE); await flush();
        qrWriter.resolve(QR); await flush(); await flush();
        expect(downloads).toBe(1);
        expect(document.getElementById('safe-export-dialog').hasAttribute('open')).toBe(true);
        expect(document.getElementById('safe-export-keytext').value).toBe('TFK1:geheim');
    });

    it('Sperre während der QR-Erzeuger lädt: kein Schlüssel, kein Dialog', async () => {
        await startExport();
        transfer.resolve(BUNDLE); await flush();
        locked = true;
        emit('vault:locked');
        qrWriter.resolve(QR); await flush(); await flush();
        expect(document.getElementById('safe-export-dialog').hasAttribute('open')).toBe(false);
        expect(document.getElementById('safe-export-keytext').value).toBe('');
    });

    it('Sperre während des Verschlüsselns: nicht einmal die Datei wird heruntergeladen', async () => {
        await startExport();
        locked = true;
        emit('vault:locked');
        transfer.resolve(BUNDLE); await flush();
        qrWriter.resolve(QR); await flush(); await flush();
        expect(downloads).toBe(0);
        expect(document.getElementById('safe-export-dialog').hasAttribute('open')).toBe(false);
        expect(document.getElementById('safe-export-keytext').value).toBe('');
    });
});
