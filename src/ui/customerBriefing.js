/**
 * Kundenbriefing-Dialog.
 *
 * Bewusst ein einziger Weg: TourFuchs zeigt den lokal erzeugten Prompt, kopiert
 * ihn auf Knopfdruck und öffnet den Assistenten. Eingefügt und abgesendet wird
 * dort vom Nutzer. TourFuchs meldet sich nicht an, ruft keine API und holt
 * keine Antwort zurück – die frühere automatische Entra-/Graph-Anbindung ist
 * bewusst entfernt.
 *
 * Im Profi-Modus ist zusätzlich wählbar, welcher Assistent geöffnet wird.
 */
import { state, emit } from '../core/state.js';
import { isDemoCustomer } from '../core/demoSafety.js';
import {
    buildCustomerBriefingPrompt,
    customerBriefingContext,
    customerBriefingFlow
} from '../features/customerBriefing.js';
import { copyText } from '../features/handoff.js';
import { loadBriefingSources } from '../services/briefingSources.js';
import { briefingSourcesHtml, wireBriefingSources } from './briefingSources.js';
import {
    ASSISTANTS,
    assistantForDepth,
    forgetLegacyCopilotSetup,
    loadAssistantChoice,
    resolveAssistant,
    saveAssistantChoice
} from '../services/assistant.js';

let dialog = null;
let body = null;
let footer = null;
let currentCustomer = null;
let currentPrompt = '';
let currentAssistant = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

function plannedDate() {
    return document.getElementById('plan-date')?.value || '';
}

function identityHtml(customer) {
    const place = [customer.plz, customer.ort].filter(Boolean).join(' ');
    return `<div class="briefing-customer">
        <b>${escapeHtml(customer.name)}</b>
        <span>${escapeHtml([customer.nummer ? `Nr. ${customer.nummer}` : '', place].filter(Boolean).join(' · '))}</span>
    </div>`;
}

function visiblePrompt() {
    return `<div class="briefing-prompt-visible">
        <span>Vorbereiteter Prompt</span>
        <pre></pre>
    </div>`;
}

function fillVisiblePrompt() {
    const pre = body?.querySelector('.briefing-prompt-visible pre');
    if (pre) pre.textContent = currentPrompt;
}

function setFooter(html) {
    footer.innerHTML = html;
}

function wireClose() {
    footer.querySelector('[data-briefing-close]')?.addEventListener('click', () => dialog.close());
}

/** Prompt an den gewählten Assistenten anpassen (Quellenzeile unterscheidet sich). */
function rebuildPrompt() {
    currentPrompt = buildCustomerBriefingPrompt(
        currentCustomer,
        customerBriefingContext(currentCustomer, state.tour, plannedDate()),
        currentAssistant,
        loadBriefingSources()
    );
}

function actionFooter() {
    setFooter(`<button type="button" class="primary" data-briefing-open>Prompt kopieren &amp; ${escapeHtml(currentAssistant.label)} öffnen</button>`);
    footer.querySelector('[data-briefing-open]')?.addEventListener('click', openAssistant);
}

/**
 * Profi: Zielwahl, eingeklappt („Überblick → aufzoomen"). Der Normalfall bleibt
 * ein Knopf; wer ein anderes Werkzeug nutzt, klappt einmalig auf.
 */
function assistantChooserHtml() {
    const choice = loadAssistantChoice();
    const options = ASSISTANTS.map((entry) => `<label class="briefing-assistant-option">
            <input type="radio" name="briefing-assistant" value="${entry.id}"${entry.id === choice.id ? ' checked' : ''}>
            <span><b>${escapeHtml(entry.label)}</b><small>${escapeHtml(entry.hint)}</small></span>
        </label>`).join('');

    return `<details class="briefing-assistant"${choice.id === 'custom' ? ' open' : ''}>
        <summary>
            <b>Ziel: ${escapeHtml(currentAssistant.label)}</b>
            <span>Anderen Assistenten wählen</span>
        </summary>
        <div class="briefing-assistant-content">
            ${options}
            <label class="briefing-field briefing-assistant-url"${choice.id === 'custom' ? '' : ' hidden'}>Adresse des Assistenten
                <input id="briefing-assistant-url" type="url" inputmode="url" autocomplete="off" spellcheck="false"
                    placeholder="https://assistent.meine-firma.de" value="${escapeHtml(choice.customUrl)}">
            </label>
            <p class="briefing-assistant-error" role="alert" hidden></p>
            <p class="muted small">Die Wahl gilt nur für das Öffnen des Fensters. TourFuchs sendet nichts – der Prompt geht erst raus, wenn Sie ihn dort absenden.</p>
        </div>
    </details>`;
}

