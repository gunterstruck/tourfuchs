// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const mocks = vi.hoisted(() => ({
    loadTours: vi.fn(), saveTours: vi.fn(), showToast: vi.fn()
}));
vi.mock('../src/services/storage.js', () => ({ loadTours: mocks.loadTours, saveTours: mocks.saveTours }));
vi.mock('../src/ui/toast.js', () => ({ showToast: mocks.showToast }));
vi.mock('../src/features/map.js', () => ({ flyToCustomer: vi.fn(), focusPoint: vi.fn(), fitTourRoute: vi.fn() }));
vi.mock('../src/ui/sidebar.js', () => ({ showMapView: vi.fn(), showRouteView: vi.fn(), isPanelPinching: () => false }));
vi.mock('../src/ui/tourQr.js', () => ({ initTourQr: vi.fn(), openShareDialog: vi.fn() }));
vi.mock('../src/ui/areaBriefing.js', () => ({ openAreaBriefing: vi.fn() }));
vi.mock('../src/ui/customerBriefing.js', () => ({ openCustomerBriefing: vi.fn() }));

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
let state, emit, dom;
const nameInput = () => document.getElementById('tour-name');
const save = () => document.getElementById('btn-tour-save').click();
const list = () => document.getElementById('saved-tours');

beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.loadTours.mockResolvedValue([]);
    mocks.saveTours.mockResolvedValue(true);
    dom = new JSDOM(html, { url: 'http://localhost:3000', pretendToBeVisual: true });
    for (const key of ['window', 'document', 'navigator', 'location', 'localStorage', 'HTMLElement']) {
        vi.stubGlobal(key, dom.window[key]);
    }
    vi.stubGlobal('requestAnimationFrame', dom.window.requestAnimationFrame.bind(dom.window));
    localStorage.clear();
    const core = await import('../src/core/state.js');
    ({ state, emit } = core);
    state.ui.mode = 'aussendienst';
    state.ui.depth = 'profi';
    core.setCustomers([{ id: 'c1', name: 'Testkunde', plz: '45127', lat: 51.46, lng: 7.01 }]);
    state.tour.start = { lat: 51.45, lng: 7, label: 'Start' };
    state.tour.stops = ['c1'];
    state.tour.bezirk = '__all__';
    const { initTourPanel } = await import('../src/ui/tourPanel.js');
    initTourPanel();
    await vi.waitFor(() => expect(mocks.loadTours).toHaveBeenCalled());
    await Promise.resolve();
    nameInput().value = 'Tour morgen';
});
afterEach(() => {
    dom?.window.close();
    vi.unstubAllGlobals();
});

describe('Speicher-Rückmeldung der echten Tour-Schaltflächen', () => {
    it('behält bei einem Schreibfehler Planung und Namen, meldet Fehler und erlaubt Wiederholen', async () => {
        mocks.saveTours.mockResolvedValueOnce(false);
        save();
        await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalled());
        expect(mocks.showToast.mock.calls.at(-1)[1]).toBe('error');
        expect(list().querySelector('[data-load]')).toBeNull();
        expect(nameInput().value).toBe('Tour morgen');
        expect(state.tour.stops).toEqual(['c1']);
        save();
        await vi.waitFor(() => expect(list().textContent).toContain('Tour morgen'));
        expect(nameInput().value).toBe('');
        expect(mocks.showToast.mock.calls.at(-1)[1]).toBe('success');
    });

    it('behält beim fehlgeschlagenen Überschreiben die bisherige gespeicherte Tour', async () => {
        save();
        await vi.waitFor(() => expect(list().querySelector('[data-load]')).not.toBeNull());
        const originalId = list().querySelector('[data-load]').dataset.load;
        nameInput().value = 'Tour morgen';
        state.tour.start = { lat: 52, lng: 8, label: 'Neuer Start' };
        mocks.saveTours.mockResolvedValueOnce(false);
        save();
        await vi.waitFor(() => expect(mocks.showToast.mock.calls.at(-1)[1]).toBe('error'));
        expect(list().querySelector('[data-load]').dataset.load).toBe(originalId);
        list().querySelector('[data-load]').click();
        expect(state.tour.start.label).toBe('Start');
    });

    it('entfernt eine gespeicherte Tour erst nach erfolgreichem Löschen', async () => {
        save();
        await vi.waitFor(() => expect(list().querySelector('[data-del]')).not.toBeNull());
        mocks.saveTours.mockResolvedValueOnce(false);
        list().querySelector('[data-del]').click();
        await vi.waitFor(() => expect(mocks.showToast.mock.calls.at(-1)[1]).toBe('error'));
        expect(list().textContent).toContain('Tour morgen');
        list().querySelector('[data-del]').click();
        await vi.waitFor(() => expect(list().querySelector('[data-load]')).toBeNull());
    });

    it('zeigt während einer ausstehenden Speicherung noch keinen Erfolg', async () => {
        let finish;
        mocks.saveTours.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
        save();
        save();
        expect(mocks.saveTours).toHaveBeenCalledTimes(1);
        expect(mocks.showToast).not.toHaveBeenCalled();
        expect(list().querySelector('[data-load]')).toBeNull();
        finish(true);
        await vi.waitFor(() => expect(list().querySelectorAll('[data-load]')).toHaveLength(1));
    });

    it('zeigt nach Sperren keine Tour aus einer noch laufenden Speicherung erneut an', async () => {
        let finish;
        mocks.saveTours.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
        save();
        emit('vault:locked');
        finish(true);
        await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalled());
        expect(list().querySelector('[data-load]')).toBeNull();
    });
});
