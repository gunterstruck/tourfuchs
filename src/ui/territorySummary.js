import { emit, getCustomer, on } from '../core/state.js';
import { formatRevenueFull } from '../core/format.js';
import { buildTerritorySummary } from '../features/territorySummary.js';

let dialog = null;
let currentDetail = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
));

function plural(value, singular, pluralForm = `${singular}e`) {
    return Number(value) === 1 ? singular : pluralForm;
}

function valueList(values) {
    if (!values?.length) return '–';
    if (values.length <= 3) return values.join(' · ');
    return `${values.slice(0, 3).join(' · ')} +${values.length - 3}`;
}

function render(detail) {
    const customers = (detail.customerIds || []).map(getCustomer).filter(Boolean);
    const summary = buildTerritorySummary(customers, detail);
    const revenueNote = summary.revenueKnownCount < summary.count
        ? `${summary.revenueKnownCount} von ${summary.count} Kunden mit Umsatzangabe`
        : 'für alle angezeigten Kunden vorhanden';
    const places = summary.topPlaces.length
        ? summary.topPlaces.map((place) => `<li><span>${escapeHtml(place.name)}</span><b>${place.customerCount}</b></li>`).join('')
        : '<li class="is-empty">Keine Ortsangaben vorhanden</li>';

    dialog.style.setProperty('--territory-summary-color', detail.color || '#0d9488');
    document.getElementById('territory-summary-dimension').textContent = detail.dimension || 'Gebiet';
    document.getElementById('territory-summary-title').textContent = detail.value || 'Ohne Zuordnung';
    document.getElementById('territory-summary-body').innerHTML = `
        <div class="territory-summary-kpis">
            <article><span>Kunden</span><strong>${summary.count.toLocaleString('de-DE')}</strong><small>aktuell sichtbar</small></article>
            <article><span>Umsatz</span><strong>${summary.revenue === null ? '–' : escapeHtml(formatRevenueFull(summary.revenue))}</strong><small>${escapeHtml(revenueNote)}</small></article>
            <article><span>Ø je Kunde</span><strong>${summary.averageRevenue === null ? '–' : escapeHtml(formatRevenueFull(summary.averageRevenue))}</strong><small>mit Umsatzangabe</small></article>
            <article><span>${escapeHtml(detail.levelLabel || 'Teilgebiete')}</span><strong>${summary.regionCount.toLocaleString('de-DE')}</strong><small>${summary.placeCount} ${plural(summary.placeCount, 'Ort', 'Orte')}</small></article>
        </div>
        <div class="territory-summary-context">
            <div><span>Vertriebsgruppe</span><b>${escapeHtml(valueList(summary.groups))}</b></div>
            <div><span>Vertriebshauptgruppe</span><b>${escapeHtml(valueList(summary.channels))}</b></div>
        </div>
        <section class="territory-summary-places">
            <div class="territory-summary-section-head"><h3>Stärkste Kundenstandorte</h3><span>nach Anzahl</span></div>
            <ol>${places}</ol>
        </section>`;
    document.getElementById('territory-summary-focus').disabled = !Array.isArray(detail.bounds);
}

function open(detail = {}) {
    currentDetail = detail;
    render(detail);
    if (!dialog.open) dialog.showModal();
}

export function initTerritorySummary() {
    dialog = document.getElementById('territory-summary-dialog');
    if (!dialog) return;
    dialog.querySelector('[data-territory-summary-close]')?.addEventListener('click', () => dialog.close());
    document.getElementById('territory-summary-focus')?.addEventListener('click', () => {
        if (!currentDetail?.bounds) return;
        dialog.close();
        emit('territory-summary:focus', currentDetail);
    });
    on('territory-summary:open', open);
}
