/**
 * Der Befund nach dem ersten eigenen Import (Anzeige).
 *
 * Erscheint einmalig, wenn zum ersten Mal die eigenen Daten auf der Karte
 * liegen – nicht bei jedem Reimport, denn dort beantwortet der Änderungsbericht
 * dieselbe Frage besser („Was hat sich verändert?").
 *
 * Aus dem Befund führen zwei Wege direkt weiter: zu den überfälligen Kunden
 * oder in die Gebietsplanung. Ein Befund ohne nächsten Schritt ist eine
 * Meldung, keine Hilfe.
 */
import { state } from '../core/state.js';
import {
    datasetInsight,
    insightHeadline,
    insightStatements,
    isInsightWorthShowing
} from '../features/importInsight.js';
import { formatRevenueFull, formatRevenueShort } from '../core/format.js';
import { showOpportunityView, showTourView } from './sidebar.js';

let dialog = null;
let body = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function statementItem(statement) {
    return `<li class="insight-line insight-${escapeHtml(statement.tone || 'plain')}">${escapeHtml(statement.text)}</li>`;
}

function render(insight) {
    const statements = insightStatements(insight);
    const canShowOverdue = statements.some((statement) => statement.action === 'overdue');

    body.innerHTML = `
        <p class="insight-headline">${escapeHtml(insightHeadline(insight))}</p>
        ${insight.revenueTotal > 0
        ? `<p class="insight-revenue" title="${escapeHtml(formatRevenueFull(insight.revenueTotal))}">Gesamtumsatz der Liste: <b>${escapeHtml(formatRevenueShort(insight.revenueTotal))}</b></p>`
        : ''}
        ${statements.length ? `<ul class="insight-lines">${statements.map(statementItem).join('')}</ul>` : ''}
        ${insight.districts.length >= 2
        ? `<details class="insight-districts">
                <summary>Kunden je Vertriebsbezirk <span class="muted small">(${insight.districts.length})</span></summary>
                <ul class="insight-district-list">
                    ${insight.districts.map((entry) => `<li><span>${escapeHtml(entry.name)}</span><b>${entry.count.toLocaleString('de-DE')}</b></li>`).join('')}
                </ul>
            </details>`
        : ''}
        <p class="muted small">Alles rechnet lokal aus Ihrer Liste. Es wurde nichts übertragen.</p>`;

    const overdueButton = dialog.querySelector('[data-insight-overdue]');
    if (overdueButton) overdueButton.hidden = !canShowOverdue;
}

/**
 * Zeigt den Befund und meldet zurück, wann er geschlossen wurde – damit der
 * Tresor-Vorschlag nicht darüberklappt, sondern danach kommt.
 * @returns {Promise<void>}
 */
export function showImportInsight() {
    if (!dialog || !body) return Promise.resolve();
    const insight = datasetInsight(state.customers);
    if (!isInsightWorthShowing(insight)) return Promise.resolve();

    render(insight);
    return new Promise((resolve) => {
        dialog.addEventListener('close', () => resolve(), { once: true });
        dialog.showModal();
    });
}

export function initImportInsight() {
    dialog = document.getElementById('import-insight-dialog');
    body = document.getElementById('import-insight-body');
    if (!dialog || !body) return;

    dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
    document.getElementById('insight-done')?.addEventListener('click', () => dialog.close());

    dialog.querySelector('[data-insight-overdue]')?.addEventListener('click', () => {
        dialog.close();
        // „Chancen" zeigt fällige und überfällige Kunden – der direkte Weg von
        // der Zahl zu den Kunden, die dahinterstehen.
        showOpportunityView();
    });
    document.getElementById('insight-tour')?.addEventListener('click', () => {
        dialog.close();
        showTourView();
    });
}
