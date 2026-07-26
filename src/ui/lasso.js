/**
 * Lasso-Werkzeug auf der Karte.
 *
 * Ablauf in drei Schlägen – der mittlere ist der wichtigste:
 *
 *  1. Knopf drücken: Die Karte friert ein, der Zeiger wird zum Fadenkreuz.
 *     Ein Modus, den man sieht und wieder verlässt.
 *  2. Fläche ziehen: Beim Loslassen schließt sich die Form, die getroffenen
 *     Kunden leuchten auf, ein Streifen nennt die Zahl. **Erst sehen, dann
 *     gefragt werden** – diese halbe Sekunde trägt den ganzen Effekt.
 *  3. „Briefing erstellen": übergibt an das vorhandene Gebiets-Briefing.
 *
 * Der dritte Schritt baut bewusst **nichts Neues**: Prompt, Deckelung auf zwölf
 * Kunden, Datenschutzzusage und Demo-Sperre kommen unverändert aus
 * `areaBriefing`. Neu ist hier ausschließlich die Auswahl.
 *
 * Warum das Ziehen die Karte einfriert: „Finger runter und ziehen" heißt auf
 * einer Karte sonst „verschieben". Ohne ausdrücklichen Modus würde jedes
 * Verschieben zur Auswahl – daran sterben solche Werkzeuge.
 */
import L from 'leaflet';
import { state, emit, on, visibleCustomers } from '../core/state.js';
import { getMap } from '../features/map.js';
import { collapseSheetForDemo, restoreSheetAfterDemo } from './sidebar.js';
import { isDemoCustomer } from '../core/demoSafety.js';
import { areaLabelFor } from '../features/areaBriefing.js';
import { customersInLasso, isUsableLasso, lassoSelectionLabel, simplifyPath } from '../features/lasso.js';
import { openAreaBriefing } from './areaBriefing.js';

let active = false;            // Zeichenmodus an?
let drawing = false;           // Finger/Maus gerade unten?
let points = [];               // Rohspur in Fensterpixeln
let overlay = null;            // SVG über der Karte, nur während des Zugs
let pathEl = null;
let shapeLayer = null;         // gezeichnete Fläche, bleibt nach dem Zug liegen
let hitLayer = null;           // Leuchtpunkte auf den Treffern
let selection = [];
let pointerId = null;
let sheetCollapsed = false;    // haben WIR das Blatt zusammengeschoben?

/**
 * Höchstzahl der Leuchtpunkte. Ein weit aufgezogenes Lasso kann über tausend
 * Kunden treffen – so viele Kreise sind auf einem Telefon eine Ruckelorgie und
 * ergeben ohnehin nur einen Farbteppich. Die Zahl im Streifen bleibt
 * vollständig; gedeckelt wird ausschließlich die Darstellung.
 */
const MAX_HIGHLIGHTS = 250;

const HIT_STYLE = {
    radius: 9,
    color: '#0d9488',
    weight: 2,
    opacity: 0.95,
    fillColor: '#14b8a6',
    fillOpacity: 0.35
};

const SHAPE_STYLE = {
    color: '#0d9488',
    weight: 2,
    dashArray: '6 4',
    fillColor: '#14b8a6',
    fillOpacity: 0.12
};

function mapEl() {
    return document.getElementById('map');
}

function bar() {
    return document.getElementById('lasso-bar');
}

/** Kartenbedienung während des Zeichnens stilllegen und danach zurückgeben. */
function setMapInteraction(enabled) {
    const map = getMap();
    if (!map) return;
    for (const handler of ['dragging', 'doubleClickZoom', 'boxZoom', 'keyboard']) {
        if (map[handler]) enabled ? map[handler].enable() : map[handler].disable();
    }
    // Scrollzoom bleibt bewusst aus: ein Zoom mitten im Zug verschiebt alles,
    // was schon gezeichnet ist, gegenüber der Karte darunter.
    if (map.scrollWheelZoom) enabled ? map.scrollWheelZoom.enable() : map.scrollWheelZoom.disable();
}

