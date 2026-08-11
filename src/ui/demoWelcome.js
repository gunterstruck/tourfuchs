/**
 * Zentraler Willkommens-Hinweis über der Karte, solange Beispieldaten laufen.
 *
 * Beantwortet im Demo-Termin die entscheidende Frage „Das sind nur Beispiele –
 * wie komme ich an MEINE Daten?": eine gut sichtbare, aber nicht blockierende
 * Karte über der Landkarte mit drei klaren Wegen (eigene Daten laden · Live-
 * Demos ansehen · erst umsehen). Jeder Weg quittiert den Hinweis, damit er nicht
 * bei jedem Laden erneut aufpoppt – über ℹ️ und den Demo-Streifen bleibt er
 * jederzeit erreichbar. Nach bewusstem Löschen der Daten (echter Neustart)
 * erscheint er wieder.
 */
import { state, on, emit } from '../core/state.js';
import { isDemoDataset } from '../core/demoSafety.js';

const ACK_KEY = 'tf_demo_welcome_ack';
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');

let root = null;

function store() {
    try { return globalThis.localStorage || null; } catch { return null; }
}

function acknowledged() {
    return store()?.getItem(ACK_KEY) === '1';
}

function markAcknowledged() {
    try { store()?.setItem(ACK_KEY, '1'); } catch { /* Speicherung ist optional */ }
}

function forgetAcknowledged() {
    try { store()?.removeItem(ACK_KEY); } catch { /* Speicherung ist optional */ }
}

/** Sichtbar nur bei aktiven Beispieldaten, noch nicht quittiert, echte Ansicht. */
function shouldShow() {
    if (insideMobilePreview) return false;
    if (acknowledged()) return false;
    if (document.querySelector('.sc-shield')) return false; // laufende Live-Demo
    return isDemoDataset(state.customers);
}

/**
 * Steht die Karte gerade im Bild? Andere Angebote fragen danach, weil sie
 * dieselbe Frage beantworten wie sie („Was ist das hier – und wie komme ich an
 * meine Daten?") und deshalb solange zurücktreten.
 */
export function isDemoWelcomeOpen() {
    return !!root && !root.hidden;
}

function render() {
    if (!root) return;
    const vorher = !root.hidden;
    root.hidden = !shouldShow();
    // Nur bei echtem Wechsel melden: Wer darauf hört, klappt Angebote auf und zu.
    if (vorher !== !root.hidden) emit('demo-welcome:changed', !root.hidden);
}

/** Quittieren: merken und ausblenden. */
function dismiss() {
    markAcknowledged();
    render();
}

export function initDemoWelcome() {
    root = document.getElementById('demo-welcome');
    if (!root) return;

    // „Eigene Daten laden" quittiert ebenfalls; das Öffnen des geführten Dialogs
    // übernimmt der Import-Assistent (zweiter Listener auf demselben Knopf).
    document.getElementById('btn-demo-welcome-own')?.addEventListener('click', dismiss);
    // „Live-Demos ansehen" quittiert; das Öffnen des Schaufensters übernimmt das
    // Showcase-Modul (dort ist der Knopf mitregistriert).
    document.getElementById('btn-demo-welcome-demos')?.addEventListener('click', dismiss);
    document.getElementById('btn-demo-welcome-ack')?.addEventListener('click', dismiss);
    document.getElementById('btn-demo-welcome-close')?.addEventListener('click', dismiss);

    // Ein Tipp auf die Karte selbst quittiert ebenfalls.
    //
    // Anlass ist eine Messung, kein Wunsch: Der Rahmen um die Karte lässt Klicks
    // durch (`pointer-events: none`), die Karte selbst nicht – und sie steht
    // mittig über Deutschland, also genau dort, wo die Kundenstapel liegen. Am
    // Schreibtisch waren dadurch 8 von 11 Stapeln nicht antippbar, am Handy
    // **alle drei**. Wer als Erstes auf einen Stapel tippt, erlebte: nichts
    // passiert. Ein Angebot, das die Antwort verdeckt, über die es spricht
    // („sieh dich in Ruhe um"), muss wenigstens auf Berührung zurücktreten.
    //
    // Bewusst **kein** Durchreichen des Tipps an den Stapel darunter: Ein
    // synthetischer Zweitklick, den es nur in diesem einen Zustand gibt, wäre
    // der nächste unsichtbare Griff. Der erste Tipp räumt das Angebot weg – das
    // ist eine sichtbare Antwort –, der zweite zoomt.
    root.querySelector('.demo-welcome-card')?.addEventListener('click', (ev) => {
        // Die eigenen Knöpfe behalten ihre Bedeutung; sie quittieren schon selbst.
        if (ev.target.closest('button, a[href], input, select, textarea, label')) return;
        dismiss();
    });

    on('app:ready', render);
    on('customers:changed', render);
    on('demo:loaded', render);
    on('demo:auto-loaded', render);
    // Bewusstes Löschen ist ein echter Neustart: der Hinweis darf wiederkommen.
    on('dataset:cleared', () => { forgetAcknowledged(); render(); });

    render();
}
