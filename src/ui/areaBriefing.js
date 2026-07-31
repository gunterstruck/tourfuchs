/**
 * Gebiets-Briefing (Anzeige).
 *
 * Zwei Einstiege, ein Dialog:
 *  - Tourplaner → Vorschläge im gewählten Umkreis
 *  - „In der Nähe" → die nächstgelegenen Kunden um Kartenmitte oder Standort
 *
 * Der Weg ist derselbe wie beim Kundenbriefing und aus demselben Grund: Der
 * Prompt entsteht lokal, wird vollständig gezeigt, kopiert – und im Assistenten
 * vom Nutzer abgeschickt. TourFuchs meldet sich nirgends an.
 */
import { state, emit } from '../core/state.js';
import {
    AREA_BRIEFING_LIMIT,
    areaBriefingSelection,
    buildAreaBriefingPrompt
} from '../features/areaBriefing.js';
import { assistantForDepth } from '../services/assistant.js';
import { copyText } from '../features/handoff.js';
import { loadBriefingSources } from '../services/briefingSources.js';
import { briefingSourcesHtml, wireBriefingSources } from './briefingSources.js';

let dialog = null;
let body = null;
let footer = null;
let currentPrompt = '';
let currentAssistant = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function plannedDate() {
    return document.getElementById('plan-date')?.value || '';
}

function customerItem(customer) {
    const place = [customer.plz, customer.ort].filter(Boolean).join(' ');
    return `<li><b>${escapeHtml(customer.name)}</b>${place ? `<span>${escapeHtml(place)}</span>` : ''}</li>`;
}

function renderDemoOnly() {
    body.innerHTML = `<div class="briefing-state briefing-demo">
        <span class="briefing-kicker">Geschützte Demo</span>
        <h3>Für Beispielkunden wird kein Briefing erzeugt</h3>
        <p class="briefing-demo-note">Im Gebiet liegen ausschließlich Beispielkunden. TourFuchs baut dafür bewusst keinen Prompt und öffnet keinen Assistenten. Mit Ihren eigenen Kunden steht das Gebiets-Briefing sofort zur Verfügung.</p>
    </div>`;
    footer.innerHTML = '<button type="button" class="primary" data-area-close>Verstanden</button>';
    footer.querySelector('[data-area-close]')?.addEventListener('click', () => dialog.close());
}

function render(selection, areaLabel) {
    const { included, total, truncated } = selection;
    body.innerHTML = `
        <div class="briefing-customer">
            <b>${escapeHtml(areaLabel)}</b>
            <span>${included.length} von ${total} ${total === 1 ? 'Kunde' : 'Kunden'}</span>
        </div>
        <div class="briefing-state briefing-manual">
            <span class="briefing-kicker">Direkt nutzbar</span>
            <h3>Wen zuerst besuchen?</h3>
            <p>TourFuchs hat aus den Kunden in diesem Gebiet einen Prompt erstellt. Mit dem nächsten Schritt wird er kopiert und ${escapeHtml(currentAssistant.label)} geöffnet – dort einfügen und selbst absenden.</p>
            ${truncated ? `<p class="area-truncated">Der Prompt enthält die ${AREA_BRIEFING_LIMIT} nächstgelegenen Kunden. Eine längere Liste macht das Briefing nicht besser, nur unschärfer.</p>` : ''}
            <details class="area-customers">
                <summary>Diese Kunden stehen im Prompt <span class="muted small">(${included.length})</span></summary>
                <ul class="area-customer-list">${included.map(customerItem).join('')}</ul>
            </details>
            <p class="briefing-manual-note"><b>Nicht enthalten:</b> Umsatz, Telefon, E-Mail, Straße und Koordinaten. Übermittelt werden nur Name, Kundennummer, Ort und die Fälligkeit – und das erst, wenn Sie den Prompt absenden.</p>
            ${briefingSourcesHtml()}
            <div class="briefing-prompt-visible">
                <span>Vorbereiteter Prompt</span>
                <pre></pre>
            </div>
        </div>`;
    const fillPrompt = () => {
        const pre = body.querySelector('.briefing-prompt-visible pre');
        if (pre) pre.textContent = currentPrompt;
    };
    fillPrompt();
    // Dasselbe Fragment wie im Kundenbriefing, derselbe gespeicherte Zustand –
    // geändert wird er dort, wo er gerade auffällt.
    wireBriefingSources(body, () => {
        currentPrompt = buildAreaBriefingPrompt(
            included,
            { areaLabel, plannedDate: plannedDate(), total },
            currentAssistant,
            loadBriefingSources()
        );
        fillPrompt();
    });

    footer.innerHTML = `<button type="button" class="primary" data-area-open>Prompt kopieren &amp; ${escapeHtml(currentAssistant.label)} öffnen</button>`;
    footer.querySelector('[data-area-open]')?.addEventListener('click', openAssistant);
}

/** Wie beim Kundenbriefing: Copilot unter Windows bevorzugt als installierte App. */
function launchAssistant(assistant) {
    if (assistant.preferEdge && /Windows/i.test(navigator.userAgent)) {
        const link = document.createElement('a');
        link.href = `microsoft-edge:${assistant.url}`;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
    }
    window.open(assistant.url, '_blank', 'noopener');
}

async function openAssistant() {
    const copyPromise = copyText(currentPrompt);
    launchAssistant(currentAssistant);
    const copied = await copyPromise;
    emit('toast', {
        type: copied ? 'success' : 'info',
        text: copied
            ? `Prompt vorbereitet. In ${currentAssistant.label} einfügen und absenden.`
            : `${currentAssistant.label} wurde geöffnet. Der Prompt konnte nicht automatisch kopiert werden.`
    });
}

/**
 * Gebiets-Briefing öffnen.
 * @param {object[]} customers  Kunden des Gebiets, bereits sinnvoll sortiert
 * @param {string} areaLabel    Beschreibung des Gebiets („Umkreis von 25 km …")
 */
export function openAreaBriefing(customers, areaLabel) {
    if (!dialog) initAreaBriefing();
    if (!dialog) return;

    const selection = areaBriefingSelection(customers);
    currentAssistant = assistantForDepth(state.ui.depth);
    dialog.showModal();

    if (selection.included.length === 0) {
        currentPrompt = '';
        renderDemoOnly();
        return;
    }
    currentPrompt = buildAreaBriefingPrompt(
        selection.included,
        { areaLabel, plannedDate: plannedDate(), total: selection.total },
        currentAssistant,
        loadBriefingSources()
    );
    render(selection, areaLabel);
}

export function initAreaBriefing() {
    dialog = document.getElementById('area-briefing-dialog');
    body = document.getElementById('area-briefing-body');
    footer = document.getElementById('area-briefing-footer');
    if (!dialog || !body || !footer) return;
    dialog.querySelector('[data-area-header-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { currentPrompt = ''; });
}
