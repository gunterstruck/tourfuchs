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
import { state } from '../core/state.js';
import { isDemoCustomer } from '../core/demoSafety.js';
import {
    buildCustomerBriefingPrompt,
    customerBriefingContext,
    customerBriefingFlow
} from '../features/customerBriefing.js';
import { copyText } from '../features/handoff.js';
import { showBriefingCopyResult } from './briefingFeedback.js';
import { loadBriefingSources } from '../services/briefingSources.js';
import { briefingSourcesHtml, wireBriefingSources } from './briefingSources.js';
import { assistantForDepth, forgetLegacyCopilotSetup } from '../services/assistant.js';
import { assistantChooserHtml, launchAssistant, wireAssistantChooser } from './briefingAssistant.js';

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

/**
 * Der vollständige Prompt – aufziehbar statt ausgebreitet.
 *
 * Ihn zu zeigen ist eine Zusage: Nichts geht raus, was der Nutzer nicht vorher
 * lesen konnte. Die Zusage lautet aber „vollständig **verfügbar**", nicht
 * „muss ungefragt den halben Bildschirm belegen" – ausgeklappt füllte er 41 %
 * eines Dialogs, dessen ganze Aufgabe ein Knopf ist.
 *
 * Eingeklappt mit sprechender Zeile sagt er sogar **deutlicher**, worum es
 * geht: Zeilenzahl und der Hinweis, dass erst das Absenden etwas überträgt.
 * Aufgeklappt wird er vor dem Kopieren, nicht danach.
 */
function visiblePrompt() {
    return `<details class="briefing-prompt-visible">
        <summary><b>🔍 Vollständigen Prompt ansehen</b><span></span></summary>
        <pre></pre>
    </details>`;
}

function fillVisiblePrompt() {
    const block = body?.querySelector('.briefing-prompt-visible');
    const pre = block?.querySelector('pre');
    if (pre) pre.textContent = currentPrompt;
    const note = block?.querySelector('summary span');
    if (note) {
        const lines = String(currentPrompt || '').split('\n').length;
        note.textContent = `${lines} Zeilen · geht erst raus, wenn du ihn im Assistenten absendest`;
    }
}

function setFooter(html) {
    footer.innerHTML = html;
}

function wireClose() {
    footer.querySelector('[data-briefing-close]')?.addEventListener('click', () => dialog.close());
}

/** Prompt an den gewählten Assistenten anpassen (Quellenzeile unterscheidet sich). */
// Nur in der Live-Demo: Auch für Beispielkunden wird der Prompt gezeigt – als
// lokale Vorschau mit Kopieraktion, ohne externes Fenster. Außerhalb der Vorführung
// bleibt es bei der geschützten Demo-Karte (renderDemo).
let briefingPreview = false;

export function setCustomerBriefingPreview(on) {
    briefingPreview = Boolean(on);
}

function previewActive() {
    return briefingPreview;
}

function rebuildPrompt() {
    currentPrompt = buildCustomerBriefingPrompt(
        currentCustomer,
        { ...customerBriefingContext(currentCustomer, state.tour, plannedDate(), state.customers), preview: previewActive() },
        currentAssistant,
        loadBriefingSources()
    );
}

function actionFooter() {
    setFooter(`<button type="button" class="primary" data-briefing-open>Prompt kopieren &amp; ${escapeHtml(currentAssistant.label)} öffnen</button>`);
    footer.querySelector('[data-briefing-open]')?.addEventListener('click', openAssistant);
}

function renderBriefing({ withChooser = false } = {}) {
    withChooser ||= previewActive();
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-manual">
            <span class="briefing-kicker">${previewActive() ? 'Demo · lokal kopierbar' : 'Direkt nutzbar'}</span>
            <h3>Dein Kundenbriefing ist vorbereitet</h3>
            <p class="briefing-manual-note"><b>Im Assistenten:</b> Prompt einfügen und selbst absenden. Erst dann werden die enthaltenen Daten übertragen.</p>
            ${withChooser ? assistantChooserHtml(currentAssistant, 'customer-briefing') : ''}
            ${briefingSourcesHtml()}
            ${visiblePrompt()}
        </div>`;
    fillVisiblePrompt();
    if (withChooser) {
        wireAssistantChooser(body, 'customer-briefing', (assistant) => {
            currentAssistant = assistant;
            rebuildPrompt();
            fillVisiblePrompt();
            actionFooter();
        }, { persist: !previewActive() });
    }
    // Der Prompt wird sofort neu gebaut und angezeigt: Der Nutzer soll die
    // Wirkung seiner Quelle hier sehen, nicht erst im Assistenten.
    wireBriefingSources(body, () => { rebuildPrompt(); fillVisiblePrompt(); });
    actionFooter();
}

function renderDemo() {
    body.innerHTML = `${identityHtml(currentCustomer)}
        <div class="briefing-state briefing-demo">
            <span class="briefing-kicker">Geschützte Demo</span>
            <h3>So unterstützt dich das Briefing unterwegs</h3>
            <div class="briefing-answer briefing-demo-preview"><b>Jetzt wichtig</b>
• Letzten Gesprächsstand und offene Zusagen auf einen Blick prüfen.
• Ansprechpartner und anstehende Termine priorisieren.

<b>Gespräch</b>
• Ziel und passender Einstieg für den nächsten Kontakt.
• Drei konkrete Fragen aus dem berechtigten Firmenwissen.

<b>Handlung</b>
• Nächsten Schritt, Chance und mögliches Risiko kompakt einordnen.</div>
            <p class="briefing-demo-note"><b>Keine Datenübertragung:</b> Für Beispielkunden erzeugt TourFuchs keinen Prompt und öffnet keinen Assistenten. Mit deinen echten Kundendaten entscheidest du selbst, wann du den vorbereiteten Prompt im Assistenten absendest.</p>
        </div>`;
    setFooter('<button type="button" class="primary" data-briefing-close>Verstanden</button>');
    wireClose();
}

async function openAssistant() {
    if (previewActive()) {
        const copied = await copyText(currentPrompt);
        showBriefingCopyResult(dialog?.open ? body : null, copied, currentAssistant.label, { demo: true });
        return;
    }
    if (isDemoCustomer(currentCustomer)) {
        renderDemo();
        return;
    }
    const copyPromise = copyText(currentPrompt);
    const assistantLabel = currentAssistant.label;
    launchAssistant(currentAssistant);
    const copied = await copyPromise;
    showBriefingCopyResult(dialog?.open ? body : null, copied, assistantLabel);
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
    if (isDemoCustomer(customer) && !briefingPreview) {
        currentPrompt = '';
        renderDemo();
        return;
    }
    currentAssistant = assistantForDepth(state.ui.depth);
    rebuildPrompt();
    renderBriefing({ withChooser: customerBriefingFlow(state.ui.depth) === 'choice' });
}
