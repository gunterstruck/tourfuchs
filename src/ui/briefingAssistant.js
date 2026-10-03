/**
 * Zielwahl für Briefings – ein Bauteil für Kunden- und Mehrkunden-Briefing.
 *
 * Beide Dialoge zeigen denselben Block („Ziel: … · Anderen Assistenten
 * wählen") und lesen/schreiben dieselbe gespeicherte Wahl. Wer im Lasso auf
 * ChatGPT umstellt, bekommt ChatGPT auch im nächsten Kundenbriefing – zwei
 * getrennte Einstellungen würden nur zu „warum öffnet sich hier etwas anderes?"
 * führen. Eingeklappt („Überblick → aufzoomen"): Der Normalfall bleibt ein
 * Knopf; wer ein anderes Werkzeug nutzt, klappt einmalig auf.
 */
import { ASSISTANTS, loadAssistantChoice, resolveAssistant, saveAssistantChoice } from '../services/assistant.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

/**
 * @param {object} currentAssistant  aufgelöstes Ziel (für die Überschrift)
 * @param {string} prefix            eindeutig je Dialog – beide Dialoge liegen
 *                                   gleichzeitig im Dokument, gleichnamige
 *                                   Radiogruppen würden sich sonst koppeln
 * @param {string} [scopeNote]       wo die gemeinsame Wahl gilt
 */
export function assistantChooserHtml(currentAssistant, prefix, scopeNote = 'Gilt für Kunden- und Mehrkunden-Briefing.') {
    const choice = loadAssistantChoice();
    const options = ASSISTANTS.map((entry) => `<label class="briefing-assistant-option">
            <input type="radio" name="${prefix}-assistant" value="${entry.id}"${entry.id === choice.id ? ' checked' : ''}>
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
                <input id="${prefix}-assistant-url" type="url" inputmode="url" autocomplete="off" spellcheck="false"
                    placeholder="https://assistent.meine-firma.de" value="${escapeHtml(choice.customUrl)}">
            </label>
            <p class="briefing-assistant-error" role="alert" hidden></p>
            <p class="muted small">${escapeHtml(scopeNote)} Die Wahl bestimmt nur, welches Fenster sich öffnet: TourFuchs sendet nichts – der Prompt geht erst raus, wenn du ihn dort absendest.</p>
        </div>
    </details>`;
}

/**
 * Zielwahl verdrahten.
 * @param {HTMLElement} root
 * @param {string} prefix
 * @param {(assistant: object) => void} onChange  mit dem neuen, gültigen Ziel
 */
export function wireAssistantChooser(root, prefix, onChange) {
    const apply = (id) => {
        const urlField = root.querySelector(`#${prefix}-assistant-url`);
        const errorBox = root.querySelector('.briefing-assistant-error');
        const wrapper = root.querySelector('.briefing-assistant-url');
        if (wrapper) wrapper.hidden = id !== 'custom';
        if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
        let assistant;
        try {
            assistant = resolveAssistant(saveAssistantChoice({ id, customUrl: urlField?.value }));
        } catch (error) {
            // Unvollständige eigene Adresse: Auswahl stehen lassen, Grund nennen,
            // Knopf so lange auf dem zuletzt gültigen Ziel belassen.
            if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
            return;
        }
        const summary = root.querySelector('.briefing-assistant summary b');
        if (summary) summary.textContent = `Ziel: ${assistant.label}`;
        onChange(assistant);
    };
    for (const input of root.querySelectorAll(`input[name="${prefix}-assistant"]`)) {
        input.addEventListener('change', () => apply(input.value));
    }
    const urlField = root.querySelector(`#${prefix}-assistant-url`);
    urlField?.addEventListener('change', () => apply('custom'));
    urlField?.addEventListener('blur', () => apply('custom'));
}

/**
 * Copilot ist unter Windows meist als Edge-App installiert; dort führt der
 * edge-Protokolllink direkt in die installierte App statt in einen zweiten
 * Browser. Alle anderen Ziele werden schlicht als Tab geöffnet.
 */
export function launchAssistant(assistant) {
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
