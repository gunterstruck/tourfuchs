/**
 * Feierabend-Rückblick (Anzeige).
 *
 * Erscheint nie von selbst – der Tag ist zu Ende, wenn der Nutzer das sagt.
 * Der Knopf taucht in „Meine Tour" auf, sobald heute mindestens ein Besuch
 * eingetragen wurde oder eine Tour steht.
 *
 * „Überblick → aufzoomen": Oben die drei Zahlen des Tages, darunter die
 * besuchten Kunden, und erst eingeklappt, was liegen geblieben ist.
 */
import { state, on } from '../core/state.js';
import { dayReview, dayReviewHeadline, dayReviewText } from '../features/dayReview.js';
import { clearDayLog, recordDayReview } from '../features/dayLog.js';
import { formatDateDe, agoText } from '../features/visits.js';
import { formatRevenueFull, formatRevenueShort } from '../core/format.js';
import { copyText } from '../features/handoff.js';
import { showToast } from './toast.js';

let dialog = null;
let body = null;
let lastReview = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function statTile(value, label, tone = '') {
    return `<div class="review-stat${tone ? ` ${tone}` : ''}">
        <b>${escapeHtml(value)}</b>
        <span>${escapeHtml(label)}</span>
    </div>`;
}

function visitedItem(entry) {
    const place = [entry.plz, entry.ort].filter(Boolean).join(' ');
    const marks = [
        entry.wasOverdue ? '<span class="review-mark review-mark-overdue">war überfällig</span>' : '',
        entry.planned ? '' : '<span class="review-mark">spontan</span>'
    ].filter(Boolean).join('');
    const gap = entry.previousVisit
        ? `zuvor ${agoText(entry.previousVisit)}`
        : 'erster dokumentierter Besuch';
    return `<li>
        <b>${escapeHtml(entry.name)}</b>${marks}
        <span>${escapeHtml([place, gap].filter(Boolean).join(' · '))}</span>
    </li>`;
}

function openItem(entry) {
    const place = [entry.plz, entry.ort].filter(Boolean).join(' ');
    const last = entry.lastVisit ? `zuletzt ${agoText(entry.lastVisit)}` : 'noch nie besucht';
    return `<li>
        <b>${escapeHtml(entry.name)}</b>
        <span>${escapeHtml([place, last].filter(Boolean).join(' · '))}</span>
    </li>`;
}

function render(review) {
    const km = Math.round(review.roadKmEstimate);
    body.innerHTML = `
        <p class="review-date">${escapeHtml(formatDateDe(review.day))}</p>
        <p class="review-headline">${escapeHtml(dayReviewHeadline(review))}</p>
        <div class="review-stats">
            ${statTile(String(review.visitedCount), review.visitedCount === 1 ? 'Besuch' : 'Besuche', 'review-stat-good')}
            ${statTile(km >= 1 ? `${km} km` : '–', 'Strecke (geschätzt)')}
            ${statTile(String(review.overdueCleared), 'Überfällige erledigt', review.overdueCleared ? 'review-stat-good' : '')}
            ${statTile(String(review.openStops.length), 'offen geblieben', review.openStops.length ? 'review-stat-open' : '')}
        </div>
        ${review.revenueVisited > 0
        ? `<p class="review-revenue" title="${escapeHtml(formatRevenueFull(review.revenueVisited))}">Umsatz der besuchten Kunden: <b>${escapeHtml(formatRevenueShort(review.revenueVisited))}</b></p>`
        : ''}
        ${review.visited.length
        ? `<section class="review-block">
                <h3>Besucht</h3>
                <ul class="review-list review-list-done">${review.visited.map(visitedItem).join('')}</ul>
            </section>`
        : `<p class="review-empty">Für heute ist noch kein Besuch eingetragen. Unterwegs genügt der Knopf <b>„✓ Heute"</b> am Stopp – am Handy reicht ein Tipp auf den Tour-Punkt.</p>`}
        ${review.openStops.length
        ? `<details class="review-block review-open">
                <summary>Offen geblieben <span class="muted small">(${review.openStops.length})</span></summary>
                <ul class="review-list">${review.openStops.map(openItem).join('')}</ul>
                <p class="muted small">Die Stopps bleiben in der Tour – sie lassen sich morgen weiterverwenden.</p>
            </details>`
        : ''}
        ${km >= 1 ? '<p class="muted small">Die Strecke ist eine Schätzung aus der geplanten Route, keine gefahrene Wegstrecke.</p>' : ''}`;
}

function openReview() {
    if (!dialog) return;
    lastReview = dayReview({ customers: state.customers, tour: state.tour });
    render(lastReview);
    dialog.showModal();
}

/**
 * Sichtbar, sobald der Tag etwas hergibt: ein Besuch von heute oder eine
 * geplante Tour. Ohne beides wäre der Rückblick eine leere Geste.
 */
function syncButton() {
    const button = document.getElementById('btn-day-review');
    if (!button) return;
    const review = dayReview({ customers: state.customers, tour: state.tour });
    // Hier festhalten, nicht erst beim Öffnen des Rückblicks: Wer den Rückblick
    // nur an guten Tagen aufmacht, hinterlässt sonst genau die Stichprobe, die
    // hinterher jede Behauptung bestätigt. Aufgezeichnet wird der Tag, nicht
    // das Interesse an ihm.
    recordDayReview(review);
    button.hidden = !review.hasAnything;
    button.textContent = review.visitedCount
        ? `🌙 Feierabend (${review.visitedCount})`
        : '🌙 Feierabend-Rückblick';
}

export function initDayReview() {
    dialog = document.getElementById('day-review-dialog');
    body = document.getElementById('day-review-body');
    if (!dialog || !body) return;

    document.getElementById('btn-day-review')?.addEventListener('click', openReview);
    dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
    document.getElementById('day-review-close')?.addEventListener('click', () => dialog.close());

    document.getElementById('day-review-copy')?.addEventListener('click', async () => {
        if (!lastReview) return;
        const ok = await copyText(dayReviewText(lastReview, { formatDate: formatDateDe }));
        showToast(ok ? 'Tagesabschluss kopiert.' : 'Kopieren nicht möglich.', ok ? 'success' : 'error');
    });

    on('app:ready', syncButton);
    on('tour:changed', syncButton);
    on('customers:changed', syncButton);
    on('visits:changed', syncButton);
    // „Daten löschen" ist ein Neustart – wie beim Erste-Schritte-Fortschritt
    // gehört auch die Tageshistorie zum Bestand, der dabei verschwindet.
    on('dataset:cleared', clearDayLog);
}
