/**
 * Ziel-Assistent für das Kundenbriefing.
 *
 * Bewusste Produktentscheidung: TourFuchs meldet sich **nirgends an** und ruft
 * **keine KI-API** auf. Die App bereitet den Prompt lokal vor, kopiert ihn auf
 * Knopfdruck und öffnet den Assistenten in einem neuen Tab. Einfügen und
 * Absenden macht der Nutzer selbst – das ist die einzige Stelle, an der Daten
 * das Gerät verlassen, und sie liegt vollständig in seiner Hand.
 *
 * In Basis ist das Ziel fest Microsoft 365 Copilot. Im Profi-Modus lässt sich
 * ein anderer Assistent wählen (oder eine eigene URL eintragen), weil nicht
 * jede Organisation Microsoft einsetzt.
 *
 * DOM-frei mit injizierbarem Storage, damit die Logik unit-testbar bleibt.
 */

const CHOICE_KEY = 'tourfuchs:briefing-assistant:v1';

// Altlasten der früheren automatischen Entra-/Graph-Anbindung. Sie werden beim
// Start gelöscht, damit keine Kennungen und keine Einwilligung von damals im
// Browser zurückbleiben.
const LEGACY_KEYS = ['tourfuchs:copilot-config:v1', 'tourfuchs:copilot-consent:v1'];

export const DEFAULT_ASSISTANT_ID = 'copilot';

/**
 * `promptSources` steuert, aus welchen Quellen der Assistent im Prompt schöpfen
 * soll – bei Copilot das berechtigte Microsoft-365-Wissen, bei Gemini das
 * Google-Workspace-Pendant, sonst neutral formuliert.
 */
export const ASSISTANTS = Object.freeze([
    {
        id: 'copilot',
        label: 'Microsoft 365 Copilot',
        hint: 'Firmenwissen aus Ihrem Microsoft-365-Konto',
        url: 'https://m365.cloud.microsoft/chat',
        preferEdge: true,
        promptSources: 'Durchsuche ausschließlich Microsoft-365-Inhalte, auf die ich mit meinem Arbeitskonto zugreifen darf: relevante E-Mails, Outlook-Termine, Teams-Chats, Besprechungen, Transkripte und Dateien.'
    },
    {
        id: 'gemini',
        label: 'Google Gemini',
        hint: 'Firmenwissen aus Google Workspace',
        url: 'https://gemini.google.com/app',
        promptSources: 'Durchsuche ausschließlich Google-Workspace-Inhalte, auf die ich mit meinem Arbeitskonto zugreifen darf: relevante E-Mails, Kalendertermine, Chats und Dateien in Drive.'
    },
    {
        id: 'chatgpt',
        label: 'ChatGPT',
        hint: 'Allgemeiner Assistent bzw. verbundene Quellen',
        url: 'https://chatgpt.com/',
        promptSources: 'Nutze ausschließlich die internen Quellen, auf die du in meinem Auftrag zugreifen darfst (z. B. verbundene Postfächer, Kalender und Dateiablagen).'
    },
    {
        id: 'custom',
        label: 'Eigener Assistent',
        hint: 'Adresse des Assistenten Ihrer Organisation',
        url: '',
        promptSources: 'Nutze ausschließlich die internen Quellen, auf die du in meinem Auftrag zugreifen darfst (z. B. verbundene Postfächer, Kalender und Dateiablagen).'
    }
]);

function clean(value) {
    return String(value ?? '').trim();
}

function store(provided) {
    if (provided) return provided;
    try { return globalThis.localStorage || null; } catch { return null; }
}

export function assistantById(id) {
    return ASSISTANTS.find((entry) => entry.id === id) || null;
}

/**
 * Nur https ist erlaubt: ein Assistent, der über http erreichbar wäre, würde
 * den Prompt im Klartext durchs Netz schicken.
 */
export function validateAssistantUrl(value) {
    const raw = clean(value);
    if (!raw) throw new Error('Bitte die Adresse des Assistenten eintragen.');
    let url;
    try {
        url = new URL(raw);
    } catch {
        throw new Error('Das ist keine gültige Web-Adresse (erwartet wird z. B. https://…).');
    }
    if (url.protocol !== 'https:') throw new Error('Nur https-Adressen sind zulässig.');
    return url.toString();
}

export function loadAssistantChoice(provided) {
    try {
        const saved = JSON.parse(store(provided)?.getItem(CHOICE_KEY) || '{}');
        const id = assistantById(saved.id) ? saved.id : DEFAULT_ASSISTANT_ID;
        return { id, customUrl: clean(saved.customUrl) };
    } catch {
        return { id: DEFAULT_ASSISTANT_ID, customUrl: '' };
    }
}

export function saveAssistantChoice(choice, provided) {
    const id = assistantById(choice?.id) ? choice.id : DEFAULT_ASSISTANT_ID;
    const customUrl = id === 'custom' ? validateAssistantUrl(choice?.customUrl) : '';
    const value = { id, customUrl };
    try { store(provided)?.setItem(CHOICE_KEY, JSON.stringify(value)); } catch { /* Speicherung ist optional */ }
    return value;
}

/**
 * Die Auswahl zu einem benutzbaren Assistenten auflösen. Eine unvollständige
 * eigene Adresse fällt bewusst auf Copilot zurück, damit der Knopf nie ins
 * Leere führt.
 */
export function resolveAssistant(choice = loadAssistantChoice()) {
    const entry = assistantById(choice?.id) || assistantById(DEFAULT_ASSISTANT_ID);
    if (entry.id !== 'custom') return { ...entry };
    try {
        return { ...entry, url: validateAssistantUrl(choice?.customUrl) };
    } catch {
        return { ...assistantById(DEFAULT_ASSISTANT_ID) };
    }
}

/** In Basis bleibt das Ziel bewusst fest; die Wahl gehört in den Profi-Modus. */
export function assistantForDepth(depth, choice = loadAssistantChoice()) {
    return depth === 'profi' ? resolveAssistant(choice) : { ...assistantById(DEFAULT_ASSISTANT_ID) };
}

/** Reste der früheren automatischen Microsoft-Anbindung entfernen. */
export function forgetLegacyCopilotSetup(provided) {
    for (const key of LEGACY_KEYS) {
        try { store(provided)?.removeItem(key); } catch { /* optional */ }
    }
}