function ensureOverlay() {
    const container = mapEl();
    if (!container) return null;
    if (overlay?.isConnected) return overlay;
    overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'lasso-overlay');
    overlay.setAttribute('aria-hidden', 'true');
    pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('class', 'lasso-path');
    overlay.appendChild(pathEl);
    container.appendChild(overlay);
    return overlay;
}

function drawTrace() {
    if (!pathEl || points.length === 0) return;
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
    pathEl.setAttribute('d', points.length > 2 ? `${d} Z` : d);
}

function clearTrace() {
    points = [];
    if (pathEl) pathEl.removeAttribute('d');
}

/** Alles Gezeichnete entfernen – Fläche, Leuchtpunkte, Streifen. */
export function clearLassoSelection() {
    const map = getMap();
    if (shapeLayer && map) map.removeLayer(shapeLayer);
    if (hitLayer && map) map.removeLayer(hitLayer);
    shapeLayer = null;
    hitLayer = null;
    selection = [];
    const el = bar();
    if (el) el.hidden = true;
    // Auf schmalen Geräten teilen sich Knopf und Streifen dieselbe Zeile.
    const tools = document.getElementById('lasso-tools');
    if (tools) tools.hidden = false;
    returnMapRoom();
    syncBusyState();
}

/**
 * Auswahl sichtbar machen.
 *
 * Die Leuchtpunkte liegen auf einer eigenen Ebene über den Clustern: Ein
 * getroffener Kunde kann in einem Stapel stecken und wäre sonst unsichtbar –
 * ausgerechnet im Moment, in dem die Auswahl überzeugen soll.
 */
function showSelection(polygon, customers) {
    const map = getMap();
    if (!map) return;
    clearLassoSelection();

    const ring = polygon.map((p) => map.containerPointToLatLng([p.x, p.y]));
    shapeLayer = L.polygon(ring, { ...SHAPE_STYLE, interactive: false }).addTo(map);
    hitLayer = L.layerGroup(
        customers
            .slice(0, MAX_HIGHLIGHTS)
            .map((customer) => L.circleMarker([customer.lat, customer.lng], { ...HIT_STYLE, interactive: false }))
    ).addTo(map);

    selection = customers;
    renderBar();
    syncBusyState();
}

/**
 * Auswahlstreifen aufbauen.
 *
 * Bewusst über DOM-Knoten statt innerHTML: Hier stehen Kundenzahlen aus
 * importierten Daten, und der Streifen soll nie zu einem Ort werden, an dem
 * fremder Inhalt zu Markup wird.
 */
function renderBar() {
    const el = bar();
    if (!el) return;
    // Unter zwei echten Kunden führt das Kundenbriefing weiter – dieselbe
    // Regel wie bei den anderen beiden Einstiegen.
    const canBrief = selection.filter((customer) => !isDemoCustomer(customer)).length >= 2;

    el.replaceChildren();
    const count = document.createElement('span');
    count.className = 'lasso-count';
    count.textContent = lassoSelectionLabel(selection.length);
    el.appendChild(count);

    if (canBrief) {
        const brief = document.createElement('button');
        brief.type = 'button';
        brief.className = 'primary';
        brief.id = 'btn-lasso-brief';
        brief.textContent = '🧭 Briefing erstellen';
        brief.addEventListener('click', () => {
            openAreaBriefing(selection, areaLabelFor({ mode: 'lasso' }));
        });
        el.appendChild(brief);
    }

    // Auf 390 Pixel Breite passen drei ausgeschriebene Beschriftungen nicht
    // nebeneinander. Der wichtige Knopf behält seinen Text, der zweite wird
    // zum Kreuz – die Bedeutung trägt dann das aria-label.
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'lasso-clear';
    clear.setAttribute('aria-label', 'Auswahl aufheben');
    const longLabel = document.createElement('span');
    longLabel.className = 'lasso-clear-long';
    longLabel.textContent = 'Auswahl aufheben';
    const shortLabel = document.createElement('span');
    shortLabel.className = 'lasso-clear-short';
    shortLabel.setAttribute('aria-hidden', 'true');
    shortLabel.textContent = '✕';
    clear.append(longLabel, shortLabel);
    clear.addEventListener('click', clearLassoSelection);
    el.appendChild(clear);
    el.hidden = false;
    // Solange die Auswahl steht, führt der Streifen weiter – der Werkzeugknopf
    // würde auf einem 390 Pixel breiten Schirm nur darüberliegen.
    const tools = document.getElementById('lasso-tools');
    if (tools) tools.hidden = true;
}

