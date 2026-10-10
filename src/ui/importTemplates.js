/**
 * Gemerkte Importvorlagen unter „Daten" (Release 15.1): sehen, welche Listen
 * TourFuchs wiedererkennt, und eine Vorlage vergessen – dann erscheint beim
 * nächsten Import dieser Liste wieder „Spalten zuordnen".
 */

import { on } from '../core/state.js';
import { currentLocale, t } from '../core/i18n.js';
import { loadImportTemplates, removeImportTemplate, saveImportTemplates } from '../features/importTemplates.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function formatDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function render() {
    const list = document.getElementById('import-templates-list');
    if (!list) return;
    const templates = loadImportTemplates();
    list.innerHTML = templates.length
        ? templates.map((template) => `<li class="data-source" data-template-id="${escapeHtml(template.id)}">
            <div class="data-source-head"><strong>${escapeHtml(template.name)}</strong>
                <span class="muted small">${escapeHtml(t('templates.meta', { count: template.headers.length, date: formatDate(template.usedAt) }))}</span></div>
            <div class="data-source-actions">
                <button type="button" class="data-source-minor" data-template-forget>${escapeHtml(t('templates.forget'))}</button>
            </div>
        </li>`).join('')
        : `<li class="muted small">${escapeHtml(t('templates.empty'))}</li>`;
    const summary = document.getElementById('import-templates-summary');
    if (summary) summary.textContent = templates.length ? `(${templates.length})` : '';
}

export function initImportTemplates() {
    const list = document.getElementById('import-templates-list');
    if (!list) return;
    render();
    list.addEventListener('click', (event) => {
        if (!event.target.closest('[data-template-forget]')) return;
        const id = event.target.closest('[data-template-id]')?.dataset.templateId;
        const template = loadImportTemplates().find((entry) => entry.id === id);
        if (!template || !confirm(t('templates.confirmForget', { name: template.name }))) return;
        saveImportTemplates(removeImportTemplate(loadImportTemplates(), id));
        render();
    });
    on('import:templates-changed', render);
    on('locale:changed', render);
}
