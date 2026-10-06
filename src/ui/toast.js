/**
 * Kleine, unaufdringliche Statusmeldungen (Toasts).
 */

import { on } from '../core/state.js';

let container = null;

export function initToasts() {
    container = document.getElementById('toasts');
    // `ms` ist optional: Kurzlebige Hinweise sollen nicht ausgerechnet das
    // verdecken, was sie ankündigen (etwa den Auswahlstreifen des Lassos).
    on('toast', ({ type = 'info', text, ms, prominent = false }) => (
        showToast(text, type, ms, { prominent })
    ));
}

export function showToast(text, type = 'info', durationMs = 4000, { prominent = false } = {}) {
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}${prominent ? ' toast-prominent' : ''}`;
    el.textContent = text;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => el.remove(), 300);
    }, durationMs);
}
