/**
 * Mehrkunden-Briefing (Anzeige).
 *
 * Zwei Einstiege, ein Dialog:
 *  - Tourplaner → Vorschläge im gewählten Umkreis
 *  - „In der Nähe" → die nächstgelegenen Kunden um Kartenmitte oder Standort
 *
 * Der Weg ist derselbe wie beim Kundenbriefing und aus demselben Grund: Der
 * Prompt entsteht lokal, wird vollständig gezeigt, kopiert – und im Assistenten
 * vom Nutzer abgeschickt. TourFuchs meldet sich nirgends an.
 */
import { state } from '../core/state.js';
import {
    AREA_BRIEFING_LIMIT,
    areaBriefingSelection,
    buildAreaBriefingPrompt
} from '../features/areaBriefing.js';
import { assistantForDepth } from '../services/assistant.js';
import { copyText } from '../features/handoff.js';
import { showBriefingCopyResult } from './briefingFeedback.js';
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
        <p class="briefing-demo-note">In der Auswahl liegen ausschließlich Beispielkunden. TourFuchs baut dafür bewusst keinen Prompt und öffnet keinen Assistenten. Mit Ihren eigenen Kunden steht das Mehrkunden-Briefing sofort zur Verfügung.</p>
    </div>`;
    footer.innerHTML = '<button type="button" class="primary" data-area-close>Verstanden</button>';
    footer.querySelector('[data-area-close]')?.addEventListener('click', () => dialog.close());
}

function render(selection, areaLabel, { preview = false } = {}) {
    const { included, total, truncated } = selection;
    body.innerHTML = `
        <div class="briefing-customer">
            <b>${escapeHtml(areaLabel)}</b>
            <span>${included.length} von ${total} ${total === 1 ? 'Kunde' : 'Kunden'}</span>
        </div>
        <div class="briefing-state briefing-manual">
            <span class="briefing-kicker">${preview ? 'Beispiel · nur zur Ansicht' : 'Direkt nutzbar'}</span>
            <h3>Wen zuerst besuchen?</h3>
            ${truncated ? `<p class="area-truncated">Der Prompt enthält die ${AREA_BRIEFING_LIMIT} nächstgelegenen Kunden. Eine längere Liste macht das Briefing nicht besser, nur unschärfer.</p>` : ''}
            <details class="area-customers">
                <summary>Diese Kunden stehen im Prompt <span class="muted small">(${included.length})</span></summary>
                <ul class="area-customer-list">${included.map(customerItem).join('')}</ul>
            </details>
            <p class="briefing-manual-note"><b>Nicht enthalten:</b> Umsatz, Telefon, E-Mail, Straße und Koordinaten. Übermittelt werden nur Name, Kundennummer, Ort und die Fälligkeit – und das erst, wenn Sie den Prompt absenden.</p>
            ${briefingSourcesHtml()}
            <details class="briefing-prompt-visible">
                <summary><b>🔍 Vollständigen Prompt ansehen</b><span></span></summary>
                <pre></pre>
            </details>
        </div>`;
    const fillPrompt = () => {
        const block = body.querySelector('.briefing-prompt-visible');
        const pre = block?.querySelector('pre');
        if (pre) pre.textContent = currentPrompt;
        const note = block?.querySelector('summary span');
        if (note) {
            const lines = String(currentPrompt || '').split('\n').length;
            note.textContent = `${lines} Zeilen · geht erst raus, wenn Sie ihn im Assistenten absenden`;
        }
    };
    fillPrompt();
    // Dasselbe Fragment wie im Kundenbriefing, derselbe gespeicherte Zustand –
    // geändert wird er dort, wo er gerade auffällt.
    wireBriefingSources(body, () => {
        currentPrompt = buildAreaBriefingPrompt(
            included,
            { areaLabel, plannedDate: plannedDate(), total, preview },
            currentAssistant,
            loadBriefingSources()
        );
        fillPrompt();
    });

    if (preview) {
        // Derselbe Knopf, aber ohne Wirkung: Die Vorführung zeigt, wo er sitzt,
        // kopiert aber nichts und öffnet keinen Assistenten.
        footer.innerHTML = `<button type="button" class="primary" data-area-open disabled title="In der Vorführung wird nichts kopiert">Prompt kopieren &amp; ${escapeHtml(currentAssistant.label)} öffnen</button>`;
        return;
    }
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
    const assistantLabel = currentAssistant.label;
    launchAssistant(currentAssistant);
    const copied = await copyPromise;
    showBriefingCopyResult(dialog?.open ? body : null, copied, assistantLabel);
}

/**
 * Mehrkunden-Briefing für eine geografisch sinnvolle Auswahl öffnen.
 * @param {object[]} customers  Kunden des Gebiets, bereits sinnvoll sortiert
 * @param {string} areaLabel    Beschreibung des Gebiets („Umkreis von 25 km …")
 */
export function openAreaBriefing(customers, areaLabel, { preview = false } = {}) {
    if (!dialog) initAreaBriefing();
    if (!dialog) return;

    // `preview` nur für die Live-Demos: Dort darf auch mit Beispielkunden
    // sichtbar werden, wie der Prompt aussieht – kopiert wird dabei nichts.
    const selection = preview
        ? areaBriefingSelection(customers, { includeDemo: true })
        : areaBriefingSelection(customers);
    currentAssistant = assistantForDepth(state.ui.depth);
    dialog.showModal();

    if (selection.included.length === 0) {
        currentPrompt = '';
        renderDemoOnly();
        return;
    }
    currentPrompt = buildAreaBriefingPrompt(
        selection.included,
        { areaLabel, plannedDate: plannedDate(), total: selection.total, preview },
        currentAssistant,
        loadBriefingSources()
    );
    render(selection, areaLabel, { preview });
}

export function initAreaBriefing() {
    dialog = document.getElementById('area-briefing-dialog');
    body = document.getElementById('area-briefing-body');
    footer = document.getElementById('area-briefing-footer');
    if (!dialog || !body || !footer) return;
    dialog.querySelector('[data-area-header-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { currentPrompt = ''; });
}
