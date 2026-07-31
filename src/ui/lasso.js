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
 * Dazu der Rückweg: Im Profi-Modus trägt jede Zeile der Auswahlkarte ein
 * Häkchen. „Alle zur Tour" gab es schon – was fehlte, war **einige**. Ohne
 * Häkchen bleibt es beim Alten, mit Häkchen meint der Knopf genau die
 * angehakten. Damit schließt sich der Kreis: umfahren, briefen lassen, und die
 * drei, die sich lohnen, direkt in die Tour.
 *
 * Warum das Ziehen die Karte einfriert: „Finger runter und ziehen" heißt auf
 * einer Karte sonst „verschieben". Ohne ausdrücklichen Modus würde jedes
 * Verschieben zur Auswahl – daran sterben solche Werkzeuge.
 */
import L from 'leaflet';
import { state, emit, on } from '../core/state.js';
import { cardAnchorLatLng, customersOnMap, getMap, openMapCard } from '../features/map.js';
import { isOpportunity } from '../features/visits.js';
import { planningNow } from '../features/dayPlanner.js';
import { formatRevenueShort } from '../core/format.js';
import { collapseSheetForDemo, restoreSheetAfterDemo } from './sidebar.js';
import { isDemoCustomer } from '../core/demoSafety.js';
import { areaLabelFor } from '../features/areaBriefing.js';
import {
    customersInLasso,
    isUsableLasso,
    lassoSelectionLabel,
    polygonCentroid,
    simplifyPath,
    tourAdditionLabel,
    tourAdditions
} from '../features/lasso.js';
import { openAreaBriefing } from './areaBriefing.js';

let active = false;            // Zeichenmodus an?
let drawing = false;           // Finger/Maus gerade unten?
let points = [];               // Rohspur in Fensterpixeln
let overlay = null;            // SVG über der Karte, nur während des Zugs
let pathEl = null;
let startDot = null;           // Startpunkt der Spur, damit man ihn wiederfindet
let card = null;               // Auswahlkarte auf der Karte (Leaflet-Popup)
let shapeLayer = null;         // gezeichnete Fläche, bleibt nach dem Zug liegen
let hitLayer = null;           // Leuchtpunkte auf den Treffern
let selection = [];
let picked = new Set();        // angehakte Kunden auf der Auswahlkarte
let pointerId = null;
let sheetCollapsed = false;    // haben WIR das Blatt zusammengeschoben?

/**
 * Höchstzahl der Leuchtpunkte. Ein weit aufgezogenes Lasso kann über tausend
 * Kunden treffen – so viele Kreise sind auf einem Telefon eine Ruckelorgie und
 * ergeben ohnehin nur einen Farbteppich. Die Zahl im Streifen bleibt
 * vollständig; gedeckelt wird ausschließlich die Darstellung.
 */
const MAX_HIGHLIGHTS = 250;

/**
 * So viele Kunden stehen namentlich mit Häkchen auf der Auswahlkarte.
 *
 * Die Karte ist ein Popup auf einem Telefon, keine Tabelle. Acht Zeilen sind
 * das, was ohne Scrollen lesbar bleibt – und sie sind die richtigen acht: Die
 * Auswahl ist von der Mitte nach außen sortiert, oben steht also, was am
 * nächsten am Zentrum der gezogenen Fläche liegt. Wer alle will, nimmt „Alle
 * zur Tour"; das Häkchen ist für „diese drei".
 */
const MAX_CARD_ROWS = 8;

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

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

/**
 * Alles, was die Karte unter der Spur verschieben oder skalieren könnte.
 *
 * `touchZoom` gehört ausdrücklich dazu: Ein zweiter Finger mitten im Zug
 * zoomte die Karte, während die schon gezeichnete Spur in Bildschirm-
 * koordinaten stehen blieb – die Auswahl hätte danach eine andere Fläche
 * gemeint als die sichtbare Linie. Am Handy ist das der wahrscheinlichste
 * Fehlgriff überhaupt.
 */
