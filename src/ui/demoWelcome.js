/**
 * Zentrale Begrüßung über der Karte, solange Beispieldaten laufen.
 *
 * Zwei gleichwertige Wege: „TourFuchs in Aktion sehen" (die Live-Demos als
 * Schleife) und „Eigene Daten laden". Die Begrüßung erscheint bei **jedem**
 * Start, solange keine eigenen Daten geladen sind – nicht nur beim allerersten:
 * Bis dahin ist die App ein Schaufenster, und die Vorführung ist das passende
 * Angebot. Eine Quittung gilt deshalb nur für den aktuellen Besuch
 * (sessionStorage).
 *
 * Tut niemand etwas, startet die Vorführung nach zehn Sekunden von selbst. Die
 * erste Bedienung irgendwo in der App bricht das endgültig ab (wer sich bewegt,
 * will sich selbst umsehen), und gezählt wird nur, solange der Tab sichtbar
 * ist. Ton gibt es dann erst nach einem Tipp – der Browser erlaubt Musik nur
 * nach einer Nutzergeste.
 *
 * Die Karte blockiert nicht: Daneben bleibt die Landkarte bedienbar. Jeder
 * Weg (auch „Verstanden – erst umsehen") quittiert sie für diesen Besuch; über
 * ℹ️ und den Demo-Streifen bleiben Demos und Import jederzeit erreichbar. Nach
 * bewusstem Löschen der Daten erscheint sie sofort wieder.
 */
import { state, on, emit } from '../core/state.js';
import { DEMO_WELCOME_AUTOSTART_SECONDS } from '../services/showcaseOnboarding.js';
import { isDemoDataset } from '../core/demoSafety.js';

const ACK_KEY = 'tf_demo_welcome_ack';
const insideMobilePreview = new URLSearchParams(location.search).has('mobilePreview');

let root = null;

// Pro Besuch, nicht für immer: Beim nächsten Start ohne eigene Daten begrüßt
// TourFuchs wieder.
function store() {
    try { return globalThis.sessionStorage || null; } catch { return null; }
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
    if (root.hidden) stopAutostart(); else startAutostart();
}

/** Quittieren: merken und ausblenden. */
function dismiss() {
    markAcknowledged();
    render();
}

// ---- Selbststart der Vorführung ----
let autostart = null;          // { timer, left }
let autostartCancelled = false; // gilt für den ganzen Besuch

function startAutostart() {
    if (autostart || autostartCancelled) return;
    const button = document.getElementById('btn-demo-welcome-demos');
    const hint = document.getElementById('demo-welcome-countdown');
    if (!button || !hint) return;
    let left = DEMO_WELCOME_AUTOSTART_SECONDS * 1000;
    let last = Date.now();
    hint.hidden = false;
    button.classList.add('is-counting');
    button.style.setProperty('--demo-welcome-autostart', `${DEMO_WELCOME_AUTOSTART_SECONDS}s`);
    const count = hint.querySelector('b');
    autostart = {
        timer: setInterval(() => {
            const now = Date.now();
            // Nur sichtbare Zeit zählt: im Hintergrund geöffnet heißt nicht angesehen.
            if (!document.hidden) left -= now - last;
            last = now;
            button.classList.toggle('is-waiting', document.hidden);
            if (count) count.textContent = String(Math.max(1, Math.ceil(left / 1000)));
            if (left > 0) return;
            stopAutostart();
            autostartCancelled = true;
            // Ein offenes Fenster (Import, Info …) ist eine Bedienung, die nur
            // noch nicht als Tipp ankam – dann nicht dazwischenfahren.
            if (document.querySelector('dialog[open]')) return;
            markAcknowledged();
            render();
            emit('demo-welcome:autostart');
        }, 100)
    };
}
function stopAutostart() {
    if (!autostart) return;
    clearInterval(autostart.timer);
    autostart = null;
    document.getElementById('demo-welcome-countdown')?.setAttribute('hidden', '');
    document.getElementById('btn-demo-welcome-demos')?.classList.remove('is-counting', 'is-waiting');
}
/** Erste Bedienung irgendwo in der App: kein Selbststart mehr in diesem Besuch. */
function cancelAutostart() {
    autostartCancelled = true;
    stopAutostart();
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

    // Jede Bedienung irgendwo in der App bricht den Selbststart ab – Karte
    // schieben und zoomen eingeschlossen. Erfasst in der Einfangphase, damit
    // Leaflet oder ein Knopf das Ereignis nicht vorher verschluckt.
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
        document.addEventListener(type, cancelAutostart, { capture: true, passive: true });
    });

    on('app:ready', render);
    on('showcase:running', render);
    on('customers:changed', render);
    on('demo:loaded', render);
    on('demo:auto-loaded', render);
    // Bewusstes Löschen ist ein echter Neustart: der Hinweis darf wiederkommen.
    on('dataset:cleared', () => { forgetAcknowledged(); autostartCancelled = false; render(); });

    render();
}