function finishStroke() {
    const polygon = simplifyPath(points);
    clearTrace();
    if (!isUsableLasso(polygon)) {
        // Ein Tippen ist kein Zug. Nichts auswählen, aber auch nicht schimpfen.
        emit('toast', { type: 'info', text: 'Ziehe eine Fläche um die Kunden, die dich interessieren.' });
        return;
    }
    const map = getMap();
    if (!map) return;
    const found = customersInLasso(visibleCustomers(), polygon, (customer) => {
        const point = map.latLngToContainerPoint([customer.lat, customer.lng]);
        return { x: point.x, y: point.y };
    });
    if (found.length === 0) {
        emit('toast', { type: 'info', text: 'In dieser Fläche liegt kein Kunde. Zieh sie etwas größer.' });
        return;
    }
    showSelection(polygon, found);
}

function relativePoint(event) {
    const rect = mapEl()?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function onPointerDown(event) {
    if (!active || drawing) return;
    if (event.button !== undefined && event.button !== 0) return;
    const point = relativePoint(event);
    if (!point) return;
    drawing = true;
    pointerId = event.pointerId;
    // Den Zeiger festhalten: Sonst gehen Bewegung und Loslassen an das
    // Element, über dem der Finger gerade steht – etwa an ein Karten-Popup
    // oder an den Rand hinaus – und der Zug endet mitten in der Fläche.
    try { mapEl()?.setPointerCapture(event.pointerId); } catch { /* nicht kritisch */ }
    clearLassoSelection();
    points = [point];
    ensureOverlay();
    drawTrace();
    event.preventDefault();
}

function onPointerMove(event) {
    if (!active || !drawing || event.pointerId !== pointerId) return;
    const point = relativePoint(event);
    if (!point) return;
    points.push(point);
    drawTrace();
    event.preventDefault();
}

function releasePointer(id) {
    try { mapEl()?.releasePointerCapture(id); } catch { /* schon frei */ }
}

function onPointerUp(event) {
    if (!active || !drawing || event.pointerId !== pointerId) return;
    drawing = false;
    releasePointer(pointerId);
    pointerId = null;
    finishStroke();
    // Nach einem Zug wieder aus dem Modus: Man zieht selten zweimal
    // hintereinander, und ein Werkzeug, das anbleibt, blockiert die Karte.
    setLassoActive(false);
    event.preventDefault();
}

/**
 * Der Browser kann eine Berührung jederzeit an sich ziehen (Systemgeste,
 * zweiter Finger). Wenn dabei schon eine brauchbare Fläche entstanden ist,
 * wird sie ausgewertet statt weggeworfen – der Nutzer hat sie gezogen.
 */
function onPointerCancel(event) {
    if (!drawing || (pointerId !== null && event.pointerId !== pointerId)) return;
    drawing = false;
    releasePointer(pointerId);
    pointerId = null;
    const salvaged = simplifyPath(points);
    if (isUsableLasso(salvaged)) {
        finishStroke();
        setLassoActive(false);
        return;
    }
    clearTrace();
}

/**
 * Blatt auf Guckhöhe schieben bzw. zurückgeben.
 *
 * Auf Handy und Tablet-Hochkant liegt das Blatt über der Karte; im
 * Tablet-Hochkant bleibt davon nur ein schmaler Streifen übrig, auf dem sich
 * nichts zeichnen lässt. Wer ein Zeichenwerkzeug einschaltet, will die Fläche
 * sehen.
 *
 * Zurück darf es erst, wenn **auch die Auswahl weg ist**: Der Modus schaltet
 * sich direkt nach dem Zug ab – käme das Blatt schon dann hoch, würde es den
 * Auswahlstreifen samt „Briefing erstellen" sofort wieder begraben.
 */
function giveMapRoom() {
    if (sheetCollapsed) return;
    collapseSheetForDemo();
    sheetCollapsed = true;
}

function returnMapRoom() {
    if (!sheetCollapsed || active || selection.length > 0) return;
    restoreSheetAfterDemo();
    sheetCollapsed = false;
}

/**
 * „Beschäftigt": Es wird gezeichnet oder es liegt eine Auswahl.
 *
 * In diesem Zustand tritt der schwebende Fuchs-Knopf zurück. Er sitzt am Handy
 * genau dort, wo Werkzeugknopf und Auswahlstreifen stehen, liegt darüber – und
 * verdeckte damit ausgerechnet „Briefing erstellen".
 */
function syncBusyState() {
    document.body.classList.toggle('lasso-busy', active || selection.length > 0);
}

/** Modus schalten. Getrennt exportiert, damit die Live-Demo ihn führen kann. */
export function setLassoActive(next) {
    active = Boolean(next);
    drawing = false;
    pointerId = null;
    clearTrace();
    if (active) giveMapRoom();
    else returnMapRoom();
    syncBusyState();
    document.body.classList.toggle('lasso-active', active);
    const button = document.getElementById('btn-lasso');
    if (button) {
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        button.textContent = active ? '✏️ Fläche ziehen …' : '🖊️ Fläche markieren';
    }
    if (overlay) overlay.classList.toggle('drawing', active);
    setMapInteraction(!active);
    if (active) {
        // Kurz halten: Der Hinweis steht am unteren Rand – genau dort, wo
        // gleich der Auswahlstreifen erscheint.
        emit('toast', { type: 'info', text: 'Zieh mit dem Finger oder der Maus eine Fläche um deine Kunden.', ms: 2600 });
    }
}

export function toggleLasso() {
    setLassoActive(!active);
}

export function isLassoActive() {
    return active;
}

/**
 * Die aktuelle Auswahl – für die Live-Demo.
 *
 * Mit Beispielkunden bietet der Streifen bewusst kein „Briefing erstellen" an.
 * Die Vorführung soll den Weg trotzdem zu Ende gehen und die geschützte
 * Demo-Vorschau zeigen; dafür braucht sie die Auswahl.
 */
export function lassoSelection() {
    return selection.slice();
}

/**
 * Der Knopf gehört nur dorthin, wo er etwas bewirkt: Ohne verortete Kunden
 * wäre er ein Versprechen ohne Deckung.
 */
function syncButtonVisibility() {
    const button = document.getElementById('btn-lasso');
    if (!button) return;
    const located = visibleCustomers().filter((c) => c.lat !== null && c.lng !== null);
    const show = located.length >= 2 && state.ui.mode !== 'simulation';
    button.hidden = !show;
    if (!show && active) setLassoActive(false);
}

export function initLasso() {
    const container = mapEl();
    const button = document.getElementById('btn-lasso');
    if (!container || !button) return;

    button.addEventListener('click', toggleLasso);
    container.addEventListener('pointerdown', onPointerDown, true);
    container.addEventListener('pointermove', onPointerMove, true);
    container.addEventListener('pointerup', onPointerUp, true);
    container.addEventListener('pointercancel', onPointerCancel, true);

    // Escape verlässt den Modus – wer sich verirrt, kommt ohne Suchen heraus.
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && active) setLassoActive(false);
    });

    // Eine Auswahl gilt für den Kartenausschnitt, in dem sie gezogen wurde.
    // Nach Verschieben oder Zoomen zeigt sie auf etwas anderes – also weg.
    const map = getMap();
    if (map) map.on('movestart zoomstart', () => { if (!drawing) clearLassoSelection(); });

    on('customers:changed', () => { clearLassoSelection(); syncButtonVisibility(); });
    on('filters:changed', () => { clearLassoSelection(); syncButtonVisibility(); });
    on('mode:changed', syncButtonVisibility);
    syncButtonVisibility();
}