const MAP_HANDLERS = ['dragging', 'doubleClickZoom', 'boxZoom', 'keyboard', 'scrollWheelZoom', 'touchZoom'];

let mapHandlerState = null;

/** Kartenbedienung während des Zeichnens stilllegen und danach zurückgeben. */
function setMapInteraction(enabled) {
    const map = getMap();
    if (!map) return;

    if (!enabled) {
        // Den vorherigen Zustand merken, statt hinterher pauschal alles
        // einzuschalten: Sonst gäbe das Lasso Kartenfunktionen zurück, die
        // jemand anders bewusst abgeschaltet hatte.
        mapHandlerState = {};
        for (const name of MAP_HANDLERS) {
            const handler = map[name];
            if (!handler) continue;
            mapHandlerState[name] = handler.enabled();
            handler.disable();
        }
        return;
    }

    for (const name of MAP_HANDLERS) {
        const handler = map[name];
        if (!handler) continue;
        // Ohne gemerkten Zustand (Freigeben ohne vorheriges Stilllegen) gilt
        // der bisherige Standard: einschalten.
        if (mapHandlerState ? mapHandlerState[name] : true) handler.enable();
    }
    mapHandlerState = null;
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
    // Der Startpunkt bleibt während des Zugs sichtbar: Man sieht, wohin man
    // zurückkommen muss, um die Fläche ungefähr zu schließen.
    startDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    startDot.setAttribute('class', 'lasso-start');
    startDot.setAttribute('r', '7');
    overlay.append(pathEl, startDot);
    container.appendChild(overlay);
    return overlay;
}

/**
 * Die Spur wächst mit jedem Zwischenschritt mit.
 *
 * Ab dem dritten Punkt wird sie geschlossen gezeichnet (`Z`) und gefüllt: So
 * ist schon während des Ziehens zu sehen, welche Fläche entsteht und wer darin
 * liegt – nicht erst beim Loslassen.
 */
function drawTrace() {
    if (!pathEl || points.length === 0) return;
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
    pathEl.setAttribute('d', points.length > 2 ? `${d} Z` : d);
    if (startDot) {
        startDot.setAttribute('cx', String(points[0].x));
        startDot.setAttribute('cy', String(points[0].y));
        startDot.removeAttribute('hidden');
    }
}

function clearTrace() {
    points = [];
    if (pathEl) pathEl.removeAttribute('d');
    if (startDot) startDot.setAttribute('hidden', '');
}

/** Alles Gezeichnete entfernen – Fläche, Leuchtpunkte, Streifen. */
export function clearLassoSelection() {
    const map = getMap();
    if (shapeLayer && map) map.removeLayer(shapeLayer);
    if (hitLayer && map) map.removeLayer(hitLayer);
    shapeLayer = null;
    hitLayer = null;
    selection = [];
    picked = new Set();
    if (card && map) map.closePopup(card);
    card = null;
    returnMapRoom();
}

/**
 * Eine Auswahl aufgeben, die nicht mehr zur Karte passt.
 *
 * Externer Prüfbericht, P2: Wer nach dem Ziehen den Modus wechselte oder den
 * Chancen-Filter einschaltete, behielt eine Auswahl mit Kunden, die auf der
 * Karte gar nicht mehr lagen – und konnte sie von dort in Tour und Briefing
 * weiterreichen.
 *
 * Bewusst **nicht** pauschal bei jedem Neuzeichnen geräumt: Nach „🚩 3 zur
 * Tour" wird ebenfalls neu gezeichnet, und dass die Auswahl dabei stehen
 * bleibt, ist zugesagtes Verhalten. Geräumt wird nur, wenn wirklich ein
 * ausgewählter Kunde von der Karte verschwunden ist.
 */
function dropSelectionIfStale() {
    if (!selection.length) return;
    const drawn = new Set(customersOnMap().map((customer) => customer.id));
    if (selection.every((customer) => drawn.has(customer.id))) return;
    clearLassoSelection();
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
    picked = new Set();
    openCard(polygon);
}

/** Wen betrifft „zur Tour"? Die Regel steht in `features/lasso.js`. */
function tourTargets() {
    return tourAdditions(selection, picked, state.tour.stops);
}

