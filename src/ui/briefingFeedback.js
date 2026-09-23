import { emit } from '../core/state.js';

/** Im offenen Dialog sichtbar bleiben, auch wenn der Assistent den Fokus erhält. */
export function showBriefingCopyResult(host, copied, assistantLabel) {
    const text = copied
        ? `Prompt erfolgreich in die Zwischenablage kopiert. Jetzt in ${assistantLabel} einfügen und selbst absenden.`
        : 'Der Prompt konnte nicht in die Zwischenablage kopiert werden. Bitte den angezeigten Prompt aufklappen, markieren und manuell kopieren.';
    if (host) {
        let status = host.querySelector('[data-briefing-copy-status]');
        if (!status) {
            status = document.createElement('p');
            status.dataset.briefingCopyStatus = '';
            host.prepend(status);
        }
        status.className = `briefing-copy-status ${copied ? 'is-success' : 'is-error'}`;
        status.setAttribute('role', copied ? 'status' : 'alert');
        status.textContent = text;
        status.scrollIntoView?.({ block: 'nearest' });
    }
    emit('toast', { type: copied ? 'success' : 'error', text, ms: 10000 });
}
