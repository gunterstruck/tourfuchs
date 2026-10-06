import { afterEach, describe, expect, it, vi } from 'vitest';
import { initToasts, showToast } from '../src/ui/toast.js';

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('Hervorgehobene Kopierbestätigung', () => {
    it('rendert gezielt einen größeren Toast, ohne alle Meldungen zu vergrößern', () => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', (callback) => callback());
        document.body.innerHTML = '<div id="toasts"></div>';
        initToasts();

        showToast('📋 [4711] wurde in die Zwischenablage kopiert.', 'success', 5500, {
            prominent: true
        });

        const toast = document.querySelector('.toast');
        expect(toast?.classList.contains('toast-prominent')).toBe(true);
        expect(toast?.textContent).toContain('[4711]');
        expect(toast?.classList.contains('visible')).toBe(true);
    });
});