/**
 * Was steht auf der Auswahlkarte?
 *
 * Dieselbe Sprache wie im Kunden-Popup: erst wer, dann was daran auffällt,
 * dann was man tun kann. Angezeigt wird lokales Wissen – Umsatz und
 * Fälligkeiten sind auf dem eigenen Gerät kein Geheimnis. In den **Prompt**
 * geht davon nach wie vor nichts.
 */
function cardHtml() {
    const real = selection.filter((customer) => !isDemoCustomer(customer));
    const profi = state.ui.depth === 'profi';
    const due = selection.filter((customer) => isOpportunity(customer, planningNow())).length;
    const revenue = selection.reduce((sum, customer) => sum + (customer.umsatz || 0), 0);
    const places = [...new Set(selection.map((customer) => String(customer.ort ?? '').trim()).filter(Boolean))];

    const meta = [];
    if (due > 0) meta.push(`<b>${due}</b> fällig`);
    if (revenue > 0) meta.push(`${formatRevenueShort(revenue)} Umsatz`);
    if (places.length) {
        meta.push(places.length <= 3
            ? escapeHtml(places.join(' · '))
            : `${escapeHtml(places.slice(0, 3).join(' · '))} +${places.length - 3}`);
    }

    // Die ersten Namen machen greifbar, wen man erwischt hat. Im Profi-Modus
    // sind sie zugleich der Rückweg: anhaken und nur diese in die Tour nehmen.
    const shown = selection.slice(0, MAX_CARD_ROWS);
    const rest = selection.length - shown.length;
    const rows = shown.map((customer) => {
        const name = escapeHtml(customer.name);
        const place = customer.ort ? ` <span class="muted">${escapeHtml(customer.ort)}</span>` : '';
        if (!profi) return `<li>${name}${place}</li>`;
        // Wer schon in der Tour steht, wird gezeigt, aber nicht noch einmal
        // angeboten – sonst hakt man ihn an und es passiert nichts.
        if (state.tour.stops.includes(customer.id)) {
            // „in Tour" steht als eigene Marke am Zeilenende, nicht im Fließtext:
            // Sonst liest es sich wie ein Teil des Ortsnamens.
            return `<li class="popup-pick popup-pick-done"><span class="pick-check" aria-hidden="true">✓</span>
                <span>${name}${place}</span><span class="pick-badge">in Tour</span></li>`;
        }
        return `<li class="popup-pick"><label>
            <input type="checkbox" data-pick="${escapeHtml(customer.id)}"${picked.has(customer.id) ? ' checked' : ''}>
            <span>${name}${place}</span>
        </label></li>`;
    }).join('');

    const targets = tourTargets();
    const tourLabel = tourAdditionLabel(targets.length, picked.size > 0);

    const demoNote = real.length < 2
        ? `<p class="popup-lasso-note">${real.length === 0
            ? 'Hier liegen nur Beispielkunden – dafür wird bewusst kein Briefing erzeugt.'
            : 'Für einen einzelnen Kunden führt das Kundenbriefing weiter: einfach seinen Marker antippen.'}</p>`
        : '';

    return `<div class="popup popup-lasso">
        <h3>🧭 ${lassoSelectionLabel(selection.length)}</h3>
        ${meta.length ? `<p class="muted small popup-meta">${meta.join(' · ')}</p>` : ''}
        <ul class="popup-lasso-list${profi ? ' popup-lasso-picks' : ''}">${rows}</ul>
        ${rest > 0
            ? `<p class="muted small">und ${rest} weitere${profi ? ' – für die gibt es „Alle zur Tour"' : ''}</p>`
            : ''}
        ${demoNote}
        <div class="popup-actions">
            ${real.length >= 2
                ? '<button data-lasso="brief" id="btn-lasso-brief" title="Prompt für ein Briefing über diese Kunden vorbereiten">📋 Briefing über alle</button>'
                : ''}
            ${profi && targets.length > 0
                ? `<button data-lasso="tour" title="${picked.size > 0 ? 'Nur die angehakten Kunden in die Tour übernehmen' : 'Alle Kunden dieser Auswahl in die Tour übernehmen'}">${tourLabel}</button>`
                : ''}
            <button data-lasso="clear">✕ Auswahl aufheben</button>
        </div>
    </div>`;
}