function applyAssistantChoice(id) {
    const urlField = body.querySelector('#briefing-assistant-url');
    const errorBox = body.querySelector('.briefing-assistant-error');
    const wrapper = body.querySelector('.briefing-assistant-url');
    if (wrapper) wrapper.hidden = id !== 'custom';
    if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }

    try {
        const saved = saveAssistantChoice({ id, customUrl: urlField?.value });
        currentAssistant = resolveAssistant(saved);
    } catch (error) {
        // Unvollständige eigene Adresse: Auswahl stehen lassen, Grund nennen,
        // Knopf so lange auf dem zuletzt gültigen Ziel belassen.
        if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
        return;
    }

    const summary = body.querySelector('.briefing-assistant summary b');
    if (summary) summary.textContent = `Ziel: ${currentAssistant.label}`;
    rebuildPrompt();
    fillVisiblePrompt();
    actionFooter();
}

function wireAssistantChooser() {
    for (const input of body.querySelectorAll('input[name="briefing-assistant"]')) {
        input.addEventListener('change', () => applyAssistantChoice(input.value));
    }
    const urlField = body.querySelector('#briefing-assistant-url');
    urlField?.addEventListener('change', () => applyAssistantChoice('custom'));
    urlField?.addEventListener('blur', () => applyAssistantChoice('custom'));
}

function renderBriefing({ withChooser = false } = {}) {
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-manual">
            <span class="briefing-kicker">Direkt nutzbar</span>
            <h3>Ihr Kundenbriefing ist vorbereitet</h3>
            <p>TourFuchs hat aus dem ausgewählten Kunden und dem aktuellen Tourkontext einen Prompt erstellt. Mit dem nächsten Schritt wird er kopiert und ${escapeHtml(currentAssistant.label)} geöffnet.</p>
            <p class="briefing-manual-note"><b>Im Assistenten:</b> Prompt einfügen und selbst absenden. Erst dann werden die enthaltenen Daten übertragen.</p>
            ${withChooser ? assistantChooserHtml() : ''}
            ${briefingSourcesHtml()}
            ${visiblePrompt()}
        </div>`;
    fillVisiblePrompt();
    if (withChooser) wireAssistantChooser();
    // Der Prompt wird sofort neu gebaut und angezeigt: Der Nutzer soll die
    // Wirkung seiner Quelle hier sehen, nicht erst im Assistenten.
    wireBriefingSources(body, () => { rebuildPrompt(); fillVisiblePrompt(); });
    actionFooter();
}

function renderDemo() {
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-demo">
            <span class="briefing-kicker">Geschützte Demo</span>
            <h3>So unterstützt Sie das Briefing unterwegs</h3>
            <div class="briefing-answer briefing-demo-preview"><b>Jetzt wichtig</b>
• Letzten Gesprächsstand und offene Zusagen auf einen Blick prüfen.
• Ansprechpartner und anstehende Termine priorisieren.

<b>Gespräch</b>
• Ziel und passender Einstieg für den nächsten Kontakt.
• Drei konkrete Fragen aus dem berechtigten Firmenwissen.

<b>Handlung</b>
• Nächsten Schritt, Chance und mögliches Risiko kompakt einordnen.</div>
            <p class="briefing-demo-note"><b>Keine Datenübertragung:</b> Für Beispielkunden erzeugt TourFuchs keinen Prompt und öffnet keinen Assistenten. Mit Ihren echten Kundendaten entscheiden Sie selbst, wann Sie den vorbereiteten Prompt im Assistenten absenden.</p>
        </div>`;
    setFooter('<button type="button" class="primary" data-briefing-close>Verstanden</button>');
    wireClose();
}

/**
 * Copilot ist unter Windows meist als Edge-App installiert; dort führt der
 * edge-Protokolllink direkt in die installierte App statt in einen zweiten
 * Browser. Alle anderen Ziele werden schlicht als Tab geöffnet.
 */
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
    if (isDemoCustomer(currentCustomer)) {
        renderDemo();
        return;
    }
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

export function initCustomerBriefing() {
    dialog = document.getElementById('customer-briefing-dialog');
    body = document.getElementById('customer-briefing-body');
    footer = document.getElementById('customer-briefing-footer');
    if (!dialog || !body || !footer) return;
    // Kennungen und Einwilligung der früheren automatischen Anbindung entfernen.
    forgetLegacyCopilotSetup();
    dialog.querySelector('[data-briefing-header-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
        currentCustomer = null;
        currentPrompt = '';
    });
}

export function openCustomerBriefing(customer) {
    if (!dialog) initCustomerBriefing();
    if (!dialog || !customer) return;
    currentCustomer = customer;
    dialog.showModal();
    if (isDemoCustomer(customer)) {
        currentPrompt = '';
        renderDemo();
        return;
    }
    currentAssistant = assistantForDepth(state.ui.depth);
    rebuildPrompt();
    renderBriefing({ withChooser: customerBriefingFlow(state.ui.depth) === 'choice' });
}