/**
 * Auswahlkarte öffnen – ein Karten-Popup im Gewand der Kundenkarte.
 *
 * Bewusst kein eigener Streifen mehr: Der Nutzer kennt diese Karte vom
 * Kunden-Popup, und die Fortsetzung „📋 Briefing" steht dort, wo er sie
 * erwartet.
 */
function openCard(polygon) {
    const map = getMap();
    if (!map || selection.length === 0) return;
    const centroid = polygonCentroid(polygon);
    // Nicht stur der Flächenmittelpunkt: Die Karte klappt nach oben auf, und
    // über einem Punkt in der oberen Kartenhälfte ist am Handy kein Platz dafür.
    // `cardAnchorLatLng` schiebt den Anker so weit nach unten, dass die ganze
    // Karte im freien Bereich steht – siehe die Begründung dort.
    const at = cardAnchorLatLng(centroid) ?? map.containerPointToLatLng([centroid.x, centroid.y]);
    // Zwei Optionen, jede gegen einen konkreten Fehler:
    //  - `closeOnClick: false`: Direkt nach dem Loslassen wertet Leaflet die
    //    Berührung als Kartenklick und schlösse die Karte sofort wieder.
    //  - `autoClose: false`: Sie bleibt stehen, wenn nebenbei ein Kunden-Popup
    //    aufgeht.
    //
    // `autoPan` bleibt bewusst AN (Voreinstellung aus `popupOptions`, samt
    // Polstern für Topbar und Blatt). Eine Weile stand hier `autoPan: false`,
    // weil das Nachschwenken `movestart` auslöste und damit die eigene Regel
    // „Karte bewegt, Auswahl verwerfen". Die Regel hört inzwischen auf
    // `dragstart`/`zoomstart`, also nur noch auf echte Nutzerabsicht – und ohne
    // Nachschwenken hing eine hohe Auswahlkarte am Handy über den oberen
    // Fensterrand hinaus: Die erste Zeile lag hinter der Tab-Leiste und ließ
    // sich nicht antippen.
    card = openMapCard(at, cardHtml(), 'lasso-popup', { closeOnClick: false, autoClose: false });
    wireCard();
}

/**
 * Karte neu schreiben, ohne sie zu schließen.
 *
 * Nötig, weil ein Häkchen die Aufschrift des Tour-Knopfes ändert („Alle zur
 * Tour" → „3 zur Tour") und weil übernommene Kunden sofort als „in Tour"
 * dastehen sollen. `setContent` tauscht den Inhalt aus – die Ereignisse müssen
 * danach neu gesetzt werden.
 */
function refreshCard() {
    if (!card) return;
    card.setContent(cardHtml());
    wireCard();
}

/**
 * Warum die Knöpfe hier `data-lasso` heißen und nicht `data-action`:
 *
 * Die Karte hängt bei `popupopen` einen eigenen Zuhörer an **jeden**
 * `[data-action]`-Knopf in **jedem** Popup – und schließt das Popup danach,
 * wenn die Aktion unbekannt ist. Für die Kundenkarte ist das richtig; für die
 * Auswahlkarte war es tödlich: „zur Tour" übernahm die Kunden und riss die
 * Auswahl im selben Moment weg. Ein eigener Attributname hält die beiden
 * Verdrahtungen auseinander.
 */
function wireCard() {
    const root = card?.getElement();
    if (!root) return;

    root.querySelector('[data-lasso="brief"]')?.addEventListener('click', () => {
        openAreaBriefing(selection, areaLabelFor({ mode: 'lasso' }));
    });
    root.querySelector('[data-lasso="clear"]')?.addEventListener('click', clearLassoSelection);
    root.querySelector('[data-lasso="tour"]')?.addEventListener('click', () => {
        const added = tourTargets();
        if (added.length === 0) return;
        for (const customer of added) state.tour.stops.push(customer.id);
        picked = new Set();
        emit('tour:changed');
        emit('toast', { type: 'success', text: `${added.length} ${added.length === 1 ? 'Kunde' : 'Kunden'} zur Tour hinzugefügt.` });
        // Die Auswahl bleibt liegen: Man hakt oft zweimal an – erst die drei im
        // Gewerbegebiet, dann die zwei an der Ausfallstraße.
        refreshCard();
    });

    // Ein Häkchen ändert nur, wen der Knopf meint. Bewusst kein Neuaufbau der
    // Karte: Wer drei Häkchen setzt, würde sonst dreimal die Liste unter dem
    // Finger verlieren – und die Tastaturbedienung jedes Mal den Fokus.
    for (const box of root.querySelectorAll('[data-pick]')) {
        box.addEventListener('change', () => {
            if (box.checked) picked.add(box.dataset.pick);
            else picked.delete(box.dataset.pick);
            updateTourButton();
        });
    }
}

/** Nur die Aufschrift des Tour-Knopfes nachziehen, sonst nichts anfassen. */
function updateTourButton() {
    const button = card?.getElement()?.querySelector('[data-lasso="tour"]');
    if (!button) return;
    const targets = tourTargets();
    button.textContent = tourAdditionLabel(targets.length, picked.size > 0);
    button.title = picked.size > 0
        ? 'Nur die angehakten Kunden in die Tour übernehmen'
        : 'Alle Kunden dieser Auswahl in die Tour übernehmen';
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
    // Genau die Kunden, die auch gezeichnet sind – nicht die global
    // sichtbaren. Sonst gerieten bei Tour-Fokus, Service-Umfang oder
    // Chancen-Filter Kunden in Auswahl, Tour und Gebiets-Briefing, die auf
    // der Karte gar nicht liegen. Das Lasso verspricht: was du siehst.
    const found = customersInLasso(customersOnMap(), polygon, (customer) => {
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

/** Modus schalten. Getrennt exportiert, damit die Live-Demo ihn führen kann. */
export function setLassoActive(next) {
    active = Boolean(next);
    drawing = false;
    pointerId = null;
    clearTrace();
    if (active) giveMapRoom();
    else returnMapRoom();
    document.body.classList.toggle('lasso-active', active);
    const button = document.getElementById('btn-lasso');
    if (button) {
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        // Nur Symbol und Beschriftung tauschen – die Pille selbst bleibt
        // dieselbe wie beim Nachbarknopf.
        const icon = button.querySelector('.mns-icon');
        const label = button.querySelector('.mns-label');
        if (icon) icon.textContent = active ? '✏️' : '🖊️';
        if (label) label.textContent = active ? 'Ziehen …' : 'Lasso ziehen';
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
    const located = customersOnMap();
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
    //
    // Bewusst `dragstart`/`zoomstart` statt `movestart`: `movestart` feuert
    // auch bei programmatischen Schwenks – etwa dem der eigenen Auswahlkarte.
    // Die Auswahl löschte sich damit im selben Moment selbst.
    const map = getMap();
    if (map) map.on('dragstart zoomstart', () => { if (!drawing) clearLassoSelection(); });

    // Die gezeichnete Menge hängt seit dem Gleichzug mit der Karte auch am
    // Zoom (Flächenansicht = keine Marker) und am Chancen-Filter. Ohne dieses
    // Ereignis bliebe der Knopf stehen, wo er nichts mehr treffen kann.
    on('map:markers-rendered', () => { dropSelectionIfStale(); syncButtonVisibility(); });
    on('customers:changed', () => { clearLassoSelection(); syncButtonVisibility(); });
    on('filters:changed', () => { clearLassoSelection(); syncButtonVisibility(); });
    on('mode:changed', syncButtonVisibility);
    // Das Blatt auf- und zuziehen ändert, ob die Karte überhaupt sichtbar ist.
    on('sheet:changed', syncButtonVisibility);
    on('tab:changed', syncButtonVisibility);
    syncButtonVisibility();
}
